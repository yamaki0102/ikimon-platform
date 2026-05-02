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
exec "${RUNNER}" smokeProductionMediaUpload --base-url=https://ikimon.life
