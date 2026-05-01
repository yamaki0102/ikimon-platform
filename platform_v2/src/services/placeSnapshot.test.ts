import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ObservationField, FieldStats } from "./observationFieldRegistry.js";
import { composePlaceSnapshot } from "./placeSnapshot.js";
import { renderPlaceSnapshotBody, renderPlaceSnapshotTeaser } from "../ui/placeSnapshot.js";

function field(overrides: Partial<ObservationField> = {}): ObservationField {
  return {
    fieldId: "11111111-1111-4111-8111-111111111111",
    source: "nature_symbiosis_site",
    name: "連理の木の下で",
    nameKana: "",
    summary: "公開範囲と安全導線があるフィールド",
    prefecture: "静岡県",
    city: "浜松市",
    lat: 34.814,
    lng: 137.732,
    radiusM: 300,
    polygon: null,
    areaHa: 1.3,
    certificationId: "ncs-test",
    certifiedAt: null,
    officialUrl: "https://example.invalid/site",
    ownerUserId: null,
    payload: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function stats(overrides: Partial<FieldStats> = {}): FieldStats {
  return {
    fieldId: "11111111-1111-4111-8111-111111111111",
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 0,
    uniqueSpeciesCount: 0,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [],
    recentSessions: [],
    ...overrides,
  };
}

test("empty place snapshot keeps claims modest and points to first event", () => {
  const snapshot = composePlaceSnapshot({
    field: field(),
    stats: stats(),
    canonical: {
      totalObservations: 0,
      totalVisits: 0,
      uniqueTaxa: 0,
      taxonRankCount: 0,
      months: [],
      effortFilled: 0,
      effortTotal: 0,
      acceptedCount: 0,
      reviewTotal: 0,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 0,
      stewardshipActionCount: 0,
    },
    hypotheses: [],
    now: new Date("2026-05-01T00:00:00.000Z"),
  });

  assert.equal(snapshot.framing.publicLabel, "この場所のいま");
  assert.equal(snapshot.observationSummary.totalObservations, 0);
  assert.equal(snapshot.relationshipScore.source, "field_fallback");
  assert.ok(snapshot.nextActions.some((action) => action.title === "最初の観察会を作る"));
  assert.ok(snapshot.claimBoundary.cannotSayYet.some((claim) => claim.includes("増減や不在はまだ判断できません")));
});

test("place snapshot aggregates multi-season evidence without certainty claims", () => {
  const snapshot = composePlaceSnapshot({
    field: field(),
    stats: stats({
      totalSessions: 4,
      totalObservations: 5,
      uniqueSpeciesCount: 3,
      totalAbsences: 1,
      topTaxa: [{ name: "ニホンアマガエル", count: 2 }],
    }),
    canonical: {
      totalObservations: 8,
      totalVisits: 4,
      uniqueTaxa: 4,
      taxonRankCount: 3,
      months: [4, 7, 10],
      effortFilled: 3,
      effortTotal: 4,
      acceptedCount: 1,
      reviewTotal: 4,
      nativeCount: 2,
      exoticCount: 1,
      unknownOriginCount: 5,
      stewardshipActionCount: 2,
    },
    hypotheses: [{
      hypothesisId: "h1",
      meshKey: "34.8140:137.7320",
      placeId: null,
      claimType: "management_effect",
      hypothesisText: "草刈り前後で見える生物相が変わる可能性がある。",
      whatWeCanSay: "管理痕跡と観察記録はあるが、影響方向はまだ仮説段階。",
      supportingGuideRecordIds: [],
      supportingObservationIds: [],
      supportingKnowledgeCardIds: [],
      supportingClaimIds: [],
      evidence: {},
      confidence: 0.48,
      biasWarnings: ["effort_bias_not_corrected"],
      missingData: ["complete_checklist"],
      nextSamplingProtocol: "草刈り前後を同じ構図で再撮影し、探索時間を残す。",
      sourceFingerprint: "regional-hypothesis:test",
      reviewStatus: "auto",
      generatedAt: "2026-05-01T00:00:00.000Z",
    }],
    stewardshipImpact: {
      windowDays: 30,
      summary: "1件の手入れ記録の前後で比較入口があります。",
      comparisons: [{
        actionId: "act-1",
        actionKind: "mowing",
        occurredAt: "2026-04-15T00:00:00.000Z",
        description: "草刈り後の水際を同じ範囲で確認",
        speciesStatus: null,
        linkedVisitId: "visit-after",
        before: { visits: 1, observations: 2, uniqueTaxa: 2, effortVisits: 0, absentRecords: 0 },
        after: { visits: 2, observations: 5, uniqueTaxa: 4, effortVisits: 1, absentRecords: 1 },
        signals: ["before_after_comparable", "taxa_seen_after_action", "explicit_non_detection_after_action"],
        limitations: ["effort_not_aligned", "small_sample"],
      }],
    },
  });

  assert.equal(snapshot.observationSummary.totalObservations, 8);
  assert.deepEqual(snapshot.observationSummary.seasonLabels, ["春", "夏", "秋"]);
  assert.equal(snapshot.observationSummary.effortCompletionRate, 0.75);
  assert.ok(snapshot.claimBoundary.canSay.some((claim) => claim.includes("地域仮説は断定ではなく")));

  const html = renderPlaceSnapshotBody(snapshot);
  assert.match(html, /この場所のいま/);
  assert.match(html, /場所のモニタリングブリーフ/);
  assert.match(html, /施策後の変化の兆し/);
  assert.match(html, /草刈り/);
  assert.match(html, /前30日/);
  assert.match(html, /後30日/);
  assert.doesNotMatch(html, /AIが確定|TNFD準拠を保証|専門家不要|不在が分かる/);
});

test("place snapshot teaser embeds a light field-detail entry point", () => {
  const snapshot = composePlaceSnapshot({
    field: field(),
    stats: stats({ totalSessions: 2, totalObservations: 3, uniqueSpeciesCount: 2 }),
    canonical: {
      totalObservations: 3,
      totalVisits: 2,
      uniqueTaxa: 2,
      taxonRankCount: 1,
      months: [5],
      effortFilled: 1,
      effortTotal: 2,
      acceptedCount: 0,
      reviewTotal: 2,
      nativeCount: 1,
      exoticCount: 0,
      unknownOriginCount: 2,
      stewardshipActionCount: 0,
    },
  });
  const html = renderPlaceSnapshotTeaser(snapshot);
  assert.match(html, /この場所のいまを見る/);
  assert.match(html, /場所の状態を1枚で見る/);
});

test("public landing copy is not polluted by digital twin wording", async () => {
  const landingTop = await readFile(path.join(process.cwd(), "src", "ui", "landingTop.ts"), "utf8");
  const siteMap = await readFile(path.join(process.cwd(), "src", "siteMap.ts"), "utf8");

  assert.doesNotMatch(landingTop, /デジタルツイン|digital twin/i);
  assert.doesNotMatch(siteMap, /デジタルツイン|digital twin/i);
});
