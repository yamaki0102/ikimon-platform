import assert from "node:assert/strict";
import test from "node:test";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

test("area polygon outline width avoids MapLibre-incompatible zoom composites", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const outlineStart = script.indexOf("id: 'area-polygon-outline'");
  const approximateStart = script.indexOf("id: 'area-polygon-approximate-outline'", outlineStart);
  const outlineScript = script.slice(outlineStart, approximateStart);

  assert.match(
    outlineScript,
    /'line-width': \[\s+'case',\s+\['in', \['get', 'verification_level'\]/,
  );
  assert.doesNotMatch(
    outlineScript,
    /\['zoom'\]/,
  );
});

test("approximate school area boundaries get a separate dashed outline layer", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /id: 'area-polygon-approximate-outline'/);
  assert.match(script, /filter: \['all', \['==', \['get', 'approximate_boundary'\], true\], VISIBLE_AREA_POLYGON_FILTER\]/);
  assert.match(script, /'line-dasharray': \[2, 1\.4\]/);
  assert.match(script, /area-polygon-approximate-outline/);
});

test("collapsed side rail uses a nonnumeric area signal", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const railMatch = html.match(/<div class="me-side-rail-icons"[^>]*>([\s\S]*?)<\/div>/);

  assert.ok(railMatch);
  const railBody = railMatch[1] || "";
  assert.doesNotMatch(html, /\u{1F4CB}/u);
  assert.match(html, /me-side-rail-mark/);
  assert.match(html, /me-side-rail-signal/);
  assert.doesNotMatch(railBody, />\s*\d+\s*</);
  assert.doesNotMatch(railBody, />\s*\u2014\s*</);
  assert.match(script, /SIDE_RAIL_SIGNAL_MIN_RECORDS = 6/);
  assert.match(script, /SIDE_RAIL_SIGNAL_MAX_ZOOM = 14/);
  assert.match(script, /function updateSideRailSignal\(records\)/);
  assert.doesNotMatch(script, /sideRailCountEl\.textContent/);
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
  assert.match(script, /data-brief-fallback/);
  assert.match(script, /target\.removeAttribute\('data-brief-fallback'\)/);
});

