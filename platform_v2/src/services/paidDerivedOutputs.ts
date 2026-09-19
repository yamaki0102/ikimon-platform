import type { TaxonInventory } from "./programPortabilityBoundary.js";

export const PAID_DERIVED_OUTPUTS_SCHEMA = "zukan.paid-derived-outputs/v1" as const;

export type PaidOutputSurface = "screen" | "download" | "api";
export type CouponAccessRole = "participant" | "issuer";
export type PaidAccessDecision =
  | { allowed: true; reason: "ENTITLED" }
  | { allowed: false; reason: "PAID_DERIVED_OUTPUT_REQUIRED" };

export function taxonInventoryAccess(surface: PaidOutputSurface, entitled: boolean): PaidAccessDecision {
  if (!["screen", "download", "api"].includes(surface)) throw new Error("paid_output_surface_invalid");
  return entitled ? { allowed: true, reason: "ENTITLED" } : { allowed: false, reason: "PAID_DERIVED_OUTPUT_REQUIRED" };
}

export function couponAccessBoundary(role: CouponAccessRole): {
  claimAndRedeemRequirePaidEntitlement: boolean;
  campaignManagementRequiresPaidEntitlement: boolean;
} {
  if (role === "participant") return { claimAndRedeemRequirePaidEntitlement: false, campaignManagementRequiresPaidEntitlement: false };
  if (role === "issuer") return { claimAndRedeemRequirePaidEntitlement: false, campaignManagementRequiresPaidEntitlement: true };
  throw new Error("coupon_access_role_invalid");
}

export type CommercialUseRightsInput = {
  copyrightOrLicense: boolean;
  contributorConsent: boolean;
  portraitAndPersonalData: boolean;
  minorConsent: boolean;
  commercialReusePermission: boolean;
  reportingReusePermission: boolean;
  locationSafety: boolean;
  rareSpeciesSafety: boolean;
  confidentialityCleared: boolean;
  attributionSatisfied: boolean;
  modificationPermission: boolean;
};

export type CommercialUseRightsDecision =
  | { decision: "ALLOW"; missing: [] }
  | { decision: "DENY"; missing: (keyof CommercialUseRightsInput)[] };

export function evaluateCommercialUseRights(input: CommercialUseRightsInput): CommercialUseRightsDecision {
  const missing = (Object.keys(input) as (keyof CommercialUseRightsInput)[]).filter((key) => input[key] !== true);
  return missing.length === 0 ? { decision: "ALLOW", missing: [] } : { decision: "DENY", missing };
}

export type SponsorDisclosure = {
  sponsorAgentId: string;
  label: "sponsored" | "advertisement";
  displayName: string;
  canonicalRankingImpact: false;
};

export function sponsorDisclosure(input: Omit<SponsorDisclosure, "canonicalRankingImpact">): SponsorDisclosure {
  if (!input.sponsorAgentId.trim() || !input.displayName.trim()) throw new Error("sponsor_disclosure_required");
  if (!["sponsored", "advertisement"].includes(input.label)) throw new Error("sponsor_label_invalid");
  return { ...input, sponsorAgentId: input.sponsorAgentId.trim(), displayName: input.displayName.trim(), canonicalRankingImpact: false };
}

export type ProfessionalReport = {
  schema: typeof PAID_DERIVED_OUTPUTS_SCHEMA;
  reportId: string;
  reportType: string;
  commissioningAgentId: string;
  subjectPlaceIds: string[];
  coveredProgramIds: string[];
  observationPeriod: { from: string; until: string };
  sourceRecordIds: string[];
  taxonInventoryIds: string[];
  reviewScope: string;
  reviewerAgentIds: string[];
  generatedAt: string;
  approvedAt: string | null;
  version: string;
  deliveryState: "draft" | "review" | "approved" | "delivered" | "withdrawn";
  disclaimer: string;
};

export type PromotionalPublication = {
  schema: typeof PAID_DERIVED_OUTPUTS_SCHEMA;
  publicationId: string;
  sponsorAgentId: string;
  purpose: string;
  sourcePlaceIds: string[];
  sourceRecordIds: string[];
  commercialUseClearance: "ALLOW";
  sponsorDisclosure: SponsorDisclosure;
  publicationWindow: { from: string; until: string };
  editorialOwner: string;
  canonicalDataRevision: string;
  status: "draft" | "review" | "published" | "withdrawn";
};

