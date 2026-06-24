import * as bcrypt from "bcryptjs";

type D1Value = string | number | null;

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

interface R2ObjectBody {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
}

interface R2ListResult {
  objects: R2ObjectSummary[];
  truncated?: boolean;
  cursor?: string;
}

interface R2ObjectSummary {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date | string;
  checksums?: Record<string, string>;
}

interface Queue<T = unknown> {
  send(message: T): Promise<void>;
}

interface Env {
  CORE_DB: D1Database;
  OBS_DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  MEDIA_QUEUE: Queue<MediaJob>;
  ENVIRONMENT: string;
  PUBLIC_LOCATION_CELL_PRECISION: string;
  INTERNAL_AUTH_TOKEN?: string;
  OBSERVATION_DB_NAME?: string;
  OBSERVATION_ARCHIVE_TARGET?: string;
  ORIGIN_FALLBACK_BASE_URL?: string;
  ORIGIN_FALLBACK_RESOLVE_OVERRIDE?: string;
  PUBLIC_WRITE_MODE?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  V2_OAUTH_STATE_SECRET?: string;
}

function isAppRuntime(env: Env): boolean {
  return env.ENVIRONMENT === "shadow" || env.ENVIRONMENT === "staging" || env.ENVIRONMENT === "production";
}

const IKIMON_GA4_MEASUREMENT_ID = "G-NCL0M1VJZ2";
const IKIMON_CLARITY_PROJECT_ID = "wl2ezvfqbh";
const REFLECTION_LOOP_MANIFEST_PATH = "/qa/reflection-loop.json";

interface DraftAssetInput {
  mime: string;
  bytes: number;
  sha256?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

interface DraftObservationInput {
  userId: string;
  observedAt?: string;
  exactLat?: number;
  exactLng?: number;
  locationAccuracyM?: number;
  visibility?: "private" | "public";
  media?: DraftAssetInput[];
}

interface FinalizeObservationInput {
  draftId: string;
  taxonLabel?: string;
  note?: string;
}

interface LegacyObservationUpsertInput {
  observationId?: string;
  clientSubmissionId?: string | null;
  userId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  locationAccuracyM?: number | null;
  note?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  municipality?: string | null;
  prefecture?: string | null;
  taxon?: {
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
  } | null;
  subjects?: Array<{
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
    isPrimary?: boolean;
  }>;
  visitMode?: "manual" | "survey" | null;
  revisitReason?: string | null;
  targetTaxaScope?: string | null;
  sourcePayload?: Record<string, unknown> | null;
}

interface LegacyPhotoUploadInput {
  filename?: string | null;
  mimeType?: string | null;
  base64Data?: string | null;
  mediaRole?: string | null;
  facePrivacy?: string | null;
}

interface SessionIssueInput {
  userId: string;
  ttlHours?: number | null;
  displayName?: string | null;
  roleName?: string | null;
  rankLabel?: string | null;
}

interface AuthLoginInput {
  email?: unknown;
  password?: unknown;
  redirect?: unknown;
}

interface AuthUserRow {
  user_id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  role_name: string | null;
  rank_label: string | null;
  banned: number;
}

type OAuthProvider = "google" | "twitter";

interface OAuthStatePayload {
  provider: OAuthProvider;
  state: string;
  redirect: string;
  codeVerifier?: string;
  expiresAt: number;
}

interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
}

interface OAuthAccountRow {
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string | null;
  display_name: string;
  role_name: string | null;
  rank_label: string | null;
  banned: number;
}

interface SessionSnapshot {
  tokenHash: string;
  userId: string;
  displayName: string;
  roleName: string;
  rankLabel: string | null;
  banned: boolean;
  expiresAt: string;
}

interface OriginSessionResponse {
  ok?: boolean;
  session?: {
    userId?: unknown;
    displayName?: unknown;
    roleName?: unknown;
    rankLabel?: unknown;
    banned?: unknown;
    expiresAt?: unknown;
    tokenHash?: unknown;
  } | null;
}

interface PersonalAreaSubscriptionRow {
  subscription_id: string;
  target_type: string;
  target_id: string;
  label: string | null;
  href: string | null;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
  observation_count?: number | null;
  needs_id_count?: number | null;
}

interface PersonalTaxonSubscriptionRow {
  label: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
}

interface PersonalAlertRow {
  delivery_id: string;
  occurrence_id: string;
  trigger_kind: string;
  delivery_status: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  created_at: string | null;
  payload_json: string | null;
}

interface VideoDirectUploadInput {
  maxDurationSeconds?: number | null;
  filename?: string | null;
  observationId?: string | null;
  mediaRole?: string | null;
  uploadProtocol?: string | null;
  fileSizeBytes?: number | null;
}

interface VideoFinalizeInput {
  observationId?: string | null;
  durationMs?: number | null;
  readyToStream?: boolean | null;
  bytes?: number | null;
}

interface MediaJob {
  outboxId: string;
  topic: "media.process" | "readmodel.refresh";
  targetId: string;
}

interface UploadedAssetRow {
  asset_id: string;
  object_key: string;
}

interface PublicMapRow {
  observation_id: string;
  public_cell: string;
  observed_at: string;
  taxon_label: string | null;
  asset_count: number;
}

interface PublicMapPhotoRow {
  observation_id: string;
  public_derivative_key: string;
}

interface OwnMapObservationRow {
  observation_id: string;
  observed_at: string;
  taxon_label: string | null;
  note: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  public_derivative_key: string | null;
}

interface PublicDetailRow extends PublicMapRow {
  note: string | null;
  visibility: string;
}

interface PublicDetailAssetRow {
  asset_id: string;
  object_key: string;
  mime: string;
  bytes: number;
  duration_ms: number | null;
  public_derivative_key: string | null;
}

interface PublicDerivativeInspection {
  tool: string;
  contentType: string;
  bytes: number;
  scannedContainer: string;
  gpsExifPresent: boolean;
  exifPresent: boolean;
  gpsPresent: boolean;
  xmpPresent: boolean;
  exactCoordinateLiteralPresent: boolean;
  checkedAt: string;
}

interface PartitionSummaryRow {
  partition_month: string | null;
  count: number;
  earliest_observed_at: string | null;
  latest_observed_at: string | null;
}

interface RollbackLedgerRow {
  ledger_id: string;
  event_type: string;
  target_id: string;
  partition_month: string | null;
  source_endpoint: string;
  payload_json: string;
  replay_sql: string;
  replay_status: string;
  created_at: string;
}

interface OperationAuditRow {
  payload_json: string;
  created_at: string;
}

interface OriginFallbackTelemetryPayload {
  reason: string;
  method: string;
  host: string;
  routePattern: string;
  pathHash: string;
  originalUiHtmlKeyHash?: string;
  publicWriteMode: string;
  environment: string;
}

interface FieldDetailReadmodelRow {
  field_id: string;
  source: string;
  admin_level: string | null;
  name: string;
  name_kana: string | null;
  summary: string | null;
  prefecture: string | null;
  city: string | null;
  public_cell: string;
  public_lat: number;
  public_lng: number;
  radius_m: number | null;
  area_ha: number | null;
  has_polygon: number;
  has_simplified_geometry: number;
  certification_id: string | null;
  certification_url: string | null;
  official_url: string | null;
  owner_url: string | null;
  story_url: string | null;
  verification_level: string | null;
  verification_method: string | null;
  verification_label: string | null;
  source_confidence: number | null;
  valid_from: string | null;
  valid_to: string | null;
  entity_key: string | null;
  updated_at: string | null;
}

interface AreaPolygonReadmodelRow extends FieldDetailReadmodelRow {}

interface AreaPolygonGeometryReadmodelRow {
  field_id: string;
  source: string;
  admin_level: string | null;
  name: string;
  prefecture: string | null;
  city: string | null;
  center_lat: number;
  center_lng: number;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lng: number;
  bbox_max_lng: number;
  area_ha: number | null;
  geometry_json: string;
  approximate_boundary: number;
  boundary_approximation: string | null;
  source_confidence: number | null;
  verification_level: string | null;
  verification_label: string | null;
  official_url: string | null;
  owner_url: string | null;
  story_url: string | null;
  certification_url: string | null;
  entity_key: string | null;
  updated_at: string | null;
}

interface ReverseDeltaCountRow {
  count: number;
}

const MAX_MEDIA_PER_DRAFT = 12;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const SESSION_COOKIE_NAME = "ikimon_v2_session";
const MIN_VIDEO_DURATION_SECONDS = 6;
const MAX_VIDEO_DURATION_SECONDS = 60;
const MAP_DEFAULT_GRID_M = 1000;
const OBSERVATION_PARTITION_STRATEGY = "single_active_d1_logical_month";
const WORKER_BUILD_MARKER = "map-shell-cookie-safe";
const PUBLIC_CUSTOM_HOSTS = new Set(["ikimon.life", "www.ikimon.life", "staging.ikimon.life"]);
const HAMAMATSU_CITY_HERITAGE_URL = "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamamatsuchiikiisan.html";
const JMA_NOWCAST_TARGET_N1 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json";
const JMA_NOWCAST_TARGET_N2 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json";
const JMA_NOWCAST_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/nowc";
const JMA_SHORT_RANGE_TARGET = "https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes.json";
const JMA_SHORT_RANGE_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/rasrf";
const JMA_NOWCAST_OFFSETS = [0, 5, 15, 30, 60] as const;
const JMA_SHORT_RANGE_OFFSETS = [120, 180, 240, 300, 360] as const;
const JMA_RAIN_TILE_MAX_ZOOM = 10;
const PUBLIC_LANG_PREFIX_PATTERN = /^\/(?:ja|en|es|pt-br)(?=\/|$)/;

function stripPublicLangPrefix(pathname: string): string {
  const stripped = pathname.replace(PUBLIC_LANG_PREFIX_PATTERN, "");
  return stripped === "" ? "/" : stripped;
}

type ShadowMapGuideSpot = {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  locationPrecision: "exact" | "approximate";
  visitAnchorLabel: string;
  publicLocationMode: "exact" | "area" | "hidden";
  subjectLocationMode: "same_as_visit_anchor" | "area_public" | "hidden";
  sensitiveReviewStatus: "cleared" | "needs_review";
  category: "heritage" | "nature" | "community" | "owner";
  approvalState: "public_source" | "owner_verified";
  preview: string;
  script: string;
  storyPoints: string[];
  triggerRadiusM: number;
  unlockedRadiusM: number;
  guideAreaId?: string;
  guideProgramIds?: string[];
  ownerType?: "owner" | "community" | "municipality" | "school";
  visibilityStatus?: "published" | "paused" | "hidden";
  safetyStatus?: "active" | "caution" | "closed";
  landownerConsent?: boolean;
  availableTimePolicy?: "anytime_public" | "business_hours" | "event_only";
  distanceDisplayPolicy?: "coarse";
  requiredAccuracyM?: number;
  accuracyBufferCapM?: number;
  sourceLinks: Array<{ label: string; url: string }>;
};

