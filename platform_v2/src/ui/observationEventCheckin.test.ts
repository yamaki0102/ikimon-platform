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

test("solo micro checkin reads as a participant action and opens the live field screen", () => {
  const html = renderCheckinBody({ session, teams: [], isAuthenticated: true });
  const script = checkinScript();

  assert.match(html, /data-solo-observation="true"/);
  assert.match(html, />参加受付</);
  assert.match(html, /参加に必要な情報を確認して、受付を完了します/);
  assert.match(html, /受付して参加する/);
  assert.match(html, /開催範囲の補助として現在地を使う/);
  assert.doesNotMatch(html, /「発見」モード|努力量|AI クエスト/);
  assert.doesNotMatch(html, /班を選ぶ|班分けなし/);
  assert.doesNotMatch(html, /name="share_location" checked/);
  assert.match(html, /data-evt-checkin-error role="alert"/);

  assert.match(script, /showError\("未成年の位置共有には/);
  assert.match(script, /参加手続きを完了できませんでした/);
  assert.match(script, /通信できませんでした/);
  assert.doesNotMatch(script, /alert\(/);
  assert.match(script, /isSolo \? "\/live" : "\/rally"/);
  assert.doesNotMatch(script, /guest_token|guestToken|Math\.random|localStorage/);
  assert.doesNotMatch(script, /\?token=/);
  assert.match(script, /credentials: "include"/);
});

test("team checkin keeps the actual team choice and one participant CTA", () => {
  const html = renderCheckinBody({
    session: { ...session, config: {}, title: "まちなか観察会" },
    teams: [{ teamId: "team-1", name: "A班", color: "#123456", memberCount: 3 }],
    isAuthenticated: false,
  });

  assert.match(html, /班を選ぶ/);
  assert.match(html, /name="team_id" value="team-1"/);
  assert.match(html, /ゲスト参加の記録とふり返り/);
  assert.equal((html.match(/受付して参加する/g) ?? []).length, 1);
});
