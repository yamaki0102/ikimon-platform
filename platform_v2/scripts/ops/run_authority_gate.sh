#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql}"
export V2_BASE_URL="${V2_BASE_URL:-http://127.0.0.1:3200}"

if [[ -z "${V2_PRIVILEGED_WRITE_API_KEY:-}" ]]; then
  echo "V2_PRIVILEGED_WRITE_API_KEY is required"
  exit 1
fi

if [[ "$(id -un)" == "root" ]]; then
  postgres_database_url="${IKIMON_AUTHORITY_GATE_DATABASE_URL:-postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql}"
  exec sudo -u postgres env \
    DATABASE_URL="${postgres_database_url}" \
    V2_BASE_URL="${V2_BASE_URL}" \
    V2_PRIVILEGED_WRITE_API_KEY="${V2_PRIVILEGED_WRITE_API_KEY}" \
    IKIMON_MIGRATION_REPAIR_CHECKSUMS="${IKIMON_MIGRATION_REPAIR_CHECKSUMS:-}" \
    bash "${BASH_SOURCE[0]}"
fi

cd "${PROJECT_ROOT}"

npm run repair:observation-spatial-mesh-schema
npm run migrate
npm run smoke:specialist-authority -- --base-url="${V2_BASE_URL}"
