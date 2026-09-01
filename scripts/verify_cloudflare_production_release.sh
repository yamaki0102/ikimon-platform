#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_DIR="${REPO_ROOT}/platform_v2"
EXPECTED_SHA="${IKIMON_EXPECTED_GIT_SHA:-${GITHUB_SHA:-}}"
SMOKE_TIER="${SMOKE_TIER:-full}"
PLAYWRIGHT_INSTALL_WITH_DEPS="${PLAYWRIGHT_INSTALL_WITH_DEPS:-false}"
BUILD_MARKER="${IKIMON_EXPECTED_BUILD_MARKER:-one-month-sprint-evidence-gate-20260705}"

if [[ ! "${EXPECTED_SHA}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "IKIMON_EXPECTED_GIT_SHA or GITHUB_SHA must contain the exact 40-character production SHA." >&2
  exit 2
fi
case "${SMOKE_TIER}" in full|targeted) ;; *) echo "SMOKE_TIER must be full or targeted" >&2; exit 2 ;; esac
case "${PLAYWRIGHT_INSTALL_WITH_DEPS}" in true|false) ;; *) echo "PLAYWRIGHT_INSTALL_WITH_DEPS must be true or false" >&2; exit 2 ;; esac

export GITHUB_SHA="${EXPECTED_SHA}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

fetch_body() {
  local url="$1"
  curl -fsS -H 'cache-control: no-store' "${url}"
}

require_contains() {
  local body="$1"
  local marker="$2"
  local label="$3"
  if [[ "${body}" != *"${marker}"* ]]; then
    echo "${label} is missing marker: ${marker}" >&2
    exit 1
  fi
}

require_not_contains() {
  local body="$1"
  local marker="$2"
  local label="$3"
  if [[ "${body}" == *"${marker}"* ]]; then
    echo "${label} contains forbidden marker: ${marker}" >&2
    exit 1
  fi
}

echo "== Production health and release identity checks =="
for url in \
  https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/healthz \
  https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/readyz \
  https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/runtime/version \
  https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/qa/reflection-loop.json \
  https://ikimon.life/healthz \
  https://ikimon.life/readyz \
  https://ikimon.life/api/v1/runtime/version \
  https://ikimon.life/qa/reflection-loop.json \
  https://ikimon.life/ \
  https://ikimon.life/ja/map \
  https://ikimon.life/ja/learn \
  https://ikimon.life/ja/contact
do
  status="$(curl -sS -o /dev/null -w "%{http_code}" "${url}")"
  case "${status}" in
    2*|3*) echo "OK ${url} -> ${status}" ;;
    *) echo "FAIL ${url} -> ${status}" >&2; exit 1 ;;
  esac
done

health_payload="$(fetch_body "https://ikimon.life/healthz?deploy_smoke=${EXPECTED_SHA}")"
require_contains "${health_payload}" "\"buildMarker\":\"${BUILD_MARKER}\"" "Production Worker health payload"

runtime_payload="$(fetch_body "https://ikimon.life/api/v1/runtime/version?deploy_smoke=${EXPECTED_SHA}")"
for marker in \
  '"schemaVersion":"cloudflare_worker_runtime/v1"' \
  '"runtime":"cloudflare-worker"' \
  '"publicSafe":true' \
  "\"buildMarker\":\"${BUILD_MARKER}\""
do
  require_contains "${runtime_payload}" "${marker}" "Production runtime version endpoint"
done
node -e '
  const payload = JSON.parse(process.argv[1]);
  const expectedSha = process.argv[2];
  if (payload.gitSha !== expectedSha) throw new Error(`runtime SHA mismatch: ${payload.gitSha} != ${expectedSha}`);
  for (const key of ["workerVersion", "uiBundleHash", "originalUiManifestHash", "deployedAt"]) {
    if (typeof payload[key] !== "string" || !payload[key]) throw new Error(`runtime release field missing: ${key}`);
  }
' "${runtime_payload}" "${EXPECTED_SHA}"

home_headers="${TMP_DIR}/home.headers"
home_body="$(curl -fsS -D "${home_headers}" -H 'cache-control: no-store' "https://ikimon.life/ja/?deploy_release=${EXPECTED_SHA}")"
require_contains "${home_body}" 'data-global-record-trigger="photo"' "Production home"
require_contains "${home_body}" 'data-kpi-action="header_record_photo"' "Production home"
grep -qi "^x-ikimon-deploy-sha: ${EXPECTED_SHA}" "${home_headers}"
grep -qi '^x-ikimon-ui-bundle: ' "${home_headers}"
grep -qi '^x-ikimon-worker-version: ' "${home_headers}"

