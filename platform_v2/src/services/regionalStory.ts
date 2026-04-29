import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { assertAllowed as assertAiBudgetAllowed } from "./aiBudgetGate.js";
import { logAiCost } from "./aiCostLogger.js";
import { CURATOR_DEFAULT_MODEL, estimateAiCostUsd, pricingForModel } from "./aiModelPricing.js";

export type RegionalKnowledgeCategory =
  | "history"
  | "cultural_asset"
  | "landform"
  | "water"
  | "agriculture"
  | "industry"
  | "disaster_memory"
  | "ecology"
  | "policy"
  | "local_life";

export type RegionalStorySurface = "landing" | "profile" | "observation";

export type RegionalKnowledgeCard = {
  cardId: string;
  regionScope: string;
  locale?: string;
  sourceType?: string;
  placeHint: string;
  placeKeys?: Record<string, unknown>;
  historicalPlaceNames?: string[];
  category: RegionalKnowledgeCategory;
  title: string;
  summary: string;
  retrievalText?: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceFingerprint?: string;
  license: string;
  tags: string[];
  observationHooks?: string[];
  temporalScope?: "current" | "historical" | "mixed" | "legendary" | "unspecified";
  sensitivityLevel: "public" | "coarse" | "restricted";
  reviewStatus?: "draft" | "approved" | "rejected";
  qualityScore?: number;
};

export type RegionalStoryCue = {
  surface: RegionalStorySurface;
  angleKey: string;
  angleLabel: string;
  placeHook: string;
  whyHere: string;
  nextObservationAngle: string;
  collectiveNote: string;
  cards: RegionalKnowledgeCard[];
  usedCardIds: string[];
  sourceMode: "db" | "seed" | "mixed" | "fallback";
};

export type RegionalStoryPlaceInput = {
  placeId?: string | null;
  placeName?: string | null;
  municipality?: string | null;
  prefecture?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  publicLabel?: string | null;
  allowPrecisePlaceLabel?: boolean;
};

export type RegionalStoryObservationInput = {
  observationId?: string | null;
  observedAt?: string | null;
  displayName?: string | null;
};

export type RegionalStoryInput = {
  surface: RegionalStorySurface;
  viewerUserId?: string | null;
  place: RegionalStoryPlaceInput;
  observation?: RegionalStoryObservationInput;
  maxCards?: number;
  recordExposure?: boolean;
};

type RegionalKnowledgeCardRow = {
  card_id: string;
  region_scope: string;
  locale?: string;
  source_type?: string;
  place_hint: string;
  place_keys?: unknown;
  historical_place_names?: unknown;
  category: string;
  title: string;
  summary: string;
  retrieval_text?: string;
  source_url: string;
  source_label: string;
  source_fingerprint?: string;
  license: string;
  tags: unknown;
  observation_hooks?: unknown;
  temporal_scope?: string;
  sensitivity_level: string;
  review_status?: string;
  quality_score?: unknown;
};

type RecentExposure = {
  card_id: string;
  angle_key: string;
};

type RegionalStoryGeminiJson = {
  place_hook?: unknown;
  why_here?: unknown;
  next_observation_angle?: unknown;
  collective_note?: unknown;
};

const CATEGORY_SET = new Set<RegionalKnowledgeCategory>([
  "history",
  "cultural_asset",
  "landform",
  "water",
  "agriculture",
  "industry",
  "disaster_memory",
  "ecology",
  "policy",
  "local_life",
]);

const HAMAMATSU_ALIASES = [
  "浜松",
  "浜名",
  "浜北",
  "舞阪",
  "天竜",
  "細江",
  "三ヶ日",
  "引佐",
  "春野",
  "佐久間",
  "水窪",
  "龍山",
  "佐鳴",
  "庄内",
  "篠原",
  "都田",
  "馬込",
  "遠州",
];

const GENERIC_PLACE_MATCH_TERMS = new Set([
  "公園",
  "住宅地",
  "文化誌",
  "地域史",
  "生活",
  "道",
  "駅",
  "交通",
  "水",
  "緑",
  "花",
  "森",
  "農地",
  "集落",
  "街道",
  "オープンデータ",
]);

const ANGLES: Array<{
  key: string;
  label: string;
  categories: RegionalKnowledgeCategory[];
}> = [
  { key: "landform", label: "地形から見る", categories: ["landform", "water", "disaster_memory"] },
  { key: "human_life", label: "人の営みから見る", categories: ["local_life", "industry", "agriculture"] },
  { key: "old_route", label: "昔の道から見る", categories: ["history", "industry", "cultural_asset"] },
  { key: "water_edge", label: "水辺から見る", categories: ["water", "ecology", "landform"] },
  { key: "season", label: "季節から見る", categories: ["ecology", "agriculture", "local_life"] },
  { key: "next_observation", label: "次に観察するなら", categories: ["ecology", "policy", "history"] },
];

