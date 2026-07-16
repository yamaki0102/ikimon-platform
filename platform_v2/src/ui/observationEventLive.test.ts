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
  assert.match(script, /params\.set\("start", "photo"\)/);
  assert.match(script, /radiusM <= 100 \? 18/);
  assert.match(script, /fallbackLat = Number\(mapEl\?\.dataset\.centerLat\)/);
  assert.doesNotMatch(html, /data-guest-token/);
  assert.doesNotMatch(script, /guest_token|guestToken/);
  assert.match(script, /new EventSource\(url, \{ withCredentials: true \}\)/);
});

test("live page gives solo micro sessions a field cockpit", () => {
  const html = renderObservationEventLiveBody({
    session: {
      ...session,
      config: { solo_observation: true, place_event: { event_kind: "solo_micro_observation" } },
      locationRadiusM: 80,
    },
    participantSelfId: null,
    isOrganizer: false,
  });

  assert.match(html, /evt-solo-cockpit/);
  assert.match(html, /data-solo-observation="true"/);
  assert.match(html, /現地ループ/);
  assert.match(html, /0 \/ 3 アクション/);
  assert.match(html, /半径 80メートル/);
  assert.match(html, /3分止まる/);
});
