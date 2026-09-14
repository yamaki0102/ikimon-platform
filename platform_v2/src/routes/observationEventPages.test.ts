import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { loadObservationEventSessionDetails } from "./observationEventPages.js";

const session = (sessionId: string): ObservationEventSessionRow => ({
  sessionId,
  legacyEventId: null,
  eventCode: `EVENT-${sessionId}`,
  title: `企画 ${sessionId}`,
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: null,
  locationLng: null,
  locationRadiusM: 0,
  startedAt: "2026-09-14T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-09-14T08:00:00.000Z",
  updatedAt: "2026-09-14T08:00:00.000Z",
});

test("session detail load reports partial failures without dropping successful rows", async () => {
  const result = await loadObservationEventSessionDetails(["ok", "failed"], async (sessionId) => {
    if (sessionId === "failed") throw new Error("detail read failed");
    return session(sessionId);
  });

  assert.deepEqual(result.sessions.map((row) => row.sessionId), ["ok"]);
  assert.equal(result.loadFailed, true);
});

test("session detail load keeps an all-failure result distinct from a valid empty result", async () => {
  const result = await loadObservationEventSessionDetails(["failed-1", "failed-2"], async () => {
    throw new Error("detail read failed");
  });

  assert.deepEqual(result.sessions, []);
  assert.equal(result.loadFailed, true);
});
