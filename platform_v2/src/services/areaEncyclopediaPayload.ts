import { coarsenPublicCoordinateToCell } from "./publicLocation.js";

export type AreaSpotType =
  | "park_land"
  | "facility"
  | "water_care"
  | "observation_point"
  | "food"
  | "experience";

export type AreaEncyclopediaSpot = {
  id: string;
  name: string;
  type: AreaSpotType;
  summary: string;
  lat: number | null;
  lng: number | null;
  publicRecordCount: number;
  publicContributorCount: number;
  guideCount: number;
  actorIds: string[];
};

export type AreaLocalGuide = {
  id: string;
  spotId: string | null;
  title: string;
  status: "planned" | "available";
  unlockRadiusM: number | null;
  transcriptAvailable: boolean;
  audioDurationSeconds: number | null;
  languages: string[];
  safetyNote: string;
};

export type AreaGuideTemplateKey =
  | "basic_park"
  | "seasonal_entry"
  | "water_edge"
  | "tree_watch"
  | "safety_manners"
  | "watch_material";

export type AreaGuideTemplate = {
  key: AreaGuideTemplateKey;
  title: string;
  summary: string;
};

export type AreaActor = {
  id: string;
  name: string;
  roleLabel: string;
  url: string;
};

export type AreaExternalLink = {
  label: string;
  url: string;
};

export type AreaEncyclopediaPayload = {
  pageKind: "area" | "spot";
  tags: string[];
  spots: AreaEncyclopediaSpot[];
  localGuides: AreaLocalGuide[];
  guideTemplates: AreaGuideTemplateKey[];
  actors: AreaActor[];
  externalLinks: AreaExternalLink[];
};

export const AREA_SPOT_TYPE_LABELS: Record<AreaSpotType, string> = {
  park_land: "公園・用地",
  facility: "施設",
  water_care: "守る水辺",
  observation_point: "観察地点",
  food: "食",
  experience: "体験",
};

const SPOT_TYPES: ReadonlySet<string> = new Set(Object.keys(AREA_SPOT_TYPE_LABELS));
export const AREA_SPOT_PUBLIC_COORDINATE_GRID_M = 500;
export const AREA_SPOT_MIN_PUBLIC_RECORDS = 5;
export const AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS = 3;
const PUBLIC_SPOT_PRECISIONS: ReadonlySet<string> = new Set(["site", "mesh", "municipality"]);
const PUBLIC_SPOT_LOCATION_PRIVACY: ReadonlySet<string> = new Set(["public", "coarse"]);
const PUBLIC_SPOT_RISK_LANES: ReadonlySet<string> = new Set(["normal"]);
const GUIDE_TEMPLATE_KEYS: ReadonlySet<string> = new Set([
  "basic_park",
  "seasonal_entry",
  "water_edge",
  "tree_watch",
  "safety_manners",
  "watch_material",
]);

const AREA_GUIDE_TEMPLATES: Record<AreaGuideTemplateKey, AreaGuideTemplate> = {
  basic_park: {
    key: "basic_park",
    title: "はじめての1分ガイド",
    summary: "足元、木の幹、花壇の端を順に見ると、普通の公園でも記録の入口が見つかります。",
  },
  seasonal_entry: {
    key: "seasonal_entry",
    title: "季節の入口ガイド",
    summary: "春は花と新芽、夏は虫、秋は実と落ち葉、冬は鳥の動きが見つけやすい。",
  },
  water_edge: {
    key: "water_edge",
    title: "水辺を見るガイド",
    summary: "水面だけでなく、水際の草、石の上、日陰を見てみよう。",
  },
  tree_watch: {
    key: "tree_watch",
    title: "木のまわりガイド",
    summary: "幹、根元、葉の裏、落ち葉を順番に見ると、同じ木でも記録が増えます。",
  },
  safety_manners: {
    key: "safety_manners",
    title: "安全・マナーガイド",
    summary: "採らない、触らない、踏み込まない。写真とメモだけで十分な記録になります。",
  },
  watch_material: {
    key: "watch_material",
    title: "見守り材料ガイド",
    summary: "同じ場所を月に1回見ると、増えたもの、減ったもの、季節の違いが見えてきます。",
  },
};

