#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_shadow?host=%2Fvar%2Frun%2Fpostgresql}"
export PRODUCTION_MIRROR_ROOT="${PRODUCTION_MIRROR_ROOT:-/var/www/ikimon.life-staging/mirrors/production_legacy}"
export SHADOW_LEGACY_MIRROR_ROOT="${SHADOW_LEGACY_MIRROR_ROOT:-${PRODUCTION_MIRROR_ROOT}}"
export SHADOW_LEGACY_DATA_ROOT="${SHADOW_LEGACY_DATA_ROOT:-${PRODUCTION_MIRROR_ROOT}/data}"
export SHADOW_UPLOADS_ROOT="${SHADOW_UPLOADS_ROOT:-${PRODUCTION_MIRROR_ROOT}/uploads}"
export SHADOW_PUBLIC_ROOT="${SHADOW_PUBLIC_ROOT:-${PRODUCTION_MIRROR_ROOT}/public}"
export SHADOW_VERIFY_IMPORT_VERSION="${SHADOW_VERIFY_IMPORT_VERSION:-production_shadow_live}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    DATABASE_URL="${DATABASE_URL}" \
    PRODUCTION_MIRROR_ROOT="${PRODUCTION_MIRROR_ROOT}" \
    SHADOW_LEGACY_MIRROR_ROOT="${SHADOW_LEGACY_MIRROR_ROOT}" \
    SHADOW_LEGACY_DATA_ROOT="${SHADOW_LEGACY_DATA_ROOT}" \
    SHADOW_UPLOADS_ROOT="${SHADOW_UPLOADS_ROOT}" \
    SHADOW_PUBLIC_ROOT="${SHADOW_PUBLIC_ROOT}" \
    SHADOW_VERIFY_IMPORT_VERSION="${SHADOW_VERIFY_IMPORT_VERSION}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"

npm run verify:production-shadow -- \
  --mirror-root="${SHADOW_LEGACY_MIRROR_ROOT}" \
  --legacy-data-root="${SHADOW_LEGACY_DATA_ROOT}" \
  --uploads-root="${SHADOW_UPLOADS_ROOT}" \
  --public-root="${SHADOW_PUBLIC_ROOT}" \
  --import-version="${SHADOW_VERIFY_IMPORT_VERSION}"
