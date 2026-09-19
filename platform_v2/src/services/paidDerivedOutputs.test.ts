import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCouponAction, couponAccessBoundary, createCouponCampaign, createProfessionalReport, createPromotionalPublication,
  evaluateCommercialUseRights, sponsorDisclosure, taxonInventoryAccess,
} from "./paidDerivedOutputs.js";
import { normalizeObservationDataRights } from "./observationDataRights.js";

const observationRights = () => normalizeObservationDataRights({
  visitId: "visit-1",
  recordConsent: "external_export",
  researchUseConsent: "public_export",
  enterpriseReportConsent: "identified",
  datasetLicense: "CC-BY-4.0",
  mediaLicense: "CC-BY-4.0",
  externalExportAllowed: true,
  withdrawalStatus: "active",
});
const rights = () => ({
  observationRights: observationRights(),
  portraitAndPersonalData: true,
  minorConsent: true,
  commercialReusePermission: true,
  reportingReusePermission: true,
  locationSafety: true,
  rareSpeciesSafety: true,
  confidentialityCleared: true,
  attributionSatisfied: true,
  modificationPermission: true,
});
const sponsor = () => sponsorDisclosure({ sponsorAgentId: "org-1", label: "sponsored", displayName: "Example Sponsor" });
const campaign = () => createCouponCampaign({
  couponCampaignId: "coupon-1", issuerAgentId: "org-1", title: "Visit benefit", terms: "One per person",
  eligiblePlaceIds: ["place-1"], eligibleProgramIds: [], validFrom: "2026-09-01T00:00:00Z", validUntil: "2026-10-01T00:00:00Z",
  claimLimit: 1, redemptionLimit: 1, validationMethod: "server_token", sponsorDisclosure: sponsor(), status: "issued",
});

test("TaxonInventory screen download and API share one paid boundary", () => {
  for (const surface of ["screen", "download", "api"] as const) {
    assert.deepEqual(taxonInventoryAccess(surface, false), { allowed: false, reason: "PAID_DERIVED_OUTPUT_REQUIRED" });
    assert.deepEqual(taxonInventoryAccess(surface, true), { allowed: true, reason: "ENTITLED" });
  }
});

test("coupon participant access stays free while issuer management is the paid boundary", () => {
  assert.deepEqual(couponAccessBoundary("participant"), {
    claimAndRedeemRequirePaidEntitlement: false,
    campaignManagementRequiresPaidEntitlement: false,
  });
  assert.deepEqual(couponAccessBoundary("issuer"), {
    claimAndRedeemRequirePaidEntitlement: false,
    campaignManagementRequiresPaidEntitlement: true,
  });
});

test("ProfessionalReport is a source-bound derived object and does not own canonical Records", () => {
  const report = createProfessionalReport({
    reportId: "report-1", reportType: "monitoring", commissioningAgentId: "org-1", subjectPlaceIds: ["place-1"],
    coveredProgramIds: ["program-1"], observationPeriod: { from: "2026-01-01", until: "2026-09-01" },
    sourceRecordIds: ["record-1"], taxonInventoryIds: ["inventory-1"], reviewScope: "submission",
    reviewerAgentIds: ["reviewer-1"], generatedAt: "2026-09-19T00:00:00Z", approvedAt: null,
    version: "v1", deliveryState: "review", disclaimer: "Derived from cited Records.",
  });
  assert.deepEqual(report.sourceRecordIds, ["record-1"]);
  assert.equal("canonicalRecord" in report, false);
});

test("commercial-use rights fail closed and public visibility alone is insufficient", () => {
  const denied = evaluateCommercialUseRights({ ...rights(), commercialReusePermission: false });
  assert.deepEqual(denied, { decision: "DENY", missing: ["commercialReusePermission"] });
  assert.equal(evaluateCommercialUseRights(rights()).decision, "ALLOW");
  assert.equal(evaluateCommercialUseRights({} as never).decision, "DENY");
  const withdrawn = evaluateCommercialUseRights({ ...rights(), observationRights: { ...observationRights(), withdrawalStatus: "withdrawn" } });
  assert.equal(withdrawn.decision, "DENY");
  if (withdrawn.decision === "DENY") assert.ok(withdrawn.missing.includes("withdrawalStatus"));
  const nonCommercial = evaluateCommercialUseRights({ ...rights(), observationRights: { ...observationRights(), mediaLicense: "CC-BY-NC-4.0" } });
  assert.equal(nonCommercial.decision, "DENY");
  if (nonCommercial.decision === "DENY") assert.ok(nonCommercial.missing.includes("mediaLicense"));
});

