export type AreaSketchLandCoverCategory =
  | "agricultural_land"
  | "trees_planting"
  | "grassland"
  | "water_edge"
  | "yard_experience_space"
  | "building"
  | "pavement_parking"
  | "unknown";

export type AreaSketchPolicyVersion =
  | "general_precheck_v1"
  | "tsunag_2026_current"
  | "tsunag_2027_planned";

export type AreaSketchLandCoverInput = {
  category: AreaSketchLandCoverCategory;
  areaHa?: number;
  area_ha?: number;
  ratio?: number;
  percent?: number;
};

export type AreaSketchThresholdResult = {
  ratio: number;
  label: "10%" | "20%" | "30%";
  reached: boolean;
  requiredGreenAreaHa: number;
  shortageHa: number;
};

export type AreaSketchAbsoluteAreaStatus = {
  policyVersion: AreaSketchPolicyVersion;
  thresholdHa: number | null;
  thresholdLabel: string | null;
  status: "not_applicable" | "below" | "near_threshold" | "above";
  marginHa: number | null;
};

export type AreaSketchEvidenceItem = {
  key: string;
  label: string;
  reason: string;
};

export type AreaSketchClaimBoundary = {
  canSay: string[];
  cannotSay: string[];
  requiredDisclaimer: string;
  prohibitedPhrases: string[];
};

export type AreaSketchEstimateResult = {
  estimateVersion: "area_sketch_estimate_v1";
  policyVersion: AreaSketchPolicyVersion;
  totalAreaHa: number;
  classifiedAreaHa: number;
  greenCandidateAreaHa: number;
  conditionalGreenCandidateAreaHa: number;
  unknownAreaHa: number;
  greenRatio: number;
  greenRatioPercent: number;
  thresholds: AreaSketchThresholdResult[];
  absoluteArea: AreaSketchAbsoluteAreaStatus;
  evidenceChecklist: AreaSketchEvidenceItem[];
  claimBoundary: AreaSketchClaimBoundary;
  warnings: string[];
};

const GREEN_CANDIDATE_CATEGORIES = new Set<AreaSketchLandCoverCategory>([
  "agricultural_land",
  "trees_planting",
  "grassland",
  "water_edge",
]);

const CONDITIONAL_GREEN_CANDIDATE_CATEGORIES = new Set<AreaSketchLandCoverCategory>([
  "yard_experience_space",
]);

const RATIO_THRESHOLDS: Array<AreaSketchThresholdResult["ratio"]> = [0.1, 0.2, 0.3];

const CLAIM_BOUNDARY: AreaSketchClaimBoundary = {
  canSay: [
    "衛星地図上の概算として、区域候補の面積と緑地割合の目安を整理できます。",
    "TSUNAGの事前相談や社内整理に向けた不足資料の洗い出しに使えます。",
    "写真、観察記録、管理記録、事前相談メールと紐づけて証跡を整理できます。",
  ],
  cannotSay: [
    "正式な測量面積、申請書の最終値、認定可否の保証とは扱えません。",
    "第三者の私有地、学校敷地、子どもの活動場所を公開用資料として無条件に出力できません。",
    "航空写真や外部地図の利用条件を超えた転載・二次利用はできません。",
  ],
  requiredDisclaimer:
    "この結果はZUKANによる事前診断・資料整理支援の概算です。正式申請、測量、行政判断、認定取得を保証するものではありません。",
  prohibitedPhrases: ["申請できます", "認定されます", "正式面積", "測量済み", "保証"],
};

