#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/ikimon.life}"
REPO_DIR="${REPO_DIR:-${APP_ROOT}/repo}"
RELEASES_DIR="${RELEASES_DIR:-${APP_ROOT}/releases}"
RUNTIME_DIR="${RUNTIME_DIR:-${APP_ROOT}/runtime}"
STATE_DIR="${STATE_DIR:-${APP_ROOT}/deploy_state}"
CACHE_DIR="${CACHE_DIR:-${APP_ROOT}/cache}"
STATIC_IMPORT_STATE_DIR="${STATIC_IMPORT_STATE_DIR:-${STATE_DIR}/static_imports}"
FORCE_STATIC_IMPORTS="${FORCE_STATIC_IMPORTS:-0}"
FORCE_LEGACY_SYNC="${FORCE_LEGACY_SYNC:-0}"
ENV_DIR="${ENV_DIR:-/etc/ikimon}"
ENV_FILE="${ENV_FILE:-/etc/ikimon/production-v2.env}"
NGINX_TEMPLATE="${NGINX_TEMPLATE:-${REPO_DIR}/platform_v2/ops/nginx/ikimon.life-v2-cutover.conf}"
LIVE_AVAILABLE="${LIVE_AVAILABLE:-/etc/nginx/sites-available/ikimon.life}"
LIVE_ENABLED="${LIVE_ENABLED:-/etc/nginx/sites-enabled/ikimon.life}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://zukan.earth}"
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
  export LEGACY_DATA_ROOT
  LEGACY_DATA_ROOT="$(read_env_value LEGACY_DATA_ROOT)"
  export LEGACY_PUBLIC_ROOT
  LEGACY_PUBLIC_ROOT="$(read_env_value LEGACY_PUBLIC_ROOT)"
  export LEGACY_UPLOADS_ROOT
  LEGACY_UPLOADS_ROOT="$(read_env_value LEGACY_UPLOADS_ROOT)"
  export COMPATIBILITY_WRITE_ENABLED
  COMPATIBILITY_WRITE_ENABLED="$(read_env_value COMPATIBILITY_WRITE_ENABLED)"
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
import tempfile
from pathlib import Path

env_file = Path(sys.argv[1])
pm2_name = sys.argv[2]
pm2_dump = Path("/root/.pm2/dump.pm2")
fixed = {
    "NODE_ENV": "production",
    "ZUKAN_PUBLIC_ORIGIN": "https://zukan.earth",
    "ALLOW_QUERY_USER_ID": "0",
    "AI_OBSERVATION_IMAGE_MAX_EDGE": "1024",
    "AI_OBSERVATION_VISUAL_LITE_FIRST": "1",
    "COMPATIBILITY_WRITE_ENABLED": "1",
    "LEGACY_DATA_ROOT": "/var/www/ikimon.life/repo/upload_package/data",
    "LEGACY_PUBLIC_ROOT": "/var/www/ikimon.life/repo/upload_package/public_html",
    "LEGACY_UPLOADS_ROOT": "/var/www/ikimon.life/repo/upload_package/public_html/uploads",
    "FEATURE_RELATIONSHIP_SCORE": "1",
}
carry = [
    "DATABASE_URL",
    "V2_PRIVILEGED_WRITE_API_KEY",
    "GEMINI_API_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_API_TOKEN",
    "CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TWITTER_CLIENT_ID",
    "TWITTER_CLIENT_SECRET",
    "V2_OAUTH_STATE_SECRET",
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

env_file.parent.mkdir(parents=True, exist_ok=True)
fd, tmp_name = tempfile.mkstemp(
    prefix=f".{env_file.name}.",
    suffix=".tmp",
    dir=str(env_file.parent),
    text=True,
)
tmp = Path(tmp_name)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write("".join(f"{key}={values[key]}\n" for key in sorted(values)))
    os.chmod(tmp, 0o600)
    os.replace(tmp, env_file)
finally:
    if tmp.exists():
        tmp.unlink()
print("production-v2.env materialized")
PY
}