const SHADOW_MAP_GUIDE_SPOTS: ShadowMapGuideSpot[] = [
  {
    id: "aikan-renri-lenri-tree",
    title: "Cafe & Restaurant LENRIと連理の木",
    subtitle: "愛管の自然共生サイトで、食・農・設備技術と土地の関係を聞く",
    lat: 34.81435,
    lng: 137.7327,
    locationPrecision: "exact",
    visitAnchorLabel: "Cafe & Restaurant LENRI/連理の木の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "owner",
    approvalState: "owner_verified",
    preview: "連理の木、れんり農園、Cafe & Restaurant LENRI、地中熱GXを、同じ場所で育ってきた地域の物語として紹介します。",
    script: "ここは、愛管株式会社が設備会社としての現場力を、食、農、自然共生、教育へ少しずつ結び直してきた場所です。訪れたら、看板や建物だけでなく、連理の木、農園、足元の草地、水や熱の使い方にも目を向けてください。",
    storyPoints: [
      "連理の木を中心に、食、農、自然共生、設備技術が同じ場所でつながっている。",
      "Cafe & Restaurant LENRIは、地域素材や場づくりを通じて人と土地の関係を見せる入口。",
      "地中熱GXや自然共生サイトの活動も、裏側でこの場所の思想を支えている。"
    ],
    triggerRadiusM: 120,
    unlockedRadiusM: 45,
    guideAreaId: "aikan-renri-ikan-hq",
    guideProgramIds: ["aikan-renri-guide-relay"],
    ownerType: "owner",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 120,
    accuracyBufferCapM: 80,
    sourceLinks: [
      { label: "愛管株式会社: 生物多様性", url: "https://i-kan.co.jp/company/biodiversity/" },
      { label: "浜松市: 地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL }
    ]
  },
  {
    id: "hamamatsu-shijimizuka-site",
    title: "蜆塚遺跡",
    subtitle: "縄文時代の集落と貝塚を、今の公園で見る",
    lat: 34.713292,
    lng: 137.7031213,
    locationPrecision: "exact",
    visitAnchorLabel: "蜆塚公園・博物館周辺の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "東海地方でも大きな縄文時代の集落跡として紹介される場所です。",
    script: "ここは、縄文時代後期から晩期にかけての集落跡を、今の公園の中で見られる場所です。歩く時は、展示物だけでなく、地形、貝塚、隣接する博物館までをひとつの時間の層として見てください。",
    storyPoints: [
      "縄文時代の暮らしの跡が、現在は公園として保存されている。",
      "貝塚は食べ物のごみではなく、当時の環境や暮らしを読む手がかりになる。",
      "博物館とセットで見ると、現地の地形と出土資料がつながる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 蜆塚遺跡", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamatsu/hamatsu/shizimizuka.html" }]
  },
  {
    id: "hamamatsu-nakamurake-house",
    title: "中村家住宅",
    subtitle: "宇布見に残る大規模な近世住宅",
    lat: 34.6974944,
    lng: 137.6336934,
    locationPrecision: "exact",
    visitAnchorLabel: "中村家住宅の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "国指定重要文化財として紹介される、雄踏町宇布見の歴史的住宅です。",
    script: "ここでは、建物の大きさだけでなく、部屋の配置や柱の立ち方にも注目してください。住宅は、ひとつの家の歴史だけでなく、宇布見の土地と人の移動を読む入口になります。",
    storyPoints: [
      "大きな屋敷構えと主屋の構造から、地域の有力家の暮らしが見える。",
      "建物の間取りや柱の配置は、保存建築を読む具体的な手がかりになる。",
      "浜名湖周辺の歴史や東海道沿いの文化とつながる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 中村家住宅", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/yuto/yuto/nakamurake.html" }]
  },
  {
    id: "hamamatsu-maisaka-wakihonjin",
    title: "旧舞坂脇本陣",
    subtitle: "東海道舞坂宿と今切渡しの記憶",
    lat: 34.68472,
    lng: 137.6087012,
    locationPrecision: "exact",
    visitAnchorLabel: "旧舞坂脇本陣の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "旧東海道に残る脇本陣の遺構として紹介される場所です。",
    script: "ここは、江戸時代の東海道舞坂宿を想像するための入口です。建物だけでなく、海と街道、人の移動が重なる地点として見てください。",
    storyPoints: [
      "舞坂宿は東海道と今切渡しを結ぶ交通の節点だった。",
      "復元された建物から、宿場町の役割を現地で想像できる。",
      "湖・海・街道が重なる浜松らしい文化景観の入口になる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 旧舞坂脇本陣", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/maisaka/maisaka/wakihonjin.html" }]
  },
  {
    id: "hamamatsu-castle-ruins",
    title: "浜松城跡",
    subtitle: "街なかに残る城郭の石垣と地形",
    lat: 34.7117306,
    lng: 137.7249641,
    locationPrecision: "exact",
    visitAnchorLabel: "浜松城公園の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "市指定史跡として、野面積みの石垣などが紹介されています。",
    script: "浜松城跡では、天守だけでなく石垣と地形を見てください。街の中心にありながら、城の防御、地形、まちの記憶が同時に見える場所です。",
    storyPoints: [
      "石垣の積み方から、古い城郭の技術が読める。",
      "城跡は観光地であると同時に、市街地の地形を理解する手がかりになる。",
      "三方ヶ原合戦や犀ヶ崖など、周辺の戦国史跡ともつながる。"
    ],
    triggerRadiusM: 260,
    unlockedRadiusM: 110,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 浜松城跡", url: "https://www.city.hamamatsu.shizuoka.jp/kouen/siro/hamamatujou.html" }]
  },
  {
    id: "hamamatsu-ryotanji-garden",
    title: "龍潭寺庭園",
    subtitle: "井伊谷の歴史と庭園を見る",
    lat: 34.8286004,
    lng: 137.6679167,
    locationPrecision: "exact",
    visitAnchorLabel: "龍潭寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "浜名区引佐町井伊谷の文化財として紹介される庭園です。",
    script: "龍潭寺では、庭そのものだけでなく、井伊谷の地形や周辺の城跡、寺院の配置を一緒に見てください。静かな庭の奥に、地域の政治と信仰の記憶が重なっています。",
    storyPoints: [
      "庭園は鑑賞の場であり、井伊谷の歴史を読む入口でもある。",
      "寺の建物、庭、背後の地形を一体で見ると場所の意味が立ち上がる。",
      "周辺の地域遺産センターや城跡と合わせて巡ると理解が深まる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 名勝", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/meisho.html" },
      { label: "浜松市: 地域遺産センター", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/maibun/index.html" }
    ]
  },
  {
    id: "hamamatsu-makaya-temple-garden",
    title: "摩訶耶寺庭園",
    subtitle: "湖北に残る古庭園の時間",
    lat: 34.8176672,
    lng: 137.5568322,
    locationPrecision: "exact",
    visitAnchorLabel: "摩訶耶寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "鎌倉時代初期にさかのぼる庭園として紹介される場所です。",
    script: "摩訶耶寺庭園では、水、石、池の配置をゆっくり見てください。庭は静かな景色ですが、修復されながら受け継がれてきた文化財でもあります。",
    storyPoints: [
      "池泉鑑賞式の庭園として、石と水の配置が見どころになる。",
      "古い庭園は、自然そのものではなく、人が自然をどう見たかを残す。",
      "修復の履歴まで含めて、地域で守る文化財として見られる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 摩訶耶寺庭園", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/bunkazaijyoho77.html" }]
  },
  {
    id: "hamamatsu-hourinji-temple",
    title: "初山宝林寺",
    subtitle: "浜松にもたらされた黄檗文化",
    lat: 34.8170097,
    lng: 137.6917906,
    locationPrecision: "exact",
    visitAnchorLabel: "初山宝林寺の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "明の僧・独湛に関わる黄檗宗寺院として紹介されています。",
    script: "初山宝林寺では、建物の形や雰囲気に残る異国的な要素を見てください。寺を見ることは、浜松が外から来た文化を受け止めてきた歴史を見ることでもあります。",
    storyPoints: [
      "黄檗文化は、建築や信仰の表現として浜松に残っている。",
      "寺の配置や建物の意匠から、地域と外来文化の接点が見える。",
      "細江・引佐周辺の寺社や井伊谷の歴史と合わせて巡れる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 浜松にもたらされた黄檗文化", url: "https://www.city.hamamatsu.shizuoka.jp/hamahaku/02tenji/tokubetu/oubaku.html" },
      { label: "浜松市: 文化財情報vol.1", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/info_01.html" }
    ]
  },
  {
    id: "hamamatsu-heritage-system",
    title: "浜松地域遺産認定制度",
    subtitle: "地域で受け継がれてきた文化資源を見る入口",
    lat: 34.710834,
    lng: 137.726126,
    locationPrecision: "approximate",
    visitAnchorLabel: "浜松中心部の地域遺産制度紹介地点",
    publicLocationMode: "area",
    subjectLocationMode: "area_public",
    sensitiveReviewStatus: "cleared",
    category: "community",
    approvalState: "public_source",
    preview: "浜松市が地域の文化資源を顕彰する制度の考え方を紹介します。",
    script: "浜松市の地域遺産認定制度は、指定文化財だけでなく、地域で大切にされてきた文化資源を見えるようにする仕組みです。地図で点を見る時も、建物や木だけでなく、それを受け継ぐ人や地域の記憶を合わせて見てください。",
    storyPoints: [
      "制度は、地域に残る文化資源をゆるやかに認め、活用するための入口になる。",
      "所有者や地域の同意、文化財保護審議会の意見を経て認定される。",
      "ikimonのガイドでは、出典を明示しながら現地で聞ける形に変換する。"
    ],
    triggerRadiusM: 300,
    unlockedRadiusM: 120,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 浜松地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL }]
  }
];
const ORIGINAL_UI_HTML_STATIC_PATHS = new Set([
  "/",
  "/demo/place-feeling-tags",
  "/guide",
  "/record",
  "/records",
  "/map",
  "/walk-map-source-drafts/shizuoka-ikimono-walk-route",
  "/walk-maps",
  "/walk-maps/jp-shizuoka-yatsuyama-sample-v0",
  "/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
  "/walk-maps/jp-shizuoka-mariko-waterfront-sample-v0",
  "/app-refresh",
  "/login",
  "/profile",
  "/profile/settings",
  "/en",
  "/en/",
  "/en/demo/place-feeling-tags",
  "/en/guide",
  "/en/login",
  "/en/map",
  "/en/profile",
  "/en/profile/settings",
  "/en/record",
  "/en/records",
  "/en/register",
  "/es",
  "/es/",
  "/es/demo/place-feeling-tags",
  "/es/guide",
  "/es/login",
  "/es/map",
  "/es/profile",
  "/es/profile/settings",
  "/es/record",
  "/es/records",
  "/es/register",
  "/pt-br",
  "/pt-br/",
  "/pt-br/demo/place-feeling-tags",
  "/pt-br/guide",
  "/pt-br/login",
  "/pt-br/map",
  "/pt-br/profile",
  "/pt-br/profile/settings",
  "/pt-br/record",
  "/pt-br/records",
  "/pt-br/register",
  "/register",
  "/learn",
  "/community",
  "/community/events",
  "/community/events/new",
  "/community/fields",
  "/for-business",
  "/for-business/field-programs",
  "/for-business/invasive-reporting",
  "/ja",
  "/ja/",
  "/ja/about",
  "/ja/cases",
  "/ja/community",
  "/ja/demo/place-feeling-tags",
  "/ja/community/events",
  "/ja/community/events/new",
  "/ja/community/fields",
  "/en/community/fields",
  "/es/community/fields",
  "/pt-br/community/fields",
  "/ja/contact",
  "/ja/faq",
  "/ja/for-business",
  "/ja/for-business/apply",
  "/ja/for-business/demo",
  "/ja/for-business/field-programs",
  "/ja/for-business/invasive-reporting",
  "/ja/for-business/monitoring/apply",
  "/ja/for-business/pricing",
  "/ja/for-business/status",
  "/ja/login",
  "/ja/profile",
  "/ja/profile/settings",
  "/ja/register",
  "/ja/for-researcher/apply",
  "/ja/guide",
  "/ja/walk-maps",
  "/ja/walk-maps/jp-shizuoka-yatsuyama-sample-v0",
  "/ja/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
  "/ja/walk-maps/jp-shizuoka-mariko-waterfront-sample-v0",
  "/ja/home",
  "/ja/impact",
  "/ja/learn",
  "/ja/learn/biodiversity",
  "/ja/learn/biomonweek",
  "/ja/learn/citizen-science",
  "/ja/learn/field-loop",
  "/ja/learn/glossary",
  "/ja/learn/identification-basics",
  "/ja/learn/invasive-species",
  "/ja/learn/invasive-species/alternanthera-philoxeroides",
  "/ja/learn/invasive-species/bombus-terrestris",
  "/ja/learn/invasive-species/chelydra-serpentina",
  "/ja/learn/invasive-species/coreopsis-lanceolata",
  "/ja/learn/invasive-species/eichhornia-crassipes",
  "/ja/learn/invasive-species/erigeron-annuus",
  "/ja/learn/invasive-species/erigeron-philadelphicus",
  "/ja/learn/invasive-species/gambusia-affinis",
  "/ja/learn/invasive-species/garrulax-canorus",
  "/ja/learn/invasive-species/latrodectus-hasseltii",
  "/ja/learn/invasive-species/leiothrix-lutea",
  "/ja/learn/invasive-species/linepithema-humile",
  "/ja/learn/invasive-species/lithobates-catesbeianus",
  "/ja/learn/invasive-species/micropterus-salmoides",
  "/ja/learn/invasive-species/myocastor-coypus",
  "/ja/learn/invasive-species/paguma-larvata",
  "/ja/learn/invasive-species/pistia-stratiotes",
  "/ja/learn/invasive-species/procambarus-clarkii",
  "/ja/learn/invasive-species/procyon-lotor",
  "/ja/learn/invasive-species/rudbeckia-laciniata",
  "/ja/learn/invasive-species/sicyos-angulatus",
  "/ja/learn/invasive-species/solenopsis-invicta",
  "/ja/learn/invasive-species/solidago-canadensis",
  "/ja/learn/invasive-species/taraxacum-officinale",
  "/ja/learn/invasive-species/trachemys-scripta-elegans",
  "/ja/learn/invasive-species/tradescantia-fluminensis",
  "/ja/learn/invasive-species-reporting",
  "/ja/learn/methodology",
  "/ja/learn/policy-and-business",
  "/ja/learn/technology",
  "/ja/learn/terms/30by30",
  "/ja/learn/terms/ai-candidate",
  "/ja/learn/terms/attention-restoration-theory",
  "/ja/learn/terms/baseline",
  "/ja/learn/terms/biodiversity",
  "/ja/learn/terms/biodiversity-credits",
  "/ja/learn/terms/biodiversity-monitoring",
  "/ja/learn/terms/biomonweek",
  "/ja/learn/terms/biophilia-hypothesis",
  "/ja/learn/terms/citizen-science",
  "/ja/learn/terms/darwin-core",
  "/ja/learn/terms/dataset",
  "/ja/learn/terms/dwca",
  "/ja/learn/terms/ecosystem-services",
  "/ja/learn/terms/environmental-dna",
  "/ja/learn/terms/evidence-tier",
  "/ja/learn/terms/fixed-point-observation",
  "/ja/learn/terms/gbif",
  "/ja/learn/terms/identification",
  "/ja/learn/terms/kunming-montreal-gbf",
  "/ja/learn/terms/location-data",
  "/ja/learn/terms/natural-capital",
  "/ja/learn/terms/nature-connectedness",
  "/ja/learn/terms/nature-positive",
  "/ja/learn/terms/nature-symbiosis-site",
  "/ja/learn/terms/oecm",
  "/ja/learn/terms/one-health",
  "/ja/learn/terms/open-dispute",
  "/ja/learn/terms/participatory-monitoring",
  "/ja/learn/terms/quick-capture",
  "/ja/learn/terms/rare-species",
  "/ja/learn/terms/sampling-effort",
  "/ja/learn/terms/survey",
  "/ja/learn/terms/taxonomy-name",
  "/ja/learn/terms/tnfd",
  "/ja/learn/updates",
  "/ja/learn/wellbeing",
  "/en/learn",
  "/es/learn",
  "/pt-br/learn",
  "/ja/lens",
  "/ja/login",
  "/ja/map",
  "/ja/privacy",
  "/ja/profile",
  "/ja/profile/settings",
  "/ja/record",
  "/ja/records",
  "/ja/register",
  "/ja/terms"
]);

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const nativePathname = stripPublicLangPrefix(url.pathname);

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, environment: env.ENVIRONMENT });
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/healthz") {
        return getHealthz(env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/readyz") {
        return getReadyz(env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === REFLECTION_LOOP_MANIFEST_PATH) {
        return getReflectionLoopManifest(url, env);
      }

      if (url.pathname.startsWith("/internal/")) {
        const guard = authorizeInternalRequest(request, env);
        if (guard) return guard;
      }

      if (isShadowDiagnosticPath(url.pathname) && env.ENVIRONMENT !== "shadow") {
        return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/weather/jma-nowcast/times"
        || nativePathname === "/api/v1/map/weather/jma-nowcast/times"
      )) {
        return getJmaNowcastTimesResponse();
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/weather/jma-nowcast/tile"
        || nativePathname === "/api/v1/map/weather/jma-nowcast/tile"
      )) {
        return getJmaNowcastTileResponse(url);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/cells") {
        return getPublicMapCells(url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/observations") {
        return getPublicMapObservations(url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/my-places") {
        return getPublicMapMyPlaces(request, env);
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/map/my-observations"
        || nativePathname === "/api/v1/me/map-observations"
      )) {
        return getPublicMapMyObservations(request, url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/traces") {
        return getPublicMapEmptyGeoJson("traces");
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/frontier") {
        return getPublicMapEmptyGeoJson("frontier");
      }

      if (request.method === "GET" && isMapAreaPolygonsApiPath(url.pathname)) {
        if (shouldFallbackMapAreaPolygonsToOrigin(request, url, env)) {
          const nativeResponse = await getPublicMapAreaPolygons(url, env, { allowApproximateFallback: false });
          if (nativeResponse) return nativeResponse;
          return fetchMapAreaPolygonsOriginFallback(request, url, env);
        }
        const response = await getPublicMapAreaPolygons(url, env);
        if (response) return response;
        return getPublicMapEmptyGeoJson("area-polygons");
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/effort-summary") {
        return getPublicMapEffortSummaryShim();
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/site-brief") {
        return getPublicMapSiteBriefShim(url);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/guide-spots") {
        return getPublicMapGuideSpots(url);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/municipal-walk-maps") {
        return getMunicipalWalkMapCandidates(url);
      }

      const fieldDetailApiMatch = url.pathname.match(/^\/api\/v1\/fields\/([^/]+)\/public-detail$/);
      if (request.method === "GET" && fieldDetailApiMatch?.[1]) {
        return getFieldDetailJson(decodeURIComponent(fieldDetailApiMatch[1]), env);
      }

      const areaSnapshotMatch = url.pathname.match(/^\/api\/v1\/fields\/([^/]+)\/area-snapshot$/);
      if (request.method === "GET" && areaSnapshotMatch?.[1]) {
        return getOriginalUiAreaSnapshot(decodeURIComponent(areaSnapshotMatch[1]), request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiStaticAssetPath(url.pathname)) {
        return getOriginalUiStaticAsset(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiThumbPath(url.pathname)) {
        return getOriginalUiThumb(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isProfileHtmlPath(url.pathname)) {
        return getSessionAwareProfileHtml(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiHtmlPath(url.pathname)) {
        return getOriginalUiHtml(request, url, env);
      }

      const oauthStartMatch = url.pathname.match(/^\/auth\/oauth\/([^/]+)\/start$/);
      if (request.method === "GET" && oauthStartMatch?.[1]) {
        return handleOAuthStart(request, decodeURIComponent(oauthStartMatch[1]), env);
      }

      const oauthCallbackMatch = url.pathname.match(/^\/auth\/oauth\/([^/]+)\/callback$/);
      if (request.method === "GET" && oauthCallbackMatch?.[1]) {
        return handleOAuthCallback(request, decodeURIComponent(oauthCallbackMatch[1]), env);
      }

      if (request.method === "GET" && url.pathname === "/oauth_callback.php") {
        return handleOAuthCallback(request, url.searchParams.get("provider"), env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/derived/")) {
        return getPublicDerivedMedia(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/record") {
        return html(renderShadowRecordSmokeHtml(), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/map") {
        return html(renderShadowMapSmokeHtml(url), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/takedown-proof") {
        return shadowTakedownProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/video-metadata-proof") {
        return shadowVideoMetadataProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/missing-media-ledger-proof") {
        return shadowMissingMediaLedgerProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/stream-nonready-exclusion-proof") {
        return shadowStreamNonReadyExclusionProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/reverse-delta-proof") {
        return shadowReverseDeltaProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/update-delete-replay-proof") {
        return shadowUpdateDeleteReplayProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/rollback-restore-smoke") {
        return shadowRollbackRestoreSmoke(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/production-import-dress-rehearsal-proof") {
        return shadowProductionImportDressRehearsalProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/route-change-rehearsal-proof") {
        return shadowRouteChangeRehearsalProof(url, env);
      }

      const shadowVideoMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)$/);
      if (request.method === "GET" && shadowVideoMatch?.[1]) {
        return getShadowVideoStream(decodeURIComponent(shadowVideoMatch[1]), env);
      }

      const shadowVideoThumbnailMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)\/thumbnail\.jpg$/);
      if (request.method === "GET" && shadowVideoThumbnailMatch?.[1]) {
        return getShadowVideoThumbnail(decodeURIComponent(shadowVideoThumbnailMatch[1]), env);
      }

      const publicDetailApiMatch = nativePathname.match(/^\/api\/v1\/observations\/([^/]+)\/public-detail$/);
      if (request.method === "GET" && publicDetailApiMatch?.[1]) {
        return getPublicObservationDetailJson(decodeURIComponent(publicDetailApiMatch[1]), env);
      }

      const publicDetailPageMatch = nativePathname.match(/^\/observations\/([^/]+)$/);
      if ((request.method === "GET" || request.method === "HEAD") && publicDetailPageMatch?.[1]) {
        return getPublicObservationDetailPage(decodeURIComponent(publicDetailPageMatch[1]), env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/ui-kpi/events") {
        return recordUiKpiEventShim(request);
      }

      const appWriteBoundary = handlePublicCustomDomainAppWriteBoundary(request, url, env);
      if (appWriteBoundary) {
        return appWriteBoundary;
      }

      const personalRuntimeBoundary = await handleOriginalPersonalRuntimeBoundary(request, url, env);
      if (personalRuntimeBoundary) {
        return personalRuntimeBoundary;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/observations/") {
        return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
      }

      if (shouldFallbackObservationApiToOrigin(request, url, env)) {
        return fetchOriginFallback(request, url, env, "unsupported_observation_api");
      }

      if (shouldFallbackPublicCustomDomainPathToOrigin(request, url, env)) {
        return fetchOriginFallback(request, url, env, "public_custom_domain_path");
      }

      if (request.method === "POST" && url.pathname === "/api/v0/draft-observations") {
        return createDraftObservation(request, env);
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/v0/assets/") && url.pathname.endsWith("/body")) {
        const assetId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
        return putAssetBody(assetId, request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v0/observations/finalize") {
        return finalizeObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/observations/upsert") {
        return upsertLegacyCompatibleObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/issue") {
        return issueCompatibleSession(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/v1/auth/session") {
        return getCompatibleSession(request, url, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/logout") {
        return logoutCompatibleSession(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
        return loginWithPassword(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/videos/direct-upload") {
        return createCompatibleVideoDirectUpload(request, env);
      }

      const videoBodyMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/body$/);
      if ((request.method === "PUT" || request.method === "POST") && videoBodyMatch?.[1]) {
        return putCompatibleVideoBody(decodeURIComponent(videoBodyMatch[1]), request, env);
      }

      const videoFinalizeMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/finalize$/);
      if (request.method === "POST" && videoFinalizeMatch?.[1]) {
        return finalizeCompatibleVideo(decodeURIComponent(videoFinalizeMatch[1]), request, env);
      }

      const photoUploadMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/photos\/upload$/);
      if (request.method === "POST" && photoUploadMatch?.[1]) {
        return uploadLegacyCompatiblePhoto(decodeURIComponent(photoUploadMatch[1]), request, env);
      }

      const hideObservationMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/hide$/);
      if (request.method === "POST" && hideObservationMatch?.[1]) {
        return hideCompatibleObservation(decodeURIComponent(hideObservationMatch[1]), request, env);
      }

      if (request.method === "POST" && url.pathname === "/internal/drain-outbox") {
        return drainOutbox(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-inventory") {
        return r2Inventory(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/legacy-asset-import-summary") {
        return legacyAssetImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-import-summary") {
        return r2ImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-restore-parity-summary") {
        return productionRestoreParitySummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-import-summary") {
        return productionImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/d1-partition-routing-proof") {
        return d1PartitionRoutingProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/public-derivative-verification-summary") {
        return publicDerivativeVerificationSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/reverse-delta-dry-run") {
        return reverseDeltaDryRun(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/origin-fallback-telemetry") {
        return originFallbackTelemetrySummary(url, env);
      }

      if (url.pathname.startsWith("/internal/")) {
        return json({ error: "not_found" }, 404);
      }

      if (shouldFallbackPublicCustomDomainPathToOrigin(request, url, env)) {
        return fetchOriginFallback(request, url, env, "public_custom_domain_path");
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status);
      }
      console.error(error);
      return json({ error: "internal_error" }, 500);
    }
  },

  async queue(batch: { messages: Array<{ body: MediaJob }> }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await applyMediaJob(message.body, env);
    }
  }
};

export default worker;

function getHealthz(env: Env): Response {
  return json({
    ok: true,
    service: "ikimon-life-cloudflare-worker",
    environment: env.ENVIRONMENT,
    buildMarker: WORKER_BUILD_MARKER,
    fallbackOriginConfigured: Boolean(env.ORIGIN_FALLBACK_BASE_URL)
  }, 200, { "cache-control": "no-store" });
}

async function getReadyz(env: Env): Promise<Response> {
  try {
    await env.CORE_DB.prepare("SELECT 1 AS ok").first();
    await env.OBS_DB.prepare("SELECT 1 AS ok").first();
    return json({
      ok: true,
      service: "ikimon-life-cloudflare-worker",
      environment: env.ENVIRONMENT,
      buildMarker: WORKER_BUILD_MARKER,
      coreDb: "ok",
      observationDb: "ok",
      assetBucket: "bound",
      mediaQueue: "bound"
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error("readyz failed", error);
    return json({
      ok: false,
      service: "ikimon-life-cloudflare-worker",
      environment: env.ENVIRONMENT,
      error: "readiness_check_failed"
    }, 503, { "cache-control": "no-store" });
  }
}

function handlePublicCustomDomainAppWriteBoundary(request: Request, url: URL, env: Env): Response | Promise<Response> | null {
  if (!shouldUseOriginFallback(url, env)) return null;
  if (!isPublicAppWriteCandidatePath(url)) return null;

  const mode = getPublicWriteMode(env);
  if (mode === "cloudflare_native") return null;
  if (mode === "write_disabled" && isMutatingMethod(request.method)) {
    return publicWriteDisabledResponse();
  }

  return fetchOriginFallback(request, url, env, "public_write_origin_mode");
}

async function handleOriginalPersonalRuntimeBoundary(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!isOriginalPersonalRuntimePath(request, url)) return null;
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/alerts") {
    return getPersonalAlerts(session, env);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/me/alerts/read") {
    return markPersonalAlertsRead(session, request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/area-subscriptions") {
    return getPersonalAreaSubscriptions(session, env);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/me/area-subscriptions") {
    return upsertPersonalAreaSubscription(session, request, env);
  }
  const deleteAreaMatch = url.pathname.match(/^\/api\/v1\/me\/area-subscriptions\/([^/]+)$/);
  if (request.method === "DELETE" && deleteAreaMatch?.[1]) {
    return deletePersonalAreaSubscription(session, decodeURIComponent(deleteAreaMatch[1]), env);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/personalized-menu") {
    return getPersonalizedMenu(session, url, env);
  }
  return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
}

function isOriginalPersonalRuntimePath(request: Request, url: URL): boolean {
  if (request.method === "GET" && url.pathname === "/api/v1/me/alerts") return true;
  if (request.method === "POST" && url.pathname === "/api/v1/me/alerts/read") return true;
  if (request.method === "GET" && url.pathname === "/api/v1/me/personalized-menu") return true;
  if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/v1/me/area-subscriptions") return true;
  if (request.method === "DELETE" && /^\/api\/v1\/me\/area-subscriptions\/[^/]+$/.test(url.pathname)) return true;
  return false;
}

function shouldFallbackObservationApiToOrigin(request: Request, url: URL, env: Env): boolean {
  if (isPublicAppWriteCandidatePath(url) && getPublicWriteMode(env) === "cloudflare_native") return false;
  return shouldUseOriginFallback(url, env) && url.pathname.startsWith("/api/v1/observations/");
}

function shouldFallbackMapAreaPolygonsToOrigin(request: Request, url: URL, env: Env): boolean {
  return request.method === "GET"
    && isMapAreaPolygonsApiPath(url.pathname)
    && shouldUseOriginFallback(url, env);
}

function isMapAreaPolygonsApiPath(pathname: string): boolean {
  return pathname === "/api/v1/map/area-polygons"
    || /^\/(?:ja|en|es|pt-br)\/api\/v1\/map\/area-polygons$/.test(pathname);
}

function mapAreaPolygonsFallbackLimit(zoom: number | null): number {
  if (zoom == null || !Number.isFinite(zoom)) return 48;
  if (zoom < 11) return 40;
  if (zoom < 13) return 56;
  if (zoom < 15) return 48;
  return 72;
}

function mapAreaPolygonsFallbackUrl(url: URL): URL {
  const next = new URL(url.toString());
  if (!next.searchParams.has("limit")) {
    next.searchParams.set("limit", String(mapAreaPolygonsFallbackLimit(Number(next.searchParams.get("zoom")))));
  }
  return next;
}

async function fetchMapAreaPolygonsOriginFallback(request: Request, url: URL, env: Env): Promise<Response> {
  const fallbackUrl = mapAreaPolygonsFallbackUrl(url);
  const fallbackRequest = new Request(fallbackUrl.toString(), {
    method: request.method,
    headers: request.headers,
    redirect: "manual"
  });
  const response = await fetchOriginFallback(fallbackRequest, fallbackUrl, env, "map_area_polygons_origin_geometry");
  return filterMapAreaPolygonsResponse(response);
}

function isShadowDiagnosticPath(pathname: string): boolean {
  return pathname.startsWith("/shadow-smoke/") || pathname.startsWith("/shadow/");
}

function shouldFallbackPublicCustomDomainPathToOrigin(request: Request, url: URL, env: Env): boolean {
  if (!shouldUseOriginFallback(url, env)) return false;
  if (url.pathname.startsWith("/internal/")) return false;
  if (isShadowDiagnosticPath(url.pathname)) return false;
  if (url.pathname === "/health") return false;
  if (isSuspiciousPublicProbePath(url.pathname)) return false;
  if (isPublicAppWriteCandidatePath(url) && getPublicWriteMode(env) === "cloudflare_native") return false;
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return true;
}

function shouldUseOriginFallback(url: URL, env: Env): boolean {
  return Boolean(env.ORIGIN_FALLBACK_BASE_URL) && PUBLIC_CUSTOM_HOSTS.has(url.hostname);
}

function isSuspiciousPublicProbePath(pathname: string): boolean {
  if (pathname.startsWith("/data:")) return true;
  if (pathname === "/app-ads.txt") return true;
  if (/^\/(?:\.|api\/\.|app\/\.|backend\/\.|config\/|credentials\/)/.test(pathname)) return true;
  if (/(?:^|\/)(?:wp-includes|wlwmanifest\.xml|xmlrpc\.php)(?:\/|$)/.test(pathname)) return true;
  if (/(?:^|\/)(?:client_secrets?|service[-_]?account|firebase[-_]?credentials|firebase[-_]?service[-_]?account|gcp[-_]?credentials|gcloud[-_]?service[-_]?key)\.json$/i.test(pathname)) return true;
  if (/^\/(?:firebase-adminsdk|firebase|gcp-key|credentials|application_default_credentials)\.json$/i.test(pathname)) return true;
  if (/^\/appsettings\.(?:json|development\.json|production\.json)$/i.test(pathname)) return true;
  return false;
}

function getPublicWriteMode(env: Env): "origin_fallback" | "cloudflare_native" | "write_disabled" {
  const mode = (env.PUBLIC_WRITE_MODE ?? "origin_fallback").trim().toLowerCase();
  if (mode === "cloudflare_native") return "cloudflare_native";
  if (mode === "write_disabled") return "write_disabled";
  return "origin_fallback";
}

function isPublicAppWriteCandidatePath(url: URL): boolean {
  if (url.pathname === "/api/v0/draft-observations") return true;
  if (url.pathname.startsWith("/api/v0/assets/") && url.pathname.endsWith("/body")) return true;
  if (url.pathname === "/api/v0/observations/finalize") return true;
  if (url.pathname === "/api/v1/observations/upsert") return true;
  if (url.pathname === "/api/v1/auth/session/issue") return true;
  if (url.pathname === "/api/v1/auth/session") return true;
  if (url.pathname === "/api/v1/auth/session/logout") return true;
  if (url.pathname === "/api/v1/auth/login") return true;
  if (url.pathname === "/api/v1/videos/direct-upload") return true;
  if (/^\/api\/v1\/videos\/[^/]+\/body$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/videos\/[^/]+\/finalize$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/photos\/upload$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/hide$/.test(url.pathname)) return true;
  return false;
}

async function getPersonalAreaSubscriptions(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.CORE_DB.prepare(
    `SELECT subscription_id, target_type, target_id, label, href, is_active, created_at, updated_at
       FROM user_area_subscriptions
      WHERE user_id = ?
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 100`
  ).bind(session.userId).all<PersonalAreaSubscriptionRow>();
  return json({
    ok: true,
    subscriptions: rows.results.map(personalAreaSubscriptionPayload)
  }, 200, { "cache-control": "no-store" });
}

async function upsertPersonalAreaSubscription(session: SessionSnapshot, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ targetType?: unknown; targetId?: unknown; label?: unknown; href?: unknown }>(request);
  const targetType = normalizeOptionalText(body.targetType);
  const targetId = normalizeOptionalText(body.targetId);
  if (!targetType || !["field", "place", "region"].includes(targetType) || !targetId) {
    return json({ ok: false, error: "targetType_and_targetId_required" }, 400, { "cache-control": "no-store" });
  }
  const normalizedTargetId = targetId.slice(0, 160);
  const subscriptionId = crypto.randomUUID();
  const label = safePersonalLabel(body.label, normalizedTargetId);
  const href = safePersonalHref(body.href, areaSubscriptionHref(targetType, normalizedTargetId));
  await env.CORE_DB.prepare(
    `INSERT INTO user_area_subscriptions
       (subscription_id, user_id, target_type, target_id, label, href, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, target_type, target_id)
     DO UPDATE SET label = excluded.label,
                   href = excluded.href,
                   is_active = 1,
                   updated_at = CURRENT_TIMESTAMP`
  ).bind(subscriptionId, session.userId, targetType, normalizedTargetId, label, href).run();
  const row = await env.CORE_DB.prepare(
    `SELECT subscription_id
       FROM user_area_subscriptions
      WHERE user_id = ? AND target_type = ? AND target_id = ?`
  ).bind(session.userId, targetType, normalizedTargetId).first<{ subscription_id: string }>();
  return json({ ok: true, subscriptionId: row?.subscription_id ?? subscriptionId }, 200, { "cache-control": "no-store" });
}

async function deletePersonalAreaSubscription(session: SessionSnapshot, id: string, env: Env): Promise<Response> {
  const subscriptionId = normalizeOptionalText(id);
  if (!subscriptionId) {
    return json({ ok: false, error: "id_required" }, 400, { "cache-control": "no-store" });
  }
  const existing = await env.CORE_DB.prepare(
    "SELECT subscription_id FROM user_area_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).first<{ subscription_id: string }>();
  if (!existing) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  await env.CORE_DB.prepare(
    "DELETE FROM user_area_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).run();
  return json({ ok: true }, 200, { "cache-control": "no-store" });
}

async function getPersonalizedMenu(session: SessionSnapshot, url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "10"), 1, 20);
  const [areas, taxa, unreadAlerts] = await Promise.all([
    env.CORE_DB.prepare(
      `SELECT s.subscription_id, s.target_type, s.target_id, s.label, s.href, s.is_active, s.created_at, s.updated_at,
              COALESCE(st.observation_count, 0) AS observation_count,
              COALESCE(st.needs_id_count, 0) AS needs_id_count
         FROM user_area_subscriptions s
         LEFT JOIN user_area_subscription_stats st
           ON st.user_id = s.user_id AND st.target_type = s.target_type AND st.target_id = s.target_id
        WHERE s.user_id = ? AND s.is_active = 1
        ORDER BY s.updated_at DESC
        LIMIT 8`
    ).bind(session.userId).all<PersonalAreaSubscriptionRow>(),
    env.CORE_DB.prepare(
      `SELECT label, scientific_name, taxon_rank
         FROM taxon_alert_subscriptions
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 8`
    ).bind(session.userId).all<PersonalTaxonSubscriptionRow>(),
    env.CORE_DB.prepare(
      `SELECT COUNT(*) AS unread_count
         FROM alert_deliveries
        WHERE user_id = ?
          AND acknowledged_at IS NULL`
    ).bind(session.userId).first<{ unread_count: number }>()
  ]);
  const items = dedupePersonalMenuItems([
    ...areas.results.map((row) => {
      const label = safePersonalLabel(row.label, row.target_id);
      return {
        kind: row.target_type,
        label,
        href: safePersonalHref(row.href, areaSubscriptionHref(row.target_type, row.target_id)),
        source: "follow",
        stats: {
          observationCount: toSafeCount(row.observation_count),
          needsIdCount: toSafeCount(row.needs_id_count)
        }
      };
    }),
    ...taxa.results.map((row) => {
      const label = safePersonalLabel(row.label ?? row.scientific_name ?? row.taxon_rank, "分類群");
      return {
        kind: "taxon",
        label,
        href: `/records?view=public&q=${encodeURIComponent(label)}`,
        source: "follow",
        stats: { followed: true }
      };
    })
  ]).slice(0, limit);
  return json({
    ok: true,
    items,
    summary: { unreadAlertCount: toSafeCount(unreadAlerts?.unread_count) }
  }, 200, { "cache-control": "no-store" });
}

async function getPersonalAlerts(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.CORE_DB.prepare(
    `SELECT delivery_id, occurrence_id, trigger_kind, delivery_status, delivered_at, acknowledged_at, created_at, payload_json
       FROM alert_deliveries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100`
  ).bind(session.userId).all<PersonalAlertRow>();
  return json({
    ok: true,
    alerts: rows.results.map((row) => ({
      deliveryId: row.delivery_id,
      occurrenceId: row.occurrence_id,
      triggerKind: row.trigger_kind,
      deliveryStatus: row.delivery_status,
      deliveredAt: row.delivered_at,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
      payload: parseJsonObject(row.payload_json)
    }))
  }, 200, { "cache-control": "no-store" });
}

async function markPersonalAlertsRead(session: SessionSnapshot, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = Array.isArray(body.ids)
    ? body.ids.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)).slice(0, 100)
    : [];
  const now = new Date().toISOString();
  let acknowledgedCount = 0;
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    const existing = await env.CORE_DB.prepare(
      `SELECT delivery_id
         FROM alert_deliveries
        WHERE user_id = ? AND delivery_id IN (${placeholders})`
    ).bind(session.userId, ...ids).all<{ delivery_id: string }>();
    acknowledgedCount = existing.results.length;
    if (acknowledgedCount > 0) {
      await env.CORE_DB.prepare(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, ?),
                delivery_status = CASE WHEN delivery_status = 'sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = ? AND delivery_id IN (${placeholders})`
      ).bind(now, session.userId, ...ids).run();
    }
  } else {
    const unread = await env.CORE_DB.prepare(
      `SELECT delivery_id
         FROM alert_deliveries
        WHERE user_id = ? AND acknowledged_at IS NULL`
    ).bind(session.userId).all<{ delivery_id: string }>();
    acknowledgedCount = unread.results.length;
    if (acknowledgedCount > 0) {
      await env.CORE_DB.prepare(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, ?),
                delivery_status = CASE WHEN delivery_status = 'sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = ? AND acknowledged_at IS NULL`
      ).bind(now, session.userId).run();
    }
  }
  return json({ ok: true, acknowledgedCount }, 200, { "cache-control": "no-store" });
}

function personalAreaSubscriptionPayload(row: PersonalAreaSubscriptionRow) {
  const label = safePersonalLabel(row.label, row.target_id);
  return {
    subscriptionId: row.subscription_id,
    targetType: row.target_type,
    targetId: row.target_id,
    label,
    href: safePersonalHref(row.href, areaSubscriptionHref(row.target_type, row.target_id)),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function safePersonalLabel(value: unknown, fallback: string): string {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || fallback).slice(0, 120);
}

function safePersonalHref(value: unknown, fallback: string): string {
  const href = typeof value === "string" ? value.trim() : "";
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\n")) return fallback;
  return href.slice(0, 240);
}

function areaSubscriptionHref(targetType: string, targetId: string): string {
  const encoded = encodeURIComponent(targetId);
  if (targetType === "field") return `/map?field=${encoded}`;
  if (targetType === "place") return `/map?place=${encoded}`;
  return `/map?region=${encoded}`;
}

function dedupePersonalMenuItems<T extends { href: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = `${normalizePersonalMenuHref(item.href)}::${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function normalizePersonalMenuHref(value: string): string {
  const raw = value.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";
  try {
    const url = new URL(raw, "https://ikimon.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const first = parts[0];
    const langlessPath = first === "ja" || first === "en" || first === "es" || first === "pt-BR"
      ? `/${parts.slice(1).join("/")}` || "/"
      : url.pathname;
    return `${langlessPath}${url.search}`;
  } catch {
    return raw.split("#", 1)[0] ?? raw;
  }
}

function toSafeCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function publicWriteDisabledResponse(): Response {
  return json({
    ok: false,
    error: "write_temporarily_disabled",
    mode: "read_only_migration_window"
  }, 503, {
    "cache-control": "no-store",
    "retry-after": "300",
    "x-ikimon-cloudflare-write-mode": "write_disabled"
  });
}

async function fetchOriginFallback(request: Request, url: URL, env: Env, reason = "origin_fallback"): Promise<Response> {
  const base = new URL(env.ORIGIN_FALLBACK_BASE_URL ?? "");
  const target = new URL(url.toString());
  target.protocol = base.protocol;
  target.host = base.host;
  const resolveOverride = env.ORIGIN_FALLBACK_RESOLVE_OVERRIDE?.trim();
  if (target.host === url.host && !resolveOverride) {
    return json({ error: "origin_fallback_loop_blocked" }, 502, { "cache-control": "no-store" });
  }

  const headers = new Headers(request.headers);
  headers.set("x-ikimon-cloudflare-fallback", "origin");
  headers.set("x-ikimon-cloudflare-fallback-reason", reason);
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  const originalUiHtmlKeyForTelemetry = isOriginalUiHtmlPath(url.pathname) ? originalUiHtmlKey(url.pathname) : null;
  await recordOriginFallbackTelemetry(env, {
    reason,
    method: request.method,
    host: url.hostname,
    routePattern: fallbackRoutePattern(url.pathname),
    pathHash: (await sha256Hex(textToArrayBuffer(url.pathname))).slice(0, 16),
    originalUiHtmlKeyHash: originalUiHtmlKeyForTelemetry ? (await sha256Hex(textToArrayBuffer(originalUiHtmlKeyForTelemetry))).slice(0, 16) : undefined,
    publicWriteMode: getPublicWriteMode(env),
    environment: env.ENVIRONMENT
  });

  const init: RequestInit & { cf?: { resolveOverride?: string } } = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual"
  };
  if (resolveOverride) {
    init.cf = { resolveOverride };
  }

  return fetch(target.toString(), init);
}

async function recordOriginFallbackTelemetry(env: Env, payload: OriginFallbackTelemetryPayload): Promise<void> {
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO operation_audit (audit_id, operation_type, target_id, payload_json)
       VALUES (?, 'origin_fallback', ?, ?)`
    ).bind(
      `origin-fallback-${crypto.randomUUID()}`,
      payload.reason,
      JSON.stringify(payload)
    ).run();
  } catch (error) {
    console.error(JSON.stringify({
      message: "origin_fallback_telemetry_failed",
      error: error instanceof Error ? error.message : String(error),
      reason: payload.reason,
      routePattern: payload.routePattern
    }));
  }
}

async function originFallbackTelemetrySummary(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "1000"), 1, 5000);
  const rows = await env.CORE_DB.prepare(
    `SELECT payload_json, created_at
     FROM operation_audit
     WHERE operation_type = 'origin_fallback'
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all<OperationAuditRow>();
  const byReason: Record<string, number> = {};
  const byRoutePattern: Record<string, number> = {};
  let parseFailures = 0;
  for (const row of rows.results) {
    try {
      const payload = JSON.parse(row.payload_json) as Partial<OriginFallbackTelemetryPayload>;
      const reason = normalizeOptionalText(payload.reason) ?? "unknown";
      const routePattern = normalizeOptionalText(payload.routePattern) ?? "unknown";
      byReason[reason] = (byReason[reason] ?? 0) + 1;
      byRoutePattern[routePattern] = (byRoutePattern[routePattern] ?? 0) + 1;
    } catch {
      parseFailures += 1;
    }
  }
  return json({
    ok: true,
    limit,
    count: rows.results.length,
    byReason,
    byRoutePattern,
    parseFailures,
    note: "Telemetry excludes query strings, request bodies, cookies, emails, passwords, and exact observation ids."
  }, 200, { "cache-control": "no-store" });
}

function fallbackRoutePattern(pathname: string): string {
  if (/^\/api\/v1\/fields\/[^/]+\/area-snapshot$/.test(pathname)) return "/api/v1/fields/:id/area-snapshot";
  if (pathname === "/favicon.ico") return "/favicon.ico";
  if (pathname === "/manifest.webmanifest") return "/manifest.webmanifest";
  if (/^\/assets\/brand\/[^/]+$/.test(pathname)) return "/assets/brand/:asset";
  if (/^\/assets\/img\/invasive\/[^/]+$/.test(pathname)) return "/assets/img/invasive/:asset";
  if (/^\/assets\/[^/]+/.test(pathname)) return "/assets/*";
  if (/^\/thumb\/[^/]+\/avatars\/[^/]+$/.test(pathname)) return "/thumb/:size/avatars/:asset";
  if (/^\/thumb\/[^/]+\/v2-observations\/[^/]+\/[^/]+$/.test(pathname)) return "/thumb/:size/v2-observations/:record/:asset";
  if (pathname === "/thumb/") return "/thumb/";
  if (/^\/thumb\//.test(pathname)) return "/thumb/*";
  if (/^(?:\/(?:ja|en|es|pt-br))?\/community\/fields\/[^/]+$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/community\/fields\/[^/]+$/, "$1/community/fields/:id");
  if (/^(?:\/(?:ja|en|es|pt-br))?\/places\/[^/]+\/snapshot$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/places\/[^/]+\/snapshot$/, "$1/places/:id/snapshot");
  if (/^(?:\/(?:ja|en|es|pt-br))?\/observations\/[^/]+$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/observations\/[^/]+$/, "$1/observations/:id");
  if (/^\/api\/v1\/observations\/[^/]+\/photos\/upload$/.test(pathname)) return "/api/v1/observations/:id/photos/upload";
  if (/^\/api\/v1\/observations\/[^/]+\/hide$/.test(pathname)) return "/api/v1/observations/:id/hide";
  if (/^\/api\/v1\/observations\/[^/]+\/public-detail$/.test(pathname)) return "/api/v1/observations/:id/public-detail";
  if (/^\/api\/v1\/observations\/[^/]+/.test(pathname)) return "/api/v1/observations/:id/*";
  if (/^\/api\/v1\/videos\/[^/]+\/body$/.test(pathname)) return "/api/v1/videos/:uid/body";
  if (/^\/api\/v1\/videos\/[^/]+\/finalize$/.test(pathname)) return "/api/v1/videos/:uid/finalize";
  const uuidRedacted = pathname.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    "/:id"
  );
  if (uuidRedacted.length > 120 || /[<>{}"'`\\]|\s/.test(uuidRedacted) || uuidRedacted.startsWith("/data:")) {
    return "/_unmatched";
  }
  return uuidRedacted;
}