export function createProfessionalReport(input: Omit<ProfessionalReport, "schema">): ProfessionalReport {
  for (const [key, value] of Object.entries({
    reportId: input.reportId, reportType: input.reportType, commissioningAgentId: input.commissioningAgentId,
    reviewScope: input.reviewScope, generatedAt: input.generatedAt, version: input.version, disclaimer: input.disclaimer,
  })) if (typeof value !== "string" || !value.trim()) throw new Error(`professional_report_${key}_required`);
  if (!["draft", "review", "approved", "delivered", "withdrawn"].includes(input.deliveryState)) throw new Error("professional_report_delivery_state_invalid");
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error("professional_report_generated_at_invalid");
  if (!Number.isFinite(Date.parse(input.observationPeriod.from)) || !Number.isFinite(Date.parse(input.observationPeriod.until))
    || Date.parse(input.observationPeriod.from) >= Date.parse(input.observationPeriod.until)) throw new Error("professional_report_period_invalid");
  if (input.approvedAt !== null && !Number.isFinite(Date.parse(input.approvedAt))) throw new Error("professional_report_approved_at_invalid");
  return { schema: PAID_DERIVED_OUTPUTS_SCHEMA, ...structuredClone(input) };
}

export function createPromotionalPublication(input: {
  publicationId: string;
  sponsorAgentId: string;
  purpose: string;
  sourcePlaceIds: string[];
  sourceRecordIds: string[];
  rights: CommercialUseRightsInput;
  sponsor: Omit<SponsorDisclosure, "canonicalRankingImpact">;
  publicationWindow: { from: string; until: string };
  editorialOwner: string;
  canonicalDataRevision: string;
  status: PromotionalPublication["status"];
}): PromotionalPublication {
  const rights = evaluateCommercialUseRights(input.rights);
  if (rights.decision !== "ALLOW") throw new Error(`commercial_use_rights_denied:${rights.missing.join(",")}`);
  for (const [key, value] of Object.entries({
    publicationId: input.publicationId, sponsorAgentId: input.sponsorAgentId, purpose: input.purpose,
    editorialOwner: input.editorialOwner, canonicalDataRevision: input.canonicalDataRevision,
  })) if (typeof value !== "string" || !value.trim()) throw new Error(`promotional_publication_${key}_required`);
  if (!["draft", "review", "published", "withdrawn"].includes(input.status)) throw new Error("promotional_publication_status_invalid");
  if (input.sponsor.sponsorAgentId.trim() !== input.sponsorAgentId.trim()) throw new Error("sponsor_identity_mismatch");
  if (!Number.isFinite(Date.parse(input.publicationWindow.from)) || !Number.isFinite(Date.parse(input.publicationWindow.until))
    || Date.parse(input.publicationWindow.from) >= Date.parse(input.publicationWindow.until)) throw new Error("publication_window_invalid");
  return {
    schema: PAID_DERIVED_OUTPUTS_SCHEMA,
    publicationId: input.publicationId.trim(),
    sponsorAgentId: input.sponsorAgentId.trim(),
    purpose: input.purpose.trim(),
    sourcePlaceIds: [...new Set(input.sourcePlaceIds)],
    sourceRecordIds: [...new Set(input.sourceRecordIds)],
    commercialUseClearance: "ALLOW",
    sponsorDisclosure: sponsorDisclosure(input.sponsor),
    publicationWindow: { ...input.publicationWindow },
    editorialOwner: input.editorialOwner.trim(),
    canonicalDataRevision: input.canonicalDataRevision.trim(),
    status: input.status,
  };
}

export type CouponCampaign = {
  schema: typeof PAID_DERIVED_OUTPUTS_SCHEMA;
  couponCampaignId: string;
  issuerAgentId: string;
  title: string;
  terms: string;
  eligiblePlaceIds: string[];
  eligibleProgramIds: string[];
  validFrom: string;
  validUntil: string;
  claimLimit: number;
  redemptionLimit: number;
  validationMethod: "server_token" | "staff_code" | "qr";
  sponsorDisclosure: SponsorDisclosure;
  status: "draft" | "issued" | "distributed" | "suspended" | "cancelled";
};

export type CouponClaimState = "available" | "claimed" | "validated" | "redeemed" | "cancelled";
export type CouponAction = "claim" | "validate" | "redeem" | "cancel";
export type CouponAuditEvent = {
  campaignId: string;
  claimId: string;
  actorId: string;
  action: CouponAction;
  from: CouponClaimState;
  to: CouponClaimState;
  outcome: "applied" | "denied";
  reason: string | null;
  occurredAt: string;
};

