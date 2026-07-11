#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_DIR="${REPO_ROOT}/platform_v2"
WORKER_DIR="${PLATFORM_DIR}/cloudflare_shadow"
REPORT_DIR="${WORKER_DIR}/.deploy"
SUMMARY_PATH="${REPORT_DIR}/production-release-summary.json"

DEPLOY_PRODUCTION="${DEPLOY_PRODUCTION:-false}"
TEST_PROFILE="${TEST_PROFILE:-quick}"
SMOKE_TIER="${SMOKE_TIER:-full}"
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS:-false}"
IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL="${IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL:-APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY}"

case "${DEPLOY_PRODUCTION}" in true|false) ;; *) echo "DEPLOY_PRODUCTION must be true or false" >&2; exit 2 ;; esac
case "${TEST_PROFILE}" in quick|full|heavy) ;; *) echo "TEST_PROFILE must be quick, full, or heavy" >&2; exit 2 ;; esac
case "${SMOKE_TIER}" in full|targeted) ;; *) echo "SMOKE_TIER must be full or targeted" >&2; exit 2 ;; esac
case "${PLAYWRIGHT_INSTALL_WITH_DEPS}" in true|false) ;; *) echo "PLAYWRIGHT_INSTALL_WITH_DEPS must be true or false" >&2; exit 2 ;; esac

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required for production preflight and deploy." >&2
  exit 2
fi

mkdir -p "${REPORT_DIR}"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
EXPECTED_SHA="${IKIMON_EXPECTED_GIT_SHA:-${GITHUB_SHA:-${GIT_SHA}}}"
if [[ "${EXPECTED_SHA}" != "${GIT_SHA}" ]]; then
  echo "Production release SHA mismatch: expected=${EXPECTED_SHA} checkout=${GIT_SHA}" >&2
  exit 2
fi

write_summary() {
  local status="$1"
  local finished_at
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node --input-type=module - "${SUMMARY_PATH}" "${status}" "${STARTED_AT}" "${finished_at}" "${GIT_SHA}" "${DEPLOY_PRODUCTION}" "${TEST_PROFILE}" "${SMOKE_TIER}" <<'NODE'
import fs from 'node:fs';
const [file, status, startedAt, finishedAt, gitSha, deployed, testProfile, smokeTier] = process.argv.slice(2);
fs.writeFileSync(file, `${JSON.stringify({
  schemaVersion: 'ikimon_cloudflare_production_release/v1',
  status,
  startedAt,
  finishedAt,
  gitSha,
  productionDeployExecuted: deployed === 'true',
  testProfile,
  smokeTier,
  worker: 'ikimon-life-cloudflare-prod',
  r2Bucket: 'ikimon-prod-media',
  vpsSshDeploy: false,
}, null, 2)}\n`);
NODE
}

on_exit() {
  local status=$?
  trap - EXIT
  if [[ ${status} -ne 0 ]]; then
    write_summary failed || true
  fi
  exit "${status}"
}
trap on_exit EXIT

echo "== Install and build current app =="
npm --prefix "${PLATFORM_DIR}" ci --prefer-offline
npm --prefix "${PLATFORM_DIR}" run build

echo "== Install and preflight Cloudflare production Worker =="
npm --prefix "${WORKER_DIR}" ci --prefer-offline
case "${TEST_PROFILE}" in
  quick) npm --prefix "${WORKER_DIR}" run deploy:production:quick-preflight ;;
  full) npm --prefix "${WORKER_DIR}" run deploy:production:preflight ;;
  heavy) npm --prefix "${WORKER_DIR}" run deploy:production:dry-run -- --test-profile heavy --write-preflight-report .deploy/production-preflight-latest.json ;;
esac
npm --prefix "${WORKER_DIR}" run materialize:original-ui:dry-run

if [[ "${DEPLOY_PRODUCTION}" != "true" ]]; then
  write_summary preflight_only
  trap - EXIT
  echo "Cloudflare production preflight completed without mutation."
  exit 0
fi

echo "== Apply idempotent production D1 migrations =="
(
  cd "${WORKER_DIR}"
  npx wrangler d1 migrations apply CORE_DB --remote --env production
  npx wrangler d1 migrations apply OBS_DB --remote --env production
)

echo "== Materialize original UI into production R2 =="
npm --prefix "${WORKER_DIR}" run materialize:original-ui -- --skip-if-unchanged --output materialize-original-ui.json
IFS=$'\t' read -r IKIMON_UI_BUNDLE_HASH IKIMON_UI_MANIFEST_HASH < <(
  node --input-type=module - "${WORKER_DIR}/materialize-original-ui.json" <<'NODE'
import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!report.bundleHash || !report.manifestUpload?.sha256) {
  throw new Error('Materialized UI release identity is incomplete.');
}
process.stdout.write(`${report.bundleHash}\t${report.manifestUpload.sha256}\n`);
NODE
)
export IKIMON_UI_BUNDLE_HASH IKIMON_UI_MANIFEST_HASH
export IKIMON_GIT_SHA="${GIT_SHA}"
export IKIMON_WORKER_VERSION="${IKIMON_WORKER_VERSION:-portable-${GIT_SHA:0:12}-$(date -u +%Y%m%d%H%M%S)}"
export IKIMON_DEPLOYED_AT="${IKIMON_DEPLOYED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
export IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL

echo "== Deploy production Worker through guarded fast lane =="
npm --prefix "${WORKER_DIR}" run deploy:production:fast

echo "== Verify production release =="
IKIMON_EXPECTED_GIT_SHA="${GIT_SHA}" \
SMOKE_TIER="${SMOKE_TIER}" \
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS}" \
  "${SCRIPT_DIR}/verify_cloudflare_production_release.sh"

write_summary success
trap - EXIT
echo "Cloudflare production release completed for ${GIT_SHA}."
