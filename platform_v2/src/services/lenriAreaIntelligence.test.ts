import assert from "node:assert/strict";
import test from "node:test";
import { buildLenriLiveEffortSnapshot, getLenriAreaIntelligenceSnapshot } from "./lenriAreaIntelligence.js";
import type { PlaceSnapshot } from "./placeSnapshot.js";

test("Lenri area intelligence is scoped to the approved micro POC", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));

  assert.equal(snapshot.schemaVersion, "lenri_area_intelligence/v0");
  assert.equal(snapshot.generatedAt, "2026-06-03T00:00:00.000Z");
  assert.equal(snapshot.field.certificationId, "aikan-renri-ikan-hq");
  assert.equal(snapshot.field.name, "愛管株式会社 連理の木の下で");
  assert.equal(snapshot.field.lat, 34.81435);
  assert.equal(snapshot.field.lng, 137.7327);
  assert.equal(snapshot.field.areaHa, 1.3);
  assert.deepEqual(
    snapshot.rings.map((ring) => ring.ringId),
    ["core_site", "walkable_buffer", "local_context"],
  );
});

test("budget guard blocks paid PDI until the effective monthly cost is inside the cap", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));

  assert.equal(snapshot.budgetGuard.approvedMonthlyBudgetUsd, 10);
  assert.equal(snapshot.budgetGuard.currentRecurringCostUsd, 0);
  assert.equal(snapshot.budgetGuard.paidPdiSubscriptionAllowed, false);
  assert.match(snapshot.budgetGuard.allowedPaidCondition, /10 USD/);
  assert.match(snapshot.budgetGuard.stoppedAction, /開始しない/);
  assert.equal(snapshot.pdiAccess.status, "inquiry_submitted_pricing_unknown");
  assert.match(snapshot.pdiAccess.swapInCondition, /予算内/);
});

test("open data proxy keeps the current implementation useful without external runtime cost", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));

  assert.equal(snapshot.openDataProxy.sourceLabel, "OpenStreetMap Overpass snapshot");
  assert.equal(snapshot.openDataProxy.uniqueElementCount, 240);
  assert.ok(snapshot.openDataProxy.contextSignals.some((signal) => signal.category === "waterway" && signal.count === 11));
  assert.ok(snapshot.openDataProxy.namedSignals.some((signal) => signal.name.includes("LENRI")));
  assert.ok(snapshot.openDataProxy.landUseSignals.includes("farmland"));
});

test("effort readiness turns Lenri context into a monitoring plan without claiming trends", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));

  assert.equal(snapshot.effortReadiness.schemaVersion, "lenri_effort_readiness/v0");
  assert.equal(snapshot.effortReadiness.summary.status, "thin");
  assert.equal(snapshot.effortReadiness.summary.trendClaimReady, false);
  assert.ok(snapshot.effortReadiness.items.some((item) => item.dimension === "season" && item.status === "missing"));
  assert.ok(snapshot.effortReadiness.items.some((item) => item.dimension === "non_detection" && item.nextAction.includes("非検出")));
  assert.ok(snapshot.effortReadiness.metricDefinitions.some((item) => item.key === "effort_minutes"));
  assert.ok(snapshot.effortReadiness.nextSurveyPlan.some((plan) => plan.effortUnit.includes("30 minutes")));
  assert.ok(snapshot.effortReadiness.modelSwapIn.some((item) => item.includes("monitoring_workspace_read_model")));
});

test("live effort builder maps place snapshot metrics into Lenri effort ledger", () => {
  const live = buildLenriLiveEffortSnapshot({
    generatedAt: "2026-06-03T01:00:00.000Z",
    field: { fieldId: "aikan-renri-ikan-hq" },
    observationSummary: {
      totalObservations: 24,
      totalVisits: 6,
      uniqueTaxa: 20,
      latestObservedAt: "2026-06-01T00:00:00.000Z",
      effortCompletionRate: 0.5,
      seasonsCovered: 2,
      seasonCoverageCap: 4,
      seasonLabels: ["春", "夏"],
      absentRecords: 1,
      reviewAcceptedRate: 0.2,
      topTaxa: [{ name: "ハシブトガラス", count: 3 }],
    },
    machineObservationSummary: {
      effortMetadataCount: 2,
      passiveAudioCount: 1,
      methodCounts: [{ method: "passive_audio", count: 1 }],
    },
    nextActions: [{ kind: "revisit", title: "季節を足す", body: "秋と冬の反復を作る。" }],
    claimBoundary: {
      canSay: ["努力量を確認できる。"],
      cannotSayYet: ["増減はまだ言えない。"],
    },
  } as unknown as PlaceSnapshot, "aikan-renri-ikan-hq");

  assert.equal(live.schemaVersion, "lenri_live_effort/v0");
  assert.equal(live.status, "loaded");
  assert.equal(live.summary.totalVisits, 6);
  assert.equal(live.summary.effortCompletionRate, 0.5);
  assert.equal(live.summary.machineEffortMetadata, 2);
  assert.ok(live.gaps.includes("season_repeat_incomplete"));
  assert.ok(live.nextActions.some((action) => action.title === "季節を足す"));
  assert.ok(live.claimBoundary.cannotSayYet.some((claim) => claim.includes("努力量だけで")));
});

test("live effort builder remains safe when the place snapshot is unavailable", () => {
  const live = buildLenriLiveEffortSnapshot(null, "aikan-renri-ikan-hq");

  assert.equal(live.status, "unavailable");
  assert.equal(live.summary.totalVisits, 0);
  assert.deepEqual(live.gaps, ["place_snapshot_unavailable"]);
  assert.ok(live.claimBoundary.cannotSayYet.some((claim) => claim.includes("確認済み")));
});

test("claim boundary does not turn PDI or AI context into biodiversity proof", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));
  const serialized = JSON.stringify(snapshot);

  assert.ok(snapshot.claimBoundary.cannotSayYet.some((claim) => claim.includes("Googleから有料レポート利用が承認済み")));
  assert.ok(snapshot.claimBoundary.cannotSayYet.some((claim) => claim.includes("努力量補正済み")));
  assert.doesNotMatch(serialized, /TNFD準拠を証明|自然共生サイト認定を証明|生物多様性改善を証明|AIが確定|absenceが確認済み/);
});
