#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_SSH_HOST="${PRODUCTION_SSH_HOST:-www1070.onamae.ne.jp}"
PRODUCTION_SSH_PORT="${PRODUCTION_SSH_PORT:-8022}"
PRODUCTION_SSH_USER="${PRODUCTION_SSH_USER:-r1522484}"
PRODUCTION_SSH_KEY="${PRODUCTION_SSH_KEY:-/root/.ssh/onamae_backup}"
PRODUCTION_LEGACY_DATA_ROOT="${PRODUCTION_LEGACY_DATA_ROOT:-/home/r1522484/public_html/ikimon.life/data}"
PRODUCTION_UPLOADS_ROOT="${PRODUCTION_UPLOADS_ROOT:-/home/r1522484/public_html/ikimon.life/persistent/uploads}"
PRODUCTION_PUBLIC_ROOT="${PRODUCTION_PUBLIC_ROOT:-/home/r1522484/public_html/ikimon.life/public_html}"
PRODUCTION_MIRROR_ROOT="${PRODUCTION_MIRROR_ROOT:-/var/www/ikimon.life-staging/mirrors/production_legacy}"

SSH_CMD=(
  ssh
  -i "${PRODUCTION_SSH_KEY}"
  -p "${PRODUCTION_SSH_PORT}"
  -o StrictHostKeyChecking=no
)

mkdir -p "${PRODUCTION_MIRROR_ROOT}/data" "${PRODUCTION_MIRROR_ROOT}/uploads" "${PRODUCTION_MIRROR_ROOT}/public"

rsync -az --delete -e "${SSH_CMD[*]}" \
  "${PRODUCTION_SSH_USER}@${PRODUCTION_SSH_HOST}:${PRODUCTION_LEGACY_DATA_ROOT}/" \
  "${PRODUCTION_MIRROR_ROOT}/data/"

rsync -az --delete -e "${SSH_CMD[*]}" \
  "${PRODUCTION_SSH_USER}@${PRODUCTION_SSH_HOST}:${PRODUCTION_UPLOADS_ROOT}/" \
  "${PRODUCTION_MIRROR_ROOT}/uploads/"

rsync -az --delete -e "${SSH_CMD[*]}" \
  "${PRODUCTION_SSH_USER}@${PRODUCTION_SSH_HOST}:${PRODUCTION_PUBLIC_ROOT}/" \
  "${PRODUCTION_MIRROR_ROOT}/public/"

echo "production legacy mirror refreshed at ${PRODUCTION_MIRROR_ROOT}"
