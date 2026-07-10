export type MunicipalWalkMapThemeV0 =
  | "seasonal_walk"
  | "waterfront"
  | "park_walk"
  | "satoyama"
  | "city_nature";

export type MunicipalWalkMapMobilityModeV0 =
  | "walk"
  | "bike"
  | "car"
  | "motorbike"
  | "public_transport";

export type MunicipalWalkMapRouteFlexibilityV0 = {
  routeStyle: "loose_stops" | "free_area";
  mobilityModes: MunicipalWalkMapMobilityModeV0[];
  offRoutePolicy: "off_route_allowed" | "stay_near_public_path" | "guide_only";
  returnCues: string[];
};

export type MunicipalWalkMapSourceReferenceV0 = {
  label: string;
  url: string;
  note: string;
};

export type MunicipalWalkMapStopV0 = {
  stopId: string;
  title: string;
  areaKind: "park" | "waterfront" | "satoyama" | "street_edge" | "other";
  access: "public_access" | "permission_required" | "private_or_restricted";
  estimatedMinutes?: number | null;
  noticeCues: string[];
  recordCues: string[];
  safetyNotes: string[];
  linkedFieldId?: string | null;
};

export type MunicipalWalkMapConfigV0 = {
  schemaVersion: "municipal_walk_map_config/v0";
  walkMapId: string;
  municipality: string;
  creatorName: string;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  publishMode: "public_preview";
  routeStops: MunicipalWalkMapStopV0[];
  routeFlexibility: MunicipalWalkMapRouteFlexibilityV0;
  claimBoundary: string[];
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
};

export type MunicipalWalkMapPublicReadModelV0 = {
  schemaVersion: "municipal_walk_map_public/v0";
  walkMapId: string;
  municipality: string;
  creatorName: string;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  publishModeLabel: string;
  stops: Array<{
    stopId: string;
    title: string;
    areaKind: MunicipalWalkMapStopV0["areaKind"];
    estimatedMinutes: number | null;
    noticeCues: string[];
    recordCues: string[];
    recordHref: string | null;
    accessLabel: "public_scope" | "check_permission" | "not_for_route";
  }>;
  routeFlexibility: MunicipalWalkMapRouteFlexibilityV0;
  claimBoundary: string[];
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
};

export type MunicipalWalkMapPublicSummaryV0 = {
  schemaVersion: "municipal_walk_map_public_summary/v0";
  walkMapId: string;
  municipality: string;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  routeStyle: MunicipalWalkMapRouteFlexibilityV0["routeStyle"];
  mobilityModes: MunicipalWalkMapMobilityModeV0[];
  stopCount: number;
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
};

const SHIZUOKA_OFFICIAL_PAGE: MunicipalWalkMapSourceReferenceV0 = {
  label: "静岡市 いきもの散策マップ",
  url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
  note: "静岡市公式ページ。PDF本文や図版は転載していません。",
};

const SHARED_CLAIM_BOUNDARY = [
  "静岡市公式資料を出典にしたサンプルです。",
  "現地の案内、立入条件、天候を優先します。",
  "人の顔、学校、自宅付近、希少種の場所が分かる写真は公開範囲を落とします。",
];