test("public place actions avoid raw coordinate area creation", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const actionBody = script.slice(
    script.indexOf("function renderPlaceDetailActions"),
    script.indexOf("function renderSelectedCard"),
  );

  assert.match(actionBody, /COPY\.areaSafeRecordLabel/);
  assert.match(actionBody, /COPY\.placeActionGuide/);
  assert.match(actionBody, /COPY\.bottomSheetNotes/);
  assert.doesNotMatch(actionBody, /FIELDS_NEW_BASE/);
  assert.doesNotMatch(actionBody, /source: 'map_point_area'/);
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

test("mobile area sheet opens as a draggable peek instead of a tiny bottom sliver", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /function showAreaBottomSheet\(\)/);
  assert.match(script, /setAreaSheetSnap\('peek'\)/);
  assert.match(script, /function sheetSupportsSnap\(\)/);
  assert.match(script, /toggleSheetSnap\(\)/);
  assert.match(script, /if \(!sheetSupportsSnap\(\)\) return;\s+sheetDragStartY = event\.clientY;/);
  assert.match(styles, /\.me-bottom-sheet--detail \.me-bottom-grip,\s+\.me-bottom-sheet--area \.me-bottom-grip/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-bottom-sheet \{[\s\S]*position: fixed;/);
  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\]\s*\{\s*height: 35vh;\s*max-height: 35vh;\s*height: min\(35dvh, 320px\);/);
  assert.match(styles, /\.me-bottom-sheet\.me-bottom-sheet--area\[data-snap="peek"\]\s*\{\s*height: 58vh;\s*max-height: 58vh;\s*height: min\(58dvh, calc\(100dvh - var\(--me-header-h\) - 100px\), 460px\);/);
  assert.match(styles, /\.me-bottom-sheet\.me-bottom-sheet--area\[data-snap="full"\]\s*\{\s*height: auto;\s*max-height: calc\(100% - 8px\);\s*max-height: calc\(100dvh - var\(--me-header-h\) - 96px\);/);
});

test("map home opens as a regional encyclopedia instead of a raw point finder", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /地域図鑑マップ/);
  assert.match(html, /この範囲の地域図鑑/);
  assert.match(html, /記録は地域単位で集計しています/);
  assert.doesNotMatch(html, /余白 = これから育つ場所/);
  assert.doesNotMatch(html, /色 = 季節と記録の厚み/);
  assert.doesNotMatch(html, /面 = 場所ページ・エリア図鑑/);
  assert.doesNotMatch(html, /class="me-map-cues"/);
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
  assert.match(script, /function renderAreaNextStepCard\(options\)/);
  assert.match(script, /COPY\.areaNextStepRestrictedLine/);
  assert.match(script, /COPY\.areaSchoolNotice/);
  assert.match(script, /var canRecord = canSuggestDirectAreaRecord\(f, masking\);/);
  assert.match(script, /var accessStatus = areaAccessStatus\(f, masking\);/);
  assert.match(script, /function renderAreaPrimaryActions\(fieldId, sourceLinksHtml, sourceTrustHtml, canSuggestEvent\)/);
  assert.match(script, /if \(canSuggestEvent === false \|\| !eventHref\) \{\s+return metaHtml;/);
  assert.match(script, /var nextStepHtml = renderAreaNextStepCard\(\{/);
  assert.match(script, /var followHtml = canRecord \? renderAreaFollowButton/);
  assert.match(script, /var primaryActionsHtml = renderAreaPrimaryActions\(fieldId, sourceLinksHtml, sourceTrustHtml, canRecord\);/);
  assert.match(script, /var activityHtml = canRecord\s+\? renderAreaActivityRallyPanel/);
  assert.match(script, /: metaHtml;/);
  assert.match(
    script,
    /return heroHtml \+ accessHtml \+ maskingHtml \+ safetyNoticeHtml \+ nextStepHtml \+ primaryActionsHtml \+ positiveHtml \+ guideStopHtml \+ followHtml \+ publicPageHtml/,
  );
  assert.match(
    script,
    /renderAreaObservationGallery\(gallery, \{ label: COPY\.areaGalleryTitle, canRecord: canRecord, areaStatus: accessStatus \}\)/,
  );
  assert.match(
    script,
    /renderAreaObservationGallery\(galleryItems, \{ label: COPY\.areaGalleryTitle, canRecord: canRecord, areaStatus: areaStatus \}\)/,
  );
  assert.match(script, /function widenAreaEmptyState\(\)/);
  assert.match(script, /data-area-empty-widen/);
  assert.match(script, /COPY\.areaGalleryEmptyPublicLead/);
  assert.match(script, /COPY\.areaGalleryEmptyRestrictedLead/);
  assert.match(script, /COPY\.areaGalleryEmptySchoolLead/);
  assert.match(script, /COPY\.areaGalleryEmptyPublicSafety/);
  assert.match(script, /isSchool \? COPY\.areaSchoolNotice : COPY\.areaRestrictedActionHint/);
  assert.match(script, /canRecord\s+\?\s+'<a class="me-area-gallery-empty-action is-primary"/);
  assert.match(script, /: '<span class="me-area-gallery-empty-action is-safety">/);
});

test("area gallery empty state is localized without leaking Japanese guidance", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "en" });

  assert.match(script, /No records yet\. If the public scope and on-site rules are clear/);
  assert.match(script, /For safety and privacy, direct recording is not offered for this area/);
  assert.match(script, /Near schools or educational facilities, do not photograph or search around the site/);
  assert.doesNotMatch(script, /安全とプライバシー/);
  assert.doesNotMatch(script, /学校・教育施設の敷地内/);
});

test("mobile map status clears the default area legend", () => {
  assert.match(
    MAP_EXPLORER_STYLES,
    /@media \(max-width: 900px\)[\s\S]*\.me-map-status \{[\s\S]*bottom: 96px;/,
  );
});

test("locate action highlights nearby discoverable places on the map", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /nearbyAreasStatusTemplate/);
  assert.match(script, /function refreshNearbyAreaMarkers\(origin\)/);
  assert.match(script, /function nearbyDiscoverableAreaCandidates\(origin\)/);
  assert.match(script, /state\.nearbyAreaOrigin = \{/);
  assert.match(script, /Math\.round\(lat \* 10000\) \/ 10000/);
  assert.match(script, /if \(origin && state\.areaPolygonsLoaded\) setStatus\(COPY\.nearbyAreasNoneStatus\);/);
  assert.match(script, /refreshNearbyAreaMarkers\(state\.nearbyAreaOrigin\)/);
  assert.match(script, /openAreaFeatureSheet\(feature, center\.lat, center\.lng\)/);
  assert.match(script, /function canSuggestDirectAreaRecord\(area, masking\) \{\s*return areaAccessStatus\(area, masking\) === 'public_access';\s*\}/);
  assert.match(script, /renderAreaObservationGallery\(gallery, \{ label: COPY\.areaGalleryTitle, canRecord: canRecord, areaStatus: accessStatus \}\)/);
  assert.match(script, /COPY\.areaGalleryEmptySchoolLead/);
  assert.match(script, /me-nearby-area-marker/);
  assert.match(styles, /\.me-nearby-area-marker/);
  assert.match(styles, /\.me-nearby-area-marker\.is-public/);
  assert.match(styles, /\.me-nearby-area-marker\.is-school/);
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

test("map UX interactions emit area open and selected-place CTA KPI events", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var UI_KPI_ENDPOINT = "\/api\/v1\/ui-kpi\/events"/);
  assert.match(script, /function sendMapKpi\(eventName, actionKey, metadata\)/);
  assert.match(script, /map_area_detail_open/);
  assert.match(script, /trackAreaDetailOpen\('transient_area', props\)/);
  assert.match(script, /trackAreaDetailOpen\('registered_area'/);
  assert.match(script, /data-kpi-event="selected_place_cta_click"/);
  assert.match(script, /data-kpi-funnel="map_selected_place"/);
  assert.match(script, /map:selected_place:record/);
  assert.match(script, /map:area:album/);
  assert.match(script, /map:area:season_gap_record/);
});

test("area badge labels are not rendered as map markers", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function refreshAreaBadgeMarkers/);
  assert.match(script, /function refreshAreaBadgeMarkers\(\) \{\s*clearAreaBadgeMarkers\(\);\s*refreshNearbyAreaMarkers\(state\.nearbyAreaOrigin\);\s*\}/);
  assert.doesNotMatch(script, /function areaBadgeCountLabel\(item\)/);
  assert.doesNotMatch(script, /function isNamedAreaBadgeFeature\(feature, zoom\)/);
  assert.doesNotMatch(script, /me-area-badge-pill/);
  assert.match(script, /id: 'area-polygon-name'/);
  assert.match(script, /'text-field': \['get', 'name'\]/);
  assert.doesNotMatch(script, /me-area-badge/);
  assert.doesNotMatch(script, /recentObservationCount.*me-area-badge/);
  assert.doesNotMatch(script, /me-area-badge-actions/);
});