export function createCouponCampaign(input: Omit<CouponCampaign, "schema"> & Record<string, unknown>): CouponCampaign {
  for (const forbidden of ["payment", "settlement", "storedValue", "cashEquivalent", "automaticRevenueSharing"]) {
    if (forbidden in input) throw new Error("coupon_payment_scope_forbidden");
  }
  if (!input.couponCampaignId.trim() || !input.issuerAgentId.trim() || !input.title.trim() || !input.terms.trim()) throw new Error("coupon_identity_required");
  if (!["server_token", "staff_code", "qr"].includes(input.validationMethod)) throw new Error("coupon_validation_method_invalid");
  if (!["draft", "issued", "distributed", "suspended", "cancelled"].includes(input.status)) throw new Error("coupon_status_invalid");
  if (input.sponsorDisclosure.canonicalRankingImpact !== false) throw new Error("coupon_sponsor_ranking_impact_forbidden");
  const disclosure = sponsorDisclosure({
    sponsorAgentId: input.sponsorDisclosure.sponsorAgentId,
    label: input.sponsorDisclosure.label,
    displayName: input.sponsorDisclosure.displayName,
  });
  if (!Number.isFinite(Date.parse(input.validFrom)) || !Number.isFinite(Date.parse(input.validUntil))
    || Date.parse(input.validFrom) >= Date.parse(input.validUntil)) throw new Error("coupon_window_invalid");
  if (!Number.isInteger(input.claimLimit) || input.claimLimit < 1 || !Number.isInteger(input.redemptionLimit) || input.redemptionLimit < 1) throw new Error("coupon_limit_invalid");
  return {
    schema: PAID_DERIVED_OUTPUTS_SCHEMA,
    couponCampaignId: input.couponCampaignId.trim(), issuerAgentId: input.issuerAgentId.trim(),
    title: input.title.trim(), terms: input.terms.trim(), eligiblePlaceIds: [...new Set(input.eligiblePlaceIds)],
    eligibleProgramIds: [...new Set(input.eligibleProgramIds)], validFrom: input.validFrom, validUntil: input.validUntil,
    claimLimit: input.claimLimit, redemptionLimit: input.redemptionLimit, validationMethod: input.validationMethod,
    sponsorDisclosure: disclosure, status: input.status,
  };
}

export function applyCouponAction(input: {
  campaign: CouponCampaign;
  claimId: string;
  actorId: string;
  state: CouponClaimState;
  action: CouponAction;
  occurredAt: string;
  usage?: { claimed: number; redeemed: number };
}): { state: CouponClaimState; usage: { claimed: number; redeemed: number }; audit: CouponAuditEvent } {
  const { campaign, claimId, actorId, state, action, occurredAt } = input;
  if (!claimId.trim() || !actorId.trim()) throw new Error("coupon_audit_identity_required");
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("coupon_action_time_invalid");
  const now = Date.parse(occurredAt);
  const active = campaign.status !== "suspended" && campaign.status !== "cancelled"
    && now >= Date.parse(campaign.validFrom) && now <= Date.parse(campaign.validUntil);
  const transitions: Record<CouponAction, [CouponClaimState, CouponClaimState]> = {
    claim: ["available", "claimed"], validate: ["claimed", "validated"],
    redeem: ["validated", "redeemed"], cancel: [state, "cancelled"],
  };
  const [expected, next] = transitions[action];
  const usage = input.usage ?? { claimed: 0, redeemed: 0 };
  if (!Number.isInteger(usage.claimed) || usage.claimed < 0 || !Number.isInteger(usage.redeemed) || usage.redeemed < 0) throw new Error("coupon_usage_invalid");
  let reason: string | null = null;
  if (!active && action !== "cancel") reason = "campaign_not_active";
  else if (action === "claim" && usage.claimed >= campaign.claimLimit) reason = "claim_limit_reached";
  else if (action === "redeem" && state === "redeemed") reason = "duplicate_redemption";
  else if (action === "redeem" && usage.redeemed >= campaign.redemptionLimit) reason = "redemption_limit_reached";
  else if (action !== "cancel" && state !== expected) reason = "invalid_state_transition";
  const finalState = reason ? state : next;
  const nextUsage = reason ? { ...usage } : {
    claimed: usage.claimed + (action === "claim" ? 1 : 0),
    redeemed: usage.redeemed + (action === "redeem" ? 1 : 0),
  };
  return { state: finalState, usage: nextUsage, audit: {
    campaignId: campaign.couponCampaignId, claimId: claimId.trim(), actorId: actorId.trim(), action,
    from: state, to: finalState, outcome: reason ? "denied" : "applied", reason, occurredAt,
  } };
}

export function taxonInventoryReferencesCanonicalRecords(inventory: TaxonInventory): boolean {
  return inventory.schemaVersion === "zukan.taxon-inventory/v1" && Array.isArray(inventory.entries);
}
