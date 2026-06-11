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

test("selected place and cell details replace static story with site brief", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const selectedPlaceBody = script.slice(
    script.indexOf("if (context.kind === 'place')"),
    script.indexOf("if (context.kind === 'cell')"),
  );
  const selectedCellBody = script.slice(
    script.indexOf("if (context.kind === 'cell')"),
    script.indexOf("var record = context.record"),
  );
  const openCellBody = script.slice(
    script.indexOf("function openCellSheet"),
    script.indexOf("function buildPlaceMemoryRecordHref"),
  );
  const openPlaceBody = script.slice(
    script.indexOf("function openPlaceSheet"),
    script.indexOf("function isTransientAreaFeature"),
  );

  assert.match(script, /function renderSiteBriefSlot\(slotId, context\)/);
  assert.match(selectedPlaceBody, /renderSiteBriefSlot\('me-selected-brief-slot', context\)/);
  assert.match(selectedCellBody, /renderSiteBriefSlot\('me-selected-brief-slot', context\)/);
  assert.match(openCellBody, /renderSiteBriefSlot\('me-site-brief-slot', detailContext\)/);
  assert.match(openPlaceBody, /renderSiteBriefSlot\('me-site-brief-slot', detailContext\)/);
  assert.doesNotMatch(openPlaceBody, /renderDetailVisitReasons\(detailContext\)[\s\S]{0,500}me-site-brief-slot/);
  assert.match(script, /data-brief-fallback/);
  assert.match(script, /target\.removeAttribute\('data-brief-fallback'\)/);
});

test("public place actions prioritize area circulation over personal record CTA", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const actionBody = script.slice(
    script.indexOf("function renderPlaceDetailActions"),
    script.indexOf("function renderSelectedCard"),
  );

  assert.match(actionBody, /COPY\.areaEventCreateLabel/);
  assert.match(actionBody, /COPY\.areaPublicPageLabel/);
  assert.match(actionBody, /COPY\.placeActionNearby/);
  assert.match(actionBody, /nearbyHref/);
  assert.doesNotMatch(actionBody, /COPY\.placeActionRecord/);
});

test("mobile place detail peek keeps the map visible", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\]\s*\{\s*height: min\(35dvh, 320px\);\s*max-height: min\(35dvh, 320px\);/);
  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\] \.me-detail-visit div:nth-child\(n\+2\)/);
  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\] \.me-site-brief-head/);
  assert.match(styles, /\.me-bottom-detail \.me-detail-hero\.me-detail-hero-compact\s*\{\s*min-height: 92px;/);
  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\] \.me-detail-action-icon/);
  assert.match(styles, /\.me-detail-hero-compact \.me-detail-hero-copy/);
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
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /me-area-badge-marker/);
  assert.match(script, /biodiversity_groups/);
  assert.match(script, /function refreshAreaBadgeMarkers/);
  assert.match(script, /function areaBadgeCountLabel\(item\)/);
  assert.match(script, /me-area-badge-pill/);
  assert.doesNotMatch(script, /recentObservationCount.*me-area-badge/);
  assert.match(styles, /\.me-area-badge-pill/);
  assert.match(styles, /\.me-area-badge-marker:hover \.me-area-badge-actions/);
});

test("guide-enabled areas advertise guide availability before tapping the area", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /areaBadgeGuideLabel/);
  assert.match(script, /state\.tab !== 'places' && state\.tab !== 'markers'/);
  assert.match(script, /var guideStop = areaGuideStopFrom/);
  assert.match(script, /if \(item\.guideStop\) return true;/);
  assert.match(script, /me-area-badge-chip-guide/);
  assert.match(script, /has-guide-stop/);
  assert.match(script, /ガイド/);
});

