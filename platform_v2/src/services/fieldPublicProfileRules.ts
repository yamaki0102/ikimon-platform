export const FIELD_PUBLIC_PROFILE_RULESET_VERSION = "site_intelligence_p0_v1";

export type FieldPublicProfileRules = {
  minObservationCount: number;
  minObserverCount: number;
  minTimeSpanDays: number;
  suppressIfSingleSource: boolean;
  suppressSensitiveContext: boolean;
  displaySuppressionReason: string;
  rulesetVersion: string;
};

export type FieldPublicProfileRulesInput = Partial<{
  minObservationCount: unknown;
  minObserverCount: unknown;
  minTimeSpanDays: unknown;
  suppressIfSingleSource: unknown;
  suppressSensitiveContext: unknown;
  displaySuppressionReason: unknown;
  rulesetVersion: unknown;
}>;

export type FieldPublicProfileStats = {
  observationCount: number;
  observerCount: number;
  timeSpanDays: number;
  sourceRecordCount: number;
  sensitiveContextCount: number;
};

export type FieldPublicProfileSuppressionReason =
  | "min_observation_count"
  | "min_observer_count"
  | "min_time_span_days"
  | "single_source"
  | "sensitive_context";

export type FieldPublicProfileReadiness = {
  canPublishDetails: boolean;
  suppressionReason: FieldPublicProfileSuppressionReason | null;
  displaySuppressionReason: string | null;
  rulesetVersion: string;
};

function numberAtLeast(value: unknown, fallback: number, min: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function cleanText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 300) : fallback;
}

export function normalizeFieldPublicProfileRules(input: FieldPublicProfileRulesInput): FieldPublicProfileRules {
  return {
    minObservationCount: numberAtLeast(input.minObservationCount, 5, 1),
    minObserverCount: numberAtLeast(input.minObserverCount, 3, 1),
    minTimeSpanDays: numberAtLeast(input.minTimeSpanDays, 14, 0),
    suppressIfSingleSource: input.suppressIfSingleSource !== false,
    suppressSensitiveContext: input.suppressSensitiveContext !== false,
    displaySuppressionReason: cleanText(
      input.displaySuppressionReason,
      "確認記録が少ないため、詳細な傾向はまだ表示していません",
    ),
    rulesetVersion: cleanText(input.rulesetVersion, FIELD_PUBLIC_PROFILE_RULESET_VERSION),
  };
}

function suppressed(
  rules: FieldPublicProfileRules,
  reason: FieldPublicProfileSuppressionReason,
): FieldPublicProfileReadiness {
  return {
    canPublishDetails: false,
    suppressionReason: reason,
    displaySuppressionReason: rules.displaySuppressionReason,
    rulesetVersion: rules.rulesetVersion,
  };
}

export function evaluateFieldPublicProfileReadiness(
  rules: FieldPublicProfileRules,
  stats: FieldPublicProfileStats,
): FieldPublicProfileReadiness {
  if (rules.suppressSensitiveContext && stats.sensitiveContextCount > 0) {
    return suppressed(rules, "sensitive_context");
  }
  if (stats.observationCount < rules.minObservationCount) {
    return suppressed(rules, "min_observation_count");
  }
  if (stats.observerCount < rules.minObserverCount) {
    return suppressed(rules, "min_observer_count");
  }
  if (stats.timeSpanDays < rules.minTimeSpanDays) {
    return suppressed(rules, "min_time_span_days");
  }
  if (rules.suppressIfSingleSource && stats.sourceRecordCount <= 1) {
    return suppressed(rules, "single_source");
  }
  return {
    canPublishDetails: true,
    suppressionReason: null,
    displaySuppressionReason: null,
    rulesetVersion: rules.rulesetVersion,
  };
}
