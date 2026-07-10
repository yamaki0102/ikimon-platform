import assert from "node:assert/strict";
import test from "node:test";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

test("area polygon outline width avoids MapLibre-incompatible zoom composites", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const outlineStart = script.indexOf("id: 'area-polygon-outline'");
  const selectedStart = script.indexOf("id: 'area-polygon-selected'", outlineStart);
  const outlineScript = script.slice(outlineStart, selectedStart);

  assert.match(
    outlineScript,
    /'line-width': \[\s+'case',\s+\['in', \['get', 'verification_level'\]/,
  );
  assert.doesNotMatch(
    outlineScript,
    /\['zoom'\]/,
  );
});

test("map explorer localizes English fallback and failure chrome", () => {
  const html = renderMapExplorer({ basePath: "", lang: "en", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "en" });

  assert.match(html, /aria-label="Expand details"/);
  assert.match(script, /Could not load the map library/);
  assert.match(script, /Map-selected point/);
  assert.match(script, /OSM park or green space/);
  assert.match(script, /A place the map alone cannot explain/);
  assert.match(script, /Needs name/);
  assert.match(script, /AI candidate/);
  assert.match(script, /SEARCH_LANG === 'ja' \? 'ja' : 'en'/);
  assert.doesNotMatch(script, /地図ライブラリを読み込めませんでした/);
  assert.doesNotMatch(script, /地図で選んだ地点/);
  assert.doesNotMatch(script, /OSMの公園・緑地/);
  assert.doesNotMatch(script, /エリア情報を読み込み中/);
  assert.doesNotMatch(script, /AI候補/);
  assert.doesNotMatch(html, /詳細を広げる/);
});

test("area sheet includes contribution feedback surface", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function renderAreaPositiveFeedback/);
  assert.match(script, /viewerContribution/);
  assert.match(script, /communityPerspective/);
  assert.match(script, /overlapInsight/);
  assert.match(script, /あなたの視点/);
  assert.match(script, /あなたのおかげで/);
  assert.match(script, /みんなの視点/);
  assert.match(script, /重なると見えること/);
  assert.match(script, /記録の手応え/);
  assert.match(script, /自分の記録を見返す/);
});

test("area biodiversity badges render as presence-only map markers", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /me-area-badge-marker/);
  assert.match(script, /me-area-badge-dot/);
  assert.match(script, /biodiversity_groups/);
  assert.match(script, /function refreshAreaBadgeMarkers/);
  assert.doesNotMatch(script, /recentObservationCount.*me-area-badge/);
  assert.doesNotMatch(script, /me-area-badge-actions/);
});

test("map explorer keeps the regional field guide chrome out of the map surface", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /近くを見る・振り返る/);
  assert.match(html, /地域図鑑の主役ではなく、記録を場所から見返す道具/);
  assert.match(html, /data-side="rail"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /このエリアの活動・ラリー/);
  assert.doesNotMatch(html, /data-testid="map-activity-rally-panel"/);
  assert.doesNotMatch(html, /data-events-new-href/);
  assert.doesNotMatch(script, /このエリアの活動・ラリー/);
});

