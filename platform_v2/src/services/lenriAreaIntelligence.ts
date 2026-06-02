import { getPlaceSnapshot, type PlaceSnapshot } from "./placeSnapshot.js";

export const LENRI_AREA_INTELLIGENCE_SCHEMA_VERSION = "lenri_area_intelligence/v0";
export const LENRI_EFFORT_READINESS_SCHEMA_VERSION = "lenri_effort_readiness/v0";
export const LENRI_LIVE_EFFORT_SCHEMA_VERSION = "lenri_live_effort/v0";

export type LenriAreaRingId = "core_site" | "walkable_buffer" | "local_context";

export type LenriAreaRing = {
  ringId: LenriAreaRingId;
  label: string;
  radiusM: number;
  purpose: string;
  pdiCellPlan: string;
};

export type LenriContextSignal = {
  category: "amenity" | "leisure" | "shop" | "natural" | "landuse" | "waterway" | "tourism";
  count: number;
  interpretation: string;
};

export type LenriNamedSignal = {
  name: string;
  signalType: string;
  useInIkimon: string;
};

export type LenriEffortReadinessStatus = "ready" | "thin" | "missing";

export type LenriEffortDimension =
  | "site_scope"
  | "time"
  | "space"
  | "season"
  | "method"
  | "observer"
  | "non_detection"
  | "review";

export type LenriEffortReadinessItem = {
  dimension: LenriEffortDimension;
  label: string;
  status: LenriEffortReadinessStatus;
  currentEvidence: string;
  monitoringMinimum: string;
  gap: string;
  nextAction: string;
};

export type LenriNextSurveyAction = {
  priority: 1 | 2 | 3 | 4 | 5;
  ringId: LenriAreaRingId;
  target: string;
  suggestedProtocol: string;
  effortUnit: string;
  why: string;
  claimUnlocked: string;
};

export type LenriEffortReadiness = {
  schemaVersion: typeof LENRI_EFFORT_READINESS_SCHEMA_VERSION;
  summary: {
    status: LenriEffortReadinessStatus;
    readinessScore: number;
    trendClaimReady: boolean;
    currentEvidenceMode: string;
    monitoringUse: string;
    currentIkimonNotes: string[];
  };
  items: LenriEffortReadinessItem[];
  nextSurveyPlan: LenriNextSurveyAction[];
  metricDefinitions: Array<{
    key: "effort_minutes" | "complete_checklist" | "non_detection" | "method_context" | "repeat_visit";
    label: string;
    whyItMatters: string;
  }>;
  guardrails: string[];
  modelSwapIn: string[];
};

export type LenriLiveEffortSnapshot = {
  schemaVersion: typeof LENRI_LIVE_EFFORT_SCHEMA_VERSION;
  status: "loaded" | "unavailable";
  source: "place_snapshot";
  fieldId: string;
  generatedAt: string | null;
  summary: {
    totalObservations: number;
    totalVisits: number;
    uniqueTaxa: number;
    latestObservedAt: string | null;
    effortCompletionRate: number;
    seasonsCovered: number;
    seasonCoverageCap: number;
    seasonLabels: string[];
    absentRecords: number;
    reviewAcceptedRate: number;
    machineEffortMetadata: number;
    passiveAudioCount: number;
    methodContextCount: number;
    topTaxa: Array<{ name: string; count: number }>;
  };
  gaps: string[];
  nextActions: Array<{
    kind: string;
    title: string;
    body: string;
  }>;
  claimBoundary: {
    canSay: string[];
    cannotSayYet: string[];
  };
};

