import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { observationRallyScript, renderObservationRallyBody } from "./observationRally.js";

const session: ObservationEventSessionRow = {
  sessionId: "evt-rally-test",
  legacyEventId: null,
  eventCode: "RALLY1",
  title: "街なか観察ラリー",
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

test("rally participant screen mixes bound and unbound missions without navigation", () => {
  const html = renderObservationRallyBody({ session, guestToken: "guest-1", isOrganizer: false });
  const script = observationRallyScript();

  assert.match(html, /data-rally-next-action/);
  assert.match(html, /data-rally-live-bars/);
  assert.match(html, /data-rally-missions/);
  assert.match(html, /data-rally-stations/);
  assert.match(html, /data-rally-location-start/);
  assert.match(script, /station_required/);
  assert.match(script, /none: "どこでも"/);
  assert.match(script, /rally_goal_exceeded/);
  assert.match(script, /\/api\/v1\/observation-events\/" \+ sessionId \+ "\/location/);
});
