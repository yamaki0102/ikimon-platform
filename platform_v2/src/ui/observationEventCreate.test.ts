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
    ai_quest: "AI Quest",
  },
} as ObservationEventStrings;

test("event create form includes the area planner map surface for authenticated organizers", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });

  assert.match(html, /data-evt-area-map/);
  assert.match(html, /開催エリアを指定する地図/);
  assert.match(html, /地図を読み込めない場合/);
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

test("event create AI suggestions expose baseline undo and shape previews", () => {
  const script = eventCreateScript();

  assert.match(script, /aiBaseline/);
  assert.match(script, /AIで整える前の範囲に戻しました/);
  assert.match(script, /evt-area-preview/);
  assert.match(script, /setAiProgress/);
});

test("event create flow generates announcement copy from selected place and AI area", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });
  const script = eventCreateScript();

  assert.match(html, /data-evt-announcement/);
  assert.match(html, /data-evt-announcement-generate/);
  assert.match(script, /buildAnnouncementDraft/);
  assert.match(script, /refreshAnnouncementDraft/);
  assert.match(script, /announcement_text/);
  assert.match(script, /suggestTitleFromPlace/);
});

test("event area map keeps a fixed height after MapLibre CSS loads", () => {
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell\s*\{[^}]*height: 360px/s);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell > \.evt-area-map\.maplibregl-map\s*\{[^}]*height: 100%/s);
});
