import type { CivicObservationContext } from "./civicNatureContext.js";
import type { ObservationDataRights } from "./observationDataRights.js";
import type { WaterRecordExtension } from "./waterRecordExtension.js";

export type ReadinessGate = {
  ready: boolean;
  reasons: string[];
  blockers: string[];
};

export type MonitoringReadiness = {
  schemaVersion: "monitoring_readiness/v1";
  reviewReady: ReadinessGate;
  monitoringReady: ReadinessGate;
  reportReady: ReadinessGate;
  exportReady: ReadinessGate;
};

export type MonitoringReadinessInput = {
  visit: {
    locationPrecision: string;
    visitMode?: string | null;
    effortMinutes?: number | null;
    targetTaxaScope?: string | null;
    completeChecklistFlag?: boolean | null;
    placeId?: string | null;
  };
  occurrences: Array<{
    scientificName?: string | null;
    vernacularName?: string | null;
    taxonRank?: string | null;
    evidenceTier?: number | null;
    occurrenceStatus?: string | null;
    riskLane?: string | null;
    safePublicRank?: string | null;
  }>;
  evidenceAssets: Array<unknown>;
  reviewState: {
    reviewStatus: string;
    blockingIssues: string[];
  };
  civicContext: CivicObservationContext | null;
  dataRights: ObservationDataRights | null;
  waterRecord: WaterRecordExtension | null;
};

function gate(reasons: string[], blockers: string[]): ReadinessGate {
  return {
    ready: blockers.length === 0,
    reasons,
    blockers,
  };
}

function hasIdentification(input: MonitoringReadinessInput): boolean {
  return input.occurrences.some((occurrence) =>
    Boolean(
      occurrence.scientificName?.trim()
      || occurrence.vernacularName?.trim()
      || occurrence.taxonRank?.trim(),
    ),
  );
}

function bestEvidenceTier(input: MonitoringReadinessInput): number {
  return Math.max(0, ...input.occurrences.map((occurrence) => occurrence.evidenceTier ?? 0));
}

function hasLocation(input: MonitoringReadinessInput): boolean {
  return input.visit.locationPrecision !== "unknown";
}

function highRisk(input: MonitoringReadinessInput): boolean {
  return input.occurrences.some((occurrence) => {
    const lane = occurrence.riskLane ?? "normal";
    return lane !== "normal" && lane !== "unknown";
  }) || input.civicContext?.riskLane === "rare_sensitive";
}

function buildReviewReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (input.evidenceAssets.length > 0) reasons.push("has_evidence_asset");
  else blockers.push("missing_evidence_asset");
  if (hasLocation(input)) reasons.push("has_location_context");
  else blockers.push("missing_location_context");
  if (hasIdentification(input)) reasons.push("has_identification_candidate");
  else blockers.push("missing_identification_candidate");
  if (highRisk(input) && input.reviewState.reviewStatus !== "verified") {
    blockers.push("scoped_review_required_for_risk_lane");
  }
  if (input.reviewState.blockingIssues.length === 0) reasons.push("no_package_review_blocker");
  else blockers.push(...input.reviewState.blockingIssues.map((issue) => `package_${issue}`));
  return gate(reasons, [...new Set(blockers)]);
}

function buildMonitoringReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const effortMinutes = input.waterRecord?.effortMinutes ?? input.visit.effortMinutes ?? null;
  const targetTaxaScope = input.waterRecord?.targetTaxaScope ?? input.visit.targetTaxaScope ?? null;
  const hasEffort = typeof effortMinutes === "number" && effortMinutes > 0;
  const hasTarget = Boolean(targetTaxaScope?.trim());
  const hasProtocol = input.visit.visitMode === "survey" || Boolean(input.waterRecord);
  const hasOutcome = Boolean(input.waterRecord?.catchOutcome)
    || input.occurrences.some((occurrence) => Boolean(occurrence.occurrenceStatus));
  const hasSite = Boolean(input.visit.placeId || input.civicContext?.fieldId || input.civicContext?.plotId || input.waterRecord?.waterbodyId || input.waterRecord?.publicWaterbodyLabel);

  if (hasEffort) reasons.push("has_effort");
  else blockers.push("missing_effort");
  if (hasTarget) reasons.push("has_target_scope");
  else blockers.push("missing_target_scope");
  if (hasProtocol) reasons.push("has_sampling_protocol");
  else blockers.push("missing_sampling_protocol");
  if (hasOutcome) reasons.push("has_detection_or_capture_outcome");
  else blockers.push("missing_detection_or_capture_outcome");
  if (hasSite) reasons.push("has_site_or_waterbody");
  else blockers.push("missing_site_or_waterbody");
  if (input.waterRecord?.catchOutcome === "no_catch") reasons.push("no_catch_kept_as_capture_attempt");
  return gate(reasons, [...new Set(blockers)]);
}

function buildReportReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const tier = bestEvidenceTier(input);
  if (input.civicContext) reasons.push("has_civic_context");
  else blockers.push("missing_civic_context");
  if (input.civicContext?.publicPrecision) reasons.push(`public_precision_${input.civicContext.publicPrecision}`);
  else blockers.push("missing_public_precision");
  if (tier >= 1) reasons.push("has_minimum_evidence_tier");
  else blockers.push("missing_evidence_tier");
  if (input.civicContext?.reportConsent && input.civicContext.reportConsent !== "none") {
    reasons.push(`report_consent_${input.civicContext.reportConsent}`);
  } else {
    blockers.push("missing_report_consent");
  }
  return gate(reasons, [...new Set(blockers)]);
}

function buildExportReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const rights = input.dataRights;
  const tier = bestEvidenceTier(input);
  if (rights?.externalExportAllowed) reasons.push("external_export_allowed");
  else blockers.push("external_export_not_allowed");
  if (rights?.datasetLicense) reasons.push(`dataset_license_${rights.datasetLicense}`);
  else blockers.push("missing_dataset_license");
  if (rights?.mediaLicense) reasons.push(`media_license_${rights.mediaLicense}`);
  else blockers.push("missing_media_license");
  if (rights?.withdrawalStatus === "active") reasons.push("rights_active");
  else blockers.push("rights_withdrawn_or_missing");
  if (hasIdentification(input)) reasons.push("has_taxon_for_export");
  else blockers.push("missing_taxon_for_export");
  if (input.civicContext?.publicPrecision && input.civicContext.publicPrecision !== "exact_private") {
    reasons.push(`location_generalized_${input.civicContext.publicPrecision}`);
  } else {
    blockers.push("missing_location_generalization");
  }
  if (tier >= 3 || input.reviewState.reviewStatus === "verified") reasons.push("reviewed_for_export");
  else blockers.push("review_required_for_export");
  return gate(reasons, [...new Set(blockers)]);
}

export function buildMonitoringReadiness(input: MonitoringReadinessInput): MonitoringReadiness {
  return {
    schemaVersion: "monitoring_readiness/v1",
    reviewReady: buildReviewReady(input),
    monitoringReady: buildMonitoringReady(input),
    reportReady: buildReportReady(input),
    exportReady: buildExportReady(input),
  };
}