test("map explorer follows the shared shell header instead of restyling it", () => {
  assert.doesNotMatch(MAP_EXPLORER_STYLES, /\.site-header(?:\s|\.|:|\{)/);
  assert.doesNotMatch(MAP_EXPLORER_STYLES, /\.site-header-inner/);
  assert.match(MAP_EXPLORER_STYLES, /--me-header-h:\s*var\(--ikimon-header-height, 64px\);/);
});

test("default map surface uses a simple road water green style with place labels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /url: 'https:\/\/tiles\.openfreemap\.org\/planet'/);
  assert.match(script, /glyphs: 'https:\/\/tiles\.openfreemap\.org\/fonts\/\{fontstack\}\/\{range\}\.pbf'/);
  assert.match(script, /id: 'simple-water'/);
  assert.match(script, /id: 'simple-park'/);
  assert.match(script, /id: 'simple-road-major'/);
  assert.match(script, /id: 'simple-road-local'/);
  assert.match(script, /id: 'simple-landmark-dot'/);
  assert.match(script, /id: 'simple-civic-dot'/);
  assert.match(script, /id: 'simple-commercial-dot'/);
  assert.match(script, /id: 'simple-place-label'/);
  assert.match(script, /id: 'simple-landmark-label'/);
  assert.match(script, /id: 'simple-civic-label'/);
  assert.match(script, /id: 'simple-commercial-label'/);
  assert.match(script, /id: 'simple-park-name'/);
  assert.match(script, /id: 'simple-water-name'/);
  assert.match(script, /id: 'simple-road-name-major'/);
  assert.match(script, /'source-layer': 'transportation'/);
  assert.match(script, /'source-layer': 'landcover'/);
  assert.match(script, /'source-layer': 'place'/);
  assert.match(script, /'source-layer': 'poi'/);
  assert.match(script, /'source-layer': 'transportation_name'/);
  assert.match(script, /'source-layer': 'water_name'/);
  assert.match(script, /\['coalesce', \['get', 'name:ja'\], \['get', 'name'\]\]/);
  assert.match(script, /var SIMPLE_MID_LANDMARK_CLASSES = \['school', 'kindergarten', 'college', 'university', 'park', 'garden', 'playground'\]/);
  assert.match(script, /var SIMPLE_HIGH_LANDMARK_CLASSES = \['railway', 'town_hall', 'library', 'hospital'\]/);
  assert.match(script, /var SIMPLE_COMMERCIAL_LANDMARK_CLASSES = \['shop', 'grocery', 'cafe', 'restaurant'\]/);
  assert.match(script, /filter: \['match', \['get', 'class'\], SIMPLE_MID_LANDMARK_CLASSES, true, false\]/);
  assert.match(script, /filter: \['match', \['get', 'class'\], SIMPLE_HIGH_LANDMARK_CLASSES, true, false\]/);
  assert.match(script, /filter: \['match', \['get', 'class'\], SIMPLE_COMMERCIAL_LANDMARK_CLASSES, true, false\]/);
  assert.match(script, /id: 'simple-place-label'[\s\S]*?maxzoom: 15\.25/);
  assert.match(script, /id: 'simple-landmark-label'[\s\S]*?minzoom: 13/);
  assert.match(script, /id: 'simple-civic-label'[\s\S]*?minzoom: 16/);
  assert.match(script, /id: 'simple-commercial-label'[\s\S]*?minzoom: 15\.2/);
  assert.match(script, /id: 'simple-park-name'[\s\S]*?minzoom: 13/);
  assert.doesNotMatch(script, /'source-layer': 'building'/);
  assert.doesNotMatch(script, /'post'/);
  assert.match(script, /var markerLayers = \['observation-cell-fill', 'observation-cell-bloom', 'observation-cell-dot', 'observation-cell-selected'\]/);
  assert.match(script, /var markerDetailLayers = \['observation-cell-outline', 'observation-cell-count', 'observation-cell-label'\]/);
  assert.match(script, /show\(markerDetailLayers, tab === 'markers'\);/);
  assert.match(script, /show\(areaLayers, tab === 'heatmap' \|\| tab === 'places'\);/);
  assert.match(script, /'circle-opacity': 0\.62/);
  assert.doesNotMatch(script, /show\(areaLayers, tab === 'markers'/);
});

test("map explorer distinguishes viewer exact points from public grid records", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /viewer-owned-observations/);
  assert.match(script, /viewer-owned-observation-dot/);
  assert.match(script, /record\.isViewerOwned && Number\.isFinite\(exactLat\)/);
  assert.match(script, /record\.isViewerOwned \? ' is-exact' : ' is-grid'/);
  assert.match(script, /メッシュ内/);
  assert.match(script, /正確/);
  assert.match(script, /Math\.max\(state\.map\.getZoom\(\), 15\)/);
});

test("map explorer increases discovery cards after zooming in", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var maxCards = zoom >= 16 \? 30 : zoom >= 15 \? 22 : 12;/);
  assert.doesNotMatch(script, /picked\.length >= 12 \|\| !record\.cellId/);
});

test("map explorer shows the map role without taking over the atlas subject", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });

  assert.match(html, /class="me-enjoy-strip"/);
  assert.doesNotMatch(html, /class="me-enjoy-strip"[^>]*hidden/);
  assert.match(html, /近くを見る・振り返る/);
  assert.match(html, /地域図鑑の主役ではなく、記録を場所から見返す道具/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-enjoy-strip > span \{[\s\S]*display:\s*block;/);
});

test("map explorer hides migration jargon and unidentified placeholders from public copy", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function publicBriefText/);
  assert.match(script, /Cloudflare\|互換表示\|移行中/);
  assert.match(script, /unidentified/);
  assert.match(script, /return fallback \|\| COPY\.awaitingIdLabel/);
});

test("area biodiversity badges stay compact and open details before actions", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /areaBadgeToneClass/);
  assert.match(script, /me-area-badge-dot/);
  assert.match(script, /openAreaFeatureSheet\(item\.feature, item\.center\.lat, item\.center\.lng\);/);
  assert.doesNotMatch(script, /areaBadgeEventLabel/);
  assert.doesNotMatch(script, /areaBadgeAlbumLabel/);
  assert.doesNotMatch(script, /me-area-badge-actions/);
  assert.doesNotMatch(script, /EVENTS_ORGANIZER_HREF/);
  assert.doesNotMatch(script, /\/community\/events\/new/);
});

