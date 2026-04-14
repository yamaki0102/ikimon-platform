#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-/var/www/ikimon.life-staging/cutover-snapshots}"
SHADOW_DB="${SHADOW_DB:-ikimon_v2_shadow}"
LIVE_AVAILABLE="${LIVE_AVAILABLE:-/etc/nginx/sites-available/ikimon.life}"
LIVE_ENABLED="${LIVE_ENABLED:-/etc/nginx/sites-enabled/ikimon.life}"
LABEL="${1:-snapshot-$(date +%Y%m%d-%H%M%S)}"
TARGET_DIR="${SNAPSHOT_ROOT}/${LABEL}"

mkdir -p "${TARGET_DIR}"

cp "${LIVE_AVAILABLE}" "${TARGET_DIR}/nginx-sites-available-ikimon.life.conf"
cp "${LIVE_ENABLED}" "${TARGET_DIR}/nginx-sites-enabled-ikimon.life.conf"
crontab -l > "${TARGET_DIR}/root-crontab.txt" 2>/dev/null || true
curl -fsS http://127.0.0.1:3200/healthz > "${TARGET_DIR}/v2-healthz.json"
curl -fsS http://127.0.0.1:3200/readyz > "${TARGET_DIR}/v2-readyz.json"
curl -fsS http://127.0.0.1:3200/ops/readiness > "${TARGET_DIR}/v2-ops-readiness.json"
sudo -u postgres pg_dump -Fc "${SHADOW_DB}" > "${TARGET_DIR}/${SHADOW_DB}.dump"
sha256sum "${TARGET_DIR}/"* > "${TARGET_DIR}/SHA256SUMS"

echo "${TARGET_DIR}"
