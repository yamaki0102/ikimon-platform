#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="/etc/ikimon/production-verification.env"
SERVICE_NAME="ikimon-production-verification.service"
TIMER_NAME="ikimon-production-verification.timer"
STATE_DIR="/var/lib/ikimon-production-verification"
MAX_AGE_MINUTES=30
ALLOW_INACTIVE=false

usage() {
  cat <<'EOF'
Usage: bash scripts/doctor_production_verification_service.sh [options]

Options:
  --repo-root PATH
  --env-file PATH
  --service-name NAME
  --timer-name NAME
  --state-dir PATH
  --max-age-minutes N
  --allow-inactive       Do not fail when systemd units are not installed/active.
  --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --service-name) SERVICE_NAME="$2"; shift 2 ;;
    --timer-name) TIMER_NAME="$2"; shift 2 ;;
    --state-dir) STATE_DIR="$2"; shift 2 ;;
    --max-age-minutes) MAX_AGE_MINUTES="$2"; shift 2 ;;
    --allow-inactive) ALLOW_INACTIVE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "${MAX_AGE_MINUTES}" =~ ^[0-9]+$ || "${MAX_AGE_MINUTES}" -lt 1 ]]; then
  echo "--max-age-minutes must be a positive integer" >&2
  exit 2
fi

errors=0
warnings=0
pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; errors=$((errors + 1)); }

check_command() {
  if command -v "$1" >/dev/null 2>&1; then pass "command available: $1"; else fail "command missing: $1"; fi
}

for command in bash curl node git systemctl; do check_command "${command}"; done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if [[ "${node_major}" -ge 22 ]]; then
  pass "Node.js ${node_major} satisfies the managed runtime baseline"
else
  fail "Node.js 22+ required; found major ${node_major}"
fi

if [[ -d "${REPO_ROOT}/.git" && -f "${REPO_ROOT}/scripts/run_production_verification_watch.sh" ]]; then
  pass "repository checkout and watch script found: ${REPO_ROOT}"
else
  fail "repository checkout or watch script missing: ${REPO_ROOT}"
fi

if [[ -f "${ENV_FILE}" ]]; then
  pass "environment file exists: ${ENV_FILE}"
  env_mode="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || echo unknown)"
  env_owner="$(stat -c '%U:%G' "${ENV_FILE}" 2>/dev/null || echo unknown)"
  if [[ "${env_mode}" =~ ^[0-7]{3,4}$ ]]; then
    last_digit="${env_mode: -1}"
    if [[ "${last_digit}" == "0" ]]; then
      pass "environment file is not world-accessible: mode ${env_mode}"
    else
      fail "environment file must not be world-accessible: mode ${env_mode}"
    fi
  else
    warn "could not determine environment file mode"
  fi
  [[ "${env_owner}" == root:* ]] && pass "environment file is root-owned: ${env_owner}" || warn "environment file is not root-owned: ${env_owner}"

  publish_value="$(grep -E '^[[:space:]]*PUBLISH_GITHUB_STATUS=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | tr -d '[:space:]' || true)"
  token_present=false
  if grep -Eq '^[[:space:]]*(GITHUB_TOKEN|GH_TOKEN)=.+' "${ENV_FILE}"; then token_present=true; fi
  if [[ "${publish_value}" == "true" ]]; then
    [[ "${token_present}" == "true" ]] && pass "GitHub status publishing has a token configured" || fail "PUBLISH_GITHUB_STATUS=true but no GITHUB_TOKEN/GH_TOKEN is configured"
  else
    warn "GitHub status publishing is disabled; verification still runs locally"
  fi
else
  fail "environment file missing: ${ENV_FILE}"
fi

