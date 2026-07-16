#!/usr/bin/env bash
# ikimon.production-phase/v1:deploy
set +x
set -euo pipefail

reject_secret_overlap() {
  local name
  for name in \
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
      echo "production_deploy_secret_overlap_forbidden:${name}" >&2
      exit 2
    fi
  done
}

reject_secret_overlap

if [[ "${IKIMON_PRODUCTION_PHASE_V1:-}" != "ikimon.production-phase/v1:deploy" ]]; then
  echo "IKIMON_PRODUCTION_PHASE_V1 must be ikimon.production-phase/v1:deploy" >&2
  exit 2
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 2
fi
if [[ ! "${CLOUDFLARE_ACCOUNT_ID:-}" =~ ^[a-f0-9]{32}$ ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID must be an exact lowercase 32-character account id" >&2
  exit 2
fi
if [[ "${IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL:-}" != "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY" ]]; then
  echo "production_deploy_approval_required" >&2
  exit 2
fi
if [[ ! "${IKIMON_GIT_SHA:-}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "IKIMON_GIT_SHA must be an exact 40-character commit SHA" >&2
  exit 2
fi
if [[ "${IKIMON_EXPECTED_GIT_SHA:-}" != "${IKIMON_GIT_SHA}" ]]; then
  echo "IKIMON_EXPECTED_GIT_SHA must equal IKIMON_GIT_SHA" >&2
  exit 2
fi
if [[ ! "${IKIMON_UI_BUNDLE_HASH:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "IKIMON_UI_BUNDLE_HASH must be a SHA-256 digest" >&2
  exit 2
fi
if [[ ! "${IKIMON_UI_MANIFEST_HASH:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "IKIMON_UI_MANIFEST_HASH must be a SHA-256 digest" >&2
  exit 2
fi
if [[ ! "${IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256 must be a verified SHA-256 digest" >&2
  exit 2
fi
if [[ ! "${IKIMON_WORKER_VERSION:-}" =~ ^[A-Za-z0-9._-]{1,128}$ ]]; then
  echo "IKIMON_WORKER_VERSION is invalid" >&2
  exit 2
fi
if [[ ! "${IKIMON_DEPLOYED_AT:-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$ ]]; then
  echo "IKIMON_DEPLOYED_AT must be an exact UTC timestamp" >&2
  exit 2
fi
if [[ "${IKIMON_PRODUCTION_D1_MIGRATIONS:-}" != "false" ]]; then
  echo "IKIMON_PRODUCTION_D1_MIGRATIONS must be false" >&2
  exit 2
fi
if [[ "${IKIMON_PRODUCTION_SECRET_SYNC:-}" != "false" ]]; then
  echo "IKIMON_PRODUCTION_SECRET_SYNC must be false" >&2
  exit 2
fi

cd -- "${BASH_SOURCE[0]%/*}/../platform_v2/cloudflare_shadow"
exec ./node_modules/.bin/wrangler deploy --env production \
  --var "IKIMON_GIT_SHA:${IKIMON_GIT_SHA}" \
  --var "IKIMON_WORKER_VERSION:${IKIMON_WORKER_VERSION}" \
  --var "IKIMON_UI_BUNDLE_HASH:${IKIMON_UI_BUNDLE_HASH}" \
  --var "IKIMON_UI_MANIFEST_HASH:${IKIMON_UI_MANIFEST_HASH}" \
  --var "IKIMON_DEPLOYED_AT:${IKIMON_DEPLOYED_AT}"
