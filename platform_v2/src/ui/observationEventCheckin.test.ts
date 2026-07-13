import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { buildStagingFixturePredicate } from "../services/stagingFixtureGuard.js";
import { checkinScript, renderCheckinBody } from "./observationEventCheckin.js";

const soloSession: ObservationEventSessionRow = {
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

const familySession: ObservationEventSessionRow = {
  ...soloSession,
  sessionId: "session-renri-test",
  eventCode: "RENRI0719",
  title: "連理の木の下で サイエンスアドベンチャー",
  config: {},
};

test("solo micro checkin skips team anxiety and opens the live field screen", () => {
  const html = renderCheckinBody({ session: soloSession, teams: [], isAuthenticated: true });
  const script = checkinScript();

  assert.match(html, /data-solo-observation="true"/);
  assert.match(html, /班分けなしで開始/);
  assert.match(html, /開催範囲の補助として現在地を使う/);
  assert.match(script, /isSolo \? "\/live" : "\/rally"/);
  assert.match(script, /encodeURIComponent\(guestToken\)/);
});

test("family check-in explains one-device guest participation and authenticated identity", () => {
  const guestBody = renderCheckinBody({ session: familySession, teams: [], isAuthenticated: false });
  assert.match(guestBody, /家族・グループは、スマホ1台で参加できます/);
  assert.match(guestBody, /登録なしのゲスト参加/);
  assert.match(guestBody, /data-guardian-consent-row hidden/);
  assert.match(guestBody, /data-evt-checkin-status/);
  assert.match(guestBody, /data-evt-register-link/);
  assert.match(guestBody, /\/register\?redirect=%2Fcommunity%2Fevents%2FRENRI0719%2Fjoin/);
  assert.match(guestBody, /この観察会へ戻ります/);
  assert.match(guestBody, /入力した参加情報も同じ端末に復元します/);

  const authenticatedBody = renderCheckinBody({ session: familySession, teams: [], isAuthenticated: true });
  assert.match(authenticatedBody, /data-authenticated="true"/);
  assert.match(authenticatedBody, /イベント用のゲストIDは作りません/);
  assert.doesNotMatch(authenticatedBody, /data-evt-register-link/);
});

test("check-in script scopes identity, restores registration draft, and supports retry", () => {
  const script = checkinScript();
  assert.match(script, /evt-guest-token:" \+ sessionId/);
  assert.match(script, /evt-checkin-draft:" \+ sessionId/);
  assert.match(script, /sessionStorage\.setItem\(draftStorageKey\(\)/);
  assert.match(script, /restoreDraft\(\)/);
  assert.match(script, /sessionStorage\.removeItem\(draftStorageKey\(\)/);
  assert.match(script, /if \(isAuthenticated\) return null/);
  assert.match(script, /入力内容は残っています/);
  assert.match(script, /同じボタンでもう一度/);
  assert.doesNotMatch(script, /localStorage\.getItem\("evt-guest-token"\)/);
});

test("registered staging fixture users are removable by their test email prefix", () => {
  const predicate = buildStagingFixturePredicate({ userIdColumn: "u.user_id" }, "rally-smoke-renri-123");
  assert.match(predicate, /u\.user_id/);
  assert.match(predicate, /u\.email/);
  assert.match(predicate, /rally-smoke-renri-123/);
});

test("legacy PR-numbered production rally sessions are classified as QA fixtures", () => {
  const predicate = buildStagingFixturePredicate({ titleColumn: "s.title" });
  assert.match(predicate, /pr\[0-9\]\+/i);
  assert.match(predicate, /rally\|smoke\|test/i);
});