const SEEDED_HAMAMATSU_CARDS: RegionalKnowledgeCard[] = [
  {
    cardId: "hamamatsu-adeac-overview",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    category: "history",
    title: "浜松市文化遺産デジタルアーカイブ",
    summary: "浜松市に関連する歴史資料を、高精細画像や目録でたどれる入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ",
    license: "出典先の利用規定に従う",
    tags: ["浜松市", "文化遺産", "地域資料"],
    observationHooks: ["昔の写真と今の景色を比べる", "地名や案内板を一緒に撮る", "同じ道を少し引いて撮る"],
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-local-culture-books",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    historicalPlaceNames: ["旧浜松市", "旧浜北市", "旧舞阪町", "旧天竜市", "旧細江町", "旧三ヶ日町", "旧引佐町"],
    category: "local_life",
    title: "わがまち文化誌",
    summary: "各地区の住民と公民館などが、地域の歴史、文化、産業、生活、伝説を調べた文化誌を残しています。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["わがまち文化誌", "地域史", "生活", "伝説"],
    observationHooks: ["草刈り跡を見る", "人が通る道端を見る", "花壇や畑の縁を見る", "地域の行事や管理の跡を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-castle",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松城",
    historicalPlaceNames: ["浜松城下", "城下町"],
    category: "cultural_asset",
    title: "浜松城と城下の移り変わり",
    summary: "城絵図や城下絵図は、今の中心部を近世から近代のまちの変化として見返す手がかりになります。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/catalog-list/list00005",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ 浜松城",
    license: "出典先の利用規定に従う",
    tags: ["浜松城", "城下町", "絵図", "中心市街地"],
    observationHooks: ["石垣や堀の近くを見る", "高低差を見る", "道の曲がり方を見る", "公園の端を引いて撮る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-landscape",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    category: "history",
    title: "浜松の風景を見返す",
    summary: "写真や絵はがきなどの風景資料は、同じ場所を昔の眺めと重ねて見る入口になります。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/catalog-list/list00019",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ 浜松の風景",
    license: "出典先の利用規定に従う",
    tags: ["浜松の風景", "写真", "絵はがき", "景観"],
    observationHooks: ["同じ向きで撮り直す", "建物や木の位置を入れる", "遠景と足元をセットで残す"],
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-transport",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    historicalPlaceNames: ["奥山線", "姫街道", "東海道"],
    category: "industry",
    title: "交通の記憶から場所を見る",
    summary: "鉄道、バス、街道などの資料は、今の道や駅前の観察を移動と暮らしの記憶につなげます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ 交通・関連コンテンツ",
    license: "出典先の利用規定に従う",
    tags: ["交通", "奥山線", "浜松市営バス", "街道"],
    observationHooks: ["旧道や路地を見る", "踏まれた草を見る", "駅前や道端の植生を見る", "道幅が変わる場所を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-opendata-cultural-assets",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    category: "cultural_asset",
    title: "文化財一覧から場所を見る",
    summary: "浜松市の文化財一覧は、身近な場所を文化財や地域資料の入口として見返す手がかりです。",
    sourceUrl: "https://opendata.pref.shizuoka.jp/dataset/chiiki/shizuoka/hamamatu/",
    sourceLabel: "静岡県オープンデータ 浜松市データカタログ",
    license: "CC BY 等、出典先のライセンスに従う",
    tags: ["文化財", "オープンデータ", "浜松市"],
    observationHooks: ["案内板を確認する", "境内や史跡周りの植生を見る", "石垣や水路の際を見る"],
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-environment-biodiversity",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    category: "ecology",
    title: "浜松市の自然環境との共生",
    summary: "浜松市の環境計画では、生物多様性や自然共生サイト、市民参加の生きもの調査が施策に位置づけられています。",
    sourceUrl: "https://www.city.hamamatsu.shizuoka.jp/documents/7353/dai3ji_kankyoukihonkeikaku_honpen.pdf",
    sourceLabel: "第3次浜松市環境基本計画",
    license: "出典先の利用規定に従う",
    tags: ["生物多様性", "自然共生サイト", "環境計画", "市民参加"],
    observationHooks: ["草丈を見る", "草刈り跡を見る", "日当たりを見る", "湿った土を見る", "水路を見る", "踏まれ方を見る", "花から綿毛まで比べる"],
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-city-books",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    historicalPlaceNames: ["浜北", "舞阪", "天竜", "細江", "三ヶ日", "引佐", "春野", "佐久間", "水窪", "龍山"],
    category: "history",
    title: "浜松市史・旧市町村史",
    summary: "浜松市史や旧市町村史は、中心部だけでなく浜北、舞阪、天竜、細江、三ヶ日、引佐などの時間をたどる入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["浜松市史", "旧市町村史", "浜北", "舞阪", "天竜", "細江", "三ヶ日", "引佐"],
    observationHooks: ["旧地名を手がかりに見る", "里山や農地の縁を見る", "水辺と道の関係を見る", "集落の端を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
];

const EXPANDED_HAMAMATSU_CARDS: RegionalKnowledgeCard[] = [
  {
    cardId: "hamamatsu-culture-hikuma-magome-river",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "曳馬",
    historicalPlaceNames: ["曳馬", "馬込川"],
    category: "water",
    title: "馬込川が流れるまち",
    summary: "曳馬地区の文化誌は、馬込川を軸に地域の暮らしや地形を見返す入口になります。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["曳馬", "馬込川", "水辺", "文化誌"],
    observationHooks: ["川沿いの草丈を見る", "橋の下の日陰を見る", "湿った土を見る", "水路と道端の境目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-tomitsuka",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "富塚",
    historicalPlaceNames: ["富塚"],
    category: "local_life",
    title: "とみつか",
    summary: "富塚地区の文化誌は、佐鳴湖周辺や住宅地の緑を、地域の暮らしと重ねて見る手がかりです。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["富塚", "佐鳴湖", "住宅地", "文化誌"],
    observationHooks: ["住宅地の道端を見る", "公園の草刈り跡を見る", "坂の上下で日当たりを比べる", "湖へ向かう水の流れを見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-sanaru-lake",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "佐鳴湖",
    historicalPlaceNames: ["佐鳴湖", "佐鳴台", "入野"],
    category: "water",
    title: "佐鳴湖のあるまち",
    summary: "佐鳴湖周辺の文化誌は、湖岸、水辺、公園、住宅地のつながりを観察する入口になります。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["佐鳴湖", "湖岸", "水辺", "入野", "佐鳴台"],
    observationHooks: ["湖岸の湿り気を見る", "水鳥の休む場所を見る", "岸辺の草丈を見る", "水面近くの虫を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-highland-water",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "高台",
    historicalPlaceNames: ["高台"],
    category: "landform",
    title: "台地と水と輝き",
    summary: "高台地区の文化誌は、台地、水の流れ、住宅地の緑を一緒に読むための地域資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["高台", "台地", "水", "文化誌"],
    observationHooks: ["坂の上と下を比べる", "乾いた土を見る", "雨水が集まる場所を見る", "擁壁や段差の草を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-city-center",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "中心街",
    historicalPlaceNames: ["浜松中心街", "中部"],
    category: "local_life",
    title: "浜松中心街の今昔",
    summary: "中心街の文化誌は、建物、路地、街路樹、小さな緑を昔と今の重なりで見る入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["中心街", "路地", "街路樹", "今昔"],
    observationHooks: ["街路樹の根元を見る", "ビルの日陰を見る", "路地の隙間の草を見る", "舗装の割れ目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-shonai-peninsula",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "庄内",
    historicalPlaceNames: ["庄内", "庄内半島"],
    category: "water",
    title: "碧い湖と緑の半島 庄内",
    summary: "庄内地区の文化誌は、浜名湖、半島の緑、湖岸の暮らしを観察に重ねる手がかりです。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["庄内", "浜名湖", "半島", "湖岸"],
    observationHooks: ["湖岸の植物を見る", "潮風が当たる場所を見る", "水際の鳥を見る", "半島の林縁を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-shinohara-coast-road",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "篠原",
    historicalPlaceNames: ["篠原"],
    category: "landform",
    title: "浜風と街道",
    summary: "篠原地区の文化誌は、海風、砂地、街道沿いの暮らしを場所の見方に変える資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["篠原", "浜風", "街道", "砂地"],
    observationHooks: ["砂地の草を見る", "風で倒れた草を見る", "旧道沿いの植生を見る", "海に近い乾いた場所を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-isami-lake-flower",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "伊佐見",
    historicalPlaceNames: ["伊佐見"],
    category: "agriculture",
    title: "湖と花と緑の里いさみ",
    summary: "伊佐見地区の文化誌は、湖、花、緑、農地の縁を観察するきっかけになります。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["伊佐見", "湖", "花", "緑", "農地"],
    observationHooks: ["畑の縁を見る", "花壇の管理跡を見る", "水路沿いを見る", "緑地と住宅の境目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-kakuro",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "神久呂",
    historicalPlaceNames: ["神久呂"],
    category: "agriculture",
    title: "ふるさと神久呂",
    summary: "神久呂地区の文化誌は、農地、集落、道端の緑を地域の記憶として見る入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["神久呂", "農地", "集落", "文化誌"],
    observationHooks: ["畦の草を見る", "用水路を見る", "集落の端を見る", "農道の踏まれ方を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-waji",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "和地",
    historicalPlaceNames: ["和地"],
    category: "local_life",
    title: "和の里今むかし",
    summary: "和地地区の文化誌は、集落の道、水辺、農地の端を昔と今の重なりで見る手がかりです。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["和地", "集落", "農地", "今むかし"],
    observationHooks: ["集落の端を見る", "水路の草を見る", "庭先の植栽を見る", "農地と道の境目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-sekishi-flow",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "積志",
    historicalPlaceNames: ["積志"],
    category: "water",
    title: "積志の流れ今むかし",
    summary: "積志地区の文化誌は、水の流れ、集落、道の変化を観察の背景として見返せます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["積志", "水の流れ", "集落", "文化誌"],
    observationHooks: ["水路沿いを見る", "橋の近くを見る", "湿った土を見る", "住宅地の小さな草地を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-tenryu-river-tokaido",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "天竜川",
    historicalPlaceNames: ["天竜川", "東海道"],
    category: "water",
    title: "天竜川と東海道",
    summary: "天竜川と東海道を扱う文化誌は、大きな川、街道、河川敷の変化を一緒に見る入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["天竜川", "東海道", "河川敷", "街道"],
    observationHooks: ["河川敷の草丈を見る", "砂利や湿り気を見る", "堤防の斜面を見る", "旧道との距離を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-nagakami",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "長上",
    historicalPlaceNames: ["長上"],
    category: "agriculture",
    title: "ふる里ながかみ",
    summary: "長上地区の文化誌は、農地、集落、生活道路の端を観察するための地域の入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["長上", "農地", "生活道路", "文化誌"],
    observationHooks: ["畑の縁を見る", "生活道路の草を見る", "用水路を見る", "草刈り跡を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-kasai",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "笠井",
    historicalPlaceNames: ["笠井"],
    category: "local_life",
    title: "笠井",
    summary: "笠井地区の文化誌は、地域の道、社寺、暮らしの場を観察に重ねる手がかりです。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["笠井", "社寺", "生活道路", "文化誌"],
    observationHooks: ["境内の木陰を見る", "道端の草を見る", "水路の際を見る", "人が通る場所の踏まれ方を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-kaba",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "蒲",
    historicalPlaceNames: ["蒲", "袖紫ケ森"],
    category: "local_life",
    title: "袖紫ケ森",
    summary: "蒲地区の文化誌は、地域名、森の記憶、住宅地の緑を観察に接続する資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["蒲", "森", "住宅地", "文化誌"],
    observationHooks: ["住宅地の木陰を見る", "小さな緑地を見る", "道端の草を見る", "古い地名の案内を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-miyakoda",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "都田",
    historicalPlaceNames: ["都田"],
    category: "landform",
    title: "都田風土記",
    summary: "都田の文化誌は、谷戸、里山、農地、工業地の境目を観察するための地域資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["都田", "里山", "農地", "風土記"],
    observationHooks: ["里山の林縁を見る", "谷の湿り気を見る", "農地の縁を見る", "造成地との境目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-nanyo-delta",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "南陽",
    historicalPlaceNames: ["南陽"],
    category: "water",
    title: "水と光と緑のデルタ",
    summary: "南陽地区の文化誌は、水路、低地、緑地の広がりを観察の読み方に変える入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["南陽", "水", "低地", "緑"],
    observationHooks: ["低い土地の湿り気を見る", "水路沿いの草を見る", "日当たりの強い草地を見る", "水が集まる場所を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-east-inaho",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "東部",
    historicalPlaceNames: ["東部", "稲穂"],
    category: "agriculture",
    title: "輝くいなほはたの音",
    summary: "東部地区の文化誌は、稲作や生活の記憶を、道端や水路の観察に結びつける資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["東部", "稲", "農地", "文化誌"],
    observationHooks: ["田畑の縁を見る", "用水路を見る", "湿った土を見る", "農道の草刈り跡を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-johoku",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "城北",
    historicalPlaceNames: ["城北"],
    category: "local_life",
    title: "いろはのイ",
    summary: "城北地区の文化誌は、住宅地、学校、公園、道端の小さな自然を地域の記憶と重ねる入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["城北", "住宅地", "公園", "文化誌"],
    observationHooks: ["学校や公園の縁を見る", "道端の草を見る", "日陰と日なたを比べる", "植え込みの管理跡を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-south-industry",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "南部",
    historicalPlaceNames: ["南部"],
    category: "industry",
    title: "汽笛・ステンショ・まちこうば",
    summary: "南部地区の文化誌は、鉄道、工場、生活道路の記憶を街なかの観察に接続します。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["南部", "鉄道", "工場", "生活道路"],
    observationHooks: ["線路沿いの草を見る", "工場周りの植栽を見る", "舗装の隙間を見る", "排水路を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-culture-north-forest",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "北部",
    historicalPlaceNames: ["北部", "しいの森", "はぎの原"],
    category: "landform",
    title: "しいの森はぎの原",
    summary: "北部地区の文化誌は、森、原、住宅地の境目を観察するための地域の入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["北部", "森", "原", "文化誌"],
    observationHooks: ["林縁を見る", "落ち葉の厚さを見る", "草地と木陰を比べる", "住宅地との境目を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-hamakita",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜北",
    historicalPlaceNames: ["浜北市", "浜北"],
    category: "landform",
    title: "浜北市史",
    summary: "旧浜北市の自治体史は、天竜川扇状地、台地、農地、社寺林を地域の時間で見る入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["浜北", "天竜川", "扇状地", "農地"],
    observationHooks: ["扇状地の乾いた土を見る", "社寺林の林縁を見る", "用水路を見る", "畑の縁を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-maisaka",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "舞阪",
    historicalPlaceNames: ["舞阪町", "舞阪"],
    category: "water",
    title: "舞阪町史",
    summary: "旧舞阪町の自治体史は、浜名湖、海辺、港、東海道の記憶を観察の背景にできます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["舞阪", "浜名湖", "海辺", "港", "東海道"],
    observationHooks: ["潮風が当たる草を見る", "港周りの鳥を見る", "砂地の植物を見る", "水際の生きものを見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-tenryu",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "天竜",
    historicalPlaceNames: ["天竜市", "天竜"],
    category: "landform",
    title: "天竜市史",
    summary: "旧天竜市の自治体史は、山地、川、森林、集落の関係を観察に重ねる入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["天竜", "山地", "森林", "川"],
    observationHooks: ["渓流沿いを見る", "林道の縁を見る", "斜面の日当たりを見る", "落ち葉と湿り気を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-hosoe",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "細江",
    historicalPlaceNames: ["細江町", "細江"],
    category: "water",
    title: "細江町史",
    summary: "旧細江町の自治体史は、浜名湖の入り江、低地、丘陵の暮らしを観察の背景にします。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["細江", "浜名湖", "入り江", "丘陵"],
    observationHooks: ["入り江の水辺を見る", "低地の湿り気を見る", "丘の斜面を見る", "湖岸の草を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-mikkabi",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "三ヶ日",
    historicalPlaceNames: ["三ヶ日町", "三ヶ日"],
    category: "agriculture",
    title: "三ヶ日町史",
    summary: "旧三ヶ日町の自治体史は、浜名湖、みかん畑、丘陵の環境を観察に重ねる資料です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["三ヶ日", "浜名湖", "みかん", "丘陵"],
    observationHooks: ["果樹園の縁を見る", "丘陵の日当たりを見る", "湖岸と畑を比べる", "農道の草を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-inasa",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "引佐",
    historicalPlaceNames: ["引佐町", "引佐"],
    category: "landform",
    title: "引佐町史",
    summary: "旧引佐町の自治体史は、丘陵、谷戸、社寺、農地の重なりを観察に接続します。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["引佐", "丘陵", "谷戸", "農地"],
    observationHooks: ["谷の湿り気を見る", "斜面の林縁を見る", "田畑の縁を見る", "社寺林を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-haruno",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "春野",
    historicalPlaceNames: ["春野町", "春野"],
    category: "landform",
    title: "春野町史",
    summary: "旧春野町の自治体史は、山地、川、茶畑、集落の自然を観察する入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["春野", "山地", "川", "茶畑"],
    observationHooks: ["茶畑の縁を見る", "山道の湿り気を見る", "渓流沿いを見る", "集落の端を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-sakuma",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "佐久間",
    historicalPlaceNames: ["佐久間町", "佐久間"],
    category: "water",
    title: "佐久間町史",
    summary: "旧佐久間町の自治体史は、天竜川上流、山地、ダム周辺の環境を観察に重ねられます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["佐久間", "天竜川", "山地", "ダム"],
    observationHooks: ["ダム湖周りを見る", "山道の林縁を見る", "川沿いの湿り気を見る", "落ち葉の層を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-history-misakubo",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "水窪",
    historicalPlaceNames: ["水窪町", "水窪"],
    category: "landform",
    title: "水窪町史",
    summary: "旧水窪町の自治体史は、山深い谷、川、森林の環境を観察の背景にできます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/text-list",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テキスト一覧",
    license: "出典先の利用規定に従う",
    tags: ["水窪", "山地", "谷", "森林"],
    observationHooks: ["谷沿いの湿った場所を見る", "林道の縁を見る", "苔や落ち葉を見る", "斜面の日陰を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-okuyama-line",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "奥山線",
    historicalPlaceNames: ["奥山線"],
    category: "industry",
    title: "奥山線",
    summary: "ADEACの関連コンテンツには奥山線があり、かつての移動の線を今の道端観察に重ねられます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ 関連コンテンツ",
    license: "出典先の利用規定に従う",
    tags: ["奥山線", "交通", "鉄道跡", "道"],
    observationHooks: ["線路跡や道筋を見る", "道端の草を見る", "切通しや段差を見る", "駅跡周辺の植生を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-city-bus",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市営バス",
    historicalPlaceNames: ["浜松市営バス"],
    category: "industry",
    title: "浜松市営バス",
    summary: "ADEACの関連コンテンツには浜松市営バスがあり、移動の記憶を停留所や道端の観察に重ねられます。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ 関連コンテンツ",
    license: "出典先の利用規定に従う",
    tags: ["浜松市営バス", "交通", "停留所", "道"],
    observationHooks: ["停留所周りの草を見る", "歩道の隙間を見る", "人通りの多い場所を見る", "街路樹の根元を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-map-materials",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    historicalPlaceNames: ["絵図", "地図"],
    category: "history",
    title: "絵図・地図",
    summary: "ADEACの絵図・地図資料は、今の道、水辺、町割りを昔の位置感覚で見返す入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テーマ別資料",
    license: "出典先の利用規定に従う",
    tags: ["絵図", "地図", "町割り", "水辺"],
    observationHooks: ["古い道筋を見る", "水路の位置を見る", "町の端を見る", "橋や曲がり角を見る"],
    temporalScope: "historical",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-adeac-industry-seasonal-events",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    historicalPlaceNames: ["産業", "歳事"],
    category: "local_life",
    title: "産業・歳事",
    summary: "ADEACの産業・歳事資料は、祭り、仕事、季節の営みを観察地の背景として見る入口です。",
    sourceUrl: "https://adeac.jp/hamamatsu-city/top/",
    sourceLabel: "浜松市文化遺産デジタルアーカイブ テーマ別資料",
    license: "出典先の利用規定に従う",
    tags: ["産業", "歳事", "祭礼", "季節"],
    observationHooks: ["祭礼の道筋を見る", "季節の花を見る", "人が集まる場所の草を見る", "管理された植栽を見る"],
    temporalScope: "mixed",
    sensitivityLevel: "public",
  },
  {
    cardId: "hamamatsu-env-citizen-survey",
    regionScope: "JP-22-Hamamatsu",
    placeHint: "浜松市",
    category: "ecology",
    title: "市民参加の生きもの調査",
    summary: "浜松市の環境計画では、市民参加の生きもの調査が自然環境を知る取り組みとして位置づけられています。",
    sourceUrl: "https://www.city.hamamatsu.shizuoka.jp/documents/7353/dai3ji_kankyoukihonkeikaku_honpen.pdf",
    sourceLabel: "第3次浜松市環境基本計画",
    license: "出典先の利用規定に従う",
    tags: ["市民参加", "生きもの調査", "自然環境", "生物多様性"],
    observationHooks: ["同じ場所を再訪する", "季節を変えて見る", "環境メモを残す", "写真の向きをそろえる"],
    temporalScope: "current",
    sensitivityLevel: "public",
  },
];

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function safeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).slice(0, 16);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rowToCard(row: RegionalKnowledgeCardRow): RegionalKnowledgeCard | null {
  if (!row.source_url || !row.title || !row.summary || !CATEGORY_SET.has(row.category as RegionalKnowledgeCategory)) {
    return null;
  }
  const sensitivity = row.sensitivity_level === "coarse" || row.sensitivity_level === "restricted"
    ? row.sensitivity_level
    : "public";
  return {
    cardId: row.card_id,
    regionScope: row.region_scope,
    locale: row.locale ?? "ja-JP",
    sourceType: row.source_type ?? "official_archive",
    placeHint: row.place_hint,
    placeKeys: safeRecord(row.place_keys),
    historicalPlaceNames: safeTags(row.historical_place_names),
    category: row.category as RegionalKnowledgeCategory,
    title: row.title,
    summary: row.summary,
    retrievalText: row.retrieval_text ?? "",
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    sourceFingerprint: row.source_fingerprint ?? "",
    license: row.license,
    tags: safeTags(row.tags),
    observationHooks: safeTags(row.observation_hooks),
    temporalScope: row.temporal_scope === "current" || row.temporal_scope === "historical" || row.temporal_scope === "mixed" || row.temporal_scope === "legendary"
      ? row.temporal_scope
      : "unspecified",
    sensitivityLevel: sensitivity,
    reviewStatus: row.review_status === "draft" || row.review_status === "rejected" ? row.review_status : "approved",
    qualityScore: typeof row.quality_score === "number" ? row.quality_score : Number(row.quality_score ?? 0.5) || 0.5,
  };
}

function looksLikeHamamatsu(place: RegionalStoryPlaceInput): boolean {
  const joined = [place.placeName, place.publicLabel, place.municipality, place.prefecture].map(text).join(" ");
  return HAMAMATSU_ALIASES.some((alias) => joined.includes(alias));
}

function normalizePlaceLabel(place: RegionalStoryPlaceInput): string {
  if (place.allowPrecisePlaceLabel && text(place.placeName)) return text(place.placeName);
  if (text(place.publicLabel)) return text(place.publicLabel);
  if (text(place.municipality)) return text(place.municipality);
  if (text(place.prefecture)) return text(place.prefecture);
  return "この場所";
}

function isAdministrativePlaceHint(card: RegionalKnowledgeCard, place: RegionalStoryPlaceInput): boolean {
  const hint = text(card.placeHint);
  if (!hint) return true;
  const adminLabels = [place.municipality, place.prefecture, place.publicLabel].map(text).filter(Boolean);
  return adminLabels.includes(hint);
}

function cardDirectlyMatchesPlace(card: RegionalKnowledgeCard, place: RegionalStoryPlaceInput): boolean {
  const haystack = [place.placeName, place.publicLabel, place.municipality, place.prefecture].map(text).join(" ");
  const adminLabels = new Set([place.municipality, place.prefecture, place.publicLabel].map(text).filter(Boolean));
  return Boolean(
    (card.placeHint && haystack.includes(card.placeHint) && !isAdministrativePlaceHint(card, place)) ||
    [...card.tags, ...(card.historicalPlaceNames ?? [])].some((tag) => tag && haystack.includes(tag) && !adminLabels.has(tag) && !GENERIC_PLACE_MATCH_TERMS.has(tag)),
  );
}

function observationCardPriority(card: RegionalKnowledgeCard, place: RegionalStoryPlaceInput): number {
  if (cardDirectlyMatchesPlace(card, place)) return 100;
  if (card.category === "ecology") return 80;
  if (card.category === "local_life") return 70;
  if (card.category === "water" || card.category === "landform" || card.category === "agriculture") return 64;
  if (card.category === "policy") return 58;
  if (card.category === "history" || card.category === "industry") return 46;
  if (card.category === "cultural_asset") return 10;
  return 40;
}

function matchScore(card: RegionalKnowledgeCard, place: RegionalStoryPlaceInput, surface: RegionalStorySurface): number {
  let score = 0;
  const haystack = [
    place.placeName,
    place.publicLabel,
    place.municipality,
    place.prefecture,
  ].map(text).join(" ");
  const placeHintMatched = Boolean(card.placeHint && haystack.includes(card.placeHint));
  const matchedTags = [...card.tags, ...(card.historicalPlaceNames ?? [])].filter((tag) => tag && haystack.includes(tag));
  if (card.placeHint && !placeHintMatched && matchedTags.length === 0 && !isAdministrativePlaceHint(card, place)) {
    return 0;
  }
  if (looksLikeHamamatsu(place) && card.regionScope === "JP-22-Hamamatsu") score += 8;
  if (placeHintMatched) score += 24;
  for (const tag of [...card.tags, ...(card.historicalPlaceNames ?? [])]) {
    if (tag && haystack.includes(tag)) score += 8;
  }
  if (card.temporalScope === "historical" || card.temporalScope === "mixed") score += 2;
  if (surface === "observation" && ["local_life", "ecology"].includes(card.category)) score += 9;
  if (surface === "observation" && card.category === "history") score += 4;
  if (surface === "observation" && card.category === "cultural_asset") score += cardDirectlyMatchesPlace(card, place) ? 4 : -20;
  if (surface === "landing" && ["water", "landform", "local_life", "history", "ecology"].includes(card.category)) score += 4;
  if (surface === "profile" && ["local_life", "history", "cultural_asset"].includes(card.category)) score += 4;
  return score;
}

function uniqueCards(cards: RegionalKnowledgeCard[]): RegionalKnowledgeCard[] {
  const seen = new Set<string>();
  const result: RegionalKnowledgeCard[] = [];
  for (const card of cards) {
    if (seen.has(card.cardId)) continue;
    seen.add(card.cardId);
    result.push(card);
  }
  return result;
}

function rawTextFromGeminiResponse(response: unknown): string {
  const obj = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return obj.text ?? obj.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

function parseJsonObject<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const matched = rawText.match(/\{[\s\S]*\}/);
    if (!matched) throw new Error("regional_story_json_parse_failed");
    return JSON.parse(matched[0]) as T;
  }
}

function compactText(value: unknown, fallback: string, maxLength: number): string {
  const raw = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const selected = raw || fallback;
  return selected.length <= maxLength ? selected : `${selected.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

async function loadDbCards(place: RegionalStoryPlaceInput): Promise<RegionalKnowledgeCard[]> {
  try {
    const pool = getPool();
    const result = await pool.query<RegionalKnowledgeCardRow>(
      `select card_id, region_scope, locale, source_type, place_hint, place_keys, historical_place_names,
              category, title, summary, retrieval_text, source_url, source_label, source_fingerprint, license,
              tags, observation_hooks, temporal_scope, sensitivity_level, review_status, quality_score
         from regional_knowledge_cards
        where sensitivity_level in ('public', 'coarse')
          and review_status in ('approved', 'retrieval')
          and nullif(source_url, '') is not null
          and (
            region_scope = $1
            or region_scope = $2
            or place_hint = any($3::text[])
            or tags ?| $3::text[]
            or observation_hooks ?| $3::text[]
            or historical_place_names ?| $3::text[]
            or retrieval_text ilike $4
          )
        order by
          case when region_scope = $1 then 0 when region_scope = $2 then 1 else 2 end,
          quality_score desc,
          updated_at desc
        limit 24`,
      [
        looksLikeHamamatsu(place) ? "JP-22-Hamamatsu" : text(place.municipality) || text(place.prefecture) || "JP",
        text(place.prefecture) || "JP",
        [place.placeName, place.publicLabel, place.municipality, place.prefecture].map(text).filter(Boolean),
        `%${[place.placeName, place.publicLabel, place.municipality, place.prefecture].map(text).filter(Boolean)[0] ?? ""}%`,
      ],
    );
    return result.rows.map(rowToCard).filter((card): card is RegionalKnowledgeCard => Boolean(card));
  } catch {
    return [];
  }
}

async function loadRecentExposures(input: RegionalStoryInput): Promise<RecentExposure[]> {
  if (!input.viewerUserId) return [];
  try {
    const pool = getPool();
    const result = await pool.query<RecentExposure>(
      `select card_id, angle_key
         from user_regional_story_exposures
        where user_id = $1
          and ($2::text is null or place_id = $2)
          and shown_at >= now() - interval '45 days'
        order by shown_at desc
        limit 80`,
      [input.viewerUserId, input.place.placeId ?? null],
    );
    return result.rows;
  } catch {
    return [];
  }
}

function buildRegionalStoryGeminiPrompt(
  input: RegionalStoryInput,
  cue: RegionalStoryCue,
  exposures: RecentExposure[],
): string {
  return JSON.stringify({
    task: "regional_story_compose",
    role: "Rewrite an already-grounded regional story for ikimon.life.",
    constraints: [
      "Japanese only",
      "Do not add historical facts that are not present in cards",
      "Do not add source names or URLs that are not present in cards",
      "Do not reveal precise location names when allowPrecisePlaceLabel is false",
      "Make the page feel like a reason to revisit the same place, not a lecture",
      "Avoid repeating recent card_id + angle_key combinations",
      "Keep the user's agency first: noticing, choosing, comparing, revisiting",
      "Return compact JSON only",
    ],
    outputSchema: {
      place_hook: "string <= 90 chars",
      why_here: "string <= 170 chars",
      next_observation_angle: "string <= 110 chars",
      collective_note: "string <= 130 chars",
    },
    surface: input.surface,
    place: {
      label: normalizePlaceLabel(input.place),
      municipality: input.place.municipality ?? null,
      prefecture: input.place.prefecture ?? null,
      allowPrecisePlaceLabel: input.place.allowPrecisePlaceLabel === true,
    },
    observation: input.observation
      ? {
          observedAt: input.observation.observedAt?.slice(0, 10) ?? null,
          displayName: input.observation.displayName ?? null,
        }
      : null,
    selectedAngle: {
      key: cue.angleKey,
      label: cue.angleLabel,
    },
    cards: cue.cards.map((card) => ({
      card_id: card.cardId,
      category: card.category,
      title: card.title,
      summary: card.summary,
      tags: card.tags.slice(0, 8),
      observation_hooks: (card.observationHooks ?? []).slice(0, 8),
      temporal_scope: card.temporalScope ?? "unspecified",
      historical_place_names: (card.historicalPlaceNames ?? []).slice(0, 6),
      source_label: card.sourceLabel,
    })),
    recentExposures: exposures.slice(0, 24),
    deterministicDraft: {
      place_hook: cue.placeHook,
      why_here: cue.whyHere,
      next_observation_angle: cue.nextObservationAngle,
      collective_note: cue.collectiveNote,
    },
  });
}

async function composeRegionalStoryWithGemini(
  input: RegionalStoryInput,
  cue: RegionalStoryCue,
  exposures: RecentExposure[],
): Promise<RegionalStoryCue> {
  const cfg = loadConfig();
  if (cfg.regionalStory.provider !== "gemini" || !cfg.geminiApiKey || cue.cards.length === 0) {
    return cue;
  }
  const model = cfg.regionalStory.model || CURATOR_DEFAULT_MODEL;
  pricingForModel(model);
  try {
    await assertAiBudgetAllowed("warm");
    const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
    const prompt = buildRegionalStoryGeminiPrompt(input, cue, exposures);
    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You rewrite grounded local-place copy for a citizen biodiversity app. Use only provided cards as facts.",
        temperature: 0.25,
        maxOutputTokens: cfg.regionalStory.maxOutputTokens,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            place_hook: { type: "string" },
            why_here: { type: "string" },
            next_observation_angle: { type: "string" },
            collective_note: { type: "string" },
          },
          required: ["place_hook", "why_here", "next_observation_angle", "collective_note"],
        },
      },
    });
    const rawText = rawTextFromGeminiResponse(response);
    const parsed = parseJsonObject<RegionalStoryGeminiJson>(rawText);
    const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
    const inputTokens = Number(usage?.promptTokenCount ?? 0);
    const outputTokens = Number(usage?.candidatesTokenCount ?? 0);
    await logAiCost({
      layer: "warm",
      endpoint: "regional_story_compose",
      provider: "gemini",
      model,
      inputTokens,
      outputTokens,
      costUsd: estimateAiCostUsd({ model, inputTokens, outputTokens }),
      latencyMs: Date.now() - startedAt,
      metadata: {
        surface: input.surface,
        cardIds: cue.usedCardIds,
        angleKey: cue.angleKey,
      },
    }).catch(() => undefined);

    return {
      ...cue,
      placeHook: compactText(parsed.place_hook, cue.placeHook, 100),
      whyHere: compactText(parsed.why_here, cue.whyHere, 190),
      nextObservationAngle: compactText(parsed.next_observation_angle, cue.nextObservationAngle, 130),
      collectiveNote: compactText(parsed.collective_note, cue.collectiveNote, 150),
    };
  } catch {
    return cue;
  }
}

function chooseAngle(cards: RegionalKnowledgeCard[], exposures: RecentExposure[], surface: RegionalStorySurface): typeof ANGLES[number] {
  if (surface === "observation" && cards.some((card) => card.category === "ecology")) {
    const recentAngles = new Set(exposures.map((item) => item.angle_key));
    return recentAngles.has("season") ? ANGLES.find((angle) => angle.key === "next_observation")! : ANGLES.find((angle) => angle.key === "season")!;
  }
  const recentAngles = new Set(exposures.map((item) => item.angle_key));
  const preferred = ANGLES
    .map((angle) => ({
      angle,
      score: cards.reduce((sum, card) => sum + (angle.categories.includes(card.category) ? 1 : 0), 0)
        + (recentAngles.has(angle.key) ? -4 : 0)
        + (surface === "observation" && angle.key === "next_observation" ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return preferred[0]?.angle ?? ANGLES[0]!;
}

function observationHooksForCards(cards: RegionalKnowledgeCard[]): string[] {
  const seen = new Set<string>();
  const hooks: string[] = [];
  for (const card of cards) {
    for (const hook of card.observationHooks ?? []) {
      const normalized = text(hook);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      hooks.push(normalized);
      if (hooks.length >= 4) return hooks;
    }
  }
  return hooks;
}

type ObservationSubjectKind = "plant" | "bird" | "insect" | "aquatic" | "fungus" | "unknown";

function inferObservationSubjectKind(observation: RegionalStoryObservationInput | undefined): ObservationSubjectKind {
  const name = text(observation?.displayName);
  if (!name) return "unknown";
  if (/鳥|カモ|サギ|スズメ|ツバメ|ヒヨドリ|カラス|メジロ|シジュウカラ|ハクセキレイ|ムクドリ|トビ|カワセミ/u.test(name)) return "bird";
  if (/虫|チョウ|蝶|ガ|蛾|トンボ|セミ|バッタ|コオロギ|ハチ|蜂|アリ|甲虫|カメムシ|テントウ|クワガタ|カブト/u.test(name)) return "insect";
  if (/魚|メダカ|フナ|コイ|エビ|カニ|貝|カエル|オタマ|水生|ヤゴ/u.test(name)) return "aquatic";
  if (/キノコ|菌|カビ/u.test(name)) return "fungus";
  if (/花|草|木|樹|葉|実|種|タンポポ|サクラ|スミレ|ツツジ|アジサイ|イネ|ヨシ|シダ|コケ/u.test(name)) return "plant";
  return "unknown";
}

function scoreHookForSubject(hook: string, subjectKind: ObservationSubjectKind): number {
  if (subjectKind === "plant") {
    if (/草丈|草刈り|日当たり|湿った土|土|花|綿毛|畑|農地|道端|林縁/u.test(hook)) return 12;
  }
  if (subjectKind === "bird") {
    if (/水鳥|鳥|木陰|林縁|湖岸|水際|河川敷|街路樹|休む場所/u.test(hook)) return 12;
  }
  if (subjectKind === "insect") {
    if (/花|草丈|水辺|湿り気|林縁|落ち葉|道端|日当たり|植栽/u.test(hook)) return 12;
  }
  if (subjectKind === "aquatic") {
    if (/水路|水辺|湿った|湖岸|河川敷|水際|入り江|低地|渓流/u.test(hook)) return 12;
  }
  if (subjectKind === "fungus") {
    if (/落ち葉|木陰|湿り気|林縁|苔|日陰|森/u.test(hook)) return 12;
  }
  return 0;
}

function rankedObservationHooksForCards(cards: RegionalKnowledgeCard[], observation: RegionalStoryObservationInput | undefined): string[] {
  const subjectKind = inferObservationSubjectKind(observation);
  return observationHooksForCards(cards)
    .map((hook, index) => ({ hook, score: scoreHookForSubject(hook, subjectKind) - index * 0.01 }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.hook);
}

function displayHook(value: string): string {
  return value
    .replace(/を見る$/u, "")
    .replace(/を確認する$/u, "")
    .replace(/を一緒に撮る$/u, "")
    .replace(/を撮る$/u, "")
    .replace(/を比べる$/u, "")
    .trim();
}

function formatHookList(hooks: string[], maxItems: number): string {
  return hooks.slice(0, maxItems).map(displayHook).filter(Boolean).join("・");
}

function nextObservationCopy(angleKey: string, placeLabel: string, observation: RegionalStoryObservationInput | undefined, cards: RegionalKnowledgeCard[] = []): string {
  const observationName = observation?.displayName;
  const target = text(observationName) || "今日見えたもの";
  const hooks = rankedObservationHooksForCards(cards, observation);
  if (hooks.length >= 3) return `次は、${formatHookList(hooks, 3)}が分かる写真を撮る。`;
  if (hooks.length > 0) return `次は ${target} と一緒に、${formatHookList(hooks, 2)}も残す。`;
  if (angleKey === "landform") return `次は ${target} のすぐ横で、日当たり・湿り気・地面の傾きを写す。`;
  if (angleKey === "human_life") return `草刈り跡、踏まれた道、花壇の縁など、人が関わった跡を一緒に撮る。`;
  if (angleKey === "old_route") return `少し引いて、道・入口・場所の端が分かる写真を撮る。`;
  if (angleKey === "water_edge") return `水路、湿った土、乾いた場所の違いが分かる角度を足す。`;
  if (angleKey === "season") return `同じ場所で、咲く前・咲いた後・綿毛になった後を比べる。`;
  return `${target} だけでなく、周囲1mの草地や道端も一緒に残す。`;
}

function composeStory(input: RegionalStoryInput, cards: RegionalKnowledgeCard[], angle: typeof ANGLES[number], sourceMode: RegionalStoryCue["sourceMode"]): RegionalStoryCue {
  const placeLabel = normalizePlaceLabel(input.place);
  const primary = cards[0];
  const secondary = cards[1];
  const target = text(input.observation?.displayName) || "今日見えたもの";
  const hooks = rankedObservationHooksForCards(cards, input.observation);
  const hookLine = hooks.length > 0
    ? `具体的には、${formatHookList(hooks, 4)}。`
    : "次は生きものだけでなく、足元・道端・管理の跡を足すと比べやすくなります。";
  const sourceLine = primary
    ? primary.summary
    : "地域資料がまだ少ない場所でも、同じ場所を比べる記録には価値があります。";
  const whyExtra = secondary && input.surface !== "observation" ? `余裕があれば「${secondary.title}」の角度も後で見られます。` : "";
  return {
    surface: input.surface,
    angleKey: angle.key,
    angleLabel: angle.label,
    placeHook: `${target}をもう一度見るなら、「なぜここにいたか」まで見る。`,
    whyHere: `${sourceLine} 次に${placeLabel}を見る時は、花だけで終わらせず、周りの条件も残す。${hookLine}${whyExtra}`,
    nextObservationAngle: nextObservationCopy(angle.key, placeLabel, input.observation, cards),
    collectiveNote: `次回も同じ場所で環境メモが増えると、ただの「いた」ではなく、${target}がここで見えた条件をあとから比べられます。`,
    cards,
    usedCardIds: cards.map((card) => card.cardId),
    sourceMode,
  };
}

async function recordRegionalStoryExposure(input: RegionalStoryInput, cue: RegionalStoryCue): Promise<void> {
  if (!input.viewerUserId || cue.usedCardIds.length === 0) return;
  try {
    const pool = getPool();
    await Promise.all(cue.usedCardIds.map((cardId) => pool.query(
      `insert into user_regional_story_exposures (
         user_id, card_id, place_id, surface, angle_key, observation_id, metadata
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.viewerUserId,
        cardId,
        input.place.placeId ?? null,
        input.surface,
        cue.angleKey,
        input.observation?.observationId ?? null,
        JSON.stringify({ sourceMode: cue.sourceMode }),
      ],
    )));
  } catch {
    // Regional stories should never break the primary read path.
  }
}

export async function getRegionalStoryCue(input: RegionalStoryInput): Promise<RegionalStoryCue | null> {
  const maxCards = Math.max(1, Math.min(input.maxCards ?? (input.surface === "observation" ? 2 : 1), 2));
  const dbCards = await loadDbCards(input.place);
  const seedCards = looksLikeHamamatsu(input.place) ? [...SEEDED_HAMAMATSU_CARDS, ...EXPANDED_HAMAMATSU_CARDS] : [];
  const merged = uniqueCards([...dbCards, ...seedCards])
    .filter((card) => card.sensitivityLevel !== "restricted")
    .map((card) => ({ card, score: matchScore(card, input.place, input.surface) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (input.surface === "observation") {
        return observationCardPriority(b.card, input.place) - observationCardPriority(a.card, input.place) || b.score - a.score;
      }
      return b.score - a.score;
    })
    .map((item) => item.card);

  if (merged.length === 0) {
    return composeStory(input, [], ANGLES[0]!, "fallback");
  }

  const exposures = await loadRecentExposures(input);
  const blocked = new Set(exposures.map((item) => `${item.card_id}:${item.angle_key}`));
  const preferredPool = input.surface === "observation"
    ? merged.filter((card) => card.category !== "cultural_asset" || cardDirectlyMatchesPlace(card, input.place))
    : merged;
  const candidatePool = preferredPool.length >= maxCards ? preferredPool : merged;
  const angle = chooseAngle(candidatePool.slice(0, maxCards), exposures, input.surface);
  const fresh = candidatePool.filter((card) => !blocked.has(`${card.cardId}:${angle.key}`));
  const selected = (fresh.length > 0 ? fresh : candidatePool).slice(0, maxCards);
  const sourceMode: RegionalStoryCue["sourceMode"] = dbCards.length > 0 && seedCards.length > 0
    ? "mixed"
    : dbCards.length > 0
      ? "db"
      : "seed";
  const deterministicCue = composeStory(input, selected, angle, sourceMode);
  const cue = await composeRegionalStoryWithGemini(input, deterministicCue, exposures);
  if (input.recordExposure !== false) {
    await recordRegionalStoryExposure(input, cue);
  }
  return cue;
}
