#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST="${REPO_ROOT}/ops/deploy/deploy_manifest.json"
PREFLIGHT="${REPO_ROOT}/scripts/run_cloudflare_production_preflight.sh"
MATERIALIZE="${REPO_ROOT}/scripts/run_cloudflare_production_materialization.sh"
DEPLOY="${REPO_ROOT}/scripts/run_cloudflare_production_worker_deploy.sh"
COMBINED="${REPO_ROOT}/scripts/run_cloudflare_production_release.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local literal="$2"
  grep -Fq -- "${literal}" "${file}" || fail "${file} must contain: ${literal}"
}

assert_not_contains() {
  local file="$1"
  local literal="$2"
  if grep -Fq -- "${literal}" "${file}"; then
    fail "${file} must not contain: ${literal}"
  fi
}

for file in "${PREFLIGHT}" "${MATERIALIZE}" "${DEPLOY}" "${COMBINED}"; do
  [[ -f "${file}" ]] || fail "missing phase entrypoint: ${file}"
  bash -n "${file}"
done

assert_contains "${PREFLIGHT}" "ikimon.production-phase/v1:preflight"
assert_contains "${MATERIALIZE}" "ikimon.production-phase/v1:materialize"
assert_contains "${DEPLOY}" "ikimon.production-phase/v1:deploy"
assert_contains "${MATERIALIZE}" 'exec ./node_modules/.bin/tsx scripts/materialize-original-ui-html.mjs --execute'
assert_contains "${DEPLOY}" 'exec ./node_modules/.bin/wrangler deploy --env production'

for forbidden in "npm " "npx " "git " " test " "wrangler d1" "migrations apply"; do
  assert_not_contains "${DEPLOY}" "${forbidden}"
done
for forbidden in "npm " "npx " "git " " test " "wrangler d1" "migrations apply"; do
  assert_not_contains "${MATERIALIZE}" "${forbidden}"
done

wrangler_count="$(grep -Fc './node_modules/.bin/wrangler' "${DEPLOY}")"
[[ "${wrangler_count}" == "1" ]] || fail "deploy phase must reference direct local Wrangler exactly once"
tsx_count="$(grep -Fc './node_modules/.bin/tsx' "${MATERIALIZE}")"
[[ "${tsx_count}" == "1" ]] || fail "materialize phase must reference direct local tsx exactly once"

node --input-type=module - "${MANIFEST}" <<'NODE'
import fs from "node:fs";
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const contract = manifest.productionPhaseInterface;
if (contract?.schema !== "ikimon_production_phase_interface/v1") throw new Error("phase_contract_schema");
if (contract?.freshSandboxRequired !== true) throw new Error("fresh_sandbox_required");
if (contract?.productionD1Migrations !== false) throw new Error("production_d1_migrations_must_be_false");
if (contract?.secretInjectionAfterPreparationRequired !== true) throw new Error("secret_injection_after_preparation_required");
if (contract?.processTableEmptyBeforeSecretInjectionRequired !== true) throw new Error("process_table_must_be_empty_before_secret_injection");
if (contract?.secretFreeAncestorRequired !== true) throw new Error("secret_free_ancestor_required");
if (contract?.initialEnvironmentSecretAllowlistEnforced !== true) throw new Error("initial_secret_allowlist_required");
const expected = {
  preflight: ["scripts/run_cloudflare_production_preflight.sh", [], []],
  materialize: ["scripts/run_cloudflare_production_materialization.sh", ["IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET"], ["IKIMON_R2_MATERIALIZATION_API_URL"]],
  deploy: ["scripts/run_cloudflare_production_worker_deploy.sh", ["CLOUDFLARE_API_TOKEN"], [
    "CLOUDFLARE_ACCOUNT_ID", "DEPLOY_PRODUCTION", "IKIMON_GIT_SHA", "IKIMON_UI_BUNDLE_HASH",
    "IKIMON_UI_MANIFEST_HASH", "IKIMON_WORKER_VERSION", "IKIMON_DEPLOYED_AT",
    "IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL", "IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256",
    "IKIMON_PRODUCTION_D1_MIGRATIONS", "IKIMON_PRODUCTION_SECRET_SYNC",
  ]],
  verify: ["executor:fixed-http-exact-sha", [], []],
};
const commonNonSecret = [
  "PATH", "HOME", "CI", "IKIMON_AUTOMATION_JOB_FILE", "IKIMON_TERMINAL_EVENT_FILE",
  "IKIMON_PRODUCTION_PHASE_V1", "IKIMON_PRODUCTION_SOURCE_DIR", "IKIMON_EXPECTED_GIT_SHA", "IKIMON_OPS_JOB_ID",
];
for (const [phase, [entrypoint, allowlist, phaseNonSecret]] of Object.entries(expected)) {
  const actual = contract.phases?.[phase];
  if (actual?.entrypoint !== entrypoint) throw new Error(`entrypoint:${phase}`);
  if (JSON.stringify(actual?.secretAllowlist) !== JSON.stringify(allowlist)) throw new Error(`secret_allowlist:${phase}`);
  const expectedNonSecret = [...commonNonSecret, ...phaseNonSecret];
  if (JSON.stringify(actual?.nonSecretInputAllowlist) !== JSON.stringify(expectedNonSecret)) throw new Error(`nonsecret_allowlist:${phase}`);
}
const overlap = Object.values(contract.phases).flatMap((phase) => phase.secretAllowlist);
if (new Set(overlap).size !== overlap.length) throw new Error("phase_secret_overlap");
NODE

