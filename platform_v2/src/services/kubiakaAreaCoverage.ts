export type KubiakaAreaCoverageBasis = "effort_only" | "registered_target_units";

export type KubiakaAreaCoverageLevel = "none" | "sparse" | "developing" | "target_met";

export type KubiakaAreaFreshness = "unknown" | "current" | "aging" | "revisit_due";

export type KubiakaPublicAreaState =
  | "no_observations"
  | "privacy_suppressed"
  | "more_observation_useful"
  | "observation_progressing"
  | "current_target_met"
  | "revisit_due";

export type KubiakaAreaMissingCondition =
  | "survey_usable_records"
  | "unique_survey_days"
  | "repeat_observed_units"
  | "known_target_coverage"
  | "freshness";

export type KubiakaAreaNextNeed =
  | "first_record"
  | "more_survey_usable_records"
  | "another_survey_day"
  | "repeat_same_unit"
  | "more_target_units"
  | "revisit_due";

export type KubiakaAreaCoverageTarget = Readonly<{
  minimumSurveyUsableRecords: number;
  minimumUniqueSurveyDays: number;
  minimumRepeatObservedUnits: number;
  agingAfterDays: number;
  revisitAfterDays: number;
  minimumKnownTargetCoverageRatio?: number;
}>;

export type KubiakaKnownTargetDenominator = Readonly<{
  kind: "registered_target_units";
  totalTargetUnits: number;
  observedTargetUnits: number;
  sourceId?: string | null;
  sourceUpdatedAt?: string | null;
}>;

export type KubiakaAreaCoverageInput = Readonly<{
  recordCount: number;
  photoCount: number;
  screenableRecordCount: number;
  surveyUsableRecordCount: number;
  uniqueSurveyDays: number;
  uniqueObservedUnits: number;
  repeatObservedUnits: number;
  lastObservedAt: string | null;
  lastSurveyUsableAt: string | null;
  asOf: string;
  publicMinRecords: number;
  target: KubiakaAreaCoverageTarget;
  denominator?: KubiakaKnownTargetDenominator | null;
}>;

export type KubiakaAreaCoverageProjection = Readonly<{
  claimBoundary: "monitoring_effort_not_species_absence";
  basis: KubiakaAreaCoverageBasis;
  publicState: KubiakaPublicAreaState;
  level: KubiakaAreaCoverageLevel;
  freshness: KubiakaAreaFreshness;
  recordCount: number;
  photoCount: number;
  screenableRecordCount: number;
  surveyUsableRecordCount: number;
  uniqueSurveyDays: number;
  uniqueObservedUnits: number;
  repeatObservedUnits: number;
  lastRelevantObservedAt: string | null;
  daysSinceRelevantObservation: number | null;
  knownTargetCoverageRatio: number | null;
  canShowKnownTargetPercentage: boolean;
  progressFraction: number;
  targetMet: boolean;
  privacySuppressed: boolean;
  missingConditions: readonly KubiakaAreaMissingCondition[];
  nextNeeds: readonly KubiakaAreaNextNeed[];
}>;

