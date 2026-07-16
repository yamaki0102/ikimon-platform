#!/usr/bin/env bash
# Compatibility entrypoint. Production mutation must use the three fixed phase scripts.
# ikimon.production-phase/v1:preflight
set +x
set -euo pipefail

for name in \
  CLOUDFLARE_API_TOKEN \
  IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET \
  OPS_PRODUCTION_MATERIALIZATION_HMAC_SECRET \
  IKIMON_AUTOMATION_PUSH_SECRET \
  AUTOMATION_CALLBACK_SECRET \
  GITHUB_TOKEN \
  GH_TOKEN \
  GEMINI_API_KEY \
  VPS_SSH_KEY \
  SSH_PRIVATE_KEY; do
  if [[ -n "${!name:-}" ]]; then
    echo "combined_production_release_secret_forbidden:${name}" >&2
    exit 2
  fi
done

if [[ "${DEPLOY_PRODUCTION:-false}" != "false" ]]; then
  echo "combined_production_release_execute_forbidden:use_fixed_fresh_sandbox_phases" >&2
  exit 2
fi

export IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:preflight"
exec bash "${BASH_SOURCE[0]%/*}/run_cloudflare_production_preflight.sh"
