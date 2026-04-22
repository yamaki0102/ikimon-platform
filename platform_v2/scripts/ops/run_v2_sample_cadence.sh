#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql}"
export V2_BASE_URL="${V2_BASE_URL:-http://127.0.0.1:3200}"
export SAMPLE_FIXTURE_PREFIX="${SAMPLE_FIXTURE_PREFIX:-sample-cadence-$(date -u +%Y%m%d%H%M%S)}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    DATABASE_URL="${DATABASE_URL}" \
    V2_BASE_URL="${V2_BASE_URL}" \
    SAMPLE_FIXTURE_PREFIX="${SAMPLE_FIXTURE_PREFIX}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"

npm run smoke:v2-lane -- --base-url="${V2_BASE_URL}"
npm run smoke:v2-read-lane -- --base-url="${V2_BASE_URL}"
npm run smoke:v2-write-lane -- --base-url="${V2_BASE_URL}" --fixture-prefix="${SAMPLE_FIXTURE_PREFIX}"
npm run smoke:v2-monitoring-lane -- --base-url="${V2_BASE_URL}"
