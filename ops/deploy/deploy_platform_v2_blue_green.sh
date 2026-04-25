#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/ikimon.life}"
REPO_DIR="${REPO_DIR:-${APP_ROOT}/repo}"
RELEASES_DIR="${RELEASES_DIR:-${APP_ROOT}/releases}"
RUNTIME_DIR="${RUNTIME_DIR:-${APP_ROOT}/runtime}"
STATE_DIR="${STATE_DIR:-${APP_ROOT}/deploy_state}"
ENV_DIR="${ENV_DIR:-/etc/ikimon}"
ENV_FILE="${ENV_FILE:-/etc/ikimon/production-v2.env}"
NGINX_TEMPLATE="${NGINX_TEMPLATE:-${REPO_DIR}/platform_v2/ops/nginx/ikimon.life-v2-cutover.conf}"
LIVE_AVAILABLE="${LIVE_AVAILABLE:-/etc/nginx/sites-available/ikimon.life}"
LIVE_ENABLED="${LIVE_ENABLED:-/etc/nginx/sites-enabled/ikimon.life}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://ikimon.life}"
PM2_NAME="${PM2_NAME:-ikimon-v2-production-api}"

BLUE_PORT=3201
GREEN_PORT=3202

usage() {
  echo "Usage: $0 prepare <release-id> | promote | status"
}

port_for_color() {
  case "$1" in
    blue) echo "${BLUE_PORT}" ;;
    green) echo "${GREEN_PORT}" ;;
    *) echo "unknown color: $1" >&2; exit 1 ;;
  esac
}

other_color() {
  case "$1" in
    blue) echo "green" ;;
    green) echo "blue" ;;
    *) echo "unknown color: $1" >&2; exit 1 ;;
  esac
}

read_env_value() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi
  python3 - "$ENV_FILE" "$key" <<'PY'
import sys
from pathlib import Path

env_file = Path(sys.argv[1])
key = sys.argv[2]
for line in env_file.read_text(encoding="utf-8").splitlines():
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    name, value = line.split("=", 1)
    if name.strip() == key:
        print(value.strip())
        break
PY
}

export_runtime_env() {
  export DATABASE_URL
  DATABASE_URL="$(read_env_value DATABASE_URL)"
  export V2_PRIVILEGED_WRITE_API_KEY
  V2_PRIVILEGED_WRITE_API_KEY="$(read_env_value V2_PRIVILEGED_WRITE_API_KEY)"
}

assert_readiness_ready() {
  local base_url="$1"
  local payload
  payload="$(curl -fsS "${base_url}/ops/readiness")"
  READINESS_JSON="${payload}" python3 - "$base_url" <<'PY'
import json
import os
import sys

base_url = sys.argv[1]
payload = json.loads(os.environ["READINESS_JSON"])
gates = payload.get("gates") or {}
required = [
    "parityVerified",
    "deltaSyncHealthy",
    "driftReportHealthy",
    "compatibilityWriteWorking",
    "audioArchiveReady",
    "rollbackSafetyWindowReady",
]
missing = [key for key in required if gates.get(key) is not True]
if payload.get("status") != "near_ready" or missing:
    print(f"Readiness gate failed for {base_url}", file=sys.stderr)
    print(json.dumps({
        "status": payload.get("status"),
        "failedGates": missing,
        "gates": gates,
        "audioArchive": payload.get("audioArchive"),
        "counts": payload.get("counts"),
    }, ensure_ascii=False), file=sys.stderr)
    raise SystemExit(1)
PY
}

materialize_env() {
  mkdir -p "${ENV_DIR}"
  python3 - "$ENV_FILE" "$PM2_NAME" <<'PY'
import json
import os
import sys
from pathlib import Path

env_file = Path(sys.argv[1])
pm2_name = sys.argv[2]
pm2_dump = Path("/root/.pm2/dump.pm2")
fixed = {
    "NODE_ENV": "production",
    "ALLOW_QUERY_USER_ID": "0",
    "COMPATIBILITY_WRITE_ENABLED": "1",
    "LEGACY_DATA_ROOT": "/var/www/ikimon.life/repo/upload_package/data",
    "LEGACY_PUBLIC_ROOT": "/var/www/ikimon.life/repo/upload_package/public_html",
    "LEGACY_UPLOADS_ROOT": "/var/www/ikimon.life/repo/upload_package/public_html/uploads",
}
carry = [
    "DATABASE_URL",
    "V2_PRIVILEGED_WRITE_API_KEY",
    "GEMINI_API_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_API_TOKEN",
    "CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN",
]

values = {}
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

if pm2_dump.exists():
    with pm2_dump.open(encoding="utf-8") as handle:
        processes = json.load(handle)
    for process in processes:
        if process.get("name") != pm2_name:
            continue
        for key, value in (process.get("env") or {}).items():
            if key in carry and key not in values and value is not None:
                values[key] = str(value)
        break

values.update(fixed)
missing = [key for key in ("DATABASE_URL", "V2_PRIVILEGED_WRITE_API_KEY") if not values.get(key)]
if missing:
    raise SystemExit(f"Missing required production v2 env keys: {', '.join(missing)}")

tmp = env_file.with_suffix(".env.tmp")
tmp.write_text("".join(f"{key}={values[key]}\n" for key in sorted(values)), encoding="utf-8")
os.chmod(tmp, 0o600)
tmp.replace(env_file)
print("production-v2.env materialized")
PY
}

