#!/usr/bin/env bash
# ikimon.production-phase/v1:candidate
set +x
set -euo pipefail

WORKER_NAME="ikimon-life-cloudflare-prod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKER_DIR="${REPO_ROOT}/platform_v2/cloudflare_shadow"
REPORT_DIR="${WORKER_DIR}/.deploy"

for name in IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET OPS_PRODUCTION_MATERIALIZATION_HMAC_SECRET IKIMON_AUTOMATION_PUSH_SECRET AUTOMATION_CALLBACK_SECRET GITHUB_TOKEN GH_TOKEN GEMINI_API_KEY VPS_SSH_KEY SSH_PRIVATE_KEY; do
  if [[ -n "${!name:-}" ]]; then
    echo "production_candidate_secret_overlap_forbidden:${name}" >&2
    exit 2
  fi
done

if [[ "${IKIMON_PRODUCTION_PHASE_V1:-}" != "ikimon.production-phase/v1:candidate" ]]; then
  echo "IKIMON_PRODUCTION_PHASE_V1 must be ikimon.production-phase/v1:candidate" >&2
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
if [[ ! "${IKIMON_GIT_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || [[ "${IKIMON_EXPECTED_GIT_SHA:-}" != "${IKIMON_GIT_SHA}" ]]; then
  echo "production_candidate_source_sha_invalid" >&2
  exit 2
fi
if [[ ! "${IKIMON_UI_BUNDLE_HASH:-}" =~ ^[a-f0-9]{64}$ ]] || [[ ! "${IKIMON_UI_MANIFEST_HASH:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "production_candidate_artifact_hash_invalid" >&2
  exit 2
fi
if [[ ! "${IKIMON_PRODUCTION_PREFLIGHT_RECEIPT_SHA256:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "production_candidate_preflight_receipt_invalid" >&2
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
if [[ "${IKIMON_PRODUCTION_D1_MIGRATIONS:-}" != "false" ]] || [[ "${IKIMON_PRODUCTION_SECRET_SYNC:-}" != "false" ]]; then
  echo "production_candidate_non_worker_mutation_forbidden" >&2
  exit 2
fi

mkdir -p "${REPORT_DIR}"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
if [[ "${GIT_SHA}" != "${IKIMON_GIT_SHA}" ]]; then
  echo "production_candidate_checkout_sha_mismatch" >&2
  exit 2
fi
git -C "${REPO_ROOT}" diff --quiet --exit-code || { echo "production_candidate_dirty_worktree" >&2; exit 2; }
git -C "${REPO_ROOT}" diff --cached --quiet --exit-code || { echo "production_candidate_dirty_index" >&2; exit 2; }

OUTPUT_FILE="${REPORT_DIR}/production-candidate-wrangler-${IKIMON_GIT_SHA}.ndjson"
RESULT_FILE="${REPORT_DIR}/production-phase-candidate.json"
rm -f "${OUTPUT_FILE}" "${RESULT_FILE}"
TAG="zukan-prod-${IKIMON_GIT_SHA:0:16}"

cd -- "${WORKER_DIR}"
WRANGLER_OUTPUT_FILE_PATH="${OUTPUT_FILE}" ./node_modules/.bin/wrangler versions upload --env production \
  --tag "${TAG}" \
  --message "ZUKAN production candidate ${IKIMON_GIT_SHA}" \
  --var "IKIMON_GIT_SHA:${IKIMON_GIT_SHA}" \
  --var "IKIMON_WORKER_VERSION:${IKIMON_WORKER_VERSION}" \
  --var "IKIMON_UI_BUNDLE_HASH:${IKIMON_UI_BUNDLE_HASH}" \
  --var "IKIMON_UI_MANIFEST_HASH:${IKIMON_UI_MANIFEST_HASH}" \
  --var "IKIMON_DEPLOYED_AT:${IKIMON_DEPLOYED_AT}"

node --input-type=module - "${OUTPUT_FILE}" "${RESULT_FILE}" "${IKIMON_GIT_SHA}" "${TAG}" "${WORKER_NAME}" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const [outputPath, resultPath, sourceSha, tag, workerName] = process.argv.slice(2);
const rows = readFileSync(outputPath, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const ids = rows.map((row) => row?.version_id ?? row?.versionId ?? row?.version?.id).filter((value) => typeof value === "string");
const versionId = ids.at(-1);
if (!versionId || !/^[0-9a-f-]{36}$/iu.test(versionId)) throw new Error("production_candidate_version_id_missing");
const result = {
  schema: "ikimon.production-phase-result/v1",
  phase: "candidate",
  status: "succeeded",
  source_sha: sourceSha,
  worker_name: workerName,
  candidate_version_id: versionId,
  candidate_tag: tag,
  customer_traffic_percent: 0,
  production_traffic_mutation: false,
  database_mutation: false,
  secret_mutation: false,
  dns_mutation: false,
};
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
