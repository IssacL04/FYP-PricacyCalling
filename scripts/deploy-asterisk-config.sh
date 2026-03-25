#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/deploy/asterisk"
TARGET_DIR="/etc/asterisk"

install -m 0644 "$SOURCE_DIR/pjsip.conf" "$TARGET_DIR/pjsip.conf"
install -m 0644 "$SOURCE_DIR/extensions.conf" "$TARGET_DIR/extensions.conf"
install -m 0644 "$SOURCE_DIR/manager.conf" "$TARGET_DIR/manager.conf"
install -m 0644 "$SOURCE_DIR/rtp.conf" "$TARGET_DIR/rtp.conf"
install -m 0644 "$SOURCE_DIR/modules.conf" "$TARGET_DIR/modules.conf"
install -m 0644 "$SOURCE_DIR/logger.conf" "$TARGET_DIR/logger.conf"

systemctl restart asterisk

echo "Asterisk configuration deployed and service restarted."