test("PromotionalPublication requires clearance and sponsor disclosure never changes canonical ranking", () => {
  const publication = createPromotionalPublication({
    publicationId: "promo-1", sponsorAgentId: "org-1", purpose: "campaign",
    sourcePlaceIds: ["place-1"], sourceRecordIds: ["record-1"], rights: rights(),
    sponsor: { sponsorAgentId: "org-1", label: "advertisement", displayName: "Example Sponsor" },
    publicationWindow: { from: "2026-09-01T00:00:00Z", until: "2026-10-01T00:00:00Z" },
    editorialOwner: "editor-1", canonicalDataRevision: "rev-1", status: "draft",
  });
  assert.equal(publication.commercialUseClearance, "ALLOW");
  assert.equal(publication.sponsorDisclosure.canonicalRankingImpact, false);
  assert.throws(() => createPromotionalPublication({
    publicationId: "promo-2", sponsorAgentId: "org-1", purpose: "campaign", sourcePlaceIds: [], sourceRecordIds: ["record-1"],
    rights: { ...rights(), minorConsent: false }, sponsor: { sponsorAgentId: "org-1", label: "sponsored", displayName: "Sponsor" },
    publicationWindow: { from: "2026-09-01T00:00:00Z", until: "2026-10-01T00:00:00Z" },
    editorialOwner: "editor-1", canonicalDataRevision: "rev-1", status: "draft",
  }), /commercial_use_rights_denied:minorConsent/);
});

test("CouponCampaign excludes payment and applies claim validate redeem without stored value", () => {
  const c = campaign();
  let state = applyCouponAction({ campaign: c, claimId: "claim-1", actorId: "user-1", state: "available", action: "claim", occurredAt: "2026-09-19T00:00:00Z" });
  assert.equal(state.state, "claimed");
  assert.equal(state.usage.claimed, 1);
  state = applyCouponAction({ campaign: c, claimId: "claim-1", actorId: "staff-1", state: state.state, action: "validate", occurredAt: "2026-09-19T00:01:00Z", usage: state.usage });
  assert.equal(state.state, "validated");
  state = applyCouponAction({ campaign: c, claimId: "claim-1", actorId: "staff-1", state: state.state, action: "redeem", occurredAt: "2026-09-19T00:02:00Z", usage: state.usage });
  assert.equal(state.state, "redeemed");
  assert.throws(() => createCouponCampaign({ ...c, payment: "yen" } as never), /coupon_payment_scope_forbidden/);
});

test("draft campaigns remain inactive and configured multi-redemption limits are honored", () => {
  const base = campaign();
  const draft = applyCouponAction({ campaign: { ...base, status: "draft" }, claimId: "draft-1", actorId: "user-1", state: "available", action: "claim", occurredAt: "2026-09-19T00:00:00Z" });
  assert.equal(draft.audit.reason, "campaign_not_active");

  const multi = { ...base, redemptionLimit: 2 };
  const first = applyCouponAction({ campaign: multi, claimId: "multi-1", actorId: "staff-1", state: "validated", action: "redeem", occurredAt: "2026-09-19T00:01:00Z", usage: { claimed: 1, redeemed: 0 } });
  assert.equal(first.state, "validated");
  assert.equal(first.usage.redeemed, 1);
  const second = applyCouponAction({ campaign: multi, claimId: "multi-1", actorId: "staff-1", state: first.state, action: "redeem", occurredAt: "2026-09-19T00:02:00Z", usage: first.usage });
  assert.equal(second.state, "redeemed");
  assert.equal(second.usage.redeemed, 2);
});

test("duplicate redemption, invalid transitions, suspension and expiry are auditable denials", () => {
  const c = campaign();
  const duplicate = applyCouponAction({ campaign: c, claimId: "claim-1", actorId: "staff-1", state: "redeemed", action: "redeem", occurredAt: "2026-09-19T00:03:00Z", usage: { claimed: 1, redeemed: 1 } });
  assert.equal(duplicate.state, "redeemed");
  assert.deepEqual({ outcome: duplicate.audit.outcome, reason: duplicate.audit.reason }, { outcome: "denied", reason: "duplicate_redemption" });

  const invalid = applyCouponAction({ campaign: c, claimId: "claim-2", actorId: "staff-1", state: "available", action: "redeem", occurredAt: "2026-09-19T00:03:00Z" });
  assert.equal(invalid.audit.reason, "invalid_state_transition");

  const suspended = applyCouponAction({ campaign: { ...c, status: "suspended" }, claimId: "claim-3", actorId: "user-3", state: "available", action: "claim", occurredAt: "2026-09-19T00:03:00Z" });
  assert.equal(suspended.audit.reason, "campaign_not_active");

  const expired = applyCouponAction({ campaign: c, claimId: "claim-4", actorId: "user-4", state: "available", action: "claim", occurredAt: "2026-10-02T00:00:00Z" });
  assert.equal(expired.audit.reason, "campaign_not_active");

  const claimLimit = applyCouponAction({ campaign: c, claimId: "claim-5", actorId: "user-5", state: "available", action: "claim", occurredAt: "2026-09-19T00:04:00Z", usage: { claimed: 1, redeemed: 0 } });
  assert.equal(claimLimit.audit.reason, "claim_limit_reached");
  assert.equal(claimLimit.audit.actorId, "user-5");
});