test("map viewport movement refreshes stale result panels automatically", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /viewportRefreshTimer: null/);
  assert.match(script, /function refreshViewportSearchData\(\)/);
  assert.match(script, /function scheduleViewportRefresh\(\)/);
  assert.match(script, /scheduleViewportRefresh\(\);\s+refreshDiscoveryPreviewMarkers/);
  assert.match(script, /searchAreaBtnEl\.addEventListener\('click', function \(\) \{\s+refreshViewportSearchData\(\);/);
});

test("map opens near current location instead of restoring stale local viewport", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function applyRestoredParams\(params, options\)/);
  assert.match(script, /var restoreViewport = !options \|\| options\.restoreViewport !== false;/);
  assert.match(script, /params = parseStateString\(localStorage\.getItem\(STATE_STORAGE_KEY\) \|\| ''\);[\s\S]*restoreViewport = false;/);
  assert.match(script, /applyRestoredParams\(params, \{ restoreViewport: restoreViewport \}\);/);
  assert.match(script, /if \(restoreViewport && params\.lng && params\.lat && params\.z\)/);
  assert.match(script, /if \(state\._restoredCenter \|\| state\._restoredCellId\) return;/);
});

test("heatmap tab keeps area polygons selectable", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /show\(areaLayers, tab === 'heatmap' \|\| tab === 'places'\);/);
});

test("heatmap area filters keep osm parks as selectable anchors", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function areaSourcesQueryValueForMap\(\)/);
  assert.match(script, /state\.tab === 'heatmap' && sources\.length && sources\.indexOf\('osm_park'\) < 0/);
  assert.match(script, /sources\.push\('osm_park'\);/);
  assert.match(script, /var selectedSources = areaSourcesQueryValueForMap\(\);/);
});

test("observation cell clicks are not swallowed by administrative area polygons", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function pickConcreteAreaHit\(areaHits\)/);
  assert.match(script, /isAdministrativeAreaFeature\(feature\)/);
  assert.match(script, /source === 'admin_municipality' \|\| source === 'admin_prefecture' \|\| source === 'admin_country'/);
  assert.match(script, /showCellAreaChoice\(selectedFeature, pick, e\.lngLat, \{ focusMap: false, openSheet: true \}\);/);
  assert.doesNotMatch(script, /var pick = areaHits\[0\];[\s\S]{0,500}openAreaFeatureSheet\(pick, e\.lngLat\.lat, e\.lngLat\.lng\);/);
});

test("overlapping observation cells and concrete areas show an explicit chooser", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function showCellAreaChoice\(cellFeature, areaFeature, lngLat, options\)/);
  assert.match(script, /me-overlap-choice/);
  assert.match(script, /どちらを開く？/);
  assert.match(script, /四角を選ぶ/);
  assert.match(script, /エリアを開く/);
  assert.match(script, /selectCell\(cellFeature, options \|\| \{\}\);/);
  assert.match(script, /openAreaFeatureSheet\(areaFeature, lngLat\.lat, lngLat\.lng\);/);
});

test("small area outlines have a stable click hitbox across zoom levels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /id: 'area-polygon-hitbox'/);
  assert.match(script, /'line-width': 14/);
  assert.match(script, /function areaPolygonHitLayers\(\)/);
  assert.match(script, /'area-polygon-hitbox', 'area-polygon-fill', 'area-polygon-outline', 'area-polygon-selected'/);
  assert.match(script, /\['area-polygon-fill', 'area-polygon-outline', 'area-polygon-hitbox'\]\.forEach/);
  assert.match(script, /map\.queryRenderedFeatures\(e\.point, \{ layers: hitLayers \}\)/);
});

test("map explorer omits visited place shortcuts while keeping side collapse control", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.doesNotMatch(html, /id="me-visited-panel"/);
  assert.doesNotMatch(html, /data-api-my-places/);
  assert.doesNotMatch(script, /function loadVisitedPlaces\(force\)/);
  assert.doesNotMatch(script, /function jumpToVisitedPlace\(place\)/);
  assert.doesNotMatch(script, /sort='\s\+ encodeURIComponent\(state\.visitedPlacesSort\)/);
  assert.doesNotMatch(script, /よく行く/);
  assert.doesNotMatch(script, /季節で再訪/);
  assert.doesNotMatch(script, /行った場所へ/);
  assert.doesNotMatch(script, /記録すると、ここに再訪先が出ます。/);
  assert.match(script, /function buildPlaceMemoryRecordHref\(place\)/);
  assert.match(script, /revisitObservationId/);
  assert.match(html, /id="me-side-toggle"/);
  assert.match(script, /function setSideRailMode\(rail\)/);
  assert.match(script, /setSideRailMode\(nowRail\);/);
});
