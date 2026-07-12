#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="${DEFAULT_REPO_ROOT}"
SERVICE_USER="ikimon"
SERVICE_GROUP="ikimon"
ENV_FILE="/etc/ikimon/production-verification.env"
SYSTEMD_DIR="/etc/systemd/system"
SERVICE_NAME="ikimon-production-verification.service"
TIMER_NAME="ikimon-production-verification.timer"
DRY_RUN=false
ENABLE_TIMER=true
RUN_NOW=true
CREATE_USER=false
UNINSTALL=false
PURGE_STATE=false

usage() {
  cat <<'EOF'
Usage: sudo bash scripts/install_production_verification_service.sh [options]

Options:
  --repo-root PATH       Repository checkout used by the service.
  --service-user USER    Service account (default: ikimon).
  --service-group GROUP  Service group (default: ikimon).
  --env-file PATH        Root-managed environment file.
  --systemd-dir PATH     Unit installation directory.
  --create-user          Create the system account when it does not exist.
  --no-enable            Install units without enabling the timer.
  --no-run-now           Do not run an immediate verification after install.
  --dry-run              Validate and print actions without changing the host.
  --uninstall            Disable and remove the units. Keeps env and evidence.
  --purge-state          With --uninstall, also remove env and evidence state.
  --help                 Show this help.

The installer never accepts GitHub or Cloudflare tokens on the command line.
Place secrets in the root-managed environment file instead.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    --service-user) SERVICE_USER="$2"; shift 2 ;;
    --service-group) SERVICE_GROUP="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --systemd-dir) SYSTEMD_DIR="$2"; shift 2 ;;
    --create-user) CREATE_USER=true; shift ;;
    --no-enable) ENABLE_TIMER=false; shift ;;
    --no-run-now) RUN_NOW=false; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    --purge-state) PURGE_STATE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ "${EUID}" -ne 0 && "${DRY_RUN}" != "true" ]]; then
  echo "Run as root or use --dry-run." >&2
  exit 2
fi

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Required file not found: $1" >&2
    exit 2
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 2
  fi
}

validate_name() {
  if [[ ! "$2" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]]; then
    echo "Invalid $1: $2" >&2
    exit 2
  fi
}

validate_name service-user "${SERVICE_USER}"
validate_name service-group "${SERVICE_GROUP}"
REPO_ROOT="$(cd "${REPO_ROOT}" && pwd)"
SERVICE_TEMPLATE="${REPO_ROOT}/ops/monitoring/systemd/${SERVICE_NAME}"
TIMER_TEMPLATE="${REPO_ROOT}/ops/monitoring/systemd/${TIMER_NAME}"
ENV_EXAMPLE="${REPO_ROOT}/ops/monitoring/systemd/production-verification.env.example"
DOCTOR_SCRIPT="${REPO_ROOT}/scripts/doctor_production_verification_service.sh"
SERVICE_DESTINATION="${SYSTEMD_DIR}/${SERVICE_NAME}"
TIMER_DESTINATION="${SYSTEMD_DIR}/${TIMER_NAME}"
STATE_DIR="/var/lib/ikimon-production-verification"

require_command install
require_command node
require_command systemctl
require_file "${SERVICE_TEMPLATE}"
require_file "${TIMER_TEMPLATE}"
require_file "${ENV_EXAMPLE}"
require_file "${DOCTOR_SCRIPT}"
require_file "${REPO_ROOT}/scripts/run_production_verification_watch.sh"

if [[ "${UNINSTALL}" == "true" ]]; then
  run systemctl disable --now "${TIMER_NAME}" || true
  run rm -f "${SERVICE_DESTINATION}" "${TIMER_DESTINATION}"
  run systemctl daemon-reload
  run systemctl reset-failed "${SERVICE_NAME}" "${TIMER_NAME}" || true
  if [[ "${PURGE_STATE}" == "true" ]]; then
    run rm -rf "${STATE_DIR}"
    run rm -f "${ENV_FILE}"
  fi
  echo "Production verification service uninstalled."
  exit 0
