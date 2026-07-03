export const FIELD_PROFILE_GENERATION_HISTORY_VERSION = "field_profile_generation_history/v1";

export type FieldProfileVisibility = "internal" | "manager" | "public";
export type FieldProfileContributionStatus = "public" | "suppressed" | "internal";

export type FieldProfileSourceRecordInput = {
  visitId: string;
  occurrenceId?: string | null;
  contributionStatus?: FieldProfileContributionStatus;
  policyReason?: string | null;
  sourcePayload?: Record<string, unknown> | null;
};

export type FieldProfileGenerationInput = {
  fieldId: string;
  rulesetVersion?: string;
  generatedBy?: string;
  visibility?: FieldProfileVisibility;
  sourceRecords: FieldProfileSourceRecordInput[];
  aiRunIds?: string[];
  humanDecisionIds?: string[];
  profilePayload?: Record<string, unknown>;
  limitationsPayload?: Record<string, unknown>;
  generatedAt?: Date;
};

export type FieldProfileGenerationLedger = {
  schemaVersion: typeof FIELD_PROFILE_GENERATION_HISTORY_VERSION;
  run: {
    fieldId: string;
    generatedAt: string;
    rulesetVersion: string;
    inputRecordCount: number;
    publicRecordCount: number;
    suppressedRecordCount: number;
    aiRunIds: string[];
    humanDecisionIds: string[];
    generatedBy: string;
    visibility: FieldProfileVisibility;
  };
  snapshot: {
    fieldId: string;
    visibility: FieldProfileVisibility;
    profilePayload: Record<string, unknown>;
    limitationsPayload: Record<string, unknown>;
  };
  sourceRecords: Array<{
    fieldId: string;
    visitId: string;
    occurrenceId: string | null;
    contributionStatus: FieldProfileContributionStatus;
    policyReason: string;
    sourcePayload: Record<string, unknown>;
  }>;
};

function cleanText(value: unknown, fallback: string, max = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function cleanStringList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => cleanText(value, "", 160)).filter(Boolean)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function contributionStatus(value: unknown): FieldProfileContributionStatus {
  return value === "public" || value === "suppressed" || value === "internal" ? value : "internal";
}

function visibility(value: unknown): FieldProfileVisibility {
  return value === "public" || value === "manager" || value === "internal" ? value : "internal";
}

export function buildFieldProfileGenerationLedger(input: FieldProfileGenerationInput): FieldProfileGenerationLedger {
  const fieldId = cleanText(input.fieldId, "");
  if (!fieldId) throw new Error("field_id_required");
  const sourceRecords = input.sourceRecords.map((record) => ({
    fieldId,
    visitId: cleanText(record.visitId, ""),
    occurrenceId: cleanText(record.occurrenceId, ""),
    contributionStatus: contributionStatus(record.contributionStatus),
    policyReason: cleanText(record.policyReason, ""),
    sourcePayload: asRecord(record.sourcePayload),
  })).filter((record) => record.visitId);
  const publicRecordCount = sourceRecords.filter((record) => record.contributionStatus === "public").length;
  const suppressedRecordCount = sourceRecords.filter((record) => record.contributionStatus === "suppressed").length;
  const resolvedVisibility = visibility(input.visibility);

  return {
    schemaVersion: FIELD_PROFILE_GENERATION_HISTORY_VERSION,
    run: {
      fieldId,
      generatedAt: (input.generatedAt ?? new Date()).toISOString(),
      rulesetVersion: cleanText(input.rulesetVersion, "site_intelligence_p0_v1"),
      inputRecordCount: sourceRecords.length,
      publicRecordCount,
      suppressedRecordCount,
      aiRunIds: cleanStringList(input.aiRunIds),
      humanDecisionIds: cleanStringList(input.humanDecisionIds),
      generatedBy: cleanText(input.generatedBy, "system"),
      visibility: resolvedVisibility,
    },
    snapshot: {
      fieldId,
      visibility: resolvedVisibility,
      profilePayload: asRecord(input.profilePayload),
      limitationsPayload: asRecord(input.limitationsPayload),
    },
    sourceRecords,
  };
}
