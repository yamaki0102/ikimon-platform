import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventStrings } from "../i18n/strings.js";
import { OBSERVATION_EVENT_STYLES } from "./observationEventStyles.js";
import { eventCreateScript, renderEventCreateBody } from "./observationEventCreate.js";

const strings = {
  listCreateCta: "観察会を作る",
  modeLabels: {
    discovery: "Discovery",
    effort_maximize: "Effort",
    bingo: "Bingo",
    absence_confirm: "Absence",
    ai_quest: "おすすめ",
  },
} as ObservationEventStrings;

test("event create form includes the area planner map surface for authenticated organizers", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });

  assert.match(html, /data-evt-area-map/);
  assert.match(html, /開催エリアを指定する地図/);
  assert.match(html, /地図を読み込めない場合/);
});

test("event create form treats fixed place event fields and source modes as first-class", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /name="place_label"/);
  assert.match(html, /name="meeting_point"/);
  assert.match(html, /name="source_mode_record"/);
  assert.match(html, /name="source_mode_guide"/);
  assert.match(html, /name="source_mode_field_scan"/);
  assert.match(html, /name="public_story_enabled"/);
  assert.match(html, /name="ai_recap_enabled"/);
  assert.match(script, /place_event/);
  assert.match(script, /source_modes/);
  assert.match(script, /consent_policy_version: "place_event_capsule\/v1"/);
});

test("event create script hydrates MapLibre with CDN fallback and field_id preselection", () => {
  const script = eventCreateScript();

  assert.match(script, /maplibre-gl@4\.7\.1/);
  assert.match(script, /cdn\.jsdelivr\.net/);
  assert.match(script, /unpkg\.com/);
  assert.match(script, /data-evt-area-map/);
  assert.match(script, /is-map-ready/);
  assert.match(script, /get\("field_id"\)/);
});

test("event create map can load and select registered fields", () => {
  const script = eventCreateScript();

  assert.match(script, /evt-registered-fields/);
  assert.match(script, /evt-field-selected/);
  assert.match(script, /evt-field-current-selection/);
  assert.match(script, /evt-selected-field-fill/);
  assert.match(script, /evt-field-label/);
  assert.match(script, /evt-field-map-label/);
  assert.match(script, /\/api\/v1\/fields\?nearby=/);
  assert.match(script, /selectFieldFromMap/);
  assert.match(script, /queryRenderedFeatures\(point, \{ layers: \["evt-field-fill"\] \}/);
});

test("event create map does not render manual circles while a registered field is selected", () => {
  const script = eventCreateScript();

  assert.match(script, /showManualArea = !areaState\.selectedFieldId/);
  assert.match(script, /selectedFieldFeatureCollection/);
  assert.match(script, /hasPolygon/);
  assert.match(script, /is-registered-area-selected/);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-planner\.is-registered-area-selected \.evt-area-modebar\s*\{[^}]*display: none/s);
});

test("event create form unifies registered field search with map selection", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-field-search/);
  assert.match(html, /data-evt-field-search-results/);
  assert.match(script, /runFieldSearch/);
  assert.match(script, /\/api\/v1\/fields\?q=/);
  assert.match(script, /renderSearchResults/);
});

test("event create script keeps map drafts before MapLibre initialization", () => {
  const script = eventCreateScript();

  assert.match(script, /applyAreaDraftFromParams\(\);\s*initAreaMap\(\);/s);
  assert.match(script, /pendingFocus/);
  assert.match(script, /focusPendingArea/);
});

test("event create area suggestions expose baseline undo and shape previews", () => {
  const script = eventCreateScript();

  assert.match(script, /aiBaseline/);
  assert.match(script, /範囲を整える前の範囲に戻しました/);
  assert.match(script, /evt-area-preview/);
  assert.match(script, /setAiProgress/);
});

test("event create visible copy stays free of runtime and internal tool names", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });

  assert.doesNotMatch(html, /Worker|D1|Cloudflare|API|Area Sketch Assist|AIで|AI候補|センサースキャン/);
  assert.match(html, /範囲を整える/);
  assert.match(html, /振り返りの下書きを作る/);
});