assert_contains "${PREFLIGHT}" 'IKIMON_EXPECTED_GIT_SHA must be an exact 40-character commit SHA'
assert_contains "${PREFLIGHT}" '[[ "${IKIMON_EXPECTED_GIT_SHA}" != "${GIT_SHA}" ]]'

for phase_script in "${MATERIALIZE}" "${DEPLOY}"; do
  if grep -Fq '$(' "${phase_script}" || grep -Fq '`' "${phase_script}" || grep -Fq '|' "${phase_script}"; then
    fail "secret-bearing phase must not spawn a target-controlled pre-exec child or pipeline: ${phase_script}"
  fi
  exec_count="$(grep -Ec '^exec \./node_modules/\.bin/(tsx|wrangler) ' "${phase_script}")"
  [[ "${exec_count}" == "1" ]] || fail "secret-bearing phase must replace its shell with exactly one fixed runtime"
done

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
mkdir -p "${tmp}/repo/scripts" "${tmp}/repo/platform_v2/cloudflare_shadow/node_modules/.bin"
cp "${MATERIALIZE}" "${DEPLOY}" "${tmp}/repo/scripts/"

cat > "${tmp}/repo/platform_v2/cloudflare_shadow/node_modules/.bin/tsx" <<'FAKE_TSX'
#!/usr/bin/env bash
printf '%s\n' "tsx:$*"
FAKE_TSX
cat > "${tmp}/repo/platform_v2/cloudflare_shadow/node_modules/.bin/wrangler" <<'FAKE_WRANGLER'
#!/usr/bin/env bash
printf '%s\n' "wrangler:$*"
FAKE_WRANGLER
chmod +x "${tmp}/repo/platform_v2/cloudflare_shadow/node_modules/.bin/tsx" "${tmp}/repo/platform_v2/cloudflare_shadow/node_modules/.bin/wrangler"

base_path="${PATH}"
materialize_output="$(
  cd "${tmp}/repo"
  env -i PATH="${base_path}" \
    IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:materialize" \
    IKIMON_OPS_JOB_ID="ops-0123456789abcdef" \
    IKIMON_EXPECTED_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" \
    IKIMON_R2_MATERIALIZATION_API_URL="https://ikimon-intake-hub-native.yamaki0102.workers.dev/ops-materialization" \
    bash scripts/run_cloudflare_production_materialization.sh
)"
[[ "${materialize_output}" == *"tsx:scripts/materialize-original-ui-html.mjs --execute"* ]] || fail "materialize phase did not exec direct tsx"

