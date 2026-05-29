import assert from "node:assert/strict";
import test from "node:test";
import { mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

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
  assert.match(script, /biodiversity_groups/);
  assert.match(script, /function refreshAreaBadgeMarkers/);
  assert.doesNotMatch(script, /recentObservationCount.*me-area-badge/);
});

test("area map labels and side cards expose event and encyclopedia shortcuts", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /areaBadgeEventLabel/);
  assert.match(script, /areaBadgeAlbumLabel/);
  assert.match(script, /観察会/);
  assert.match(script, /エリア図鑑/);
  assert.match(script, /me-area-badge-actions/);
  assert.match(script, /function renderAreaPrimaryActions\(fieldId, sourceLinksHtml, sourceTrustHtml\)/);
  assert.match(script, /me-area-primary-actions/);
  assert.match(script, /eventsNewHrefTemplate\.replace\('__FIELD_ID__', encodeURIComponent\(fieldId\)\)/);
  assert.match(script, /FIELDS_ALBUM_TPL\.replace\('__FIELD_ID__', encodeURIComponent\(fieldId\)\)/);
  assert.match(script, /return heroHtml \+ primaryActionsHtml \+ positiveHtml/);
  assert.match(script, /event\.stopPropagation\(\);/);
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

  assert.match(script, /show\(areaLayers, tab === 'markers' \|\| tab === 'heatmap' \|\| tab === 'places'\);/);
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

test("map explorer exposes visited place shortcuts and a clickable side collapse control", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /id="me-visited-panel"/);
  assert.match(html, /data-api-my-places="\/api\/v1\/map\/my-places"/);
  assert.match(script, /function loadVisitedPlaces\(force\)/);
  assert.match(script, /function jumpToVisitedPlace\(place\)/);
  assert.match(script, /sort='\s\+ encodeURIComponent\(state\.visitedPlacesSort\)/);
  assert.match(script, /最近/);
  assert.match(script, /よく行く/);
  assert.match(script, /季節で再訪/);
  assert.match(script, /function buildPlaceMemoryRecordHref\(place\)/);
  assert.match(script, /revisitObservationId/);
  assert.match(script, /setSideRailMode\(false\);/);
  assert.match(script, /行った場所へ/);
});