test("event create area planner can save an Area Sketch Assist draft assessment", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-area-sketch-save/);
  assert.match(html, /下書き診断を保存/);
  assert.match(html, /区域内のざっくり分類/);
  assert.match(html, /data-category="agricultural_land"/);
  assert.match(html, /data-category="trees_planting"/);
  assert.match(html, /data-category="grassland"/);
  assert.match(html, /data-category="water_edge"/);
  assert.match(html, /data-category="building"/);
  assert.match(html, /data-category="pavement_parking"/);
  assert.match(html, /data-category="unknown"/);
  assert.match(script, /saveAreaSketchAssessmentDraft/);
  assert.match(script, /collectAreaSketchLandCover/);
  assert.match(script, /if \(total < 100\)/);
  assert.match(script, /resolveFieldForEvent\(fd, lat, lng, radius\)/);
  assert.match(script, /\/api\/v1\/fields\/" \+ encodeURIComponent\(fieldId\) \+ "\/area-sketch-assessments/);
  assert.match(script, /land_cover: landCover/);
  assert.doesNotMatch(script, /land_cover: \[\{ category: "unknown", ratio: 1 \}\]/);
  assert.match(script, /policy_version: "tsunag_2026_current"/);
  assert.match(script, /visibility: "private"/);
  assert.match(script, /source: "observation_event_area_planner"/);
  assert.match(script, /classification_status: hasKnownLandCover\(landCover\) \? "user_estimated" : "not_started"/);
  assert.match(script, /下書き診断を保存しました/);
});

test("event create area planner previews saved Area Sketch Assist draft results", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-area-sketch-preview hidden/);
  assert.match(html, /保存後の概算/);
  assert.match(html, /data-evt-area-sketch-preview-summary/);
  assert.match(html, /data-evt-area-sketch-preview-thresholds/);
  assert.match(html, /data-evt-area-sketch-preview-evidence/);
  assert.match(html, /不足資料リスト/);
  assert.match(script, /function renderAreaSketchAssessmentPreview\(assessment, fieldId\)/);
  assert.match(script, /const result = assessment && assessment\.resultPayload/);
  assert.match(script, /greenRatioPercent/);
  assert.match(script, /evidenceChecklist/);
  assert.match(script, /renderAreaSketchAssessmentPreview\(data\?\.assessment, fieldId\)/);
  assert.match(script, /areaSketchFieldLink\.href = "\/community\/fields\/" \+ encodeURIComponent\(fieldId\)/);
  assert.match(script, /正式申請、測量、行政判断、認定取得を保証するものではありません/);
});

test("event create land-cover panel has stable responsive controls", () => {
  const styles = OBSERVATION_EVENT_STYLES;

  assert.match(styles, /\.evt-land-cover-panel\s*\{/);
  assert.match(styles, /\.evt-land-cover-grid\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(210px, 1fr\)\)/);
  assert.match(styles, /\.evt-land-cover-row\s*\{[\s\S]*grid-template-columns: minmax\(78px, auto\) minmax\(0, 1fr\) 44px/);
  assert.match(styles, /\.evt-land-cover-row input\[type="range"\]\s*\{[\s\S]*accent-color: var\(--evt-accent-discovery\)/);
  assert.match(styles, /\.evt-area-sketch-preview\s*\{/);
  assert.match(styles, /\.evt-area-sketch-preview-summary\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.evt-area-sketch-preview-thresholds span\.is-reached\s*\{/);
  assert.match(styles, /\.evt-area-sketch-preview-evidence li\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*\.evt-land-cover-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*\.evt-area-sketch-preview-summary \{ grid-template-columns: 1fr; \}/);
});

test("event create flow generates announcement copy from selected place and area", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-announcement/);
  assert.match(html, /data-evt-announcement-generate/);
  assert.match(script, /buildAnnouncementDraft/);
  assert.match(script, /refreshAnnouncementDraft/);
  assert.match(script, /announcement_text/);
  assert.match(script, /suggestTitleFromPlace/);
});

test("event create flow exposes a solo micro observation preset for narrow field sessions", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-solo-preset/);
  assert.match(html, /name="solo_observation"/);
  assert.match(html, /半径 80m/);
  assert.match(html, /name="location_radius_m" type="number" min="30"/);
  assert.match(script, /applySoloPreset/);
  assert.match(script, /solo_micro_observation/);
  assert.match(script, /stand_still_3min/);
  assert.match(script, /location_radius_m.*80/s);
});

test("event area map keeps a fixed height after MapLibre CSS loads", () => {
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell\s*\{[^}]*height: 360px/s);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell > \.evt-area-map\.maplibregl-map\s*\{[^}]*height: 100%/s);
});
