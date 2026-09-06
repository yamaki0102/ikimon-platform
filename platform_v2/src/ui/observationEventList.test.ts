import assert from "node:assert/strict";
import test from "node:test";
import { getObservationEventStrings } from "../i18n/observationEventStrings.js";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { renderEventListBody } from "./observationEventList.js";

const HOUR = 60 * 60 * 1000;

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
  startedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
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
  assert.match(html, /今、参加できる/);
  assert.match(html, /詳しく見る/);
  assert.match(html, /data-organizer-entry/);
  assert.match(html, /企画を運営する方へ/);
  assert.doesNotMatch(html, /evt-hero/);
  assert.doesNotMatch(html, /今日のヒント|ai_quest|AI Quest|AI クエスト/);

  const participantRow = html.match(/<article class="zukan-participation-row"[^>]*data-participation-kind="actionable">[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(participantRow, /川辺を歩く会/);
  assert.match(participantRow, /受付中/);
  assert.doesNotMatch(participantRow, /観察会を作る|もう一度開催/);
});

test("upcoming sessions are grouped apart from currently actionable ones", () => {
  const upcoming: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-upcoming",
    eventCode: "SOON1",
    title: "秋の夜の生きもの観察",
    startedAt: new Date(Date.now() + 48 * HOUR).toISOString(),
  };
  const html = renderEventListBody([session, upcoming], getObservationEventStrings("ja"), "ja");

  assert.match(html, /これから/);
  const upcomingRow = html.match(/<article class="zukan-participation-row"[^>]*data-participation-kind="upcoming">[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(upcomingRow, /秋の夜の生きもの観察/);
  assert.match(upcomingRow, /開催予定/);
  assert.match(upcomingRow, /詳しく見る/);

  const actionableRow = html.match(/<article class="zukan-participation-row"[^>]*data-participation-kind="actionable">[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.doesNotMatch(actionableRow, /秋の夜の生きもの観察/);
});

test("ended events are kept behind explicit history with a recap action", () => {
  const ended: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-2",
    eventCode: "PAST1",
    title: "春の観察会",
    startedAt: "2026-03-30T00:00:00.000Z",
    endedAt: "2026-03-30T02:00:00.000Z",
  };
  const html = renderEventListBody([session, ended], getObservationEventStrings("ja"), "ja");

  assert.match(html, /<details class="zukan-participation-history">/);
  assert.match(html, /これまでの活動/);
  const historyRow = html.match(/<article class="zukan-participation-row"[^>]*data-participation-kind="ended">[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(historyRow, /春の観察会/);
  assert.match(historyRow, /終了/);
  assert.match(historyRow, /振り返る/);
  assert.match(historyRow, /\/events\/session-2\/recap/);
});

test("cancelled sessions read as cancelled truth, not as joinable or merely ended", () => {
  const cancelled: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-cancelled",
    eventCode: "CXL1",
    title: "中止になった川の調査",
    endedAt: null,
    config: { status: "cancelled" },
  };
  const html = renderEventListBody([cancelled], getObservationEventStrings("ja"), "ja");

  const cancelledRow = html.match(/<article class="zukan-participation-row"[^>]*data-participation-kind="cancelled">[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(cancelledRow, /中止になった川の調査/);
  assert.match(cancelledRow, /中止/);
  assert.doesNotMatch(cancelledRow, /詳しく見る|受付中|開催予定/);
  // Not surfaced as an actionable row.
  assert.doesNotMatch(html, /data-participation-kind="actionable"/);
});

test("sessions without a public event code are not advertised as joinable", () => {
  const privateLive: ObservationEventSessionRow = {
    ...session,
    sessionId: "session-private",
    eventCode: null,
    title: "公開参加コードなし",
  };
  const html = renderEventListBody([privateLive], getObservationEventStrings("ja"), "ja");

  assert.match(html, /いま参加できる企画はありません/);
  assert.doesNotMatch(html, /公開参加コードなし/);
  assert.match(html, /みんなの記録を見る/);
});

test("zero results and load failure are distinct states", () => {
  const zero = renderEventListBody([], getObservationEventStrings("ja"), "ja");
  assert.match(zero, /いま参加できる企画はありません/);
  assert.match(zero, /掲載中の公開企画はまだありません/);
  assert.doesNotMatch(zero, /読み込めませんでした/);
  assert.doesNotMatch(zero, /data-load-failed/);

  const failed = renderEventListBody([], getObservationEventStrings("ja"), "ja", {
    loadFailed: true,
    retryHref: "/community/events",
  });
  assert.match(failed, /企画を読み込めませんでした/);
  assert.match(failed, /data-load-failed/);
  assert.match(failed, /href="\/community\/events"[^>]*>再読み込み</);
  assert.doesNotMatch(failed, /掲載中の公開企画はまだありません/);
});

test("load failure keeps already-loaded rows visible above the retry notice", () => {
  const html = renderEventListBody([session], getObservationEventStrings("ja"), "ja", {
    loadFailed: true,
    retryHref: "/community/events",
  });
  assert.match(html, /川辺を歩く会/);
  assert.match(html, /data-load-failed/);
  const noticeIndex = html.indexOf("data-load-failed");
  const rowIndex = html.indexOf('data-participation-kind="actionable"');
  assert.ok(noticeIndex >= 0 && rowIndex >= 0);
  assert.ok(noticeIndex < rowIndex, "retry notice should precede the preserved rows");
});