test("guide map badges stay compact at low zoom or high density", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /GUIDE_BADGE_LABEL_ZOOM = 12\.6/);
  assert.match(script, /GUIDE_BADGE_FULL_ZOOM = 13\.4/);
  assert.match(script, /GUIDE_BADGE_DENSE_LIMIT = 8/);
  assert.match(script, /guideBadgeCount = features\.filter/);
  assert.match(script, /zoom < GUIDE_BADGE_LABEL_ZOOM \|\| guideBadgeCount > GUIDE_BADGE_DENSE_LIMIT/);
  assert.match(script, /is-guide-pin/);
  assert.match(script, /is-guide-compact/);
  assert.match(script, /me-guide-dot/);
  assert.match(script, /title="' \+ escapeHtml\(name \+ ' ' \+ COPY\.areaBadgeGuideLabel\)/);
  assert.match(styles, /me-area-badge-marker\.is-guide-pin/);
  assert.match(styles, /me-area-badge-marker\.is-guide-compact/);
  assert.match(styles, /me-guide-dot/);
});

test("map guide spots render independently from area polygons", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /data-api-guide-spots="\/api\/v1\/map\/guide-spots"/);
  assert.match(script, /function loadGuideSpots\(\)/);
  assert.match(script, /openGuideSpotSheet\(feature\)/);
  assert.match(script, /openGuideSpotGroupSheet\(features\)/);
  assert.match(script, /kind: 'guide_spot'/);
  assert.match(script, /renderGuideSourceLinks/);
  assert.match(script, /groupGuideSpotFeatures/);
  assert.match(script, /guideSpotClusterKey/);
  assert.match(script, /GUIDE_SPOT_LABEL_ZOOM = 12\.6/);
  assert.match(script, /GUIDE_SPOT_DENSE_LIMIT = 10/);
  assert.match(script, /guideSpotCount > GUIDE_SPOT_DENSE_LIMIT/);
  assert.match(script, /is-pin/);
  assert.match(styles, /me-guide-spot-marker/);
  assert.match(styles, /me-guide-spot-marker\.is-cluster/);
  assert.doesNotMatch(script, /あと __DISTANCE__|formatGuideDistance|radius \+ 'm'/);
});

test("map legend stays within the map viewport", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /max-width: min\(520px, calc\(100% - 24px\)\)/);
  assert.match(styles, /flex-wrap: wrap/);
  assert.match(styles, /#me-legend-low,\s+#me-legend-high/);
  assert.match(styles, /overflow-wrap: anywhere/);
});

test("layer tabs expose low-zoom guidance and a visible-layer jump", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /id="me-layer-hint"/);
  assert.match(html, /id="me-layer-hint-jump"[^>]*>見える場所へ<\/button>/);
  assert.match(html, /aria-label="閉じる"/);
  assert.match(script, /function layerHintInfo\(tab\)/);
  assert.match(script, /ズームするとエリア図鑑の範囲が見えます。/);
  assert.match(script, /ズームすると記録の余白が面で見えます。/);
  assert.match(script, /ズームすると季節の気配の濃淡が見えます。/);
  assert.match(script, /maybeShowLayerHint\(state\.tab\);/);
  assert.match(script, /function jumpToVisibleLayer\(tab\)/);
  assert.match(script, /fallbackRegionBounds/);
  assert.match(script, /layerHintJumpEl\.addEventListener\('click'/);
  assert.match(styles, /\.me-layer-hint \{/);
  assert.match(styles, /\.me-layer-hint\.is-hidden \{ display: none; \}/);
  assert.match(styles, /\.me-layer-hint-jump \{/);
});

test("result side panel groups dense records by date and normalizes candidate labels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /function friendlyTaxonLabel\(label\)/);
  assert.match(script, /Chloris: 'カワラヒワ属'/);
  assert.match(script, /Monticola: 'イソヒヨドリ属'/);
  assert.match(script, /function groupResultRecords\(records\)/);
  assert.match(script, /me-result-group-head/);
  assert.match(script, /COPY\.resultGroupedByDate/);
  assert.match(script, /renderResultBadges\(record\)/);
  assert.match(script, /width="64" height="64"/);
  const resultListBody = script.slice(
    script.indexOf("function renderResultList()"),
    script.indexOf("function clearDiscoveryPreviewMarkers()"),
  );
  assert.doesNotMatch(resultListBody, /'<span>' \+ escapeHtml\(record\.localityLabel/);
  assert.match(styles, /\.me-result-group \{/);
  assert.match(styles, /grid-template-columns: 64px minmax\(0,1fr\)/);
  assert.match(styles, /\.me-result-badges/);
});

test("unified search separates current-area and other-area results", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /searchGroupCurrent/);
  assert.match(script, /searchGroupOther/);
  assert.match(script, /function groupSearchRows\(localRows, placeRows\)/);
  assert.match(script, /function placeRowInCurrentBounds\(row\)/);
  assert.match(script, /function placeTypeLabel\(type\)/);
  assert.match(script, /attraction: '名所'/);
  assert.match(script, /artwork: '作品'/);
  assert.match(script, /COPY\.searchRecentPrefix/);
  assert.match(script, /Number\(btn\.getAttribute\('data-idx'\)\)/);
  assert.match(styles, /\.me-search-group-heading/);
});

