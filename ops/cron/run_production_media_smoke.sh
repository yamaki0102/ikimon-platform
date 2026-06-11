#!/bin/bash
# Run the production photo/video/AI smoke once, with durable JSONL logs.
set -euo pipefail

LOCK_FILE="/var/lock/ikimon-production-media-smoke.lock"
LOG_DIR="/var/log/ikimon/production-media-smoke"
VIDEO_FILE="/var/tmp/ikimon-production-media-smoke.mp4"
RUNNER="/var/www/ikimon.life/repo/ops/cron/run_v2_node_script.sh"

install -d -m 750 -o root -g root "${LOG_DIR}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "production media smoke is already running"
  exit 0
fi

if [[ ! -s "${VIDEO_FILE}" ]]; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg is required to generate ${VIDEO_FILE}" >&2
    exit 2
  fi
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc=size=320x240:rate=24" \
    -f lavfi -i "sine=frequency=880:duration=3" \
    -t 3 \
    -c:v libx264 -pix_fmt yuv420p \
    -c:a aac -shortest \
    "${VIDEO_FILE}"
fi

export SMOKE_VIDEO_FILE="${VIDEO_FILE}"
export SMOKE_LOG_DIR="${LOG_DIR}"
FIXTURE_PREFIX="prod-media-smoke-$(date -u +%Y%m%d%H%M%S)"

set +e
"${RUNNER}" smokeProductionMediaUpload --base-url=https://ikimon.life --fixture-prefix="${FIXTURE_PREFIX}"
SMOKE_STATUS=$?
"${RUNNER}" monitorProductionSmokeCleanup --fixture-prefix="${FIXTURE_PREFIX}" --max-age-minutes=0
CLEANUP_STATUS=$?
set -e

if [[ "${CLEANUP_STATUS}" -ne 0 ]]; then
  echo "production media smoke cleanup monitor failed for ${FIXTURE_PREFIX}" >&2
  exit "${CLEANUP_STATUS}"
fi

if [[ "${SMOKE_STATUS}" -ne 0 ]]; then
  echo "production media smoke failed for ${FIXTURE_PREFIX}; cleanup monitor completed" >&2
  exit "${SMOKE_STATUS}"
fi
