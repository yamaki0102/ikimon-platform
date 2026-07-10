export type CivicCampaignTheme =
  | "seasonal_walk"
  | "invasive_species"
  | "school_learning"
  | "waterfront"
  | "satoyama"
  | "city_nature";

export type CivicCampaignRecordMode = "photo" | "audio" | "memo" | "unknown_species" | "non_detection";

export type CivicCampaignPublicResultMode = "area_digest" | "species_list" | "campaign_story" | "private_only";

export type CivicCampaignConfigV0 = {
  schemaVersion: "civic_campaign_config/v0";
  campaignId: string;
  municipality: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  areaScope: {
    placeIds: string[];
    polygonIds: string[];
    municipalityCodes: string[];
  };
  theme: CivicCampaignTheme;
  targetTaxaScope: string[];
  allowedRecordModes: CivicCampaignRecordMode[];
  publicPrecisionPolicy: "site_or_coarser" | "mesh_or_coarser" | "municipality_or_hidden";
  sensitiveRulesetId: string;
  reviewPolicyId: string;
  reportTemplateId: string;
  publicResultMode: CivicCampaignPublicResultMode;
  claimBoundary: string[];
};

export type CivicCampaignReportInputV0 = {
  campaign: CivicCampaignConfigV0;
  generatedAt: string;
  participation: {
    participantCount: number;
    recordCount: number;
    visitCount: number;
    firstTimerRate: number;
    schoolOrEventCount: number;
  };
  recordBreakdown: {
    taxaGroups: Record<string, number>;
    seasons: Record<string, number>;
    placeTypes: Record<string, number>;
    mediaModes: Record<string, number>;
    unknownNameRate: number;
  };
  verificationState: {
    unverified: number;
    aiSuggested: number;
    locallyReviewed: number;
    expertVerified: number;
    municipalReady: number;
  };
  safetyHandling: {
    privateCount: number;
    precisionDowngradeCount: number;
    rareSpeciesCount: number;
    schoolContextCount: number;
    homeAreaRiskCount: number;
    privateLandCount: number;
  };
  qualityExclusions: Record<string, number>;
  coverageDebt: string[];
  nextYearSuggestions: string[];
};

export type CivicCampaignReportExportV0 = {
  schemaVersion: "civic_campaign_report_export/v0";
  campaignId: string;
  formats: {
    markdown: string;
    json: Record<string, unknown>;
    csv: string;
  };
};

export const STATIC_CIVIC_CAMPAIGN_CONFIGS_V0: CivicCampaignConfigV0[] = [
  {
    schemaVersion: "civic_campaign_config/v0",
    campaignId: "jp-shizuoka-seasonal-walk-v0",
    municipality: "静岡市",
    title: "季節の散策と身近な自然記録",
    periodStart: "2026-04-01",
    periodEnd: "2027-03-31",
    areaScope: {
      placeIds: [],
      polygonIds: [],
      municipalityCodes: ["22100"],
    },
    theme: "seasonal_walk",
    targetTaxaScope: ["plants", "birds", "insects", "waterfront", "street_edge_nature", "unknown_scene"],
    allowedRecordModes: ["photo", "audio", "memo", "unknown_species", "non_detection"],
    publicPrecisionPolicy: "site_or_coarser",
    sensitiveRulesetId: "jp-civic-sensitive-place-v0",
    reviewPolicyId: "local-review-before-municipal-use-v0",
    reportTemplateId: "annual-civic-walk-report-v0",
    publicResultMode: "area_digest",
    claimBoundary: [
      "公式提出物ではなく、地域資料化のための読み取りモデルです。",
      "不在証明、全生物相の網羅、行政認定を示すものではありません。",
      "希少種、学校、自宅付近、私有地は公開範囲を落とすか非公開にします。",
    ],
  },
];

