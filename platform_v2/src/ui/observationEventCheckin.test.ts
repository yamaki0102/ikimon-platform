import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { checkinScript, renderCheckinBody } from "./observationEventCheckin.js";

const session: ObservationEventSessionRow = {
  sessionId: "evt-checkin-test",
  legacyEventId: null,
  eventCode: "SOLO1",
  title: "明日の一人観察会",
  organizerUserId: "organizer-1",
  corporationId: null,
  plan: "community",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: 34.7,
  locationLng: 137.7,
  locationRadiusM: 80,
  startedAt: "2026-05-30T09:00:00.000Z",
  endedAt: null,
  targetSpecies: [],
  config: { solo_observation: true, place_event: { event_kind: "solo_micro_observation" } },
  fieldId: null,
  templateSourceSessionId: null,
  createdAt: "2026-05-29T09:00:00.000Z",
  updatedAt: "2026-05-29T09:00:00.000Z",
};

test("solo micro checkin skips team anxiety and opens the live field screen", () => {
  const html = renderCheckinBody({ session, teams: [], isAuthenticated: true });
  const script = checkinScript();

  assert.match(html, /data-solo-observation="true"/);
  assert.match(html, /班分けなしで開始/);
  assert.match(html, /開催範囲の補助として現在地を使う/);
  assert.doesNotMatch(html, /name="share_location" checked/);
  assert.match(script, /isSolo \? "\/live" : "\/rally"/);
  assert.doesNotMatch(script, /guest_token|guestToken|Math\.random|localStorage/);
  assert.doesNotMatch(script, /\?token=/);
  assert.match(script, /credentials: "include"/);
});