install_units() {
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_blue.service" /etc/systemd/system/ikimon-v2-blue.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_green.service" /etc/systemd/system/ikimon-v2-green.service
  systemctl daemon-reload
}

ensure_private_uploads_dir() {
  install -d -m 750 -o www-data -g www-data "${APP_ROOT}/private_uploads"
  install -d -m 750 -o www-data -g www-data "${APP_ROOT}/private_uploads/v2-audio"
}

infer_active_color() {
  if [[ -f "${STATE_DIR}/active_color" ]]; then
    local saved
    saved="$(tr -d '[:space:]' < "${STATE_DIR}/active_color")"
    if [[ "${saved}" == "blue" || "${saved}" == "green" ]]; then
      echo "${saved}"
      return
    fi
  fi

  if [[ -f "${LIVE_AVAILABLE}" ]] && grep -q "127\.0\.0\.1:${GREEN_PORT}" "${LIVE_AVAILABLE}"; then
    echo "green"
    return
  fi
  echo "blue"
}

stop_legacy_pm2() {
  if command -v pm2 >/dev/null 2>&1 && pm2 jlist | grep -q "\"name\":\"${PM2_NAME}\""; then
    pm2 stop "${PM2_NAME}" || true
    pm2 delete "${PM2_NAME}" || true
    pm2 save || true
  fi
}

prepare_release() {
  local release_id="$1"
  local active inactive port release_root release_platform

  materialize_env
  install_units
  ensure_private_uploads_dir
  stop_legacy_pm2

  mkdir -p "${RELEASES_DIR}" "${RUNTIME_DIR}" "${STATE_DIR}"
  active="$(infer_active_color)"
  inactive="$(other_color "${active}")"
  port="$(port_for_color "${inactive}")"
  release_root="${RELEASES_DIR}/${release_id}"
  release_platform="${release_root}/platform_v2"

  mkdir -p "${release_root}"
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude test-results \
    --exclude playwright-report \
    "${REPO_DIR}/platform_v2/" "${release_platform}/"

  cd "${release_platform}"
  npm ci --silent
  npm run build

  ln -sfn "${release_platform}" "${RUNTIME_DIR}/${inactive}"
  chown -h www-data:www-data "${RUNTIME_DIR}/${inactive}" 2>/dev/null || true
  chown -R www-data:www-data "${release_root}"

  systemctl enable --now "ikimon-v2-${inactive}.service"
  systemctl restart "ikimon-v2-${inactive}.service"
  systemctl is-active "ikimon-v2-${inactive}.service" >/dev/null

  export_runtime_env
  npm run sync:legacy -- --source-name=production_legacy_fs --import-version=production_shadow_live
  npm run verify:production-shadow -- --import-version=production_shadow_live
  npm run report:legacy-drift -- --json
  npm run smoke:v2-lane -- --base-url="http://127.0.0.1:${port}"
  npm run smoke:v2-read-lane -- --base-url="http://127.0.0.1:${port}"

  printf '%s\n' "${active}" > "${STATE_DIR}/previous_color"
  printf '%s\n' "${inactive}" > "${STATE_DIR}/candidate_color"
  printf '%s\n' "${port}" > "${STATE_DIR}/candidate_port"
  printf '%s\n' "${release_id}" > "${STATE_DIR}/candidate_release"

  echo "candidate_color=${inactive}"
  echo "candidate_port=${port}"
  echo "candidate_release=${release_id}"
}