function roundHa(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundRatio(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function nonNegativeFinite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function areaHaFromInput(input: AreaSketchLandCoverInput, totalAreaHa: number): number {
  const areaHa = nonNegativeFinite(input.areaHa ?? input.area_ha);
  if (areaHa != null) return areaHa;
  const ratio = nonNegativeFinite(input.ratio);
  if (ratio != null) return totalAreaHa * ratio;
  const percent = nonNegativeFinite(input.percent);
  if (percent != null) return totalAreaHa * (percent / 100);
  return 0;
}

function absoluteThreshold(policyVersion: AreaSketchPolicyVersion): { thresholdHa: number | null; label: string | null } {
  if (policyVersion === "tsunag_2026_current") return { thresholdHa: 0.1, label: "1,000m2以上" };
  if (policyVersion === "tsunag_2027_planned") return { thresholdHa: 0.05, label: "500m2以上(2027予定)" };
  return { thresholdHa: null, label: null };
}

function assessAbsoluteArea(totalAreaHa: number, policyVersion: AreaSketchPolicyVersion): AreaSketchAbsoluteAreaStatus {
  const threshold = absoluteThreshold(policyVersion);
  if (threshold.thresholdHa == null) {
    return {
      policyVersion,
      thresholdHa: null,
      thresholdLabel: null,
      status: "not_applicable",
      marginHa: null,
    };
  }
  const marginHa = Math.max(0.005, threshold.thresholdHa * 0.05);
  const delta = totalAreaHa - threshold.thresholdHa;
  const status = Math.abs(delta) <= marginHa ? "near_threshold" : delta > 0 ? "above" : "below";
  return {
    policyVersion,
    thresholdHa: threshold.thresholdHa,
    thresholdLabel: threshold.label,
    status,
    marginHa: roundHa(marginHa),
  };
}

function pushUniqueEvidence(items: AreaSketchEvidenceItem[], item: AreaSketchEvidenceItem): void {
  if (!items.some((existing) => existing.key === item.key)) items.push(item);
}

function buildEvidenceChecklist(input: {
  policyVersion: AreaSketchPolicyVersion;
  unknownAreaHa: number;
  conditionalGreenCandidateAreaHa: number;
  absoluteArea: AreaSketchAbsoluteAreaStatus;
}): AreaSketchEvidenceItem[] {
  const items: AreaSketchEvidenceItem[] = [];
  pushUniqueEvidence(items, {
    key: "boundary_basis",
    label: "区域境界の根拠",
    reason: "衛星地図上でなぞった線が、敷地境界・管理範囲・既存境界のどれに基づくかを確認するため。",
  });
  pushUniqueEvidence(items, {
    key: "current_site_photos",
    label: "現況写真",
    reason: "緑地、舗装、建物、不明箇所の分類が現地状態と合っているか確認するため。",
  });
  if (input.unknownAreaHa > 0) {
    pushUniqueEvidence(items, {
      key: "unknown_area_resolution",
      label: "不明区分の確認メモ",
      reason: "不明面積が緑地割合の概算に影響するため。",
    });
  }
  if (input.conditionalGreenCandidateAreaHa > 0) {
    pushUniqueEvidence(items, {
      key: "conditional_green_basis",
      label: "園庭・体験スペースの緑地扱い根拠",
      reason: "活動スペースは自動で緑地算入せず、植栽・土・管理実態を別確認するため。",
    });
  }
  if (input.policyVersion !== "general_precheck_v1") {
    pushUniqueEvidence(items, {
      key: "management_records",
      label: "管理記録",
      reason: "緑地の維持管理、活動、改善予定を説明する資料に接続するため。",
    });
    pushUniqueEvidence(items, {
      key: "preconsultation_email",
      label: "事前相談メール・回答",
      reason: "正式申請ではなく、事前相談に向けた論点整理として扱うため。",
    });
    if (input.absoluteArea.status === "near_threshold") {
      pushUniqueEvidence(items, {
        key: "area_threshold_confirmation",
        label: "面積しきい値付近の確認",
        reason: "概算誤差で要件判定が変わり得るため、しきい値付近では測量値や管理図面を確認するため。",
      });
    }
  }
  return items;
}

export function estimateAreaSketch(input: {
  totalAreaHa: number;
  landCover: AreaSketchLandCoverInput[];
  policyVersion?: AreaSketchPolicyVersion;
}): AreaSketchEstimateResult {
  const policyVersion = input.policyVersion ?? "general_precheck_v1";
  const totalAreaHa = roundHa(Math.max(0, input.totalAreaHa));
  const warnings: string[] = [];

  let classifiedAreaHa = 0;
  let greenCandidateAreaHa = 0;
  let conditionalGreenCandidateAreaHa = 0;
  let explicitUnknownAreaHa = 0;

  for (const row of input.landCover) {
    const areaHa = areaHaFromInput(row, totalAreaHa);
    classifiedAreaHa += areaHa;
    if (GREEN_CANDIDATE_CATEGORIES.has(row.category)) greenCandidateAreaHa += areaHa;
    if (CONDITIONAL_GREEN_CANDIDATE_CATEGORIES.has(row.category)) conditionalGreenCandidateAreaHa += areaHa;
    if (row.category === "unknown") explicitUnknownAreaHa += areaHa;
  }

  if (classifiedAreaHa > totalAreaHa + 0.0001) warnings.push("classification_area_exceeds_total");
  const unclassifiedAreaHa = Math.max(0, totalAreaHa - classifiedAreaHa);
  const unknownAreaHa = explicitUnknownAreaHa + unclassifiedAreaHa;
  const greenRatio = totalAreaHa > 0 ? greenCandidateAreaHa / totalAreaHa : 0;
  const thresholds = RATIO_THRESHOLDS.map((ratio) => {
    const requiredGreenAreaHa = totalAreaHa * ratio;
    return {
      ratio,
      label: `${Math.round(ratio * 100)}%` as AreaSketchThresholdResult["label"],
      reached: greenCandidateAreaHa >= requiredGreenAreaHa,
      requiredGreenAreaHa: roundHa(requiredGreenAreaHa),
      shortageHa: roundHa(Math.max(0, requiredGreenAreaHa - greenCandidateAreaHa)),
    };
  });
  const absoluteArea = assessAbsoluteArea(totalAreaHa, policyVersion);
  const evidenceChecklist = buildEvidenceChecklist({
    policyVersion,
    unknownAreaHa,
    conditionalGreenCandidateAreaHa,
    absoluteArea,
  });

  return {
    estimateVersion: "area_sketch_estimate_v1",
    policyVersion,
    totalAreaHa,
    classifiedAreaHa: roundHa(classifiedAreaHa),
    greenCandidateAreaHa: roundHa(greenCandidateAreaHa),
    conditionalGreenCandidateAreaHa: roundHa(conditionalGreenCandidateAreaHa),
    unknownAreaHa: roundHa(unknownAreaHa),
    greenRatio: roundRatio(greenRatio),
    greenRatioPercent: Math.round(greenRatio * 1_000) / 10,
    thresholds,
    absoluteArea,
    evidenceChecklist,
    claimBoundary: CLAIM_BOUNDARY,
    warnings,
  };
}

export function findForbiddenAreaSketchClaims(text: string): string[] {
  return CLAIM_BOUNDARY.prohibitedPhrases.filter((phrase) => text.includes(phrase));
}
