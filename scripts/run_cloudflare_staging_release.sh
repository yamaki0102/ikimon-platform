#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_DIR="${REPO_ROOT}/platform_v2"
WORKER_DIR="${PLATFORM_DIR}/cloudflare_shadow"

DEPLOY_STAGING="${DEPLOY_STAGING:-false}"
TEST_PROFILE="${TEST_PROFILE:-quick}"
BROWSER_QA="${BROWSER_QA:-none}"
SYNC_STAGING_WRITE_SECRET="${SYNC_STAGING_WRITE_SECRET:-false}"
APPLY_STAGING_MIGRATIONS="${APPLY_STAGING_MIGRATIONS:-false}"
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS:-true}"
IKIMON_CF_STAGING_DEPLOY_APPROVAL="${IKIMON_CF_STAGING_DEPLOY_APPROVAL:-APPROVE_IKIMON_CF_STAGING_WORKER_DEPLOY}"
STAGING_BASE_URL="${STAGING_BASE_URL:-https://staging.ikimon.life}"
REPORT_DIR="${WORKER_DIR}/.deploy"
SUMMARY_PATH="${REPORT_DIR}/staging-release-summary.json"

case "${DEPLOY_STAGING}" in true|false) ;; *) echo "DEPLOY_STAGING must be true or false" >&2; exit 2 ;; esac
case "${TEST_PROFILE}" in quick|full) ;; *) echo "TEST_PROFILE must be quick or full" >&2; exit 2 ;; esac
case "${BROWSER_QA}" in none|targeted|full) ;; *) echo "BROWSER_QA must be none, targeted, or full" >&2; exit 2 ;; esac
case "${SYNC_STAGING_WRITE_SECRET}" in true|false) ;; *) echo "SYNC_STAGING_WRITE_SECRET must be true or false" >&2; exit 2 ;; esac
case "${APPLY_STAGING_MIGRATIONS}" in true|false) ;; *) echo "APPLY_STAGING_MIGRATIONS must be true or false" >&2; exit 2 ;; esac
case "${PLAYWRIGHT_INSTALL_WITH_DEPS}" in true|false) ;; *) echo "PLAYWRIGHT_INSTALL_WITH_DEPS must be true or false" >&2; exit 2 ;; esac

if [[ "${BROWSER_QA}" != "none" && -z "${V2_PRIVILEGED_WRITE_API_KEY:-}" ]]; then
  echo "V2_PRIVILEGED_WRITE_API_KEY is required when BROWSER_QA is targeted or full." >&2
  exit 2
fi

mkdir -p "${REPORT_DIR}"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"

run_npm_ci() {
  local directory="$1"
  npm --prefix "${directory}" ci --prefer-offline
}

prove_cloudflare_provider_auth() {
  local wrangler="${WORKER_DIR}/node_modules/.bin/wrangler"
  if [[ ! -x "${wrangler}" ]]; then
    echo "Cloudflare provider auth preflight unavailable: pinned Wrangler is missing." >&2
    exit 2
  fi
  if ! (cd "${WORKER_DIR}" && CI=1 "${wrangler}" whoami --json --env staging >/dev/null); then
    echo "Cloudflare provider auth unavailable. Use an existing Wrangler OAuth session or a valid CLOUDFLARE_API_TOKEN; do not treat token-env absence alone as the blocker." >&2
    exit 2
  fi
}

