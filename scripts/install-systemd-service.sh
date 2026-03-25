#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_SRC="$PROJECT_ROOT/deploy/systemd/privacy-calling-api.service"
SERVICE_DST="/etc/systemd/system/privacy-calling-api.service"
ENV_EXAMPLE="$PROJECT_ROOT/deploy/env/privacy-calling.env.example"
ENV_TARGET="$PROJECT_ROOT/deploy/env/privacy-calling.env"

if [[ ! -f "$ENV_TARGET" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_TARGET"
  echo "Created $ENV_TARGET. Please edit secrets before starting the service."
fi

install -m 0644 "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
systemctl enable privacy-calling-api
systemctl restart privacy-calling-api

echo "Systemd service installed and started."
