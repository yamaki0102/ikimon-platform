#!/usr/bin/env bash
# ikimon.production-phase/v1:promote
set +x
set -euo pipefail

WORKER_NAME="ikimon-life-cloudflare-prod"
WORKER_ORIGIN="https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKER_DIR="${REPO_ROOT}/platform_v2/cloudflare_shadow"
REPORT_DIR="${WORKER_DIR}/.deploy"
BEFORE_FILE="${REPORT_DIR}/production-promote-before.json"
CANDIDATE_FILE="${REPORT_DIR}/production-promote-candidate.json"
RESULT_FILE="${REPORT_DIR}/production-phase-promote.json"

for name in IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET OPS_PRODUCTION_MATERIALIZATION_HMAC_SECRET IKIMON_AUTOMATION_PUSH_SECRET AUTOMATION_CALLBACK_SECRET GITHUB_TOKEN GH_TOKEN GEMINI_API_KEY VPS_SSH_KEY SSH_PRIVATE_KEY; do
  if [[ -n "${!name:-}" ]]; then
    echo "production_promote_secret_overlap_forbidden:${name}" >&2
    exit 2
  fi
done

if [[ "${IKIMON_PRODUCTION_PHASE_V1:-}" != "ikimon.production-phase/v1:promote" ]]; then
  echo "IKIMON_PRODUCTION_PHASE_V1 must be ikimon.production-phase/v1:promote" >&2
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
if [[ ! "${IKIMON_EXPECTED_GIT_SHA:-}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "IKIMON_EXPECTED_GIT_SHA must be an exact 40-character commit SHA" >&2
  exit 2
fi
if [[ ! "${IKIMON_PRODUCTION_CANDIDATE_VERSION_ID:-}" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "IKIMON_PRODUCTION_CANDIDATE_VERSION_ID must be a Worker Version UUID" >&2
  exit 2
fi
if [[ "${IKIMON_PRODUCTION_D1_MIGRATIONS:-}" != "false" ]] || [[ "${IKIMON_PRODUCTION_SECRET_SYNC:-}" != "false" ]]; then
  echo "production_promote_non_worker_mutation_forbidden" >&2
  exit 2
fi

mkdir -p "${REPORT_DIR}"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
if [[ "${GIT_SHA}" != "${IKIMON_EXPECTED_GIT_SHA}" ]]; then
  echo "production_promote_checkout_sha_mismatch" >&2
  exit 2
fi
git -C "${REPO_ROOT}" diff --quiet --exit-code || { echo "production_promote_dirty_worktree" >&2; exit 2; }
git -C "${REPO_ROOT}" diff --cached --quiet --exit-code || { echo "production_promote_dirty_index" >&2; exit 2; }

cd -- "${WORKER_DIR}"
./node_modules/.bin/wrangler deployments list --name "${WORKER_NAME}" --json > "${BEFORE_FILE}"
ROLLBACK_VERSION_ID="$(node --input-type=module - "${BEFORE_FILE}" <<'NODE'
import { readFileSync } from "node:fs";
const value = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rows = Array.isArray(value) ? value : value?.deployments ?? value?.result?.deployments ?? [];
const deployment = rows[0];
const versions = deployment?.versions;
if (!Array.isArray(versions) || versions.length !== 1) throw new Error("production_baseline_topology_not_single_version");
const version = versions[0];
const percentage = Number(version?.percentage ?? version?.percent);
const id = version?.version_id ?? version?.versionId ?? version?.id;
if (percentage !== 100 || typeof id !== "string" || !/^[0-9a-f-]{36}$/iu.test(id)) throw new Error("production_baseline_topology_invalid");
process.stdout.write(id);
NODE
)"

if [[ "${ROLLBACK_VERSION_ID}" == "${IKIMON_PRODUCTION_CANDIDATE_VERSION_ID}" ]]; then
  echo "production_candidate_already_active" >&2
  exit 2
fi

./node_modules/.bin/wrangler versions view "${IKIMON_PRODUCTION_CANDIDATE_VERSION_ID}" --name "${WORKER_NAME}" --json > "${CANDIDATE_FILE}"
node --input-type=module - "${CANDIDATE_FILE}" "${IKIMON_EXPECTED_GIT_SHA}" <<'NODE'
import { readFileSync } from "node:fs";
const value = JSON.parse(readFileSync(process.argv[2], "utf8"));
const expected = process.argv[3];
const version = value?.result ?? value;
const bindings = version?.resources?.bindings ?? version?.bindings ?? [];
if (!Array.isArray(bindings)) throw new Error("production_candidate_bindings_invalid");
const source = bindings.find((binding) => binding?.name === "IKIMON_GIT_SHA" && binding?.type === "plain_text")?.text;
if (source !== expected) throw new Error("production_candidate_source_mismatch");
NODE

rollback() {
  set +e
  ./node_modules/.bin/wrangler versions deploy "${ROLLBACK_VERSION_ID}" --name "${WORKER_NAME}" --yes >/dev/null 2>&1
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "BLOCKED_ROLLBACK_FAILED" >&2
    exit 3
  fi
  for _ in $(seq 1 12); do
    ./node_modules/.bin/wrangler deployments list --name "${WORKER_NAME}" --json > "${BEFORE_FILE}.rollback"
    local active
    active="$(node --input-type=module - "${BEFORE_FILE}.rollback" <<'NODE'
import { readFileSync } from "node:fs";
const value = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rows = Array.isArray(value) ? value : value?.deployments ?? value?.result?.deployments ?? [];
const versions = rows[0]?.versions ?? [];
const active = versions.length === 1 && Number(versions[0]?.percentage ?? versions[0]?.percent) === 100
  ? versions[0]?.version_id ?? versions[0]?.versionId ?? versions[0]?.id
  : "";
process.stdout.write(typeof active === "string" ? active : "");
NODE
)"
    if [[ "${active}" == "${ROLLBACK_VERSION_ID}" ]]; then
      echo "automatic_rollback_verified:${ROLLBACK_VERSION_ID}" >&2
      exit 1
    fi
    sleep 5
  done
  echo "BLOCKED_ROLLBACK_FAILED" >&2
  exit 3
}

./node_modules/.bin/wrangler versions deploy "${IKIMON_PRODUCTION_CANDIDATE_VERSION_ID}" --name "${WORKER_NAME}" --yes

VERIFIED="false"
for attempt in $(seq 1 12); do
  payload="$(curl -fsS --max-time 10 -H 'accept: application/json' -H 'cache-control: no-store' "${WORKER_ORIGIN}/api/v1/runtime/version?deploy_smoke=${IKIMON_EXPECTED_GIT_SHA:0:12}-${attempt}" 2>/dev/null || true)"
  if node --input-type=module - "${payload}" "${IKIMON_EXPECTED_GIT_SHA}" <<'NODE'
const [payload, expected] = process.argv.slice(2);
let value;
try { value = JSON.parse(payload); } catch { process.exit(1); }
const ok = value?.ok === true
  && value?.service === "ikimon.life"
  && value?.environment === "production"
  && value?.runtime === "cloudflare-worker"
  && value?.gitSha === expected;
process.exit(ok ? 0 : 1);
NODE
  then
    VERIFIED="true"
    break
  fi
  sleep 5
done

if [[ "${VERIFIED}" != "true" ]]; then
  echo "production_runtime_readback_failed; starting automatic rollback" >&2
  rollback
fi

node --input-type=module - "${RESULT_FILE}" "${IKIMON_EXPECTED_GIT_SHA}" "${IKIMON_PRODUCTION_CANDIDATE_VERSION_ID}" "${ROLLBACK_VERSION_ID}" "${WORKER_NAME}" <<'NODE'
import { writeFileSync } from "node:fs";
const [path, sourceSha, activeVersionId, rollbackVersionId, workerName] = process.argv.slice(2);
const result = {
  schema: "ikimon.production-phase-result/v1",
  phase: "promote",
  status: "succeeded",
  source_sha: sourceSha,
  worker_name: workerName,
  active_version_id: activeVersionId,
  rollback_version_id: rollbackVersionId,
  runtime_readback: "PASS",
  automatic_rollback: false,
  database_mutation: false,
  secret_mutation: false,
  dns_mutation: false,
};
writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