export type LenriAreaIntelligenceSnapshot = {
  schemaVersion: typeof LENRI_AREA_INTELLIGENCE_SCHEMA_VERSION;
  generatedAt: string;
  field: {
    certificationId: string;
    name: string;
    addressEvidence: string;
    lat: number;
    lng: number;
    radiusM: number;
    areaHa: number;
    bbox: {
      west: number;
      south: number;
      east: number;
      north: number;
    };
  };
  budgetGuard: {
    approvedMonthlyBudgetUsd: number;
    currentRecurringCostUsd: number;
    paidPdiSubscriptionAllowed: boolean;
    allowedPaidCondition: string;
    stoppedAction: string;
  };
  pdiAccess: {
    productName: string;
    status: "inquiry_submitted_pricing_unknown";
    requestedGeography: string;
    requestedGranularity: string;
    intendedUse: string[];
    commercialBoundary: string;
    swapInCondition: string;
  };
  rings: LenriAreaRing[];
  openDataProxy: {
    sourceLabel: string;
    collectedAt: string;
    radiusM: number;
    uniqueElementCount: number;
    contextSignals: LenriContextSignal[];
    namedSignals: LenriNamedSignal[];
    landUseSignals: string[];
  };
  effortReadiness: LenriEffortReadiness;
  liveEffort?: LenriLiveEffortSnapshot;
  decisionPolicy: {
    adoptWhen: string[];
    doNotAdoptWhen: string[];
    measurement: string[];
  };
  claimBoundary: {
    canSay: string[];
    cannotSayYet: string[];
  };
};

const CONTEXT_SIGNALS: LenriContextSignal[] = [
  {
    category: "amenity",
    count: 111,
    interpretation: "生活・滞在の接点が多く、観察導線やイベント設計に使える可能性がある。",
  },
  {
    category: "leisure",
    count: 10,
    interpretation: "公園・余暇利用の文脈があり、週末や親子参加の観察企画に接続しやすい。",
  },
  {
    category: "shop",
    count: 10,
    interpretation: "地域回遊の接点として、無料エリアページの周辺情報に使える。",
  },
  {
    category: "natural",
    count: 35,
    interpretation: "水辺・緑地などの非生物多様性文脈を、観察仮説の補助情報として扱える。",
  },
  {
    category: "landuse",
    count: 63,
    interpretation: "農地・緑地・産業地の混在があり、生息環境の仮説分岐に使える。",
  },
  {
    category: "waterway",
    count: 11,
    interpretation: "用水・河川の近接は、両生類・水辺昆虫・鳥類の探索仮説を作る根拠になる。",
  },
  {
    category: "tourism",
    count: 0,
    interpretation: "観光地としての外部集客文脈は弱く、地域利用・現地活動の価値に寄せる。",
  },
];

const NAMED_SIGNALS: LenriNamedSignal[] = [
  {
    name: "カフェ&レストランLENRI",
    signalType: "site_anchor",
    useInIkimon: "連理の木の下での現地接点として、観察会・活動記録・地域ページの起点にする。",
  },
  {
    name: "都田総合公園",
    signalType: "nearby_leisure_green_space",
    useInIkimon: "無料の周辺エリアページで比較対象の緑地文脈として扱う。",
  },
  {
    name: "浜松市立都田南小学校",
    signalType: "community_anchor",
    useInIkimon: "教育・地域参加の文脈は示せるが、学校連携の事実としては扱わない。",
  },
  {
    name: "わんわん広場 ドッグラン",
    signalType: "visitor_activity",
    useInIkimon: "人の利用圧や観察時間帯の仮説に使う。",
  },
  {
    name: "三方原用水 / 加茂川",
    signalType: "water_context",
    useInIkimon: "水辺生物の探索仮説と、PDI人流文脈を分離して扱う。",
  },
];