export const STATIC_MUNICIPAL_WALK_MAPS_V0: MunicipalWalkMapConfigV0[] = [
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-yatsuyama-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    title: "谷津山周辺の散策サンプル",
    summary: "木陰、足元の草地、鳥の声を、公開された道沿いで軽く残すためのサンプルです。",
    theme: "satoyama",
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "yatsuyama-open-edge",
        title: "公開された道沿い",
        areaKind: "satoyama",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-yatsuyama-open-edge",
        estimatedMinutes: 15,
        noticeCues: ["木陰", "足元の草", "鳥の声"],
        recordCues: ["葉の色", "聞こえた音", "地面の湿り"],
        safetyNotes: ["道を外れず、私有地や管理区域には入らない"],
      },
      {
        stopId: "yatsuyama-rest-point",
        title: "明るい休憩場所",
        areaKind: "park",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-yatsuyama-rest-point",
        estimatedMinutes: 10,
        noticeCues: ["案内板", "木の実", "日なたと日陰"],
        recordCues: ["見えた花", "虫の動き", "風の様子"],
        safetyNotes: ["人の顔や学校・住宅が分かる写真は公開しない"],
      },
    ],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      offRoutePolicy: "stay_near_public_path",
      returnCues: ["案内板や大きな道を目印に戻る", "無理に次の場所へ進まず近い出口で終える"],
    },
    claimBoundary: SHARED_CLAIM_BOUNDARY,
    sourceReferences: [
      SHIZUOKA_OFFICIAL_PAGE,
      {
        label: "谷津山コース2025版地図面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/yatsuyama-map.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
      {
        label: "谷津山コース2025版情報面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/yatsuyama-jyouhou.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
    ],
  },
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-asahata-waterfront-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    title: "麻機の水辺を歩くサンプル",
    summary: "あさはた緑地と麻機遊水地周辺を、水辺、草地、鳥の気配に注目して歩くサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "asahata-water-edge",
        title: "水辺の公開範囲",
        areaKind: "waterfront",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-asahata-water-edge",
        estimatedMinutes: 12,
        noticeCues: ["水面", "岸辺の草", "鳥の声"],
        recordCues: ["水の量", "草地の色", "見えた鳥"],
        safetyNotes: ["水際へ近づきすぎず、増水時は離れる"],
      },
      {
        stopId: "asahata-green-park",
        title: "緑地の開けた場所",
        areaKind: "park",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-asahata-green-park",
        estimatedMinutes: 10,
        noticeCues: ["案内板", "日なたと日陰", "足元の花"],
        recordCues: ["花", "虫の動き", "風やにおい"],
        safetyNotes: ["通行の邪魔にならない場所で止まる"],
      },
    ],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "car", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["橋や公園入口を目印に戻る", "車や自転車では停められる公開場所だけ使う"],
    },
    claimBoundary: SHARED_CLAIM_BOUNDARY,
    sourceReferences: [
      SHIZUOKA_OFFICIAL_PAGE,
      {
        label: "麻機遊水地コース地図面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/asahata2024-map.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
      {
        label: "麻機遊水地コース情報面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/asahata2024-jyouhou.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
    ],
  },
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-mariko-waterfront-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    title: "丸子川・広野海岸公園の水辺サンプル",
    summary: "川、河口、海岸公園の公開範囲で、水鳥や海辺の植物を軽く残すためのサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "mariko-river-edge",
        title: "川沿いの公開範囲",
        areaKind: "waterfront",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-mariko-river-edge",
        estimatedMinutes: 15,
        noticeCues: ["川の流れ", "橋", "水鳥"],
        recordCues: ["見えた鳥", "水の色", "岸辺の草"],
        safetyNotes: ["川へ降りず、足元が悪い場所には入らない"],
      },
      {
        stopId: "hirono-park-open-space",
        title: "海岸公園の開けた場所",
        areaKind: "park",
        access: "public_access",
        linkedFieldId: "sample:shizuoka-hirono-park-open-space",
        estimatedMinutes: 10,
        noticeCues: ["砂地", "海風", "草花"],
        recordCues: ["海辺の植物", "鳥の動き", "風の様子"],
        safetyNotes: ["消波ブロックや立入禁止の場所へ入らない"],
      },
    ],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "car", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["橋や公園入口を目印に戻る", "海沿いは天候が悪いときに近づかない"],
    },
    claimBoundary: SHARED_CLAIM_BOUNDARY,
    sourceReferences: [
      SHIZUOKA_OFFICIAL_PAGE,
      {
        label: "丸子川・広野海岸公園コース地図面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/000980915.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
      {
        label: "丸子川・広野海岸公園コース情報面",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/000980916.pdf",
        note: "静岡市公式ページ掲載PDF。本文や図版は転載せず、出典として表示します。",
      },
    ],
  },
];

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function uniqueClean(values: string[], maxItems: number, maxLength: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const item = cleanText(raw, maxLength);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

function canShowRecordLink(stop: MunicipalWalkMapStopV0): boolean {
  return stop.access === "public_access" && stop.areaKind !== "other";
}

function recordHref(config: MunicipalWalkMapConfigV0, stop: MunicipalWalkMapStopV0): string | null {
  if (!canShowRecordLink(stop)) return null;
  const params = new URLSearchParams({
    context: "municipal_walk_map",
    walkMapId: config.walkMapId,
    stopId: stop.stopId,
    source: "municipal_walk_map",
  });
  if (stop.linkedFieldId) params.set("fieldId", stop.linkedFieldId);
  return `/record?${params.toString()}`;
}

function accessLabel(stop: MunicipalWalkMapStopV0): "public_scope" | "check_permission" | "not_for_route" {
  if (canShowRecordLink(stop)) return "public_scope";
  if (stop.access === "permission_required") return "check_permission";
  return "not_for_route";
}

export function buildMunicipalWalkMapPublicReadModelV0(config: MunicipalWalkMapConfigV0): MunicipalWalkMapPublicReadModelV0 {
  return {
    schemaVersion: "municipal_walk_map_public/v0",
    walkMapId: cleanText(config.walkMapId, 128),
    municipality: cleanText(config.municipality, 80),
    creatorName: cleanText(config.creatorName, 80),
    title: cleanText(config.title, 120),
    summary: cleanText(config.summary, 240),
    theme: config.theme,
    publishModeLabel: "公開プレビュー",
    stops: config.routeStops.map((stop) => ({
      stopId: cleanText(stop.stopId, 80),
      title: cleanText(stop.title, 120),
      areaKind: stop.areaKind,
      estimatedMinutes: Number.isFinite(Number(stop.estimatedMinutes)) ? Math.max(1, Math.round(Number(stop.estimatedMinutes))) : null,
      noticeCues: uniqueClean(stop.noticeCues, 5, 80),
      recordCues: uniqueClean(stop.recordCues, 5, 80),
      recordHref: recordHref(config, stop),
      accessLabel: accessLabel(stop),
    })),
    routeFlexibility: {
      routeStyle: config.routeFlexibility.routeStyle,
      mobilityModes: uniqueClean(config.routeFlexibility.mobilityModes, 6, 40) as MunicipalWalkMapMobilityModeV0[],
      offRoutePolicy: config.routeFlexibility.offRoutePolicy,
      returnCues: uniqueClean(config.routeFlexibility.returnCues, 6, 120),
    },
    claimBoundary: uniqueClean(config.claimBoundary, 8, 180),
    sourceReferences: config.sourceReferences.map((source) => ({
      label: cleanText(source.label, 120),
      url: cleanText(source.url, 300),
      note: cleanText(source.note, 180),
    })),
  };
}

export function buildMunicipalWalkMapPublicSummaryV0(config: MunicipalWalkMapConfigV0): MunicipalWalkMapPublicSummaryV0 {
  return {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: cleanText(config.walkMapId, 128),
    municipality: cleanText(config.municipality, 80),
    title: cleanText(config.title, 120),
    summary: cleanText(config.summary, 240),
    theme: config.theme,
    routeStyle: config.routeFlexibility.routeStyle,
    mobilityModes: uniqueClean(config.routeFlexibility.mobilityModes, 6, 40) as MunicipalWalkMapMobilityModeV0[],
    stopCount: config.routeStops.length,
    sourceReferences: config.sourceReferences,
  };
}

export function listStaticMunicipalWalkMapPublicSummariesV0(): MunicipalWalkMapPublicSummaryV0[] {
  return STATIC_MUNICIPAL_WALK_MAPS_V0.map(buildMunicipalWalkMapPublicSummaryV0);
}

export function getStaticMunicipalWalkMapConfigV0(walkMapId: string): MunicipalWalkMapConfigV0 | null {
  return STATIC_MUNICIPAL_WALK_MAPS_V0.find((config) => config.walkMapId === walkMapId) ?? null;
}
