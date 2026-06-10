export type DetectionSemantic =
  | "not_evaluated"
  | "insufficient_coverage"
  | "non_detection"
  | "absence_candidate"
  | "absence";

export type DetectionSemanticInput = {
  occurrenceStatus?: string | null;
  occurrenceStatuses?: Array<string | null | undefined>;
  effortMinutes?: number | null;
  distanceMeters?: number | null;
  targetTaxaScope?: string | null;
  completeChecklistFlag?: boolean | null;
  reviewStatus?: string | null;
  repeatedNonDetectionCount?: number | null;
  explicitAbsenceReviewed?: boolean | null;
};

export const DETECTION_SEMANTIC_LABELS: Record<DetectionSemantic, string> = {
  not_evaluated: "未評価",
  insufficient_coverage: "記録がまだ薄い",
  non_detection: "この条件では確認されず",
  absence_candidate: "継続的に未確認",
  absence: "不在扱い",
};

export const DETECTION_SEMANTIC_PUBLIC_CLAIMS: Record<DetectionSemantic, string> = {
  not_evaluated: "未確認を評価していません。",
  insufficient_coverage: "対象範囲・努力量・complete checklist が足りないため、見つからなかったとは扱いません。",
  non_detection: "対象範囲と努力量がある条件つき未確認です。不在証明ではありません。",
  absence_candidate: "複数条件で継続的に未確認ですが、専門確認前の傾向です。",
  absence: "明示的な調査設計とレビューを通した限定的な不在扱いです。",
};

const REVIEWED_STATES = new Set(["verified", "expert_verified", "reviewed"]);
const NON_DETECTION_SEMANTICS = new Set<DetectionSemantic>(["non_detection", "absence_candidate", "absence"]);

function positiveNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizedStatuses(input: DetectionSemanticInput): string[] {
  const raw = input.occurrenceStatuses ?? [input.occurrenceStatus];
  return raw.map((status) => String(status ?? "").trim().toLowerCase()).filter(Boolean);
}

export function hasDetectionDenominator(input: DetectionSemanticInput): boolean {
  const hasEffort = positiveNumber(input.effortMinutes) || positiveNumber(input.distanceMeters);
  const hasTarget = Boolean(input.targetTaxaScope?.trim());
  return hasEffort && hasTarget && input.completeChecklistFlag === true;
}

export function deriveDetectionSemantic(input: DetectionSemanticInput): DetectionSemantic {
  const statuses = normalizedStatuses(input);
  if (!statuses.includes("absent")) return "not_evaluated";
  if (!hasDetectionDenominator(input)) return "insufficient_coverage";
  if (input.explicitAbsenceReviewed === true || REVIEWED_STATES.has(String(input.reviewStatus ?? "").toLowerCase())) {
    return "absence";
  }
  if ((input.repeatedNonDetectionCount ?? 0) >= 2) return "absence_candidate";
  return "non_detection";
}

export function detectionSemanticAllowsNoDetectionClaim(semantic: DetectionSemantic): boolean {
  return NON_DETECTION_SEMANTICS.has(semantic);
}

export function detectionSemanticLabel(semantic: DetectionSemantic): string {
  return DETECTION_SEMANTIC_LABELS[semantic];
}

export function detectionClaimBoundary(semantic: DetectionSemantic): string {
  return DETECTION_SEMANTIC_PUBLIC_CLAIMS[semantic];
}

export function detectionSemanticDataGapReasons(semantic: DetectionSemantic): string[] {
  if (semantic === "insufficient_coverage") return ["non_detection_requires_effort_target_scope_and_complete_checklist"];
  return [];
}