if (
  cd "${tmp}/repo"
  env -i PATH="${base_path}" \
    CLOUDFLARE_API_TOKEN="must-not-overlap" \
    IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:materialize" \
    IKIMON_OPS_JOB_ID="ops-0123456789abcdef" \
    IKIMON_EXPECTED_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" \
    IKIMON_R2_MATERIALIZATION_API_URL="https://ikimon-intake-hub-native.yamaki0102.workers.dev/ops-materialization" \
    bash scripts/run_cloudflare_production_materialization.sh >/dev/null 2>&1
); then
  fail "materialize phase accepted a Cloudflare token in its initial environment"
fi

deploy_output="$(
  cd "${tmp}/repo"
  env -i PATH="${base_path}" \
    IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:deploy" \
    CLOUDFLARE_API_TOKEN="release-token" \
    CLOUDFLARE_ACCOUNT_ID="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" \
    IKIMON_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_EXPECTED_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_UI_BUNDLE_HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    IKIMON_UI_MANIFEST_HASH="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
    IKIMON_WORKER_VERSION="ops-0123456789ab" \
    IKIMON_DEPLOYED_AT="2026-07-16T00:00:00.000Z" \
    IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL="APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY" \
    IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" \
    IKIMON_PRODUCTION_D1_MIGRATIONS="false" \
    IKIMON_PRODUCTION_SECRET_SYNC="false" \
    bash scripts/run_cloudflare_production_worker_deploy.sh
)"
[[ "${deploy_output}" == *"wrangler:deploy --env production"* ]] || fail "deploy phase did not exec direct Wrangler"
[[ "${deploy_output}" != *"release-token"* ]] || fail "deploy output exposed Cloudflare token"

if (
  cd "${tmp}/repo"
  env -i PATH="${base_path}" \
    IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:deploy" \
    CLOUDFLARE_API_TOKEN="release-token" \
    CLOUDFLARE_ACCOUNT_ID="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" \
    IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" \
    IKIMON_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_EXPECTED_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_UI_BUNDLE_HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    IKIMON_UI_MANIFEST_HASH="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
    IKIMON_WORKER_VERSION="ops-0123456789ab" \
    IKIMON_DEPLOYED_AT="2026-07-16T00:00:00Z" \
    IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL="APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY" \
    IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" \
    IKIMON_PRODUCTION_D1_MIGRATIONS="false" \
    IKIMON_PRODUCTION_SECRET_SYNC="false" \
    bash scripts/run_cloudflare_production_worker_deploy.sh >/dev/null 2>&1
); then
  fail "deploy phase accepted a materialization secret in its initial environment"
fi

if (
  cd "${tmp}/repo"
  env -i PATH="${base_path}" \
    IKIMON_PRODUCTION_PHASE_V1="ikimon.production-phase/v1:deploy" \
    CLOUDFLARE_API_TOKEN="release-token" \
    CLOUDFLARE_ACCOUNT_ID="INVALID" \
    IKIMON_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_EXPECTED_GIT_SHA="0123456789abcdef0123456789abcdef01234567" \
    IKIMON_UI_BUNDLE_HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    IKIMON_UI_MANIFEST_HASH="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
    IKIMON_WORKER_VERSION="ops-0123456789ab" \
    IKIMON_DEPLOYED_AT="2026-07-16T00:00:00.000Z" \
    IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL="APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY" \
    IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" \
    IKIMON_PRODUCTION_D1_MIGRATIONS="false" \
    IKIMON_PRODUCTION_SECRET_SYNC="false" \
    bash scripts/run_cloudflare_production_worker_deploy.sh >/dev/null 2>&1
); then
  fail "deploy phase accepted an invalid Cloudflare account id"
fi

if env DEPLOY_PRODUCTION=true bash "${COMBINED}" >/dev/null 2>&1; then
  fail "combined production release accepted execute mode"
fi
if env CLOUDFLARE_API_TOKEN="must-reject" bash "${COMBINED}" >/dev/null 2>&1; then
  fail "combined production release accepted a production secret"
fi

echo "Production phase interface tests passed."
