import test from "node:test";
import assert from "node:assert/strict";
import { renderFieldDetailBody } from "./observationFieldDetail.js";
import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import type { AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";

function field(): ObservationField {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    source: "user_defined",
    adminLevel: "osm_park",
    name: "牧志公園",
    nameKana: "",
    summary: "",
    prefecture: "沖縄県",
    city: "那覇市",
    lat: 26.2179484,
    lng: 127.6918878,
    radiusM: 50,
    polygon: null,
    areaHa: null,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.45,
    verificationLevel: "unverified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    entityKey: "",
    validFrom: null,
    validTo: null,
    supersededBy: null,
    payload: {},
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  };
}

function stats(): FieldStats {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 0,
    uniqueSpeciesCount: 0,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [],
    recentSessions: [],
  };
}

function snapshot(): AreaPlaceSnapshot {
  return {
    field: { fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79" },
    observationSummary: {
      totalObservations: 50,
      totalVisits: 19,
      totalEvents: 0,
      liveEvents: 0,
      uniqueTaxa: 43,
      latestObservedAt: "2026-05-08T10:30:00.000Z",
      taxonRankCount: 4,
      seasonsCovered: 1,
      seasonCoverageCap: 4,
      seasonLabels: ["春"],
      effortCompletionRate: 0,
      reviewAcceptedRate: 1,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 50,
      absentRecords: 0,
      stewardshipActionCount: 0,
      topTaxa: [],
    },
    relationshipScore: { score: { totalScore: 20 } },
    observationGallery: [],
    seasonalCoverage: [],
  } as unknown as AreaPlaceSnapshot;
}

test("field detail hero uses place snapshot observations when event stats are empty", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.match(html, /<strong>19<\/strong><span>記録回数<\/span>/);
  assert.match(html, /<strong>43<\/strong><span>累計種数<\/span>/);
  assert.match(html, /<strong>50<\/strong><span>累計観察<\/span>/);
  assert.match(html, /<span>最終観察<\/span><strong>2026年5月8日<\/strong>/);
  assert.doesNotMatch(html, /<strong>0<\/strong><span>開催回数<\/span>/);
});