const EFFORT_READINESS_ITEMS: LenriEffortReadinessItem[] = [
  {
    dimension: "site_scope",
    label: "site scope",
    status: "ready",
    currentEvidence: "連理中心点、120m core、500m buffer、1-2km local context を固定済み。",
    monitoringMinimum: "記録・集計・レポートで同じ空間単位を使う。",
    gap: "PDI本番データに差し替える時のcell対応表は未接続。",
    nextAction: "core / buffer / local context の3階層を、観察記録とPDI特徴量の共通キーにする。",
  },
  {
    dimension: "time",
    label: "effort minutes",
    status: "thin",
    currentEvidence: "既存のikimon記録には訪問・観察メモがあるが、このLenri POCではライブ集計していない。",
    monitoringMinimum: "1回の調査ごとに開始時刻、終了時刻、見た時間、移動距離または範囲を残す。",
    gap: "無料エリアページの文脈には使えるが、増減比較の分母としては薄い。",
    nextAction: "core siteで30分のwalk effortを1本作り、effort_minutesを必須にして投稿する。",
  },
  {
    dimension: "space",
    label: "mesh / ring coverage",
    status: "thin",
    currentEvidence: "OSM proxyで水路・公園・農地・生活接点は見えている。",
    monitoringMinimum: "core 120mとbuffer 500mのどちらで観察したかを分け、空白セルを残す。",
    gap: "どの微小環境を見ていないかはまだ自動で出ない。",
    nextAction: "連理敷地内、三方原用水/加茂川側、都田総合公園側を別targetとして調査する。",
  },
  {
    dimension: "season",
    label: "season repeat",
    status: "missing",
    currentEvidence: "単発の周辺文脈はあるが、季節差を語れる反復計画は未作成。",
    monitoringMinimum: "春・夏・秋・冬の各1回以上、同じ範囲と近い方法で記録する。",
    gap: "季節出現、活動期、非検出を比較できない。",
    nextAction: "次回から季節別のrepeat visitを作り、12か月のcoverageを管理する。",
  },
  {
    dimension: "method",
    label: "method context",
    status: "thin",
    currentEvidence: "しっかり記録、complete checklist、passive audioなどの土台は既存機能にある。",
    monitoringMinimum: "目視、写真、音声、水辺調査などの方法と対象分類群を記録する。",
    gap: "Lenri POC画面では実記録のmethod coverageをまだ接続していない。",
    nextAction: "鳥・昆虫・水辺生物を分け、methodとtarget_taxa_scopeを必須にした調査を作る。",
  },
  {
    dimension: "observer",
    label: "observer diversity",
    status: "missing",
    currentEvidence: "誰がどの程度探したかは、このproxyでは未集計。",
    monitoringMinimum: "観察者2名以上、または同一手順を別日で反復する。",
    gap: "個人の見落とし・同定傾向の偏りを補正できない。",
    nextAction: "スタッフ1名と来訪者/外部協力者1名の2系統で同じcoreを見てもらう。",
  },
  {
    dimension: "non_detection",
    label: "non-detection",
    status: "missing",
    currentEvidence: "見つかった記録は価値があるが、見つからなかった努力量はまだ弱い。",
    monitoringMinimum: "探したが見つからなかった対象も、範囲・時間・方法つきで残す。",
    gap: "absence、減少、少なさを語れない。",
    nextAction: "水辺・夜明け・日中の各targetで、非検出もcomplete checklistとして残す。",
  },
  {
    dimension: "review",
    label: "review lane",
    status: "thin",
    currentEvidence: "ikimonには専門家/管理者レビューの導線があるが、このPOCは読み取り専用。",
    monitoringMinimum: "有料レポートに使う記録は、人のレビュー状態を確認する。",
    gap: "AI候補や未レビュー記録をそのまま外部主張へ昇格できない。",
    nextAction: "有料レポート候補だけreview queueに流し、accepted/rejectedを記録する。",
  },
];

const NEXT_SURVEY_PLAN: LenriNextSurveyAction[] = [
  {
    priority: 1,
    ringId: "core_site",
    target: "連理の木の下で core 120m",
    suggestedProtocol: "walk_effort / complete checklist / photos where possible",
    effortUnit: "30 minutes, 1 observer, daytime",
    why: "まず比較の分母になる人の努力量を作る。",
    claimUnlocked: "この場所で何を何分探したかを説明できる。",
  },
  {
    priority: 2,
    ringId: "walkable_buffer",
    target: "三方原用水 / 加茂川側の水辺",
    suggestedProtocol: "water-edge check / target taxa scope: amphibian, aquatic insect, bird",
    effortUnit: "20 minutes, record detections and non-detections",
    why: "周辺文脈で最も仮説価値が高い水辺を、見つからなかった情報込みで押さえる。",
    claimUnlocked: "水辺を探した事実と、次に見るべき分類群を示せる。",
  },
  {
    priority: 3,
    ringId: "walkable_buffer",
    target: "都田総合公園側との比較",
    suggestedProtocol: "same walk_effort fields as core site",
    effortUnit: "30 minutes, same season as core survey",
    why: "連理だけでなく近接緑地との差分を無料エリアページに使える。",
    claimUnlocked: "周辺の緑地文脈と連理coreの違いを補助的に説明できる。",
  },
  {
    priority: 4,
    ringId: "core_site",
    target: "季節反復",
    suggestedProtocol: "repeat visit using same route and method",
    effortUnit: "1 visit per season, minimum 4 visits/year",
    why: "季節差が見えないと、珍しさや増減の説明が危うい。",
    claimUnlocked: "季節カバーのある観察活動として扱える。",
  },
  {
    priority: 5,
    ringId: "core_site",
    target: "任意: 夜明けまたは夜間の音声",
    suggestedProtocol: "passive audio or short dawn listening point",
    effortUnit: "10-20 minutes or device sampling window, sensor status required",
    why: "鳥・カエル・昆虫など、日中目視だけでは拾いにくい対象を補える。",
    claimUnlocked: "機械観測のeffort metadataを持つ補助証拠にできる。",
  },
];

