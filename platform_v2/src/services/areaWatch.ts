import type {
  AreaEffortIndicators,
  AreaSeasonCoverage,
  AreaSensitiveMasking,
  AreaYearlyRow,
} from "./areaPlaceSnapshot.js";

export type AreaWatchLevel = "sprout" | "growing" | "watched" | "well_watched";

export type AreaWatchDimensionKey =
  | "photo_clues"
  | "season_clues"
  | "freshness"
  | "method_clues"
  | "trust_clues"
  | "continuity";

export type AreaWatchDimension = {
  key: AreaWatchDimensionKey;
  label: string;
  score: number;
  status: AreaWatchLevel;
  childText: string;
  stewardText: string;
  nextAction: string;
  evidence: string[];
};

export type AreaWatchEvidenceStats = {
  totalOccurrences: number;
  photoOccurrences: number;
  contextPhotoOccurrences: number;
  primarySubjectPhotoOccurrences: number;
  recent90Occurrences: number;
  recent180Occurrences: number;
  reviewedOccurrences: number;
  aiCandidateOccurrences: number;
  methodContextVisits: number;
  latestObservedAt: string | null;
};

export type AreaWatch = {
  schemaVersion: "area_watch/v0";
  score: number;
  status: AreaWatchLevel;
  label: string;
  childSummary: string;
  stewardSummary: string;
  researcherNote: string;
  nextAction: {
    dimension: AreaWatchDimensionKey;
    title: string;
    body: string;
  };
  celebrations: string[];
  gaps: string[];
  dimensions: AreaWatchDimension[];
};

export type BuildAreaWatchInput = {
  totalObservations: number;
  totalVisits: number;
  uniqueTaxa: number;
  seasonalCoverage: AreaSeasonCoverage[];
  yearlyTimeline: AreaYearlyRow[];
  effortIndicators: AreaEffortIndicators;
  sensitiveMasking: AreaSensitiveMasking;
  evidenceStats: AreaWatchEvidenceStats;
};

const DIMENSION_LABEL: Record<AreaWatchDimensionKey, string> = {
  photo_clues: "写真の手がかり",
  season_clues: "季節の手がかり",
  freshness: "最近の手がかり",
  method_clues: "見方の手がかり",
  trust_clues: "信頼の手がかり",
  continuity: "続けて見ている",
};

const STATUS_LABEL: Record<AreaWatchLevel, string> = {
  sprout: "見守りの芽",
  growing: "育ち中",
  watched: "見守り中",
  well_watched: "よく見守られています",
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.max(0, Math.min(1, numerator / denominator)) : 0;
}

function levelForScore(score: number): AreaWatchLevel {
  if (score >= 80) return "well_watched";
  if (score >= 55) return "watched";
  if (score >= 30) return "growing";
  return "sprout";
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

function dimension(args: {
  key: AreaWatchDimensionKey;
  score: number;
  childText: string;
  stewardText: string;
  nextAction: string;
  evidence: string[];
}): AreaWatchDimension {
  const score = clampScore(args.score);
  return {
    key: args.key,
    label: DIMENSION_LABEL[args.key],
    score,
    status: levelForScore(score),
    childText: args.childText,
    stewardText: args.stewardText,
    nextAction: args.nextAction,
    evidence: args.evidence,
  };
}

function observedSeasonLabels(seasonalCoverage: AreaSeasonCoverage[]): string[] {
  return seasonalCoverage.filter((row) => row.observations > 0).map((row) => row.label);
}

function currentSeasonCoverage(seasonalCoverage: AreaSeasonCoverage[]): AreaSeasonCoverage | null {
  return seasonalCoverage.find((row) => row.isCurrentSeason) ?? null;
}

function buildPhotoDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const total = Math.max(input.evidenceStats.totalOccurrences, input.totalObservations);
  const photoRate = ratio(input.evidenceStats.photoOccurrences, total);
  const contextRate = ratio(input.evidenceStats.contextPhotoOccurrences, total);
  const primaryRate = ratio(input.evidenceStats.primarySubjectPhotoOccurrences, total);
  const score = photoRate * 58 + contextRate * 24 + primaryRate * 18;
  const missing = Math.max(0, total - input.evidenceStats.photoOccurrences);
  return dimension({
    key: "photo_clues",
    score,
    childText: photoRate >= 0.8
      ? "写真の手がかりはよく集まっています。"
      : missing > 0
        ? `${missing}件くらい、写真の手がかりを足すと強くなります。`
        : "最初の写真を残すところから始めます。",
    stewardText: `写真あり ${input.evidenceStats.photoOccurrences}/${total}、環境写真 ${input.evidenceStats.contextPhotoOccurrences}件。`,
    nextAction: contextRate < 0.25
      ? "生きものだけでなく、まわりの草・水辺・地面も1枚撮る"
      : "同じ対象を少し近くと少し遠くで撮る",
    evidence: [
      `写真あり: ${input.evidenceStats.photoOccurrences}/${total}`,
      `環境写真: ${input.evidenceStats.contextPhotoOccurrences}`,
      `主対象写真: ${input.evidenceStats.primarySubjectPhotoOccurrences}`,
    ],
  });
}

function buildSeasonDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const observed = observedSeasonLabels(input.seasonalCoverage);
  const current = currentSeasonCoverage(input.seasonalCoverage);
  const seasonRate = ratio(observed.length, Math.max(1, input.seasonalCoverage.length || 4));
  const currentBonus = current && current.observations > 0 ? 20 : 0;
  const score = seasonRate * 80 + currentBonus;
  const missing = input.seasonalCoverage.filter((row) => row.observations <= 0).map((row) => row.label);
  return dimension({
    key: "season_clues",
    score,
    childText: missing.length === 0
      ? "四季の手がかりがそろっています。"
      : `${missing.join("・")}の記録がまだ薄いです。`,
    stewardText: `記録済み季節: ${observed.join("・") || "なし"}。今の季節: ${current?.label ?? "不明"} ${current && current.observations > 0 ? "あり" : "不足"}。`,
    nextAction: current && current.observations <= 0
      ? `今の季節の${current.label}を1回見に行く`
      : missing.length > 0
        ? `${missing[0]}の観察会を予定する`
        : "同じ季節にもう一度見て、年ごとの違いを比べる",
    evidence: [
      `記録済み季節: ${observed.length}/${input.seasonalCoverage.length || 4}`,
      `未記録季節: ${missing.join("・") || "なし"}`,
    ],
  });
}

function buildFreshnessDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const latestDays = daysSince(input.evidenceStats.latestObservedAt);
  const recentRate = ratio(input.evidenceStats.recent90Occurrences, Math.max(input.evidenceStats.totalOccurrences, input.totalObservations));
  const base = latestDays == null
    ? 0
    : latestDays <= 90
      ? 70
      : latestDays <= 180
        ? 52
        : latestDays <= 365
          ? 32
          : 12;
  const score = base + recentRate * 30;
  return dimension({
    key: "freshness",
    score,
    childText: latestDays == null
      ? "最近の記録はまだありません。"
      : latestDays <= 90
        ? "最近も見に行けています。"
        : `${latestDays}日くらい前の記録です。もう一度見ると今がわかります。`,
    stewardText: `最新観察: ${input.evidenceStats.latestObservedAt?.slice(0, 10) ?? "なし"}。90日以内 ${input.evidenceStats.recent90Occurrences}件、180日以内 ${input.evidenceStats.recent180Occurrences}件。`,
    nextAction: latestDays == null || latestDays > 90
      ? "今月の写真を1枚足して、古い記録を更新する"
      : "次は同じ場所を次の季節にも見る",
    evidence: [
      `最新観察: ${input.evidenceStats.latestObservedAt?.slice(0, 10) ?? "なし"}`,
      `90日以内: ${input.evidenceStats.recent90Occurrences}`,
      `180日以内: ${input.evidenceStats.recent180Occurrences}`,
    ],
  });
}

function buildMethodDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const methodRate = ratio(input.evidenceStats.methodContextVisits, Math.max(input.totalVisits, 1));
  const score = Math.max(input.effortIndicators.effortIndex, input.effortIndicators.effortReportedRate * 55 + methodRate * 25 + input.effortIndicators.nonDetectionRate * 20);
  return dimension({
    key: "method_clues",
    score,
    childText: score >= 55
      ? "どう見たかの手がかりも残っています。"
      : "何分見たか、同じ道を歩いたか、見つからなかったかを足すと強くなります。",
    stewardText: `effort index ${Math.round(input.effortIndicators.effortIndex)}、method context ${input.evidenceStats.methodContextVisits}/${Math.max(input.totalVisits, 1)} visits。`,
    nextAction: input.effortIndicators.nonDetectionRate <= 0
      ? "探したけど見つからなかった記録も残す"
      : "次の観察では時間・範囲・対象分類群をそろえる",
    evidence: [
      `effort入力率: ${Math.round(input.effortIndicators.effortReportedRate * 100)}%`,
      `完全チェックリスト率: ${Math.round(input.effortIndicators.completeChecklistRate * 100)}%`,
      `非検出/チェックリスト: ${Math.round(input.effortIndicators.nonDetectionRate * 100)}%`,
    ],
  });
}

function buildTrustDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const total = Math.max(input.evidenceStats.totalOccurrences, input.totalObservations);
  const reviewedRate = ratio(input.evidenceStats.reviewedOccurrences, total);
  const visitReview = input.totalVisits > 0 ? input.effortIndicators.effortReportedRate * 10 : 0;
  const sensitivePenalty = input.sensitiveMasking.maskedSpecies > 0 ? 0 : 8;
  const candidateSeparationScore = input.totalVisits > 0
    ? input.evidenceStats.aiCandidateOccurrences > 0 ? 18 : 12
    : 0;
  const score = reviewedRate * 62 + candidateSeparationScore;
  const finalScore = score + visitReview + sensitivePenalty;
  return dimension({
    key: "trust_clues",
    score: finalScore,
    childText: input.evidenceStats.reviewedOccurrences > 0
      ? "確認された手がかりがあります。AIだけの記録とは分けています。"
      : "AI候補や同定待ちは、くわしい人の確認を待っています。",
    stewardText: `reviewed ${input.evidenceStats.reviewedOccurrences}/${total}、AI候補 ${input.evidenceStats.aiCandidateOccurrences}、公開制御対象 ${input.sensitiveMasking.maskedSpecies}種。`,
    nextAction: input.evidenceStats.reviewedOccurrences <= 0
      ? "1件だけでも reviewer 確認済みにする"
      : "AI候補と確認済みを分けたまま月次資料に使う",
    evidence: [
      `reviewed: ${input.evidenceStats.reviewedOccurrences}`,
      `AI候補: ${input.evidenceStats.aiCandidateOccurrences}`,
      `位置マスク対象: ${input.sensitiveMasking.maskedSpecies}`,
    ],
  });
}

function buildContinuityDimension(input: BuildAreaWatchInput): AreaWatchDimension {
  const visitsScore = Math.min(1, input.totalVisits / 12) * 38;
  const monthsScore = Math.min(1, input.effortIndicators.monthsCovered / 12) * 28;
  const yearsScore = Math.min(1, input.effortIndicators.yearsCovered / 3) * 20;
  const observerScore = input.effortIndicators.observerDiversity * 14;
  const score = visitsScore + monthsScore + yearsScore + observerScore;
  return dimension({
    key: "continuity",
    score,
    childText: score >= 55
      ? "何度も見に行けていて、場所の記憶が育っています。"
      : "同じ場所をくり返し見ると、変化に気づきやすくなります。",
    stewardText: `訪問 ${input.totalVisits}回、${input.effortIndicators.monthsCovered}か月、${input.effortIndicators.yearsCovered}年、観察者 ${input.effortIndicators.observerCount}人。`,
    nextAction: input.totalVisits < 3
      ? "まず3回の再訪を作る"
      : input.effortIndicators.monthsCovered < 6
        ? "空いている月に短い再訪を足す"
        : "担当者を増やして観察者の偏りを下げる",
    evidence: [
      `訪問: ${input.totalVisits}`,
      `記録月: ${input.effortIndicators.monthsCovered}`,
      `観察者: ${input.effortIndicators.observerCount}`,
    ],
  });
}

function headlineFor(status: AreaWatchLevel): string {
  switch (status) {
    case "well_watched":
      return "この場所は、かなりよく見守られています。";
    case "watched":
      return "この場所の見守りは、使える形に育っています。";
    case "growing":
      return "この場所の見守りは、育ち始めています。";
    case "sprout":
      return "この場所の見守りは、これから始まります。";
  }
}

export function buildAreaWatch(input: BuildAreaWatchInput): AreaWatch {
  const dimensions = [
    buildPhotoDimension(input),
    buildSeasonDimension(input),
    buildFreshnessDimension(input),
    buildMethodDimension(input),
    buildTrustDimension(input),
    buildContinuityDimension(input),
  ];
  const score = clampScore(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const status = levelForScore(score);
  const weakest = dimensions.slice().sort((a, b) => a.score - b.score)[0] ?? dimensions[0]!;
  const strongest = dimensions.filter((item) => item.score >= 55).sort((a, b) => b.score - a.score).slice(0, 3);
  const gaps = dimensions.filter((item) => item.score < 55).map((item) => `${item.label}: ${item.nextAction}`);
  const celebrations = strongest.length > 0
    ? strongest.map((item) => `${item.label}: ${item.childText}`)
    : ["エリア登録ができています。最初の観察で見守りを始められます。"];
  return {
    schemaVersion: "area_watch/v0",
    score,
    status,
    label: STATUS_LABEL[status],
    childSummary: headlineFor(status),
    stewardSummary: `見守り材料スコア ${score}/100。これは自然の良し悪しではなく、判断材料のそろい具合です。`,
    researcherNote: "観察数・種数を成果証明にせず、写真、季節、鮮度、方法、レビュー、継続性を分けて読むための派生指標です。",
    nextAction: {
      dimension: weakest.key,
      title: `${weakest.label}を育てる`,
      body: weakest.nextAction,
    },
    celebrations,
    gaps,
    dimensions,
  };
}