snapshot_nginx() {
  local stamp snapshot_dir
  stamp="$(date +%Y%m%d-%H%M%S)"
  snapshot_dir="${STATE_DIR}/nginx-${stamp}"
  mkdir -p "${snapshot_dir}"
  cp -a "${LIVE_AVAILABLE}" "${snapshot_dir}/ikimon.life.available"
  if [[ -e "${LIVE_ENABLED}" ]]; then
    cp -a "${LIVE_ENABLED}" "${snapshot_dir}/ikimon.life.enabled"
  fi
  printf '%s\n' "${snapshot_dir}"
}

restore_nginx_snapshot() {
  local snapshot_dir="$1"
  if [[ -f "${snapshot_dir}/ikimon.life.available" ]]; then
    cp -a "${snapshot_dir}/ikimon.life.available" "${LIVE_AVAILABLE}"
  fi
  if [[ -f "${snapshot_dir}/ikimon.life.enabled" && ! -L "${LIVE_ENABLED}" ]]; then
    cp -a "${snapshot_dir}/ikimon.life.enabled" "${LIVE_ENABLED}"
  fi
  nginx -t && systemctl reload nginx
}

render_nginx_for_port() {
  local port="$1"
  local rendered="$2"
  sed "s#127\\.0\\.0\\.1:3200#127.0.0.1:${port}#g" "${NGINX_TEMPLATE}" > "${rendered}"
}

promote_candidate() {
  local candidate port previous snapshot rendered
  candidate="$(tr -d '[:space:]' < "${STATE_DIR}/candidate_color")"
  port="$(tr -d '[:space:]' < "${STATE_DIR}/candidate_port")"
  previous="$(tr -d '[:space:]' < "${STATE_DIR}/previous_color")"

  if [[ "${candidate}" != "blue" && "${candidate}" != "green" ]]; then
    echo "Invalid candidate color: ${candidate}" >&2
    exit 1
  fi

  curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null
  curl -fsS "http://127.0.0.1:${port}/readyz" >/dev/null
  assert_readiness_ready "http://127.0.0.1:${port}"

  snapshot="$(snapshot_nginx)"
  rendered="$(mktemp)"
  render_nginx_for_port "${port}" "${rendered}"

  if ! cp "${rendered}" "${LIVE_AVAILABLE}"; then
    rm -f "${rendered}"
    exit 1
  fi
  if [[ -e "${LIVE_ENABLED}" && ! -L "${LIVE_ENABLED}" ]]; then
    cp "${rendered}" "${LIVE_ENABLED}"
  elif [[ ! -e "${LIVE_ENABLED}" ]]; then
    ln -s "${LIVE_AVAILABLE}" "${LIVE_ENABLED}"
  fi

  if ! nginx -t || ! systemctl reload nginx; then
    restore_nginx_snapshot "${snapshot}" || true
    rm -f "${rendered}"
    exit 1
  fi

  rm -f "${rendered}"
  export_runtime_env
  if ! npm --prefix "${RUNTIME_DIR}/${candidate}" run smoke:v2-lane -- --base-url="${PUBLIC_BASE_URL}" ||
     ! npm --prefix "${RUNTIME_DIR}/${candidate}" run smoke:v2-read-lane -- --base-url="${PUBLIC_BASE_URL}"; then
    restore_nginx_snapshot "${snapshot}" || true
    printf '%s\n' "${previous}" > "${STATE_DIR}/active_color"
    exit 1
  fi
  assert_readiness_ready "${PUBLIC_BASE_URL}"

  printf '%s\n' "${candidate}" > "${STATE_DIR}/active_color"
  rm -f "${STATE_DIR}/candidate_color" "${STATE_DIR}/candidate_port" "${STATE_DIR}/candidate_release" "${STATE_DIR}/previous_color"
  echo "promoted_color=${candidate}"
  echo "promoted_port=${port}"
}

status() {
  mkdir -p "${STATE_DIR}"
  echo "active_color=$(infer_active_color)"
  if [[ -f "${STATE_DIR}/candidate_color" ]]; then
    echo "candidate_color=$(tr -d '[:space:]' < "${STATE_DIR}/candidate_color")"
    echo "candidate_port=$(tr -d '[:space:]' < "${STATE_DIR}/candidate_port")"
  fi
}

case "${1:-}" in
  prepare)
    if [[ -z "${2:-}" ]]; then
      usage
      exit 1
    fi
    prepare_release "$2"
    ;;
  promote)
    promote_candidate
    ;;
  status)
    status
    ;;
  *)
    usage
    exit 1
    ;;
esac
