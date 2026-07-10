import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { getObservationEventStrings } from "../i18n/observationEventStrings.js";
import { renderCheckinBody } from "./observationEventCheckin.js";
import { renderEventCreateBody } from "./observationEventCreate.js";
import { renderEventListBody } from "./observationEventList.js";
import { renderObservationEventLiveBody } from "./observationEventLive.js";
import { renderOrganizerConsoleBody } from "./observationEventOrganizerConsole.js";
import { renderRecapBody } from "./observationEventRecap.js";
import type { ObservationEventRecap } from "../services/observationEventRecap.js";

const strings = getObservationEventStrings("ja");

function session(overrides: Partial<ObservationEventSessionRow> = {}): ObservationEventSessionRow {
  return {
    sessionId: "evt-wire-test",
    legacyEventId: null,
    eventCode: "WIRE1",
    title: "春の里山観察会",
    organizerUserId: "organizer-1",
    corporationId: null,
    plan: "community",
    primaryMode: "discovery",
    activeModes: ["discovery"],
    locationLat: 34.7,
    locationLng: 137.7,
    locationRadiusM: 600,
    startedAt: "2099-05-13T09:00:00.000Z",
    endedAt: null,
    targetSpecies: ["エナガ", "シジュウカラ"],
    config: {
      event_profile: {
        category: "family",
        target_age_label: "小学生以上",
        difficulty: "easy",
        walking_distance_km: 1.2,
        capacity: 24,
        registration_deadline: "2099-05-10T18:00:00.000Z",
        bring_items: ["飲み物", "帽子"],
        loan_items: ["双眼鏡"],
        rain_decision_at: "2099-05-13T07:00:00.000Z",
      },
      place_event: {
        place_label: "連理の木の下",
        meeting_point: "正門前ベンチ集合",
      },
    },
    fieldId: "field-1",
    templateSourceSessionId: null,
    createdAt: "2026-05-13T09:00:00.000Z",
    updatedAt: "2026-05-13T09:00:00.000Z",
    ...overrides,
  };
}

test("event list exposes browse filters, field entry, and event-ready card metadata", () => {
  const html = renderEventListBody([session()], strings, "ja");

  assert.match(html, /data-event-filter="live"/);
  assert.match(html, /初心者歓迎/);
  assert.match(html, /親子向け/);
  assert.match(html, /href="\/community\/fields"/);
  assert.match(html, /正門前ベンチ集合/);
  assert.match(html, /小学生以上/);
  assert.match(html, /1\.2km/);
  assert.match(html, /定員 24名/);
});

test("event create page groups organizer decisions into observation-event steps", () => {
  const html = renderEventCreateBody({ isAuthenticated: true, strings });

  assert.match(html, /id="evt-create-basic"/);
  assert.match(html, /id="evt-create-place"/);
  assert.match(html, /id="evt-create-participation"/);
  assert.match(html, /id="evt-create-day"/);
  assert.match(html, /id="evt-create-flow"/);
  assert.match(html, /id="evt-create-result"/);
  assert.match(html, /name="capacity"/);
  assert.match(html, /name="registration_deadline"/);
  assert.match(html, /name="target_age_label"/);
  assert.match(html, /name="difficulty"/);
  assert.match(html, /name="walking_distance_km"/);
  assert.match(html, /name="bring_items"/);
  assert.match(html, /name="loan_items"/);
  assert.match(html, /name="rain_decision_at"/);
  assert.match(html, /Public では正式な種リストとPDFレポート/);
});

test("checkin page gives participants practical readiness before joining", () => {
  const html = renderCheckinBody({ session: session(), teams: [], isAuthenticated: false });

  assert.match(html, /今日の集合場所/);
  assert.match(html, /正門前ベンチ集合/);
  assert.match(html, /持ち物/);
  assert.match(html, /飲み物/);
  assert.match(html, /貸出/);
  assert.match(html, /双眼鏡/);
  assert.match(html, /公開範囲と位置情報/);
  assert.match(html, /役割宣言/);
});

test("live and organizer surfaces keep operational controls in the first screen", () => {
  const liveHtml = renderObservationEventLiveBody({
    session: session({ startedAt: "2026-05-13T09:00:00.000Z" }),
    participantSelfId: null,
    isOrganizer: true,
    guestToken: null,
  });
  const consoleHtml = renderOrganizerConsoleBody(session({ startedAt: "2026-05-13T09:00:00.000Z" }));

  assert.match(liveHtml, /data-evt-live-title/);
  assert.match(liveHtml, /今日やること/);
  assert.match(liveHtml, /発見フィード/);
  assert.match(consoleHtml, /正式レポート/);
  assert.match(consoleHtml, /種リスト/);
  assert.match(consoleHtml, /参加URLをコピー/);
});

test("recap separates free sharing from Public outputs", () => {
  const recap: ObservationEventRecap = {
    session: session({ endedAt: "2099-05-13T10:00:00.000Z" }),
    permissions: { canManage: true },
    highlights: {
      observationCount: 4,
      guideSceneCount: 1,
      fieldScanCount: 1,
      uniqueSpeciesCount: 2,
      absencesCount: 0,
      participantsCount: 3,
      questsOffered: 0,
      questsAccepted: 0,
      questsCompleted: 0,
      fanfareCount: 0,
      totalEffortPersonHours: 2,
      meshCoveragePct: 20,
      topTaxa: [{ name: "エナガ", count: 2 }],
      startedAt: "2099-05-13T09:00:00.000Z",
      endedAt: "2099-05-13T10:00:00.000Z",
      durationMinutes: 60,
    },
    effort: {
      sessionId: "evt-wire-test",
      totalVisitedCells: 1,
      totalEffortSeconds: 7200,
      totalEffortPersonHours: 2,
      totalObservations: 4,
      totalAbsences: 0,
      coveragePct: 20,
    },
    teams: [],
    timeline: [],
    impacts: [],
    myContribution: null,
  };
  const html = renderRecapBody(recap);

  assert.match(html, /data-tab="public-output"/);
  assert.match(html, /無料利用では概要を共有できます/);
  assert.match(html, /Public では正式な種リストとPDFレポート/);
  assert.match(html, /種リストCSV/);
  assert.match(html, /希少種に配慮/);
});
