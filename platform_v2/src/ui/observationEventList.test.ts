import assert from "node:assert/strict";
import test from "node:test";
import { getObservationEventStrings } from "../i18n/observationEventStrings.js";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { renderEventListBody } from "./observationEventList.js";

const session: ObservationEventSessionRow = {
  sessionId: "session-1",
  legacyEventId: null,
  eventCode: "INVITE1",
  title: "川辺を歩く会",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "ai_quest",
  activeModes: ["ai_quest"],
  locationLat: null,
  locationLng: null,
  locationRadiusM: 1000,
  startedAt: "2026-08-30T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-08-29T09:00:00.000Z",
  updatedAt: "2026-08-29T09:00:00.000Z",
};

test("event list uses plain participant-facing copy", () => {
  const html = renderEventListBody([session], getObservationEventStrings("ja"), "ja");

  assert.match(html, /みんなで観察する/);
  assert.match(html, /川辺を歩く会/);
  assert.doesNotMatch(html, /Observation Event OS|Worker|D1|Cloudflare|API|AI Quest|AI クエスト/);
  assert.doesNotMatch(html, /<p class="evt-lead"><\/p>/);
});