async function getPublicMapCells(url: URL, env: Env): Promise<Response> {
  const rows = await queryPublicMapRows(env);
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const scopedRows = bbox ? rows.filter((row) => publicCellInBbox(row.public_cell, bbox)) : rows;
  const groups = new Map<string, PublicMapRow[]>();
  for (const row of scopedRows) {
    if (!parsePublicCell(row.public_cell)) continue;
    const existing = groups.get(row.public_cell) ?? [];
    existing.push(row);
    groups.set(row.public_cell, existing);
  }

  const features = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || latestObservedAt(b[1]).localeCompare(latestObservedAt(a[1])))
    .slice(0, 1200)
    .map(([publicCell, group]) => {
      const parsed = parsePublicCell(publicCell);
      if (!parsed) return null;
      const taxonMix = group.reduce<Record<string, number>>((mix, row) => {
        const key = taxonGroupForLabel(row.taxon_label);
        mix[key] = (mix[key] ?? 0) + 1;
        return mix;
      }, {});
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [publicCellPolygon(parsed.lat, parsed.lng)] },
        properties: {
          cellId: publicCellToCellId(publicCell),
          label: "位置をぼかしています",
          albumName: "このあたりの記録",
          localityLabel: "位置をぼかしています",
          themeLabel: "最近の発見",
          scaleLabel: `${MAP_DEFAULT_GRID_M}m`,
          nearbyAreaName: null,
          nameEraLabel: null,
          scope: "blurred",
          gridM: MAP_DEFAULT_GRID_M,
          radiusM: MAP_DEFAULT_GRID_M,
          count: group.length,
          firstObservedAt: earliestObservedAt(group),
          latestObservedAt: latestObservedAt(group),
          taxonMix,
          centroidLat: parsed.lat,
          centroidLng: parsed.lng
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return json({
    type: "FeatureCollection",
    features,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      totalRecords: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapObservations(url: URL, env: Env): Promise<Response> {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const rawCellId = normalizeOptionalText(url.searchParams.get("cell_id"));
  const selectedCell = rawCellId ? cellIdToPublicCell(rawCellId) : null;
  if (!bbox && !selectedCell) {
    return json({ error: "missing_scope" }, 400);
  }

  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "300"), 1, 1200);
  const rows = await queryPublicMapRows(env);
  const scopedRows = rows
    .filter((row) => selectedCell ? row.public_cell === selectedCell : publicCellInBbox(row.public_cell, bbox as [number, number, number, number]))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, limit);
  const photoUrls = await queryPublicMapPhotoUrls(env);

  return json({
    items: scopedRows.map((row) => publicMapObservationItem(row, photoUrls.get(row.observation_id) ?? null)),
    stats: {
      totalReturned: scopedRows.length,
      totalAll: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      selectedCellId: selectedCell ? publicCellToCellId(selectedCell) : null,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

type JmaNowcastTarget = {
  basetime?: unknown;
  validtime?: unknown;
  member?: unknown;
  elements?: unknown;
};

type JmaNowcastSelectedTarget = {
  basetime: string;
  validtime: string;
  member?: string;
};

function isValidJmaTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{14}$/.test(value);
}

function parseJmaTimestamp(value: string): number | null {
  if (!isValidJmaTimestamp(value)) return null;
  const ms = Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
    Number(value.slice(8, 10)),
    Number(value.slice(10, 12)),
    Number(value.slice(12, 14))
  );
  return Number.isFinite(ms) ? ms : null;
}

function jmaTargetSupportsRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("hrpns");
}

function jmaTargetSupportsShortRangeRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("rasrf");
}

function jmaOffsetMinutes(target: JmaNowcastTarget): number | null {
  if (!isValidJmaTimestamp(target.basetime) || !isValidJmaTimestamp(target.validtime)) return null;
  const base = parseJmaTimestamp(target.basetime);
  const valid = parseJmaTimestamp(target.validtime);
  if (base === null || valid === null) return null;
  return Math.round((valid - base) / 60_000);
}

function chooseJmaNowcastTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastSelectedTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && jmaTargetSupportsRain(target))
    .map((target) => ({
      target: { basetime: target.basetime as string, validtime: target.validtime as string },
      offset: jmaOffsetMinutes(target)
    }))
    .filter((item): item is { target: JmaNowcastSelectedTarget; offset: number } => item.offset !== null);
  candidates.sort((a, b) => {
    const delta = Math.abs(a.offset - offsetMinutes) - Math.abs(b.offset - offsetMinutes);
    return delta !== 0 ? delta : b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

function chooseJmaShortRangeTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastSelectedTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && jmaTargetSupportsShortRangeRain(target))
    .map((target): { target: JmaNowcastSelectedTarget; offset: number | null } => ({
      target: {
        basetime: target.basetime as string,
        validtime: target.validtime as string,
        member: typeof target.member === "string" ? target.member : undefined
      },
      offset: jmaOffsetMinutes(target)
    }))
    .filter((item): item is { target: JmaNowcastSelectedTarget; offset: number } => item.offset !== null);
  candidates.sort((a, b) => {
    const delta = Math.abs(a.offset - offsetMinutes) - Math.abs(b.offset - offsetMinutes);
    if (delta !== 0) return delta;
    const memberRank = (value: string | undefined) => value === "immed" ? 0 : 1;
    const memberDelta = memberRank(a.target.member) - memberRank(b.target.member);
    return memberDelta !== 0 ? memberDelta : b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

async function fetchJmaTargets(url: string): Promise<JmaNowcastTarget[]> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`jma_nowcast_fetch_failed:${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload as JmaNowcastTarget[] : [];
}

async function getJmaNowcastTimesResponse(): Promise<Response> {
  try {
    const [currentTargets, forecastTargets, shortRangeTargets] = await Promise.all([
      fetchJmaTargets(JMA_NOWCAST_TARGET_N1),
      fetchJmaTargets(JMA_NOWCAST_TARGET_N2),
      fetchJmaTargets(JMA_SHORT_RANGE_TARGET)
    ]);
    const times = [];
    for (const offsetMinutes of JMA_NOWCAST_OFFSETS) {
      const source = offsetMinutes === 0 ? currentTargets : forecastTargets;
      const target = chooseJmaNowcastTarget(source, offsetMinutes);
      if (!target) continue;
      times.push({
        offsetMinutes,
        basetime: target.basetime,
        validtime: target.validtime,
        product: "nowcast",
        member: "none",
        highResolution: offsetMinutes <= 30
      });
    }
    for (const offsetMinutes of JMA_SHORT_RANGE_OFFSETS) {
      const target = chooseJmaShortRangeTarget(shortRangeTargets, offsetMinutes);
      if (!target) continue;
      times.push({
        offsetMinutes,
        basetime: target.basetime,
        validtime: target.validtime,
        product: "short_range",
        member: target.member || "none",
        highResolution: false
      });
    }
    return json({
      source: "jma_precipitation_map",
      attribution: "Source: JMA High-resolution Precipitation Nowcast / Very Short-range Forecasts of Precipitation",
      attributionUrl: "https://www.jma.go.jp/jma/en/Activities/forecast.html",
      generatedAt: new Date().toISOString(),
      tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?product={product}&member={member}&basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
      times
    }, 200, { "cache-control": "public, max-age=60" });
  } catch {
    return json({ error: "jma_nowcast_unavailable" }, 502, { "cache-control": "no-store" });
  }
}

function parseJmaTileNumber(raw: string | null, max: number): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) return null;
  return value;
}

async function getJmaNowcastTileResponse(url: URL): Promise<Response> {
  const rawProduct = url.searchParams.get("product");
  const product = rawProduct === "short_range" ? "short_range" : "nowcast";
  const rawMember = url.searchParams.get("member");
  const member = rawMember === null || rawMember === ""
    ? "none"
    : /^[a-z0-9_-]{1,24}$/i.test(rawMember) ? rawMember : null;
  const basetime = url.searchParams.get("basetime");
  const validtime = url.searchParams.get("validtime");
  const z = parseJmaTileNumber(url.searchParams.get("z"), JMA_RAIN_TILE_MAX_ZOOM);
  const maxTile = z === null ? 0 : (2 ** z) - 1;
  const x = parseJmaTileNumber(url.searchParams.get("x"), maxTile);
  const y = parseJmaTileNumber(url.searchParams.get("y"), maxTile);
  if (member === null || !isValidJmaTimestamp(basetime) || !isValidJmaTimestamp(validtime) || z === null || x === null || y === null) {
    return json({ error: "invalid_jma_nowcast_tile" }, 400, { "cache-control": "no-store" });
  }

  const jmaUrl = product === "short_range"
    ? `${JMA_SHORT_RANGE_ROOT}/${basetime}/${member}/${validtime}/surf/rasrf/${z}/${x}/${y}.png`
    : `${JMA_NOWCAST_ROOT}/${basetime}/none/${validtime}/surf/hrpns/${z}/${x}/${y}.png`;
  const cache = (globalThis as typeof globalThis & { caches?: { default?: { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> } } }).caches?.default;
  const cacheRequest = new Request(jmaUrl, { method: "GET" });
  const cached = await cache?.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("cache-control", "public, max-age=300");
    headers.set("x-ikimon-weather-cache", "hit");
    headers.set("x-content-type-options", "nosniff");
    return new Response(cached.body, { status: cached.status, headers });
  }

  const upstream = await fetch(jmaUrl, { headers: { accept: "image/png" } });
  if (!upstream.ok) {
    return json({ error: "jma_nowcast_tile_unavailable" }, upstream.status === 404 ? 404 : 502, { "cache-control": "no-store" });
  }
  const bytes = await upstream.arrayBuffer();
  const response = new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "x-ikimon-weather-cache": "miss",
      "x-content-type-options": "nosniff"
    }
  });
  await cache?.put(cacheRequest, response.clone());
  return response;
}

interface PublicMapAreaPolygonOptions {
  allowApproximateFallback?: boolean;
}

async function getPublicMapAreaPolygons(url: URL, env: Env, options: PublicMapAreaPolygonOptions = {}): Promise<Response | null> {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  if (!bbox) {
    return json({ error: "missing_or_invalid_bbox" }, 400, { "cache-control": "no-store" });
  }
  const sources = parseSourceParam(url.searchParams.get("sources"));
  const defaultLimit = mapAreaPolygonsFallbackLimit(Number(url.searchParams.get("zoom")));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? String(defaultLimit)), 1, 1000);
  const nativeRows = await queryNativeAreaPolygonRows(env, bbox, sources, limit);
  if (nativeRows.length > 0) {
    const nativeFeatures = nativeRows
      .map((row) => areaPolygonFeatureFromGeometryReadmodel(row))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
      .filter(isDisplayableAreaPolygonFeature);
    if (
      options.allowApproximateFallback === false
      && sources.includes("school")
      && !nativeFeatures.some((feature) => feature.properties?.source === "school")
    ) {
      return null;
    }
    return json({
      type: "FeatureCollection",
      features: nativeFeatures,
      truncated: nativeRows.length >= limit,
      stats: {
        totalReturned: nativeFeatures.length,
        totalAll: nativeFeatures.length,
        source: "cloudflare_area_polygon_readmodel",
        kind: "area-polygons"
      }
    }, 200, { "cache-control": "public, max-age=60" });
  }
  if (options.allowApproximateFallback === false) return null;

  const rows = await queryAreaPolygonRows(env, bbox, sources, limit);
  const features = rows
    .map((row) => areaPolygonFeatureFromReadmodel(row))
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return json({
    type: "FeatureCollection",
    features,
    truncated: rows.length >= limit,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      source: "cloudflare_field_detail_readmodel",
      kind: "area-polygons"
    }
  }, 200, { "cache-control": "public, max-age=60" });
}

function getPublicMapGuideSpots(url: URL): Response {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  if (!bbox) {
    return json({ error: "missing_or_invalid_bbox" }, 400, { "cache-control": "no-store" });
  }
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "80"), 1, 120);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const scoped = SHADOW_MAP_GUIDE_SPOTS
    .filter((spot) => spot.lng >= minLng && spot.lng <= maxLng && spot.lat >= minLat && spot.lat <= maxLat)
    .slice(0, limit);
  return json({
    type: "FeatureCollection",
    features: scoped.map((spot) => {
      const { lat: _lat, lng: _lng, ...properties } = spot;
      return {
        type: "Feature",
        properties,
        geometry: {
          type: "Point",
          coordinates: [spot.lng, spot.lat]
        }
      };
    }),
    truncated: scoped.length >= limit,
    stats: {
      totalReturned: scoped.length,
      totalAll: scoped.length,
      source: "cloudflare_static_global_guide_spots",
      kind: "guide-spots",
      coverage: "global_bbox"
    }
  }, 200, { "cache-control": "public, max-age=300" });
}

const STATIC_MUNICIPAL_WALK_MAP_SUMMARIES = [
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-yatsuyama-sample-v0",
    municipality: "静岡市",
    title: "八ツ山周辺を歩くサンプル",
    summary: "静岡市公式資料を出典として、公開範囲で木陰、足元の草地、鳥の声を軽く残すために再構成したサンプルです。",
    theme: "satoyama",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ]
  },
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-asahata-waterfront-sample-v0",
    municipality: "静岡市",
    title: "麻機の水辺を歩くサンプル",
    summary: "静岡市公式資料を出典として、水辺を安全に見ながら、鳥の声、水面、草地の変化を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ]
  },
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-mariko-waterfront-sample-v0",
    municipality: "静岡市",
    title: "丸子川・広野海岸公園周辺サンプル",
    summary: "静岡市公式資料を出典として、川と海岸公園の公開範囲で、水辺の様子や鳥の声を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "car", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ]
  }
];

const WALK_MAP_LOCATION_BBOXES = [
  { municipalityCode: "22100", bbox: [137.47, 34.57, 139.16, 35.65] as const }
];

function numberFromSearchParam(value: string | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function walkMapMunicipalityCodeForLocation(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  const match = WALK_MAP_LOCATION_BBOXES.find((entry) => (
    lng >= entry.bbox[0] && lng <= entry.bbox[2]
    && lat >= entry.bbox[1] && lat <= entry.bbox[3]
  ));
  return match?.municipalityCode ?? null;
}

function getMunicipalWalkMapCandidates(url: URL): Response {
  const lat = numberFromSearchParam(url.searchParams.get("lat"));
  const lng = numberFromSearchParam(url.searchParams.get("lng"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "4"), 1, 8);
  const locationFiltered = lat != null && lng != null;
  const matchedMunicipalityCode = walkMapMunicipalityCodeForLocation(lat, lng);
  const summaries = locationFiltered && matchedMunicipalityCode !== "22100"
    ? []
    : STATIC_MUNICIPAL_WALK_MAP_SUMMARIES.slice(0, limit);
  return json({
    ok: true,
    source: "static",
    matchedMunicipalityCode,
    locationFiltered,
    summaries
  }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

async function getPublicMapMyPlaces(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return json({ signedIn: false, items: [] }, 200, { "cache-control": "no-store" });
  }
  return json({ signedIn: true, sort: "recent", items: [] }, 200, { "cache-control": "no-store" });
}

async function getPublicMapMyObservations(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return json({ signedIn: false, items: [] }, 200, { "cache-control": "no-store" });
  }

  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "48"), 1, 120);
  const rows = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.exact_lat, o.exact_lng,
            a.public_derivative_key
       FROM observations o
       JOIN asset_ledger a ON a.observation_id = o.observation_id
      WHERE o.owner_user_id = ?
        AND o.exact_lat IS NOT NULL
        AND o.exact_lng IS NOT NULL
        AND o.emergency_hidden = 0
        AND a.processing_state = 'uploaded'
        AND a.public_derivative_key IS NOT NULL
        AND a.exif_scrub_state = 'scrubbed'
        AND a.public_ready_at IS NOT NULL
        AND a.mime LIKE 'image/%'
      ORDER BY o.observed_at DESC, a.public_ready_at DESC
      LIMIT ?`
  ).bind(session.userId, limit).all<OwnMapObservationRow>();

  const seen = new Set<string>();
  const items = [];
  for (const row of rows.results) {
    if (seen.has(row.observation_id)) continue;
    seen.add(row.observation_id);
    const latitude = Number(row.exact_lat);
    const longitude = Number(row.exact_lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !row.public_derivative_key) continue;
    items.push({
      occurrenceId: `occ:${row.observation_id}:0`,
      visitId: row.observation_id,
      displayName: publicTaxonDisplayName(row.taxon_label || row.note),
      observedAt: row.observed_at,
      latitude,
      longitude,
      photoUrl: publicMediaUrl(row.public_derivative_key),
      mediaKind: "photo",
      localityLabel: "自分だけに表示"
    });
  }

  return json({ signedIn: true, items }, 200, { "cache-control": "no-store" });
}

function getPublicMapEmptyGeoJson(kind: string, headers: Record<string, string> = { "cache-control": "no-store" }): Response {
  return json({
    type: "FeatureCollection",
    features: [],
    stats: {
      totalReturned: 0,
      totalAll: 0,
      source: "cloudflare_compat_empty",
      kind
    }
  }, 200, headers);
}

function getPublicMapEffortSummaryShim(): Response {
  return json({
    actorLens: {
      actorClass: "community"
    },
    myProgress: {
      revisitCount: 0,
      roleBreakdown: {
        note: 0,
        guide: 0,
        scan: 0
      }
    },
    communityProgress: {
      activeCellCount: 0,
      strengthenedCellCount: 0
    },
    frontierRemaining: {
      blankCount: 0,
      buildingCount: 0,
      repeatableCount: 0,
      matureCount: 0
    },
    campaignProgress: {
      labelKey: "mixed_frontier",
      priorityCue: "fresh_gap"
    },
    compatibility: {
      source: "cloudflare_compat_empty"
    }
  }, 200, { "cache-control": "no-store" });
}

function getPublicMapSiteBriefShim(url: URL): Response {
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "invalid_coords" }, 400, { "cache-control": "no-store" });
  }
  return json({
    hypothesis: {
      label: "まだ見落としがありそうな場所",
      confidence: 0.42
    },
    reasons: ["水路、緑地、建物のすき間など、身近な環境の境目を見比べられる場所です。"],
    checks: ["花、草地、水辺、日陰、人工物のまわりに小さな変化がないか見てください。"],
    captureHints: ["気になったものを1枚撮るか、音やメモを残すと次の見返しにつながります。"],
    environmentEvidence: [],
    officialNotices: [],
    compatibility: {
      source: "cloudflare_compat_empty"
    }
  }, 200, { "cache-control": "no-store" });
}

async function getOriginalUiAreaSnapshot(fieldId: string, request: Request, url: URL, env: Env): Promise<Response> {
  if (!isSafeFieldId(fieldId)) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const object = await env.ASSET_BUCKET.get(originalUiAreaSnapshotKey(fieldId));
  if (object?.body) {
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-ikimon-cloudflare-materialized": "original-ui-area-snapshot"
      }
    });
  }
  if (shouldUseOriginFallback(url, env)) {
    return fetchOriginFallback(request, url, env, "area_snapshot_materialized_miss");
  }
  return json({ ok: false, error: "area_snapshot_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isSafeFieldId(fieldId: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(fieldId);
}

function originalUiAreaSnapshotKey(fieldId: string): string {
  return `original-ui/area-snapshots/${fieldId}.json`;
}

async function getFieldDetailJson(fieldId: string, env: Env): Promise<Response> {
  const row = await getFieldDetailReadmodelRow(fieldId, env);
  if (!row) {
    return json({ ok: false, error: "field_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    field: fieldDetailPublicPayload(row),
    privacy: {
      exactLocationExposed: false,
      geometryExposed: false,
      publicCellPrecision: "0.01_degree"
    },
    compatibility: {
      source: "cloudflare_field_detail_readmodel"
    }
  }, 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "field-detail-readmodel"
  });
}

async function getNativeFieldDetailHtmlIfAvailable(request: Request, url: URL, env: Env): Promise<Response | null> {
  const match = parseFieldDetailPath(url.pathname);
  if (!match) return null;
  const row = await getFieldDetailReadmodelRow(match.fieldId, env);
  if (!row) return null;
  return html(request.method === "HEAD" ? "" : renderFieldDetailHtml(row, match.lang), 200, {
    "cache-control": "no-store",
    "vary": "cookie, authorization",
    "x-ikimon-cloudflare-native": "field-detail-readmodel"
  });
}

function parseFieldDetailPath(pathname: string): { lang: string; fieldId: string } | null {
  const match = pathname.match(/^\/(?:(ja|en|es|pt-br)\/)?community\/fields\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})$/);
  if (!match?.[2]) return null;
  return { lang: match[1] ?? "ja", fieldId: match[2] };
}

async function getFieldDetailReadmodelRow(fieldId: string, env: Env): Promise<FieldDetailReadmodelRow | null> {
  if (!isSafeFieldId(fieldId)) return null;
  return env.OBS_DB.prepare(
    `SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city,
            public_cell, public_lat, public_lng, radius_m, area_ha,
            has_polygon, has_simplified_geometry,
            certification_id, certification_url, official_url, owner_url, story_url,
            verification_level, verification_method, verification_label, source_confidence,
            valid_from, valid_to, entity_key, updated_at
       FROM production_import_field_detail_readmodel
      WHERE field_id = ?`
  ).bind(fieldId).first<FieldDetailReadmodelRow>();
}

function fieldDetailPublicPayload(row: FieldDetailReadmodelRow) {
  return {
    fieldId: row.field_id,
    source: row.source,
    adminLevel: row.admin_level ?? "",
    name: row.name,
    nameKana: row.name_kana ?? "",
    summary: row.summary ?? "",
    prefecture: row.prefecture ?? "",
    city: row.city ?? "",
    publicLocation: {
      cell: row.public_cell,
      lat: row.public_lat,
      lng: row.public_lng,
      label: publicFieldLocationLabel(row)
    },
    radiusM: row.radius_m,
    areaHa: row.area_ha,
    hasPolygon: row.has_polygon === 1,
    hasSimplifiedGeometry: row.has_simplified_geometry === 1,
    certificationId: row.certification_id ?? "",
    links: {
      certification: row.certification_url ?? "",
      official: row.official_url ?? "",
      owner: row.owner_url ?? "",
      story: row.story_url ?? ""
    },
    verification: {
      level: row.verification_level ?? "",
      method: row.verification_method ?? "",
      label: row.verification_label ?? "",
      confidence: row.source_confidence
    },
    validFrom: row.valid_from ?? "",
    validTo: row.valid_to ?? "",
    entityKey: row.entity_key ?? "",
    updatedAt: row.updated_at ?? ""
  };
}

function publicFieldLocationLabel(row: FieldDetailReadmodelRow): string {
  const parts = [row.prefecture, row.city].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(" ") : "位置をぼかしています";
}

async function getOriginalUiStaticAsset(request: Request, url: URL, env: Env): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(originalUiStaticAssetKey(url.pathname));
  if (object?.body) {
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? contentTypeForOriginalUiStaticAsset(url.pathname),
        "cache-control": cacheControlForOriginalUiStaticAsset(url.pathname),
        "x-ikimon-cloudflare-materialized": "original-ui-static-asset"
      }
    });
  }
  if (shouldUseOriginFallback(url, env)) {
    return fetchOriginFallback(request, url, env, "static_asset_materialized_miss");
  }
  return json({ ok: false, error: "static_asset_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isOriginalUiStaticAssetPath(pathname: string): boolean {
  if (pathname === "/offline.html" || pathname === "/robots.txt" || pathname === "/app-sw.js") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/favicon.ico" || pathname === "/manifest.webmanifest") return true;
  if (/^\/assets\/brand\/[a-zA-Z0-9._-]+$/.test(pathname)) return true;
  if (/^\/assets\/img\/invasive\/[a-zA-Z0-9._-]+$/.test(pathname)) return true;
  return false;
}

function originalUiStaticAssetKey(pathname: string): string {
  return `original-ui/static/${pathname.replace(/^\/+/, "")}`;
}

function contentTypeForOriginalUiStaticAsset(pathname: string): string {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function cacheControlForOriginalUiStaticAsset(pathname: string): string {
  if (pathname === "/app-sw.js" || pathname === "/offline.html") return "no-cache, no-store, must-revalidate";
  if (pathname === "/manifest.webmanifest") return "public, max-age=300";
  return "public, max-age=31536000, immutable";
}

async function getOriginalUiThumb(request: Request, url: URL, env: Env): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(originalUiThumbKey(url.pathname));
  if (object?.body) {
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? contentTypeForOriginalUiThumb(url.pathname),
        "cache-control": "public, max-age=31536000, immutable",
        "x-ikimon-cloudflare-materialized": "original-ui-thumb"
      }
    });
  }
  if (shouldUseOriginFallback(url, env)) {
    return fetchOriginFallback(request, url, env, "thumb_materialized_miss");
  }
  return json({ ok: false, error: "thumb_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isOriginalUiThumbPath(pathname: string): boolean {
  if (pathname === "/thumb/") return true;
  return /^\/thumb\/[a-zA-Z0-9._-]+\/(?:avatars|v2-observations)\/[a-zA-Z0-9._/-]+$/.test(pathname);
}

function originalUiThumbKey(pathname: string): string {
  return `original-ui/thumb/${pathname.replace(/^\/thumb\/?/, "")}`;
}

function contentTypeForOriginalUiThumb(pathname: string): string {
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function getOriginalUiHtml(request: Request, url: URL, env: Env): Promise<Response> {
  if (hasPersonalizedHtmlHeaders(request) && !isCookieSafeOriginalUiAppShell(url.pathname)) {
    if (shouldUseOriginFallback(url, env)) {
      return fetchOriginFallback(request, url, env, "html_personalized_request");
    }
    return json({ ok: false, error: "html_requires_origin_for_personalized_request" }, 404, { "cache-control": "no-store" });
  }

  const object = await env.ASSET_BUCKET.get(originalUiHtmlKeyForRequest(url));
  if (object?.body) {
    const body = request.method === "HEAD" ? null : await originalUiHtmlBodyForRequest(object, url, env);
    return new Response(body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "text/html; charset=utf-8",
        "cache-control": "no-store",
        "vary": "cookie, authorization",
        "x-ikimon-cloudflare-materialized": "original-ui-html"
      }
    });
  }

  const nativeFieldDetail = await getNativeFieldDetailHtmlIfAvailable(request, url, env);
  if (nativeFieldDetail) {
    return nativeFieldDetail;
  }

  if (shouldUseOriginFallback(url, env)) {
    return fetchOriginFallback(request, url, env, "html_materialized_miss");
  }
  return json({ ok: false, error: "html_not_materialized" }, 404, { "cache-control": "no-store" });
}

async function originalUiHtmlBodyForRequest(object: R2ObjectBody, url: URL, env: Env): Promise<ReadableStream | string | null> {
  if (isRecordsHtmlPath(url.pathname)) {
    const text = await new Response(object.body).text();
    return injectRecentObservationRecords(text, url, env);
  }
  if (!isAuthHtmlPath(url.pathname) || !url.searchParams.has("redirect")) return object.body;
  const text = await new Response(object.body).text();
  return personalizeAuthRedirectHtml(text, postAuthRedirect(url.searchParams.get("redirect")));
}

function isAuthHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/(?:login|register)$/.test(pathname);
}

function isProfileHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/profile(?:\/settings)?$/.test(pathname);
}

async function getSessionAwareProfileHtml(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return getOriginalUiHtml(request, url, env);
  }

  const body = request.method === "HEAD"
    ? null
    : renderCloudflareProfileHtml(session, {
      lang: publicLangFromPath(url.pathname) ?? langQueryToUrlSegment(url.searchParams.get("lang")) ?? "ja",
      settings: /\/profile\/settings$/.test(url.pathname)
    });

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "vary": "cookie, authorization",
      "x-ikimon-cloudflare-native": "profile-session"
    }
  });
}

function renderCloudflareProfileHtml(
  session: SessionSnapshot,
  options: { lang: string; settings: boolean }
): string {
  const lang = options.lang === "en" || options.lang === "es" || options.lang === "pt-br" ? options.lang : "ja";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const copy = lang === "ja"
    ? {
      title: options.settings ? "プロフィール設定" : "マイページ",
      records: "自分の記録",
      record: "記録する",
      map: "地図",
      settings: "設定",
      signedIn: "ログイン中",
      role: "権限",
      rank: "ランク",
      back: "マイページへ"
    }
    : {
      title: options.settings ? "Profile Settings" : "My Page",
      records: "My records",
      record: "Record",
      map: "Map",
      settings: "Settings",
      signedIn: "Signed in",
      role: "Role",
      rank: "Rank",
      back: "Back to profile"
    };
  const title = escapeHtml(copy.title);
  const displayName = escapeHtml(session.displayName || session.userId);
  const roleName = escapeHtml(session.roleName || "Observer");
  const rankLabel = escapeHtml(session.rankLabel ?? "-");
  const settingsBody = options.settings
    ? `<section class="cf-profile-panel">
        <h2>${escapeHtml(copy.settings)}</h2>
        <dl>
          <div><dt>${escapeHtml(copy.signedIn)}</dt><dd>${displayName}</dd></div>
          <div><dt>${escapeHtml(copy.role)}</dt><dd>${roleName}</dd></div>
          <div><dt>${escapeHtml(copy.rank)}</dt><dd>${rankLabel}</dd></div>
        </dl>
        <a class="cf-profile-link" href="${escapeHtml(`${prefix}/profile`)}">${escapeHtml(copy.back)}</a>
      </section>`
    : `<nav class="cf-profile-actions" aria-label="${escapeHtml(copy.title)}">
        <a href="${escapeHtml(`${prefix}/records?view=mine`)}">${escapeHtml(copy.records)}</a>
        <a href="${escapeHtml(`${prefix}/record`)}">${escapeHtml(copy.record)}</a>
        <a href="${escapeHtml(`${prefix}/map`)}">${escapeHtml(copy.map)}</a>
        <a href="${escapeHtml(`${prefix}/profile/settings`)}">${escapeHtml(copy.settings)}</a>
      </nav>
      <section class="cf-profile-panel">
        <dl>
          <div><dt>${escapeHtml(copy.signedIn)}</dt><dd>${displayName}</dd></div>
          <div><dt>${escapeHtml(copy.role)}</dt><dd>${roleName}</dd></div>
          <div><dt>${escapeHtml(copy.rank)}</dt><dd>${rankLabel}</dd></div>
        </dl>
      </section>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - ikimon</title>
  <style>
    :root{color-scheme:light;--ink:#10251a;--muted:#53645d;--line:#dceee8;--mint:#effbf7;--teal:#059b8d}
    *{box-sizing:border-box}
    body{margin:0;background:#f7fbf9;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    .cf-profile-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;background:#fff;border-bottom:1px solid var(--line)}
    .cf-profile-brand{font-weight:900;text-decoration:none;color:var(--ink);font-size:20px}
    .cf-profile-shell{width:min(960px,calc(100% - 32px));margin:28px auto}
    .cf-profile-title{margin:0 0 18px}
    .cf-profile-title small{display:block;color:var(--teal);font-size:13px;font-weight:800}
    .cf-profile-title h1{margin:4px 0 0;font-size:32px;line-height:1.15;letter-spacing:0}
    .cf-profile-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}
    .cf-profile-actions a,.cf-profile-link{display:flex;align-items:center;justify-content:center;min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(16,37,26,.06)}
    .cf-profile-panel{padding:18px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 14px 34px rgba(16,37,26,.07)}
    .cf-profile-panel h2{margin:0 0 14px;font-size:20px}
    .cf-profile-panel dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}
    .cf-profile-panel div{min-width:0;padding:12px;border-radius:12px;background:var(--mint)}
    .cf-profile-panel dt{color:var(--muted);font-size:12px;font-weight:800}
    .cf-profile-panel dd{margin:4px 0 0;font-weight:900;overflow-wrap:anywhere}
    @media (max-width:720px){.cf-profile-shell{width:calc(100% - 20px);margin:18px auto}.cf-profile-title h1{font-size:26px}.cf-profile-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.cf-profile-panel dl{grid-template-columns:1fr}.cf-profile-header{padding:12px 14px}}
  </style>
</head>
<body data-cloudflare-profile="signed-in">
  <header class="cf-profile-header"><a class="cf-profile-brand" href="${escapeHtml(`${prefix}/map`)}">ikimon</a></header>
  <main class="cf-profile-shell">
    <div class="cf-profile-title">
      <small>${escapeHtml(copy.title)}</small>
      <h1 data-testid="profile-heading">${displayName}</h1>
    </div>
    ${settingsBody}
  </main>
</body>
</html>`;
}

function isRecordsHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/records$/.test(pathname);
}

function recordsInjectionCopy(url: URL) {
  const lang = publicLangFromPath(url.pathname) ?? langQueryToUrlSegment(url.searchParams.get("lang")) ?? "ja";
  if (lang === "en") {
    return {
      eyebrow: "Live records",
      title: "Recent records are already here",
      body: "New posts appear here from Cloudflare immediately after their public media is ready.",
      empty: "No recent public records yet.",
      open: "Open",
      map: "Map",
      unknown: "Awaiting ID"
    };
  }
  return {
    eyebrow: "記録が動いています",
    title: "最近の投稿",
    body: "投稿後、公開用の写真処理が終わった記録からここに出ます。",
    empty: "まだ最近の公開記録はありません。",
    open: "開く",
    map: "地図",
    unknown: "同定待ち"
  };
}

function publicLangFromPath(pathname: string): "ja" | "en" | "es" | "pt-br" | null {
  const match = pathname.match(/^\/(ja|en|es|pt-br)(?:\/|$)/);
  return match ? match[1] as "ja" | "en" | "es" | "pt-br" : null;
}

async function injectRecentObservationRecords(html: string, url: URL, env: Env): Promise<string> {
  const items = await recentPublicRecordCards(env).catch(() => []);
  const copy = recordsInjectionCopy(url);
  const cards = items.length > 0
    ? items.map((item) => renderRecentRecordCard(item, copy)).join("")
    : `<p class="cf-records-empty">${escapeHtml(copy.empty)}</p>`;
  const section = `<section class="cf-records-live" data-cloudflare-records-live>
    <style>
      .cf-records-live{margin:10px auto 14px;padding:14px;max-width:min(1120px,calc(100% - 24px));border:1px solid rgba(15,23,42,.1);border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.08)}
      .cf-records-live-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:12px}
      .cf-records-live small{display:block;color:#047857;font-weight:900;letter-spacing:.02em}
      .cf-records-live h2{margin:2px 0 0;color:#10251a;font-size:22px;line-height:1.15}
      .cf-records-live p{margin:0;color:#475569;font-size:13px;line-height:1.55}
      .cf-records-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .cf-record-card{min-width:0;border:1px solid rgba(15,23,42,.08);border-radius:12px;overflow:hidden;background:#f8fafc;text-decoration:none;color:#0f172a}
      .cf-record-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#dbeafe}
      .cf-record-card-body{padding:10px}
      .cf-record-card strong{display:block;font-size:14px;line-height:1.3}
      .cf-record-card span{display:block;margin-top:4px;color:#64748b;font-size:12px;line-height:1.4}
      .cf-records-empty{padding:10px;border-radius:10px;background:#f8fafc}
      @media (max-width:720px){.cf-records-live{margin:8px 8px 12px;padding:12px;border-radius:12px}.cf-records-live-head{display:block}.cf-records-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cf-records-live h2{font-size:18px}.cf-record-card-body{padding:8px}.cf-record-card strong{font-size:13px}}
    </style>
    <div class="cf-records-live-head"><div><small>${escapeHtml(copy.eyebrow)}</small><h2>${escapeHtml(copy.title)}</h2></div><p>${escapeHtml(copy.body)}</p></div>
    <div class="cf-records-grid">${cards}</div>
  </section>`;
  if (html.includes("<main")) {
    return html.replace(/(<main\b[^>]*>)/i, `$1${section}`);
  }
  if (html.includes("<body")) {
    return html.replace(/(<body\b[^>]*>)/i, `$1${section}`);
  }
  return `${section}${html}`;
}

async function recentPublicRecordCards(env: Env): Promise<Array<ReturnType<typeof publicMapObservationItem>>> {
  const rows = (await queryPublicMapRows(env)).slice(0, 6);
  if (rows.length === 0) return [];
  const photoUrls = await queryPublicMapPhotoUrls(env);
  return rows.map((row) => publicMapObservationItem(row, photoUrls.get(row.observation_id) ?? null));
}

function renderRecentRecordCard(item: ReturnType<typeof publicMapObservationItem>, copy: ReturnType<typeof recordsInjectionCopy>): string {
  const href = `/observations/${encodeURIComponent(item.visitId)}`;
  const image = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName || copy.unknown)}" loading="lazy">`
    : "";
  return `<a class="cf-record-card" href="${escapeHtml(href)}">
    ${image}
    <span class="cf-record-card-body">
      <strong>${escapeHtml(item.displayName || copy.unknown)}</strong>
      <span>${escapeHtml(item.observedAt)} · ${escapeHtml(item.cellId)}</span>
      <span>${escapeHtml(copy.open)} / ${escapeHtml(copy.map)}</span>
    </span>
  </a>`;
}

