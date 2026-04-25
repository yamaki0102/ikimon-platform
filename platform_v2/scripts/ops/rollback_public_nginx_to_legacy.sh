#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-/var/www/ikimon.life-staging/cutover-snapshots}"
LIVE_AVAILABLE="${LIVE_AVAILABLE:-/etc/nginx/sites-available/ikimon.life}"
LIVE_ENABLED="${LIVE_ENABLED:-/etc/nginx/sites-enabled/ikimon.life}"

SNAPSHOT_DIR="${1:-}"
if [[ -z "${SNAPSHOT_DIR}" ]]; then
  SNAPSHOT_DIR="$(find "${SNAPSHOT_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
fi

if [[ -z "${SNAPSHOT_DIR}" || ! -d "${SNAPSHOT_DIR}" ]]; then
  echo "snapshot directory not found" >&2
  exit 1
fi

cp "${SNAPSHOT_DIR}/nginx-sites-available-ikimon.life.conf" "${LIVE_AVAILABLE}"
cp "${SNAPSHOT_DIR}/nginx-sites-enabled-ikimon.life.conf" "${LIVE_ENABLED}"
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload
curl -fsS https://ikimon.life/ >/dev/null

echo "mode: rollback-active"
echo "public runtime target: legacy snapshot"
echo "legacy php role: restored as emergency runtime from snapshot"
echo "${SNAPSHOT_DIR}"
