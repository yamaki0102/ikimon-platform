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

test("event list is participant-first and separates organizer actions", () => {
  const html = renderEventListBody([session], getObservationEventStrings("ja"), "ja");

  assert.match(html, /<h1>参加<\/h1>/);
  assert.match(html, /参加方法を確認/);
  assert.match(html, /data-organizer-entry/);
  assert.match(html, /企画を運営する方へ/);
  assert.doesNotMatch(html, /evt-hero/);
  assert.doesNotMatch(html, /今日のヒント|ai_quest|AI Quest|AI クエスト/);

  const participantRow = html.match(/<article class="zukan-participation-row" data-participation-result>[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(participantRow, /川辺を歩く会/);
  assert.doesNotMatch(participantRow, /観察会を作る|もう一度開催/);
});

test("ended events are kept behind explicit history", () => {
  const ended: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-2",
    eventCode: "PAST1",
    title: "春の観察会",
    endedAt: "2026-08-30T11:00:00.000Z",
  };
  const html = renderEventListBody([session, ended], getObservationEventStrings("ja"), "ja");

  assert.match(html, /<details class="zukan-participation-history">/);
  assert.match(html, /これまでの活動/);
  assert.match(html, /春の観察会/);
  assert.match(html, /振り返る/);
});

test("sessions without a public event code are not advertised as joinable", () => {
  const privateLive: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-private",
    eventCode: null,
    title: "公開参加コードなし",
  };
  const html = renderEventListBody([privateLive], getObservationEventStrings("ja"), "ja");

  assert.match(html, /いま参加できる観察会はありません/);
  assert.doesNotMatch(html, /公開参加コードなし/);
  assert.match(html, /みんなの記録を見る/);
});