test("frontier and heatmap layers gain stronger zoom-sensitive visual feedback", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /id: fillId,\s+type: 'fill',\s+source: sourceId,\s+minzoom: 8,/);
  assert.match(script, /'blank', 'rgba\(100,116,139,0\.30\)'/);
  assert.match(script, /'repeatable', 'rgba\(20,184,166,0\.38\)'/);
  assert.match(script, /'fill-outline-color': 'rgba\(15,118,110,0\.30\)'/);
  assert.match(script, /'fill-opacity': \[\s+'interpolate', \['linear'\], \['zoom'\],\s+5, \['interpolate'/);
  assert.match(script, /10, \['interpolate', \['linear'\], \['coalesce', \['get', 'count'\], 0\]/);
  assert.match(script, /14, \['interpolate', \['linear'\], \['coalesce', \['get', 'count'\], 0\]/);
});

test("area badge clicks reopen the side panel before showing selection", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const openAreaSheetBody = script.slice(script.indexOf("function openAreaSheet("), script.indexOf("function applyAreaSnapshot"));

  assert.match(script, /openAreaFeatureSheet\(item\.feature, item\.center\.lat, item\.center\.lng\)/);
  assert.match(openAreaSheetBody, /setSideRailMode\(false\);\s+renderSelectedCard\(\);\s+renderSidePanels\(\);\s+setSideTab\('selection'\);/);
});

test("area map labels and side cards expose event and encyclopedia shortcuts", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /areaBadgeEventLabel/);
  assert.match(script, /areaBadgeAlbumLabel/);
  assert.match(script, /観察会/);
  assert.match(script, /エリア図鑑/);
  assert.match(script, /me-area-badge-actions/);
  assert.match(script, /me-area-badge-pill/);
  assert.match(script, /function renderAreaPrimaryActions\(fieldId, sourceLinksHtml, sourceTrustHtml\)/);
  assert.match(script, /me-area-primary-actions/);
  assert.match(script, /eventsNewHrefTemplate\.replace\('__FIELD_ID__', encodeURIComponent\(fieldId\)\)/);
  assert.match(script, /FIELDS_ALBUM_TPL\.replace\('__FIELD_ID__', encodeURIComponent\(fieldId\)\)/);
  assert.match(script, /return heroHtml \+ primaryActionsHtml \+ positiveHtml/);
  assert.match(script, /event\.stopPropagation\(\);/);
  assert.match(styles, /\.me-area-badge-marker:hover \.me-area-badge-chips/);
  assert.match(styles, /\.me-area-badge-marker:focus-within \.me-area-badge-actions/);
});

test("area sheet exposes on-site guide stops with geolocation-gated playback", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function renderAreaGuideStop\(source, center\)/);
  assert.match(script, /guide_stop_json/);
  assert.match(script, /data-area-guide-stop/);
  assert.match(script, /現地ガイド/);
  assert.match(script, /近づくと聞けます/);
  assert.match(script, /この場所で聞く/);
  assert.match(script, /watchPosition/);
  assert.match(script, /new window\.Audio\(stop\.audio_url\)/);
  assert.match(script, /data-guide-lang-option/);
  assert.match(script, /GUIDE_LANG_ORDER = \['ja', 'en', 'zh-TW', 'zh-CN'\]/);
  assert.match(script, /SpeechSynthesisUtterance/);
  assert.match(script, /hydrateAreaGuideStopControls\(sheetInnerEl\)/);
  assert.match(script, /return heroHtml \+ primaryActionsHtml \+ positiveHtml \+ guideStopHtml/);
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
