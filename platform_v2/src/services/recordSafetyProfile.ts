import type { CivicObservationContext, CivicPublicPrecision } from "./civicNatureContext.js";
import type { ObservationDataRights } from "./observationDataRights.js";

export type PublicPlacePolicy =
  | "allowlisted_public_place"
  | "permission_required"
  | "restricted_or_private"
  | "school_or_child_sensitive"
  | "unknown_hold";

export type MediaPublicPolicy =
  | "cleared_public_media"
  | "redacted_public_copy"
  | "held_for_face_privacy_review"
  | "no_public_media";

export type RecordSafetyGate = {
  ready: boolean;
  reasons: string[];
  blockers: string[];
};

export type RecordSafetyProfileV0 = {
  schemaVersion: "record_safety_profile/v0";
  publicPlacePolicy: PublicPlacePolicy;
  publicPrecisionPolicy: CivicPublicPrecision;
  mediaPublicPolicy: MediaPublicPolicy;
  homeAreaRisk: "none" | "repeat_private_place_candidate";
  sensitiveSubjectRisk: "none" | "rare_or_sensitive_subject" | "school_or_child_context";
  publicSummaryGate: RecordSafetyGate;
  municipalUseGate: RecordSafetyGate;
  auditEvents: string[];
};

export type RecordSafetyProfileInput = {
  civicContext: CivicObservationContext | null;
  dataRights: ObservationDataRights | null;
  place?: {
    publicSafePlace?: boolean | null;
    accessStatus?: string | null;
    source?: string | null;
    adminLevel?: string | null;
    verificationLevel?: string | null;
  } | null;
  occurrences: Array<{
    riskLane?: string | null;
    safePublicRank?: string | null;
    taxonRank?: string | null;
    scientificName?: string | null;
    vernacularName?: string | null;
  }>;
  mediaAssets: Array<{
    publicUrl?: string | null;
    sourcePayload?: Record<string, unknown> | null;
  }>;
  homeAreaRepeatCount?: number | null;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function gate(reasons: string[], blockers: string[]): RecordSafetyGate {
  const dedupedBlockers = unique(blockers);
  return {
    ready: dedupedBlockers.length === 0,
    reasons: unique(reasons),
    blockers: dedupedBlockers,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function placeSignals(input: RecordSafetyProfileInput): string[] {
  const place = input.place ?? {};
  return [place.source, place.adminLevel, place.accessStatus, place.verificationLevel].map(text);
}

function isSchoolOrChildPlace(input: RecordSafetyProfileInput): boolean {
  return placeSignals(input).some((value) => /(school|kindergarten|child|nursery|campus|education)/.test(value));
}

function isRestrictedPlace(input: RecordSafetyProfileInput): boolean {
  return placeSignals(input).some((value) =>
    /(private|restricted|residential|home|private_or_restricted)/.test(value),
  );
}

function derivePublicPlacePolicy(input: RecordSafetyProfileInput): PublicPlacePolicy {
  const accessStatus = text(input.place?.accessStatus);
  if (isSchoolOrChildPlace(input) || input.civicContext?.contextKind === "school") return "school_or_child_sensitive";
  if (accessStatus === "permission_required") return "permission_required";
  if (isRestrictedPlace(input)) return "restricted_or_private";
  if (input.place?.publicSafePlace === true && accessStatus === "public_access") return "allowlisted_public_place";
  return "unknown_hold";
}

function hasSensitiveSubject(input: RecordSafetyProfileInput): boolean {
  return input.occurrences.some((occurrence) => {
    const lane = text(occurrence.riskLane);
    const safeRank = text(occurrence.safePublicRank);
    return lane === "rare_sensitive" || lane === "danger_candidate" || safeRank === "unknown";
  }) || input.civicContext?.riskLane === "rare_sensitive";
}

function derivePublicPrecisionPolicy(
  input: RecordSafetyProfileInput,
  publicPlacePolicy: PublicPlacePolicy,
): CivicPublicPrecision {
  if (hasSensitiveSubject(input)) return "hidden";
  if (publicPlacePolicy === "school_or_child_sensitive" || publicPlacePolicy === "restricted_or_private") return "hidden";
  if (publicPlacePolicy === "permission_required" || publicPlacePolicy === "unknown_hold") return "municipality";
  return input.civicContext?.publicPrecision ?? "municipality";
}

function payloadFaceStatus(payload: Record<string, unknown> | null | undefined): string {
  const face = payload?.face_privacy;
  if (!face || typeof face !== "object") return "";
  return text((face as Record<string, unknown>).status);
}

function deriveMediaPublicPolicy(input: RecordSafetyProfileInput): MediaPublicPolicy {
  if (input.mediaAssets.length === 0) return "no_public_media";
  const payloads = input.mediaAssets.map((asset) => asset.sourcePayload ?? {});
  if (payloads.some((payload) => text(payload.public_media_policy) === "held_for_face_privacy_review")) {
    return "held_for_face_privacy_review";
  }
  if (payloads.some((payload) => text(payload.public_media_policy) === "redacted_public_copy")) {
    return "redacted_public_copy";
  }
  const statuses = payloads.map(payloadFaceStatus).filter(Boolean);
  if (statuses.some((status) => status === "pending" || status === "unavailable")) {
    return "held_for_face_privacy_review";
  }
  if (statuses.some((status) => status === "redacted")) return "redacted_public_copy";
  if (statuses.some((status) => status === "no_faces")) return "cleared_public_media";
  return input.mediaAssets.some((asset) => asset.publicUrl) ? "held_for_face_privacy_review" : "no_public_media";
}

function addPublicRightsGate(
  reasons: string[],
  blockers: string[],
  dataRights: ObservationDataRights | null,
): void {
  if (!dataRights) {
    blockers.push("missing_record_public_summary_consent");
    return;
  }
  if (dataRights.withdrawalStatus !== "active") {
    blockers.push(`data_rights_${dataRights.withdrawalStatus}`);
    return;
  }
  if (dataRights.recordConsent === "public_summary" || dataRights.recordConsent === "external_export") {
    reasons.push(`record_consent_${dataRights.recordConsent}`);
  } else {
    blockers.push(`record_consent_${dataRights.recordConsent}`);
  }
}

function addMunicipalRightsGate(
  reasons: string[],
  blockers: string[],
  dataRights: ObservationDataRights | null,
): void {
  if (!dataRights) {
    blockers.push("missing_municipal_report_consent");
    return;
  }
  if (dataRights.withdrawalStatus !== "active") {
    blockers.push(`data_rights_${dataRights.withdrawalStatus}`);
    return;
  }
  if (dataRights.enterpriseReportConsent === "aggregated" || dataRights.enterpriseReportConsent === "identified") {
    reasons.push(`enterprise_report_consent_${dataRights.enterpriseReportConsent}`);
  } else {
    blockers.push("missing_municipal_report_consent");
  }
}

export function buildRecordSafetyProfileV0(input: RecordSafetyProfileInput): RecordSafetyProfileV0 {
  const publicPlacePolicy = derivePublicPlacePolicy(input);
  const publicPrecisionPolicy = derivePublicPrecisionPolicy(input, publicPlacePolicy);
  const mediaPublicPolicy = deriveMediaPublicPolicy(input);
  const homeAreaRisk = (input.homeAreaRepeatCount ?? 0) >= 3
    ? "repeat_private_place_candidate"
    : "none";
  const sensitiveSubjectRisk = publicPlacePolicy === "school_or_child_sensitive"
    ? "school_or_child_context"
    : hasSensitiveSubject(input)
      ? "rare_or_sensitive_subject"
      : "none";

  const publicReasons: string[] = [];
  const publicBlockers: string[] = [];
  if (publicPlacePolicy === "allowlisted_public_place") publicReasons.push("public_safe_place_allowlisted");
  else publicBlockers.push(`public_place_${publicPlacePolicy}`);
  if (publicPrecisionPolicy !== "exact_private" && publicPrecisionPolicy !== "hidden") {
    publicReasons.push(`public_precision_${publicPrecisionPolicy}`);
  } else {
    publicBlockers.push(`public_precision_${publicPrecisionPolicy}`);
  }
  const canUseNoticeTakedownMediaPolicy = mediaPublicPolicy === "held_for_face_privacy_review"
    && publicPlacePolicy === "allowlisted_public_place"
    && homeAreaRisk === "none"
    && sensitiveSubjectRisk === "none";
  if (mediaPublicPolicy === "cleared_public_media" || mediaPublicPolicy === "redacted_public_copy") {
    publicReasons.push(mediaPublicPolicy);
  } else if (canUseNoticeTakedownMediaPolicy) {
    publicReasons.push("consumer_social_notice_takedown_media_policy");
  } else if (mediaPublicPolicy === "held_for_face_privacy_review") {
    publicBlockers.push("face_privacy_review_required");
  } else {
    publicBlockers.push(mediaPublicPolicy);
  }
  if (homeAreaRisk !== "none") publicBlockers.push(homeAreaRisk);
  if (sensitiveSubjectRisk !== "none") publicBlockers.push(sensitiveSubjectRisk);
  addPublicRightsGate(publicReasons, publicBlockers, input.dataRights);

  const municipalReasons = [...publicReasons];
  const municipalBlockers = [...publicBlockers];
  addMunicipalRightsGate(municipalReasons, municipalBlockers, input.dataRights);
  if (mediaPublicPolicy === "held_for_face_privacy_review") {
    municipalBlockers.push("face_privacy_review_required_for_municipal_use");
  }
  if (input.civicContext?.reportConsent === "public_summary" || input.civicContext?.reportConsent === "research_export") {
    municipalReasons.push(`report_consent_${input.civicContext.reportConsent}`);
  } else {
    municipalBlockers.push("missing_public_summary_or_research_consent");
  }

  return {
    schemaVersion: "record_safety_profile/v0",
    publicPlacePolicy,
    publicPrecisionPolicy,
    mediaPublicPolicy,
    homeAreaRisk,
    sensitiveSubjectRisk,
    publicSummaryGate: gate(publicReasons, publicBlockers),
    municipalUseGate: gate(municipalReasons, municipalBlockers),
    auditEvents: unique([
      `public_place_policy:${publicPlacePolicy}`,
      `public_precision_policy:${publicPrecisionPolicy}`,
      `media_public_policy:${mediaPublicPolicy}`,
      homeAreaRisk !== "none" ? `home_area_risk:${homeAreaRisk}` : "",
      sensitiveSubjectRisk !== "none" ? `sensitive_subject_risk:${sensitiveSubjectRisk}` : "",
    ]),
  };
}
