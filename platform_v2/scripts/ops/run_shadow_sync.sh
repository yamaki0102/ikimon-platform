#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql}"
export SHADOW_SYNC_SOURCE_NAME="${SHADOW_SYNC_SOURCE_NAME:-legacy_fs}"
export SHADOW_LEGACY_MIRROR_ROOT="${SHADOW_LEGACY_MIRROR_ROOT:-}"
export SHADOW_LEGACY_DATA_ROOT="${SHADOW_LEGACY_DATA_ROOT:-}"
export SHADOW_UPLOADS_ROOT="${SHADOW_UPLOADS_ROOT:-}"
export SHADOW_PUBLIC_ROOT="${SHADOW_PUBLIC_ROOT:-}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    DATABASE_URL="${DATABASE_URL}" \
    SHADOW_SYNC_FORCE="${SHADOW_SYNC_FORCE:-0}" \
    SHADOW_SYNC_SOURCE_NAME="${SHADOW_SYNC_SOURCE_NAME}" \
    SHADOW_LEGACY_MIRROR_ROOT="${SHADOW_LEGACY_MIRROR_ROOT}" \
    SHADOW_LEGACY_DATA_ROOT="${SHADOW_LEGACY_DATA_ROOT}" \
    SHADOW_UPLOADS_ROOT="${SHADOW_UPLOADS_ROOT}" \
    SHADOW_PUBLIC_ROOT="${SHADOW_PUBLIC_ROOT}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"

ARGS=()
if [[ "${SHADOW_SYNC_FORCE:-0}" == "1" ]]; then
  ARGS+=("--force")
fi
if [[ -n "${SHADOW_SYNC_SOURCE_NAME}" ]]; then
  ARGS+=("--source-name=${SHADOW_SYNC_SOURCE_NAME}")
fi
if [[ -n "${SHADOW_LEGACY_MIRROR_ROOT}" ]]; then
  ARGS+=("--mirror-root=${SHADOW_LEGACY_MIRROR_ROOT}")
fi
if [[ -n "${SHADOW_LEGACY_DATA_ROOT}" ]]; then
  ARGS+=("--legacy-data-root=${SHADOW_LEGACY_DATA_ROOT}")
fi
if [[ -n "${SHADOW_UPLOADS_ROOT}" ]]; then
  ARGS+=("--uploads-root=${SHADOW_UPLOADS_ROOT}")
fi
if [[ -n "${SHADOW_PUBLIC_ROOT}" ]]; then
  ARGS+=("--public-root=${SHADOW_PUBLIC_ROOT}")
fi

npm run sync:legacy -- "${ARGS[@]}"
