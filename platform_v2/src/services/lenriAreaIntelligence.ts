export const LENRI_AREA_INTELLIGENCE_SCHEMA_VERSION = "lenri_area_intelligence/v0";

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
        "PDIが使える場合、人流/地域特徴量をエリアページと有料補助資料の周辺説明に使える可能性がある。",
        "現時点の実装は無料データ由来のproxyで、PDI本番データはまだ接続していない。",
      ],
      cannotSayYet: [
        "PDIによって生物種の存在や増減が確認できた。",
        "PDIだけで自然共生サイト認定、TNFD、ネイチャーポジティブ効果を証明できる。",
        "Googleから有料レポート利用が承認済みである。",
      ],
    },
  };
}
