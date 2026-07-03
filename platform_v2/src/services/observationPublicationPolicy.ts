import type { CivicObservationContext } from "./civicNatureContext.js";
import type { FieldProfilePolicy, FieldPublicLocationMode } from "./fieldProfilePolicy.js";
import type { ObservationDataRights } from "./observationDataRights.js";

export const OBSERVATION_PUBLICATION_RULESET_VERSION = "site_intelligence_p0_v1";

export type PublicLocationMode = FieldPublicLocationMode;
export type PublicTimePrecision = "datetime" | "date" | "month" | "season" | "hidden";
export type SensitivityStatus =
  | "none"
  | "taxon_sensitive"
  | "context_sensitive"
  | "human_sensitive"
  | "manager_restricted"
  | "uncertain";

export type ObservationPublicationPolicy = {
  publicLocationMode: PublicLocationMode;
  publicTimePrecision: PublicTimePrecision;
  sensitivityStatus: SensitivityStatus;
  sensitivityReason: string;
  policyRulesetVersion: string;
  recalculatedAt: string;
};

export type ObservationPublicationPolicyInput = {
  fieldPolicy: FieldProfilePolicy | null;
  dataRights: ObservationDataRights | null;
  civicContext?: Pick<CivicObservationContext, "riskLane" | "publicPrecision" | "contextKind"> | null;
  identification?: {
    aiOnly?: boolean | null;
    confidence?: number | null;
    taxonSensitive?: boolean | null;
  } | null;
  allowExactPublicLocation?: boolean;
  now?: Date;
};

function policy(
  input: ObservationPublicationPolicyInput,
  publicLocationMode: PublicLocationMode,
  publicTimePrecision: PublicTimePrecision,
  sensitivityStatus: SensitivityStatus,
  sensitivityReason: string,
): ObservationPublicationPolicy {
  return {
    publicLocationMode,
    publicTimePrecision,
    sensitivityStatus,
    sensitivityReason,
    policyRulesetVersion: OBSERVATION_PUBLICATION_RULESET_VERSION,
    recalculatedAt: (input.now ?? new Date()).toISOString(),
  };
}

function publicLocationMode(input: ObservationPublicationPolicyInput): PublicLocationMode {
  const requested = input.fieldPolicy?.defaultPublicLocationMode ?? "site";
  if (requested === "exact" && !input.allowExactPublicLocation) return "site";
  return requested;
}

function isSchoolOrHumanSensitive(input: ObservationPublicationPolicyInput): boolean {
  const kind = input.civicContext?.contextKind;
  return kind === "school" || kind === "risk";
}

export function decideObservationPublicationPolicy(
  input: ObservationPublicationPolicyInput,
): ObservationPublicationPolicy {
  const rights = input.dataRights;
  if (!rights) return policy(input, "hidden", "hidden", "uncertain", "missing_rights");
  if (rights.withdrawalStatus !== "active") {
    return policy(input, "hidden", "hidden", "context_sensitive", `rights_${rights.withdrawalStatus}`);
  }
  if (!rights.publicAggregationAllowed) {
    return policy(input, "hidden", "hidden", "context_sensitive", "public_aggregation_not_allowed");
  }

  const field = input.fieldPolicy;
  if (!field) return policy(input, "hidden", "hidden", "manager_restricted", "field_profile_missing");
  if (field.profileStatus === "hidden" || field.defaultPublicLocationMode === "hidden") {
    return policy(input, "hidden", "hidden", "manager_restricted", "field_profile_hidden");
  }
  if (!field.publicProfileEnabled || field.profileStatus !== "public_summary") {
    return policy(input, "hidden", "hidden", "manager_restricted", "field_profile_not_public");
  }

  const riskLane = input.civicContext?.riskLane ?? "normal";
  if (riskLane === "rare_sensitive") {
    return policy(
      input,
      "hidden",
      "hidden",
      isSchoolOrHumanSensitive(input) ? "human_sensitive" : "context_sensitive",
      "sensitive_context",
    );
  }
  if (isSchoolOrHumanSensitive(input)) {
    return policy(input, "hidden", "hidden", "human_sensitive", "human_or_school_context");
  }

  const identification = input.identification ?? {};
  if (identification.taxonSensitive === true) {
    return policy(input, "grid_1km", "month", "taxon_sensitive", "taxon_sensitive");
  }
  if (identification.aiOnly === true && (identification.confidence ?? 0) < 0.8) {
    return policy(input, "hidden", "hidden", "uncertain", "low_confidence_ai_draft");
  }

  const civicPrecision = input.civicContext?.publicPrecision;
  if (civicPrecision === "hidden" || civicPrecision === "exact_private") {
    return policy(input, "hidden", "hidden", "context_sensitive", `context_precision_${civicPrecision}`);
  }
  if (civicPrecision === "municipality") {
    return policy(input, "municipality", "month", "none", "context_precision_municipality");
  }
  if (civicPrecision === "mesh") {
    return policy(input, "grid_1km", "month", "none", "context_precision_mesh");
  }

  return policy(input, publicLocationMode(input), "date", "none", "ordinary_public_area_profile");
}
