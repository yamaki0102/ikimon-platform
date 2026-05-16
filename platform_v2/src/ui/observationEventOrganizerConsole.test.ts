import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { organizerConsoleScript, renderOrganizerConsoleBody } from "./observationEventOrganizerConsole.js";

const session: ObservationEventSessionRow = {
  sessionId: "evt-organizer-rally-test",
  legacyEventId: null,
  eventCode: "ORG1",
  title: "主催者ラリー",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: 34.7,
  locationLng: 137.7,
  locationRadiusM: 30,
  startedAt: "2026-05-16T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-05-16T09:00:00.000Z",
  updatedAt: "2026-05-16T09:00:00.000Z",
};

test("organizer console exposes one-click rain fallback switching", () => {
  const html = renderOrganizerConsoleBody(session);
  const script = organizerConsoleScript();

  assert.match(html, /data-rally-weather-rain/);
  assert.match(html, /name="fallback_group"/);
  assert.match(script, /rally\/preflight\/weather-mode/);
  assert.match(script, /mode: "rain"/);
  assert.match(script, /進捗は消えません/);
});
