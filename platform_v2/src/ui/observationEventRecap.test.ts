import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEventRecap } from "../services/observationEventRecap.js";
import { renderRecapBody } from "./observationEventRecap.js";

function recap(canManage: boolean): ObservationEventRecap {
  return {
    session: {
      sessionId: "evt-recap-test",
      legacyEventId: null,
      eventCode: "RECAP1",
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
      endedAt: "2026-05-13T10:00:00.000Z",
      targetSpecies: [],
      config: {},
      fieldId: null,
      templateSourceSessionId: null,
      createdAt: "2026-05-13T09:00:00.000Z",
      updatedAt: "2026-05-13T10:00:00.000Z",
    },
    permissions: { canManage },
    highlights: {
      observationCount: 1,
      guideSceneCount: 1,
      fieldScanCount: 1,
      uniqueSpeciesCount: 1,
      absencesCount: 0,
      participantsCount: 3,
      questsOffered: 0,
      questsAccepted: 0,
      questsCompleted: 0,
      fanfareCount: 0,
      totalEffortPersonHours: 1,
      meshCoveragePct: 10,
      topTaxa: [{ name: "クスノキ", count: 1 }],
      startedAt: "2026-05-13T09:00:00.000Z",
      endedAt: "2026-05-13T10:00:00.000Z",
      durationMinutes: 60,
    },
    effort: {
      sessionId: "evt-recap-test",
      totalVisitedCells: 1,
      totalEffortSeconds: 3600,
      totalEffortPersonHours: 1,
      totalObservations: 1,
      totalAbsences: 0,
      coveragePct: 10,
    },
    teams: [],
    timeline: [],
    impacts: [],
    myContribution: null,
  };
}

test("recap capsule controls are organizer-only", () => {
  const organizerHtml = renderRecapBody(recap(true));
  const publicHtml = renderRecapBody(recap(false));

  assert.match(organizerHtml, /data-can-manage="true"/);
  assert.match(organizerHtml, /data-capsule-generate/);
  assert.match(publicHtml, /data-can-manage="false"/);
  assert.doesNotMatch(publicHtml, /data-capsule-generate/);
});
