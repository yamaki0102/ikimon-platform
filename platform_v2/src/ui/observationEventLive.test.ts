import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { observationEventLiveScript, renderObservationEventLiveBody } from "./observationEventLive.js";

const session: ObservationEventSessionRow = {
  sessionId: "evt-live-test",
  legacyEventId: null,
  eventCode: "LIVE1",
  title: "連理の木の下 観察会",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: 34.7,
  locationLng: 137.7,
  locationRadiusM: 30,
  startedAt: "2026-05-13T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: {},
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-05-13T09:00:00.000Z",
  updatedAt: "2026-05-13T09:00:00.000Z",
};

test("live event actions expose record, guide, and field scan entry points with shared event context", () => {
  const html = renderObservationEventLiveBody({
    session,
    participantSelfId: null,
    isOrganizer: false,
    guestToken: null,
  });
  const script = observationEventLiveScript();

  assert.match(html, /data-action="record"/);
  assert.match(html, /data-action="guide"/);
  assert.match(html, /data-action="scan"/);
  assert.match(script, /eventSessionId/);
  assert.match(script, /fieldScanMode/);
  assert.match(script, /\/guide/);
  assert.match(script, /guide_scene_added/);
  assert.match(script, /field_scan_added/);
});