install_units() {
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_blue.service" /etc/systemd/system/ikimon-v2-blue.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_green.service" /etc/systemd/system/ikimon-v2-green.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_media_worker.service" /etc/systemd/system/ikimon-v2-media-worker.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_media_worker.timer" /etc/systemd/system/ikimon-v2-media-worker.timer
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_audio_worker.service" /etc/systemd/system/ikimon-v2-audio-worker.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_audio_worker.timer" /etc/systemd/system/ikimon-v2-audio-worker.timer
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_production_media_smoke.service" /etc/systemd/system/ikimon-v2-production-media-smoke.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_production_media_smoke.timer" /etc/systemd/system/ikimon-v2-production-media-smoke.timer
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_guide_environment.service" /etc/systemd/system/ikimon-v2-guide-environment.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_guide_environment.timer" /etc/systemd/system/ikimon-v2-guide-environment.timer
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_location_audit.service" /etc/systemd/system/ikimon-v2-location-audit.service
  install -m 644 "${REPO_DIR}/ops/deploy/ikimon_v2_location_audit.timer" /etc/systemd/system/ikimon-v2-location-audit.timer
  systemctl daemon-reload
  systemctl enable --now ikimon-v2-media-worker.timer >/dev/null
  systemctl enable --now ikimon-v2-audio-worker.timer >/dev/null
  systemctl enable --now ikimon-v2-production-media-smoke.timer >/dev/null
  systemctl enable --now ikimon-v2-guide-environment.timer >/dev/null
  systemctl enable --now ikimon-v2-location-audit.timer >/dev/null
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

file_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

write_marker() {
  local marker="$1"
  local value="$2"
  mkdir -p "$(dirname "${marker}")"
  printf '%s\n' "${value}" > "${marker}.tmp"
  mv "${marker}.tmp" "${marker}"
}

log_deploy_timing() {
  local stage="$1"
  local seconds="$2"
  local status="$3"
  local log_path="${DEPLOY_TIMING_LOG:-}"

  printf 'deploy_timing stage=%s seconds=%s status=%s release=%s\n' \
    "${stage}" "${seconds}" "${status}" "${DEPLOY_TIMING_RELEASE:-unknown}"

  if [[ -n "${log_path}" ]]; then
    mkdir -p "$(dirname "${log_path}")"
    printf '{"event":"deploy_timing","stage":"%s","seconds":%s,"status":"%s","release":"%s"}\n' \
      "${stage}" "${seconds}" "${status}" "${DEPLOY_TIMING_RELEASE:-unknown}" >> "${log_path}"
  fi
}

timed_step() {
  local stage="$1"
  shift

  local start end rc status
  start="$(date +%s)"
  printf 'deploy_timing_start stage=%s release=%s\n' "${stage}" "${DEPLOY_TIMING_RELEASE:-unknown}"
  set +e
  "$@"
  rc=$?
  set -e
  end="$(date +%s)"
  if [[ "${rc}" -eq 0 ]]; then
    status="success"
  else
    status="failure"
  fi
  log_deploy_timing "${stage}" "$((end - start))" "${status}"
  return "${rc}"
}

run_hashed_static_import() {
  local name="$1"
  local source_file="$2"
  shift 2

  local marker hash existing
  marker="${STATIC_IMPORT_STATE_DIR}/${name}.sha256"
  hash="$(file_sha256 "${source_file}")"
  existing="$(cat "${marker}" 2>/dev/null || true)"
  if [[ "${FORCE_STATIC_IMPORTS}" != "1" && "${existing}" == "${hash}" ]]; then
    echo "Skipping unchanged static import: ${name}"
    return
  fi

  "$@"
  write_marker "${marker}" "${hash}"
}

sync_legacy_delta() {
  local args=(
    --source-name=production_legacy_fs
    --import-version=production_shadow_live
  )

  if [[ "${FORCE_LEGACY_SYNC}" == "1" ]]; then
    args=(--force "${args[@]}")
  fi

  npm run sync:legacy -- "${args[@]}"
}

import_shizuoka_admin_areas() {
  local tmp zip geojson marker version existing
  version="N03-20250101_22_GML:2025-01-01"
  marker="${STATIC_IMPORT_STATE_DIR}/n03_shizuoka_admin.version"
  existing="$(cat "${marker}" 2>/dev/null || true)"
  if [[ "${FORCE_STATIC_IMPORTS}" != "1" && "${existing}" == "${version}" ]]; then
    echo "Skipping unchanged static import: n03_shizuoka_admin"
    return
  fi

  mkdir -p "${CACHE_DIR}/ksj"
  tmp="$(mktemp -d)"
  zip="${CACHE_DIR}/ksj/N03-20250101_22_GML.zip"
  if [[ ! -s "${zip}" ]]; then
    curl -fsSL --retry 3 --connect-timeout 20 \
      "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_22_GML.zip" \
      -o "${zip}"
  fi
  python3 -m zipfile -e "${zip}" "${tmp}"
  geojson="$(find "${tmp}" -maxdepth 2 -type f -name "*.geojson" | head -n 1)"
  if [[ -z "${geojson}" ]]; then
    rm -rf "${tmp}"
    echo "N03 Shizuoka GeoJSON was not found in downloaded archive" >&2
    exit 1
  fi
  npm run import:n03-admin -- --geojson "${geojson}" --publish-date 2025-01-01
  write_marker "${marker}" "${version}"
  rm -rf "${tmp}"
}

prepare_release() {
  local release_id="$1"
  local active inactive port release_root release_platform

  mkdir -p "${RELEASES_DIR}" "${RUNTIME_DIR}" "${STATE_DIR}"
  DEPLOY_TIMING_RELEASE="${release_id}"
  DEPLOY_TIMING_LOG="${STATE_DIR}/prepare_timing_${release_id}.jsonl"
  : > "${DEPLOY_TIMING_LOG}"
  ln -sfn "$(basename "${DEPLOY_TIMING_LOG}")" "${STATE_DIR}/prepare_timing_latest.jsonl"

  timed_step "materialize_env" materialize_env
  timed_step "install_units" install_units
  timed_step "ensure_private_uploads_dir" ensure_private_uploads_dir
  timed_step "stop_legacy_pm2" stop_legacy_pm2

  active="$(infer_active_color)"
  inactive="$(other_color "${active}")"
  port="$(port_for_color "${inactive}")"
  release_root="${RELEASES_DIR}/${release_id}"
  release_platform="${release_root}/platform_v2"

  mkdir -p "${release_root}"
  timed_step "rsync_platform_v2" rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude test-results \
    --exclude playwright-report \
    "${REPO_DIR}/platform_v2/" "${release_platform}/"

  cd "${release_platform}"
  mkdir -p "${CACHE_DIR}/npm"
  timed_step "npm_ci" env npm_config_cache="${CACHE_DIR}/npm" npm ci --prefer-offline --silent
  timed_step "build_server" npm run build:server
  timed_step "export_runtime_env" export_runtime_env
  export IKIMON_MIGRATION_REPAIR_CHECKSUMS="${IKIMON_MIGRATION_REPAIR_CHECKSUMS:-0012_contact_submissions.sql,0013_video_upload_requests.sql,0014_audio_segments.sql,0015_observation_reactions_and_insights.sql,0016_observation_ai_assessments.sql,0075_normalize_shizuoka_locality_labels.sql}"
  timed_step "repair_observation_field_source_policy" npx tsx src/scripts/repairObservationFieldSourcePolicy.ts
  timed_step "migrate" npm run migrate
  timed_step "static_import_n03_shizuoka_admin" import_shizuoka_admin_areas
  timed_step "static_import_observation_fields_aikan_renri" run_hashed_static_import \
    "observation_fields_aikan_renri" \
    "src/scripts/data/nature_symbiosis_sites.seed.json" \
    npm run import:observation-fields:aikan-renri
  timed_step "static_import_invasive_reporting_shizuoka" run_hashed_static_import \
    "invasive_reporting_shizuoka" \
    "db/seeds/invasive_reporting_contacts.shizuoka_2026-05-16.json" \
    npm run import:invasive-reporting:shizuoka
  timed_step "compile_knowledge_navigation" npm run compile:knowledge-navigation
  timed_step "postdeploy_guide_environment" npm run postdeploy:guide-environment

  timed_step "link_inactive_runtime" ln -sfn "${release_platform}" "${RUNTIME_DIR}/${inactive}"
  timed_step "chown_runtime_symlink" bash -c 'chown -h www-data:www-data "$1" 2>/dev/null || true' _ "${RUNTIME_DIR}/${inactive}"
  timed_step "chown_release_root" chown -R www-data:www-data "${release_root}"

  timed_step "enable_inactive_service" systemctl enable --now "ikimon-v2-${inactive}.service"
  timed_step "restart_inactive_service" systemctl restart "ikimon-v2-${inactive}.service"
  timed_step "check_inactive_service" bash -c 'systemctl is-active "$1" >/dev/null' _ "ikimon-v2-${inactive}.service"

  timed_step "sync_legacy" sync_legacy_delta
  timed_step "repair_location_labels" npm run repair:location-labels
  timed_step "repair_hamamatsu_ward_labels" npm run repair:hamamatsu-ward-labels -- --apply
  timed_step "verify_production_shadow" npm run verify:production-shadow -- --import-version=production_shadow_live
  timed_step "report_legacy_drift" npm run report:legacy-drift -- --json
  timed_step "smoke_platform_lane_candidate" npm run smoke:platform-lane -- --base-url="http://127.0.0.1:${port}"
  timed_step "smoke_platform_read_lane_candidate" env IKIMON_SCENE_READ_SMOKE=required npm run smoke:platform-read-lane -- --base-url="http://127.0.0.1:${port}"

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
  if ! npm --prefix "${RUNTIME_DIR}/${candidate}" run smoke:platform-lane -- --base-url="${PUBLIC_BASE_URL}" ||
     ! IKIMON_ORIGIN_FALLBACK_SMOKE=1 IKIMON_SCENE_READ_SMOKE=required npm --prefix "${RUNTIME_DIR}/${candidate}" run smoke:platform-read-lane -- --base-url="${PUBLIC_BASE_URL}"; then
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