test("guide spots advertise guide availability without area label badges", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /areaBadgeGuideLabel/);
  assert.match(script, /function renderGuideSpotMarker/);
  assert.match(script, /me-guide-spot-marker is-pin/);
  assert.doesNotMatch(script, /has-guide-stop/);
  assert.match(script, /ガイド/);
});

test("guide area badges are disabled in favor of guide spot pins", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.doesNotMatch(script, /GUIDE_BADGE_LABEL_ZOOM/);
  assert.doesNotMatch(script, /GUIDE_BADGE_FULL_ZOOM/);
  assert.doesNotMatch(script, /GUIDE_BADGE_DENSE_LIMIT/);
  assert.doesNotMatch(script, /is-guide-pin/);
  assert.doesNotMatch(script, /is-guide-compact/);
  assert.match(script, /me-guide-dot/);
  assert.doesNotMatch(script, /title="' \+ escapeHtml\(name \+ ' ' \+ COPY\.areaBadgeGuideLabel\)/);
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
  assert.match(script, /is-pin/);
  assert.match(script, /me-guide-cluster-count/);
  assert.doesNotMatch(script, /GUIDE_SPOT_LABEL_ZOOM/);
  assert.doesNotMatch(script, /GUIDE_SPOT_FULL_ZOOM/);
  assert.doesNotMatch(script, /GUIDE_SPOT_DENSE_LIMIT/);
  assert.match(styles, /me-guide-spot-marker/);
  assert.match(styles, /me-guide-cluster-count/);
  assert.doesNotMatch(script, /あと __DISTANCE__|formatGuideDistance|radius \+ 'm'/);
});

test("map legend stays within the map viewport", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /max-width: min\(520px, calc\(100% - 24px\)\)/);
  assert.match(styles, /flex-wrap: wrap/);
  assert.match(styles, /#me-legend-low,\s+#me-legend-high/);
  assert.match(styles, /overflow-wrap: anywhere/);
});

