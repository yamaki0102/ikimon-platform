#!/usr/bin/env bash
# ikimon.production-phase/v1:materialize
set +x
set -euo pipefail

reject_secret_overlap() {
  local name
  for name in \
    CLOUDFLARE_API_TOKEN \
    OPS_PRODUCTION_MATERIALIZATION_HMAC_SECRET \
    IKIMON_AUTOMATION_PUSH_SECRET \
    AUTOMATION_CALLBACK_SECRET \
    GITHUB_TOKEN \
    GH_TOKEN \
    GEMINI_API_KEY \
    VPS_SSH_KEY \
    SSH_PRIVATE_KEY; do
    if [[ -n "${!name:-}" ]]; then
      echo "production_materialization_secret_overlap_forbidden:${name}" >&2
      exit 2
    fi
  done
}

reject_secret_overlap

if [[ "${IKIMON_PRODUCTION_PHASE_V1:-}" != "ikimon.production-phase/v1:materialize" ]]; then
  echo "IKIMON_PRODUCTION_PHASE_V1 must be ikimon.production-phase/v1:materialize" >&2
  exit 2
fi

if [[ ! "${IKIMON_OPS_JOB_ID:-}" =~ ^ops-[a-f0-9-]{16,80}$ ]]; then
  echo "IKIMON_OPS_JOB_ID must identify the approved production command-bus job" >&2
  exit 2
fi
if [[ ! "${IKIMON_EXPECTED_GIT_SHA:-}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "IKIMON_EXPECTED_GIT_SHA must be an exact 40-character commit SHA" >&2
  exit 2
fi
if [[ -z "${IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET:-}" ]]; then
  echo "IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET is required" >&2
  exit 2
fi
if [[ ! "${IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET must be a 64-character job-scoped key" >&2
  exit 2
fi
if [[ "${IKIMON_R2_MATERIALIZATION_API_URL:-}" != "https://ikimon-intake-hub-native.yamaki0102.workers.dev/ops-materialization" ]]; then
  echo "IKIMON_R2_MATERIALIZATION_API_URL must be the canonical production materialization gateway" >&2
  exit 2
fi

cd -- "${BASH_SOURCE[0]%/*}/../platform_v2/cloudflare_shadow"
exec ./node_modules/.bin/tsx scripts/materialize-original-ui-html.mjs --execute --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY --target-env production --scope core --skip-if-unchanged --concurrency 8 --phase-result
