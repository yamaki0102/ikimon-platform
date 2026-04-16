#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CANDIDATE_CONFIG="${CANDIDATE_CONFIG:-${PROJECT_ROOT}/ops/nginx/ikimon.life-v2-cutover.conf}"
LIVE_AVAILABLE="${LIVE_AVAILABLE:-/etc/nginx/sites-available/ikimon.life}"
LIVE_ENABLED="${LIVE_ENABLED:-/etc/nginx/sites-enabled/ikimon.life}"
SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-/var/www/ikimon.life-staging/cutover-snapshots}"
PUBLIC_RUNTIME_PORT="${PUBLIC_RUNTIME_PORT:-3200}"

DRY_RUN=0
LABEL=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --label=*) LABEL="${arg#--label=}" ;;
  esac
done

LABEL="${LABEL:-switch-$(date +%Y%m%d-%H%M%S)}"
TMP_AVAILABLE="$(mktemp)"
TMP_ENABLED="$(mktemp)"
RENDERED_CONFIG="$(mktemp)"
cp "${LIVE_AVAILABLE}" "${TMP_AVAILABLE}"
cp "${LIVE_ENABLED}" "${TMP_ENABLED}"
sed "s#127\\.0\\.0\\.1:3200#127.0.0.1:${PUBLIC_RUNTIME_PORT}#g" "${CANDIDATE_CONFIG}" > "${RENDERED_CONFIG}"

cleanup() {
  cp "${TMP_AVAILABLE}" "${LIVE_AVAILABLE}"
  cp "${TMP_ENABLED}" "${LIVE_ENABLED}"
  rm -f "${TMP_AVAILABLE}" "${TMP_ENABLED}" "${RENDERED_CONFIG}"
}

trap cleanup EXIT

curl -fsS "http://127.0.0.1:${PUBLIC_RUNTIME_PORT}/healthz" >/dev/null
cp "${RENDERED_CONFIG}" "${LIVE_AVAILABLE}"
cp "${RENDERED_CONFIG}" "${LIVE_ENABLED}"
nginx -t

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "dry-run ok"
  echo "mode: archive-ready"
  echo "public runtime target: v2 (127.0.0.1:${PUBLIC_RUNTIME_PORT})"
  echo "legacy php role: rollback/archive artifact only"
  exit 0
fi

SNAPSHOT_PATH="$(PUBLIC_RUNTIME_PORT="${PUBLIC_RUNTIME_PORT}" "${SCRIPT_DIR}/snapshot_cutover_state.sh" "${LABEL}")"
cp "${RENDERED_CONFIG}" "${LIVE_AVAILABLE}"
cp "${RENDERED_CONFIG}" "${LIVE_ENABLED}"
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload
curl -fsS https://ikimon.life/healthz >/dev/null

rm -f "${TMP_AVAILABLE}" "${TMP_ENABLED}" "${RENDERED_CONFIG}"
trap - EXIT
echo "mode: archive-active"
echo "public runtime target: v2 (127.0.0.1:${PUBLIC_RUNTIME_PORT})"
echo "legacy php role: rollback/archive artifact only"
echo "${SNAPSHOT_PATH}"
