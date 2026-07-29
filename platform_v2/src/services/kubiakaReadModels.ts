export type KubiakaInternalState =
  | "saved"
  | "assessment_queued"
  | "assessment_in_progress"
  | "feedback_draft"
  | "feedback_ready"
  | "more_evidence_requested"
  | "specialist_review_requested"
  | "case_opened"
  | "recipient_shared"
  | "recipient_acknowledged"
  | "follow_up_due"
  | "closed";

export type KubiakaContributorState =
  | "received"
  | "checking"
  | "feedback_ready"
  | "more_evidence"
  | "specialist_checking"
  | "shared"
  | "acknowledged"
  | "watching";

export type KubiakaEvidenceRole =
  | "surroundings"
  | "whole_tree"
  | "branches"
  | "trunk"
  | "base"
  | "adult_insect"
  | "adult_detail"
  | "frass"
  | "exit_hole"
  | "damage_sign"
  | "other_context";

export type KubiakaEvidenceVisibility = "visible" | "partial" | "not_visible" | "not_applicable" | "unknown";
export type KubiakaEvidenceAssessor = "ai" | "reviewer";

export type KubiakaEvidenceCoverageItem = Readonly<{
  role: KubiakaEvidenceRole;
  status: KubiakaEvidenceVisibility;
  sourceAssetIds: readonly string[];
  confidence: number | null;
  assessor: KubiakaEvidenceAssessor;
  limitations: readonly string[];
}>;

export type KubiakaRecordUsability =
  | "photo_record"
  | "screenable_record"
  | "survey_usable"
  | "repeat_comparable"
  | "insufficient_evidence";

export type KubiakaCoverageSummary = Readonly<{
  photoCount: number;
  visibleRoles: readonly KubiakaEvidenceRole[];
  partialRoles: readonly KubiakaEvidenceRole[];
  missingCoreRoles: readonly KubiakaEvidenceRole[];
  usability: KubiakaRecordUsability;
  canStatePhotoScopeNoClearSign: boolean;
  canStateSurveyNonDetection: boolean;
  limitations: readonly string[];
}>;

export type KubiakaAssessmentFinding =
  | "adult_candidate"
  | "frass_candidate"
  | "exit_hole_candidate"
  | "tree_damage_candidate"
  | "no_clear_sign_in_visible_scope"
  | "insufficient_evidence"
  | "unrelated_subject";

export type KubiakaReviewAuthority = "automated" | "trained_reviewer" | "accountable_specialist" | "approved_recipient";

export type KubiakaFeedbackProjection = Readonly<{
  photoCount: number;
  authority: KubiakaReviewAuthority;
  finding: KubiakaAssessmentFinding;
  coverage: KubiakaCoverageSummary;
  nonDetectionScope: "photo_scope" | "survey_non_detection" | null;
  previousComparison: "not_available" | "candidate_first_recorded_now" | "no_material_change" | "changed";
  nextActions: readonly (
    | "add_photos"
    | "revisit_same_place"
    | "record_another_place"
    | "wait_for_specialist"
    | "finish_for_now"
  )[];
  limitations: readonly string[];
}>;

export type KubiakaContinuationKind = "feedback" | "more_evidence" | "checking" | "revisit" | "first_record";

export type KubiakaContinuation = Readonly<{
  kind: KubiakaContinuationKind;
  recordId: string | null;
  placeId: string | null;
}>;

export function contributorStateForKubiaka(state: KubiakaInternalState): KubiakaContributorState {
  switch (state) {
    case "saved":
    case "assessment_queued":
      return "received";
    case "assessment_in_progress":
    case "feedback_draft":
      return "checking";
    case "feedback_ready":
      return "feedback_ready";
    case "more_evidence_requested":
      return "more_evidence";
    case "specialist_review_requested":
    case "case_opened":
      return "specialist_checking";
    case "recipient_shared":
      return "shared";
    case "recipient_acknowledged":
      return "acknowledged";
    case "follow_up_due":
    case "closed":
      return "watching";
  }
}

export function selectKubiakaContinuation(input: Readonly<{
  unreadFeedbackRecordIds?: readonly string[];
  moreEvidenceRecordIds?: readonly string[];
  checkingRecordIds?: readonly string[];
  comparablePlaceIds?: readonly string[];
  recordCount?: number;
}>): KubiakaContinuation {
  const feedbackRecordId = firstNonEmpty(input.unreadFeedbackRecordIds);
  if (feedbackRecordId) return { kind: "feedback", recordId: feedbackRecordId, placeId: null };

  const moreEvidenceRecordId = firstNonEmpty(input.moreEvidenceRecordIds);
  if (moreEvidenceRecordId) return { kind: "more_evidence", recordId: moreEvidenceRecordId, placeId: null };

  const checkingRecordId = firstNonEmpty(input.checkingRecordIds);
  if (checkingRecordId) return { kind: "checking", recordId: checkingRecordId, placeId: null };

  const comparablePlaceId = firstNonEmpty(input.comparablePlaceIds);
  if (comparablePlaceId) return { kind: "revisit", recordId: null, placeId: comparablePlaceId };

  return { kind: "first_record", recordId: null, placeId: null };
}