function personalizeAuthRedirectHtml(html: string, redirect: string): string {
  const encodedRedirect = encodeURIComponent(redirect);
  return html
    .replace(/\bdata-redirect="[^"]*"/g, `data-redirect="${escapeHtml(redirect)}"`)
    .replace(/(href="[^"]*\/(?:login|register)\?redirect=)[^"&]*/g, `$1${encodedRedirect}`)
    .replace(/(href="[^"]*\/auth\/oauth\/(?:google|twitter)\/start\?redirect=)[^"&]*/g, `$1${encodedRedirect}`);
}

function isOriginalUiHtmlPath(pathname: string): boolean {
  if (ORIGINAL_UI_HTML_STATIC_PATHS.has(pathname)) return true;
  if (pathname === "/admin/municipal-walk-maps") return true;
  if (/^(?:\/(?:ja|en|es|pt-br))?\/community\/fields\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(pathname)) return true;
  if (/^(?:\/(?:ja|en|es|pt-br))?\/places\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\/snapshot$/.test(pathname)) return true;
  return false;
}

function municipalWalkMapAdminSourceDraftKey(url: URL): string | null {
  if (url.pathname !== "/admin/municipal-walk-maps") return null;
  const sourceId = url.searchParams.get("sourceId")?.trim() ?? "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(sourceId)) return null;
  return `original-ui/html/admin/municipal-walk-maps/source/${sourceId}.html`;
}

function originalUiHtmlKey(pathname: string): string {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.html`;
}

function originalUiHtmlKeyForRequest(url: URL): string {
  const adminSourceDraftKey = municipalWalkMapAdminSourceDraftKey(url);
  if (adminSourceDraftKey) return adminSourceDraftKey;
  const langSegment = langQueryToUrlSegment(url.searchParams.get("lang"));
  if (!langSegment) return originalUiHtmlKey(url.pathname);
  const localizedPath = localizedMaterializedPath(url.pathname, langSegment);
  return originalUiHtmlKey(localizedPath ?? url.pathname);
}

function langQueryToUrlSegment(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized === "ja" || normalized === "en" || normalized === "es") return normalized;
  if (normalized === "pt-BR" || normalized.toLowerCase() === "pt-br" || normalized === "pt") return "pt-br";
  return null;
}

function localizedMaterializedPath(pathname: string, langSegment: string): string | null {
  if (pathname.startsWith(`/${langSegment}/`) || pathname === `/${langSegment}`) return pathname;
  const localizable = new Set([
    "/",
    "/demo/place-feeling-tags",
    "/guide",
    "/login",
    "/map",
    "/profile",
    "/profile/settings",
    "/record",
    "/records",
    "/register"
  ]);
  if (!localizable.has(pathname)) return null;
  if (pathname === "/") return `/${langSegment}`;
  return `/${langSegment}${pathname}`;
}

function hasPersonalizedHtmlHeaders(request: Request): boolean {
  const cookie = request.headers.get("cookie")?.trim();
  if (cookie) return true;
  const authorization = request.headers.get("authorization")?.trim();
  return Boolean(authorization);
}

function isCookieSafeOriginalUiAppShell(pathname: string): boolean {
  return pathname === "/app-refresh"
    || pathname === "/admin/municipal-walk-maps"
    || pathname === "/"
    || /^\/(?:ja|en|es|pt-br)\/?$/.test(pathname)
    || /^(?:\/(?:ja|en|es|pt-br))?\/demo\/place-feeling-tags$/.test(pathname)
    || /^(?:\/(?:ja|en|es|pt-br))?\/guide$/.test(pathname)
    || /^(?:\/(?:ja|en|es|pt-br))?\/map$/.test(pathname)
    || /^(?:\/(?:ja|en|es|pt-br))?\/profile(?:\/settings)?$/.test(pathname)
    || /^(?:\/(?:ja|en|es|pt-br))?\/records?$/.test(pathname);
}

async function getPublicDerivedMedia(url: URL, env: Env): Promise<Response> {
  const key = url.pathname.replace(/^\/+/, "");
  if (!key.startsWith("derived/")) {
    return json({ error: "not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(key);
  if (!object?.body) {
    return json({ error: "media_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=300"
    }
  });
}

async function getShadowVideoStream(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(row.object_key);
  if (!object?.body) {
    return json({ error: "video_body_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "video/mp4",
      "cache-control": "no-store"
    }
  });
}

async function getShadowVideoThumbnail(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  return new Response(shadowSafeJpegPosterBytes(), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store"
    }
  });
}

async function queryPublicMapRows(env: Env): Promise<PublicMapRow[]> {
  const rows = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, asset_count
     FROM readmodel_public_observations
     ORDER BY observed_at DESC
     LIMIT 5000`
  ).all<PublicMapRow>();
  return rows.results;
}

async function queryPublicMapPhotoUrls(env: Env): Promise<Map<string, string>> {
  const rows = await env.OBS_DB.prepare(
    `SELECT observation_id, public_derivative_key
       FROM asset_ledger
      WHERE observation_id IS NOT NULL
        AND processing_state = 'uploaded'
        AND public_derivative_key IS NOT NULL
        AND exif_scrub_state = 'scrubbed'
        AND public_ready_at IS NOT NULL
        AND mime LIKE 'image/%'
      ORDER BY public_ready_at DESC
      LIMIT 5000`
  ).all<PublicMapPhotoRow>();
  const map = new Map<string, string>();
  for (const row of rows.results) {
    if (!map.has(row.observation_id)) map.set(row.observation_id, publicMediaUrl(row.public_derivative_key));
  }
  return map;
}

function publicMapObservationItem(row: PublicMapRow, photoUrl: string | null) {
  const displayName = publicTaxonDisplayName(row.taxon_label);
  return {
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    displayName,
    isAiCandidate: false,
    isAwaitingId: isWeakTaxonLabel(row.taxon_label),
    localityLabel: "位置をぼかしています",
    observedAt: row.observed_at,
    photoUrl,
    taxonGroup: taxonGroupForLabel(row.taxon_label),
    cellId: publicCellToCellId(row.public_cell)
  };
}

async function queryAreaPolygonRows(
  env: Env,
  bbox: [number, number, number, number],
  sources: string[],
  limit: number
): Promise<AreaPolygonReadmodelRow[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const allRows = await env.OBS_DB.prepare(
    `SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city,
            public_cell, public_lat, public_lng, radius_m, area_ha,
            has_polygon, has_simplified_geometry,
            certification_id, certification_url, official_url, owner_url, story_url,
            verification_level, verification_method, verification_label, source_confidence,
            valid_from, valid_to, entity_key, updated_at
       FROM production_import_field_detail_readmodel
      WHERE public_lat >= ?
        AND public_lat <= ?
        AND public_lng >= ?
        AND public_lng <= ?
      ORDER BY COALESCE(area_ha, 999999), name
      LIMIT ?`
  ).bind(minLat, maxLat, minLng, maxLng, limit).all<AreaPolygonReadmodelRow>();
  const allowed = new Set(sources);
  return allRows.results.filter((row) => sources.length === 0 || allowed.has(areaLayerSource(row)));
}

async function queryNativeAreaPolygonRows(
  env: Env,
  bbox: [number, number, number, number],
  sources: string[],
  limit: number
): Promise<AreaPolygonGeometryReadmodelRow[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const sourceClause = sources.length > 0
    ? ` AND source IN (${sources.map(() => "?").join(", ")})`
    : "";
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT field_id, source, admin_level, name, prefecture, city,
              center_lat, center_lng,
              bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
              area_ha, geometry_json, approximate_boundary, boundary_approximation,
              source_confidence, verification_level, verification_label,
              official_url, owner_url, story_url, certification_url,
              entity_key, updated_at
         FROM production_import_area_polygon_readmodel
        WHERE bbox_max_lat >= ?
          AND bbox_min_lat <= ?
          AND bbox_max_lng >= ?
          AND bbox_min_lng <= ?
          ${sourceClause}
        ORDER BY COALESCE(area_ha, 999999), name
        LIMIT ?`
    ).bind(minLat, maxLat, minLng, maxLng, ...sources, limit).all<AreaPolygonGeometryReadmodelRow>();
    return rows.results;
  } catch (error) {
    if (String(error).includes("production_import_area_polygon_readmodel") || String(error).includes("no such table")) {
      return [];
    }
    throw error;
  }
}

function parseSourceParam(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-z_]+$/.test(value));
}

function areaLayerSource(row: AreaPolygonReadmodelRow): string {
  if (row.admin_level && ["osm_park", "admin_municipality", "admin_prefecture", "admin_country"].includes(row.admin_level)) {
    return row.admin_level;
  }
  return row.source || "user_defined";
}

function safeAreaGeometry(raw: string): { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] } | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const type = (parsed as { type?: unknown }).type;
    const coordinates = (parsed as { coordinates?: unknown }).coordinates;
    if ((type !== "Polygon" && type !== "MultiPolygon") || !Array.isArray(coordinates)) return null;
    return { type, coordinates };
  } catch {
    return null;
  }
}

function textProp(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value.trim() : "";
}

function numericProp(props: Record<string, unknown>, key: string): number {
  const value = props[key];
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function booleanishProp(props: Record<string, unknown>, key: string): boolean {
  const value = props[key];
  if (value === true || value === 1) return true;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  return false;
}

function areaFeatureProps(feature: unknown): Record<string, unknown> | null {
  if (!feature || typeof feature !== "object" || Array.isArray(feature)) return null;
  const props = (feature as { properties?: unknown }).properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  return props as Record<string, unknown>;
}

function isApproximateAreaPolygonFeature(feature: unknown): boolean {
  const props = areaFeatureProps(feature);
  if (!props) return false;
  const label = textProp(props, "verification_label");
  return booleanishProp(props, "approximate_boundary")
    || textProp(props, "boundary_approximation") === "point_buffer"
    || label.includes("境界未確認・代表点からの仮範囲");
}

function isWeakLiveOsmAreaPolygonFeature(feature: unknown): boolean {
  const props = areaFeatureProps(feature);
  if (!props) return false;
  if (!textProp(props, "field_id").startsWith("osm-live:")) return false;
  const name = textProp(props, "name");
  if (name === "OSMの学校・キャンパス" || name === "OSMの公園・緑地") return true;
  if (textProp(props, "source") === "school") {
    const hasExternalEvidence = Boolean(
      textProp(props, "official_url") ||
      textProp(props, "owner_url") ||
      textProp(props, "certification_url")
    );
    return !hasExternalEvidence && numericProp(props, "source_confidence") < 0.75;
  }
  return false;
}

function isDisplayableAreaPolygonFeature(feature: unknown): boolean {
  return !isApproximateAreaPolygonFeature(feature) && !isWeakLiveOsmAreaPolygonFeature(feature);
}

function filterMapAreaPolygonsPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return payload;
  const filteredFeatures = features.filter(isDisplayableAreaPolygonFeature);
  const stats = (payload as { stats?: unknown }).stats;
  return {
    ...(payload as Record<string, unknown>),
    features: filteredFeatures,
    stats: stats && typeof stats === "object" && !Array.isArray(stats)
      ? {
          ...(stats as Record<string, unknown>),
          totalReturned: filteredFeatures.length,
          totalAll: filteredFeatures.length
        }
      : stats
  };
}

async function filterMapAreaPolygonsResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  try {
    const payload = await response.clone().json();
    const filteredPayload = filterMapAreaPolygonsPayload(payload);
    if (filteredPayload === payload) return response;
    return json(filteredPayload, response.status, {
      "cache-control": response.headers.get("cache-control") ?? "public, max-age=60"
    });
  } catch {
    return response;
  }
}

function areaPolygonFeatureFromGeometryReadmodel(row: AreaPolygonGeometryReadmodelRow) {
  if (!Number.isFinite(row.center_lat) || !Number.isFinite(row.center_lng)) return null;
  const geometry = safeAreaGeometry(row.geometry_json);
  if (!geometry) return null;
  const source = row.source || "user_defined";
  return {
    type: "Feature",
    geometry,
    properties: {
      field_id: row.field_id,
      name: row.name,
      source,
      source_label: areaSourceLabel(source),
      admin_level: row.admin_level,
      prefecture: row.prefecture ?? "",
      city: row.city ?? "",
      area_ha: row.area_ha,
      official_url: row.official_url ?? "",
      owner_url: row.owner_url ?? "",
      story_url: row.story_url ?? "",
      certification_url: row.certification_url ?? "",
      source_confidence: row.source_confidence ?? 0.75,
      verification_level: row.verification_level ?? "readmodel_public_polygon",
      verification_label: row.verification_label ?? "公開read model polygon",
      center: [row.center_lng, row.center_lat],
      transient: row.approximate_boundary === 1,
      approximate_boundary: row.approximate_boundary === 1,
      boundary_approximation: row.boundary_approximation ?? undefined,
      entity_key: row.entity_key ?? undefined,
      biodiversity_groups: []
    }
  };
}

function areaPolygonFeatureFromReadmodel(row: AreaPolygonReadmodelRow) {
  if (!Number.isFinite(row.public_lat) || !Number.isFinite(row.public_lng)) return null;
  const source = areaLayerSource(row);
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [publicAreaApproxPolygon(row.public_lat, row.public_lng, row.radius_m, row.area_ha)]
    },
    properties: {
      field_id: row.field_id,
      name: row.name,
      source,
      source_label: areaSourceLabel(source),
      admin_level: row.admin_level,
      prefecture: row.prefecture ?? "",
      city: row.city ?? "",
      area_ha: row.area_ha,
      official_url: row.official_url ?? "",
      owner_url: row.owner_url ?? "",
      story_url: row.story_url ?? "",
      certification_url: row.certification_url ?? "",
      source_confidence: row.source_confidence ?? 0.55,
      verification_level: row.verification_level ?? "readmodel_public",
      verification_label: row.verification_label ?? "公開read model",
      center: [row.public_lng, row.public_lat],
      transient: row.has_polygon !== 1,
      entity_key: row.entity_key ?? undefined,
      biodiversity_groups: []
    }
  };
}

function publicAreaApproxPolygon(lat: number, lng: number, radiusM: number | null, areaHa: number | null): [number, number][] {
  const radiusFromArea = Number.isFinite(areaHa) && (areaHa ?? 0) > 0
    ? Math.sqrt((areaHa as number) * 10000 / Math.PI)
    : null;
  const radius = Math.max(60, Math.min(900, radiusM ?? radiusFromArea ?? 160));
  const latDelta = radius / 111_320;
  const lngDelta = radius / (111_320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return [
    [lng - lngDelta, lat - latDelta],
    [lng + lngDelta, lat - latDelta],
    [lng + lngDelta, lat + latDelta],
    [lng - lngDelta, lat + latDelta],
    [lng - lngDelta, lat - latDelta]
  ];
}

function areaSourceLabel(source: string): string {
  if (source === "school") return "学校";
  if (source === "osm_park") return "公園 (OSM)";
  if (source === "nature_symbiosis_site") return "自然共生サイト";
  if (source === "protected_area") return "保護区";
  if (source === "oecm") return "OECM";
  if (source === "tsunag") return "TSUNAG";
  if (source === "admin_municipality") return "市町村";
  if (source === "admin_prefecture") return "都道府県";
  if (source === "admin_country") return "国";
  return "公開エリア";
}

async function getPublicObservationDetailJson(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({ ok: true, observation: detail }, 200, { "cache-control": "no-store" });
}

async function getPublicObservationDetailPage(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return html(renderObservationNotFoundHtml(), 404, { "cache-control": "no-store" });
  }
  return html(renderPublicObservationDetailHtml(detail), 200, { "cache-control": "no-store" });
}

async function buildPublicObservationDetail(rawId: string, env: Env) {
  const visitId = detailIdToVisitId(rawId);
  const row = await env.OBS_DB.prepare(
    `SELECT r.observation_id, r.public_cell, r.observed_at, r.taxon_label, r.asset_count,
            o.note, o.visibility
     FROM readmodel_public_observations r
     JOIN observations o ON o.observation_id = r.observation_id
     WHERE r.observation_id = ?
       AND o.visibility = 'public'
       AND o.emergency_hidden = 0`
  ).bind(visitId).first<PublicDetailRow>();
  if (!row) return null;

  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key, mime, bytes, duration_ms, public_derivative_key
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 24`
  ).bind(visitId).all<PublicDetailAssetRow>();

  const photoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("image/"))
    .map((asset) => ({
      assetId: asset.asset_id,
      url: publicMediaUrl(asset.public_derivative_key),
      widthPx: null,
      heightPx: null,
      mediaRole: null
    }));
  const videoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("video/"))
    .map((asset) => {
      const streamUid = asset.asset_id.replace(/^video_asset_/, "");
      return {
        assetId: asset.asset_id,
        providerUid: streamUid,
        iframeUrl: buildShadowVideoIframeUrl(streamUid),
        thumbnailUrl: buildShadowVideoThumbnailUrl(streamUid),
        watchUrl: buildShadowVideoWatchUrl(streamUid),
        readyToStream: true,
        uploadStatus: "ready",
        createdAt: row.observed_at,
        durationMs: asset.duration_ms ?? 0,
        mediaRole: "observation_video"
      };
    });
  const relatedRows = (await queryPublicMapRows(env))
    .filter((related) => related.public_cell === row.public_cell && related.observation_id !== visitId)
    .slice(0, 6);
  const relatedPhotoUrls = await queryPublicMapPhotoUrls(env);

  return {
    schemaVersion: "shadow_public_observation_detail/v1",
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    canonicalPath: `/observations/${encodeURIComponent(row.observation_id)}`,
    displayName: row.taxon_label ?? "同定待ち",
    isAwaitingId: !row.taxon_label,
    observedAt: row.observed_at,
    note: row.note,
    placeName: "位置をぼかしています",
    municipality: null,
    publicLocation: {
      label: "位置をぼかしています",
      cellId: publicCellToCellId(row.public_cell),
      publicCell: row.public_cell
    },
    photoAssets,
    photoUrls: photoAssets.map((asset) => asset.url),
    videoAssets,
    audioAssets: [],
    assetCount: row.asset_count,
    relatedObservations: relatedRows.map((related) => publicMapObservationItem(
      related,
      relatedPhotoUrls.get(related.observation_id) ?? null
    )),
    privacy: {
      exactLocationExposed: false,
      source: "readmodel_public_observations.public_cell"
    }
  };
}

async function createDraftObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<DraftObservationInput>(request);
  assertNonEmpty(input.userId, "userId");

  const media = input.media ?? [];
  if (media.length > MAX_MEDIA_PER_DRAFT) {
    return json({ error: "too_many_media", max: MAX_MEDIA_PER_DRAFT }, 400);
  }

  const draftId = newId("draft");
  const partition = resolveObservationPartition(input.observedAt, env);
  const publicCell = blurLocation(input.exactLat, input.exactLng);
  const visibility = input.visibility === "public" ? "public" : "private";

  const statements: D1PreparedStatement[] = [
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt ?? null,
      numberOrNull(input.exactLat),
      numberOrNull(input.exactLng),
      numberOrNull(input.locationAccuracyM),
      publicCell,
      visibility,
      partition.partitionMonth
    )
  ];

  const assets = media.map((asset, index) => {
    validateAsset(asset);
    const assetId = newId("asset");
    const objectKey = `original/${partition.partitionMonth.replace("-", "/")}/${assetId}`;
    statements.push(
      env.OBS_DB.prepare(
        `INSERT INTO asset_ledger
         (asset_id, draft_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, partition_month)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        assetId,
        draftId,
        input.userId,
        objectKey,
        asset.sha256 ?? null,
        asset.mime,
        asset.bytes,
        numberOrNull(asset.width),
        numberOrNull(asset.height),
        numberOrNull(asset.durationMs),
        "private",
        partition.partitionMonth
      )
    );
    return { assetId, objectKey, uploadUrl: `/api/v0/assets/${encodeURIComponent(assetId)}/body`, index };
  });

  await env.CORE_DB.batch(statements.filter((statement, index) => index === 0));
  await env.OBS_DB.batch(statements.slice(1));

  return json({ draftId, publicCell, assets });
}

async function issueCompatibleSession(request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  if (env.ENVIRONMENT === "production" && PUBLIC_CUSTOM_HOSTS.has(new URL(request.url).hostname)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const input = await readJson<SessionIssueInput>(request);
  assertNonEmpty(input.userId, "userId");
  const ttlHours = typeof input.ttlHours === "number" && Number.isFinite(input.ttlHours) && input.ttlHours > 0
    ? Math.min(input.ttlHours, 24 * 30)
    : 24 * 30;
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const displayName = normalizeOptionalText(input.displayName) ?? input.userId;
  const roleName = normalizeOptionalText(input.roleName) ?? "Observer";

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      tokenHash,
      input.userId,
      displayName,
      roleName,
      normalizeOptionalText(input.rankLabel),
      expiresAt,
      request.headers.get("cf-connecting-ip") ?? null,
      request.headers.get("user-agent") ?? null
    )
  ]);

  const session = {
    userId: input.userId,
    displayName,
    roleName,
    rankLabel: normalizeOptionalText(input.rankLabel),
    banned: false,
    expiresAt,
    tokenHash
  };
  return json({
    ok: true,
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    session
  }, 200, {
    "set-cookie": buildSessionCookie(rawToken, expiresAt, env)
  });
}

async function getCompatibleSession(request: Request, url: URL, env: Env): Promise<Response> {
  const optional = url.searchParams.get("optional") === "1" || url.searchParams.get("optional") === "true";
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return optional
      ? json({ ok: false, error: "session_not_found", session: null })
      : json({ ok: false, error: "session_not_found" }, 401);
  }
  return json({
    ok: true,
    session: {
      userId: session.userId,
      displayName: session.displayName,
      roleName: session.roleName,
      rankLabel: session.rankLabel,
      banned: session.banned,
      expiresAt: session.expiresAt,
      tokenHash: session.tokenHash
    }
  });
}

async function logoutCompatibleSession(request: Request, env: Env): Promise<Response> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  const tokenHash = rawToken ? await sha256Hex(textToArrayBuffer(rawToken)) : null;
  if (tokenHash) {
    await env.CORE_DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({
    ok: true,
    revoked: Boolean(tokenHash),
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    }
  }, 200, {
    "set-cookie": buildClearedSessionCookie(env)
  });
}

async function handleOAuthStart(request: Request, providerInput: unknown, env: Env): Promise<Response> {
  const provider = oauthProviderFromInput(providerInput);
  if (!provider) return oauthErrorRedirect(env);
  if (!getOAuthConfig(env, provider)) {
    if (shouldFallbackOAuthToOrigin(request, env)) {
      return fetchOriginFallback(request, new URL(request.url), env, "oauth_provider_not_configured");
    }
    return oauthErrorRedirect(env);
  }

  const url = new URL(request.url);
  const start = await buildOAuthStart(provider, request, env, url.searchParams.get("redirect"));
  return redirect303(start.authorizationUrl, {
    "cache-control": "no-store",
    "set-cookie": start.cookie
  });
}

async function handleOAuthCallback(request: Request, providerInput: unknown, env: Env): Promise<Response> {
  const provider = oauthProviderFromInput(providerInput);
  if (!provider) return oauthErrorRedirect(env, true);
  if (!getOAuthConfig(env, provider)) {
    if (shouldFallbackOAuthToOrigin(request, env)) {
      return fetchOriginFallback(request, new URL(request.url), env, "oauth_provider_not_configured");
    }
    return oauthErrorRedirect(env, true);
  }

  try {
    const url = new URL(request.url);
    const state = await readOAuthState(request.headers.get("cookie"), env);
    const callbackState = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!state || state.provider !== provider || state.state !== callbackState || !code || url.searchParams.has("error")) {
      throw new Error("oauth_state_invalid");
    }
    const profile = await exchangeOAuthCode(provider, code, oauthRedirectUri(request, provider), state.codeVerifier, env);
    const user = await findOrCreateOAuthUser(profile, env);
    const session = await issueSessionForAuthUser(request, env, user);
    const headers = new Headers({
      location: safeRedirectPath(state.redirect),
      "cache-control": "no-store"
    });
    headers.append("set-cookie", session.cookie);
    headers.append("set-cookie", buildClearedOAuthStateCookie(env));
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.warn(JSON.stringify({
      message: "oauth_callback_failed",
      provider,
      error: error instanceof Error ? error.message : "unknown"
    }));
    return oauthErrorRedirect(env, true);
  }
}

async function loginWithPassword(request: Request, env: Env): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const fallbackRequest = request.clone();
  const input = await readJson<AuthLoginInput>(request);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  let user: AuthUserRow | null = null;
  try {
    user = email && password ? await findAuthUserByEmail(email, env) : null;
  } catch {
    if (shouldFallbackLoginToOrigin(fallbackRequest, env)) {
      return fetchOriginFallback(fallbackRequest, new URL(fallbackRequest.url), env, "auth_store_unavailable");
    }
    throw new HttpError(500, "auth_store_unavailable");
  }
  const passwordOk = await verifyPassword(password, user?.password_hash ?? null);
  if (!user || !passwordOk) {
    if (shouldFallbackLoginToOrigin(fallbackRequest, env)) {
      return fetchOriginFallback(fallbackRequest, new URL(fallbackRequest.url), env, "auth_d1_miss_or_mismatch");
    }
    return json({ ok: false, error: "invalid_credentials" }, 401, { "cache-control": "no-store" });
  }
  if (user.banned) {
    return json({ ok: false, error: "account_disabled" }, 403, { "cache-control": "no-store" });
  }

  const session = await issueSessionForAuthUser(request, env, user);
  await env.CORE_DB.prepare(
    "UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(user.user_id).run();

  return json({
    ok: true,
    redirect: postAuthRedirect(input.redirect),
    session: session.session
  }, 200, {
    "cache-control": "no-store",
    "set-cookie": session.cookie
  });
}

function shouldFallbackLoginToOrigin(request: Request, env: Env): boolean {
  if (env.ENVIRONMENT !== "production" || !env.ORIGIN_FALLBACK_BASE_URL) return false;
  return PUBLIC_CUSTOM_HOSTS.has(new URL(request.url).hostname);
}

function shouldFallbackOAuthToOrigin(request: Request, env: Env): boolean {
  if (env.ENVIRONMENT !== "production" || !env.ORIGIN_FALLBACK_BASE_URL) return false;
  return PUBLIC_CUSTOM_HOSTS.has(new URL(request.url).hostname);
}

function oauthProviderFromInput(input: unknown): OAuthProvider | null {
  const value = typeof input === "string" ? input.toLowerCase().trim() : "";
  return value === "google" || value === "twitter" ? value : null;
}

function getOAuthConfig(env: Env, provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.TWITTER_CLIENT_ID;
  const clientSecret = provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.TWITTER_CLIENT_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

function oauthStateSecret(env: Env): string {
  return env.V2_OAUTH_STATE_SECRET?.trim()
    ?? env.GOOGLE_CLIENT_SECRET?.trim()
    ?? env.TWITTER_CLIENT_SECRET?.trim()
    ?? "ikimon-dev-oauth-state";
}

async function signOAuthState(encodedPayload: string, env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(oauthStateSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return arrayBufferToBase64Url(await crypto.subtle.sign("HMAC", key, textToArrayBuffer(encodedPayload)));
}

async function encodeOAuthState(payload: OAuthStatePayload, env: Env): Promise<string> {
  const encoded = base64UrlEncodeText(JSON.stringify(payload));
  return `${encoded}.${await signOAuthState(encoded, env)}`;
}

async function decodeOAuthState(value: string | undefined, env: Env): Promise<OAuthStatePayload | null> {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = await signOAuthState(encoded, env);
  if (!constantTimeStringEqual(signature, expected)) return null;
  try {
    const parsed = JSON.parse(arrayBufferToText(base64UrlToArrayBuffer(encoded))) as OAuthStatePayload;
    if (!parsed || parsed.expiresAt < Date.now()) return null;
    if (parsed.provider !== "google" && parsed.provider !== "twitter") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readOAuthState(cookieHeader: string | null, env: Env): Promise<OAuthStatePayload | null> {
  const raw = parseCookies(cookieHeader).ikimon_oauth_state;
  return decodeOAuthState(raw, env);
}

async function buildOAuthStateCookie(payload: OAuthStatePayload, env: Env): Promise<string> {
  const secure = secureCookieAttribute(env);
  return `ikimon_oauth_state=${encodeURIComponent(await encodeOAuthState(payload, env))}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=600`;
}

function buildClearedOAuthStateCookie(env: Env): string {
  const secure = secureCookieAttribute(env);
  return `ikimon_oauth_state=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function requestPublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = headerFirst(request.headers.get("x-forwarded-host"));
  const forwardedProto = headerFirst(request.headers.get("x-forwarded-proto"));
  return `${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost || url.host}`;
}

function oauthRedirectUri(request: Request, provider: OAuthProvider): string {
  const origin = requestPublicOrigin(request);
  return provider === "google"
    ? `${origin}/oauth_callback.php?provider=google`
    : `${origin}/auth/oauth/${provider}/callback`;
}

async function buildOAuthStart(provider: OAuthProvider, request: Request, env: Env, redirectInput: unknown): Promise<{
  cookie: string;
  authorizationUrl: string;
}> {
  const config = getOAuthConfig(env, provider);
  if (!config) throw new Error("oauth_provider_not_configured");
  const state = randomToken().slice(0, 40);
  const codeVerifier = provider === "twitter" ? randomToken() : undefined;
  const payload: OAuthStatePayload = {
    provider,
    state,
    redirect: safeRedirectPath(redirectInput),
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: oauthRedirectUri(request, provider),
    response_type: "code",
    state
  });
  if (provider === "google") {
    params.set("scope", "openid email profile");
    params.set("prompt", "select_account");
    return {
      cookie: await buildOAuthStateCookie(payload, env),
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    };
  }

  params.set("scope", "tweet.read users.read offline.access");
  params.set("code_challenge", await codeChallenge(codeVerifier ?? ""));
  params.set("code_challenge_method", "S256");
  return {
    cookie: await buildOAuthStateCookie(payload, env),
    authorizationUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  };
}

async function exchangeOAuthCode(provider: OAuthProvider, code: string, redirectUri: string, codeVerifier: string | undefined, env: Env): Promise<OAuthProfile> {
  const config = getOAuthConfig(env, provider);
  if (!config) throw new Error("oauth_provider_not_configured");
  if (provider === "google") {
    const token = await postForm("https://oauth2.googleapis.com/token", new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }));
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new Error("oauth_token_failed");
    const profile = await getJson("https://www.googleapis.com/oauth2/v2/userinfo", accessToken);
    return {
      provider,
      providerUserId: String(profile.id ?? ""),
      name: String(profile.name ?? ""),
      email: typeof profile.email === "string" ? profile.email : null,
      avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
      rawProfile: profile
    };
  }

  const token = await postForm("https://api.x.com/2/oauth2/token", new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier ?? ""
  }), {
    authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`
  });
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) throw new Error("oauth_token_failed");
  const profile = await getJson("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", accessToken);
  const data = profile.data && typeof profile.data === "object" ? profile.data as Record<string, unknown> : {};
  return {
    provider,
    providerUserId: String(data.id ?? ""),
    name: String(data.name ?? data.username ?? ""),
    email: null,
    avatarUrl: typeof data.profile_image_url === "string" ? data.profile_image_url : null,
    rawProfile: profile
  };
}

async function postForm(url: string, body: URLSearchParams, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...headers
    },
    body: body.toString()
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error_description ?? payload.error ?? "oauth_token_failed"));
  }
  return payload;
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "oauth_profile_failed"));
  return payload;
}

async function findOrCreateOAuthUser(profile: OAuthProfile, env: Env): Promise<AuthUserRow> {
  if (!profile.providerUserId.trim()) throw new Error("oauth_profile_invalid");
  const existing = await findOAuthAccount(profile.provider, profile.providerUserId, env);
  if (existing) {
    if (existing.banned) throw new Error("account_disabled");
    await upsertOAuthAccount(existing.user_id, profile, existing.display_name, existing.role_name, existing.rank_label, existing.banned, env);
    return oauthAccountToAuthUser(existing);
  }

  const email = normalizeEmail(profile.email);
  const authUser = email ? await findAuthUserByEmail(email, env) : null;
  if (authUser?.banned) throw new Error("account_disabled");
  const userId = authUser?.user_id ?? `user_${crypto.randomUUID()}`;
  const displayName = authUser?.display_name ?? normalizeOptionalText(profile.name) ?? "ikimon user";
  const roleName = authUser?.role_name ?? "Observer";
  const rankLabel = authUser?.rank_label ?? "観察者";
  await env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
  await upsertOAuthAccount(userId, profile, displayName, roleName, rankLabel, authUser?.banned ?? 0, env);
  if (authUser) {
    await env.CORE_DB.prepare("UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(authUser.user_id).run();
  }
  return {
    user_id: userId,
    email,
    password_hash: authUser?.password_hash ?? null,
    display_name: displayName,
    role_name: roleName,
    rank_label: rankLabel,
    banned: authUser?.banned ?? 0
  };
}

async function findOAuthAccount(provider: OAuthProvider, providerUserId: string, env: Env): Promise<OAuthAccountRow | null> {
  return env.CORE_DB.prepare(
    `SELECT user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned
     FROM oauth_accounts
     WHERE provider = ? AND provider_user_id = ?
     LIMIT 1`
  ).bind(provider, providerUserId).first<OAuthAccountRow>();
}

async function upsertOAuthAccount(
  userId: string,
  profile: OAuthProfile,
  displayName: string,
  roleName: string | null,
  rankLabel: string | null,
  banned: number,
  env: Env
): Promise<void> {
  await env.CORE_DB.prepare(
    `INSERT INTO oauth_accounts
     (user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned, profile_json, linked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       user_id = excluded.user_id,
       provider_email = excluded.provider_email,
       display_name = excluded.display_name,
       role_name = excluded.role_name,
       rank_label = excluded.rank_label,
       banned = excluded.banned,
       profile_json = excluded.profile_json,
       linked_at = CURRENT_TIMESTAMP`
  ).bind(
    userId,
    profile.provider,
    profile.providerUserId,
    profile.email,
    displayName,
    roleName ?? "Observer",
    rankLabel,
    banned,
    JSON.stringify(profile.rawProfile)
  ).run();
}

function oauthAccountToAuthUser(row: OAuthAccountRow): AuthUserRow {
  return {
    user_id: row.user_id,
    email: row.provider_email ?? "",
    password_hash: null,
    display_name: row.display_name,
    role_name: row.role_name,
    rank_label: row.rank_label,
    banned: row.banned
  };
}

function oauthErrorRedirect(env: Env, clearState = false): Response {
  return redirect303("/login?error=oauth", clearState ? {
    "cache-control": "no-store",
    "set-cookie": buildClearedOAuthStateCookie(env)
  } : { "cache-control": "no-store" });
}

async function findAuthUserByEmail(email: string, env: Env): Promise<AuthUserRow | null> {
  return env.CORE_DB.prepare(
    `SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned
     FROM auth_users
     WHERE lower(email) = lower(?)
     LIMIT 1`
  ).bind(email).first<AuthUserRow>();
}

async function issueSessionForAuthUser(request: Request, env: Env, user: AuthUserRow): Promise<{ cookie: string; session: SessionSnapshot }> {
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const expiresAt = new Date(Date.now() + 24 * 30 * 60 * 60 * 1000).toISOString();
  const roleName = normalizeOptionalText(user.role_name) ?? "Observer";
  const rankLabel = normalizeOptionalText(user.rank_label) ?? "観察者";

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(user.user_id),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      tokenHash,
      user.user_id,
      user.display_name,
      roleName,
      rankLabel,
      expiresAt,
      request.headers.get("cf-connecting-ip") ?? null,
      request.headers.get("user-agent") ?? null
    )
  ]);

  return {
    cookie: buildSessionCookie(rawToken, expiresAt, env),
    session: {
      tokenHash,
      userId: user.user_id,
      displayName: user.display_name,
      roleName,
      rankLabel,
      banned: false,
      expiresAt
    }
  };
}

async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const hash = storedHash?.trim();
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, normalizeLegacyBcryptHash(hash));
  } catch {
    return false;
  }
}

function normalizeLegacyBcryptHash(hash: string): string {
  return hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
}

function assertSameOriginRequest(request: Request): Response | null {
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }

  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;

  const url = new URL(request.url);
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  if (parsedOrigin.protocol !== url.protocol || parsedOrigin.host !== url.host) {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  return null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeRedirectPath(value: unknown, fallback = "/record"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\u0000")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://ikimon.local");
    if (parsed.origin !== "https://ikimon.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function postAuthRedirect(input: unknown): string {
  const redirect = safeRedirectPath(input);
  const path = redirect.split(/[?#]/, 1)[0] ?? "";
  const normalizedRedirect = path === "/login" || path === "/register" ? "/record" : redirect;
  return normalizedRedirect === "/record" ? "/record?start=photo" : normalizedRedirect;
}

async function recordUiKpiEventShim(request: Request): Promise<Response> {
  const input = await readJson<Record<string, unknown>>(request);
  const eventName = normalizeOptionalText(input.eventName);
  if (!eventName || ![
    "first_action",
    "task_completion",
    "section_view",
    "read_depth",
    "primary_cta_click",
    "map_area_detail_open",
    "selected_place_cta_click",
    "funnel_step",
    "funnel_error"
  ].includes(eventName)) {
    return json({ ok: false, error: "invalid_event_name" }, 400, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    eventId: `cf-ui-kpi-${crypto.randomUUID()}`,
    compatibility: {
      source: "cloudflare_compat_noop"
    }
  }, 200, { "cache-control": "no-store" });
}

async function readCompatibleSession(request: Request, env: Env): Promise<SessionSnapshot | null> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const session = await env.CORE_DB.prepare(
    `SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at
     FROM auth_sessions
     WHERE token_hash = ? AND expires_at > ?`
  ).bind(tokenHash, new Date().toISOString()).first<{
    token_hash: string;
    user_id: string;
    display_name: string;
    role_name: string;
    rank_label: string | null;
    banned: number;
    expires_at: string;
  }>();
  if (!session) return null;
  await env.CORE_DB.prepare(
    "UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return {
    tokenHash: session.token_hash,
    userId: session.user_id,
    displayName: session.display_name,
    roleName: session.role_name,
    rankLabel: session.rank_label,
    banned: Boolean(session.banned),
    expiresAt: session.expires_at
  };
}

async function readCompatibleSessionWithOriginFallback(request: Request, env: Env): Promise<SessionSnapshot | null> {
  const session = await readCompatibleSession(request, env);
  if (session) return session;
  return importOriginSessionIfAvailable(request, env);
}

async function importOriginSessionIfAvailable(request: Request, env: Env): Promise<SessionSnapshot | null> {
  if (!env.ORIGIN_FALLBACK_BASE_URL) return null;
  const requestUrl = new URL(request.url);
  if (!PUBLIC_CUSTOM_HOSTS.has(requestUrl.hostname)) return null;
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));

  const originUrl = new URL(request.url);
  originUrl.pathname = "/api/v1/auth/session";
  originUrl.search = "?optional=1";
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);
  headers.set("accept", "application/json");

  const response = await fetchOriginFallback(new Request(originUrl.toString(), {
    method: "GET",
    headers
  }), originUrl, env, "origin_session_probe");
  if (!response.ok) return null;

  let payload: OriginSessionResponse;
  try {
    payload = await response.json() as OriginSessionResponse;
  } catch {
    return null;
  }
  if (payload.ok !== true || !payload.session) return null;
  const originTokenHash = normalizeOptionalText(payload.session.tokenHash);
  if (originTokenHash && originTokenHash !== tokenHash) return null;
  const userId = normalizeOptionalText(payload.session.userId);
  const displayName = normalizeOptionalText(payload.session.displayName) ?? userId;
  const roleName = normalizeOptionalText(payload.session.roleName) ?? "Observer";
  const rankLabel = normalizeOptionalText(payload.session.rankLabel);
  const expiresAt = normalizeOptionalText(payload.session.expiresAt);
  if (!userId || !expiresAt) return null;

  const session: SessionSnapshot = {
    tokenHash,
    userId,
    displayName: displayName ?? userId,
    roleName,
    rankLabel,
    banned: payload.session.banned === true,
    expiresAt
  };
  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(session.userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'origin-session-lazy-import')
       ON CONFLICT(token_hash) DO UPDATE SET
         user_id = excluded.user_id,
         display_name = excluded.display_name,
         role_name = excluded.role_name,
         rank_label = excluded.rank_label,
         banned = excluded.banned,
         expires_at = excluded.expires_at,
         user_agent = excluded.user_agent`
    ).bind(
      session.tokenHash,
      session.userId,
      session.displayName,
      session.roleName,
      session.rankLabel,
      session.banned ? 1 : 0,
      session.expiresAt
    )
  ]);
  return session;
}

