// Relationship Score v0.1 calculator (pure functions)
// spec: ikimon-internal/docs/spec/ikimon_relationship_score_v0_spec_2026-04-26.md

export const RELATIONSHIP_SCORE_CALC_VERSION = "v0.1.0";

export type RelationshipAxis =
  | "access"
  | "engagement"
  | "learning"
  | "stewardship"
  | "evidence";

export const RELATIONSHIP_AXES: RelationshipAxis[] = [
  "access",
  "engagement",
  "learning",
  "stewardship",
  "evidence",
];

export type AccessStatus = "private" | "limited" | "public";

export type ClimateZone =
  | "subarctic_n"
  | "temperate_n"
  | "subtropical_n"
  | "tropical"
  | "subtropical_s"
  | "temperate_s"
  | "subarctic_s";

export type Hemisphere = "north" | "south";

export type RelationshipScoreInputs = {
  // Access
  accessStatus: AccessStatus | null;
  safetyNotesPresent: boolean;

  // Engagement
  visitsCount: number;
  seasonsCovered: number; // 気候帯別の上限まで
  repeatObserverCount: number;

  // Learning
  notesCompletionRate: number; // 0..1
  identificationAttemptRate: number; // 0..1
  taxonRankDistinctCount: number;
  reviewReplyCount: number;

  // Stewardship
  stewardshipActionCount: number;
  stewardshipActionLinkedRate: number; // linked_visit_id 紐付け率 0..1

  // Evidence
  acceptedReviewRate: number; // quality_review_status='accepted' 比率 0..1
  effortCompletionRate: number; // effort_minutes NOT NULL 比率 0..1
  auditTrailPresent: boolean;

  // 地理コンテキスト
  centerLatitude: number | null;
};

export type AxisScore = {
  axis: RelationshipAxis;
  score: 0 | 10 | 20;
  reasons: string[];
};

export type RelationshipScoreResult = {
  totalScore: number; // 0..100
  axes: Record<RelationshipAxis, AxisScore>;
  climate: ClimateZone;
  hemisphere: Hemisphere;
  seasonCoverageCap: number;
  nextActionAxis: RelationshipAxis;
  nextActionPriority: number;
  calcVersion: string;
};

// 気候帯判定 (lat の絶対値・符号から)
export function classifyClimate(latitude: number | null): {
  climate: ClimateZone;
  hemisphere: Hemisphere;
} {
  if (latitude == null || Number.isNaN(latitude)) {
    return { climate: "temperate_n", hemisphere: "north" };
  }
  const hemisphere: Hemisphere = latitude >= 0 ? "north" : "south";
  const abs = Math.abs(latitude);
  if (abs > 66.5) {
    return { climate: hemisphere === "north" ? "subarctic_n" : "subarctic_s", hemisphere };
  }
  if (abs > 23.5) {
    // temperate, but split into subtropical near 23.5..35
    if (abs <= 35) {
      return { climate: hemisphere === "north" ? "subtropical_n" : "subtropical_s", hemisphere };
    }
    return { climate: hemisphere === "north" ? "temperate_n" : "temperate_s", hemisphere };
  }
  return { climate: "tropical", hemisphere };
}

export function seasonCoverageCap(climate: ClimateZone): number {
  switch (climate) {
    case "tropical":
      return 2; // 雨季・乾季
    case "subarctic_n":
    case "subarctic_s":
      return 3;
    case "subtropical_n":
    case "subtropical_s":
      return 3;
    case "temperate_n":
    case "temperate_s":
      return 4;
    default:
      return 4;
  }
}