function clampCount(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function percent(value: number): string {
  const bounded = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return `${Math.round(bounded * 100)}%`;
}

function keyValueLines(values: Record<string, number>): string[] {
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([key, value]) => `- ${key}: ${clampCount(value)}`);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(section: string, item: string, value: unknown, note = ""): string {
  return [section, item, value, note].map(csvCell).join(",");
}

export function getStaticCivicCampaignConfigV0(campaignId = "jp-shizuoka-seasonal-walk-v0"): CivicCampaignConfigV0 {
  const config = STATIC_CIVIC_CAMPAIGN_CONFIGS_V0.find((campaign) => campaign.campaignId === campaignId);
  if (!config) {
    throw new Error(`unknown_civic_campaign_config:${campaignId}`);
  }
  return config;
}

export function buildCivicCampaignReportExportV0(input: CivicCampaignReportInputV0): CivicCampaignReportExportV0 {
  const campaign = input.campaign;
  const participation = {
    participantCount: clampCount(input.participation.participantCount),
    recordCount: clampCount(input.participation.recordCount),
    visitCount: clampCount(input.participation.visitCount),
    firstTimerRate: percent(input.participation.firstTimerRate),
    schoolOrEventCount: clampCount(input.participation.schoolOrEventCount),
  };
  const verification = {
    unverified: clampCount(input.verificationState.unverified),
    aiSuggested: clampCount(input.verificationState.aiSuggested),
    locallyReviewed: clampCount(input.verificationState.locallyReviewed),
    expertVerified: clampCount(input.verificationState.expertVerified),
    municipalReady: clampCount(input.verificationState.municipalReady),
  };
  const safety = {
    privateCount: clampCount(input.safetyHandling.privateCount),
    precisionDowngradeCount: clampCount(input.safetyHandling.precisionDowngradeCount),
    rareSpeciesCount: clampCount(input.safetyHandling.rareSpeciesCount),
    schoolContextCount: clampCount(input.safetyHandling.schoolContextCount),
    homeAreaRiskCount: clampCount(input.safetyHandling.homeAreaRiskCount),
    privateLandCount: clampCount(input.safetyHandling.privateLandCount),
  };

  const markdown = [
    `# ${campaign.title}`,
    "",
    `- 期間: ${campaign.periodStart} - ${campaign.periodEnd}`,
    `- 対象自治体: ${campaign.municipality}`,
    `- テーマ: ${campaign.theme}`,
    "",
    "## 参加状況",
    `- 参加者数: ${participation.participantCount}`,
    `- 記録数: ${participation.recordCount}`,
    `- 訪問数: ${participation.visitCount}`,
    `- 初回参加率: ${participation.firstTimerRate}`,
    `- 学校/イベント区分: ${participation.schoolOrEventCount}`,
    "",
    "## 記録内訳",
    "### 分類群",
    ...keyValueLines(input.recordBreakdown.taxaGroups),
    "### 季節",
    ...keyValueLines(input.recordBreakdown.seasons),
    "### 場所タイプ",
    ...keyValueLines(input.recordBreakdown.placeTypes),
    "### 写真/音/メモ",
    ...keyValueLines(input.recordBreakdown.mediaModes),
    `- 名前不明率: ${percent(input.recordBreakdown.unknownNameRate)}`,
    "",
    "## 検証状態",
    `- 未確認: ${verification.unverified}`,
    `- AI候補: ${verification.aiSuggested}`,
    `- 地域確認: ${verification.locallyReviewed}`,
    `- 専門家確認: ${verification.expertVerified}`,
    `- 自治体利用可: ${verification.municipalReady}`,
    "",
    "## 安全処理",
    `- 非公開件数: ${safety.privateCount}`,
    `- 位置丸め件数: ${safety.precisionDowngradeCount}`,
    `- 希少種: ${safety.rareSpeciesCount}`,
    `- 学校: ${safety.schoolContextCount}`,
    `- 自宅付近: ${safety.homeAreaRiskCount}`,
    `- 私有地: ${safety.privateLandCount}`,
    "",
    "## 品質除外",
    ...keyValueLines(input.qualityExclusions),
    "",
    "## Coverage Debt",
    ...(input.coverageDebt.length ? input.coverageDebt.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 次年度提案",
    ...(input.nextYearSuggestions.length ? input.nextYearSuggestions.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## Claim Boundary",
    ...campaign.claimBoundary.map((item) => `- ${item}`),
    "",
  ].join("\n");

  const json = {
    schemaVersion: "civic_campaign_report_export/v0",
    generatedAt: input.generatedAt,
    campaign,
    participation,
    recordBreakdown: {
      ...input.recordBreakdown,
      unknownNameRate: percent(input.recordBreakdown.unknownNameRate),
    },
    verificationState: verification,
    safetyHandling: safety,
    qualityExclusions: input.qualityExclusions,
    coverageDebt: input.coverageDebt,
    nextYearSuggestions: input.nextYearSuggestions,
    claimBoundary: campaign.claimBoundary,
  };

  const csv = [
    ["section", "item", "value", "note"].map(csvCell).join(","),
    csvRow("period", "start", campaign.periodStart),
    csvRow("period", "end", campaign.periodEnd),
    csvRow("area", "municipality", campaign.municipality),
    csvRow("participation", "participant_count", participation.participantCount),
    csvRow("participation", "record_count", participation.recordCount),
    csvRow("participation", "visit_count", participation.visitCount),
    csvRow("participation", "first_timer_rate", participation.firstTimerRate),
    ...Object.entries(input.recordBreakdown.taxaGroups).map(([key, value]) => csvRow("taxa_groups", key, clampCount(value))),
    ...Object.entries(input.recordBreakdown.seasons).map(([key, value]) => csvRow("seasons", key, clampCount(value))),
    ...Object.entries(input.recordBreakdown.placeTypes).map(([key, value]) => csvRow("place_types", key, clampCount(value))),
    ...Object.entries(input.recordBreakdown.mediaModes).map(([key, value]) => csvRow("media_modes", key, clampCount(value))),
    csvRow("record_breakdown", "unknown_name_rate", percent(input.recordBreakdown.unknownNameRate)),
    ...Object.entries(verification).map(([key, value]) => csvRow("verification_state", key, value)),
    ...Object.entries(safety).map(([key, value]) => csvRow("safety_handling", key, value)),
    ...Object.entries(input.qualityExclusions).map(([key, value]) => csvRow("quality_exclusions", key, clampCount(value))),
    ...input.coverageDebt.map((item) => csvRow("coverage_debt", "item", item)),
    ...input.nextYearSuggestions.map((item) => csvRow("next_year_suggestions", "item", item)),
    ...campaign.claimBoundary.map((item) => csvRow("claim_boundary", "item", item)),
  ].join("\n");

  return {
    schemaVersion: "civic_campaign_report_export/v0",
    campaignId: campaign.campaignId,
    formats: {
      markdown,
      json,
      csv,
    },
  };
}