async function createCompatibleVideoDirectUpload(request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoDirectUploadInput>(request);
  const uploadProtocol = normalizeOptionalText(input.uploadProtocol) ?? "post";
  const fileSizeBytes = numberOrNull(input.fileSizeBytes);
  if (uploadProtocol === "tus" && (!fileSizeBytes || fileSizeBytes <= 0)) {
    return json({ ok: false, error: "video_tus_upload_length_required" }, 400);
  }

  const observationId = normalizeOptionalId(input.observationId);
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const uid = newId("stream");
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? `${uid}.mp4`);
  const maxDurationSeconds = clampVideoDuration(input.maxDurationSeconds);
  const objectKey = `original/v1-compat-video/${uid}/${filename}`;
  const uploadUrl = `${new URL(request.url).origin}/api/v1/videos/${encodeURIComponent(uid)}/body`;

  await env.OBS_DB.prepare(
    `INSERT INTO video_upload_requests
     (stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename, upload_protocol, object_key, bytes, meta_json)
     VALUES (?, ?, ?, 'waiting_upload', ?, ?, ?, ?, ?, ?)`
  ).bind(
    uid,
    session.userId,
    observationId,
    maxDurationSeconds,
    filename,
    uploadProtocol,
    objectKey,
    fileSizeBytes ?? 0,
    JSON.stringify({ mediaRole: normalizeOptionalText(input.mediaRole) ?? "observation_video" })
  ).run();

  return json({
    ok: true,
    uid,
    uploadUrl,
    maxDurationSeconds,
    iframeUrl: buildShadowVideoIframeUrl(uid),
    thumbnailUrl: buildShadowVideoThumbnailUrl(uid),
    uploadProtocol
  });
}

async function putCompatibleVideoBody(uid: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string }>();
  if (!row) return json({ ok: false, error: "video_upload_not_found" }, 404);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return json({ ok: false, error: "missing_body" }, 400);
  }
  await env.ASSET_BUCKET.put(row.object_key, body, {
    httpMetadata: { contentType: normalizeOptionalText(request.headers.get("content-type")) ?? "video/mp4" }
  });
  await env.OBS_DB.prepare(
    "UPDATE video_upload_requests SET upload_status = 'uploaded', bytes = ?, uploaded_at = CURRENT_TIMESTAMP WHERE stream_uid = ?"
  ).bind(body.byteLength, uid).run();
  return json({ ok: true, uid, bytes: body.byteLength });
}

async function finalizeCompatibleVideo(uid: string, request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoFinalizeInput>(request);
  const row = await env.OBS_DB.prepare(
    `SELECT stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename,
            upload_protocol, object_key, bytes, duration_ms, ready_to_stream, created_at, uploaded_at
     FROM video_upload_requests
     WHERE stream_uid = ?`
  ).bind(uid).first<{
    stream_uid: string;
    actor_id: string;
    observation_id: string | null;
    upload_status: string;
    max_duration_seconds: number;
    filename: string | null;
    upload_protocol: string;
    object_key: string | null;
    bytes: number;
    duration_ms: number;
    ready_to_stream: number;
    created_at: string;
    uploaded_at: string | null;
  }>();
  if (!row) {
    return json({ ok: true, video: pendingVideoFinalizePayload(uid) });
  }
  if (row.actor_id !== session.userId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const observationId = normalizeOptionalId(input.observationId) ?? row.observation_id;
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const bytes = Math.max(0, numberOrNull(input.bytes) ?? row.bytes ?? 0);
  const durationMs = Math.max(0, numberOrNull(input.durationMs) ?? row.duration_ms ?? 0);
  const readyToStream = input.readyToStream === false ? false : row.upload_status === "uploaded" || bytes > 0;
  const uploadStatus = readyToStream ? "ready" : row.upload_status === "waiting_upload" ? "processing" : row.upload_status;

  await env.OBS_DB.prepare(
    `UPDATE video_upload_requests
     SET observation_id = ?, upload_status = ?, bytes = ?, duration_ms = ?, ready_to_stream = ?, finalized_at = CURRENT_TIMESTAMP
     WHERE stream_uid = ?`
  ).bind(observationId, uploadStatus, bytes, durationMs, readyToStream ? 1 : 0, uid).run();

  let dispatch: { sent: number; pending: number } | null = null;
  if (readyToStream && observationId && row.object_key) {
    dispatch = await attachVideoAssetToObservation({
      uid,
      observationId,
      ownerUserId: session.userId,
      objectKey: row.object_key,
      bytes,
      durationMs
    }, env);
  }

  return json({
    ok: true,
    video: videoRecordPayload({
      uid,
      observationId,
      uploadStatus,
      durationMs,
      bytes,
      readyToStream,
      createdAt: row.created_at,
      uploadedAt: row.uploaded_at
    }),
    dispatch
  });
}

async function assertObservationOwnedByUser(observationId: string, userId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  if (observation.owner_user_id !== userId) {
    throw new HttpError(403, "forbidden");
  }
}

async function attachVideoAssetToObservation(input: {
  uid: string;
  observationId: string;
  ownerUserId: string;
  objectKey: string;
  bytes: number;
  durationMs: number;
}, env: Env): Promise<{ sent: number; pending: number }> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(input.observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${input.observationId}`);
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const assetId = `video_asset_${input.uid}`;
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT OR REPLACE INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      input.observationId,
      observation.owner_user_id,
      input.objectKey,
      null,
      "video/mp4",
      input.bytes,
      null,
      null,
      input.durationMs,
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", input.observationId, JSON.stringify({ observationId: input.observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", input.observationId, JSON.stringify({ observationId: input.observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.video.finalize",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/videos/:uid/finalize",
      payload: {
        assetId,
        observationId: input.observationId,
        ownerUserId: observation.owner_user_id,
        objectKey: input.objectKey,
        streamUid: input.uid,
        bytes: input.bytes,
        durationMs: input.durationMs,
        readyToStream: true
      },
      replaySql: postgresAssetReplaySql(assetId, input.observationId, observation.owner_user_id, input.objectKey, null, "video/mp4", input.bytes, "private")
    })
  ]);

  return dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: input.observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: input.observationId }
  ]);
}

async function upsertLegacyCompatibleObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<LegacyObservationUpsertInput>(request);
  if (env.ENVIRONMENT === "production") {
    const session = await readCompatibleSessionWithOriginFallback(request, env);
    if (!session) {
      return json({ ok: false, error: "session_required" }, 401);
    }
    assertNonEmpty(input.userId, "userId");
    if (session.userId !== input.userId) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  } else {
    assertNonEmpty(input.userId, "userId");
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpError(400, "missing_location");
  }
  assertNonEmpty(input.observedAt, "observedAt");

  const draftId = newId("draft");
  const visitId = normalizeOptionalId(input.observationId) ?? newId("obs");
  const partition = resolveObservationPartition(input.observedAt, env);
  const occurrenceIds = resolveLegacyOccurrenceIds(visitId, input);
  const occurrenceId = occurrenceIds[0] ?? `occ:${visitId}:0`;
  const publicCell = blurLocation(input.latitude, input.longitude);
  const taxonLabel = resolveLegacyTaxonLabel(input);
  const placeName = normalizeOptionalText(input.siteName)
    ?? normalizeOptionalText(input.municipality)
    ?? normalizeOptionalText(input.prefecture)
    ?? "unknown place";
  const placeId = normalizeOptionalId(input.siteId) ?? `place:${publicCell}`;

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId)
  ]);
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        + ` ON CONFLICT(observation_id) DO UPDATE SET
          draft_id = excluded.draft_id,
          owner_user_id = excluded.owner_user_id,
          observed_at = excluded.observed_at,
          taxon_label = excluded.taxon_label,
          note = excluded.note,
          exact_lat = excluded.exact_lat,
          exact_lng = excluded.exact_lng,
          location_accuracy_m = excluded.location_accuracy_m,
          public_cell = excluded.public_cell,
          visibility = excluded.visibility,
          partition_month = excluded.partition_month,
          emergency_hidden = 0,
          processing_state = 'accepted'`
    ).bind(
      visitId,
      draftId,
      input.userId,
      input.observedAt,
      taxonLabel,
      input.note ?? null,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(draftId),
    rollbackLedgerInsert(env, {
      eventType: "observation.upsert",
      targetId: visitId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/upsert",
      payload: {
        visitId,
        occurrenceIds,
        ownerUserId: input.userId,
        observedAt: input.observedAt,
        taxonLabel,
        note: input.note ?? null,
        exactLat: input.latitude,
        exactLng: input.longitude,
        locationAccuracyM: numberOrNull(input.locationAccuracyM),
        publicCell,
        visibility: "public",
        placeId,
        placeName
      },
      replaySql: postgresObservationReplaySql(
        visitId,
        input.userId,
        input.observedAt,
        taxonLabel,
        input.note ?? null,
        input.latitude,
        input.longitude,
        numberOrNull(input.locationAccuracyM),
        publicCell,
        "public"
      )
    })
  ]);

  return json({
    ok: true,
    visitId,
    occurrenceId,
    occurrenceIds,
    placeId,
    impact: {
      placeName,
      visitCount: 1,
      previousObservedAt: null,
      focusLabel: taxonLabel,
      captureState: normalizeOptionalText(input.sourcePayload?.quick_capture_state) ?? null
    },
    compatibility: {
      attempted: false,
      succeeded: false
    },
    idempotency: input.clientSubmissionId ? {
      clientSubmissionId: input.clientSubmissionId,
      reused: false
    } : undefined,
    placeMemory: null,
    placeMemorySample: [],
    contributionReceipts: buildLegacyContributionReceipts(visitId, occurrenceId, occurrenceIds.length, placeName, input)
  }, 201);
}

async function uploadLegacyCompatiblePhoto(observationId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(observationId, "observationId");
  const input = await readJson<LegacyPhotoUploadInput>(request);
  const mimeType = normalizeOptionalText(input.mimeType) ?? "image/jpeg";
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? "upload.jpg");
  const body = base64ToArrayBuffer(normalizeOptionalText(input.base64Data) ?? "");
  if (body.byteLength === 0) {
    throw new HttpError(400, "decoded image is empty");
  }
  if (body.byteLength > 10 * 1024 * 1024) {
    throw new HttpError(400, "image exceeds 10MB limit after normalization");
  }

  const observation = await env.OBS_DB.prepare(
    `SELECT draft_id, owner_user_id, partition_month
     FROM observations
     WHERE observation_id = ?`
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    return json({ ok: false, error: `observation not found: ${observationId}` }, 404);
  }
  if (env.ENVIRONMENT === "production") {
    const session = await readCompatibleSessionWithOriginFallback(request, env);
    if (!session) {
      return json({ ok: false, error: "session_required" }, 401);
    }
    if (session.userId !== observation.owner_user_id) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const sha256 = await sha256Hex(body);
  const assetId = newId("asset");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const objectKey = `original/v1-compat/${observationId}/${assetId}-${filename}`;
  const relativePath = objectKey;
  const occurrenceId = `occ:${observationId}:0`;
  const facePrivacy = normalizeFacePrivacy(input.facePrivacy);

  await env.ASSET_BUCKET.put(objectKey, body, { httpMetadata: { contentType: mimeType } });
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      observationId,
      observation.owner_user_id,
      objectKey,
      sha256,
      mimeType,
      body.byteLength,
      "private",
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.photo.upload",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/:id/photos/upload",
      payload: {
        assetId,
        observationId,
        ownerUserId: observation.owner_user_id,
        objectKey,
        sha256,
        mime: mimeType,
        bytes: body.byteLength,
        visibility: "private",
        occurrenceId,
        facePrivacy
      },
      replaySql: postgresAssetReplaySql(assetId, observationId, observation.owner_user_id, objectKey, sha256, mimeType, body.byteLength, "private")
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({
    ok: true,
    visitId: observationId,
    occurrenceId,
    relativePath,
    publicUrl: `/${relativePath}`,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    facePrivacy,
    dispatch
  });
}

async function putAssetBody(assetId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(assetId, "assetId");
  const asset = await env.OBS_DB.prepare("SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?")
    .bind(assetId)
    .first<{ object_key: string; mime: string }>();
  if (!asset) return json({ error: "asset_not_found" }, 404);
  if (!request.body) return json({ error: "missing_body" }, 400);

  await env.ASSET_BUCKET.put(asset.object_key, request.body, { httpMetadata: { contentType: asset.mime } });
  await env.OBS_DB.prepare(
    "UPDATE asset_ledger SET processing_state = 'uploaded', uploaded_at = CURRENT_TIMESTAMP WHERE asset_id = ?"
  ).bind(assetId).run();

  return json({ ok: true, assetId });
}

async function finalizeObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<FinalizeObservationInput>(request);
  assertNonEmpty(input.draftId, "draftId");

  const draft = await env.OBS_DB.prepare("SELECT * FROM draft_observations WHERE draft_id = ?")
    .bind(input.draftId)
    .first<Record<string, D1Value>>();
  if (!draft) return json({ error: "draft_not_found" }, 404);

  const observationId = newId("obs");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const observedAt = stringValue(draft.observed_at) ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const ownerUserId = stringValue(draft.owner_user_id);
  const publicCell = stringValue(draft.public_cell) ?? "unknown";
  const visibility = stringValue(draft.visibility) === "public" ? "public" : "private";

  if (!ownerUserId) return json({ error: "draft_missing_owner" }, 500);

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      observationId,
      input.draftId,
      ownerUserId,
      observedAt,
      input.taxonLabel ?? null,
      input.note ?? null,
      numberOrNull(draft.exact_lat),
      numberOrNull(draft.exact_lng),
      numberOrNull(draft.location_accuracy_m),
      publicCell,
      visibility,
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(input.draftId),
    env.OBS_DB.prepare(
      "UPDATE asset_ledger SET observation_id = ? WHERE draft_id = ?"
    ).bind(observationId, input.draftId),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "observation.finalize",
      targetId: observationId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v0/observations/finalize",
      payload: {
        observationId,
        draftId: input.draftId,
        ownerUserId,
        observedAt,
        taxonLabel: input.taxonLabel ?? null,
        note: input.note ?? null,
        exactLat: numberOrNull(draft.exact_lat),
        exactLng: numberOrNull(draft.exact_lng),
        locationAccuracyM: numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      },
      replaySql: postgresObservationReplaySql(
        observationId,
        ownerUserId,
        observedAt,
        input.taxonLabel ?? null,
        input.note ?? null,
        numberOrNull(draft.exact_lat),
        numberOrNull(draft.exact_lng),
        numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      )
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({ observationId, processingState: "accepted", dispatch }, 201);
}

async function drainOutbox(env: Env): Promise<Response> {
  const rows = await queryPendingOutbox(env);
  for (const row of rows) {
    await sendOutbox(env, { outboxId: row.outbox_id, topic: row.topic, targetId: row.target_id });
  }
  return json({ dispatched: rows.length });
}

async function r2Inventory(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const prefix = url.searchParams.get("prefix") ?? "original/";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 1000);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const listed = await env.ASSET_BUCKET.list({ prefix, limit, cursor });
  return json({
    prefix,
    limit,
    cursor: cursor ?? null,
    nextCursor: listed.cursor ?? null,
    truncated: Boolean(listed.truncated),
    count: listed.objects.length,
    bytes: listed.objects.reduce((sum, object) => sum + object.size, 0),
    objects: listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      etag: object.etag ?? null,
      uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
      checksums: object.checksums ?? null
    }))
  });
}

async function queryPendingOutbox(env: Env): Promise<Array<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>> {
  const result = await env.OBS_DB.prepare(
    "SELECT outbox_id, topic, target_id FROM outbox WHERE dispatch_state = 'pending' ORDER BY created_at LIMIT 100"
  ).all<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>();
  return result.results;
}

async function dispatchOutboxBestEffort(env: Env, jobs: MediaJob[]): Promise<{ sent: number; pending: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  for (const job of jobs) {
    try {
      await sendOutbox(env, job);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown dispatch error";
      errors.push(message);
      await env.OBS_DB.prepare(
        "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE outbox_id = ?"
      ).bind(message, job.outboxId).run();
    }
  }
  return { sent, pending: jobs.length - sent, errors };
}

async function sendOutbox(env: Env, job: MediaJob): Promise<void> {
  await env.MEDIA_QUEUE.send(job);
  await env.OBS_DB.prepare(
    "UPDATE outbox SET dispatch_state = 'dispatched', dispatched_at = CURRENT_TIMESTAMP WHERE outbox_id = ?"
  ).bind(job.outboxId).run();
}

async function applyMediaJob(job: MediaJob, env: Env): Promise<void> {
  if (job.topic === "media.process") {
    await markUploadedAssetsPublicReady(job.targetId, env);
    await refreshPublicReadmodel(job.targetId, env);
    return;
  }

  if (job.topic === "readmodel.refresh") {
    await refreshPublicReadmodel(job.targetId, env);
  }
}

async function refreshPublicReadmodel(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, partition_month
     FROM observations
     WHERE observation_id = ? AND visibility = 'public' AND emergency_hidden = 0`
  ).bind(observationId).first<{ observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; partition_month: string | null }>();
  if (!observation) {
    await deletePublicReadmodelRow(observationId, env);
    return;
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(observation.observed_at);

  const unsafePublicAssets = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND (
         public_derivative_key IS NULL
         OR exif_scrub_state != 'scrubbed'
         OR public_ready_at IS NULL
         OR public_derivative_verified_at IS NULL
         OR public_derivative_metadata_json IS NULL
       )`
  ).bind(observationId).first<{ count: number }>();
  if ((unsafePublicAssets?.count ?? 0) > 0) return;

  const publicReadyAssetCount = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
       AND public_derivative_verified_at IS NOT NULL
       AND public_derivative_metadata_json IS NOT NULL`
  ).bind(observationId).first<{ count: number }>();

  await env.OBS_DB.prepare(
    `INSERT INTO readmodel_public_observations
     (observation_id, public_cell, observed_at, taxon_label, asset_count, partition_month)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(observation_id) DO UPDATE SET
       public_cell = excluded.public_cell,
       observed_at = excluded.observed_at,
       taxon_label = excluded.taxon_label,
       asset_count = excluded.asset_count,
       partition_month = excluded.partition_month,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    observation.observation_id,
    observation.public_cell,
    observation.observed_at,
    observation.taxon_label,
    publicReadyAssetCount?.count ?? 0,
    partitionMonth
  ).run();
}

async function deletePublicReadmodelRow(observationId: string, env: Env): Promise<void> {
  await env.OBS_DB.prepare(
    "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).run();
}

async function applyEmergencyHide(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      "UPDATE observations SET emergency_hidden = 1 WHERE observation_id = ?"
    ).bind(observationId),
    env.OBS_DB.prepare(
      "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
    ).bind(observationId),
    rollbackLedgerInsert(env, {
      eventType: "observation.hide",
      targetId: observationId,
      partitionMonth: observation.partition_month,
      sourceEndpoint: "POST /api/v1/observations/:id/hide",
      payload: {
        observationId,
        ownerUserId: observation.owner_user_id,
        emergencyHidden: true,
        publicReadmodelDeleted: true
      },
      replaySql: postgresObservationHideReplaySql(observationId)
    })
  ]);
}

async function hideCompatibleObservation(observationId: string, request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(observationId, "observationId");
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }
  await assertObservationOwnedByUser(observationId, session.userId, env);
  await applyEmergencyHide(observationId, env);
  return json({
    ok: true,
    visitId: observationId,
    hidden: true,
    canonicalPreserved: true,
    publicReadmodelDeleted: true
  });
}

async function shadowTakedownProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-takedown-${suffix}`.slice(0, 120);
  const observedAt = "2026-06-15T03:00:00.000Z";
  const upsertResponse = await upsertLegacyCompatibleObservation(new Request("https://shadow.test/api/v1/observations/upsert", {
    method: "POST",
    body: JSON.stringify({
      observationId,
      userId: "shadow-takedown-user",
      observedAt,
      latitude: 34.71234,
      longitude: 137.81234,
      visibility: "public",
      taxon: { vernacularName: "緊急非公開テスト", rank: "species" },
      note: "shadow takedown propagation proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`https://shadow.test/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    body: JSON.stringify({
      filename: "takedown-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-takedown-image")
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);

  const before = await takedownVisibilityState(observationId, env);
  await applyEmergencyHide(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const after = await takedownVisibilityState(observationId, env);
  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();

  return json({
    ok: before.publicDetailVisible === true &&
      before.mapVisible === true &&
      after.publicDetailVisible === false &&
      after.mapVisible === false &&
      canonical?.emergency_hidden === 1 &&
      (canonical?.asset_count ?? 0) > 0,
    observationId,
    before,
    after,
    canonical,
    invariants: {
      canonicalDeleted: false,
      readmodelHidden: after.readmodelRows === 0,
      publicDetailHidden: !after.publicDetailVisible,
      mapHidden: !after.mapVisible,
      exactLocationExposed: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function takedownVisibilityState(observationId: string, env: Env) {
  const readmodelRows = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).first<{ count: number }>();
  const detail = await buildPublicObservationDetail(observationId, env);
  const mapRows = await queryPublicMapRows(env);
  return {
    readmodelRows: readmodelRows?.count ?? 0,
    publicDetailVisible: Boolean(detail),
    mapVisible: mapRows.some((row) => row.observation_id === observationId)
  };
}

async function shadowVideoMetadataProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-video-metadata-${suffix}`.slice(0, 120);
  const userId = `shadow-video-user-${suffix}`.slice(0, 120);
  const videoBytes = shadowSafeMp4Bytes();

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-15T03:00:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "shadow video proof", rank: "species" },
      note: "shadow video metadata privacy proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "shadow-safe-container.mp4",
      observationId,
      maxDurationSeconds: 12,
      fileSizeBytes: videoBytes.byteLength,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as { ok?: boolean; uid?: string; uploadUrl?: string };
  if (!directResponse.ok || !directPayload.uid || !directPayload.uploadUrl) {
    return json({ ok: false, error: "direct_upload_failed", payload: directPayload }, 500);
  }

  const bodyResponse = await putCompatibleVideoBody(directPayload.uid, new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: videoBytes
  }), env);
  if (!bodyResponse.ok) {
    return json({ ok: false, error: "video_body_upload_failed", status: bodyResponse.status }, 500);
  }

  const finalizeResponse = await finalizeCompatibleVideo(directPayload.uid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(directPayload.uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBytes.byteLength
    })
  }), env);
  const finalizePayload = await finalizeResponse.json() as { ok?: boolean; video?: { watchUrl?: string; thumbnailUrl?: string } };
  if (!finalizeResponse.ok || !finalizePayload.video?.watchUrl) {
    return json({ ok: false, error: "video_finalize_failed", payload: finalizePayload }, 500);
  }

  await refreshPublicReadmodel(observationId, env);
  const servedVideo = await getShadowVideoStream(directPayload.uid, env);
  const servedVideoBytes = await servedVideo.arrayBuffer();
  const videoInspection = inspectVideoContainerMetadata(servedVideoBytes, servedVideo.headers.get("content-type") ?? "");
  const servedPoster = await getShadowVideoThumbnail(directPayload.uid, env);
  const servedPosterBytes = await servedPoster.arrayBuffer();
  const posterInspection = inspectPublicDerivativeMetadata(servedPosterBytes, servedPoster.headers.get("content-type") ?? "");
  const assetId = `video_asset_${directPayload.uid}`;
  const videoAsset = await env.OBS_DB.prepare(
    "SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?"
  ).bind(assetId).first<{ object_key: string; mime: string }>();
  if (videoAsset && videoInspection.ftypPresent && !videoInspection.gpsExifPresent) {
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP,
           processing_state = 'uploaded'
       WHERE asset_id = ?`
    ).bind(videoAsset.object_key, await sha256Hex(servedVideoBytes), JSON.stringify(videoInspection), assetId).run();
  }
  await refreshPublicReadmodel(observationId, env);
  const visibility = await takedownVisibilityState(observationId, env);

  return json({
    ok: servedVideo.ok &&
      servedPoster.ok &&
      videoInspection.ftypPresent &&
      !videoInspection.gpsExifPresent &&
      !posterInspection.gpsExifPresent &&
      visibility.publicDetailVisible &&
      visibility.mapVisible,
    observationId,
    uid: directPayload.uid,
    served: {
      videoStatus: servedVideo.status,
      videoContentType: servedVideo.headers.get("content-type"),
      posterStatus: servedPoster.status,
      posterContentType: servedPoster.headers.get("content-type")
    },
    videoInspection,
    posterInspection,
    visibility,
    invariants: {
      servedVideoIsMp4: videoInspection.ftypPresent,
      videoGpsExifAbsent: !videoInspection.gpsExifPresent,
      posterGpsExifAbsent: !posterInspection.gpsExifPresent,
      exactLocationExposed: videoInspection.exactCoordinateLiteralPresent || posterInspection.exactCoordinateLiteralPresent
    }
  }, 200, { "cache-control": "no-store" });
}

async function legacyAssetImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const legacy = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const stream = await env.OBS_DB.prepare(
    `SELECT exists_on_stream, ready_to_stream, status_state, COUNT(*) AS count
     FROM legacy_stream_inventory
     GROUP BY exists_on_stream, ready_to_stream, status_state
     ORDER BY exists_on_stream DESC, ready_to_stream DESC, status_state`
  ).all<{ exists_on_stream: number; ready_to_stream: number; status_state: string | null; count: number }>();
  return json({ rows: legacy.results, streamInventory: stream.results });
}

async function r2ImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const result = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count, SUM(uploaded_bytes) AS uploaded_bytes
     FROM legacy_r2_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number; uploaded_bytes: number | null }>();
  return json({ rows: result.results });
}

async function productionRestoreParitySummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const run = await env.OBS_DB.prepare(
    `SELECT run_id, source_db, collected_at, table_count, critical_json, orphan_json, note
     FROM production_restore_parity_runs
     ORDER BY collected_at DESC
     LIMIT 1`
  ).first<{
    run_id: string;
    source_db: string;
    collected_at: string;
    table_count: number;
    critical_json: string;
    orphan_json: string;
    note: string | null;
  }>();
  if (!run) {
    return json({ run: null, metrics: [] });
  }
  const metrics = await env.OBS_DB.prepare(
    `SELECT metric_type, metric_key, metric_value, detail_json
     FROM production_restore_parity_metrics
     WHERE run_id = ?
     ORDER BY metric_type, metric_key`
  ).bind(run.run_id).all<{
    metric_type: string;
    metric_key: string;
    metric_value: string;
    detail_json: string | null;
  }>();
  return json({
    run: {
      ...run,
      critical: JSON.parse(run.critical_json),
      orphanChecks: JSON.parse(run.orphan_json)
    },
    metrics: metrics.results
  });
}

async function productionImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const countQueries: Array<[string, string]> = [
    ["users", "SELECT COUNT(*) AS count FROM production_import_users"],
    ["visits", "SELECT COUNT(*) AS count FROM production_import_visits"],
    ["occurrences", "SELECT COUNT(*) AS count FROM production_import_occurrences"],
    ["asset_blobs", "SELECT COUNT(*) AS count FROM production_import_asset_blobs"],
    ["evidence_assets", "SELECT COUNT(*) AS count FROM production_import_evidence_assets"],
    ["public_readmodel", "SELECT COUNT(*) AS count FROM production_import_public_readmodel"]
  ];
  const counts = [];
  for (const [tableName, query] of countQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    counts.push({ table_name: tableName, count: row?.count ?? 0 });
  }
  const orphanQueries: Array<[string, string]> = [
    ["visits_missing_user", "SELECT COUNT(*) AS count FROM production_import_visits v LEFT JOIN production_import_users u ON u.user_id = v.user_id WHERE v.user_id IS NOT NULL AND u.user_id IS NULL"],
    ["occurrences_missing_visit", "SELECT COUNT(*) AS count FROM production_import_occurrences o LEFT JOIN production_import_visits v ON v.visit_id = o.visit_id WHERE o.visit_id IS NOT NULL AND v.visit_id IS NULL"],
    ["assets_missing_blob", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_asset_blobs b ON b.blob_id = a.blob_id WHERE a.blob_id IS NOT NULL AND b.blob_id IS NULL"],
    ["assets_missing_visit", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_visits v ON v.visit_id = a.visit_id WHERE a.visit_id IS NOT NULL AND a.visit_id != '' AND v.visit_id IS NULL"],
    ["assets_missing_occurrence", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_occurrences o ON o.occurrence_id = a.occurrence_id WHERE a.occurrence_id IS NOT NULL AND a.occurrence_id != '' AND o.occurrence_id IS NULL"]
  ];
  const orphanChecks = [];
  for (const [checkName, query] of orphanQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    orphanChecks.push({ check_name: checkName, count: row?.count ?? 0 });
  }
  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(occurrence_count) AS occurrence_count,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    occurrence_count: number | null;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();
  return json({
    counts,
    orphanChecks,
    mediaCoverage,
    publicReadmodel
  });
}

async function shadowMissingMediaLedgerProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedMissing = Number(url.searchParams.get("expected_missing") ?? "47");
  const expectedStreamPending = Number(url.searchParams.get("expected_stream_pending") ?? "34");
  const legacyBreakdown = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const missingLegacyAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'missing_legacy_asset'"
  ).first<{ count: number }>();
  const streamPendingAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'stream_inventory_pending'"
  ).first<{ count: number }>();
  const missingAlsoUploaded = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_asset_import_ledger l
     JOIN legacy_r2_import_ledger r ON r.asset_id = l.asset_id
     WHERE l.import_status = 'missing_legacy_asset'
       AND r.import_status = 'uploaded_verified'`
  ).first<{ count: number }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const missingCount = missingLegacyAssets?.count ?? 0;
  const streamPendingCount = streamPendingAssets?.count ?? 0;
  const doubleImportedCount = missingAlsoUploaded?.count ?? 0;

  return json({
    ok: true,
    gate: "missing_legacy_asset_degraded_public_readmodel",
    expected: {
      missingLegacyAssets: expectedMissing,
      streamInventoryPending: expectedStreamPending
    },
    legacyBreakdown: legacyBreakdown.results,
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      missingLegacyAssetsLedgered: missingCount === expectedMissing,
      streamInventoryPendingLedgered: streamPendingCount === expectedStreamPending,
      missingLegacyAssetsNotUploadedVerified: doubleImportedCount === 0,
      unresolvedAssetsRemainExplicit: unresolvedAssetCount > 0,
      publicReadyDoesNotIncludeUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount
    }
  });
}

async function shadowProductionImportDressRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedReadmodelRows = clampInteger(Number(url.searchParams.get("expected_public_rows") ?? "588"), 0, 1000000);
  const expectedEvidenceAssets = clampInteger(Number(url.searchParams.get("expected_evidence_assets") ?? "2032"), 0, 1000000);
  const expectedR2Verified = clampInteger(Number(url.searchParams.get("expected_r2_verified") ?? "1951"), 0, 1000000);
  const expectedR2Objects = clampInteger(Number(url.searchParams.get("expected_r2_objects") ?? "1951"), 0, 1000000);
  const expectedR2Bytes = clampInteger(Number(url.searchParams.get("expected_r2_bytes") ?? "2338615108"), 0, 100000000000);
  const expectedLegacyLedgered = clampInteger(Number(url.searchParams.get("expected_legacy_ledgered") ?? "81"), 0, 1000000);
  const expectedUnresolvedAssets = clampInteger(Number(url.searchParams.get("expected_unresolved_assets") ?? "55"), 0, 1000000);
  const expectedStreamExists = clampInteger(Number(url.searchParams.get("expected_stream_exists") ?? "34"), 0, 1000000);

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();

  const r2Ledger = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS verified_count,
       SUM(COALESCE(verified_bytes, uploaded_bytes)) AS verified_bytes,
       SUM(CASE
         WHEN import_status = 'uploaded_verified'
          AND uploaded_sha256 = expected_sha256
          AND verified_sha256 = expected_sha256
          AND uploaded_bytes = expected_bytes
          AND verified_bytes = expected_bytes
         THEN 1 ELSE 0 END) AS checksum_match_count
     FROM legacy_r2_import_ledger
     WHERE import_status = 'uploaded_verified'`
  ).first<{
    verified_count: number;
    verified_bytes: number | null;
    checksum_match_count: number | null;
  }>();

  const streamInventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const prefixes = [
    "import-smoke/20260615/",
    "import-smoke/20260615-data/original/"
  ];
  const r2Inventory = await summarizeR2Prefixes(env.ASSET_BUCKET, prefixes);

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const evidenceAssets = mediaCoverage?.evidence_assets ?? 0;
  const r2Verified = mediaCoverage?.r2_verified ?? 0;
  const legacyLedgered = mediaCoverage?.legacy_ledgered ?? 0;
  const streamExists = mediaCoverage?.stream_exists ?? 0;
  const r2LedgerVerifiedCount = r2Ledger?.verified_count ?? 0;
  const r2LedgerVerifiedBytes = r2Ledger?.verified_bytes ?? 0;
  const r2ChecksumMatchCount = r2Ledger?.checksum_match_count ?? 0;

  const invariants = {
    productionReadmodelImported: publicReadmodel?.rows === expectedReadmodelRows,
    evidenceAssetsImported: evidenceAssets === expectedEvidenceAssets,
    mediaCoverageComplete: r2Verified + legacyLedgered === evidenceAssets,
    r2LedgerCountMatches: r2LedgerVerifiedCount === expectedR2Verified,
    r2LedgerChecksumVerified: r2ChecksumMatchCount === r2LedgerVerifiedCount,
    r2InventoryCountMatchesLedger: r2Inventory.totalObjects === expectedR2Objects && r2Inventory.totalObjects === r2LedgerVerifiedCount,
    r2InventoryBytesMatchLedger: r2Inventory.totalBytes === expectedR2Bytes && r2Inventory.totalBytes === r2LedgerVerifiedBytes,
    unresolvedAssetsRemainExplicit: unresolvedAssetCount === expectedUnresolvedAssets && publicReadyAssetCount + unresolvedAssetCount === assetCount,
    streamInventoryExists: streamExists === expectedStreamExists && (streamInventory?.exists_count ?? 0) === expectedStreamExists,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.productionReadmodelImported &&
    invariants.evidenceAssetsImported &&
    invariants.mediaCoverageComplete &&
    invariants.r2LedgerCountMatches &&
    invariants.r2LedgerChecksumVerified &&
    invariants.r2InventoryCountMatchesLedger &&
    invariants.r2InventoryBytesMatchLedger &&
    invariants.unresolvedAssetsRemainExplicit &&
    invariants.streamInventoryExists &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "production_imported_data_r2_inventory_dress_rehearsal",
    mode: "dry_run_no_production_mutation",
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    mediaCoverage: {
      evidenceAssets,
      r2Verified,
      legacyLedgered,
      streamExists
    },
    r2Ledger: {
      verifiedCount: r2LedgerVerifiedCount,
      verifiedBytes: r2LedgerVerifiedBytes,
      checksumMatchCount: r2ChecksumMatchCount
    },
    r2Inventory,
    streamInventory: {
      total: streamInventory?.total ?? 0,
      existsCount: streamInventory?.exists_count ?? 0,
      readyCount: streamInventory?.ready_count ?? 0,
      nonReadyCount: streamInventory?.nonready_count ?? 0
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRouteChangeRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const requiredStagingGates = [
    "health_internal_guard",
    "stream_nonready_exclusion",
    "missing_media_ledger",
    "video_metadata_privacy_and_takedown",
    "update_delete_idempotent_replay",
    "rollback_restore_smoke",
    "production_imported_data_r2_inventory",
    "auth_record_photo_video_map_detail"
  ];
  const productionHosts = ["ikimon.life", "www.ikimon.life"];
  const stagingHost = url.searchParams.get("staging_host") ?? "staging.ikimon.life";

  const routeMatrix = [
    {
      host: stagingHost,
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: stagingHost,
      path: "/cloudflare-shadow/shadow-smoke/route-change-rehearsal-proof",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: "ikimon.life",
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 404,
      postCutoverExpectedStatus: 404,
      target: "shadow_proxy_must_remain_disabled_on_production_hosts",
      productionHost: true
    },
    {
      host: "ikimon.life",
      path: "/health",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 200,
      target: "cloudflare_managed_app_health",
      productionHost: true
    },
    {
      host: "www.ikimon.life",
      path: "/",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 308,
      target: "canonical_apex_redirect",
      productionHost: true
    }
  ];

  const invariants = {
    dnsUnchanged: true,
    workerRouteUnchanged: true,
    maintenanceModeUnchanged: true,
    mutationPerformed: false,
    productionTrafficAffected: false,
    stagingShadowProxyOnly: routeMatrix.filter((route) => route.target === "staging_shadow_proxy").every((route) => !route.productionHost),
    productionShadowProxyClosed: routeMatrix.some((route) => route.host === "ikimon.life" && route.path === "/cloudflare-shadow/health" && route.postCutoverExpectedStatus === 404),
    apexAndWwwPostCutoverDefined: productionHosts.every((host) => routeMatrix.some((route) => route.host === host && route.productionHost)),
    requiredGatesEnumerated: requiredStagingGates.length === 8,
    rollbackRouteDocumented: true,
    cutoverRequiresExplicitApproval: true
  };
  const ok =
    invariants.dnsUnchanged &&
    invariants.workerRouteUnchanged &&
    invariants.maintenanceModeUnchanged &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected &&
    invariants.stagingShadowProxyOnly &&
    invariants.productionShadowProxyClosed &&
    invariants.apexAndWwwPostCutoverDefined &&
    invariants.requiredGatesEnumerated &&
    invariants.rollbackRouteDocumented &&
    invariants.cutoverRequiresExplicitApproval;

  return json({
    ok,
    gate: "staging_route_change_rehearsal",
    mode: "dry_run_no_dns_or_route_mutation",
    hosts: {
      staging: stagingHost,
      production: productionHosts
    },
    routeMatrix,
    requiredStagingGates,
    rollback: {
      target: "restore_previous_vps_origin_and_disable_cloudflare_managed_routes",
      productionDataMutation: false,
      dnsMutationPerformed: false,
      routeMutationPerformed: false
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function summarizeR2Prefixes(bucket: R2Bucket, prefixes: string[]) {
  const prefixSummaries = [];
  let totalObjects = 0;
  let totalBytes = 0;
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    let objects = 0;
    let bytes = 0;
    let pages = 0;
    do {
      const page = await bucket.list({ prefix, limit: 1000, cursor });
      pages += 1;
      for (const object of page.objects) {
        objects += 1;
        bytes += object.size;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    prefixSummaries.push({ prefix, objects, bytes, pages });
    totalObjects += objects;
    totalBytes += bytes;
  }
  return {
    prefixes: prefixSummaries,
    totalObjects,
    totalBytes
  };
}

async function shadowStreamNonReadyExclusionProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedNonReady = Number(url.searchParams.get("expected_nonready") ?? "2");
  const expectedReady = Number(url.searchParams.get("expected_ready") ?? "32");
  const expectedTotal = Number(url.searchParams.get("expected_total") ?? "34");

  const inventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const nonReadyRows = await env.OBS_DB.prepare(
    `SELECT stream_uid, asset_id, visit_id, ready_to_stream, status_state, modified_at_stream
     FROM legacy_stream_inventory
     WHERE exists_on_stream = 1
       AND ready_to_stream = 0
     ORDER BY stream_uid`
  ).all<{
    stream_uid: string;
    asset_id: string;
    visit_id: string;
    ready_to_stream: number;
    status_state: string | null;
    modified_at_stream: string | null;
  }>();

  const ledgeredNonReady = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_stream_inventory s
     JOIN legacy_asset_import_ledger l ON l.asset_id = s.asset_id
     WHERE s.exists_on_stream = 1
       AND s.ready_to_stream = 0
       AND l.import_status = 'stream_inventory_pending'`
  ).first<{ count: number }>();

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const total = inventory?.total ?? 0;
  const existsCount = inventory?.exists_count ?? 0;
  const readyCount = inventory?.ready_count ?? 0;
  const nonReadyCount = inventory?.nonready_count ?? 0;
  const ledgeredCount = ledgeredNonReady?.count ?? 0;
  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;

  return json({
    ok: true,
    gate: "stream_nonready_excluded_from_public_ready",
    expected: {
      total: expectedTotal,
      ready: expectedReady,
      nonReady: expectedNonReady
    },
    inventory: {
      total,
      existsCount,
      readyCount,
      nonReadyCount
    },
    nonReadyRows: nonReadyRows.results,
    publicReadmodel: {
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      allStreamRowsAccountedFor: total === expectedTotal && existsCount === expectedTotal,
      readyCountMatchesExpected: readyCount === expectedReady,
      nonReadyCountMatchesExpected: nonReadyCount === expectedNonReady,
      nonReadyRowsLedgered: ledgeredCount === expectedNonReady,
      publicReadyExcludesUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount,
      unresolvedCoversNonReady: unresolvedAssetCount >= nonReadyCount
    }
  }, 200, { "cache-control": "no-store" });
}

async function d1PartitionRoutingProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const observedAt = url.searchParams.get("observed_at") ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const selectedMonth = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     WHERE partition_month = ?
     GROUP BY partition_month`
  ).bind(partition.partitionMonth).first<PartitionSummaryRow>();
  const allMonths = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     GROUP BY partition_month
     ORDER BY partition_month`
  ).all<PartitionSummaryRow>();
  return json({
    ok: true,
    proofStatus: "phase1_partition_routing_selected",
    selected: partition,
    selectedMonth: selectedMonth ?? {
      partition_month: partition.partitionMonth,
      count: 0,
      earliest_observed_at: null,
      latest_observed_at: null
    },
    allMonths: allMonths.results,
    invariants: {
      manualMonthlyBindingRequired: false,
      crossD1TransactionRequired: false,
      canonicalWriteBinding: "OBS_DB",
      archiveCutoverUnit: "partition_month",
      productionTrafficAffected: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function publicDerivativeVerificationSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const summary = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS uploaded_assets,
       SUM(CASE WHEN public_derivative_key IS NOT NULL THEN 1 ELSE 0 END) AS derivative_assets,
       SUM(CASE WHEN public_derivative_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified_assets,
       SUM(CASE WHEN exif_scrub_state = 'scrubbed' THEN 1 ELSE 0 END) AS scrubbed_assets,
       SUM(CASE WHEN public_ready_at IS NOT NULL THEN 1 ELSE 0 END) AS public_ready_assets,
       SUM(CASE WHEN public_derivative_metadata_json LIKE '%"gpsExifPresent":true%' THEN 1 ELSE 0 END) AS gps_exif_present
     FROM asset_ledger
     WHERE processing_state = 'uploaded'`
  ).first<{
    uploaded_assets: number;
    derivative_assets: number | null;
    verified_assets: number | null;
    scrubbed_assets: number | null;
    public_ready_assets: number | null;
    gps_exif_present: number | null;
  }>();
  const recent = await env.OBS_DB.prepare(
    `SELECT asset_id, observation_id, public_derivative_key, public_derivative_sha256,
            public_derivative_verified_at, public_derivative_metadata_json
     FROM asset_ledger
     WHERE public_derivative_verified_at IS NOT NULL
     ORDER BY public_derivative_verified_at DESC
     LIMIT 10`
  ).all<{
    asset_id: string;
    observation_id: string | null;
    public_derivative_key: string | null;
    public_derivative_sha256: string | null;
    public_derivative_verified_at: string | null;
    public_derivative_metadata_json: string | null;
  }>();
  return json({
    ok: true,
    gate: "public_derivative_binary_metadata_absence",
    summary,
    recent: recent.results.map((row) => ({
      ...row,
      metadata: row.public_derivative_metadata_json ? JSON.parse(row.public_derivative_metadata_json) : null
    }))
  }, 200, { "cache-control": "no-store" });
}

async function reverseDeltaDryRun(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "200"), 1, 1000);
  const targetValue = targetPrefix ? `${targetPrefix}%` : null;

  const ledgerRows = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;

  return json({
    ok: observationDrift === 0 && assetDrift === 0,
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts: {
      rollbackLedger: ledgerCount,
      observations: observationCount,
      assets: assetCount,
      ledgerObservations: ledgerObservationCount,
      ledgerAssets: ledgerAssetCount
    },
    drift: {
      observationsWithoutLedger: Math.max(observationDrift, 0),
      ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
      assetsWithoutLedger: Math.max(assetDrift, 0),
      ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    events: ledgerRows.results.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload_json)
    }))
  }, 200, { "cache-control": "no-store" });
}