const EFFORT_READINESS: LenriEffortReadiness = {
  schemaVersion: LENRI_EFFORT_READINESS_SCHEMA_VERSION,
  summary: {
    status: "thin",
    readinessScore: 32,
    trendClaimReady: false,
    currentEvidenceMode: "open_data_proxy_plus_existing_ikimon_notes",
    monitoringUse: "effort_design_and_gap_detection_not_trend_claim",
    currentIkimonNotes: [
      "production note: 連理関連の訪問・観察記録はあるが、このPOCではライブDB集計しない。",
      "staging note: 過去の検証では観察・訪問・分類群の存在を確認済み。ただし努力量補正済みではない。",
    ],
  },
  items: EFFORT_READINESS_ITEMS,
  nextSurveyPlan: NEXT_SURVEY_PLAN,
  metricDefinitions: [
    {
      key: "effort_minutes",
      label: "見た時間",
      whyItMatters: "同じ30分と5分の記録を同列に扱わないための分母になる。",
    },
    {
      key: "complete_checklist",
      label: "完全チェックリスト",
      whyItMatters: "見つかった種だけでなく、探した範囲全体を比較できる。",
    },
    {
      key: "non_detection",
      label: "非検出",
      whyItMatters: "探したが見つからなかった情報がないと、absenceや減少は語れない。",
    },
    {
      key: "method_context",
      label: "方法の文脈",
      whyItMatters: "目視、音声、水辺調査など、拾える生物が違う方法差を残す。",
    },
    {
      key: "repeat_visit",
      label: "反復訪問",
      whyItMatters: "季節・時間帯・観察者の偏りを下げ、有料レポートの信頼度を上げる。",
    },
  ],
  guardrails: [
    "このreadinessは調査設計であり、増減・absence・希少性の証明ではない。",
    "PDIを導入しても、人流や周辺特徴量は努力量の代替にならない。",
    "有料レポートに出す場合は、effort metadata、非検出、レビュー状態を明示する。",
  ],
  modelSwapIn: [
    "field_visits.effort_minutes / distance_meters をcore・buffer別に集計する。",
    "complete_checklist_flag と absent_records を非検出readinessへ接続する。",
    "observation_method / target_taxa_scope / passive_audio.sampling_effort をmethod coverageへ接続する。",
    "monitoring_workspace_read_model のmeshCoverageRate / seasonCoverageRate をLenri ring別に表示する。",
  ],
};

const EMPTY_LIVE_EFFORT_SUMMARY: LenriLiveEffortSnapshot["summary"] = {
  totalObservations: 0,
  totalVisits: 0,
  uniqueTaxa: 0,
  latestObservedAt: null,
  effortCompletionRate: 0,
  seasonsCovered: 0,
  seasonCoverageCap: 4,
  seasonLabels: [],
  absentRecords: 0,
  reviewAcceptedRate: 0,
  machineEffortMetadata: 0,
  passiveAudioCount: 0,
  methodContextCount: 0,
  topTaxa: [],
};

function liveEffortGaps(summary: LenriLiveEffortSnapshot["summary"]): string[] {
  const gaps: string[] = [];
  if (summary.totalVisits <= 0) gaps.push("visit_missing");
  if (summary.effortCompletionRate < 0.4) gaps.push("effort_metadata_below_40_percent");
  if (summary.seasonsCovered < Math.min(summary.seasonCoverageCap, 4)) gaps.push("season_repeat_incomplete");
  if (summary.absentRecords <= 0) gaps.push("non_detection_missing");
  if (summary.methodContextCount <= 0) gaps.push("method_context_missing");
  if (summary.reviewAcceptedRate <= 0) gaps.push("review_accepted_record_missing");
  return gaps;
}