fi

if ! getent group "${SERVICE_GROUP}" >/dev/null 2>&1; then
  if [[ "${CREATE_USER}" == "true" ]]; then
    run groupadd --system "${SERVICE_GROUP}"
  else
    echo "Service group does not exist: ${SERVICE_GROUP}. Re-run with --create-user or choose an existing group." >&2
    exit 2
  fi
fi

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  if [[ "${CREATE_USER}" == "true" ]]; then
    run useradd --system --gid "${SERVICE_GROUP}" --home-dir /nonexistent --shell /usr/sbin/nologin "${SERVICE_USER}"
  else
    echo "Service user does not exist: ${SERVICE_USER}. Re-run with --create-user or choose an existing user." >&2
    exit 2
  fi
fi

if [[ "${DRY_RUN}" != "true" ]]; then
  if [[ ! -r "${REPO_ROOT}/scripts/run_production_verification_watch.sh" ]]; then
    echo "Service user cannot read the repository script: ${REPO_ROOT}" >&2
    exit 2
  fi
  if ! sudo -u "${SERVICE_USER}" test -r "${REPO_ROOT}/scripts/run_production_verification_watch.sh"; then
    echo "${SERVICE_USER} cannot read ${REPO_ROOT}. Fix repository directory permissions before installing." >&2
    exit 2
  fi
fi

rendered_service="$(mktemp)"
rendered_timer="$(mktemp)"
cleanup() { rm -f "${rendered_service}" "${rendered_timer}"; }
trap cleanup EXIT

node --input-type=module - "${SERVICE_TEMPLATE}" "${rendered_service}" "${SERVICE_USER}" "${SERVICE_GROUP}" "${REPO_ROOT}" "${ENV_FILE}" <<'NODE'
import fs from 'node:fs';
const [source, destination, user, group, repoRoot, envFile] = process.argv.slice(2);
let text = fs.readFileSync(source, 'utf8');
text = text
  .replace(/^User=.*$/m, `User=${user}`)
  .replace(/^Group=.*$/m, `Group=${group}`)
  .replace(/^WorkingDirectory=.*$/m, `WorkingDirectory=${repoRoot}`)
  .replace(/^EnvironmentFile=.*$/m, `EnvironmentFile=${envFile}`);
fs.writeFileSync(destination, text);
NODE
cp "${TIMER_TEMPLATE}" "${rendered_timer}"

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify "${rendered_service}" "${rendered_timer}"
fi

run install -d -m 0755 "${SYSTEMD_DIR}"
run install -d -m 0750 -o root -g "${SERVICE_GROUP}" "$(dirname "${ENV_FILE}")"
if [[ ! -f "${ENV_FILE}" ]]; then
  run install -m 0640 -o root -g "${SERVICE_GROUP}" "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "Created ${ENV_FILE} with GitHub status publishing disabled. Add a status-only token, then set PUBLISH_GITHUB_STATUS=true."
else
  echo "Preserving existing environment file: ${ENV_FILE}"
fi
run install -m 0644 "${rendered_service}" "${SERVICE_DESTINATION}"
run install -m 0644 "${rendered_timer}" "${TIMER_DESTINATION}"
run systemctl daemon-reload

if [[ "${ENABLE_TIMER}" == "true" ]]; then
  run systemctl enable --now "${TIMER_NAME}"
fi
if [[ "${RUN_NOW}" == "true" ]]; then
  run systemctl start "${SERVICE_NAME}"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "Dry-run complete. No host changes were made."
else
  bash "${DOCTOR_SCRIPT}" \
    --repo-root "${REPO_ROOT}" \
    --env-file "${ENV_FILE}" \
    --service-name "${SERVICE_NAME}" \
    --timer-name "${TIMER_NAME}" \
    --max-age-minutes 30
fi

echo "Production verification service installation completed."