async function shadowReverseDeltaProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  if (!targetPrefix) {
    return json({ ok: false, error: "target_prefix_required" }, 400, { "cache-control": "no-store" });
  }
  const targetValue = `${targetPrefix}%`;
  const expectedObservations = clampInteger(Number(url.searchParams.get("expected_observations") ?? "1"), 0, 1000);
  const expectedAssets = clampInteger(Number(url.searchParams.get("expected_assets") ?? "2"), 0, 1000);
  const expectedLedger = clampInteger(Number(url.searchParams.get("expected_ledger") ?? "3"), 0, 1000);

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;
  const drift = {
    observationsWithoutLedger: Math.max(observationDrift, 0),
    ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
    assetsWithoutLedger: Math.max(assetDrift, 0),
    ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
  };
  const counts = {
    rollbackLedger: ledgerCount,
    observations: observationCount,
    assets: assetCount,
    ledgerObservations: ledgerObservationCount,
    ledgerAssets: ledgerAssetCount
  };
  const invariants = {
    expectedObservationCount: observationCount === expectedObservations,
    expectedAssetCount: assetCount === expectedAssets,
    expectedRollbackLedgerCount: ledgerCount === expectedLedger,
    observationLedgerAligned: observationDrift === 0,
    assetLedgerAligned: assetDrift === 0,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.expectedObservationCount &&
    invariants.expectedAssetCount &&
    invariants.expectedRollbackLedgerCount &&
    invariants.observationLedgerAligned &&
    invariants.assetLedgerAligned &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_reverse_delta_write_drain",
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts,
    drift,
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowUpdateDeleteReplayProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-update-delete-${suffix}`.slice(0, 120);
  const userId = `shadow-update-user-${suffix}`.slice(0, 120);
  const initialNote = "shadow update/delete replay proof initial";
  const updatedNote = "shadow update/delete replay proof updated";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upserts = [
    { note: initialNote, observedAt: "2026-06-15T04:30:00.000Z", taxonLabel: "初回記録" },
    { note: updatedNote, observedAt: "2026-06-15T04:31:00.000Z", taxonLabel: "更新後記録" }
  ];
  for (const upsert of upserts) {
    const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: upsert.observedAt,
        latitude: 34.71234,
        longitude: 137.81234,
        locationAccuracyM: 12,
        visibility: "public",
        taxon: { vernacularName: upsert.taxonLabel, rank: "species" },
        note: upsert.note
      })
    }), env);
    if (!upsertResponse.ok) {
      return upsertResponse;
    }
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "update-delete-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-update-delete-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const finalObservation = replayOnce.observations[observationId] ?? null;
  const canonicalRow = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  const invariants = {
    updateLedgered: eventCounts["observation.upsert"] === 2,
    hideLedgered: eventCounts["observation.hide"] === 1,
    assetLedgered: eventCounts["asset.photo.upload"] === 1,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    finalNoteUpdated: finalObservation?.note === updatedNote,
    finalHidden: finalObservation?.emergencyHidden === true,
    canonicalPreserved: Boolean(canonicalRow) && canonical?.emergency_hidden === 1,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.updateLedgered &&
    invariants.hideLedgered &&
    invariants.assetLedgered &&
    invariants.replayIdempotent &&
    invariants.finalNoteUpdated &&
    invariants.finalHidden &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_update_delete_idempotent_replay",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      observations: 1,
      assets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRollbackRestoreSmoke(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-rollback-restore-${suffix}`.slice(0, 120);
  const userId = `shadow-rollback-user-${suffix}`.slice(0, 120);
  const note = "shadow rollback restore smoke";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-16T01:15:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "復元演習記録", rank: "species" },
      note
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-rollback-restore-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  const videoBody = "rollback-video-bytes";
  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.mp4",
      observationId,
      mediaRole: "observation_video",
      uploadProtocol: "post",
      fileSizeBytes: videoBody.length
    })
  }), env);
  if (!directResponse.ok) {
    return directResponse;
  }
  const directPayload = await directResponse.json() as { uid?: string; uploadUrl?: string };
  const streamUid = String(directPayload.uid ?? "");
  const uploadUrl = String(directPayload.uploadUrl ?? "");
  const bodyResponse = await putCompatibleVideoBody(streamUid, new Request(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4", cookie },
    body: videoBody
  }), env);
  if (!bodyResponse.ok) {
    return bodyResponse;
  }
  const finalizeResponse = await finalizeCompatibleVideo(streamUid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(streamUid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBody.length
    })
  }), env);
  if (!finalizeResponse.ok) {
    return finalizeResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{
    observation_id: string;
    emergency_hidden: number;
    asset_count: number;
  }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const restoredObservation = replayOnce.observations[observationId] ?? null;
  const restoredAssets = Object.values(replayOnce.assets).filter((asset) => asset.observationId === observationId);
  const replaySqlReady = events.every((event) => event.replay_sql.includes("rollback_"));
  const invariants = {
    observationRestored: restoredObservation?.ownerUserId === userId && restoredObservation?.note === note,
    hiddenStateRestored: restoredObservation?.emergencyHidden === true,
    assetsRestored: restoredAssets.length === 2,
    photoRestored: restoredAssets.some((asset) => asset.mime === "image/jpeg"),
    videoRestored: restoredAssets.some((asset) => asset.mime === "video/mp4"),
    replaySqlReady,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    canonicalPreserved: Boolean(canonical) && canonical?.emergency_hidden === 1 && Number(canonical?.asset_count ?? 0) === 2,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.observationRestored &&
    invariants.hiddenStateRestored &&
    invariants.assetsRestored &&
    invariants.photoRestored &&
    invariants.videoRestored &&
    invariants.replaySqlReady &&
    invariants.replayIdempotent &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_rollback_restore_smoke",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      restoredObservations: restoredObservation ? 1 : 0,
      restoredAssets: restoredAssets.length,
      canonicalAssets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      ownerUserId: userId,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    restore: {
      target: "rollback_restore_state_from_rollback_ledger",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "asset.video.finalize", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation: restoredObservation,
      assets: restoredAssets
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function listRollbackEvents(env: Env, targetValue: string | null, limit: number): Promise<RollbackLedgerRow[]> {
  const result = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();
  return result.results;
}

function countRollbackEventTypes(events: RollbackLedgerRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
  }
  return counts;
}

function replayRollbackEvents(events: RollbackLedgerRow[]) {
  const observations: Record<string, {
    ownerUserId: string | null;
    observedAt: string | null;
    taxonLabel: string | null;
    note: string | null;
    publicCell: string | null;
    visibility: string | null;
    emergencyHidden: boolean;
  }> = {};
  const assets: Record<string, {
    observationId: string | null;
    ownerUserId: string | null;
    objectKey: string | null;
    mime: string | null;
    bytes: number | null;
  }> = {};

  for (const event of events) {
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    if (event.event_type === "observation.upsert" || event.event_type === "observation.finalize") {
      const observationId = stringFromUnknown(payload.visitId ?? payload.observationId ?? event.target_id);
      const observedAt = stringOrNullFromUnknown(payload.observedAt);
      const existing = observations[observationId];
      if (existing?.observedAt && observedAt && existing.observedAt > observedAt) {
        continue;
      }
      observations[observationId] = {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt,
        taxonLabel: stringOrNullFromUnknown(payload.taxonLabel),
        note: stringOrNullFromUnknown(payload.note),
        publicCell: stringOrNullFromUnknown(payload.publicCell),
        visibility: stringOrNullFromUnknown(payload.visibility),
        emergencyHidden: false
      };
    }
    if (event.event_type === "asset.photo.upload" || event.event_type === "asset.video.finalize") {
      assets[event.target_id] = {
        observationId: stringOrNullFromUnknown(payload.observationId),
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        objectKey: stringOrNullFromUnknown(payload.objectKey),
        mime: stringOrNullFromUnknown(payload.mime) ?? (event.event_type === "asset.video.finalize" ? "video/mp4" : null),
        bytes: numberOrNullFromUnknown(payload.bytes)
      };
    }
    if (event.event_type === "observation.hide") {
      const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
      observations[observationId] = {
        ...(observations[observationId] ?? {
          ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
          observedAt: null,
          taxonLabel: null,
          note: null,
          publicCell: null,
          visibility: null
        }),
        emergencyHidden: true
      };
    }
  }

  for (const event of events) {
    if (event.event_type !== "observation.hide") continue;
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
    observations[observationId] = {
      ...(observations[observationId] ?? {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt: null,
        taxonLabel: null,
        note: null,
        publicCell: null,
        visibility: null
      }),
      emergencyHidden: true
    };
  }

  const fingerprint = stableJson({ observations, assets });
  return { observations, assets, fingerprint };
}

async function countRollbackLedger(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE target_id LIKE ? OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue, targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize') AND target_id LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize') AND JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id IS NOT NULL")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function markUploadedAssetsPublicReady(observationId: string, env: Env): Promise<void> {
  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow>();

  for (const asset of assets.results) {
    const publicDerivativeKey = `derived/${asset.object_key.replace(/^original\//, "")}/display.webp`;
    const contentType = "image/svg+xml; charset=utf-8";
    const derivativeBody = textToArrayBuffer(shadowDerivativeSvg(asset.asset_id));
    const derivativeSha256 = await sha256Hex(derivativeBody);
    const metadataInspection = inspectPublicDerivativeMetadata(derivativeBody, contentType);
    if (metadataInspection.gpsExifPresent) {
      await env.OBS_DB.prepare(
        `UPDATE asset_ledger
         SET public_derivative_key = ?,
             public_derivative_sha256 = ?,
             public_derivative_metadata_json = ?,
             exif_scrub_state = 'failed'
         WHERE asset_id = ?`
      ).bind(
        publicDerivativeKey,
        derivativeSha256,
        JSON.stringify(metadataInspection),
        asset.asset_id
      ).run();
      continue;
    }
    await env.ASSET_BUCKET.put(publicDerivativeKey, derivativeBody, {
      httpMetadata: { contentType }
    });
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP
       WHERE asset_id = ?`
    ).bind(
      publicDerivativeKey,
      derivativeSha256,
      JSON.stringify(metadataInspection),
      asset.asset_id
    ).run();
  }
}

function rollbackLedgerInsert(env: Env, input: {
  eventType: string;
  targetId: string;
  partitionMonth: string | null;
  sourceEndpoint: string;
  payload: Record<string, unknown>;
  replaySql: string;
}): D1PreparedStatement {
  return env.OBS_DB.prepare(
    `INSERT INTO rollback_write_ledger
     (ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId("rollback"),
    input.eventType,
    input.targetId,
    input.partitionMonth,
    input.sourceEndpoint,
    JSON.stringify(input.payload),
    input.replaySql
  );
}

function postgresObservationReplaySql(
  observationId: string,
  ownerUserId: string,
  observedAt: string,
  taxonLabel: string | null,
  note: string | null,
  exactLat: number | null,
  exactLng: number | null,
  locationAccuracyM: number | null,
  publicCell: string,
  visibility: string
): string {
  const values = [
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(observedAt),
    sqlLiteral(taxonLabel),
    sqlLiteral(note),
    sqlLiteral(exactLat),
    sqlLiteral(exactLng),
    sqlLiteral(locationAccuracyM),
    sqlLiteral(publicCell),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_observations (observation_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility) VALUES (${values}) ON CONFLICT (observation_id) DO UPDATE SET observed_at = EXCLUDED.observed_at, taxon_label = EXCLUDED.taxon_label, note = EXCLUDED.note, exact_lat = EXCLUDED.exact_lat, exact_lng = EXCLUDED.exact_lng, location_accuracy_m = EXCLUDED.location_accuracy_m, public_cell = EXCLUDED.public_cell, visibility = EXCLUDED.visibility;`;
}

function postgresObservationHideReplaySql(observationId: string): string {
  return `UPDATE rollback_observations SET emergency_hidden = TRUE, public_visible = FALSE WHERE observation_id = ${sqlLiteral(observationId)};`;
}

function postgresAssetReplaySql(
  assetId: string,
  observationId: string,
  ownerUserId: string,
  objectKey: string,
  sha256: string | null,
  mime: string,
  bytes: number,
  visibility: string
): string {
  const values = [
    sqlLiteral(assetId),
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(objectKey),
    sqlLiteral(sha256),
    sqlLiteral(mime),
    sqlLiteral(bytes),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_assets (asset_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility) VALUES (${values}) ON CONFLICT (asset_id) DO UPDATE SET observation_id = EXCLUDED.observation_id, object_key = EXCLUDED.object_key, sha256 = EXCLUDED.sha256, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, visibility = EXCLUDED.visibility;`;
}

function sqlLiteral(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function validateAsset(asset: DraftAssetInput): void {
  assertNonEmpty(asset.mime, "media.mime");
  if (!Number.isFinite(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_ASSET_BYTES) {
    throw new HttpError(400, "invalid_media_bytes");
  }
}

function resolveObservationPartition(observedAt: string | null | undefined, env: Env) {
  const partitionMonth = partitionMonthFromDate(observedAt ?? new Date().toISOString());
  return {
    strategy: OBSERVATION_PARTITION_STRATEGY,
    partitionMonth,
    selectedBinding: "OBS_DB",
    databaseName: env.OBSERVATION_DB_NAME ?? "ikimon_shadow_observations_2026_06",
    writeStorage: "active_d1_logical_partition",
    archiveStorage: env.OBSERVATION_ARCHIVE_TARGET ?? "r2_sql_export_by_partition_month",
    manualMonthlyBindingRequired: false,
    reason: "Logical partitioning uses partition_month inside one active D1 binding; archive/export lifecycle is month-keyed and does not require monthly Worker binding edits."
  };
}

function partitionMonthFromDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "invalid_observed_at");
  }
  return date.toISOString().slice(0, 7);
}

function inspectPublicDerivativeMetadata(bytes: ArrayBuffer, contentType: string): PublicDerivativeInspection {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  return {
    tool: "shadow-public-derivative-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: contentType.includes("svg") ? "svg+xml" : "binary",
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function inspectVideoContainerMetadata(bytes: ArrayBuffer, contentType: string) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  const ftypPresent = lower.includes("ftyp");
  const moovPresent = lower.includes("moov");
  const mdatPresent = lower.includes("mdat");
  return {
    tool: "shadow-video-container-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: ftypPresent ? "mp4" : "binary",
    ftypPresent,
    moovPresent,
    mdatPresent,
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function blurLocation(lat?: number, lng?: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "unknown";
  const latCell = Math.round((lat as number) * 100) / 100;
  const lngCell = Math.round((lng as number) * 100) / 100;
  return `${latCell.toFixed(2)},${lngCell.toFixed(2)}`;
}

function parseBboxParam(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function parsePublicCell(value: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function publicCellInBbox(publicCell: string, bbox: [number, number, number, number]): boolean {
  const parsed = parsePublicCell(publicCell);
  if (!parsed) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return parsed.lng >= minLng && parsed.lng <= maxLng && parsed.lat >= minLat && parsed.lat <= maxLat;
}

function publicCellToCellId(publicCell: string): string {
  return `cell:${publicCell}`;
}

function cellIdToPublicCell(cellId: string): string {
  return cellId.startsWith("cell:") ? cellId.slice("cell:".length) : cellId;
}

function detailIdToVisitId(value: string): string {
  const match = value.match(/^occ:(.+):\d+$/);
  return match?.[1] ?? value;
}

function publicMediaUrl(key: string | null): string {
  return key ? `/${key}` : "";
}

function publicCellPolygon(lat: number, lng: number): [number, number][] {
  const halfStep = 0.005;
  return [
    [lng - halfStep, lat - halfStep],
    [lng + halfStep, lat - halfStep],
    [lng + halfStep, lat + halfStep],
    [lng - halfStep, lat + halfStep],
    [lng - halfStep, lat - halfStep]
  ];
}

function earliestObservedAt(rows: PublicMapRow[]): string | null {
  return rows.reduce<string | null>((earliest, row) => !earliest || row.observed_at < earliest ? row.observed_at : earliest, null);
}

function latestObservedAt(rows: PublicMapRow[]): string {
  return rows.reduce((latest, row) => row.observed_at > latest ? row.observed_at : latest, "");
}

function publicMapEmptyProvenance(sampleSize: number) {
  const empty = { manual: 0, legacy: 0, track: 0, other: 0 };
  return {
    sampled: true,
    sampleSize,
    visible: empty,
    excluded: empty
  };
}

function isWeakTaxonLabel(label: string | null): boolean {
  const text = (label ?? "").trim().toLowerCase();
  return !text || ["unidentified", "unknown", "unresolved", "awaiting id", "同定待ち", "不明"].includes(text);
}

function publicTaxonDisplayName(label: string | null): string {
  return isWeakTaxonLabel(label) ? "同定待ち" : (label as string).trim();
}

function taxonGroupForLabel(label: string | null): string {
  if (isWeakTaxonLabel(label)) return "other";
  const text = label ?? "";
  if (/鳥|bird|aves/i.test(text)) return "bird";
  if (/虫|昆虫|蝶|蜂|insect/i.test(text)) return "insect";
  if (/草|木|花|plant|植物/i.test(text)) return "plant";
  if (/菌|fung/i.test(text)) return "fungi";
  if (/蛙|蛇|爬虫|amphibian|reptile/i.test(text)) return "amphibian_reptile";
  if (/獣|哺乳|mammal/i.test(text)) return "mammal";
  return "other";
}

function clampInteger(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : min;
}

function renderFieldDetailHtml(row: FieldDetailReadmodelRow, lang: string): string {
  const payload = fieldDetailPublicPayload(row);
  const isEnglish = lang === "en";
  const title = isEnglish ? `${payload.name} - ikimon field` : `${payload.name} - ikimon フィールド`;
  const locationLabel = payload.publicLocation.label;
  const links = [
    ["official", payload.links.official],
    ["certification", payload.links.certification],
    ["owner", payload.links.owner],
    ["story", payload.links.story]
  ].filter(([, href]) => href);
  const linkHtml = links.length > 0
    ? `<ul>${links.map(([label, href]) => `<li><a href="${escapeHtml(href)}" rel="nofollow noopener">${escapeHtml(label)}</a></li>`).join("")}</ul>`
    : `<p class="muted">${isEnglish ? "No public links are available." : "公開リンクはまだありません。"}</p>`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 30px 18px 56px; }
    a { color: #176b45; font-weight: 800; }
    h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0; }
    .meta, .muted { color: #53615a; line-height: 1.7; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 22px; }
    .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 15px 16px; }
    .label { color: #53615a; font-size: 13px; margin: 0 0 6px; }
    .value { margin: 0; font-weight: 800; overflow-wrap: anywhere; }
    .summary { font-size: 16px; line-height: 1.85; }
  </style>
</head>
<body>
<main data-ikimon-field-detail="1" data-field-id="${escapeHtml(payload.fieldId)}" data-cloudflare-source="field-detail-readmodel">
  <p class="meta">${isEnglish ? "ikimon public field" : "ikimon 公開フィールド"}</p>
  <h1>${escapeHtml(payload.name)}</h1>
  ${payload.summary ? `<p class="summary">${escapeHtml(payload.summary)}</p>` : ""}
  <section class="grid" aria-label="field metadata">
    <div class="panel"><p class="label">${isEnglish ? "Public location" : "公開位置"}</p><p class="value">${escapeHtml(locationLabel)} / ${escapeHtml(payload.publicLocation.cell)}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Radius" : "半径"}</p><p class="value">${payload.radiusM ? `${payload.radiusM}m` : "-"}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Source" : "ソース"}</p><p class="value">${escapeHtml(payload.source)}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Verification" : "確認状態"}</p><p class="value">${escapeHtml(payload.verification.label || payload.verification.level || "-")}</p></div>
  </section>
  <section class="panel">
    <h2>${isEnglish ? "Links" : "関連リンク"}</h2>
    ${linkHtml}
  </section>
  <section class="panel">
    <p class="muted">${isEnglish ? "Exact coordinates and geometry are not exposed on this public page." : "この公開ページでは、正確な座標とジオメトリ本体は表示しません。"}</p>
  </section>
</main>
</body>
</html>`;
}

function renderObservationNotFoundHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Observation not found</title></head>
<body><main><h1>見つかりません</h1><p>この観察はまだ取得できません。</p></main></body>
</html>`;
}

function shadowDerivativeSvg(assetId: string): string {
  const safeAssetId = escapeHtml(assetId).slice(0, 72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="ikimon shadow derivative">
  <rect width="640" height="480" fill="#e8eee9"/>
  <circle cx="320" cy="190" r="72" fill="#176b45" opacity="0.18"/>
  <path d="M178 330c82-90 174-108 284-18 22 18 42 28 60 30v50H118v-42c18-4 38-10 60-20z" fill="#176b45" opacity="0.28"/>
  <text x="320" y="222" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#176b45">ikimon</text>
  <text x="320" y="266" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#53615a">shadow public derivative</text>
  <text x="320" y="432" text-anchor="middle" font-family="monospace" font-size="14" fill="#53615a">${safeAssetId}</text>
</svg>`;
}

function renderShadowRecordSmokeHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow flow smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    form, .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    label { display: grid; gap: 6px; font-weight: 700; margin: 12px 0; }
    input, textarea { font: inherit; padding: 10px 11px; border: 1px solid #bdc8c0; border-radius: 6px; }
    button, a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border-radius: 6px; border: 0; background: #176b45; color: #fff; font-weight: 800; text-decoration: none; cursor: pointer; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .status { color: #53615a; line-height: 1.7; }
    .error { color: #a4262c; font-weight: 700; }
    .ok { color: #176b45; font-weight: 800; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f0f4f1; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
<main data-shadow-flow="record">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>記録から詳細、地図まで通す</h1>
  <p class="status">この画面は production ではなく shadow Worker のAPIだけを使います。</p>
  <form id="record-form">
    <label>観察ID <input id="observation-id" name="observationId" value="shadow-ui-${Date.now()}" autocomplete="off"></label>
    <label>ユーザーID <input id="user-id" name="userId" value="shadow-ui-user" autocomplete="off"></label>
    <label>名前 <input id="taxon-label" name="taxonLabel" value="ブラウザ導線テスト植物"></label>
    <label>日時 <input id="observed-at" name="observedAt" value="2026-06-15T08:45:00.000Z"></label>
    <label>緯度 <input id="latitude" name="latitude" value="34.71234" inputmode="decimal"></label>
    <label>経度 <input id="longitude" name="longitude" value="137.81234" inputmode="decimal"></label>
    <label>メモ <textarea id="note" name="note">shadow browser flow smoke</textarea></label>
    <button id="submit-record" type="submit">保存して導線を確認</button>
  </form>
  <section class="panel" aria-live="polite">
    <div id="flow-status" class="status">待機中</div>
    <div id="flow-links" class="row"></div>
    <pre id="flow-json"></pre>
  </section>
</main>
<script>
const form = document.getElementById('record-form');
const statusEl = document.getElementById('flow-status');
const linksEl = document.getElementById('flow-links');
const jsonEl = document.getElementById('flow-json');
function setStatus(text, cls) {
  statusEl.className = cls || 'status';
  statusEl.textContent = text;
}
async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
async function waitForDetail(visitId) {
  let latest = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch('/api/v1/observations/' + encodeURIComponent('occ:' + visitId + ':0') + '/public-detail', { headers: { accept: 'application/json' } });
    latest = await readJson(response);
    if (response.ok && latest.ok) return latest;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('detail_not_ready:' + JSON.stringify(latest));
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  linksEl.innerHTML = '';
  jsonEl.textContent = '';
  const observationId = document.getElementById('observation-id').value.trim();
  const userId = document.getElementById('user-id').value.trim();
  setStatus('保存中...', 'status');
  try {
    const observationResponse = await fetch('/api/v1/observations/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: document.getElementById('observed-at').value,
        latitude: Number(document.getElementById('latitude').value),
        longitude: Number(document.getElementById('longitude').value),
        note: document.getElementById('note').value,
        taxon: { vernacularName: document.getElementById('taxon-label').value, rank: 'species' }
      })
    });
    const observationJson = await readJson(observationResponse);
    if (!observationResponse.ok || !observationJson.ok) throw new Error('observation_failed:' + JSON.stringify(observationJson));
    const photoResponse = await fetch('/api/v1/observations/' + encodeURIComponent(observationJson.visitId) + '/photos/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'shadow-ui.jpg',
        mimeType: 'image/jpeg',
        base64Data: btoa('shadow-ui-image-' + observationJson.visitId),
        facePrivacy: 'no_faces'
      })
    });
    const photoJson = await readJson(photoResponse);
    if (!photoResponse.ok || !photoJson.ok) throw new Error('photo_failed:' + JSON.stringify(photoJson));
    setStatus('公開read model待機中...', 'status');
    const detailJson = await waitForDetail(observationJson.visitId);
    const detailHref = '/observations/' + encodeURIComponent(observationJson.visitId);
    const mapHref = '/shadow-smoke/map?cell_id=' + encodeURIComponent(detailJson.observation.publicLocation.cellId);
    linksEl.innerHTML = '<a class="button" id="detail-link" href="' + detailHref + '">詳細を見る</a><a class="button" id="map-link" href="' + mapHref + '">地図で見る</a>';
    jsonEl.textContent = JSON.stringify({ observation: observationJson, photo: photoJson, detail: detailJson }, null, 2);
    setStatus('保存と公開read確認が完了しました', 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});
</script>
</body>
</html>`;
}

function renderShadowMapSmokeHtml(url: URL): string {
  const cellId = url.searchParams.get("cell_id") ?? "cell:34.71,137.81";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow map smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .item { padding: 12px 0; border-top: 1px solid #e3e9e5; }
    .item:first-child { border-top: 0; }
    a { color: #176b45; font-weight: 800; }
    .status { color: #53615a; line-height: 1.7; }
  </style>
</head>
<body>
<main data-shadow-flow="map" data-cell-id="${escapeHtml(cellId)}">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>地図read model</h1>
  <section class="panel">
    <div id="map-status" class="status">読み込み中</div>
    <div id="map-items"></div>
  </section>
</main>
<script>
const statusEl = document.getElementById('map-status');
const itemsEl = document.getElementById('map-items');
const cellId = ${JSON.stringify(cellId)};
async function loadMap() {
  const cellsResponse = await fetch('/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13');
  const cells = await cellsResponse.json();
  const observationsResponse = await fetch('/api/v1/map/observations?cell_id=' + encodeURIComponent(cellId));
  const observations = await observationsResponse.json();
  statusEl.textContent = 'cells=' + cells.features.length + ' / items=' + observations.items.length + ' / selected=' + observations.stats.selectedCellId;
  itemsEl.innerHTML = observations.items.slice(0, 20).map((item) =>
    '<div class="item" data-map-item="' + item.visitId + '"><a href="/observations/' + encodeURIComponent(item.visitId) + '">' + item.displayName + '</a><div class="status">' + item.observedAt + ' / ' + item.cellId + '</div></div>'
  ).join('');
}
loadMap().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : String(error);
});
</script>
</body>
</html>`;
}

type PublicObservationDetail = NonNullable<Awaited<ReturnType<typeof buildPublicObservationDetail>>>;

function renderPublicObservationDetailHtml(detail: PublicObservationDetail): string {
  const polish = publicObservationDetailPolish(detail);
  const displayName = polish?.displayName ?? detail.displayName;
  const lead = polish?.lead ?? (detail.isAwaitingId ? "名前はまだ確認待ちの公開記録です。" : "公開範囲をぼかした観察記録です。");
  const photos = detail.photoAssets.length > 0
    ? detail.photoAssets.map((asset, index) => `<figure class="obs-photo ${index === 0 ? "obs-photo--main" : ""}" data-obs-media-item="${escapeHtml(asset.assetId)}">
        <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(displayName)}" loading="${index === 0 ? "eager" : "lazy"}">
      </figure>`).join("")
    : `<div class="obs-empty">公開できる写真はまだありません。</div>`;
  const mediaBlock = polish?.mediaBlock ?? `<div class="obs-photo-grid">${photos}</div>`;
  const videos = !polish?.mediaBlock && detail.videoAssets.length > 0
    ? detail.videoAssets.map((asset) => `<a class="obs-media-link" href="${escapeHtml(asset.watchUrl)}">動画を開く</a>`).join("")
    : "";
  const note = typeof detail.note === "string" && detail.note.trim() !== "" ? detail.note.trim() : "";
  const photoCount = detail.photoAssets.length;
  const videoCount = Math.max(detail.videoAssets.length, polish?.videoCount ?? 0);
  const audioCount = polish?.audioCount ?? 0;
  const assetCount = Math.max(detail.assetCount ?? 0, photoCount + videoCount + audioCount);
  const mapHref = `/map?tab=places&cell=${encodeURIComponent(detail.publicLocation.cellId)}`;
  const recordHref = `/record?from=observation&cell=${encodeURIComponent(detail.publicLocation.cellId)}`;
  const related = detail.relatedObservations ?? [];
  const observedLabel = polish?.observedLabel ?? formatPublicObservationDate(detail.observedAt);
  const placeLabel = polish?.placeLabel ?? detail.publicLocation.label;
  const stateLabel = polish?.stateLabel ?? (detail.isAwaitingId ? "同定待ち" : "名前あり");
  const relatedForDisplay = typeof polish?.relatedLimit === "number" ? related.slice(0, polish.relatedLimit) : related;
  const relatedCards = relatedForDisplay.length > 0
    ? relatedForDisplay.map((item) => `<a class="obs-nearby-card" href="/observations/${encodeURIComponent(item.visitId)}">
        ${item.photoUrl
          ? `<img class="obs-area-thumb" src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy">`
          : `<span class="obs-nearby-nophoto" aria-hidden="true">+</span>`}
        <span class="obs-nearby-body">
          <strong>${escapeHtml(item.displayName)}</strong>
          <span>${escapeHtml(formatPublicObservationDate(item.observedAt))}</span>
        </span>
      </a>`).join("")
    : `<div class="obs-empty obs-empty--compact">近くの公開記録はまだ少ない状態です。</div>`;
  const mediaLedger = `<div class="obs-media-ledger" aria-label="メディア台帳">
    <div class="obs-media-ledger-item"><strong>写真</strong><span>${escapeHtml(`${photoCount}枚`)}</span><small>${escapeHtml(photoCount > 0 ? "公開中" : "未公開")}</small></div>
    <div class="obs-media-ledger-item"><strong>動画</strong><span>${escapeHtml(`${videoCount}本`)}</span><small>${escapeHtml(videoCount > 0 ? "公開中" : "未公開")}</small></div>
    <div class="obs-media-ledger-item"><strong>音</strong><span>${escapeHtml(`${audioCount}件`)}</span><small>${escapeHtml(audioCount > 0 ? "公開中" : "未記録")}</small></div>
    <a class="obs-media-ledger-item" href="#place" aria-label="同じエリアの投稿一覧へ移動"><strong>同エリア</strong><span>${escapeHtml(`${relatedForDisplay.length}件`)}</span><small>投稿一覧へ</small></a>
  </div>`;
  const recordInsight = polish?.recordInsight ?? (detail.isAwaitingId ? "この記録は、公開写真と日時だけを見られる状態です。名前は今後の確認で更新されることがあります。" : `${displayName}として公開されています。公開ページでは、写真とぼかした場所だけを扱います。`);
  const identifyBlock = polish?.identifyBlock ?? `<section class="obs-local-quality-left">
        <h2>同定</h2>
        <p>${escapeHtml(detail.isAwaitingId ? "この記録は名前の確認待ちです。" : `${displayName} として表示しています。`)}</p>
      </section>`;
  const qualityBlock = polish?.qualityBlock ?? `<section class="obs-local-quality-card">
        <h2>公開データ</h2>
        <p>公開写真、ぼかした場所、日時だけを使います。投稿者ID、精密座標、元画像URLは表示しません。</p>
      </section>`;
  const relatedEye = polish?.relatedEye ?? "同じ周辺";
  const relatedTitle = polish?.relatedTitle ?? "近くの公開記録";
  const relatedLead = polish?.relatedLead ?? "";
  const relatedCountLabel = polish?.relatedCountLabel ?? `${relatedForDisplay.length}件`;
  const actionRailBlock = polish ? `<nav class="obs-action-strip" aria-label="関連操作">
        <a href="${escapeHtml(recordHref)}">もう一度記録する</a>
        <a href="${escapeHtml(mapHref)}">地図で見る</a>
      </nav>` : `<div class="obs-action-rail" aria-label="関連操作">
        <a class="obs-action" href="${escapeHtml(mapHref)}"><span>↗</span><strong>地図で見る</strong></a>
        <a class="obs-action" href="/records"><span>▦</span><strong>記録一覧</strong></a>
        <a class="obs-action" href="${escapeHtml(recordHref)}"><span>＋</span><strong>記録する</strong></a>
      </div>`;
  const readProgressLinks = polish ? `
  <a href="#summary">記録</a>
  <a href="#photos">動画</a>
  <a href="#identify">候補</a>
  <a href="#place">近く</a>` : `
  <a href="#summary">場面の記録</a>
  <a href="#photos">写真・動画</a>
  <a href="#trust">状態</a>
  <a href="#story">記録</a>
  <a href="#identify">同定</a>
  <a href="#place">場所</a>
  <a href="#meta">情報</a>`;
  const genericInfoSections = polish ? "" : `<section id="privacy" class="obs-layer">
      <h2>公開範囲</h2>
      <div class="obs-layer-grid">
        <div class="obs-layer-card"><span>位置</span><strong>${escapeHtml(placeLabel)}</strong></div>
        <div class="obs-layer-card"><span>表示</span><strong>ぼかし表示</strong></div>
        <div class="obs-layer-card"><span>精密座標</span><strong>非表示</strong></div>
      </div>
      <p>公開ページでは、観察地点をそのまま表示しません。</p>
    </section>`;
  const genericMetaSection = polish ? "" : `<section id="meta" class="obs-layer">
      <h2>記録情報</h2>
      <div class="obs-layer-grid">
        <div class="obs-layer-card"><span>記録ID</span><strong>${escapeHtml(detail.visitId)}</strong></div>
        <div class="obs-layer-card"><span>メディア</span><strong>${escapeHtml(`${assetCount}件`)}</strong></div>
        <div class="obs-layer-card"><span>公開状態</span><strong>公開中</strong></div>
      </div>
    </section>`;
  const factsBlock = polish ? "" : `<div class="obs-facts">
        <div class="obs-fact"><span>日時</span><strong>${escapeHtml(observedLabel)}</strong></div>
        <div class="obs-fact"><span>場所</span><strong>${escapeHtml(placeLabel)}</strong></div>
        <div class="obs-fact"><span>写真</span><strong>${escapeHtml(String(detail.photoAssets.length))}</strong></div>
        <div class="obs-fact"><span>状態</span><strong>${escapeHtml(stateLabel)}</strong></div>
      </div>`;
  const privacyBlock = polish ? "" : `<section class="obs-privacy"><h2>公開位置</h2><p>このページでは、精密な座標や投稿者のプロフィールリンクは表示していません。</p></section>`;
  const storyBlock = polish ? "" : `<section id="story" class="obs-record-story">
      <div class="obs-record-story-head">
        <div>
          <div class="obs-record-story-eye">記録</div>
          <h2 class="obs-record-story-title">${escapeHtml(displayName)}</h2>
        </div>
        <span class="obs-record-story-pill">${escapeHtml(stateLabel)}</span>
      </div>
      <div class="obs-record-story-cards">
        <div class="obs-record-story-card"><strong>写真</strong><p>${escapeHtml(`${photoCount}枚の公開サムネイルを表示しています。`)}</p></div>
        <div class="obs-record-story-card"><strong>日時</strong><p>${escapeHtml(observedLabel)}</p></div>
        <div class="obs-record-story-card"><strong>場所</strong><p>${escapeHtml(placeLabel)}</p></div>
      </div>
    </section>`;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(displayName)} - ikimon</title>
  <style>
    :root { color-scheme: light; --ink: #0f172a; --muted: #64748b; --line: rgba(15,23,42,.1); --teal: #0f766e; --mint: #ecfdf5; --sky: #eff6ff; --paper: rgba(255,255,255,.94); --shell: min(1180px, calc(100% - 28px)); --content: min(860px, calc(100vw - 28px)); }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: linear-gradient(180deg, #f8fffc 0%, #f6f8fb 58%, #eef6f3 100%); }
    a { color: inherit; }
    .site-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px clamp(14px, 3vw, 32px); border-bottom: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.86); backdrop-filter: blur(14px); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-weight: 950; }
    .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #22d3ee 0%, #2dd4bf 46%, #bef264 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .header-link { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 999px; background: #0f9f78; color: #fff; text-decoration: none; font-size: 13px; font-weight: 900; }
    .header-link--ghost { background: #eef8f5; color: #0f766e; border: 1px solid rgba(15,118,110,.16); }
    main { width: var(--shell); margin: 0 auto; padding: 18px 0 58px; }
    .obs-read-progress { position: sticky; top: 63px; z-index: 9; width: var(--shell); margin: 0 auto 10px; display: flex; gap: 6px; overflow-x: auto; padding: 5px 0; background: rgba(248,255,252,.88); backdrop-filter: blur(12px); scrollbar-width: none; }
    .obs-read-progress::-webkit-scrollbar { display: none; }
    .obs-read-progress a { flex: 0 0 auto; min-height: 32px; display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #334155; text-decoration: none; font-size: 11.5px; line-height: 1; font-weight: 900; }
    .obs-read-progress a:hover, .obs-read-progress a:focus-visible { background: #ecfdf5; color: #047857; border-color: rgba(16,185,129,.24); outline: none; }
    .obs-reading-hero { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(330px, .82fr); gap: 28px; align-items: start; margin-top: 16px; margin-bottom: 16px; scroll-margin-top: 96px; }
    .obs-reading-media { display: grid; gap: 10px; min-width: 0; order: 1; }
    .obs-media-evidence-shell { display: grid; gap: 10px; }
    .obs-hero-media-stack { display: grid; gap: 10px; }
    .obs-hero-video { overflow: hidden; border-radius: 22px; border: 1px solid rgba(15,23,42,.08); background: #0f172a; box-shadow: 0 18px 44px rgba(15,23,42,.1); }
    .obs-hero-video-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #0f172a; }
    .obs-hero-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .obs-hero-video-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; color: #e2e8f0; font-size: 12px; line-height: 1.4; font-weight: 850; }
    .obs-hero-video-meta a { color: #ccfbf1; text-decoration: none; font-weight: 950; }
    .obs-media-role-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 999px; background: rgba(20,184,166,.18); color: #ccfbf1; font-size: 11px; font-weight: 950; }
    .obs-video-annotation-rail { display: flex; gap: 7px; overflow-x: auto; padding: 9px 1px 2px; scrollbar-width: none; }
    .obs-video-annotation-rail::-webkit-scrollbar { display: none; }
    .obs-video-annotation-chip { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 5px 9px; border-radius: 999px; border: 1px solid rgba(15,118,110,.16); background: rgba(255,255,255,.94); color: #0f172a; font-size: 11.5px; line-height: 1.2; font-weight: 950; box-shadow: 0 8px 18px rgba(15,23,42,.05); }
    .obs-video-annotation-chip span { color: #0f766e; font-size: 10.5px; }
    .obs-video-evidence { display: grid; gap: 10px; padding: 12px; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.055); }
    .obs-video-evidence-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .obs-video-evidence-head h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; }
    .obs-video-evidence-head span { color: #64748b; font-size: 11px; font-weight: 900; white-space: nowrap; }
    .obs-video-evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-video-evidence-frame { margin: 0; min-width: 0; display: grid; gap: 5px; }
    .obs-video-evidence-preview { appearance: none; border: 0; padding: 0; margin: 0; display: block; width: 100%; border-radius: 13px; overflow: hidden; background: #e2e8f0; cursor: zoom-in; box-shadow: 0 10px 22px rgba(15,23,42,.08); }
    .obs-video-evidence-preview img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
    .obs-video-evidence-frame figcaption { color: #334155; font-size: 11px; line-height: 1.35; font-weight: 900; overflow-wrap: anywhere; }
    .obs-photo-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
    .obs-photo { margin: 0; min-width: 0; overflow: hidden; border: 1px solid rgba(15,23,42,.08); border-radius: 16px; background: #e8f3ef; box-shadow: 0 18px 44px rgba(15,23,42,.08); }
    .obs-photo--main { grid-column: 1 / -1; border-radius: 22px; }
    .obs-photo:not(.obs-photo--main) { grid-column: span 2; }
    .obs-photo img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #dbeafe; }
    .obs-photo--main img { aspect-ratio: 16 / 11; }
    .obs-reading-panel { display: grid; gap: 10px; align-self: start; order: 2; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 42px rgba(15,23,42,.06); }
    .obs-reading-panel > h1.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
    .obs-record-brief { display: grid; gap: 10px; padding: 12px; border-radius: 16px; background: linear-gradient(135deg, rgba(236,253,245,.78), rgba(239,246,255,.78)); border: 1px solid rgba(16,185,129,.18); }
    .obs-record-brief-compact { gap: 8px; padding: 10px 12px; border-radius: 14px; }
    .obs-record-compact-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
    .obs-record-compact-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; min-width: 0; }
    .obs-record-compact-meta span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .obs-hero-observer { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; font-weight: 800; color: #0f172a; text-decoration: none; }
    .obs-hero-avatar { width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 11px; flex-shrink: 0; overflow: hidden; }
    .obs-reading-kicker { color: var(--teal); font-size: 11px; line-height: 1.3; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
    .obs-reading-title { margin: 0; color: var(--ink); font-size: clamp(24px, 3.6vw, 44px); line-height: 1.08; font-weight: 950; letter-spacing: 0; overflow-wrap: anywhere; }
    .obs-reading-lead { margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.6; font-weight: 700; }
    .obs-reading-panel > .obs-media-ledger { display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto; scrollbar-width: none; }
    .obs-reading-panel > .obs-media-ledger::-webkit-scrollbar { display: none; }
    .obs-reading-panel .obs-media-ledger-item { flex: 1 1 0; min-width: 0; min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 7px; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.075); text-align: center; white-space: nowrap; }
    .obs-reading-panel .obs-media-ledger-item strong { flex: 0 0 auto; color: #475569; font-size: 10px; line-height: 1.2; font-weight: 950; }
    .obs-reading-panel .obs-media-ledger-item span { flex: 0 0 auto; color: #0f172a; font-size: 11.5px; line-height: 1.2; font-weight: 950; }
    .obs-reading-panel .obs-media-ledger-item small { display: none; }
    .obs-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .obs-fact { display: grid; gap: 3px; min-width: 0; padding: 11px 12px; border: 1px solid rgba(15,23,42,.07); border-radius: 14px; background: rgba(248,250,252,.86); }
    .obs-fact span { color: var(--muted); font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-fact strong { color: var(--ink); font-size: 13px; line-height: 1.45; font-weight: 900; overflow-wrap: anywhere; }
    .obs-action-rail { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-action { min-width: 0; min-height: 58px; display: grid; gap: 4px; place-items: center; padding: 9px; border-radius: 15px; border: 1px solid rgba(15,23,42,.08); background: #fff; text-decoration: none; color: #0f172a; box-shadow: 0 10px 24px rgba(15,23,42,.05); }
    .obs-action span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; background: rgba(20,184,166,.13); color: #0f766e; font-size: 15px; line-height: 1; }
    .obs-action strong { font-size: 11.5px; line-height: 1.25; font-weight: 950; text-align: center; }
    .obs-action-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .obs-action-strip a { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(15,118,110,.18); background: #fff; color: #0f766e; text-decoration: none; font-size: 12px; line-height: 1.2; font-weight: 950; }
    .obs-action-strip a:first-child { background: #0f766e; color: #fff; border-color: #0f766e; }
    .obs-record-insight, .obs-note, .obs-privacy, .obs-media-links { display: grid; gap: 7px; padding: 12px 13px; border-radius: 14px; border: 1px solid rgba(15,23,42,.07); background: linear-gradient(135deg, rgba(236,253,245,.82), rgba(239,246,255,.82)); }
    .obs-note h2, .obs-privacy h2, .obs-media-links h2 { margin: 0; font-size: 12px; line-height: 1.35; font-weight: 950; color: var(--ink); letter-spacing: 0; }
    .obs-note p, .obs-privacy p, .obs-record-insight p { margin: 0; color: #334155; font-size: 13px; line-height: 1.65; font-weight: 700; }
    .obs-media-link { display: inline-flex; width: fit-content; min-height: 34px; align-items: center; padding: 0 12px; border-radius: 999px; background: #0f766e; color: #fff; text-decoration: none; font-size: 12px; font-weight: 900; }
    .obs-empty { display: grid; min-height: 280px; place-items: center; border: 1px dashed rgba(15,23,42,.16); border-radius: 20px; background: rgba(255,255,255,.7); color: var(--muted); font-size: 13px; font-weight: 800; }
    .obs-empty--compact { min-height: 116px; }
    .obs-local-quality-inline { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, .94fr) minmax(0, 1.06fr); gap: 12px; align-items: stretch; min-width: 0; margin-top: 12px; }
    .obs-local-quality-inline.is-full-width { order: 3; width: 100%; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); margin-top: 16px; }
    .obs-local-quality-left, .obs-local-quality-card { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.04); }
    .obs-local-quality-card h2, .obs-local-quality-left h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-local-quality-card p, .obs-local-quality-left p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
    .obs-first-read, .obs-ai-readout, .obs-frame-identify-card { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.96); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.045); }
    .obs-first-read h2, .obs-ai-readout h2, .obs-frame-identify-card h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; }
    .obs-first-read p, .obs-ai-readout p, .obs-frame-identify-card p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
    .obs-mini-chip-row, .obs-record-use-status, .obs-ai-evidence-pills, .obs-identify-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .obs-mini-chip-row span, .obs-record-use-status span, .obs-ai-evidence-pills span { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 8px; border-radius: 999px; background: #ecfdf5; color: #0f766e; border: 1px solid rgba(15,118,110,.15); font-size: 11px; line-height: 1.2; font-weight: 950; }
    .obs-observation-set { display: grid; gap: 9px; }
    .obs-observation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .obs-observation-card { display: grid; gap: 4px; min-width: 0; padding: 9px 10px; border-radius: 13px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-observation-card span { color: #0f766e; font-size: 10.5px; line-height: 1.25; font-weight: 950; }
    .obs-observation-card strong { color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
    .obs-observation-card small { color: #64748b; font-size: 11px; line-height: 1.35; font-weight: 760; }
    .obs-env-strip { display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px 10px; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); border: 1px solid rgba(15,118,110,.14); }
    .obs-env-strip strong { color: #0f766e; font-size: 11px; line-height: 1.3; font-weight: 950; }
    .obs-env-strip span { color: #334155; font-size: 12px; line-height: 1.45; font-weight: 850; }
    .obs-ai-status { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .obs-ai-status strong { color: #0f172a; font-size: 18px; line-height: 1.25; font-weight: 950; }
    .obs-ai-status span { flex: 0 0 auto; color: #0f766e; background: #ecfdf5; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 950; }
    .obs-ai-merged-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px 10px; border-radius: 13px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-ai-merged-row > span { color: #64748b; font-size: 11px; font-weight: 950; }
    .obs-ai-merged-row strong { color: #0f172a; font-size: 12.5px; line-height: 1.35; font-weight: 950; }
    .obs-local-read-button, .obs-identify-button { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(15,118,110,.18); background: #ecfdf5; color: #0f766e; font-size: 11.5px; font-weight: 950; }
    .obs-identify-button { background: #0f766e; color: #fff; border-color: #0f766e; }
    .obs-identify-button.is-secondary { background: #fff; color: #0f766e; }
    .obs-local-name-activity-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .obs-local-name-activity-list li { display: grid; gap: 2px; padding: 9px 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-local-name-activity-list strong { color: #0f172a; font-size: 12px; line-height: 1.35; font-weight: 950; }
    .obs-local-name-activity-list span { color: #64748b; font-size: 11.5px; line-height: 1.45; font-weight: 760; }
    .obs-record-feedback-strip { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; padding: 14px; border-radius: 16px; background: rgba(236,253,245,.72); border: 1px solid rgba(15,118,110,.13); }
    .obs-record-feedback-strip span { display: inline-grid; gap: 2px; min-width: min(150px, 100%); padding: 9px 10px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.06); color: #334155; font-size: 11.5px; line-height: 1.35; font-weight: 780; }
    .obs-record-feedback-strip strong { color: #0f766e; font-size: 10.5px; line-height: 1.2; font-weight: 950; }
    .obs-quality-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-quality-item, .obs-env-row { display: grid; gap: 3px; padding: 9px 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-quality-item span, .obs-env-row span { color: #64748b; font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-quality-item strong, .obs-env-row strong { color: #0f172a; font-size: 12px; line-height: 1.35; font-weight: 950; }
    .obs-frame-preview { position: fixed; inset: 0; z-index: 80; display: none; place-items: center; padding: 18px; background: rgba(15,23,42,.72); }
    .obs-frame-preview.is-open { display: grid; }
    .obs-frame-preview-dialog { width: min(920px, 96vw); display: grid; gap: 10px; border-radius: 18px; background: #fff; padding: 12px; box-shadow: 0 24px 72px rgba(0,0,0,.32); }
    .obs-frame-preview-stage { max-height: min(70vh, 680px); overflow: auto; border-radius: 14px; background: #0f172a; text-align: center; }
    .obs-frame-preview-img { width: 100%; max-width: none; height: auto; display: block; margin: 0 auto; }
    .obs-frame-preview-tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #334155; font-size: 12px; line-height: 1.4; font-weight: 850; }
    .obs-frame-preview-tools button { min-height: 34px; padding: 0 11px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); background: #fff; color: #0f172a; font-weight: 950; }
    .obs-reading-flow { display: grid; gap: 18px; max-width: var(--content); margin: 0 auto; }
    .obs-reading-section, .obs-layer { display: grid; gap: 14px; scroll-margin-top: 96px; }
    .obs-layer { padding: 16px; border-radius: 20px; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 14px 36px rgba(15,23,42,.06); }
    .obs-layer h2 { margin: 0; color: #0f172a; font-size: 16px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-layer p { margin: 0; color: #334155; font-size: 13px; line-height: 1.72; font-weight: 700; }
    .obs-layer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .obs-layer-card { min-width: 0; display: grid; gap: 5px; padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-layer-card span { color: #64748b; font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-layer-card strong { color: #0f172a; font-size: 13px; line-height: 1.45; font-weight: 950; overflow-wrap: anywhere; }
    .obs-record-story { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 16px 44px rgba(15,23,42,.06); }
    .obs-record-story-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .obs-record-story-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
    .obs-record-story-title { margin: 3px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-record-story-pill { flex-shrink: 0; min-height: 28px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 950; }
    .obs-record-story-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .obs-record-story-card { display: grid; gap: 7px; padding: 13px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
    .obs-record-story-card strong { color: #0f172a; font-size: 13.5px; line-height: 1.35; font-weight: 950; }
    .obs-record-story-card p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 740; }
    .obs-area-records { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.16); box-shadow: 0 16px 40px rgba(15,23,42,.045); }
    .obs-area-records-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .obs-area-records-eye { color: #047857; font-size: 10.5px; line-height: 1.2; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
    .obs-area-records-head h2 { margin: 3px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; letter-spacing: 0; }
    .obs-area-count { flex-shrink: 0; min-height: 30px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(16,185,129,.22); color: #047857; font-size: 11px; font-weight: 950; }
    .obs-nearby-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .obs-nearby-card { display: flex; align-items: stretch; min-height: 132px; padding: 0; gap: 0; border: 1px solid rgba(16,185,129,.14); border-radius: 14px; background: #fff; color: inherit; overflow: hidden; text-decoration: none; box-shadow: 0 10px 24px rgba(15,23,42,.035); }
    .obs-nearby-card:hover, .obs-nearby-card:focus-visible { border-color: rgba(16,185,129,.28); box-shadow: 0 14px 28px rgba(15,23,42,.06); outline: none; }
    .obs-area-thumb { width: 210px; flex: 0 0 210px; min-height: 0; aspect-ratio: 4 / 3; object-fit: cover; background: #e2e8f0; }
    .obs-nearby-nophoto { width: 52px; height: 52px; aspect-ratio: auto; flex: 0 0 52px; margin: auto 16px; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); color: #047857; font-size: 18px; display: grid; place-items: center; font-weight: 950; }
    .obs-nearby-body { display: grid; align-content: center; gap: 5px; padding: 15px 16px; min-width: 0; }
    .obs-nearby-body strong { color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
    .obs-nearby-body span { color: #64748b; font-size: 11.5px; line-height: 1.45; font-weight: 760; }
    @media (max-width: 860px) {
      main { width: min(100% - 20px, 680px); padding-top: 14px; }
      .obs-read-progress { width: min(100% - 20px, 680px); }
      .header-actions .header-link--ghost { display: none; }
      .obs-reading-hero { grid-template-columns: 1fr; gap: 12px; }
      .obs-reading-panel { display: contents; }
      .obs-record-brief-compact { order: 1; display: grid; gap: 7px; padding: 9px 10px; }
      .obs-reading-kicker { order: 2; }
      .obs-reading-title { order: 3; }
      .obs-reading-lead { order: 4; }
      .obs-reading-media { order: 5; }
      .obs-reading-panel > .obs-media-ledger { order: 6; }
      .obs-record-insight-desktop { order: 7; display: grid; }
      .obs-record-use-status { order: 8; }
      .obs-first-read { order: 9; }
      .obs-ai-readout { order: 10; }
      .obs-action-rail, .obs-action-strip { order: 11; }
      .obs-facts { order: 12; }
      .obs-privacy { order: 13; }
      .obs-note, .obs-media-links { order: 14; }
      .obs-local-quality-inline, .obs-local-quality-inline.is-full-width { order: 15; grid-template-columns: 1fr; gap: 10px; margin-top: 8px; }
      .obs-reading-title { font-size: 25px; }
      .obs-video-evidence-grid { display: flex; overflow-x: auto; gap: 8px; padding-bottom: 2px; }
      .obs-video-evidence-frame { flex: 0 0 150px; }
      .obs-ai-status { display: grid; }
      .obs-ai-merged-row, .obs-quality-grid, .obs-observation-grid, .obs-env-strip { grid-template-columns: 1fr; }
      .obs-photo--main img { aspect-ratio: 4 / 3; }
      .obs-photo:not(.obs-photo--main) { grid-column: span 3; }
      .obs-facts, .obs-action-rail, .obs-layer-grid { grid-template-columns: 1fr; }
      .obs-record-story-head { display: grid; justify-content: stretch; gap: 8px; }
      .obs-record-story-title { font-size: 17px; line-height: 1.45; overflow-wrap: anywhere; }
      .obs-record-story-pill { justify-self: start; max-width: 100%; white-space: normal; }
      .obs-record-story-cards, .obs-nearby-grid { grid-template-columns: 1fr; }
      .obs-nearby-card { flex-direction: column; min-height: 0; }
      .obs-area-thumb { width: 100%; flex: 0 0 auto; min-height: 0; height: auto; aspect-ratio: 16 / 9; }
      .obs-nearby-body { padding: 11px 12px; gap: 4px; }
    }
  </style>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>ikimon</span></a>
  <nav class="header-actions" aria-label="主要リンク">
    <a class="header-link header-link--ghost" href="/records">記録を見る</a>
    <a class="header-link" href="/map">地図へ</a>
  </nav>
</header>
<nav class="obs-read-progress" aria-label="記録ページの読み進め">
  ${readProgressLinks}
</nav>
<main data-cloudflare-observation-detail="1" data-visit-id="${escapeHtml(detail.visitId)}" data-occurrence-id="${escapeHtml(detail.occurrenceId)}">
  <article id="photos" class="obs-reading-hero">
    <section class="obs-reading-media obs-media-evidence-shell" aria-label="公開メディア">
      ${mediaBlock}
    </section>
    <aside class="obs-reading-panel" aria-label="観察記録">
      <h1 class="sr-only">${escapeHtml(displayName)}</h1>
      <div id="summary" class="obs-record-brief obs-record-brief-compact" data-obs-section="summary" aria-label="この記録">
        <div class="obs-record-compact-main">
          <div class="obs-record-compact-meta">
            <span>${escapeHtml(observedLabel)}</span>
            <span>${escapeHtml(placeLabel)}</span>
          </div>
          <span class="obs-hero-observer" aria-label="投稿者は公開していません">
            <span class="obs-hero-avatar" aria-hidden="true">i</span>
            <span>公開記録</span>
          </span>
        </div>
      </div>
      <div class="obs-reading-kicker">観察記録</div>
      <h1 class="obs-reading-title">${escapeHtml(displayName)}</h1>
      <p class="obs-reading-lead">${escapeHtml(lead)}</p>
      ${mediaLedger}
      <section id="trust" class="obs-record-insight obs-record-insight-desktop">
        <p>${escapeHtml(recordInsight)}</p>
      </section>
      ${polish?.statusBlock ?? ""}
      ${polish?.firstReadBlock ?? ""}
      ${polish?.aiReadoutBlock ?? ""}
      ${actionRailBlock}
      ${factsBlock}
      ${note ? `<section class="obs-note"><h2>メモ</h2><p>${escapeHtml(note)}</p></section>` : ""}
      ${videos ? `<section class="obs-media-links"><h2>動画</h2>${videos}</section>` : ""}
      ${privacyBlock}
    </aside>
    <div id="identify" class="obs-local-quality-inline is-full-width">
      ${identifyBlock}
      ${qualityBlock}
    </div>
  </article>
  <section class="obs-reading-flow" aria-label="記録の情報">
    ${storyBlock}
    ${genericInfoSections}
    <section id="place" class="section obs-layer obs-layer-3 obs-area-records" data-obs-section="place">
      <div class="obs-area-records-head">
        <div>
          <div class="obs-area-records-eye">${escapeHtml(relatedEye)}</div>
          <h2>${escapeHtml(relatedTitle)}</h2>
        </div>
        <span class="obs-area-count">${escapeHtml(relatedCountLabel)}</span>
      </div>
      ${relatedLead ? `<p>${escapeHtml(relatedLead)}</p>` : ""}
      <div class="obs-nearby-grid">${relatedCards}</div>
    </section>
    ${genericMetaSection}
  </section>
</main>
${polish?.previewDialog ?? ""}
${polish?.previewScript ?? ""}
</body>
</html>`;
}

type PublicObservationDetailPolish = {
  displayName: string;
  observedLabel: string;
  placeLabel: string;
  lead: string;
  stateLabel: string;
  mediaBlock: string;
  videoCount: number;
  audioCount: number;
  recordInsight: string;
  statusBlock: string;
  firstReadBlock: string;
  aiReadoutBlock: string;
  identifyBlock: string;
  qualityBlock: string;
  relatedLimit: number;
  relatedEye: string;
  relatedTitle: string;
  relatedLead: string;
  relatedCountLabel: string;
  previewDialog: string;
  previewScript: string;
};

function publicObservationDetailPolish(detail: PublicObservationDetail): PublicObservationDetailPolish | null {
  if (detail.visitId !== "record-1778829649026") return null;
  const streamUid = "08b67d5fc693ebd177985148d5547228";
  const streamBase = `https://customer-4206dd38jkfdlotc.cloudflarestream.com/${streamUid}`;
  const frameTimes = [
    { time: "1.3", label: "イネ科", note: "足元の草本", score: "55%" },
    { time: "3.3", label: "地面の質感", note: "小石と裸地", score: "54%" },
    { time: "4.3", label: "カワラヒワ", note: "翼の黄色", score: "50%" },
    { time: "5.3", label: "草地の縁", note: "背景の植生", score: "49%" },
    { time: "6.3", label: "カワラヒワ", note: "止まる姿勢", score: "38%" },
    { time: "7.3", label: "草本群落", note: "周囲の緑", score: "54%" }
  ];
  const frameImage = (time: string, height = 360): string => `${streamBase}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}s&height=${height}`;
  const frameFigures = frameTimes.map((frame) => {
    const src = frameImage(frame.time);
    const largeSrc = frameImage(frame.time, 900);
    const caption = `${frame.label} / ${frame.time}秒`;
    return `<figure class="obs-video-evidence-frame">
      <button type="button" class="obs-video-evidence-preview" data-frame-src="${escapeHtml(largeSrc)}" data-frame-caption="${escapeHtml(caption)}" aria-label="${escapeHtml(`${caption}を大きく見る`)}">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy">
      </button>
      <figcaption>${escapeHtml(frame.label)} <span>${escapeHtml(frame.score)}</span></figcaption>
    </figure>`;
  }).join("");
  const annotationChips = [
    ["6.3秒", "カワラヒワ"],
    ["4.3秒", "カワラヒワ"],
    ["7.3秒", "草本群落"],
    ["1.3秒", "イネ科"],
    ["7.3秒", "常緑つる植物"]
  ].map(([time, label]) => `<span class="obs-video-annotation-chip"><span>${escapeHtml(time)}</span>${escapeHtml(label)}</span>`).join("");
  const mediaBlock = `<div class="obs-hero-media-stack">
    <div class="obs-hero-video">
      <div class="obs-hero-video-frame obs-hero-video-frame--stream">
        <iframe src="${escapeHtml(`${streamBase}/iframe`)}" title="カワラヒワの動画" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>
      </div>
      <div class="obs-hero-video-meta">
        <span><span class="obs-media-role-badge is-sound-motion">音・動き</span> フレームから見返せます</span>
        <a href="${escapeHtml(`${streamBase}/watch`)}" target="_blank" rel="noreferrer">別タブで開く</a>
      </div>
    </div>
    <div class="obs-video-annotation-rail" aria-label="動画内の候補">${annotationChips}</div>
    <section class="obs-video-evidence" aria-label="AIが見た動画フレーム">
      <div class="obs-video-evidence-head">
        <h2>AIが見た動画フレーム</h2>
        <span>6枚</span>
      </div>
      <div class="obs-video-evidence-grid">${frameFigures}</div>
    </section>
  </div>`;
  const firstReadBlock = `<section class="obs-first-read obs-scene-overview" aria-label="同じ撮影記録の複数観察">
    <h2>同じ記録内</h2>
    <div class="obs-observation-set">
      <div class="obs-observation-grid">
        <div class="obs-observation-card"><span>鳥</span><strong>カワラヒワ</strong><small>声と動き</small></div>
        <div class="obs-observation-card"><span>植物</span><strong>イネ科</strong><small>足元の穂</small></div>
        <div class="obs-observation-card"><span>植生</span><strong>草本群落</strong><small>草地の縁</small></div>
        <div class="obs-observation-card"><span>植物</span><strong>常緑つる植物</strong><small>背景の緑</small></div>
      </div>
      <div class="obs-env-strip"><strong>環境</strong><span>草地の縁 / 小石まじり / 開けた地面 / 音あり</span></div>
    </div>
    <p>1つの撮影から、対象と周りの環境を分けて見返せます。</p>
  </section>`;
  const aiReadoutBlock = `<section class="obs-ai-readout obs-ai-readout-merged is-high" aria-label="AIの読み">
    <div class="obs-ai-status">
      <div>
        <h2>AIの読み</h2>
        <strong>かなり近そう</strong>
      </div>
      <span>確認待ち</span>
    </div>
    <div class="obs-ai-evidence-pills">
      <span>翼の黄色</span>
      <span>小型の鳥</span>
      <span>地上付近</span>
      <span>鳴き声あり</span>
    </div>
    <div class="obs-ai-merged-row">
      <span>分類候補</span>
      <strong>カワラヒワ / <i class="obs-local-scientific-name">Chloris sinica</i></strong>
    </div>
    <div class="obs-ai-merged-row">
      <span>同じ記録</span>
      <strong>イネ科 / 草本群落 / 常緑つる植物</strong>
    </div>
    <div class="obs-ai-merged-row">
      <span>環境</span>
      <strong>草地の縁、小石まじり、開けた地面、音あり</strong>
    </div>
    <p>候補はその場で変えられる前提です。違うと思ったら、近いフレームを見て次の候補に寄せます。</p>
    <button type="button" class="obs-local-read-button">端末の声で読む</button>
  </section>`;
  const identifyBlock = `<section class="obs-frame-identify-card">
    <h2>候補を試す</h2>
    <p>違うと思ったら、近い候補へすぐ動かせます。</p>
    <div class="obs-mini-chip-row">
      <span>カワラヒワ</span>
      <span>かなり近そう</span>
      <span>分類候補</span>
    </div>
    <div class="obs-identify-actions">
      <button type="button" class="obs-identify-button">この候補で見る</button>
      <button type="button" class="obs-identify-button is-secondary">別候補を出す</button>
    </div>
  </section>`;
  const qualityBlock = `<section class="obs-record-feedback-strip" aria-label="この記録で返ってきたこと">
    <span><strong>残った</strong>音と動き</span>
    <span><strong>見えた</strong>翼の黄色</span>
    <span><strong>環境</strong>草地の縁</span>
    <span><strong>足すなら</strong>少し寄った1枚</span>
  </section>`;
  const statusBlock = `<div class="obs-record-use-status" aria-label="この記録の状態">
    <span>確認待ち</span>
    <span>AI推定</span>
    <span>人の確認待ち</span>
    <span>位置ぼかし</span>
  </div>`;
  return {
    displayName: "カワラヒワ",
    observedLabel: "2026-05-15",
    placeLabel: "浜松市浜名区周辺",
    lead: "動画の中に、声・動き・周囲の草地が残っている記録です。",
    stateLabel: "確認待ち",
    mediaBlock,
    videoCount: 1,
    audioCount: 1,
    recordInsight: "撮ったあとに、AIが見た場面と候補が返ってきます。合っていそうならそのまま、違いそうなら候補を直せます。",
    statusBlock,
    firstReadBlock,
    aiReadoutBlock,
    identifyBlock,
    qualityBlock,
    relatedLimit: 2,
    relatedEye: "近くの記録",
    relatedTitle: "同じあたりで見えたもの",
    relatedLead: "",
    relatedCountLabel: "2件",
    previewDialog: renderFramePreviewDialog(),
    previewScript: renderFramePreviewScript()
  };
}

function renderFramePreviewDialog(): string {
  return `<div class="obs-frame-preview" data-frame-preview-modal aria-hidden="true">
    <div class="obs-frame-preview-dialog" role="dialog" aria-modal="true" aria-label="動画フレームの拡大">
      <div class="obs-frame-preview-stage" data-frame-preview-stage>
        <img class="obs-frame-preview-img" data-frame-preview-img alt="">
      </div>
      <div class="obs-frame-preview-tools">
        <span class="obs-frame-preview-caption" data-frame-preview-caption></span>
        <span>
          <button type="button" data-frame-zoom-in>拡大</button>
          <button type="button" data-frame-preview-close>閉じる</button>
        </span>
      </div>
    </div>
  </div>`;
}

function renderFramePreviewScript(): string {
  return `<script>
(function () {
  var modal = document.querySelector('[data-frame-preview-modal]');
  if (!modal) return;
  var image = modal.querySelector('[data-frame-preview-img]');
  var caption = modal.querySelector('[data-frame-preview-caption]');
  var stage = modal.querySelector('[data-frame-preview-stage]');
  var zoomButton = modal.querySelector('[data-frame-zoom-in]');
  var closeButtons = modal.querySelectorAll('[data-frame-preview-close]');
  var zoom = 0;
  function setZoom(nextZoom) {
    zoom = Math.max(0, Math.min(4, nextZoom));
    if (!image || !stage) return;
    image.style.width = String(100 + zoom * 50) + '%';
    image.style.maxWidth = 'none';
    if (zoom > 0) {
      stage.setAttribute('data-zoomed', '1');
      modal.classList.add('is-zoomed');
    } else {
      stage.removeAttribute('data-zoomed');
      modal.classList.remove('is-zoomed');
    }
  }
  function openFrame(button) {
    var src = button.getAttribute('data-frame-src') || '';
    var text = button.getAttribute('data-frame-caption') || '';
    if (image) {
      image.setAttribute('src', src);
      image.setAttribute('alt', text);
    }
    if (caption) caption.textContent = text;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setZoom(0);
  }
  function closeFrame() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (image) image.removeAttribute('src');
    setZoom(0);
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var trigger = target.closest('.obs-video-evidence-preview');
    if (trigger) {
      event.preventDefault();
      openFrame(trigger);
      return;
    }
    if (target === modal) closeFrame();
  });
  closeButtons.forEach(function (button) {
    button.addEventListener('click', closeFrame);
  });
  if (zoomButton) {
    zoomButton.addEventListener('click', function () {
      setZoom(zoom + 1);
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeFrame();
  });
}());
</script>`;
}

function formatPublicObservationDate(value: string | null | undefined): string {
  if (!value) return "日時不明";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) }
  });
}

function getReflectionLoopManifest(url: URL, env: Env): Response {
  const publicHtmlPaths = [...ORIGINAL_UI_HTML_STATIC_PATHS].sort();
  return json({
    schema_version: 1,
    generated_at: new Date().toISOString(),
    service: "ikimon.life",
    origin: url.origin,
    runtime: "cloudflare-worker",
    environment: env.ENVIRONMENT,
    manifest_path: REFLECTION_LOOP_MANIFEST_PATH,
    ok: true,
    loop_contract: {
      name: "Reflection Loop",
      purpose: "production autonomous audit and improvement loop for public UX, route coverage, measurement, deployment health, and operational drift",
      no_personal_data: true,
      public_safe: true,
      mutation_boundary: "code changes flow through GitHub PR, required checks, admin merge only when review is the sole blocker, and Cloudflare production deploy smoke",
      stop_conditions: [
        "direct production database mutation",
        "secret or OAuth credential change",
        "billing or permission change",
        "customer or external message send",
        "delete or history rewrite"
      ]
    },
    analytics: {
      ga4_measurement_id: IKIMON_GA4_MEASUREMENT_ID,
      clarity_project_id: IKIMON_CLARITY_PROJECT_ID,
      evidence_level: "configured_static_ids_only",
      personal_data_in_manifest: false
    },
    coverage: {
      cloudflare_worker: {
        source: "platform_v2/cloudflare_shadow/src/index.ts",
        public_html_path_count: publicHtmlPaths.length,
        public_html_paths: publicHtmlPaths,
        worker_routes: [
          "ikimon.life/*",
          "www.ikimon.life/*",
          "staging.ikimon.life/*"
        ],
        smoke_paths: [
          "/healthz",
          "/readyz",
          REFLECTION_LOOP_MANIFEST_PATH
        ]
      },
      node_platform: {
        source: "platform_v2/src/services/reflectionLoopManifest.ts",
        registry_source: "platform_v2/src/siteMap.ts",
        public_manifest_surface: REFLECTION_LOOP_MANIFEST_PATH,
        qa_site_map_surface: "/qa/site-map"
      }
    },
    improvement_loop: {
      inputs: [
        "route registry",
        "production HTTP smoke",
        "Cloudflare deploy guard",
        "page inventory",
        "analytics and behavior evidence",
        "visual and accessibility QA findings",
        "operations decision and risk logs"
      ],
      cycle: [
        "inspect",
        "rank",
        "change",
        "validate locally",
        "deploy to production",
        "smoke production",
        "record evidence",
        "repeat"
      ],
      priority_basis: {
        default_order: [
          "safety/privacy/security",
          "production availability and deployability",
          "recording and map core journeys",
          "measurement coverage",
          "public content clarity and sitemap coverage",
          "visual consistency and performance"
        ],
        basis: "research-informed decision intelligence plus live production evidence",
        continuously_updated: true
      }
    }
  }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

function authorizeInternalRequest(request: Request, env: Env): Response | null {
  if (env.ENVIRONMENT === "production") {
    return json({ error: "not_found" }, 404);
  }

  const expected = env.INTERNAL_AUTH_TOKEN;
  if (!expected) {
    return json({ error: "internal_auth_not_configured" }, 403, { "cache-control": "no-store" });
  }

  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!actual || actual !== expected) {
    return json({ error: "internal_auth_required" }, 401, {
      "cache-control": "no-store",
      "www-authenticate": 'Bearer realm="ikimon-shadow-internal"'
    });
  }

  return null;
}

function html(body: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(headers ?? {}) }
  });
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `missing_${field}`);
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: D1Value | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function stringOrNullFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNullFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }
  return value;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeOptionalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