test("area legend explains place meanings and safety states", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const enScript = mapExplorerBootScript({ basePath: "", lang: "en" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /id="me-legend-detail"/);
  assert.match(script, /function renderAreaLegendDetail\(\)/);
  assert.match(script, /<dl class="me-legend-list">/);
  assert.match(script, /<dt><i aria-hidden="true"><\/i><strong>/);
  assert.match(script, /areaLegendParkLabel/);
  assert.match(script, /areaLegendSchoolLabel/);
  assert.match(script, /areaLegendWaterLabel/);
  assert.match(script, /showLegend\(COPY\.areaTrustLegendLow, COPY\.areaTrustLegendHigh,[\s\S]*?'areas'\)/);
  assert.match(script, /data-legend-mode', 'areas'/);
  assert.match(script, /公園・緑地/);
  assert.match(script, /学校・教育施設/);
  assert.match(script, /水辺・水路/);
  assert.match(enScript, /Parks \/ green/);
  assert.match(enScript, /Schools/);
  assert.match(enScript, /Waterways/);
  assert.match(styles, /\.me-legend-detail/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(112px, 1fr\)\)/);
  assert.match(styles, /\.me-legend-chip\.is-school i[\s\S]*border-style: dashed/);
  assert.match(styles, /\.me-legend-chip\.is-water i/);
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
  assert.match(script, /function renderResultsEmptyState\(\)/);
  assert.match(script, /COPY\.emptyTitle/);
  assert.match(script, /data-results-empty-areas/);
  assert.match(script, /data-results-empty-widen/);
  assert.match(script, /me-empty-invite/);
  assert.match(script, /data-kpi-action="map:results_empty_record"/);
  assert.match(script, /function switchMapTab\(tab\)/);
  assert.match(script, /switchMapTab\('places'\)/);
  assert.match(script, /function widenEmptyViewport\(\)/);
  assert.match(script, /function setResultsLoadState\(stateName, count\)/);
  assert.match(script, /function runInitialMapDataLoad\(reason\)/);
  assert.match(script, /scheduleInitialMapDataLoad\(180\)/);
  assert.match(script, /runInitialMapDataLoad\('load'\)/);
  assert.match(script, /function scheduleRecordsLoadWatchdog\(requestSeq, requestKey, scope\)/);
  assert.match(script, /function scheduleRecordsHardSettleWatchdog\(\)/);
  assert.match(script, /function recoverRecordsLoad\(requestSeq, requestKey, scope\)/);
  assert.match(script, /function forceSettleRecordsRequest\(requestSeq, stats\)/);
  assert.match(script, /settleCurrentRecordsRequest\(requestSeq\)/);
  assert.match(script, /state\.recordsRecoveryAttempts \+= 1;\s+scheduleRecordsLoadWatchdog\(requestSeq, requestKey, scope\);\s+return;/);
  assert.match(script, /if \(state\._recordsAppliedSeq === requestSeq\) return;\s+forceSettleRecordsRequest\(requestSeq, state\.lastStats\);/);
  assert.match(script, /RECORDS_LOAD_WATCHDOG_MS = 8000/);
  assert.match(script, /RECORDS_HARD_SETTLE_MS = 20000/);
  assert.match(script, /scheduleRecordsHardSettleWatchdog\(\);/);
  assert.match(script, /data-results-state/);
  assert.match(script, /setResultsLoadState\(records\.length \? 'ready' : 'empty', records\.length\)/);
  assert.match(script, /resultsListEl\.innerHTML = renderResultsEmptyState\(\);/);
  assert.match(script, /setResultsLoadState\('error'/);
  assert.match(script, /me-result-group-head/);
  assert.match(script, /COPY\.resultGroupedByDate/);
  assert.match(script, /renderResultBadges\(record\)/);
  assert.match(script, /width="64" height="64"/);
  const resultListBody = script.slice(
    script.indexOf("function renderResultList()"),
    script.indexOf("function clearDiscoveryPreviewMarkers()"),
  );
  assert.ok(
    resultListBody.indexOf("setResultsLoadState(records.length ? 'ready' : 'empty', records.length)") <
      resultListBody.indexOf("if (!resultsListEl || !sideStatusEl) return;"),
  );
  assert.doesNotMatch(resultListBody, /'<span>' \+ escapeHtml\(record\.localityLabel/);
  assert.match(styles, /\.me-result-group \{/);
  assert.match(styles, /grid-template-columns: 64px minmax\(0,1fr\)/);
  assert.match(styles, /\.me-result-badges/);
  assert.match(styles, /\.me-results-empty-actions/);
  assert.match(styles, /\.me-results-empty-action\.is-primary/);
  assert.match(styles, /\.me-empty-invite/);
  assert.doesNotMatch(script, /縺|繧|譁|髱|蝗|遽/);
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

test("area polygon selection reopens the side panel before showing selection", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const openAreaSheetBody = script.slice(script.indexOf("function openAreaSheet("), script.indexOf("function applyAreaSnapshot"));

  assert.match(script, /function openAreaFeatureSheet\(feature, lat, lng\)/);
  assert.match(script, /openAreaSheet\(fieldId, lat, lng, feature\)/);
  assert.match(openAreaSheetBody, /setSideRailMode\(false\);\s+renderSelectedCard\(\);\s+renderSidePanels\(\);\s+setSideTab\('selection'\);/);
});

test("map explorer keeps the regional guide label in the header and leaves the map canvas unobstructed", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });

  assert.match(html, /me-map-kicker">地域図鑑マップ/);
  assert.match(html, /data-side="rail"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /me-enjoy-strip/);
  assert.doesNotMatch(html, /ikimon - 皆で作る地域図鑑/);
  assert.doesNotMatch(html, /このエリアの活動・ラリー/);
  assert.doesNotMatch(html, /data-testid="map-activity-rally-panel"/);
  assert.doesNotMatch(html, /data-events-new-href/);
  assert.doesNotMatch(html, /\/community\/events\/new/);
});

test("default map surface uses a tiered simple vector style", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /url: 'https:\/\/tiles\.openfreemap\.org\/planet'/);
  assert.match(script, /glyphs: 'https:\/\/tiles\.openfreemap\.org\/fonts\/\{fontstack\}\/\{range\}\.pbf'/);
  assert.match(script, /var SIMPLE_MID_LANDMARK_CLASSES = \['school', 'kindergarten', 'college', 'university', 'park', 'garden', 'playground'\]/);
  assert.match(script, /var SIMPLE_HIGH_LANDMARK_CLASSES = \['railway', 'town_hall', 'library', 'hospital'\]/);
  assert.match(script, /var SIMPLE_COMMERCIAL_LANDMARK_CLASSES = \['shop', 'grocery', 'cafe', 'restaurant'\]/);
  assert.match(script, /var SIMPLE_LOCALITY_CLASSES = \['town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'\]/);
  assert.match(script, /id: 'simple-road-major'/);
  assert.match(script, /id: 'simple-landuse-soft'/);
  assert.match(script, /id: 'simple-school-landuse-outline'[\s\S]*?minzoom: 13/);
  assert.match(script, /id: 'simple-school-landuse-outline'[\s\S]*?\['school', 'kindergarten', 'college', 'university'\]/);
  assert.match(script, /id: 'simple-park-outline'[\s\S]*?minzoom: 12/);
  assert.match(script, /id: 'simple-road-local-casing'/);
  assert.match(script, /id: 'simple-road-local'/);
  assert.match(script, /id: 'simple-waterway'[\s\S]*?filter: \['match', \['get', 'class'\], \['river', 'canal'\], true, false\]/);
  assert.match(script, /id: 'simple-road-local'[\s\S]*?minzoom: 13\.2/);
  assert.match(script, /id: 'simple-road-local'[\s\S]*?\['tertiary', 'minor', 'service', 'track'\]/);
  assert.match(script, /id: 'simple-locality-label'[\s\S]*?minzoom: 12\.4/);
  assert.match(script, /id: 'simple-locality-label'[\s\S]*?SIMPLE_LOCALITY_CLASSES/);
  assert.match(script, /id: 'simple-landmark-label'[\s\S]*?minzoom: 15\.9/);
  assert.match(script, /id: 'simple-civic-label'[\s\S]*?minzoom: 17/);
  assert.match(script, /id: 'simple-commercial-label'[\s\S]*?minzoom: 15\.8/);
  assert.match(script, /id: 'simple-place-label'[\s\S]*?maxzoom: 12\.8/);
  assert.doesNotMatch(script, /id: 'simple-landmark-dot'/);
  assert.doesNotMatch(script, /id: 'simple-civic-dot'/);
  assert.doesNotMatch(script, /id: 'simple-commercial-dot'/);
  assert.doesNotMatch(script, /id: 'simple-road-name-major'/);
  assert.doesNotMatch(script, /'source-layer': 'building'/);
  assert.doesNotMatch(script, /'post'/);
});

