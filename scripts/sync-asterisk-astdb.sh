#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${DB_PATH:-$PROJECT_ROOT/data/privacy.db}"
ASTERISK_BIN="${ASTERISK_BIN:-asterisk}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required but not found."
  exit 1
fi

if ! command -v "$ASTERISK_BIN" >/dev/null 2>&1; then
  echo "Asterisk CLI binary not found: $ASTERISK_BIN"
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database not found: $DB_PATH"
  exit 1
fi

run_ami_db_cmd() {
  local cmd="$1"
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    "$ASTERISK_BIN" -rx "$cmd" >/dev/null
  else
    sudo "$ASTERISK_BIN" -rx "$cmd" >/dev/null
  fi
}

echo "Syncing AstDB from SQLite: $DB_PATH"

run_ami_db_cmd "database deltree pc_users_by_endpoint"
run_ami_db_cmd "database deltree pc_users_by_e164"
run_ami_db_cmd "database deltree pc_virtual_by_callee"
run_ami_db_cmd "database deltree pc_virtual_default"

user_count=0
while IFS='|' read -r endpoint e164; do
  [[ -z "${endpoint}" || -z "${e164}" ]] && continue
  run_ami_db_cmd "database put pc_users_by_endpoint ${endpoint} ${e164}"
  run_ami_db_cmd "database put pc_users_by_e164 ${e164} ${endpoint}"
  user_count=$((user_count + 1))
done < <(
  sqlite3 -separator '|' "$DB_PATH" \
    "SELECT caller_endpoint, real_e164 FROM users WHERE enabled = 1 ORDER BY id;"
)

virtual_default="$(sqlite3 "$DB_PATH" "SELECT e164 FROM virtual_numbers WHERE enabled = 1 ORDER BY id LIMIT 1;")"
if [[ -n "${virtual_default}" ]]; then
  run_ami_db_cmd "database put pc_virtual_default default ${virtual_default}"
fi

mapping_count=0
while IFS='|' read -r callee_e164 virtual_e164; do
  [[ -z "${callee_e164}" || -z "${virtual_e164}" ]] && continue
  run_ami_db_cmd "database put pc_virtual_by_callee ${callee_e164} ${virtual_e164}"
  mapping_count=$((mapping_count + 1))
done < <(
  sqlite3 -separator '|' "$DB_PATH" \
    "SELECT m.callee_e164, v.e164
       FROM id_mappings m
       JOIN virtual_numbers v ON v.id = m.virtual_number_id
      WHERE v.enabled = 1
      ORDER BY m.id;"
)

echo "AstDB sync completed."
echo "  users synced: ${user_count}"
echo "  virtual mappings synced: ${mapping_count}"
echo "  default virtual: ${virtual_default:-<none>}"