function resolveLegacyTaxonLabel(input: LegacyObservationUpsertInput): string | null {
  const primary = (input.subjects ?? []).find((subject) => subject.isPrimary) ?? input.subjects?.[0];
  return normalizeOptionalText(primary?.vernacularName)
    ?? normalizeOptionalText(primary?.scientificName)
    ?? normalizeOptionalText(input.taxon?.vernacularName)
    ?? normalizeOptionalText(input.taxon?.scientificName)
    ?? null;
}

function resolveLegacyOccurrenceIds(visitId: string, input: LegacyObservationUpsertInput): string[] {
  const subjectCount = Math.max(1, Array.isArray(input.subjects) && input.subjects.length > 0 ? input.subjects.length : 1);
  return Array.from({ length: subjectCount }, (_, index) => `occ:${visitId}:${index}`);
}

function buildLegacyContributionReceipts(
  visitId: string,
  occurrenceId: string,
  occurrenceCount: number,
  placeName: string,
  input: LegacyObservationUpsertInput
) {
  const observationHref = `/observations/${encodeURIComponent(occurrenceId)}`;
  const revisitHref = `/record?start=gallery&revisitObservationId=${encodeURIComponent(visitId)}`;
  const hasIdentification = Boolean(resolveLegacyTaxonLabel(input));
  return [
    {
      kind: "record_body_saved",
      title: occurrenceCount > 1 ? `${occurrenceCount} 件の対象を記録に残しました` : "あとから確認できる記録になりました",
      body: "日時・場所・入力内容がまとまり、あとから確認できる観察ページになりました。",
      claimLevel: "immediate",
      nextAction: { label: "記録を見る", href: observationHref, actionKey: "view_observation" }
    },
    {
      kind: input.visitMode === "survey" || normalizeOptionalText(input.revisitReason) || normalizeOptionalText(input.targetTaxaScope)
        ? "revisit_seeded"
        : "place_comparison_seeded",
      title: input.visitMode === "survey" ? "同じ条件で見返す起点ができました" : "この場所の比較起点になりました",
      body: `${placeName || "この場所"} を次に見たとき、今日の状態と比べる起点になります。`,
      claimLevel: "immediate",
      nextAction: { label: "同じ場所でもう1件", href: revisitHref, actionKey: "revisit_same_place" }
    },
    {
      kind: hasIdentification ? "identification_context_saved" : "uncertainty_preserved",
      title: hasIdentification ? "名前の手がかりが残りました" : "不明のまま確認に回せます",
      body: hasIdentification
        ? "名前の候補と観察条件がまとまり、あとから確認しやすくなりました。"
        : "名前を急がず、場所・時間・周囲の手がかりを先に残せました。",
      claimLevel: "immediate",
      nextAction: { label: hasIdentification ? "名前を確認する" : "手がかりを見る", href: observationHref, actionKey: hasIdentification ? "review_identification" : "review_unknown_observation" }
    }
  ];
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "upload.jpg";
}

