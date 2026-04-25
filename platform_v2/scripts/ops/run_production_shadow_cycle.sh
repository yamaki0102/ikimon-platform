#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_shadow?host=%2Fvar%2Frun%2Fpostgresql}"
export SHADOW_SYNC_SOURCE_NAME="${SHADOW_SYNC_SOURCE_NAME:-production_legacy_fs}"
export PRODUCTION_MIRROR_ROOT="${PRODUCTION_MIRROR_ROOT:-/var/www/ikimon.life-staging/mirrors/production_legacy}"
export SHADOW_LEGACY_MIRROR_ROOT="${SHADOW_LEGACY_MIRROR_ROOT:-${PRODUCTION_MIRROR_ROOT}}"
export SHADOW_LEGACY_DATA_ROOT="${SHADOW_LEGACY_DATA_ROOT:-${PRODUCTION_MIRROR_ROOT}/data}"
export SHADOW_UPLOADS_ROOT="${SHADOW_UPLOADS_ROOT:-${PRODUCTION_MIRROR_ROOT}/uploads}"
export SHADOW_PUBLIC_ROOT="${SHADOW_PUBLIC_ROOT:-${PRODUCTION_MIRROR_ROOT}/public}"

cd "${PROJECT_ROOT}"

bash "${SCRIPT_DIR}/pull_production_legacy_mirror.sh"
bash "${SCRIPT_DIR}/run_shadow_sync.sh"
bash "${SCRIPT_DIR}/run_production_shadow_verify.sh"
bash "${SCRIPT_DIR}/run_legacy_drift_report.sh"