reflection_payload="$(fetch_body "https://ikimon.life/qa/reflection-loop.json?deploy_smoke=${EXPECTED_SHA}")"
for marker in '"service":"ikimon.life"' '"runtime":"cloudflare-worker"' '"no_personal_data":true' '"/api/v1/runtime/version"'; do
  require_contains "${reflection_payload}" "${marker}" "Production reflection loop manifest"
done

echo "== Materialized map and PWA shell checks =="
map_body="$(fetch_body "https://ikimon.life/ja/map?deploy_smoke=${EXPECTED_SHA}")"
signed_map_body="$(curl -fsS -H 'cache-control: no-store' -H 'cookie: ikimon_v2_session=deploy-smoke' "https://ikimon.life/map?deploy_smoke_signed=${EXPECTED_SHA}")"
require_contains "${map_body}" "me-map-kicker" "Map materialized HTML"
require_contains "${signed_map_body}" "tiles.openfreemap.org/planet" "Signed-in map shell"
require_not_contains "${signed_map_body}" "tile.openstreetmap.org" "Signed-in map shell"

for signed_home_url in \
  "https://ikimon.life/?source=pwa&deploy_smoke_home=${EXPECTED_SHA}" \
  "https://ikimon.life/ja/?source=pwa&deploy_smoke_home=${EXPECTED_SHA}"
do
  signed_home_headers="$(mktemp "${TMP_DIR}/signed-home.XXXXXX.headers")"
  signed_home="$(curl -fsS -D "${signed_home_headers}" -H 'cache-control: no-store' -H 'cookie: ikimon_v2_session=deploy-smoke' "${signed_home_url}")"
  grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' "${signed_home_headers}"
  require_contains "${signed_home}" "data-home-contract=\"state-split-v1\"" "Signed-in state-split home shell"
  for marker in 'id="map-explorer"' 'tile.openstreetmap.org' 'me-area-badge'; do
    require_not_contains "${signed_home}" "${marker}" "Signed-in home shell"
  done
done

require_contains "${map_body}" "filter: ['match', ['get', 'class'], ['river', 'canal'], true, false]" "Map shell"
require_not_contains "${map_body}" '<div class="me-enjoy-strip"' "Map shell"
require_contains "${map_body}" "global-record-launcher" "Map shell"

app_sw="$(fetch_body "https://ikimon.life/app-sw.js?deploy_smoke=${EXPECTED_SHA}")"
for marker in "zukan-app-v1" "MAP_NAV_RE" "PERSONAL_NAV_RE" "REFRESH_NAV_RE" "cache: 'no-store'" "client.navigate"; do
  require_contains "${app_sw}" "${marker}" "PWA service worker"
done

app_refresh_headers="${TMP_DIR}/app-refresh.headers"
app_refresh="$(curl -fsS -D "${app_refresh_headers}" -H 'cache-control: no-store' -H 'cookie: ikimon_v2_session=deploy-smoke' "https://ikimon.life/app-refresh?to=%2Fmap%3Flang%3Dja%26tab%3Dplaces&deploy_smoke=${EXPECTED_SHA}")"
grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' "${app_refresh_headers}"
for marker in '<title>ikimon app refresh</title>' 'registration.unregister' 'caches.keys' 'URLSearchParams(window.location.search)'; do
  require_contains "${app_refresh}" "${marker}" "PWA app refresh"
done
for marker in 'ページが見つかりません' 'Cloudflare移行中' '互換表示' 'indexedDB.deleteDatabase' 'localStorage.clear'; do
  require_not_contains "${app_refresh}" "${marker}" "PWA app refresh"
done

echo "== Area Sketch and area encyclopedia checks =="
event_headers="${TMP_DIR}/area-sketch.headers"
event_body="$(curl -fsS -D "${event_headers}" -H 'cache-control: no-store' "https://ikimon.life/es/community/events/new?field_id=renri-area-sketch-field&deploy_smoke_area_sketch=${EXPECTED_SHA}")"
grep -qi '^x-ikimon-cloudflare-native: event-page-create' "${event_headers}"
for marker in "Area Sketch Assist" "data-area-sketch-map" "tile.openstreetmap.org" "World_Imagery" "area-sketch-assessments"; do
  require_contains "${event_body}" "${marker}" "Area Sketch event create page"