const EMPTY_AREA_ENCYCLOPEDIA: AreaEncyclopediaPayload = {
  pageKind: "area",
  tags: [],
  spots: [],
  localGuides: [],
  guideTemplates: [],
  actors: [],
  externalLinks: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, maxLength = 160): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

function isFiniteLatitude(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isFiniteLongitude(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function cleanNonNegativeInteger(value: unknown): number {
  const num = cleanNumber(value);
  if (num == null) return 0;
  return Math.max(0, Math.floor(num));
}

function cleanBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function cleanStringList(value: unknown, maxItems: number, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    const text = cleanString(item, maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    items.push(text);
    if (items.length >= maxItems) break;
  }
  return items;
}

function cleanGuideTemplateKeys(value: unknown): AreaGuideTemplateKey[] {
  if (!Array.isArray(value)) return [];
  const keys: AreaGuideTemplateKey[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const key = cleanString(item, 40);
    if (!GUIDE_TEMPLATE_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key as AreaGuideTemplateKey);
  }
  return keys;
}

function cleanHttpUrl(value: unknown): string {
  const url = cleanString(value, 500);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function readAreaRoot(payload: Record<string, unknown>): Record<string, unknown> | null {
  const root = payload.area_encyclopedia;
  return isRecord(root) ? root : null;
}

function maxContributorCount(value: unknown, actorIds: string[]): number {
  return Math.max(cleanNonNegativeInteger(value), actorIds.length);
}

function textFlag(value: unknown): string {
  return cleanString(value, 80).toLowerCase();
}

function safePublicSpotCoordinates(input: {
  lat: number | null;
  lng: number | null;
  publicRecordCount: number;
  publicContributorCount: number;
  publicPrecision: string;
  locationPrivacy: string;
  riskLane: string;
}): { lat: number; lng: number } | null {
  if (!isFiniteLatitude(input.lat) || !isFiniteLongitude(input.lng)) return null;
  if (input.publicRecordCount < AREA_SPOT_MIN_PUBLIC_RECORDS) return null;
  if (input.publicContributorCount < AREA_SPOT_MIN_PUBLIC_CONTRIBUTORS) return null;
  if (!PUBLIC_SPOT_PRECISIONS.has(input.publicPrecision)) return null;
  if (!PUBLIC_SPOT_LOCATION_PRIVACY.has(input.locationPrivacy)) return null;
  if (!PUBLIC_SPOT_RISK_LANES.has(input.riskLane)) return null;

  const coarsened = coarsenPublicCoordinateToCell(input.lat, input.lng, AREA_SPOT_PUBLIC_COORDINATE_GRID_M);
  return coarsened ? { lat: coarsened.lat, lng: coarsened.lng } : null;
}

function normalizeSpot(value: unknown): AreaEncyclopediaSpot | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 80);
  const name = cleanString(value.name, 120);
  const type = cleanString(value.type, 40);
  if (!id || !name || !SPOT_TYPES.has(type)) return null;
  const publicRecordCount = cleanNonNegativeInteger(value.public_record_count);
  const actorIds = cleanStringList(value.actor_ids, 12, 80);
  const publicContributorCount = maxContributorCount(value.public_contributor_count, actorIds);
  const publicCoordinates = safePublicSpotCoordinates({
    lat: cleanNumber(value.lat),
    lng: cleanNumber(value.lng),
    publicRecordCount,
    publicContributorCount,
    publicPrecision: textFlag(value.public_precision ?? value.public_coordinate_precision ?? value.coordinate_precision),
    locationPrivacy: textFlag(value.location_privacy ?? value.privacy),
    riskLane: textFlag(value.risk_lane ?? value.riskLane),
  });
  return {
    id,
    name,
    type: type as AreaSpotType,
    summary: cleanString(value.summary, 240),
    lat: publicCoordinates?.lat ?? null,
    lng: publicCoordinates?.lng ?? null,
    publicRecordCount,
    publicContributorCount,
    guideCount: cleanNonNegativeInteger(value.guide_count),
    actorIds,
  };
}

function normalizeGuide(value: unknown): AreaLocalGuide | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 80);
  const title = cleanString(value.title, 140);
  if (!id || !title) return null;
  const status = value.status === "available" ? "available" : "planned";
  return {
    id,
    spotId: cleanString(value.spot_id, 80) || null,
    title,
    status,
    unlockRadiusM: cleanNumber(value.unlock_radius_m),
    transcriptAvailable: cleanBoolean(value.transcript_available),
    audioDurationSeconds: cleanNumber(value.audio_duration_seconds),
    languages: cleanStringList(value.languages, 8, 24),
    safetyNote: cleanString(value.safety_note, 180),
  };
}

