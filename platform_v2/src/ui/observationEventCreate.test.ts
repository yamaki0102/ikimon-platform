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

test("event area map keeps a fixed height after MapLibre CSS loads", () => {
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell\s*\{[^}]*height: 360px/s);
  assert.match(OBSERVATION_EVENT_STYLES, /\.evt-area-map-shell > \.evt-area-map\.maplibregl-map\s*\{[^}]*height: 100%/s);
});