done
for marker in "Cloudflare移行中" "互換表示"; do
  require_not_contains "${event_body}" "${marker}" "Area Sketch event create page"
done

api_body="${TMP_DIR}/area-sketch-api.json"
api_status="$(curl -sS -o "${api_body}" -w "%{http_code}" -H 'cache-control: no-store' -H 'content-type: application/json' \
  -d '{"sketch_polygon":{"type":"Polygon","coordinates":[[[139.7600,35.6800],[139.7605,35.6800],[139.7605,35.6805],[139.7600,35.6805],[139.7600,35.6800]]]}}' \
  "https://ikimon.life/api/v1/fields/renri-area-sketch-field/area-sketch-assessments?deploy_smoke_area_sketch=${EXPECTED_SHA}")"
if [[ "${api_status}" != "401" ]] || ! grep -q '"login required"' "${api_body}"; then
  echo "Area Sketch unauthenticated write contract changed: status=${api_status} body=$(cat "${api_body}")" >&2
  exit 1
fi

field_headers="${TMP_DIR}/field-detail.headers"
field_body="$(curl -fsS -D "${field_headers}" -H 'cache-control: no-store' "https://ikimon.life/ja/community/fields/1730fc82-95f3-4c64-9c82-4f06d56d940f?deploy_smoke_area_field=${EXPECTED_SHA}")"
grep -qi '^x-ikimon-cloudflare-native: field-detail-readmodel' "${field_headers}"
for marker in "エリア図鑑" "西伊場一条南公園" "このエリアで記録する" "公開範囲を見る" "詳細位置は非公開" "位置をぼかしています" "利用者が作成したエリア"; do
  require_contains "${field_body}" "${marker}" "Area encyclopedia field detail"
done
if grep -Eq 'data-(lat|lng|radius|polygon|area-spots|evt-field-map)=' <<< "${field_body}"; then
  echo "Area encyclopedia field detail leaked exact coordinate or map geometry data attributes." >&2
  exit 1
fi
leaked_token="$(grep -Eo 'D1_ERROR|1101|no such table|Cloudflare移行中|互換表示|user_defined|system_import|unverified|needs_review|geom_simplified|geometry_json' <<< "${field_body}" | sort -u | tr '\n' ' ' || true)"
if [[ -n "${leaked_token}" ]]; then
  echo "Area encyclopedia field detail leaked internal or migration token(s): ${leaked_token}" >&2
  exit 1
fi

echo "== Record materialized shell checks =="
launcher_headers="${TMP_DIR}/record-launcher.headers"
launcher_body="$(curl -fsS -D "${launcher_headers}" -H 'cache-control: no-store' "https://ikimon.life/?deploy_smoke_record=${EXPECTED_SHA}")"
grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' "${launcher_headers}"
for marker in 'class="global-record-launcher"' 'photoDraftRetryDetailId = detailId'; do
  require_contains "${launcher_body}" "${marker}" "Global record launcher"
done
require_not_contains "${launcher_body}" "String(observationJson.occurrenceId || observationId)" "Global record launcher"

for record_url in \
  "https://ikimon.life/record?deploy_smoke_record=${EXPECTED_SHA}" \
  "https://ikimon.life/ja/record?start=note&deploy_smoke_record=${EXPECTED_SHA}"
do
  record_headers="$(mktemp "${TMP_DIR}/record.XXXXXX.headers")"
  record_body="$(curl -fsS -D "${record_headers}" -H 'cache-control: no-store' "${record_url}")"
  grep -qi '^x-ikimon-cloudflare-materialized: original-ui-html' "${record_headers}"
  require_contains "${record_body}" "記録を始める" "Record start guide"
  require_not_contains "${record_body}" 'class="global-record-launcher"' "Record start guide"
done

if [[ "${SMOKE_TIER}" == "full" ]]; then
  echo "== Production observation detail browser smoke =="
  if [[ "${PLAYWRIGHT_INSTALL_WITH_DEPS}" == "true" ]]; then
    npm --prefix "${PLATFORM_DIR}" exec -- playwright install --with-deps chromium
  else
    npm --prefix "${PLATFORM_DIR}" exec -- playwright install chromium
  fi
  OBSERVATION_DETAIL_BASE_URL=https://ikimon.life \
  OBSERVATION_IMAGE_TARGET_COUNT=4 \
    npm --prefix "${PLATFORM_DIR}" run e2e:observation-image-target
  OBSERVATION_DETAIL_BASE_URL=https://ikimon.life \
    npm --prefix "${PLATFORM_DIR}" run e2e:observation-target