if systemctl cat "${TIMER_NAME}" >/dev/null 2>&1; then
  pass "timer unit installed: ${TIMER_NAME}"
  if systemctl is-enabled --quiet "${TIMER_NAME}"; then pass "timer enabled"; elif [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "timer not enabled"; else fail "timer not enabled"; fi
  if systemctl is-active --quiet "${TIMER_NAME}"; then pass "timer active"; elif [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "timer not active"; else fail "timer not active"; fi
else
  if [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "timer unit not installed"; else fail "timer unit not installed: ${TIMER_NAME}"; fi
fi

if systemctl cat "${SERVICE_NAME}" >/dev/null 2>&1; then
  pass "service unit installed: ${SERVICE_NAME}"
  service_result="$(systemctl show "${SERVICE_NAME}" -p Result --value 2>/dev/null || true)"
  if [[ -z "${service_result}" || "${service_result}" == "success" ]]; then
    pass "last service result: ${service_result:-not-run-yet}"
  else
    fail "last service result: ${service_result}"
  fi
else
  if [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "service unit not installed"; else fail "service unit not installed: ${SERVICE_NAME}"; fi
fi

if [[ -d "${STATE_DIR}" ]]; then
  pass "state directory exists: ${STATE_DIR}"
  state_mode="$(stat -c '%a' "${STATE_DIR}" 2>/dev/null || echo unknown)"
  [[ "${state_mode}" == "750" || "${state_mode}" == "700" ]] && pass "state directory mode is restricted: ${state_mode}" || warn "state directory mode should be 0750 or stricter: ${state_mode}"
else
  if [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "state directory not created yet"; else fail "state directory missing: ${STATE_DIR}"; fi
fi

runtime_tmp="$(mktemp)"
cleanup() { rm -f "${runtime_tmp}"; }
trap cleanup EXIT
if curl -fsS -H 'cache-control: no-store' "https://ikimon.life/api/v1/runtime/version?doctor=$(date +%s)" > "${runtime_tmp}"; then
  runtime_sha="$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!/^[0-9a-f]{40}$/i.test(String(p.gitSha||"")))process.exit(2);process.stdout.write(p.gitSha);' "${runtime_tmp}" 2>/dev/null || true)"
  [[ "${runtime_sha}" =~ ^[0-9a-fA-F]{40}$ ]] && pass "production runtime endpoint returned exact SHA ${runtime_sha:0:12}" || fail "production runtime endpoint JSON or gitSha is invalid"
else
  fail "production runtime endpoint is unreachable"
  runtime_sha=""
fi

report_path="${STATE_DIR}/production-verification-latest.json"
if [[ -f "${report_path}" ]]; then
  if node --input-type=module - "${report_path}" "${MAX_AGE_MINUTES}" "${runtime_sha}" <<'NODE'
import fs from 'node:fs';
const [file, maxAgeRaw, runtimeSha] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const maxAgeMinutes = Number(maxAgeRaw);
if (report.schemaVersion !== 'ikimon_production_verification/v1') throw new Error('schema');
if (report.status !== 'success') throw new Error(`status:${report.status}`);
if (report.noPersonalData !== true || report.productionMutation !== false) throw new Error('safety');
if (report.shaMatches !== true) throw new Error('shaMatches');
if (runtimeSha && report.expectedGitSha !== runtimeSha) throw new Error('runtimeShaMismatch');
const ageMinutes = (Date.now() - Date.parse(report.finishedAt)) / 60000;
if (!Number.isFinite(ageMinutes) || ageMinutes > maxAgeMinutes) throw new Error(`stale:${ageMinutes}`);
NODE
  then
    pass "latest verification report is successful, safe, SHA-bound, and fresh"
  else
    fail "latest verification report is invalid, failed, stale, or does not match production SHA"
  fi
else
  if [[ "${ALLOW_INACTIVE}" == "true" ]]; then warn "latest verification report not found"; else fail "latest verification report not found: ${report_path}"; fi
fi

archive_dir="${STATE_DIR}/history"
if [[ -f "${archive_dir}/latest.json" ]]; then
  pass "historical evidence archive pointer exists"
else
  warn "historical evidence archive has not been written yet"
fi

printf '\nDoctor summary: errors=%d warnings=%d\n' "${errors}" "${warnings}"
[[ "${errors}" -eq 0 ]]