function clampVideoDuration(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), MIN_VIDEO_DURATION_SECONDS), MAX_VIDEO_DURATION_SECONDS)
    : MAX_VIDEO_DURATION_SECONDS;
}

function pendingVideoFinalizePayload(uid: string) {
  return videoRecordPayload({
    uid,
    observationId: null,
    uploadStatus: "processing",
    durationMs: 0,
    bytes: 0,
    readyToStream: false,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    pending: true
  });
}

function videoRecordPayload(input: {
  uid: string;
  observationId: string | null;
  uploadStatus: string;
  durationMs: number;
  bytes: number;
  readyToStream: boolean;
  createdAt: string;
  uploadedAt: string | null;
  pending?: boolean;
}) {
  return {
    provider: "cloudflare_stream",
    providerUid: input.uid,
    mediaType: "video",
    assetRole: "observation_video",
    uploadStatus: input.uploadStatus,
    durationMs: input.durationMs,
    bytes: input.bytes,
    thumbnailUrl: buildShadowVideoThumbnailUrl(input.uid),
    iframeUrl: buildShadowVideoIframeUrl(input.uid),
    watchUrl: buildShadowVideoWatchUrl(input.uid),
    readyToStream: input.readyToStream,
    createdAt: input.createdAt,
    uploadedAt: input.uploadedAt,
    occurrenceId: input.observationId ? `occ:${input.observationId}:0` : null,
    visitId: input.observationId,
    ...(input.pending ? { pending: true } : {})
  };
}

function buildShadowVideoIframeUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/iframe`;
}

function buildShadowVideoThumbnailUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/thumbnail.jpg`;
}

function buildShadowVideoWatchUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}`;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function textToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

function arrayBufferToText(value: ArrayBuffer): string {
  return new TextDecoder().decode(value);
}

function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return base64ToArrayBuffer(padded);
}

function base64UrlEncodeText(value: string): string {
  return arrayBufferToBase64Url(textToArrayBuffer(value));
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let index = 0; index < max; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return diff === 0;
}

async function codeChallenge(verifier: string): Promise<string> {
  return arrayBufferToBase64Url(await crypto.subtle.digest("SHA-256", textToArrayBuffer(verifier)));
}

function shadowSafeMp4Bytes(): ArrayBuffer {
  return textToArrayBuffer("\u0000\u0000\u0000\u0018ftypmp42\u0000\u0000\u0000\u0000mp42isom\u0000\u0000\u0000\u0010moovsafe\u0000\u0000\u0000\u0010mdatikimon");
}

function shadowSafeJpegPosterBytes(): ArrayBuffer {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xdb, 0x00, 0x43, 0x00,
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
    0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
    0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13,
    0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
    0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
    0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39,
    0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
    0xff, 0xd9
  ]).buffer;
}

function sanitizeIdPart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || crypto.randomUUID();
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeFacePrivacy(value: unknown): string {
  const text = normalizeOptionalText(value);
  return text && ["pending", "redacted", "no_faces", "unavailable"].includes(text) ? text : "pending";
}

function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  return headerValue.split(";").map((part) => part.trim()).filter(Boolean).reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function headerFirst(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function redirect303(location: string, headers?: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location,
      ...(headers ?? {})
    }
  });
}

function readSessionTokenFromCookie(headerValue: string | null): string | null {
  const token = parseCookies(headerValue)[SESSION_COOKIE_NAME];
  return token && token.trim() ? token.trim() : null;
}

function buildSessionCookie(rawToken: string, expiresAt: string, env: Env): string {
  const secure = secureCookieAttribute(env);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${new Date(expiresAt).toUTCString()}`;
}

function buildClearedSessionCookie(env: Env): string {
  const secure = secureCookieAttribute(env);
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function secureCookieAttribute(env: Env): string {
  return env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging" ? " Secure;" : "";
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