else
  echo "== Skip full observation browser smoke for targeted release =="
fi

echo "== Production map data contract checks =="
node <<'NODE'
const expectedSha = process.env.IKIMON_EXPECTED_GIT_SHA || process.env.GITHUB_SHA || String(Date.now());
const obs = await fetch("https://ikimon.life/ja/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&zoom=5&limit=20", {
  headers: { "cache-control": "no-store" }
}).then((response) => response.json());
const withMedia = (obs.items || []).filter((item) => item.photoUrl || item.videoThumbUrl).length;
if (!Array.isArray(obs.items) || obs.items.length === 0 || withMedia === 0) {
  throw new Error(`Map observation media smoke failed: items=${obs.items?.length ?? 0} withMedia=${withMedia}`);
}
for (const ownerPath of ["/api/v1/map/my-observations", "/api/v1/me/map-observations"]) {
  const ownerResponse = await fetch(`https://ikimon.life${ownerPath}`, { headers: { "cache-control": "no-store" } });
  const ownerText = await ownerResponse.text();
  if (!ownerResponse.ok) {
    throw new Error(`Owner map observation guest smoke failed: path=${ownerPath} status=${ownerResponse.status} body=${ownerText.slice(0, 160)}`);
  }
  const ownerPayload = JSON.parse(ownerText);
  if (ownerPayload.signedIn !== false || !Array.isArray(ownerPayload.items) || ownerPayload.items.length !== 0) {
    throw new Error(`Owner map observation guest contract changed: path=${ownerPath} body=${ownerText.slice(0, 160)}`);
  }
}
const areas = await fetch("https://ikimon.life/ja/api/v1/map/area-polygons?bbox=137.55,34.61,137.91,34.85&zoom=12&limit=50", {
  headers: { "cache-control": "no-store" }
}).then((response) => response.json());
const features = areas.features || [];
if (!Array.isArray(features) || areas.type !== "FeatureCollection" || areas.stats?.kind !== "area-polygons") {
  throw new Error(`Map area contract failed: type=${areas.type} featuresArray=${Array.isArray(features)} kind=${areas.stats?.kind}`);
}
const deploySmoke = encodeURIComponent(expectedSha);
const parkFixture = await fetch(`https://ikimon.life/ja/api/v1/map/area-polygons?bbox=137.6940,34.6910,137.7075,34.7010&zoom=17&sources=osm_park&limit=120&deploy_smoke=${deploySmoke}`, {
  headers: { "cache-control": "no-store" }
}).then((response) => response.json());
const parkFeatures = parkFixture.features || [];
const nishiIbaFirstPark = parkFeatures.find((feature) =>
  feature?.properties?.source === "osm_park" &&
  feature?.properties?.entity_key === "osm:way:263321117" &&
  /西伊場第1公園/.test(String(feature?.properties?.name || ""))
);
if (!nishiIbaFirstPark) {
  const names = parkFeatures.map((feature) => feature?.properties?.name).filter(Boolean).slice(0, 12);
  throw new Error(`Map area known fixture failed: 西伊場第1公園 not returned by sources=osm_park, features=${parkFeatures.length}, names=${JSON.stringify(names)}`);
}
const brief = await fetch("https://ikimon.life/ja/api/v1/map/site-brief?lat=34.6942&lng=137.7029&lang=ja", {
  headers: { "cache-control": "no-store" }
}).then((response) => response.json());
const briefText = JSON.stringify(brief);
if (/Cloudflare|互換表示|移行中/.test(briefText)) {
  throw new Error(`Map site brief leaked migration copy: ${briefText}`);
}
console.log(JSON.stringify({
  observations: obs.items.length,
  withMedia,
  areasContractFeatures: features.length,
  nishiIbaFirstPark: nishiIbaFirstPark.properties?.name,
  siteBrief: brief.hypothesis?.label,
}, null, 2));
NODE

echo "Production verification completed for ${EXPECTED_SHA} with smoke_tier=${SMOKE_TIER}."
