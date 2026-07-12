#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKER_DIR="${REPO_ROOT}/platform_v2/cloudflare_shadow"
REPORT_DIR="${WORKER_DIR}/.deploy"

SMOKE_TIER="${SMOKE_TIER:-targeted}"
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS:-false}"
IKIMON_VERIFICATION_SOURCE="${IKIMON_VERIFICATION_SOURCE:-external-watch}"
IKIMON_VERIFICATION_RUNNER_ID="${IKIMON_VERIFICATION_RUNNER_ID:-${HOSTNAME:-unknown-runner}}"
IKIMON_VERIFICATION_REPORT_PATH="${IKIMON_VERIFICATION_REPORT_PATH:-${REPORT_DIR}/production-verification-latest.json}"
IKIMON_VERIFICATION_LOG_PATH="${IKIMON_VERIFICATION_LOG_PATH:-${REPORT_DIR}/production-verification-latest.log}"
IKIMON_VERIFICATION_RUNTIME_PATH="${IKIMON_VERIFICATION_RUNTIME_PATH:-${REPORT_DIR}/production-runtime-version-latest.json}"
PUBLISH_GITHUB_STATUS="${PUBLISH_GITHUB_STATUS:-false}"

case "${SMOKE_TIER}" in full|targeted) ;; *) echo "SMOKE_TIER must be full or targeted" >&2; exit 2 ;; esac
case "${PLAYWRIGHT_INSTALL_WITH_DEPS}" in true|false) ;; *) echo "PLAYWRIGHT_INSTALL_WITH_DEPS must be true or false" >&2; exit 2 ;; esac
case "${PUBLISH_GITHUB_STATUS}" in true|false) ;; *) echo "PUBLISH_GITHUB_STATUS must be true or false" >&2; exit 2 ;; esac

mkdir -p \
  "$(dirname "${IKIMON_VERIFICATION_REPORT_PATH}")" \
  "$(dirname "${IKIMON_VERIFICATION_LOG_PATH}")" \
  "$(dirname "${IKIMON_VERIFICATION_RUNTIME_PATH}")"
RUNTIME_PATH="${IKIMON_VERIFICATION_RUNTIME_PATH}"
RUNTIME_TMP_PATH="${RUNTIME_PATH}.tmp"

resolve_runtime() {
  rm -f "${RUNTIME_TMP_PATH}"
  if ! curl -fsS -H 'cache-control: no-store' "https://ikimon.life/api/v1/runtime/version?verification_watch=$(date +%s)" > "${RUNTIME_TMP_PATH}"; then
    rm -f "${RUNTIME_TMP_PATH}"
    return 1
  fi
  if ! node -e 'const fs=require("fs");JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' "${RUNTIME_TMP_PATH}"; then
    echo "Production runtime endpoint returned invalid JSON." >&2
    rm -f "${RUNTIME_TMP_PATH}"
    return 1
  fi
  mv "${RUNTIME_TMP_PATH}" "${RUNTIME_PATH}"
}

if ! resolve_runtime; then
  echo "Could not read the production runtime version endpoint." >&2
  exit 1
fi

EXPECTED_SHA="${IKIMON_EXPECTED_GIT_SHA:-}"
if [[ -z "${EXPECTED_SHA}" ]]; then
  EXPECTED_SHA="$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(p.gitSha||""));' "${RUNTIME_PATH}")"
fi
if [[ ! "${EXPECTED_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "Expected production SHA is missing or invalid: ${EXPECTED_SHA}" >&2
  exit 2
fi

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
IKIMON_EXPECTED_GIT_SHA="${EXPECTED_SHA}" \
SMOKE_TIER="${SMOKE_TIER}" \
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS}" \
  bash "${SCRIPT_DIR}/verify_cloudflare_production_release.sh" 2>&1 | tee "${IKIMON_VERIFICATION_LOG_PATH}"
VERIFY_EXIT="${PIPESTATUS[0]}"
set -e
FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

resolve_runtime || true
ACTUAL_SHA="$(node -e 'const fs=require("fs");try{const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(p.gitSha||""));}catch{}' "${RUNTIME_PATH}")"

node "${SCRIPT_DIR}/build_production_verification_report.mjs" \
  --report "${IKIMON_VERIFICATION_REPORT_PATH}" \
  --log "${IKIMON_VERIFICATION_LOG_PATH}" \
  --runtime "${RUNTIME_PATH}" \
  --expected-sha "${EXPECTED_SHA}" \
  --actual-sha "${ACTUAL_SHA}" \
  --exit-code "${VERIFY_EXIT}" \
  --started-at "${STARTED_AT}" \
  --finished-at "${FINISHED_AT}" \
  --smoke-tier "${SMOKE_TIER}" \
  --source "${IKIMON_VERIFICATION_SOURCE}" \
  --runner-id "${IKIMON_VERIFICATION_RUNNER_ID}"

if [[ "${PUBLISH_GITHUB_STATUS}" == "true" ]]; then
  if ! node "${SCRIPT_DIR}/publish_production_verification_status.mjs" \
    --report "${IKIMON_VERIFICATION_REPORT_PATH}" \
    --sha "${EXPECTED_SHA}"; then
    echo "WARNING: GitHub production verification status publishing failed; preserving verification exit code ${VERIFY_EXIT}." >&2
  fi
fi

exit "${VERIFY_EXIT}"
