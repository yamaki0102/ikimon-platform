import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

test("map explorer boot script is syntactically valid JavaScript", () => {
  const scriptHtml = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const script = scriptHtml.replace(/^<script>/, "").replace(/<\/script>$/, "");

  assert.doesNotThrow(() => new vm.Script(script));
});

test("map explorer desktop chrome hides legacy mobile menu affordances", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /@media \(min-width: 1161px\) \{[\s\S]*\.desktop-side-nav-toggle \{\s*display: grid;/);
  assert.match(styles, /@media \(min-width: 1161px\) \{[\s\S]*\.cf-header-menu,\s+\.site-header-actions-mobile,\s+\.site-mobile-menu \{\s*display: none !important;/);
});

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

test("JMA rain layer caps tile zoom at the API-supported max for overzooming", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const rainSourceStart = script.indexOf("state.map.addSource('jma-rain-nowcast'");
  const rainLayerStart = script.indexOf("state.map.addLayer({", rainSourceStart);
  const rainSourceScript = script.slice(rainSourceStart, rainLayerStart);
  const checkRainStart = script.indexOf("function checkRainAt(lng, lat)");
  const checkRainEnd = script.indexOf("function normalizeAreaSources", checkRainStart);
  const checkRainScript = script.slice(checkRainStart, checkRainEnd);

  assert.match(script, /var JMA_RAIN_TILE_MAX_ZOOM = 10;/);
  assert.match(rainSourceScript, /maxzoom: JMA_RAIN_TILE_MAX_ZOOM/);
  assert.match(rainSourceScript, /tiles: \[rainTileUrl\(entry, '\{z\}', '\{x\}', '\{y\}'\)\]/);
  assert.match(script, /'raster-opacity': \['interpolate', \['linear'\], \['zoom'\], 4, 0\.5, 10, 0\.62, 14, 0\.68, 18, 0\.74\]/);
  assert.match(script, /'raster-resampling': 'nearest'/);
  assert.match(script, /'raster-fade-duration': 0/);
  assert.match(checkRainScript, /var z = 10;/);
  assert.match(checkRainScript, /rainTileUrl\(entry, z, tile\.x, tile\.y\)/);
  assert.doesNotMatch(rainSourceScript, /maxzoom: 22/);
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

test("selected raw points keep site brief while stable cells use place atlas", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const selectedCardStart = script.indexOf("function renderSelectedCard()");
  const selectedPlaceBody = script.slice(
    script.indexOf("if (context.kind === 'place')", selectedCardStart),
    script.indexOf("if (context.kind === 'cell')", selectedCardStart),
  );
  const selectedCellBody = script.slice(
    script.indexOf("if (context.kind === 'cell')", selectedCardStart),
    script.indexOf("var record = context.record", selectedCardStart),
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
  assert.match(selectedCellBody, /renderPlaceAtlasContent\(context, ''\)/);
  assert.match(openCellBody, /renderPlaceAtlasContent\(detailContext, ''\)/);
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

test("place atlas integration lazily fetches only stable selections with stale-response protection", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const requestBody = script.slice(
    script.indexOf("function requestPlaceAtlasForSelection"),
    script.indexOf("function renderPlaceDetailActions"),
  );

  assert.match(html, /data-api-place-profile="\/api\/v1\/map\/place-profile"/);
  assert.match(script, /function placeAtlasRefForContext\(context\)/);
  assert.match(script, /kind: 'field'/);
  assert.match(script, /kind: 'osm_area'/);
  assert.match(script, /kind: 'public_cell'/);
  assert.match(script, /entityKey: 'osm:' \+ osmType \+ ':' \+ String\(osmId\)/);
  assert.doesNotMatch(script, /kind: 'point'/);
  assert.match(requestBody, /new AbortController\(\)/);
  assert.match(requestBody, /var seq = \+\+placeAtlasSeq/);
  assert.match(requestBody, /seq !== placeAtlasSeq/);
  assert.match(requestBody, /placeAtlasRefKey\(placeAtlasRefForContext\(selected\)\) !== refKey/);
  assert.match(requestBody, /setTimeout\(function \(\) \{[\s\S]*controller\.abort\(\)/);
  assert.match(requestBody, /payload\.profile\.version !== 1/);
  assert.match(requestBody, /credentials: 'same-origin'/);
  assert.match(script, /MapPlaceAtlasProfile\.loading/);
  assert.match(script, /MapPlaceAtlasProfile\.error/);
  assert.match(script, /MapPlaceAtlasProfile\.render/);
});

test("area and cell selections render place atlas in desktop panel and mobile sheet", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const areaOpenBody = script.slice(
    script.indexOf("function openAreaSheet"),
    script.indexOf("function closeBottomSheet"),
  );
  const transientBody = script.slice(
    script.indexOf("function openTransientAreaSheet"),
    script.indexOf("function openAreaFeatureSheet"),
  );
  const cellSelectBody = script.slice(
    script.indexOf("function selectCell"),
    script.indexOf("function selectRecord"),
  );

  assert.match(areaOpenBody, /requestPlaceAtlasForSelection\(state\.selectedPoint\)/);
  assert.match(areaOpenBody, /renderPlaceAtlasContent\(state\.selectedPoint/);
  assert.match(transientBody, /requestPlaceAtlasForSelection\(state\.selectedPoint\)/);
  assert.match(cellSelectBody, /requestPlaceAtlasForSelection\(state\.selectedPoint\)/);
  assert.match(script, /showAreaBottomSheet\(\);[\s\S]*bindPlaceAtlasContent\(sheetInnerEl\)/);
});

test("transient area fallback does not expose raw coordinates or use them as a durable follow id", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const body = script.slice(
    script.indexOf("function renderTransientAreaContent"),
    script.indexOf("function openTransientAreaSheet"),
  );

  assert.match(body, /var locationLabel = \[props\.prefecture, props\.city\]/);
  assert.doesNotMatch(body, /safeCenter\.lat\.toFixed\(4\)/);
  assert.doesNotMatch(body, /point:' \+ safeCenter/);
  assert.match(body, /canRecord && followId/);
});

test("mobile place detail peek keeps the map visible", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\]\s*\{\s*height: min\(34dvh, 300px\);\s*max-height: min\(34dvh, 300px\);/);
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
  assert.match(script, /function sheetMinHeight\(\)/);
  assert.match(script, /sheetGripEl\.addEventListener\('pointermove'/);
  assert.match(script, /sheetEl\.style\.setProperty\('--me-sheet-drag-height', Math\.round\(nextHeight\) \+ 'px'\)/);
  assert.match(script, /setSheetSnap\('full'\)/);
  assert.match(styles, /transition: transform \.38s cubic-bezier\(\.16,1,\.3,1\), opacity \.22s ease, height \.34s cubic-bezier\(\.16,1,\.3,1\), max-height \.34s cubic-bezier\(\.16,1,\.3,1\);/);
  assert.match(styles, /\.me-bottom-sheet--detail \.me-bottom-grip,\s+\.me-bottom-sheet--area \.me-bottom-grip/);
  assert.match(styles, /\.me-bottom-sheet--detail \.me-bottom-grip,[\s\S]*height: 44px;/);
  assert.match(styles, /\.me-bottom-sheet\.is-dragging \{ transition: none; \}/);
  assert.match(styles, /\.me-bottom-sheet--detail\.is-dragging,\s+\.me-bottom-sheet--area\.is-dragging \{[\s\S]*height: var\(--me-sheet-drag-height\);/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-bottom-sheet \{[\s\S]*position: fixed;/);
  assert.match(styles, /\.me-bottom-sheet--detail\[data-snap="peek"\]\s*\{\s*height: 34vh;\s*max-height: 34vh;\s*height: min\(34dvh, 300px\);/);
  assert.match(styles, /--me-mobile-sheet-clearance: 14px;/);
  assert.match(styles, /\.me-bottom-sheet\.me-bottom-sheet--area\s*\{[\s\S]*bottom: calc\(var\(--me-mobile-action-space\) \+ var\(--me-mobile-sheet-clearance\)\);/);
  assert.match(styles, /\.me-bottom-sheet\.me-bottom-sheet--area\[data-snap="peek"\]\s*\{\s*height: 44vh;\s*max-height: 44vh;\s*height: min\(44dvh, calc\(100dvh - var\(--me-header-h\) - 112px\), 380px\);/);
  assert.match(styles, /\.me-bottom-sheet\.me-bottom-sheet--area\[data-snap="full"\]\s*\{\s*height: calc\(100dvh - var\(--me-header-h\) - var\(--me-mobile-action-space\) - var\(--me-mobile-sheet-clearance\)\);\s*max-height: calc\(100% - 8px\);\s*max-height: calc\(100dvh - var\(--me-header-h\) - var\(--me-mobile-action-space\) - var\(--me-mobile-sheet-clearance\)\);/);
});

test("map home opens as a nearby-record tool instead of a raw point finder", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /me-map-kicker">探索する/);
  assert.match(html, /地図メニュー/);
  assert.match(html, /class="me-start-panel is-collapsed" id="me-start-panel" data-testid="map-start-panel" aria-label="地図メニュー" aria-hidden="false"/);
  assert.match(html, /aria-label="地図メニューを開く"/);
  assert.match(html, /class="me-start-panel-brief">記録・ガイド<\/span>/);
  assert.match(html, /class="me-start-panel-symbol" aria-hidden="true">⌄<\/span>/);
  assert.match(html, /近く/);
  assert.match(html, /許可済みなら近くから始めます。押すと現在地へ移動します。/);
  assert.match(html, /記録/);
  assert.match(html, /ガイド/);
  assert.match(html, /散策/);
  assert.match(html, /静岡の散策候補/);
  assert.match(html, /data-shizuoka-heading="静岡の散策候補"/);
  assert.match(html, /data-any-heading="散策候補"/);
  assert.match(html, /data-walk-map-prefix="\/ja\/walk-maps\/"/);
  assert.match(html, /data-api-walk-map-candidates="\/api\/v1\/municipal-walk-maps"/);
  assert.match(html, /href="\/ja\/walk-maps\/jp-shizuoka-asahata-waterfront-sample-v0"/);
  assert.match(html, /href="\/ja\/walk-maps\/jp-shizuoka-yatsuyama-sample-v0"/);
  assert.match(html, /data-kpi-action="map:start_panel:route_asahata"/);
  assert.match(html, /data-route-region="shizuoka"/);
  assert.match(html, /data-route-region="all"/);
  assert.match(html, /📍/);
  assert.match(html, /📷/);
  assert.match(html, /🧭/);
  assert.match(html, /🚶/);
  assert.doesNotMatch(html, />G<\/span>/);
  assert.doesNotMatch(html, />R<\/span>/);
  assert.match(html, /href="\/ja\/walk-maps"/);
  assert.doesNotMatch(html, /data-kpi-action="map:start_panel:record"/);
  assert.doesNotMatch(html, new RegExp("写真、ガイド、散策の" + "手がかり、記録の" + "入口"));
  assert.match(html, /id="me-purpose-hint"/);
  assert.match(html, /記録・ガイド・散策/);
  assert.doesNotMatch(html, /気になる場所を選ぶと、記録と季節の手がかりが見えます。/);
  assert.match(html, /この範囲の記録/);
  assert.match(html, /data-testid="map-personal-pulse-panel"/);
  assert.match(html, /自分の記録へすぐ戻る/);
  assert.match(html, /id="me-personal-memory"/);
  assert.match(html, /濃く撮った場所/);
  assert.match(html, /href="\/ja\/profile"/);
  assert.match(html, /href="\/ja\/records\?view=mine"/);
  assert.doesNotMatch(html, /class="me-map-momentum"/);
  assert.doesNotMatch(html, new RegExp("記録が地域の図鑑を" + "育" + "てています"));
  assert.doesNotMatch(html, /投稿が増えるほど、地図に季節や場所の手がかりが重なります。/);
  assert.doesNotMatch(html, /data-kpi-action="map:momentum_/);
  assert.doesNotMatch(html, /<section class="me-empty-invite"[\s\S]*?<strong>近くを探索中<\/strong>/);
  assert.doesNotMatch(html, new RegExp("ここは、これから" + "育つ場所です"));
  assert.doesNotMatch(html, /記録は地域単位で集計しています/);
  assert.doesNotMatch(html, new RegExp("余白 = これから" + "育つ場所"));
  assert.doesNotMatch(html, new RegExp("色 = 季節と記録の" + "厚" + "み"));
  assert.doesNotMatch(html, /面 = 場所ページ・エリア図鑑/);
  assert.doesNotMatch(html, /class="me-map-cues"/);
  assert.match(html, /class="me-tab is-active" role="tab" aria-selected="true" aria-label="現地ガイド" data-tab="places"/);
  assert.match(html, /<span class="me-tab-short" aria-hidden="true">現地ガイド<\/span>/);
  assert.match(html, /class="me-tab" role="tab" aria-selected="false" aria-label="雨雲" data-tab="rain"/);
  assert.match(html, /class="me-filter-group me-filter-display-group"/);
  assert.match(html, /<summary class="me-filter-toggle">詳しく絞る<\/summary>/);
  assert.match(html, /<span class="me-filter-label">レイヤー<\/span>/);
  assert.match(html, /data-filter-tab="rain" aria-pressed="false">雨雲<\/button>/);
  assert.match(html, /data-filter-tab="frontier" aria-pressed="false">記録の空白<\/button>/);
  assert.doesNotMatch(html, /<span class="me-tab-short" aria-hidden="true">余白<\/span>/);
  assert.doesNotMatch(html, /class="me-tab is-active" role="tab" aria-selected="true" aria-label="写真" data-tab="markers"/);
  assert.doesNotMatch(html, /class="me-tab me-tab-link"/);
  assert.doesNotMatch(styles, /\.me-map-momentum/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-start-panel\.is-collapsed \{[\s\S]*grid-template-columns: auto;/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-start-panel\.is-collapsed \.me-start-panel-grid \{\s*display: none;/);
  assert.match(script, /tab: 'places'/);
  assert.match(script, /var DEFAULT_MAP_CENTER = \[138\.383, 34\.975\];/);
  assert.match(script, /var DEFAULT_MAP_ZOOM = 13\.6;/);
  assert.match(script, /var STARTUP_LOCATION_ZOOM = 15\.0;/);
  assert.match(script, /var SHIZUOKA_PREF_BBOX = \[137\.47, 34\.57, 139\.16, 35\.65\];/);
  assert.match(script, /function mapCenterIsInShizuoka\(\)/);
  assert.match(script, /function refreshStartPanelRoutes\(\)/);
  assert.match(script, /function renderStartPanelRouteCandidates\(summaries\)/);
  assert.match(script, /function scheduleStartPanelRouteCandidates\(delayMs\)/);
  assert.match(script, /apiWalkMapCandidates \+ '\?lat='/);
  assert.match(script, /fetch\(endpoint, \{ credentials: 'same-origin'/);
  assert.match(script, /startPanelRoutesStaticHtml/);
  assert.match(script, /if \(!summaries\.length\) \{/);
  assert.match(script, /link\.hidden = region !== 'all' && region !== 'candidate' && !\(region === 'shizuoka' && inShizuoka\);/);
  assert.match(script, /function readLastStartupLocation\(\)/);
  assert.match(script, /function requestStartupCurrentLocation\(options\)/);
  assert.match(script, /var onlyIfGranted = options && options\.onlyIfGranted === true;/);
  assert.match(script, /if \(onlyIfGranted && \(!status \|\| status\.state !== 'granted'\)\)/);
  assert.match(script, /if \(onlyIfGranted\) return;/);
  assert.match(script, /requestStartupCurrentLocation\(\{ onlyIfGranted: true \}\)/);
  assert.match(script, /navigator\.geolocation\.getCurrentPosition\(applyPosition, fail/);
  assert.match(script, /startPanelLocationEl\.addEventListener\('click'/);
  assert.match(script, /requestStartupCurrentLocation\(\{ force: true \}\)/);
  assert.doesNotMatch(script, /center: state\._restoredCenter \|\| \[138\.38, 35\.34\]/);
  assert.doesNotMatch(script, /zoom: state\._restoredZoom != null \? state\._restoredZoom : 5\.2/);
  assert.match(script, /PURPOSE_HINT_STORAGE_KEY = 'ikimon-map-purpose-hint-v1'/);
  assert.match(script, /function dismissStartPanel\(\)/);
  assert.match(script, /function setStartPanelCollapsed\(collapsed\)/);
  assert.match(script, /startPanelCloseEl\.addEventListener\('click'/);
  assert.match(script, /startPanelCloseEl\.querySelector\('\.me-start-panel-symbol'\)/);
  assert.match(script, /startPanelSymbolEl\.textContent = collapsed \? '⌄' : '×';/);
  assert.match(script, /var t = btn\.getAttribute\('data-tab'\);/);
  assert.match(script, /if \(!t\) return;/);
  assert.match(script, /function canShowPurposeHint\(\)/);
  assert.match(script, /function canShowPurposeHint\(\) \{\s*return false;\s*\}/);
  assert.match(script, /function refreshPurposeHint\(\) \{\s*setPurposeHintVisible\(false\);\s*\}/);
  assert.match(script, /state\.map\.on\('dragstart', dismissPurposeHint\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-purpose-hint\s*\{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\s*\{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\.is-collapsed \{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel-brief\s*\{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\.is-collapsed \.me-start-panel-brief \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\.is-collapsed \.me-start-panel-grid \{[\s\S]*grid-template-columns: 38px;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\.is-collapsed \.me-start-panel-grid a \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel\.is-collapsed \.me-start-panel-routes \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel-grid\s*\{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel-routes\s*\{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel-routes a\[hidden\] \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-legend\.is-collapsed \.me-legend-gradient,/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-purpose-hint\[hidden\],\s+\.me-rain-mode \.me-purpose-hint,\s+\.me-sheet-open \.me-purpose-hint \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.me-start-panel,\s+\.me-sheet-open \.me-start-panel \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /@media \(max-width: 900px\)[\s\S]*\.me-purpose-hint \{[\s\S]*width: min\(260px, calc\(100% - 116px\)\);/);
  assert.match(MAP_EXPLORER_STYLES, /@media \(max-width: 900px\)[\s\S]*\.me-start-panel \{[\s\S]*width: auto;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-start-panel-grid a strong \{[\s\S]*clip: rect\(0 0 0 0\);/);
});

test("map explorer overlays signed-in owner observations separately from public cells", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /data-api-my-observations="\/api\/v1\/map\/my-observations"/);
  assert.match(html, /id="me-own-trail"/);
  assert.match(html, /id="me-own-trail-list"/);
  assert.match(html, /自分の撮影/);
  assert.match(html, /自分だけに表示/);
  assert.match(html, /みんなの記録は地点ではなくエリアで表示/);
  assert.match(html, /class="me-map-privacy-strip"/);
  assert.match(script, /var apiMyObservations = root\.getAttribute\('data-api-my-observations'\)/);
  assert.match(script, /function loadMyObservations\(\)/);
  assert.match(script, /apiMyObservations \+ '\?limit=120'/);
  assert.match(script, /credentials: 'same-origin'/);
  assert.match(script, /function renderPersonalMemoryClusters\(\)/);
  assert.match(script, /function openPersonalMemoryCluster\(cluster\)/);
  assert.match(script, /state\.myObservationClusters = payload && payload\.signedIn \? \(payload\.clusters \|\| \[\]\)\.filter\(isRenderableMapCluster\) : \[\]/);
  assert.match(script, /map:personal_memory_cluster_open/);
  assert.match(script, /function renderOwnObservationTrail\(records\)/);
  assert.match(script, /function hideOwnObservationTrail\(\)/);
  assert.match(script, /function isMeaningfulMapRecordLabel\(value\)/);
  assert.match(script, /function isRenderableMapRecord\(record\)/);
  assert.match(script, /var selectedAggregateCellId = scope && scope\.cellId/);
  assert.match(script, /Object\.assign\(\{\}, record, \{ cellId: selectedAggregateCellId \}\)/);
  assert.match(script, /state\.records = \(\(list && list\.items\) \|\| \[\]\)\.map[\s\S]*\.filter\(isRenderableMapRecord\)/);
  assert.match(script, /state\.myObservations = payload && payload\.signedIn \? \(payload\.items \|\| \[\]\)\.filter\(isRenderableMapRecord\) : \[\]/);
  assert.match(script, /function viewerOwnedRecordCenter\(record\)/);
  assert.match(script, /record && record\.isViewerOwned && Number\.isFinite\(lat\) && Number\.isFinite\(lng\)/);
  assert.match(script, /function syncViewerOwnedRecordSource\(map\)/);
  assert.match(script, /viewer-owned-observations/);
  assert.match(script, /viewer-owned-observation-dot/);
  assert.match(script, /function normalizeMapMediaKey\(value\)/);
  assert.match(script, /function mapMarkerDisplayKey\(record\)/);
  assert.match(script, /function mapCardDisplayKey\(record\)/);
  assert.match(script, /function suppressOwnerRepresentedPublicRecords\(publicRecords, ownedRecords\)/);
  assert.match(script, /function publicRecordsForSignedInSurface\(records\)/);
  assert.match(script, /function recordRepresentedByOwnObservations\(record\)/);
  assert.match(script, /return suppressOwnerRepresentedPublicRecords\(records, state\.myObservations\)/);
  assert.match(script, /recordHasExactCoordinateDisclosure\(record\)/);
  assert.match(script, /sortedDiscoveryPreviewCandidates\(\)[\s\S]*dedupeRecordsForSurface\(publicRecordsForSignedInSurface/);
  assert.match(script, /renderOwnObservationTrail\(records\)[\s\S]*dedupeRecordsForSurface\(\(Array\.isArray\(records\) \? records : \[\]\)[\s\S]*'card'\)/);
  assert.match(script, /if \(recordRepresentedByOwnObservations\(record\)\) return null;/);
  assert.doesNotMatch(script, /record\.isViewerOwned \? '自分だけ正確' : 'おおよその位置'/);
  assert.match(script, /var maxCards = zoom >= 16 \? 18 : \(zoom >= 15 \? 14 : 10\);/);
  assert.match(script, /if \(isFinite\(gridM\) && gridM <= 500\) return 15\.4;/);
  assert.match(script, /data-own-trail-id/);
  assert.match(script, /map:own_observation_trail_focus/);
  assert.match(script, /function ownObservationGroups/);
  assert.match(script, /function renderOwnObservationMarkers\(\)/);
  assert.match(script, /var maplibre = state\.maplibreRuntime \|\| window\.maplibregl/);
  assert.match(script, /new maplibre\.Marker\(\{ element: el, anchor: 'bottom', offset: \[0, -10\] \}\)/);
  assert.match(script, /function addOwnObservationFallbackMarker\(el, lng, lat\)/);
  assert.match(script, /function setOwnObservationMarkerState\(status, count\)/);
  assert.match(script, /data-own-observation-record-count/);
  assert.match(script, /data-own-observation-marker-count/);
  assert.match(script, /function safeOwnObservationGroups\(records\)/);
  assert.match(script, /return ownObservationCoordinateGroups\(records\)/);
  assert.match(script, /function prioritizeOwnObservationRecordsForView\(records\)/);
  assert.match(script, /function prioritizeOwnObservationGroupsForView\(groups\)/);
  assert.match(script, /var renderedOwnObservationIds = \{\}/);
  assert.match(script, /function markOwnObservationGroupRendered\(group\)/);
  assert.match(script, /function ownObservationGroupWasRendered\(group\)/);
  assert.match(script, /function ownObservationIdExistsInDom\(occurrenceId\)/);
  assert.match(script, /function renderNearCenterOwnObservationPins\(records\)/);
  assert.match(script, /if \(root && !root\.contains\(el\)\)/);
  assert.match(script, /marker = addOwnObservationFallbackMarker\(el, lng, lat\)/);
  assert.match(script, /renderOwnObservationGroup\(group, true\)/);
  assert.match(script, /renderNearCenterOwnObservationPins\(records\)/);
  assert.match(script, /setOwnObservationMarkerState\(state\.ownObservationMarkers\.length \? 'ready' : 'render-empty'/);
  assert.match(script, /renderOwnObservationTrail\(records\)/);
  assert.match(script, /hideOwnObservationTrail\(\)/);
  assert.match(script, /me-own-observation-marker/);
  assert.match(script, /me-my-photo-marker/);
  assert.match(script, /me-community-photo-marker/);
  assert.match(script, /state\.tab !== 'markers' && state\.tab !== 'places'/);
  assert.match(script, /zoom < 11\.5/);
  assert.match(script, /selectRecord\(record, \{ focusMap: false, openSheet: shouldUseBottomSheet\(\), preserveSurroundings: true \}\)/);
  assert.match(script, /data-own-observation-count/);
  assert.match(script, /data-own-observation-ids/);
  assert.match(script, /function openOwnObservationStackSheet\(records\)/);
  assert.match(script, /function openOwnObservationDetail\(record\)/);
  assert.match(script, /data-own-observation-detail="1"/);
  assert.match(script, /ownObservationExactBadge/);
  assert.match(script, /自分にだけ正確な位置/);
  assert.match(script, /公開マップではおおよその位置で表示されます/);
  assert.match(script, /data-own-observation-stack-sheet="1"/);
  assert.match(script, /data-own-observation-choice/);
  assert.match(script, /return NOTES_HREF;/);
  assert.match(script, /setSheetSnap\('full'\)/);
  assert.match(script, /openOwnObservationStackSheet\(group\.records\)/);
  assert.match(script, /openOwnObservationDetail\(record\)/);
  assert.match(script, /openOwnObservationDetail\(match\)/);
  assert.match(script, /map:own_observation_exact_open/);
  assert.match(script, /function maybeFitOwnObservationsOnFirstOpen\(\)/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-personal-memory \{/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-personal-memory-item \{/);
  assert.match(script, /state\._ownObservationFirstViewApplied/);
  assert.match(script, /Math\.abs\(maxLng - minLng\) > 2\.2 \|\| Math\.abs\(maxLat - minLat\) > 1\.8/);
  assert.match(script, /state\.map\.flyTo\(\{ center: \[latestLng, latestLat\], zoom: 12\.2/);
  assert.match(script, /state\.map\.fitBounds\(\[\[minLng, minLat\], \[maxLng, maxLat\]\]/);
  assert.match(script, /if \(state\._restoredCenter \|\| state\._restoredCellId\) return;/);
  assert.match(script, /if \(state\.tab === 'rain'\) return;/);
  assert.match(script, /if \(state\.selectedPoint \|\| state\._meMarker\) return;/);
  assert.match(script, /maybeFitOwnObservationsOnFirstOpen\(\);/);
  assert.match(script, /renderOwnObservationMarkers\(\);\s+if \(state\.areaPolygonsDebounce\)/);
  assert.match(script, /data-own-observations-fetch/);
  assert.match(script, /state\.maplibreRuntime = window\.maplibregl/);
  assert.doesNotMatch(script, /if \(state\._ownObservationFirstViewApplied\) \{\s+dropMeMarker\(lng, lat\);\s+return;\s+\}/);
  assert.match(script, /state\.tab === 'rain'/);
  assert.doesNotMatch(script, /ownTrailCountEl\.textContent = props\.lang/);
  assert.doesNotMatch(script, /map-observations[\s\S]{0,240}apiObservations \+/);
  assert.doesNotMatch(script, /Number\.isFinite\(lat\) && Number\.isFinite\(lng\) && !!record\.photoUrl;\s+\}\);\s+\}/);
});

test("shared map state does not serialize private owner observation coordinates", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const serializeBody = script.slice(
    script.indexOf("function serializeMapState()"),
    script.indexOf("function saveMapState()"),
  );

  assert.match(serializeBody, /MapExplorerStateHelpers\.serializeSharedMapState/);
  assert.doesNotMatch(serializeBody, /myObservations/);
  assert.doesNotMatch(serializeBody, /ownObservation/);
  assert.doesNotMatch(serializeBody, /record\.latitude|record\.longitude/);
});

test("map explorer exposes JMA rain overlay without making ZUKAN the forecaster", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /id="me-rain-card"[^>]*hidden/);
  assert.match(html, /id="me-rain-toggle"[^>]*>更新</);
  assert.match(html, /<strong>レーダー<\/strong>/);
  assert.match(html, /data-api-jma-nowcast-times="\/api\/v1\/weather\/jma-nowcast\/times"/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-card\[hidden\]\s*\{\s*display: none;\s*\}/);
  assert.match(MAP_EXPLORER_STYLES, /@media \(max-width: 900px\)[\s\S]*\.me-rain-card \{[\s\S]*position: fixed;[\s\S]*bottom: max\(10px, env\(safe-area-inset-bottom\)\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-card\[data-sheet-open="1"\] \{[\s\S]*opacity: 0;[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
  assert.match(MAP_EXPLORER_STYLES, /@media \(max-width: 900px\)[\s\S]*\.me-rain-timeline \{[\s\S]*display: flex;[\s\S]*overflow-x: auto;/);
  assert.match(MAP_EXPLORER_STYLES, /@media \(max-width: 900px\)[\s\S]*\.me-rain-timeline \{[\s\S]*mask-image: linear-gradient\(to right, #000 0, #000 calc\(100% - 22px\), transparent 100%\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.me-section \{[\s\S]*--me-topbar-h: 44px;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.me-search-shell,\s+\.me-rain-mode \.me-topbar-secondary \{[\s\S]*display: none;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.me-rain-card \{[\s\S]*grid-template-areas:[\s\S]*"label timeline update"[\s\S]*"source actions actions"[\s\S]*"status status status"/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.me-rain-head \{ display: contents; \}/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode \.site-shell\.is-map-surface \.global-record-launcher \{[\s\S]*display: none;/);
  assert.match(script, /jma-rain-nowcast-layer/);
  assert.match(script, /state\.tab === 'rain'/);
  assert.match(script, /if \(!state\.rainEnabled \|\| state\.tab !== 'rain'\) return;/);
  assert.match(script, /function syncRainModeClass\(\)/);
  assert.match(script, /function isRainInteractionMode\(\)/);
  assert.match(script, /function checkRainTap\(lngLat\)/);
  assert.match(script, /function shouldKeepMapClearForRain\(\)/);
  assert.match(script, /return isRainInteractionMode\(\) && shouldUseBottomSheet\(\);/);
  assert.match(script, /if \(shouldKeepMapClearForRain\(\)\) \{\s+closeBottomSheet\(\);\s+return;\s+\}/);
  assert.match(script, /function setMapEmptyInviteVisible\(visible\) \{\s+void visible;\s+\}/);
  assert.match(script, /if \(state\.tab === 'rain'\) \{\s+closeBottomSheet\(\);\s+setMapEmptyInviteVisible\(false\);\s+hideLayerHint\(\);\s+enableRainLayer\(\);/);
  assert.match(script, /function rainStatusWithNotice\(text\)/);
  assert.match(script, /JMA_RAIN_TILE_MAX_ZOOM = 10/);
  assert.match(script, /maxzoom: JMA_RAIN_TILE_MAX_ZOOM/);
  assert.match(script, /rainForecastNotice/);
  assert.match(script, /data-sheet-open/);
  assert.match(script, /classList\.toggle\('me-sheet-open', Boolean\(sheetOpen\)\)/);
  assert.match(script, /function closeBottomSheet\(\) \{[\s\S]*syncRainUi\(\);[\s\S]*\}/);
  assert.match(script, /syncRainUi\(\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-rain-mode\.me-sheet-open \.me-locate-fab \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
  assert.match(script, /map:rain:tab_open/);
  assert.match(script, /map:rain:refresh/);
  assert.doesNotMatch(script, /map_rain_toggle/);
  assert.match(script, /rainAttribution/);
  assert.match(script, /ZUKAN独自予報ではありません/);
  assert.match(script, /出典: 気象庁。ZUKAN独自予報ではありません/);
  assert.doesNotMatch(script, /ikimon独自予報ではありません/);
  assert.match(script, /強い雨・雷は公式情報も確認してください/);
  assert.match(script, /6時間先/);
  assert.match(script, /rainIndeterminate/);
  assert.match(script, /rainLocationFallback/);
  assert.match(script, /function checkRainAt\(lng, lat\)/);
  assert.match(script, /if \(isRainInteractionMode\(\) && checkRainTap\(e\.lngLat\)\) return;/);
  assert.match(script, /if \(isRainInteractionMode\(\) && checkRainTap\(center\)\) return;/);
  assert.match(script, /canvas\.getContext\('2d', \{ willReadFrequently: true \}\)/);
  assert.match(script, /hasRain === null/);
  assert.doesNotMatch(html, /www\.jma\.go\.jp\/bosai\/jmatile/);
  assert.doesNotMatch(script, /tiles: \['https:\/\/www\.jma\.go\.jp\/bosai\/jmatile/);
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
    /@media \(max-width: 900px\)[\s\S]*\.me-map-status \{[\s\S]*bottom: calc\(var\(--me-mobile-action-space\) \+ 8px\);/,
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
  assert.match(script, /function canSuggestDirectAreaRecord\(area, masking\) \{[\s\S]*?recording_policy[\s\S]*?=== 'allowed'[\s\S]*?contribution_cta_mode[\s\S]*?=== 'record'/);
  assert.match(script, /renderAreaObservationGallery\(gallery, \{ label: COPY\.areaGalleryTitle, canRecord: canRecord, areaStatus: accessStatus \}\)/);
  assert.match(script, /COPY\.areaGalleryEmptySchoolLead/);
  assert.match(script, /me-nearby-area-marker/);
  assert.match(styles, /\.me-nearby-area-marker/);
  assert.match(styles, /\.me-nearby-area-marker\.is-public/);
  assert.match(styles, /\.me-nearby-area-marker\.is-school/);
});

test("walk map candidates render as compact map markers from area-level hints", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /walkMapCandidateMarkers: \[\]/);
  assert.match(script, /function refreshWalkMapCandidateMarkers\(summaries\)/);
  assert.match(script, /function walkMapCandidateAreaHint\(summary\)/);
  assert.match(script, /hint\.precision !== 'area_hint'/);
  assert.match(script, /state\.tab !== 'places'/);
  assert.match(script, /var maxMarkers = 2;/);
  assert.match(script, /summaries\.slice\(0, maxMarkers\)/);
  assert.match(script, /if \(state\.tab !== 'places'\) clearWalkMapCandidateMarkers\(\);/);
  assert.match(script, /anchor: 'center'/);
  assert.match(script, /data-testid', 'map-walk-map-candidate-marker'/);
  assert.match(script, /<span>散策<\/span>/);
  assert.match(script, /map_walk_map_candidate_click/);
  assert.match(script, /refreshWalkMapCandidateMarkers\(summaries\)/);
  assert.match(styles, /\.me-walk-map-marker/);
  assert.match(styles, /\.me-walk-map-marker strong/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.me-walk-map-marker \{[\s\S]*max-width: 132px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.me-walk-map-marker strong \{[\s\S]*max-width: 70px;[\s\S]*display: -webkit-box;/);
  assert.doesNotMatch(styles, /\.me-walk-map-marker::after/);
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

test("area sheet includes local feedback surface", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function renderAreaPositiveFeedback/);
  assert.match(script, /viewerContribution/);
  assert.match(script, /communityPerspective/);
  assert.match(script, /overlapInsight/);
  assert.match(script, /あなたの視点/);
  assert.match(script, /あなたの記録から/);
  assert.match(script, /みんなの視点/);
  assert.match(script, /重なると見えること/);
  assert.match(script, /記録の手応え/);
  assert.match(script, /自分の記録を見る/);
});

test("map UX interactions emit area open and selected-place CTA KPI events", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var UI_KPI_ENDPOINT = "\/api\/v1\/ui-kpi\/events"/);
  assert.match(script, /function sendMapKpi\(eventName, actionKey, metadata\)/);
  assert.match(script, /map_area_detail_open/);
  assert.match(script, /place_profile_open/);
  assert.match(script, /place_theme_open/);
  assert.match(script, /place_image_error/);
  assert.match(script, /place_search_complete/);
  assert.match(script, /latencyMs/);
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
  assert.match(script, /<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"><\/circle><path d="m15\.5 8\.5-2\.1 4\.9-4\.9 2\.1 2\.1-4\.9 4\.9-2\.1Z"><\/path><\/svg>/);
  const pinStyle = styles.slice(
    styles.indexOf(".me-guide-spot-marker.is-pin .me-guide-spot-main"),
    styles.indexOf(".me-guide-cluster-count"),
  );
  assert.match(pinStyle, /background: rgba\(240,253,250,\.96\)/);
  assert.match(pinStyle, /color: #0f766e/);
  assert.doesNotMatch(pinStyle, /background: #0f172a/);
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
  assert.match(script, /zoom < 10 \? 0\.12 : zoom < 12 \? 0\.04 : zoom < 14 \? 0\.012 : 0\.002/);
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

  assert.match(styles, /max-width: min\(360px, calc\(100% - 24px\)\)/);
  assert.match(styles, /flex-wrap: wrap/);
  assert.match(styles, /#me-legend-low,\s+#me-legend-high/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /\.me-legend-toggle/);
  assert.match(styles, /\.me-legend\.is-collapsed/);
  assert.match(styles, /\.me-legend\.is-collapsed \.me-legend-toggle \{[\s\S]*width: 38px;/);
  assert.match(styles, /\.me-legend\.is-collapsed \.me-legend-toggle::after \{[\s\S]*content: "\?";/);
});

test("area legend explains place meanings and safety states", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const enScript = mapExplorerBootScript({ basePath: "", lang: "en" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /id="me-legend-detail"/);
  assert.match(html, /id="me-legend-toggle" aria-expanded="false"/);
  assert.match(script, /function renderAreaLegendDetail\(\)/);
  assert.match(script, /<dl class="me-legend-list">/);
  assert.match(script, /<dt><i aria-hidden="true"><\/i><strong>/);
  assert.match(script, /areaLegendParkLabel/);
  assert.match(script, /areaLegendSchoolLabel/);
  assert.match(script, /areaLegendWaterLabel/);
  assert.match(script, /showLegend\(COPY\.areaTrustLegendLow, COPY\.areaTrustLegendHigh,[\s\S]*?'areas'\)/);
  assert.match(script, /data-legend-mode', 'areas'/);
  assert.match(script, /legendToggleEl\.addEventListener\('click'/);
  assert.match(script, /legendEl\.classList\.toggle\('is-collapsed'/);
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

test("layer tabs expose low-zoom guidance without a floating layer key", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /id="me-layer-hint"/);
  assert.match(html, /id="me-layer-hint-jump"[^>]*>見える場所へ<\/button>/);
  assert.match(html, /aria-label="閉じる"/);
  assert.doesNotMatch(html, /me-layer-key|表示中のレイヤー|data-layer-key-item/);
  assert.match(script, /function layerHintInfo\(tab\)/);
  assert.doesNotMatch(script, /data-layer-key-item/);
  assert.match(script, /ズームするとエリア図鑑の範囲が見えます。/);
  assert.match(script, /ズームするとまだ少ない場所が面で見えます。/);
  assert.match(script, /ズームすると季節の気配の濃淡が見えます。/);
  assert.match(script, /maybeShowLayerHint\(state\.tab\);/);
  assert.match(script, /function jumpToVisibleLayer\(tab\)/);
  assert.match(script, /fallbackRegionBounds/);
  assert.match(script, /layerHintJumpEl\.addEventListener\('click'/);
  assert.match(styles, /\.me-layer-hint \{/);
  assert.doesNotMatch(styles, /\.me-layer-key/);
  assert.match(styles, /\.me-layer-hint\.is-hidden \{ display: none; \}/);
  assert.match(styles, /\.me-layer-hint-jump \{/);
});

test("mobile map keeps three primary tabs and moves advanced layers into the details drawer", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026, 2025] });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /data-mobile-primary-map-controls/);
  assert.match(html, /data-filter-tab="rain"/);
  assert.match(html, /data-filter-tab="frontier"/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-tabs \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*overflow: hidden;/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-tab\[data-tab="rain"\],[\s\S]*\.me-tab\[data-tab="frontier"\] \{[\s\S]*display: none;/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*--me-enjoy-h: 38px;/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-map-role-strip span,[\s\S]*\.me-map-role-strip em \{[\s\S]*display: none;/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-tab \{[\s\S]*min-width: 0;[\s\S]*text-overflow: ellipsis;/);
});

test("mobile map panels are mutually exclusive", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /var filterDrawerEl = document\.querySelector\('\.me-filter-drawer'\)/);
  assert.match(script, /function closeFilterDrawer\(\)/);
  assert.match(script, /filterDrawerEl\.addEventListener\('toggle'[\s\S]*closeBottomSheet\(\);[\s\S]*setStartPanelCollapsed\(true\);[\s\S]*hideLayerHint\(\);/);
  assert.match(script, /function showDetailBottomSheet\(\) \{[\s\S]*closeFilterDrawer\(\);[\s\S]*setStartPanelCollapsed\(true\);/);
  assert.match(script, /function showAreaBottomSheet\(\) \{[\s\S]*closeFilterDrawer\(\);[\s\S]*setStartPanelCollapsed\(true\);/);
  assert.match(styles, /\.me-filter-open \.me-rain-card,[\s\S]*\.me-filter-open \.me-legend \{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
});

test("result side panel groups dense records by date and normalizes candidate labels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /function friendlyTaxonLabel\(label\)/);
  assert.match(script, /Chloris: 'カワラヒワ属'/);
  assert.match(script, /Monticola: 'イソヒヨドリ属'/);
  assert.match(script, /function groupResultRecords\(records\)/);
  assert.match(script, /function renderResultsEmptyState\(\)/);
  assert.match(script, /function renderResultsLoadingState\(\)/);
  assert.match(script, /class="me-results-loading"/);
  assert.match(script, /class="me-results-loading-thumb"/);
  assert.match(script, /class="me-results-loading-lines"/);
  assert.match(script, /aria-label="' \+ escapeHtml\(COPY\.recordsLoading\) \+ '"/);
  assert.match(script, /COPY\.emptyTitle/);
  assert.match(script, /data-results-empty-areas/);
  assert.match(script, /data-results-empty-widen/);
  assert.doesNotMatch(renderMapExplorer({ basePath: "", lang: "ja", years: [2026] }), /id="me-empty-invite"/);
  assert.match(script, /data-kpi-action="map:results_empty_record"/);
  assert.match(script, /function switchMapTab\(tab\)/);
  assert.match(script, /switchMapTab\('places'\)/);
  assert.match(script, /function widenEmptyViewport\(\)/);
  assert.match(script, /function setResultsLoadState\(stateName, count\)/);
  assert.match(script, /function runInitialMapDataLoad\(reason\)/);
  assert.match(script, /refreshDiscoveryPreviewMarkers\(\);\s+if \(state\.tab === 'markers' \|\| state\.tab === 'places' \|\| state\.tab === 'rain'\) loadGuideSpots\(\);\s+scheduleStartPanelRouteCandidates\(reason === 'load' \? 120 : 260\);/);
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
  assert.match(script, /if \(!visibleRecords && resultsListEl\) \{\s+resultsListEl\.innerHTML = renderResultsLoadingState\(\);\s+setMapEmptyInviteVisible\(false\);/);
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
  assert.match(styles, /@keyframes me-results-loading/);
  assert.match(styles, /\.me-results-loading \{/);
  assert.match(styles, /\.me-results-loading-row \{/);
  assert.match(styles, /\.me-results-loading-thumb,/);
  assert.match(styles, /\.me-results-loading-row:nth-child\(n\+3\) \{ display: none; \}/);
  assert.match(styles, /\.me-results-empty-actions/);
  assert.match(styles, /\.me-results-empty-action\.is-primary/);
  assert.doesNotMatch(styles, /\.me-empty-invite/);
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

test("unified search prefers canonical registry aliases and keeps Nominatim as a bounded fallback", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(html, /data-api-place-search="\/api\/v1\/map\/place-search"/);
  assert.match(script, /function canonicalPlaceRows\(payload\)/);
  assert.match(script, /place\.osmSourceId/);
  assert.match(script, /function mergePlaceSearchCandidates\(canonicalRows, nominatimRows\)/);
  assert.match(script, /Promise\.all\(\[registryPromise, nominatimPromise\]\)/);
  assert.match(script, /verification_status/);
  assert.match(script, /pendingPlaceSearchRef/);
  assert.match(script, /props\.canonical_place_id/);
  assert.match(script, /props\.osm_type/);
  assert.match(script, /props\.osm_id/);
  assert.match(
    script,
    /\/\^\(node\|way\|relation\)\[:\/\]\(\[0-9\]\+\)\$\//,
  );
  assert.doesNotMatch(
    script,
    /\/\^\(node\|way\|relation\)\[:\/\]\(d\+\)\$\//,
  );
});

test("place search selection opens the area encyclopedia around the result", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const placeBody = script.slice(
    script.indexOf("function buildPlaceSearchRows"),
    script.indexOf("function runUnifiedSearch"),
  );

  assert.match(placeBody, /state\.tab = 'places';/);
  assert.match(script, /function isSensitivePlaceSearchRow\(row\)/);
  assert.match(script, /function safePlaceSearchOrigin\(row, lat, lng\)/);
  assert.match(script, /var precision = isSensitivePlaceSearchRow\(row\) \? 1000 : 10000;/);
  assert.match(placeBody, /state\.nearbyAreaOrigin = safePlaceSearchOrigin\(row, lat, lng\);/);
  assert.match(placeBody, /state\.nearbyAreaLocateMovePending = true;/);
  assert.match(placeBody, /syncUiFromState\(\);\s+applyTab\(state\.map, state\.tab\);/);
  assert.match(placeBody, /function refreshSearchAreaDiscovery\(\)/);
  assert.match(placeBody, /if \(areaDiscoveryFallbackTimer\) clearTimeout\(areaDiscoveryFallbackTimer\);/);
  assert.match(placeBody, /loadAreaPolygons\(\);\s+refreshNearbyAreaMarkers\(state\.nearbyAreaOrigin\);/);
  assert.match(placeBody, /var staysInPlace = currentCenter/);
  assert.match(placeBody, /state\.map\.once\('moveend', refreshSearchAreaDiscovery\);/);
  assert.match(placeBody, /areaDiscoveryFallbackTimer = setTimeout\(refreshSearchAreaDiscovery, 2000\);/);
  assert.match(placeBody, /maxZoom: sensitivePlaceSearch \? 12 : 14/);
  assert.match(placeBody, /state\.map\.fitBounds/);
  assert.match(placeBody, /state\.map\.flyTo/);
  assert.match(placeBody, /var canonicalSearchFeature = canonicalPlaceSearchFeature\(row, lat, lng\);/);
  assert.match(
    placeBody,
    /state\.pendingPlaceSearchRef = row\.canonical_place_id && !canonicalSearchFeature/,
  );
  assert.match(placeBody, /openAreaFeatureSheet\(canonicalSearchFeature, lat, lng\);/);

  const canonicalFeatureBody = script.slice(
    script.indexOf("function canonicalPlaceSearchFeature"),
    script.indexOf("function canonicalPlaceRows"),
  );
  assert.match(
    canonicalFeatureBody,
    /osmType !== 'way' && osmType !== 'relation'/,
  );
  assert.match(canonicalFeatureBody, /if \(!validBbox\) return null;/);
  assert.match(canonicalFeatureBody, /boundary_projection: 'safe_bbox'/);
  assert.doesNotMatch(canonicalFeatureBody, /pointCirclePolygon/);
});

test("place search origin stays local and is not persisted or sent as map telemetry", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const serializeBody = script.slice(
    script.indexOf("function serializeMapState"),
    script.indexOf("function saveMapState"),
  );
  const kpiBody = script.slice(
    script.indexOf("function sendMapKpi"),
    script.indexOf("function trackAreaDetailOpen"),
  );

  assert.doesNotMatch(serializeBody, /nearbyAreaOrigin/);
  assert.doesNotMatch(kpiBody, /nearbyAreaOrigin/);
});

test("map status distinguishes visible map readiness from record loading", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /"recordsLoading":"記録を読み込み中…"/);
  assert.match(script, /setStatus\(COPY\.recordsLoading\);/);
  assert.doesNotMatch(script, /setStatus\(COPY\.loading\);\s+setResultsLoadState\('loading'/);
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

test("community photo selection keeps nearby map context and opens the side panel", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const selectRecordBody = script.slice(
    script.indexOf("function selectRecord(record, options)"),
    script.indexOf("function openBottomSheet(record)"),
  );
  const moveendBody = script.slice(
    script.indexOf("state.map.on('moveend', function ()"),
    script.indexOf("// Empty-point tap"),
  );
  const consumeSuppressedViewportSearchBody = script.slice(
    script.indexOf("function consumeSuppressedViewportSearch()"),
    script.indexOf("function refreshViewportSearchData()"),
  );
  const refreshViewportSearchDataBody = script.slice(
    script.indexOf("function refreshViewportSearchData()"),
    script.indexOf("function scheduleViewportRefresh()"),
  );

  assert.match(selectRecordBody, /var preserveSurroundings = !!\(options && options\.preserveSurroundings\)/);
  assert.match(selectRecordBody, /var recordCellId = record\.cellId \|\| null/);
  assert.match(selectRecordBody, /state\.selectedCellId = preserveSurroundings \? null : recordCellId/);
  assert.match(selectRecordBody, /state\.suppressViewportSearchUntil = Date\.now\(\) \+ 5000;/);
  assert.match(selectRecordBody, /state\.suppressNextViewportSearch = true;/);
  assert.match(selectRecordBody, /state\.pendingViewportSearch = false;\s+clearViewportRefreshTimer\(\);\s+updateSearchAreaUi\(\);/);
  assert.match(selectRecordBody, /setSideRailMode\(false\);\s+setSideTab\('selection'\);/);
  assert.match(selectRecordBody, /if \(!preserveSurroundings && state\.lastStats && state\.lastStats\.selectedCellId !== state\.selectedCellId\) \{\s+loadRecords\(\{ cellId: state\.selectedCellId \}\);/);
  assert.match(consumeSuppressedViewportSearchBody, /var suppressViewportSearch = state\.suppressViewportSearchUntil\s+&& Date\.now\(\) <= state\.suppressViewportSearchUntil;/);
  assert.match(consumeSuppressedViewportSearchBody, /state\.pendingViewportSearch = false;[\s\S]+state\.lastSearchedBbox = resizedBbox;[\s\S]+return true;/);
  assert.match(refreshViewportSearchDataBody, /if \(consumeSuppressedViewportSearch\(\)\) return;/);
  assert.match(moveendBody, /if \(consumeSuppressedViewportSearch\(\)\) return;/);
});

test("community photo preview markers stay compact while allowing more visible places", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var maxCards = zoom >= 16 \? 18 : \(zoom >= 15 \? 14 : 10\);/);
  assert.match(script, /dedupeRecordsForSurface\(publicRecordsForSignedInSurface\(Array\.isArray\(state\.records\) \? state\.records\.slice\(\) : \[\]\), 'card'\)/);
  assert.match(script, /function suppressOwnerRepresentedPublicRecords\(publicRecords, ownedRecords\)/);
  assert.match(script, /recordHasExactCoordinateDisclosure\(record\)/);
  assert.match(script, /picked\.length >= maxCards/);
  assert.match(script, /var cellCounts = \{\};/);
  assert.match(script, /if \(cellCount >= \(zoom >= 15 \? 5 : 3\)\) return;/);
  assert.match(script, /\^\(同定待ち\|名前待ち\|名前を確認中\|名前確認中\|名前はあとで確認\|確認中\)\$/);
  assert.match(script, /var placementBadge = '範囲表示';/);
  assert.doesNotMatch(script, /var placementBadge = 'おおよその位置';/);
  assert.match(script, /sendMapKpi\('funnel_step', 'map:discovery_preview_open'/);
  assert.doesNotMatch(script, /me-community-photo-marker[\s\S]{0,120}is-exact/);
  assert.match(script, /\[0\.0022, 0\.0016\]/);
  assert.match(script, /center: \{ lng: center\.lng \+ offset\[0\], lat: center\.lat \+ offset\[1\] \}/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-discovery-preview \{\s+width: 50px;\s+min-height: 58px;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-discovery-preview\.is-grid \{[\s\S]*outline: 2px dashed rgba\(14,165,233,\.38\);/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-discovery-preview img,\s+\.me-discovery-preview i \{\s+width: 42px;\s+height: 31px;/);
  assert.match(MAP_EXPLORER_STYLES, /\.me-discovery-preview span \{\s+max-width: 42px;\s+min-height: 18px;[\s\S]+font-size: 8\.5px;/);
});

test("Japanese map detail labels avoid service-authored motivation headings", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.doesNotMatch(script, /行きたくなる理由|また見たくなること|見に行く理由|歩く理由|近くで見えたもの|この場所で見えたもの/);
  assert.match(script, /"siteBriefWhyHereLabel":"記録"/);
  assert.match(script, /"siteBriefWhyNowLabel":"季節"/);
  assert.match(script, /"siteBriefNextHookLabel":"次の手がかり"/);
  assert.match(script, /"walkableFindsTitle":"近くの記録"/);
});

test("map explorer keeps the map framed as a tool", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });

  assert.match(html, /me-map-kicker">探索する/);
  assert.match(html, /data-side="rail"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /me-map-role-strip/);
  assert.match(html, /近くを探索する/);
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
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.site-shell\.is-map-surface \.global-record-launcher \{\s*display: grid;\s*z-index: 72;[\s\S]*bottom: max\(8px, env\(safe-area-inset-bottom\)\);/);
  assert.match(styles, /--me-mobile-action-space: calc\(92px \+ max\(0px, env\(safe-area-inset-bottom\)\)\);/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-map \.maplibregl-ctrl-bottom-right \{\s*bottom: calc\(var\(--me-mobile-action-space\) \+ 4px\);\s*\}/);
});

test("mobile map filters open from the thumb zone above the record launcher", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.me-filter-panel \{[\s\S]*position: fixed;[\s\S]*top: auto;[\s\S]*bottom: calc\(var\(--me-mobile-action-space\) \+ 8px\);[\s\S]*z-index: 80;/);
  assert.match(styles, /\.me-filter-panel \{[\s\S]*backdrop-filter: blur\(12px\);/);
  assert.match(styles, /\.me-bottom-sheet \{[\s\S]*bottom: calc\(var\(--me-mobile-action-space\) \+ var\(--me-mobile-sheet-clearance\)\);/);
  assert.match(styles, /\.me-locate-fab \{ bottom: calc\(var\(--me-mobile-action-space\) \+ 8px\); \}/);
  assert.match(script, /document\.querySelectorAll\('\.me-filter-tab-chip'\)\.forEach/);
  assert.match(script, /switchMapTab\(t\);[\s\S]*closeFilterDrawer\(\);/);
});

test("map explorer shows the map role without taking over the service subject", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });

  assert.match(html, /class="me-map-role-strip"/);
  assert.match(html, /近くを探索する/);
  assert.match(html, /記録・ガイド・散策候補を見ながら、今いる場所から探索できます。/);
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
  assert.match(script, /searchAreaBtnEl\.addEventListener\('click', function \(\) \{\s+dismissPurposeHint\(\);\s+refreshViewportSearchData\(\);/);
});

test("map initial data load stays light and defers secondary panels", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var VIEWPORT_RECORD_LIMIT = 600;/);
  assert.match(script, /var CELL_RECORD_LIMIT = 1500;/);
  assert.match(script, /var recordLimit = scope && scope\.cellId \? CELL_RECORD_LIMIT : VIEWPORT_RECORD_LIMIT;/);
  assert.match(script, /function deferMapTask\(fn, delay\)/);
  assert.match(script, /deferMapTask\(function \(\) \{[\s\S]*loadEffortSummary\(\);[\s\S]*loadTraces\(\);[\s\S]*\}, reason === 'load' \? 220 : 420\);/);
});

test("map uses nearby startup location while keeping record page location explicit", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /function applyRestoredParams\(params, options\)/);
  assert.match(script, /var restoreViewport = !options \|\| options\.restoreViewport !== false;/);
  assert.match(script, /params = parseStateString\(localStorage\.getItem\(STATE_STORAGE_KEY\) \|\| ''\);[\s\S]*restoreViewport = false;/);
  assert.match(script, /applyRestoredParams\(params, \{ restoreViewport: restoreViewport \}\);/);
  assert.match(script, /if \(restoreViewport && params\.lng && params\.lat && params\.z\)/);
  assert.match(script, /function initialStartupViewport\(\)/);
  assert.match(script, /readLastStartupLocation\(\)/);
  assert.doesNotMatch(script, /requestStartupCurrentLocation\(\);/);
  assert.doesNotMatch(script, /requestStartupCurrentLocation\(\{ onlyIfGranted: false \}\)/);
  assert.match(script, /LAST_LOCATION_MAX_AGE_MS = 1000 \* 60 \* 60 \* 24 \* 30/);
  assert.match(script, /rememberLastStartupLocation\(lng, lat/);
  assert.doesNotMatch(script, /maybeAutoLocateOnFirstOpen/);
  assert.match(script, /locateFab\.addEventListener\('click'[\s\S]*navigator\.geolocation\.getCurrentPosition/);
});

test("heatmap and rain tabs keep area polygons selectable", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /show\(areaLayers, tab === 'heatmap' \|\| tab === 'places' \|\| tab === 'rain'\);/);
  assert.match(script, /show\(areaLabelLayers, tab === 'places' \|\| tab === 'rain'\);/);
  assert.match(script, /moveToTop\(\['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-name-priority', 'area-polygon-name', 'area-polygon-selected-halo', 'area-polygon-selected'\]\);/);
  assert.match(script, /moveToTop\(\['jma-rain-nowcast-layer', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-name-priority', 'area-polygon-name'\]\);/);
  assert.match(script, /8, 0\.11, 11, 0\.15, 14, 0\.28, 16\.5, 0\.42/);
  assert.match(script, /map\.setPaintProperty\('area-polygon-outline', 'line-width', tab === 'places' \|\| tab === 'rain'/);
  assert.match(script, /var markerLayers = \['observation-cell-dot', 'observation-cell-selected'\]/);
  assert.match(script, /var markerDetailLayers = \['observation-cell-outline', 'observation-cell-count', 'observation-cell-label'\]/);
  assert.match(script, /var viewerOwnedLayers = \['viewer-owned-observation-halo', 'viewer-owned-observation-dot'\]/);
  assert.match(script, /show\(markerDetailLayers, tab === 'markers'\);/);
  assert.match(script, /show\(viewerOwnedLayers, tab === 'markers'\);/);
});

test("area density and labels are staged by zoom instead of appearing all at once", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(script, /var areaLabelLayers = \['area-polygon-name-priority', 'area-polygon-name'\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?minzoom: 13\.2/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?maxzoom: 15\.35/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['!', \['in', \['get', 'access'\], \['literal', \['private', 'no', 'restricted'\]\]\]\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['match', \['get', 'source'\], \['osm_park', 'protected_area', 'osm_named_area'\], true, false\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['match', \['get', 'source'\], \['oecm', 'nature_symbiosis_site'\], true, false\]/);
  assert.match(script, /id: 'area-polygon-name-priority'[\s\S]*?\['>=', \['coalesce', \['get', 'area_ha'\], 0\], 35\]/);
  assert.doesNotMatch(script, /id: 'area-polygon-name-priority'[\s\S]*?\['school', 'osm_park'/);
  assert.match(script, /'text-opacity': \['interpolate', \['linear'\], \['zoom'\], 13\.2, 0, 13\.8, 0\.72, 15\.4, 0\.88\]/);
  assert.match(script, /'line-opacity', tab === 'places'[\s\S]*?8, 0\.55, 12, 0\.72, 15, 0\.96/);
  assert.match(script, /\['in', \['get', 'access'\], \['literal', \['private', 'no', 'restricted'\]\]\],[\s\S]*?'#dc2626'/);
  assert.match(script, /'line-width', tab === 'places' \|\| tab === 'rain'[\s\S]*?\['interpolate', \['linear'\], \['zoom'\]/);
  assert.match(script, /8, \['case'[\s\S]*?1\.4, 1\.2\]/);
  assert.match(script, /14, \['case'[\s\S]*?2\.4, 1\.6\]/);
  assert.match(script, /17, \['case'[\s\S]*?3\.2, 2\.2\]/);
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