export function projectKubiakaAreaCoverage(input: KubiakaAreaCoverageInput): KubiakaAreaCoverageProjection {
  const recordCount = nonNegativeInteger(input.recordCount);
  const photoCount = nonNegativeInteger(input.photoCount);
  const screenableRecordCount = Math.min(recordCount, nonNegativeInteger(input.screenableRecordCount));
  const surveyUsableRecordCount = Math.min(screenableRecordCount, nonNegativeInteger(input.surveyUsableRecordCount));
  const uniqueSurveyDays = Math.min(recordCount, nonNegativeInteger(input.uniqueSurveyDays));
  const uniqueObservedUnits = Math.min(recordCount, nonNegativeInteger(input.uniqueObservedUnits));
  const repeatObservedUnits = Math.min(uniqueObservedUnits, nonNegativeInteger(input.repeatObservedUnits));
  const publicMinRecords = Math.max(1, nonNegativeInteger(input.publicMinRecords));

  const target = normalizeTarget(input.target);
  const denominator = normalizeDenominator(input.denominator);
  const basis: KubiakaAreaCoverageBasis = denominator ? "registered_target_units" : "effort_only";
  const knownTargetCoverageRatio = denominator
    ? clampRatio(denominator.observedTargetUnits / denominator.totalTargetUnits)
    : null;

  const lastRelevantObservedAt = surveyUsableRecordCount > 0
    ? input.lastSurveyUsableAt ?? input.lastObservedAt
    : input.lastObservedAt;
  const daysSinceRelevantObservation = elapsedWholeDays(lastRelevantObservedAt, input.asOf);
  const freshness = classifyFreshness(daysSinceRelevantObservation, target);

  const criteria = [
    progressCriterion(surveyUsableRecordCount, target.minimumSurveyUsableRecords, "survey_usable_records"),
    progressCriterion(uniqueSurveyDays, target.minimumUniqueSurveyDays, "unique_survey_days"),
    progressCriterion(repeatObservedUnits, target.minimumRepeatObservedUnits, "repeat_observed_units"),
  ];
  if (denominator && target.minimumKnownTargetCoverageRatio !== null) {
    criteria.push(progressRatioCriterion(
      knownTargetCoverageRatio ?? 0,
      target.minimumKnownTargetCoverageRatio,
      "known_target_coverage",
    ));
  }

  const progressFraction = roundFraction(criteria.reduce((sum, criterion) => sum + criterion.progress, 0) / criteria.length);
  const targetCriteriaMet = criteria.every((criterion) => criterion.met);
  const targetMet = recordCount > 0 && targetCriteriaMet && freshness !== "revisit_due";
  const hasMeaningfulCoverage = surveyUsableRecordCount > 0
    || screenableRecordCount >= Math.max(1, target.minimumSurveyUsableRecords);

  let level: KubiakaAreaCoverageLevel;
  if (recordCount === 0) level = "none";
  else if (targetMet) level = "target_met";
  else if (hasMeaningfulCoverage && progressFraction >= 0.5) level = "developing";
  else level = "sparse";

  const privacySuppressed = recordCount > 0 && recordCount < publicMinRecords;
  let publicState: KubiakaPublicAreaState;
  if (recordCount === 0) publicState = "no_observations";
  else if (privacySuppressed) publicState = "privacy_suppressed";
  else if (freshness === "revisit_due") publicState = "revisit_due";
  else if (targetMet) publicState = "current_target_met";
  else if (level === "developing") publicState = "observation_progressing";
  else publicState = "more_observation_useful";

  const missingConditions: KubiakaAreaMissingCondition[] = criteria
    .filter((criterion) => !criterion.met)
    .map((criterion) => criterion.condition);
  if (freshness === "revisit_due") missingConditions.push("freshness");

  const nextNeeds: KubiakaAreaNextNeed[] = [];
  if (recordCount === 0) {
    nextNeeds.push("first_record");
  } else {
    if (freshness === "revisit_due") nextNeeds.push("revisit_due");
    if (surveyUsableRecordCount < target.minimumSurveyUsableRecords) nextNeeds.push("more_survey_usable_records");
    if (uniqueSurveyDays < target.minimumUniqueSurveyDays) nextNeeds.push("another_survey_day");
    if (repeatObservedUnits < target.minimumRepeatObservedUnits) nextNeeds.push("repeat_same_unit");
    if (
      denominator
      && target.minimumKnownTargetCoverageRatio !== null
      && (knownTargetCoverageRatio ?? 0) < target.minimumKnownTargetCoverageRatio
    ) {
      nextNeeds.push("more_target_units");
    }
  }

  return {
    claimBoundary: "monitoring_effort_not_species_absence",
    basis,
    publicState,
    level,
    freshness,
    recordCount,
    photoCount,
    screenableRecordCount,
    surveyUsableRecordCount,
    uniqueSurveyDays,
    uniqueObservedUnits,
    repeatObservedUnits,
    lastRelevantObservedAt: normalizeDateString(lastRelevantObservedAt),
    daysSinceRelevantObservation,
    knownTargetCoverageRatio,
    canShowKnownTargetPercentage: denominator !== null && !privacySuppressed,
    progressFraction,
    targetMet,
    privacySuppressed,
    missingConditions: uniqueValues(missingConditions),
    nextNeeds: uniqueValues(nextNeeds),
  };
}

