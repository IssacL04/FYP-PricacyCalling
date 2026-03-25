#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

apt-get update
apt-get install -y asterisk sipsak sqlite3

systemctl enable asterisk
systemctl restart asterisk

echo "System dependencies installed."