export function buildLenriLiveEffortSnapshot(placeSnapshot: PlaceSnapshot | null, fieldId: string): LenriLiveEffortSnapshot {
  if (!placeSnapshot) {
    return {
      schemaVersion: LENRI_LIVE_EFFORT_SCHEMA_VERSION,
      status: "unavailable",
      source: "place_snapshot",
      fieldId,
      generatedAt: null,
      summary: EMPTY_LIVE_EFFORT_SUMMARY,
      gaps: ["place_snapshot_unavailable"],
      nextActions: [],
      claimBoundary: {
        canSay: ["live effort はまだ読み込めないため、proxyの調査設計だけを使う。"],
        cannotSayYet: ["実DB由来の努力量、季節カバー、非検出が確認済みである。"],
      },
    };
  }

  const human = placeSnapshot.observationSummary;
  const machine = placeSnapshot.machineObservationSummary;
  const summary: LenriLiveEffortSnapshot["summary"] = {
    totalObservations: human.totalObservations,
    totalVisits: human.totalVisits,
    uniqueTaxa: human.uniqueTaxa,
    latestObservedAt: human.latestObservedAt,
    effortCompletionRate: human.effortCompletionRate,
    seasonsCovered: human.seasonsCovered,
    seasonCoverageCap: human.seasonCoverageCap,
    seasonLabels: human.seasonLabels,
    absentRecords: human.absentRecords,
    reviewAcceptedRate: human.reviewAcceptedRate,
    machineEffortMetadata: machine.effortMetadataCount,
    passiveAudioCount: machine.passiveAudioCount,
    methodContextCount: machine.methodCounts.length,
    topTaxa: human.topTaxa.slice(0, 6),
  };

  return {
    schemaVersion: LENRI_LIVE_EFFORT_SCHEMA_VERSION,
    status: "loaded",
    source: "place_snapshot",
    fieldId: placeSnapshot.field.fieldId,
    generatedAt: placeSnapshot.generatedAt,
    summary,
    gaps: liveEffortGaps(summary),
    nextActions: placeSnapshot.nextActions.slice(0, 4).map((action) => ({
      kind: action.kind,
      title: action.title,
      body: action.body,
    })),
    claimBoundary: {
      canSay: [
        ...placeSnapshot.claimBoundary.canSay,
        "実DB由来の訪問数、努力量入力率、季節カバー、非検出数を管理画面で確認できる。",
      ],
      cannotSayYet: [
        ...placeSnapshot.claimBoundary.cannotSayYet,
        "努力量だけで自然共生サイトの効果や種の増減が証明済みである。",
      ],
    },
  };
}

const RINGS: LenriAreaRing[] = [
  {
    ringId: "core_site",
    label: "連理の木の下で core",
    radiusM: 120,
    purpose: "自然共生サイト本体の記録・活動・補助資料の単位。",
    pdiCellPlan: "PDIが使える場合は中心点を含むS2 level 12 cellを最小単位にする。",
  },
  {
    ringId: "walkable_buffer",
    label: "徒歩圏 buffer",
    radiusM: 500,
    purpose: "来訪・観察導線、周辺施設、近接緑地との関係を見る。",
    pdiCellPlan: "中心cellと隣接cellの特徴量差分で、無料ページの周辺文脈を強化する。",
  },
  {
    ringId: "local_context",
    label: "都田 local context",
    radiusM: 2000,
    purpose: "都田単位の地域性、農地・水路・公園・産業地の混在を把握する。",
    pdiCellPlan: "PDI契約後も集計用途に限定し、個人移動や自然価値の証明には使わない。",
  },
];

