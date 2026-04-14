#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_shadow?host=%2Fvar%2Frun%2Fpostgresql}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://ikimon.life}"
export FIXTURE_PREFIX="${FIXTURE_PREFIX:-cutover-day0}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    DATABASE_URL="${DATABASE_URL}" \
    PUBLIC_BASE_URL="${PUBLIC_BASE_URL}" \
    FIXTURE_PREFIX="${FIXTURE_PREFIX}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"

npm run smoke:v2-lane -- --base-url="${PUBLIC_BASE_URL}"
npm run smoke:v2-read-lane -- --base-url="${PUBLIC_BASE_URL}"
npm run smoke:v2-write-lane -- --base-url="${PUBLIC_BASE_URL}" --fixture-prefix="${FIXTURE_PREFIX}"