type ProgressCriterion = Readonly<{
  condition: KubiakaAreaMissingCondition;
  met: boolean;
  progress: number;
}>;

function progressCriterion(
  actual: number,
  required: number,
  condition: KubiakaAreaMissingCondition,
): ProgressCriterion {
  if (required <= 0) return { condition, met: true, progress: 1 };
  return {
    condition,
    met: actual >= required,
    progress: clampRatio(actual / required),
  };
}

function progressRatioCriterion(
  actual: number,
  required: number,
  condition: KubiakaAreaMissingCondition,
): ProgressCriterion {
  if (required <= 0) return { condition, met: true, progress: 1 };
  return {
    condition,
    met: actual >= required,
    progress: clampRatio(actual / required),
  };
}

function normalizeTarget(target: KubiakaAreaCoverageTarget): Readonly<{
  minimumSurveyUsableRecords: number;
  minimumUniqueSurveyDays: number;
  minimumRepeatObservedUnits: number;
  agingAfterDays: number;
  revisitAfterDays: number;
  minimumKnownTargetCoverageRatio: number | null;
}> {
  const agingAfterDays = nonNegativeInteger(target.agingAfterDays);
  const revisitAfterDays = Math.max(agingAfterDays, nonNegativeInteger(target.revisitAfterDays));
  return {
    minimumSurveyUsableRecords: nonNegativeInteger(target.minimumSurveyUsableRecords),
    minimumUniqueSurveyDays: nonNegativeInteger(target.minimumUniqueSurveyDays),
    minimumRepeatObservedUnits: nonNegativeInteger(target.minimumRepeatObservedUnits),
    agingAfterDays,
    revisitAfterDays,
    minimumKnownTargetCoverageRatio: target.minimumKnownTargetCoverageRatio === undefined
      ? null
      : clampRatio(target.minimumKnownTargetCoverageRatio),
  };
}

function normalizeDenominator(
  denominator: KubiakaKnownTargetDenominator | null | undefined,
): KubiakaKnownTargetDenominator | null {
  if (!denominator) return null;
  const totalTargetUnits = nonNegativeInteger(denominator.totalTargetUnits);
  if (totalTargetUnits <= 0) return null;
  return {
    kind: "registered_target_units",
    totalTargetUnits,
    observedTargetUnits: Math.min(totalTargetUnits, nonNegativeInteger(denominator.observedTargetUnits)),
    sourceId: denominator.sourceId ? String(denominator.sourceId).trim() || null : null,
    sourceUpdatedAt: normalizeDateString(denominator.sourceUpdatedAt ?? null),
  };
}

function classifyFreshness(
  daysSinceRelevantObservation: number | null,
  target: Readonly<{ agingAfterDays: number; revisitAfterDays: number }>,
): KubiakaAreaFreshness {
  if (daysSinceRelevantObservation === null) return "unknown";
  if (daysSinceRelevantObservation >= target.revisitAfterDays) return "revisit_due";
  if (daysSinceRelevantObservation >= target.agingAfterDays) return "aging";
  return "current";
}

function elapsedWholeDays(from: string | null, to: string): number | null {
  if (!from) return null;
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000));
}

function normalizeDateString(value: string | null): string | null {
  if (!value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function nonNegativeInteger(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundFraction(value: number): number {
  return Math.round(clampRatio(value) * 1_000_000) / 1_000_000;
}

function uniqueValues<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