export function getLenriAreaIntelligenceSnapshot(now = new Date()): LenriAreaIntelligenceSnapshot {
  return {
    schemaVersion: LENRI_AREA_INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    field: {
      certificationId: "aikan-renri-ikan-hq",
      name: "愛管株式会社 連理の木の下で",
      addressEvidence: "静岡県浜松市浜名区都田町8501-2",
      lat: 34.81435,
      lng: 137.7327,
      radiusM: 120,
      areaHa: 1.3,
      bbox: {
        west: 137.7318,
        south: 34.8135,
        east: 137.7336,
        north: 34.8152,
      },
    },
    budgetGuard: {
      approvedMonthlyBudgetUsd: 10,
      currentRecurringCostUsd: 0,
      paidPdiSubscriptionAllowed: false,
      allowedPaidCondition: "無料枠、Preview提供、または実効月額10 USD以内で明示見積が出た場合だけ進める。",
      stoppedAction: "価格未確定または年契約前提のPDI/Google Maps有料契約は開始しない。",
    },
    pdiAccess: {
      productName: "Google Maps Platform Population Dynamics Insights",
      status: "inquiry_submitted_pricing_unknown",
      requestedGeography: "Japan / Shizuoka / Hamamatsu / Miyakoda",
      requestedGranularity: "連理中心点、120m core、500m buffer、1-2km local context around S2 level 12 cells",
      intendedUse: [
        "無料エリアページの周辺文脈生成",
        "有料の種・エリアレポートにおける補助的な人流/地域特徴量",
        "現地活動の仮説作成と観察計画の優先度付け",
      ],
      commercialBoundary:
        "無料通常利用と、有料レポート/法人向け補助資料の混在利用。PDIは生物多様性の証明ではなく周辺文脈に限定する。",
      swapInCondition:
        "Googleから利用条件と実効月額が予算内と確認できたら、openDataProxyのcontextSignalsをPDI特徴量で拡張する。",
    },
    rings: RINGS,
    openDataProxy: {
      sourceLabel: "OpenStreetMap Overpass snapshot",
      collectedAt: "2026-06-03",
      radiusM: 1000,
      uniqueElementCount: 240,
      contextSignals: CONTEXT_SIGNALS,
      namedSignals: NAMED_SIGNALS,
      landUseSignals: [
        "farmland",
        "grass",
        "industrial",
        "greenfield",
        "farmyard",
        "forest",
        "retail",
        "commercial",
      ],
    },
    effortReadiness: EFFORT_READINESS,
    decisionPolicy: {
      adoptWhen: [
        "PDIの利用条件が商用/無料混在利用を明示的に許す。",
        "連理周辺だけの小規模利用が実効月額10 USD以内、または無料Previewで提供される。",
        "BigQuery/Analytics Hubの利用量を上限監視でき、月次コストが暴走しない。",
      ],
      doNotAdoptWhen: [
        "年契約または最低月額が予算を超える。",
        "有料レポートへの二次利用可否が不明なまま。",
        "PDIを自然共生サイト認定・種確認・生物多様性改善の証明に使う必要がある場合。",
      ],
      measurement: [
        "無料エリアページの閲覧開始率と滞在時間。",
        "連理周辺の観察投稿・訪問記録の増加。",
        "有料レポートで、周辺文脈の説明作成にかかる時間削減。",
      ],
    },
    claimBoundary: {
      canSay: [
        "連理周辺には水路・公園・農地・生活接点があり、観察仮説の補助文脈になる。",
        "努力量readinessにより、次に何分・どこを・どの方法で見るべきかを管理できる。",
        "PDIが使える場合、人流/地域特徴量をエリアページと有料補助資料の周辺説明に使える可能性がある。",
        "現時点の実装は無料データ由来のproxyで、PDI本番データはまだ接続していない。",
      ],
      cannotSayYet: [
        "PDIによって生物種の存在や増減が確認できた。",
        "努力量補正済みの増減、absence、希少性評価が完了した。",
        "PDIだけで自然共生サイト認定、TNFD、ネイチャーポジティブ効果を証明できる。",
        "Googleから有料レポート利用が承認済みである。",
      ],
    },
  };
}

export async function getLenriAreaIntelligenceSnapshotWithLiveEffort(now = new Date()): Promise<LenriAreaIntelligenceSnapshot> {
  const snapshot = getLenriAreaIntelligenceSnapshot(now);
  const placeSnapshot = await getPlaceSnapshot(snapshot.field.certificationId).catch(() => null);
  return {
    ...snapshot,
    liveEffort: buildLenriLiveEffortSnapshot(placeSnapshot, snapshot.field.certificationId),
  };
}