test("map explorer restores the quick record launcher on mobile only", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /\.site-shell\.is-map-surface \.global-record-launcher \{\s*display: none;\s*\}/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.site-shell\.is-map-surface \.global-record-launcher \{\s*display: grid;\s*z-index: 72;/);
});

test("map explorer does not paint the field-guide title over the map", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });

  assert.doesNotMatch(html, /class="me-enjoy-strip"/);
  assert.doesNotMatch(html, /ikimon - 皆で作る地域図鑑/);
});

test("map explorer hides migration jargon and unidentified placeholders from public copy", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function publicBriefText/);
  assert.match(script, /Cloudflare\|互換表示\|移行中/);
  assert.match(script, /unidentified/);
  assert.match(script, /return fallback \|\| COPY\.awaitingIdLabel/);
});

test("area map labels and side cards expose organizer and encyclopedia shortcuts", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /areaBadgeEventLabel/);
  assert.match(script, /areaBadgeAlbumLabel/);
  assert.doesNotMatch(script, /function isNamedAreaBadgeFeature\(feature, zoom\)/);
  assert.match(script, /主催者/);
  assert.match(script, /エリア図鑑/);
  assert.match(script, /EVENTS_ORGANIZER_HREF/);
  assert.doesNotMatch(script, /me-area-badge-actions/);
  assert.doesNotMatch(script, /me-area-badge-pill/);
  assert.match(script, /function renderAreaPrimaryActions\(fieldId, sourceLinksHtml, sourceTrustHtml, canSuggestEvent\)/);
  assert.match(script, /if \(canSuggestEvent === false \|\| !eventHref\)/);
  assert.match(script, /me-area-primary-actions/);
  assert.match(script, /FIELDS_ALBUM_TPL\.replace\('__FIELD_ID__', encodeURIComponent\(fieldId\)\)/);
  assert.doesNotMatch(script, /eventsNewHrefTemplate/);
  assert.doesNotMatch(script, /\/community\/events\/new/);
  assert.match(script, /return heroHtml \+ accessHtml \+ maskingHtml \+ safetyNoticeHtml \+ nextStepHtml \+ primaryActionsHtml \+ positiveHtml/);
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
  assert.match(script, /return heroHtml \+ accessHtml \+ maskingHtml \+ safetyNoticeHtml \+ nextStepHtml \+ primaryActionsHtml \+ positiveHtml \+ guideStopHtml/);
});

