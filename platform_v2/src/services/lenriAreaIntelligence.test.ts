import assert from "node:assert/strict";
import test from "node:test";
import { getLenriAreaIntelligenceSnapshot } from "./lenriAreaIntelligence.js";

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

test("claim boundary does not turn PDI or AI context into biodiversity proof", () => {
  const snapshot = getLenriAreaIntelligenceSnapshot(new Date("2026-06-03T00:00:00.000Z"));
  const serialized = JSON.stringify(snapshot);

  assert.ok(snapshot.claimBoundary.cannotSayYet.some((claim) => claim.includes("Googleから有料レポート利用が承認済み")));
  assert.ok(snapshot.claimBoundary.cannotSayYet.some((claim) => claim.includes("努力量補正済み")));
  assert.doesNotMatch(serialized, /TNFD準拠を証明|自然共生サイト認定を証明|生物多様性改善を証明|AIが確定|absenceが確認済み/);
});
