#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="${1:-/home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log}"
DURATION="${2:-120}"

echo "[1/4] Enable verbose/debug and SIP/RTP tracing"
sudo asterisk -rx 'core set verbose 5' >/dev/null
sudo asterisk -rx 'core set debug 3' >/dev/null
sudo asterisk -rx 'pjsip set logger on' >/dev/null
sudo asterisk -rx 'rtp set debug on' >/dev/null

echo "[2/4] Capturing /var/log/asterisk/full for ${DURATION}s"
echo "      Output: ${OUT_FILE}"
sudo timeout "${DURATION}" tail -f /var/log/asterisk/full | tee "${OUT_FILE}" || true

echo "[3/4] Disable SIP/RTP trace"
sudo asterisk -rx 'pjsip set logger off' >/dev/null || true
sudo asterisk -rx 'rtp set debug off' >/dev/null || true

echo "[4/4] Done. Share this file: ${OUT_FILE}"