test("map viewport movement refreshes stale result panels automatically", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /viewportRefreshTimer: null/);
  assert.match(script, /function refreshViewportSearchData\(\)/);
  assert.match(script, /function scheduleViewportRefresh\(\)/);
  assert.match(script, /scheduleViewportRefresh\(\);\s+refreshDiscoveryPreviewMarkers/);
  assert.match(script, /searchAreaBtnEl\.addEventListener\('click', function \(\) \{\s+refreshViewportSearchData\(\);/);
});

test("map initial data load stays light and defers secondary panels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var VIEWPORT_RECORD_LIMIT = 600;/);
  assert.match(script, /var CELL_RECORD_LIMIT = 1500;/);
  assert.match(script, /var recordLimit = scope && scope\.cellId \? CELL_RECORD_LIMIT : VIEWPORT_RECORD_LIMIT;/);
  assert.match(script, /function deferMapTask\(fn, delay\)/);
  assert.match(script, /deferMapTask\(function \(\) \{[\s\S]*loadEffortSummary\(\);[\s\S]*loadTraces\(\);[\s\S]*\}, reason === 'load' \? 220 : 420\);/);
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
  assert.match(script, /show\(areaLabelLayers, tab === 'places'\);/);
  assert.match(script, /moveToTop\(\['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-name-priority', 'area-polygon-name', 'area-polygon-selected-halo', 'area-polygon-selected'\]\);/);
  assert.match(script, /8, 0\.11, 11, 0\.15, 14, 0\.28, 16\.5, 0\.42/);
  assert.match(script, /map\.setPaintProperty\('area-polygon-outline', 'line-width', tab === 'places'/);
  assert.match(script, /var markerLayers = \['observation-cell-dot', 'observation-cell-selected'\]/);
  assert.match(script, /var markerDetailLayers = \['observation-cell-outline', 'observation-cell-count', 'observation-cell-label'\]/);
  assert.match(script, /show\(markerDetailLayers, false\);/);
});