write_summary() {
  local status="$1"
  local finished_at
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node --input-type=module - "${SUMMARY_PATH}" "${status}" "${STARTED_AT}" "${finished_at}" "${GIT_SHA}" "${DEPLOY_STAGING}" "${TEST_PROFILE}" "${BROWSER_QA}" "${SYNC_STAGING_WRITE_SECRET}" "${APPLY_STAGING_MIGRATIONS}" <<'NODE'
import fs from 'node:fs';
const [path, status, startedAt, finishedAt, gitSha, deployStaging, testProfile, browserQa, syncSecret, applyMigrations] = process.argv.slice(2);
fs.writeFileSync(path, `${JSON.stringify({
  schemaVersion: 'ikimon_cloudflare_staging_release/v1',
  status,
  startedAt,
  finishedAt,
  gitSha,
  deployStaging: deployStaging === 'true',
  testProfile,
  browserQa,
  syncStagingWriteSecret: syncSecret === 'true',
  applyStagingMigrations: applyMigrations === 'true',
  productionMutation: false,
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

echo "== Install Cloudflare staging Worker toolchain =="
run_npm_ci "${WORKER_DIR}"

echo "== Prove Cloudflare provider auth (OAuth session or API token) =="
prove_cloudflare_provider_auth

echo "== Install and build current app =="
run_npm_ci "${PLATFORM_DIR}"
npm --prefix "${PLATFORM_DIR}" run build

echo "== Preflight Cloudflare staging Worker =="
npm --prefix "${WORKER_DIR}" run deploy:staging:dry-run -- \
  --test-profile "${TEST_PROFILE}" \
  --write-preflight-report .deploy/staging-preflight-latest.json

if [[ "${DEPLOY_STAGING}" != "true" ]]; then
  write_summary preflight_only
  trap - EXIT
  echo "Cloudflare staging preflight completed without deployment."
  exit 0
fi

if [[ "${SYNC_STAGING_WRITE_SECRET}" == "true" ]]; then
  if [[ -z "${V2_PRIVILEGED_WRITE_API_KEY:-}" ]]; then
    echo "V2_PRIVILEGED_WRITE_API_KEY is required when SYNC_STAGING_WRITE_SECRET=true." >&2
    exit 2
  fi
  echo "== Sync staging write secret =="
  printf '%s' "${V2_PRIVILEGED_WRITE_API_KEY}" | (
    cd "${WORKER_DIR}"
    npx wrangler secret put V2_PRIVILEGED_WRITE_API_KEY --env staging
  )
else
  echo "== Skip secret mutation (existing staging secret is reused) =="
fi

if [[ "${APPLY_STAGING_MIGRATIONS}" == "true" ]]; then
  echo "Staging D1 migration is a separate approval-bound operation and is not permitted by this release entrypoint." >&2
  exit 2
fi
echo "== Skip staging D1 migrations (deploy and migration are separate operations) =="

echo "== Deploy staging Worker =="
npm --prefix "${WORKER_DIR}" run deploy:staging -- \
  --test-profile "${TEST_PROFILE}" \
  --approval "${IKIMON_CF_STAGING_DEPLOY_APPROVAL}" \
  --write-preflight-report .deploy/staging-deploy-latest.json

echo "== Materialize original UI into staging R2 =="
npm --prefix "${WORKER_DIR}" run materialize:original-ui -- \
  --target-env staging \
  --scope staging-qa \
  --concurrency 8 \
  --approval "${IKIMON_CF_STAGING_DEPLOY_APPROVAL}" \
  --output materialize-staging-original-ui.json

echo "== Verify Cloudflare staging public routes =="
(
  cd "${WORKER_DIR}"
  curl -fsS "${STAGING_BASE_URL}/healthz" | tee staging-healthz.json | grep -q '"environment":"staging"'
  grep -q '"buildMarker":"one-month-sprint-evidence-gate-20260705"' staging-healthz.json
  curl -fsS "${STAGING_BASE_URL}/readyz" | tee staging-readyz.json | grep -q '"environment":"staging"'
  curl -fsS "${STAGING_BASE_URL}/api/v1/runtime/version" | tee staging-runtime-version.json | grep -q '"schemaVersion":"cloudflare_worker_runtime/v1"'
  grep -q '"buildMarker":"one-month-sprint-evidence-gate-20260705"' staging-runtime-version.json
  grep -q '"publicSafe":true' staging-runtime-version.json
  curl -fsS -D staging-root.headers "${STAGING_BASE_URL}/" -o staging-root.html
  grep -q 'data-home-contract="state-split-v1"' staging-root.html
  ! grep -q 'id="map-explorer"' staging-root.html
  grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' staging-root.headers
  curl -fsS -D staging-demo.headers "${STAGING_BASE_URL}/demo/place-feeling-tags" -o staging-demo.html
  grep -q '実データではありません' staging-demo.html
  grep -q 'place_feeling_tags' staging-demo.html
  grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' staging-demo.headers
  curl -fsS -D staging-brand-icon.headers "${STAGING_BASE_URL}/assets/brand/zukan-app-icon-192.png" -o staging-brand-icon.png
  grep -qi '^content-type: image/png' staging-brand-icon.headers
  grep -qi '^x-ikimon-cloudflare-materialized: original-ui-static-asset' staging-brand-icon.headers
)

if [[ "${BROWSER_QA}" != "none" ]]; then
  echo "== Install Playwright Chromium for requested browser QA =="
  if [[ "${PLAYWRIGHT_INSTALL_WITH_DEPS}" == "true" ]]; then
    npm --prefix "${PLATFORM_DIR}" exec -- playwright install --with-deps chromium
  else
    npm --prefix "${PLATFORM_DIR}" exec -- playwright install chromium
  fi

  export STAGING_BASE_URL
  if [[ "${BROWSER_QA}" == "full" ]]; then
    echo "== Run Cloudflare staging QA sitemap smoke =="
    npm --prefix "${PLATFORM_DIR}" run e2e:staging:site-map
  fi

  echo "== Run Cloudflare staging record feedback loop smoke =="
  npm --prefix "${PLATFORM_DIR}" run e2e:staging:record-feedback-loop
fi

write_summary success
trap - EXIT
echo "Cloudflare staging release completed: browser_qa=${BROWSER_QA}."
