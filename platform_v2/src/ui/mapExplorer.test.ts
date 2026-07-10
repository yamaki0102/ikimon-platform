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

test("map home opens as a regional encyclopedia instead of a raw point finder", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /地域図鑑マップ/);
  assert.match(html, /この範囲の地域図鑑/);
  assert.match(html, /記録は地域単位で集計しています/);
  assert.match(html, /余白 = これから育つ場所/);
  assert.match(html, /色 = 季節と記録の厚み/);
  assert.match(html, /面 = 場所ページ・エリア図鑑/);
  assert.match(html, /class="me-tab is-active" role="tab" aria-selected="true" data-tab="places"/);
  assert.doesNotMatch(html, /class="me-tab is-active" role="tab" aria-selected="true" data-tab="markers"/);
  assert.match(script, /tab: 'places'/);
});

test("area sheets gate contribution CTAs behind public access evidence", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function isSchoolArea\(area\)/);
  assert.match(script, /幼稚園\|保育園\|こども園\|学園/);
  assert.match(script, /function areaAccessStatus\(area, masking\)/);
  assert.match(script, /function canSuggestAreaEvent\(area, masking\)/);
  assert.match(script, /return areaAccessStatus\(area, masking\) === 'public_access';/);
  assert.match(script, /function canSuggestDirectAreaRecord\(area, masking\)/);
  assert.match(script, /function renderRestrictedAreaAction\(\)/);
  assert.match(script, /COPY\.areaSchoolNotice/);
  assert.match(script, /var canEvent = canSuggestAreaEvent\(f, masking\);/);
  assert.match(script, /var canRecord = canSuggestDirectAreaRecord\(f, masking\);/);
  assert.match(
    script,
    /return heroHtml \+ accessHtml \+ maskingHtml \+ safetyNoticeHtml \+ followHtml \+ publicPageHtml \+ ctaHtml/,
  );
  assert.match(
    script,
    /renderAreaObservationGallery\(gallery, \{ label: COPY\.areaGalleryTitle, canRecord: canRecord \}\)/,
  );
});

test("mobile map status clears the default area legend", () => {
  assert.match(
    MAP_EXPLORER_STYLES,
    /@media \(max-width: 900px\)[\s\S]*\.me-map-status \{[\s\S]*bottom: 96px;/,
  );
});

test("cell and blank map selections are aggregate and safety surfaces", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /title: COPY\.cellAggregateTitle/);
  assert.match(script, /badge: COPY\.cellAggregateBadge/);
  assert.match(script, /renderAggregateSafety\(COPY\.cellAggregateSafety\)/);
  assert.match(script, /renderDetailHero\(\{ title: COPY\.selectedPointName, meta: '', badge: COPY\.selectionPlaceLabel \}\)/);
  assert.match(script, /renderAggregateSafety\(COPY\.mapPointSafety\)/);
  assert.doesNotMatch(script, /buildPointAreaEventHref/);
  assert.doesNotMatch(script, /source: 'map_point_area'/);
  assert.doesNotMatch(script, /FIELDS_NEW_BASE/);
  assert.doesNotMatch(script, /title: COPY\.selectedPointName, meta: coordLabel/);
  assert.doesNotMatch(script, /title: COPY\.cellAggregateTitle, meta: coordLabel/);
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