export function summarizeKubiakaEvidenceCoverage(input: Readonly<{
  photoCount: number;
  items: readonly KubiakaEvidenceCoverageItem[];
  effortReported?: boolean;
  protocolSatisfied?: boolean;
  hasComparablePreviousRecord?: boolean;
}>): KubiakaCoverageSummary {
  const photoCount = Math.max(0, Math.floor(input.photoCount));
  const byRole = new Map<KubiakaEvidenceRole, KubiakaEvidenceCoverageItem>();
  for (const item of input.items) {
    const existing = byRole.get(item.role);
    if (!existing || visibilityRank(item.status) > visibilityRank(existing.status)) {
      byRole.set(item.role, item);
    }
  }

  const roles = [...byRole.values()];
  const visibleRoles = roles.filter((item) => item.status === "visible").map((item) => item.role).sort();
  const partialRoles = roles.filter((item) => item.status === "partial").map((item) => item.role).sort();
  const coreRoles: readonly KubiakaEvidenceRole[] = ["whole_tree", "trunk", "base"];
  const missingCoreRoles = coreRoles.filter((role) => {
    const status = byRole.get(role)?.status ?? "unknown";
    return status !== "visible" && status !== "partial";
  });

  const screenable = photoCount > 0 && (
    hasVisibleOrPartial(byRole, "adult_insect")
    || hasVisibleOrPartial(byRole, "frass")
    || hasVisibleOrPartial(byRole, "exit_hole")
    || (hasVisibleOrPartial(byRole, "whole_tree")
      && hasVisibleOrPartial(byRole, "trunk")
      && hasVisibleOrPartial(byRole, "base"))
  );
  const surveyUsable = screenable
    && input.effortReported === true
    && input.protocolSatisfied === true
    && missingCoreRoles.length === 0;
  const repeatComparable = screenable && input.hasComparablePreviousRecord === true;

  let usability: KubiakaRecordUsability;
  if (photoCount === 0 || !screenable) usability = "insufficient_evidence";
  else if (surveyUsable) usability = "survey_usable";
  else if (repeatComparable) usability = "repeat_comparable";
  else usability = "screenable_record";

  const limitations = uniqueStrings([
    ...roles.flatMap((item) => item.limitations),
    ...missingCoreRoles.map((role) => `missing_core_role:${role}`),
    ...(input.effortReported === true ? [] : ["sampling_effort_not_reported"]),
    ...(input.protocolSatisfied === true ? [] : ["protocol_not_satisfied"]),
  ]);

  return {
    photoCount,
    visibleRoles,
    partialRoles,
    missingCoreRoles,
    usability,
    canStatePhotoScopeNoClearSign: screenable,
    canStateSurveyNonDetection: surveyUsable,
    limitations,
  };
}

export function buildKubiakaFeedbackProjection(input: Readonly<{
  photoCount: number;
  coverageItems: readonly KubiakaEvidenceCoverageItem[];
  finding: KubiakaAssessmentFinding;
  authority: KubiakaReviewAuthority;
  effortReported?: boolean;
  protocolSatisfied?: boolean;
  hasComparablePreviousRecord?: boolean;
  previousComparison?: KubiakaFeedbackProjection["previousComparison"];
  nextActions?: KubiakaFeedbackProjection["nextActions"];
  limitations?: readonly string[];
}>): KubiakaFeedbackProjection {
  const coverage = summarizeKubiakaEvidenceCoverage({
    photoCount: input.photoCount,
    items: input.coverageItems,
    effortReported: input.effortReported,
    protocolSatisfied: input.protocolSatisfied,
    hasComparablePreviousRecord: input.hasComparablePreviousRecord,
  });

  let nonDetectionScope: KubiakaFeedbackProjection["nonDetectionScope"] = null;
  if (input.finding === "no_clear_sign_in_visible_scope") {
    if (coverage.canStateSurveyNonDetection) nonDetectionScope = "survey_non_detection";
    else if (coverage.canStatePhotoScopeNoClearSign) nonDetectionScope = "photo_scope";
  }

  const defaultNextActions: KubiakaFeedbackProjection["nextActions"] = input.finding === "insufficient_evidence"
    ? ["add_photos", "finish_for_now"]
    : input.finding === "adult_candidate" || input.finding === "frass_candidate" || input.finding === "exit_hole_candidate"
      ? ["wait_for_specialist", "add_photos", "finish_for_now"]
      : ["revisit_same_place", "record_another_place", "finish_for_now"];

  return {
    photoCount: coverage.photoCount,
    authority: input.authority,
    finding: input.finding,
    coverage,
    nonDetectionScope,
    previousComparison: input.previousComparison ?? "not_available",
    nextActions: input.nextActions ?? defaultNextActions,
    limitations: uniqueStrings([...coverage.limitations, ...(input.limitations ?? [])]),
  };
}

function firstNonEmpty(values: readonly string[] | undefined): string | null {
  for (const value of values ?? []) {
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function hasVisibleOrPartial(
  byRole: ReadonlyMap<KubiakaEvidenceRole, KubiakaEvidenceCoverageItem>,
  role: KubiakaEvidenceRole,
): boolean {
  const status = byRole.get(role)?.status;
  return status === "visible" || status === "partial";
}

function visibilityRank(status: KubiakaEvidenceVisibility): number {
  switch (status) {
    case "visible": return 5;
    case "partial": return 4;
    case "not_visible": return 3;
    case "not_applicable": return 2;
    case "unknown": return 1;
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
}