test("area density and labels are staged by zoom instead of appearing all at once", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var areaLabelLayers = \['area-polygon-name-priority', 'area-polygon-name'\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?minzoom: 13\.2/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?maxzoom: 15\.35/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['!', \['in', \['get', 'access'\], \['literal', \['private', 'no', 'restricted'\]\]\]\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['match', \['get', 'source'\], \['osm_park', 'protected_area'\], true, false\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['match', \['get', 'source'\], \['oecm', 'nature_symbiosis_site'\], true, false\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['>=', \['coalesce', \['get', 'area_ha'\], 0\], 35\]/);
  assert.doesNotMatch(script, /id: 'area-polygon-name-priority'[\s\S]*?\['school', 'osm_park'/);
  assert.match(script, /'text-opacity': \['interpolate', \['linear'\], \['zoom'\], 13\.2, 0, 13\.8, 0\.72, 15\.4, 0\.88\]/);
  assert.match(script, /'line-opacity', tab === 'places'[\s\S]*?8, 0\.55, 12, 0\.72, 15, 0\.96/);
  assert.match(script, /\['in', \['get', 'access'\], \['literal', \['private', 'no', 'restricted'\]\]\],[\s\S]*?'#dc2626'/);
  assert.match(script, /8, 1\.4, 14, 2\.4, 17, 3\.2/);
  assert.match(script, /8, 1\.2, 14, 1\.6, 17, 2\.2/);
  assert.match(script, /'area-polygon-hitbox'[\s\S]*?'line-width': 14/);
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
  assert.match(script, /'area-polygon-hitbox', 'area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-selected-halo', 'area-polygon-selected'/);
  assert.match(script, /\['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox'\]\.forEach/);
  assert.match(script, /map\.queryRenderedFeatures\(e\.point, \{ layers: hitLayers \}\)/);
});

test("selected area polygon keeps a high-contrast double outline", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /id: 'area-polygon-selected-halo'/);
  assert.match(script, /'line-color': 'rgba\(255,255,255,0\.94\)'/);
  assert.match(script, /'line-width': \['interpolate', \['linear'\], \['zoom'\], 8, 5\.6, 14, 8\.2, 17, 10\.5\]/);
  assert.match(script, /id: 'area-polygon-selected-halo'[\s\S]*?\}, beforeId\);/);
  assert.match(script, /id: 'area-polygon-selected'[\s\S]*?'line-color': '#0f766e'/);
  assert.match(script, /id: 'area-polygon-selected'[\s\S]*?'line-width': \['interpolate', \['linear'\], \['zoom'\], 8, 3\.2, 14, 4\.8, 17, 6\.2\]/);
  assert.match(script, /id: 'area-polygon-selected'[\s\S]*?\}, beforeId\);/);
  assert.match(script, /function setSelectedAreaPolygonFilter\(fieldId\)/);
  assert.match(script, /\['area-polygon-selected-halo', 'area-polygon-selected'\]\.forEach/);
  assert.match(script, /setSelectedAreaPolygonFilter\(fieldId\);/);
  assert.match(script, /setSelectedAreaPolygonFilter\(props\.field_id \|\| '__none__'\);/);
  assert.match(script, /setSelectedAreaPolygonFilter\('__none__'\);/);
});

test("approximate school areas are not rendered as circular map ranges", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var VISIBLE_AREA_POLYGON_FILTER = \['!', \['all', \['==', \['get', 'source'\], 'school'\], \['==', \['get', 'approximate_boundary'\], true\]\]\]/);
  assert.match(script, /filter: VISIBLE_AREA_POLYGON_FILTER/);
  assert.match(script, /filter: \['all', \['==', \['get', 'approximate_boundary'\], true\], VISIBLE_AREA_POLYGON_FILTER\]/);
  assert.match(script, /function selectedAreaPolygonFilter\(fieldId\)/);
  assert.match(script, /function setSelectedAreaPolygonFilter\(fieldId\)/);
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
