#!/usr/bin/env bash
# ikimon.production-phase/v1:preflight
set +x
set -euo pipefail

reject_secret_environment() {
  local name
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
      echo "production_preflight_secret_environment_forbidden:${name}" >&2
      exit 2
    fi
  done
}

reject_secret_environment

if [[ "${IKIMON_PRODUCTION_PHASE_V1:-}" != "ikimon.production-phase/v1:preflight" ]]; then
  echo "IKIMON_PRODUCTION_PHASE_V1 must be ikimon.production-phase/v1:preflight" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_DIR="${REPO_ROOT}/platform_v2"
WORKER_DIR="${PLATFORM_DIR}/cloudflare_shadow"
REPORT_DIR="${WORKER_DIR}/.deploy"
PHASE_REPORT="${REPORT_DIR}/production-phase-preflight.json"
TEST_PROFILE="${TEST_PROFILE:-quick}"

case "${TEST_PROFILE}" in
  quick|full|heavy) ;;
  *) echo "TEST_PROFILE must be quick, full, or heavy" >&2; exit 2 ;;
esac

mkdir -p "${REPORT_DIR}"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
if [[ ! "${GIT_SHA}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "production_preflight_checkout_sha_invalid" >&2
  exit 2
fi
if [[ ! "${IKIMON_EXPECTED_GIT_SHA:-}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "IKIMON_EXPECTED_GIT_SHA must be an exact 40-character commit SHA" >&2
  exit 2
fi
if [[ "${IKIMON_EXPECTED_GIT_SHA}" != "${GIT_SHA}" ]]; then
  echo "production_preflight_checkout_sha_mismatch" >&2
  exit 2
fi

echo "== Install and build current app (secretless preflight) =="
npm --prefix "${PLATFORM_DIR}" ci --ignore-scripts --prefer-offline
npm --prefix "${PLATFORM_DIR}" run build

echo "== Install and check Cloudflare production Worker (no mutation) =="
npm --prefix "${WORKER_DIR}" ci --ignore-scripts --prefer-offline
case "${TEST_PROFILE}" in
  quick) npm --prefix "${WORKER_DIR}" run deploy:production:quick-preflight ;;
  full) npm --prefix "${WORKER_DIR}" run deploy:production:preflight ;;
  heavy) npm --prefix "${WORKER_DIR}" run deploy:production:dry-run -- --test-profile heavy --write-preflight-report .deploy/production-preflight-latest.json ;;
esac

echo "== Materializer dry-run (no R2 write) =="
(
  cd "${WORKER_DIR}"
  ./node_modules/.bin/tsx scripts/materialize-original-ui-html.mjs --skip-if-unchanged --concurrency 8
)

node --input-type=module - "${PHASE_REPORT}" "${GIT_SHA}" "${TEST_PROFILE}" <<'NODE'
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const [path, sourceSha, testProfile] = process.argv.slice(2);
const receipt = {
  schema: "ikimon.production-preflight-receipt/v1",
  source_sha: sourceSha,
  guard_version: "production-phase-v1",
  checks: ["app_install_build", "worker_check_test", "wrangler_dry_run", "materializer_dry_run"],
  mutation_executed: false,
  production_d1_migrations: false,
};
const canonical = JSON.stringify(receipt);
const digest = createHash("sha256").update(canonical).digest("hex");
const result = {
  schema: "ikimon.production-phase-result/v1",
  phase: "preflight",
  status: "succeeded",
  source_sha: sourceSha,
  guard_version: receipt.guard_version,
  test_profile: testProfile,
  preflight_receipt_sha256: digest,
  receipt,
};
writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
