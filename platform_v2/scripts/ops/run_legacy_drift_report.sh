#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    DATABASE_URL="${DATABASE_URL}" \
    DRIFT_HISTORY="${DRIFT_HISTORY:-5}" \
    DRIFT_STALE_HOURS="${DRIFT_STALE_HOURS:-24}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"
npm run report:legacy-drift -- --history="${DRIFT_HISTORY:-5}" --stale-hours="${DRIFT_STALE_HOURS:-24}"
