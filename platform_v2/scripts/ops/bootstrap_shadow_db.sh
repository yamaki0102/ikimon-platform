#!/usr/bin/env bash
set -euo pipefail

SHADOW_TEMPLATE_DB="${SHADOW_TEMPLATE_DB:-ikimon_v2_staging}"
SHADOW_TARGET_DB="${SHADOW_TARGET_DB:-ikimon_v2_shadow}"

if [[ "$(id -un)" == "root" ]]; then
  exec sudo -u postgres env \
    SHADOW_TEMPLATE_DB="${SHADOW_TEMPLATE_DB}" \
    SHADOW_TARGET_DB="${SHADOW_TARGET_DB}" \
    bash "${BASH_SOURCE[0]}"
fi

dropdb --if-exists "${SHADOW_TARGET_DB}"
createdb "${SHADOW_TARGET_DB}"
pg_dump --schema-only --no-owner --no-privileges "${SHADOW_TEMPLATE_DB}" | psql "${SHADOW_TARGET_DB}"

echo "shadow db bootstrapped from ${SHADOW_TEMPLATE_DB} -> ${SHADOW_TARGET_DB}"