// 気候帯と月から「季節 index」(0..cap-1) を返す
export function seasonForMonth(
  month: number,
  climate: ClimateZone,
  hemisphere: Hemisphere
): number {
  const m = ((month - 1) % 12 + 12) % 12; // 0..11
  if (climate === "tropical") {
    // 雨季 (5..10) / 乾季 (11..4) の 2区分。地域差大だが v0.1 はこれで暫定
    return m >= 4 && m <= 9 ? 0 : 1;
  }
  if (climate === "subarctic_n" || climate === "subarctic_s") {
    // 冬期長め: 春=4-5月, 夏=6-9月, 冬=10-3月 (北半球)
    const adj = hemisphere === "south" ? (m + 6) % 12 : m;
    if (adj === 3 || adj === 4) return 0; // 春
    if (adj >= 5 && adj <= 8) return 1; // 夏
    return 2; // 冬
  }
  if (climate === "subtropical_n" || climate === "subtropical_s") {
    // 3区分: 暑乾 / 雨季 / 涼期
    const adj = hemisphere === "south" ? (m + 6) % 12 : m;
    if (adj >= 4 && adj <= 6) return 0;
    if (adj >= 7 && adj <= 9) return 1;
    return 2;
  }
  // temperate (北半球温帯デフォルト、南半球は 6ヶ月シフト)
  const adj = hemisphere === "south" ? (m + 6) % 12 : m;
  if (adj >= 2 && adj <= 4) return 0; // 春
  if (adj >= 5 && adj <= 7) return 1; // 夏
  if (adj >= 8 && adj <= 10) return 2; // 秋
  return 3; // 冬
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function scoreAccess(inputs: RelationshipScoreInputs): AxisScore {
  const reasons: string[] = [];
  const { accessStatus, safetyNotesPresent } = inputs;
  if (!accessStatus || accessStatus === "private") {
    reasons.push("access_private_or_unset");
    return { axis: "access", score: 0, reasons };
  }
  if (accessStatus === "limited" || (accessStatus === "public" && !safetyNotesPresent)) {
    reasons.push(accessStatus === "limited" ? "access_limited" : "access_public_no_safety");
    return { axis: "access", score: 10, reasons };
  }
  reasons.push("access_public_with_safety");
  return { axis: "access", score: 20, reasons };
}

function scoreEngagement(
  inputs: RelationshipScoreInputs,
  cap: number
): AxisScore {
  const reasons: string[] = [];
  const { visitsCount, seasonsCovered, repeatObserverCount } = inputs;
  const seasonsTwoThirds = Math.ceil(cap * 0.5);
  const seasonsThreeQuarters = Math.ceil(cap * 0.75);

  if (visitsCount < 3) {
    reasons.push("visits_lt_3");
    return { axis: "engagement", score: 0, reasons };
  }
  const tier20 =
    visitsCount >= 12 && seasonsCovered >= seasonsThreeQuarters && repeatObserverCount >= 2;
  if (tier20) {
    reasons.push("engagement_full");
    return { axis: "engagement", score: 20, reasons };
  }
  if (visitsCount >= 3 && seasonsCovered >= seasonsTwoThirds) {
    reasons.push("engagement_partial");
    return { axis: "engagement", score: 10, reasons };
  }
  reasons.push("engagement_thin");
  return { axis: "engagement", score: 0, reasons };
}

function scoreLearning(inputs: RelationshipScoreInputs): AxisScore {
  const reasons: string[] = [];
  const idRate = clamp01(inputs.identificationAttemptRate);
  const noteRate = clamp01(inputs.notesCompletionRate);
  const ranks = inputs.taxonRankDistinctCount;
  const replies = inputs.reviewReplyCount;

  const tier20 = idRate >= 0.6 && ranks >= 5 && replies >= 1;
  if (tier20) {
    reasons.push("learning_full");
    return { axis: "learning", score: 20, reasons };
  }
  const tier10 = noteRate >= 0.3 || idRate >= 0.3 || ranks >= 1;
  if (tier10) {
    reasons.push("learning_partial");
    return { axis: "learning", score: 10, reasons };
  }
  reasons.push("learning_minimal");
  return { axis: "learning", score: 0, reasons };
}

function scoreStewardship(inputs: RelationshipScoreInputs): AxisScore {
  const reasons: string[] = [];
  const count = inputs.stewardshipActionCount;
  const linked = clamp01(inputs.stewardshipActionLinkedRate);
  if (count <= 0) {
    reasons.push("stewardship_none");
    return { axis: "stewardship", score: 0, reasons };
  }
  if (count >= 6 && linked >= 0.5) {
    reasons.push("stewardship_full");
    return { axis: "stewardship", score: 20, reasons };
  }
  reasons.push("stewardship_partial");
  return { axis: "stewardship", score: 10, reasons };
}

function scoreEvidence(inputs: RelationshipScoreInputs): AxisScore {
  const reasons: string[] = [];
  const accepted = clamp01(inputs.acceptedReviewRate);
  const effort = clamp01(inputs.effortCompletionRate);
  const audit = inputs.auditTrailPresent;

  if (accepted >= 0.4 && effort >= 0.4 && audit) {
    reasons.push("evidence_full");
    return { axis: "evidence", score: 20, reasons };
  }
  if (accepted >= 0.1 || effort >= 0.2) {
    reasons.push("evidence_partial");
    return { axis: "evidence", score: 10, reasons };
  }
  reasons.push("evidence_minimal");
  return { axis: "evidence", score: 0, reasons };
}

// 「次に伸ばす1点」の重み付き優先度
const COST_FACTOR: Record<RelationshipAxis, number> = {
  access: 0.4,
  engagement: 0.7,
  learning: 0.8,
  stewardship: 0.6,
  evidence: 0.5,
};

const W_GAP = 0.5;
const W_COST = 0.3;
const W_HEADROOM = 0.2;

function priorityScore(axisScore: AxisScore): number {
  const gap = (20 - axisScore.score) / 20; // 0..1
  const cost = COST_FACTOR[axisScore.axis];
  // headroom: 既に 20点なら 0、0点なら最大 (現在の実情で動かしやすさ)
  const headroom = axisScore.score === 0 ? 0.5 : axisScore.score === 10 ? 1.0 : 0;
  return gap * W_GAP + cost * W_COST + headroom * W_HEADROOM;
}

export function calculateRelationshipScore(
  inputs: RelationshipScoreInputs
): RelationshipScoreResult {
  const { climate, hemisphere } = classifyClimate(inputs.centerLatitude);
  const cap = seasonCoverageCap(climate);

  const access = scoreAccess(inputs);
  const engagement = scoreEngagement(inputs, cap);
  const learning = scoreLearning(inputs);
  const stewardship = scoreStewardship(inputs);
  const evidence = scoreEvidence(inputs);

  const axes: Record<RelationshipAxis, AxisScore> = {
    access,
    engagement,
    learning,
    stewardship,
    evidence,
  };

  const totalScore = access.score + engagement.score + learning.score + stewardship.score + evidence.score;

  // priority 最大の軸を選定 (full 20点は除外)
  let bestAxis: RelationshipAxis = "engagement";
  let bestPriority = -Infinity;
  for (const a of RELATIONSHIP_AXES) {
    if (axes[a].score >= 20) continue;
    const p = priorityScore(axes[a]);
    if (p > bestPriority) {
      bestPriority = p;
      bestAxis = a;
    }
  }
  if (bestPriority === -Infinity) {
    // 全軸満点。便宜上 engagement を返す
    bestPriority = 0;
  }

  return {
    totalScore,
    axes,
    climate,
    hemisphere,
    seasonCoverageCap: cap,
    nextActionAxis: bestAxis,
    nextActionPriority: bestPriority,
    calcVersion: RELATIONSHIP_SCORE_CALC_VERSION,
  };
}