function normalizeActor(value: unknown): AreaActor | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 80);
  const name = cleanString(value.name, 120);
  const roleLabel = cleanString(value.role_label, 80);
  if (!id || !name || !roleLabel) return null;
  return { id, name, roleLabel, url: cleanHttpUrl(value.url) };
}

function normalizeExternalLink(value: unknown): AreaExternalLink | null {
  if (!isRecord(value)) return null;
  const label = cleanString(value.label, 80);
  const url = cleanHttpUrl(value.url);
  if (!label || !url) return null;
  return { label, url };
}

function normalizeList<T>(value: unknown, mapper: (item: unknown) => T | null, maxItems: number): T[] {
  if (!Array.isArray(value)) return [];
  const items: T[] = [];
  for (const item of value) {
    const normalized = mapper(item);
    if (!normalized) continue;
    items.push(normalized);
    if (items.length >= maxItems) break;
  }
  return items;
}

export function normalizeAreaEncyclopediaPayload(payload: Record<string, unknown>): AreaEncyclopediaPayload {
  const root = readAreaRoot(payload);
  if (!root) return { ...EMPTY_AREA_ENCYCLOPEDIA };
  return {
    pageKind: root.page_kind === "spot" ? "spot" : "area",
    tags: cleanStringList(root.tags, 12, 48),
    spots: normalizeList(root.spots, normalizeSpot, 80),
    localGuides: normalizeList(root.local_guides, normalizeGuide, 40),
    guideTemplates: cleanGuideTemplateKeys(root.guide_templates),
    actors: normalizeList(root.actors, normalizeActor, 40),
    externalLinks: normalizeList(root.external_links, normalizeExternalLink, 20),
  };
}

export function spotHasPublicCoordinates(
  spot: AreaEncyclopediaSpot,
): spot is AreaEncyclopediaSpot & { lat: number; lng: number } {
  return spot.lat != null && spot.lng != null;
}

function inferGuideTemplateKeys(encyclopedia: AreaEncyclopediaPayload): AreaGuideTemplateKey[] {
  const spotTypes = new Set(encyclopedia.spots.map((spot) => spot.type));
  const keys: AreaGuideTemplateKey[] = [];
  const push = (key: AreaGuideTemplateKey) => {
    if (!keys.includes(key)) keys.push(key);
  };

  if (spotTypes.has("water_care")) {
    push("water_edge");
  } else {
    push("basic_park");
  }
  push("seasonal_entry");
  if (spotTypes.has("park_land") || encyclopedia.spots.length === 0) {
    push("tree_watch");
  }
  if (spotTypes.has("facility") || spotTypes.has("experience")) {
    push("safety_manners");
  }
  push("watch_material");
  push("safety_manners");

  return keys;
}

export function resolveAreaGuideTemplates(
  encyclopedia: AreaEncyclopediaPayload,
  maxItems = 3,
): AreaGuideTemplate[] {
  const keys = encyclopedia.guideTemplates.length > 0
    ? encyclopedia.guideTemplates
    : inferGuideTemplateKeys(encyclopedia);
  return keys.slice(0, Math.max(0, maxItems)).map((key) => AREA_GUIDE_TEMPLATES[key]);
}
