/**
 * Site Brief — Phase 1 of the Satellite-to-Field Loop.
 *
 * Given a (lat, lng), compose a short hypothesis about what the observer
 * should look for on the ground: a label, 3 reasons, 3 checks, up to 2
 * capture hints. Intentionally deterministic — no LLM, no species model.
 *
 * Signals are pulled from OSM Overpass (nearest water + landuse/natural
 * around the point). GSI elevation is added as a best-effort hint in
 * Japan. All network fetches short-circuit to a generic fallback on
 * failure; the endpoint must never break the map.
 *
 * Rules live in src/config/siteBriefRules.json so iteration happens
 * without code churn.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeGeohash } from "./geohash.js";
import { resolveOfficialNoticeCards, type OfficialNoticeCard } from "./officialNotices.js";
import { getCachedSignals, putCachedSignals } from "./siteSignalsCache.js";
import {
  environmentEvidenceFromSiteSignals,
  getCanonicalPlaceEnvironmentEvidence,
  type PlaceEnvironmentEvidence,
} from "./placeEnvironmentSignals.js";

export type Landcover =
  | "tree_cover"
  | "shrubland"
  | "grassland"
  | "cropland"
  | "built_up"
  | "bare"
  | "water"
  | "wetland";

export type SiteSignals = {
  landcover: Landcover[];
  waterDistanceM: number | null;
  elevationM: number | null;
  nearbyLandcover: Landcover[];
};

export type SiteBrief = {
  hypothesis: { id: string; label: string; confidence: number };
  reasons: string[];
  checks: string[];
  captureHints: string[];
  signals: SiteSignals;
  officialNotices: OfficialNoticeCard[];
  environmentEvidence: PlaceEnvironmentEvidence[];
};

type Rule = {
  id: string;
  label_ja: string;
  label_en: string;
  confidence: number;
  when: {
    /** Must be present in the primary 60m cell (s.landcover). */
    landcover_here_any?: Landcover[];
    /** Present either here or nearby. */
    landcover_any?: Landcover[];
    landcover_pair?: [Landcover[], Landcover[]];
    water_distance_m_lte?: number;
    water_distance_m_gt?: number;
    elevation_m_gte?: number;
    elevation_m_lte?: number;
  };
  reasons_ja: string[];
  reasons_en: string[];
  checks_ja: string[];
  checks_en: string[];
  captures_ja: string[];
  captures_en: string[];
};

export type BriefLang = "ja" | "en";

let cachedRules: Rule[] | null = null;

function loadRules(): Rule[] {
  if (cachedRules) return cachedRules;
  const here = dirname(fileURLToPath(import.meta.url));
  // Runtime path: dist/services → ../../src/config is not reliable.
  // Rules are copied alongside via package layout; fall back to source.
  const candidates = [
    resolve(here, "../config/siteBriefRules.json"),
    resolve(here, "../../src/config/siteBriefRules.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf8");
      cachedRules = JSON.parse(raw) as Rule[];
      return cachedRules;
    } catch {
      /* try next */
    }
  }
  cachedRules = [];
  return cachedRules;
}

// ---------------------------------------------------------------------------
// Signal fetchers
// ---------------------------------------------------------------------------

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const GSI_ELEV_URL = "https://cyberjapandata.gsi.go.jp/general/dem/scripts/getelevation.php";

function mapOsmToLandcover(tags: Record<string, string>): Landcover | null {
  const landuse = tags["landuse"];
  const natural = tags["natural"];
  const leisure = tags["leisure"];
  const waterway = tags["waterway"];
  if (natural === "water" || waterway) return "water";
  if (natural === "wetland") return "wetland";
  if (landuse === "forest" || natural === "wood") return "tree_cover";
  if (natural === "scrub" || natural === "heath") return "shrubland";
  if (landuse === "grass" || landuse === "meadow" || natural === "grassland") return "grassland";
  if (leisure === "park" || leisure === "garden") return "grassland";
  if (
    landuse === "farmland" ||
    landuse === "orchard" ||
    landuse === "vineyard" ||
    landuse === "paddy"
  )
    return "cropland";
  if (landuse === "residential" || landuse === "commercial" || landuse === "industrial" || landuse === "retail")
    return "built_up";
  if (natural === "bare_rock" || natural === "sand" || natural === "beach" || natural === "scree")
    return "bare";
  return null;
}

async function fetchOverpass(lat: number, lng: number, signal: AbortSignal): Promise<{
  here: Landcover[];
  nearby: Landcover[];
  waterDistanceM: number | null;
}> {
  // 60m radius "here" and 300m "nearby" capture microhabitat context.
  const q = `
[out:json][timeout:8];
(
  is_in(${lat},${lng})->.a;
  (.a;way(around:60,${lat},${lng})["landuse"];
   way(around:60,${lat},${lng})["natural"];
   way(around:60,${lat},${lng})["leisure"];);
  way(around:300,${lat},${lng})["landuse"];
  way(around:300,${lat},${lng})["natural"];
  way(around:300,${lat},${lng})["waterway"];
  relation(around:300,${lat},${lng})["natural"="water"];
);
out tags center 60;
`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
    signal,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as {
    elements?: Array<{
      tags?: Record<string, string>;
      center?: { lat: number; lon: number };
      lat?: number;
      lon?: number;
    }>;
  };
  const elems = json.elements ?? [];
  const here = new Set<Landcover>();
  const nearby = new Set<Landcover>();
  let waterDist: number | null = null;
  for (const el of elems) {
    const tags = el.tags ?? {};
    const cov = mapOsmToLandcover(tags);
    const cLat = el.center?.lat ?? el.lat;
    const cLng = el.center?.lon ?? el.lon;
    const d = cLat != null && cLng != null ? haversineMeters(lat, lng, cLat, cLng) : null;
    if (cov) {
      if (d != null && d <= 60) here.add(cov);
      if (d != null && d <= 300) nearby.add(cov);
      else if (d == null) nearby.add(cov); // is_in element without coords counts as "here"
    }
    if ((tags["waterway"] || tags["natural"] === "water") && d != null) {
      waterDist = waterDist == null ? d : Math.min(waterDist, d);
    }
  }
  return { here: [...here], nearby: [...nearby], waterDistanceM: waterDist };
}

async function fetchGsiElevation(lat: number, lng: number, signal: AbortSignal): Promise<number | null> {
  try {
    const url = `${GSI_ELEV_URL}?lon=${lng}&lat=${lat}&outtype=JSON`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { elevation?: number | string };
    const n = typeof j.elevation === "number" ? j.elevation : Number(j.elevation);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

export async function fetchSiteSignals(lat: number, lng: number): Promise<SiteSignals> {
  const geohash7 = encodeGeohash(lat, lng, 7);

  const cached = await getCachedSignals(geohash7);
  if (cached) return cached;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 9000);
  try {
    const [ovp, elev] = await Promise.all([
      fetchOverpass(lat, lng, ac.signal).catch(() => ({
        here: [] as Landcover[],
        nearby: [] as Landcover[],
        waterDistanceM: null as number | null,
      })),
      fetchGsiElevation(lat, lng, ac.signal),
    ]);
    const signals: SiteSignals = {
      landcover: ovp.here,
      nearbyLandcover: ovp.nearby,
      waterDistanceM: ovp.waterDistanceM,
      elevationM: elev,
    };
    // Only cache when we got at least some signal (empty means Overpass failed).
    if (signals.landcover.length > 0 || signals.nearbyLandcover.length > 0) {
      void putCachedSignals(geohash7, signals);
    }
    return signals;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Rule matching
// ---------------------------------------------------------------------------

function ruleMatches(rule: Rule, s: SiteSignals): boolean {
  const w = rule.when;
  const effective: Landcover[] = [...s.landcover, ...s.nearbyLandcover];
  if (w.landcover_here_any && !w.landcover_here_any.some((c) => s.landcover.includes(c))) return false;
  if (w.landcover_any && !w.landcover_any.some((c) => effective.includes(c))) return false;
  if (w.landcover_pair) {
    const [groupA, groupB] = w.landcover_pair;
    const hasA = groupA.some((c) => effective.includes(c));
    const hasB = groupB.some((c) => effective.includes(c));
    if (!hasA || !hasB) return false;
  }
  if (w.water_distance_m_lte != null) {
    if (s.waterDistanceM == null || s.waterDistanceM > w.water_distance_m_lte) return false;
  }
  if (w.water_distance_m_gt != null) {
    if (s.waterDistanceM == null || s.waterDistanceM <= w.water_distance_m_gt) return false;
  }
  if (w.elevation_m_gte != null) {
    if (s.elevationM == null || s.elevationM < w.elevation_m_gte) return false;
  }
  if (w.elevation_m_lte != null) {
    if (s.elevationM == null || s.elevationM > w.elevation_m_lte) return false;
  }
  return true;
}

function hasAnySignal(s: SiteSignals): boolean {
  return (
    s.landcover.length > 0 ||
    s.nearbyLandcover.length > 0 ||
    s.waterDistanceM != null ||
    s.elevationM != null
  );
}

function uniqueLandcover(s: SiteSignals): Landcover[] {
  return [...new Set<Landcover>([...s.landcover, ...s.nearbyLandcover])];
}

function landcoverJa(c: Landcover): string {
  switch (c) {
    case "tree_cover": return "樹林";
    case "shrubland": return "低木・やぶ";
    case "grassland": return "草地";
    case "cropland": return "農地";
    case "built_up": return "市街地";
    case "bare": return "裸地";
    case "water": return "水域";
    case "wetland": return "湿地";
  }
}

function landcoverEn(c: Landcover): string {
  switch (c) {
    case "tree_cover": return "tree cover";
    case "shrubland": return "shrubland";
    case "grassland": return "grassland";
    case "cropland": return "cropland";
    case "built_up": return "built-up land";
    case "bare": return "bare ground";
    case "water": return "water";
    case "wetland": return "wetland";
  }
}

function composeFallbackBrief(signals: SiteSignals, lang: BriefLang): SiteBrief {
  const covers = uniqueLandcover(signals);
  const hasSignals = hasAnySignal(signals);
  const nearWater = signals.waterDistanceM != null && signals.waterDistanceM <= 200;
  const highOrSloped = signals.elevationM != null && signals.elevationM >= 300;
  const hasBuilt = covers.includes("built_up");
  const hasNatural = covers.some((c) => ["tree_cover", "shrubland", "grassland", "wetland", "water"].includes(c));

  if (lang === "en") {
    const coverText = covers.map(landcoverEn).slice(0, 3).join(" / ");
    const label = hasSignals
      ? nearWater
        ? "Ground-check point near water"
        : hasNatural && hasBuilt
          ? "Green edge in a built area"
          : hasNatural
            ? "Habitat clue to verify"
            : highOrSloped
              ? "Elevation-based check point"
              : "Field-check point with partial clues"
      : "Blank field-check point";
    const reasons = hasSignals
      ? [
          coverText ? `Public map clues suggest ${coverText}.` : "Public land-cover tags are thin here.",
          signals.elevationM != null ? `Elevation is about ${Math.round(signals.elevationM)} m.` : "Elevation is not enough by itself; ground condition matters.",
          signals.waterDistanceM != null ? `Mapped water is about ${Math.round(signals.waterDistanceM)} m away.` : "Water, shade, and management traces need field confirmation.",
        ]
      : [
          "Public map signals are too thin to infer habitat confidently.",
          "A first visit can create the baseline for this point.",
          "Record what the map cannot see: ground layer, moisture, and management traces.",
        ];
    return {
      hypothesis: { id: "generic", label, confidence: hasSignals ? 0.32 : 0.18 },
      reasons,
      checks: nearWater
        ? ["Waterline vegetation or ditch condition", "Moist ground, mud, or flow traces", "Shade and mowing/management marks"]
        : ["Whether the ground is grass, trees, pavement, bare soil, or water", "Edges between vegetation and built surfaces", "Moisture, shade, mowing, and footpath traces"],
      captureHints: ["One wide shot that shows the surroundings", "A 10-second clip or close-up of the ground, edge, or waterline"],
      signals,
      officialNotices: [],
      environmentEvidence: [],
    };
  }

  const coverText = covers.map(landcoverJa).slice(0, 3).join("・");
  const label = hasSignals
    ? nearWater
      ? "水辺近くの現地確認地点"
      : hasNatural && hasBuilt
        ? "市街地に残る緑の境界"
        : hasNatural
          ? "環境手がかりの確認地点"
          : highOrSloped
            ? "標高から読む確認地点"
            : "部分的な手がかりの確認地点"
    : "現地確認が必要な空白地点";
  const reasons = hasSignals
    ? [
        coverText ? `公開地図では ${coverText} の手がかりがある。` : "公開地図の土地被覆手がかりは薄い。",
        signals.elevationM != null ? `標高は約 ${Math.round(signals.elevationM)} m。` : "標高だけでは判断できず、地表の状態確認が必要。",
        signals.waterDistanceM != null ? `地図上の水域まで約 ${Math.round(signals.waterDistanceM)} m。` : "水分、日陰、管理痕跡は現地で確認する価値がある。",
      ]
    : [
        "公開地図だけでは環境を読み切れない地点。",
        "最初の記録が、この場所を比較する基準になる。",
        "衛星や地図では見えにくい足元、湿り気、管理痕跡を残せる。",
      ];
  return {
    hypothesis: { id: "generic", label, confidence: hasSignals ? 0.32 : 0.18 },
    reasons,
    checks: nearWater
      ? ["水際や水路の植生", "ぬかるみ・流れ・湿り気の有無", "日陰と刈り込み/管理の跡"]
      : ["地表が草地・樹林・舗装・裸地・水辺のどれか", "植生と人工物の境界", "湿り気、日当たり、刈り込み、踏み跡"],
    captureHints: ["周囲が分かる広角を1枚", "足元・境界・水際を寄りで1枚、または10秒動画"],
    signals,
    officialNotices: [],
    environmentEvidence: [],
  };
}

export function composeSiteBrief(signals: SiteSignals, lang: BriefLang = "ja"): SiteBrief {
  const rules = loadRules();
  const hit = rules.find((r) => ruleMatches(r, signals));
  if (!hit) {
    return composeFallbackBrief(signals, lang);
  }
  const reasons = (lang === "ja" ? hit.reasons_ja : hit.reasons_en).slice(0, 3);
  if (signals.waterDistanceM != null && signals.waterDistanceM <= 200) {
    reasons.push(
      lang === "ja"
        ? `水域まで約 ${Math.round(signals.waterDistanceM)} m`
        : `Water ~${Math.round(signals.waterDistanceM)} m away`,
    );
  }
  if (signals.elevationM != null) {
    reasons.push(
      lang === "ja"
        ? `標高 ${Math.round(signals.elevationM)} m`
        : `Elevation ${Math.round(signals.elevationM)} m`,
    );
  }
  return {
    hypothesis: {
      id: hit.id,
      label: lang === "ja" ? hit.label_ja : hit.label_en,
      confidence: hit.confidence,
    },
    reasons: reasons.slice(0, 3),
    checks: (lang === "ja" ? hit.checks_ja : hit.checks_en).slice(0, 3),
    captureHints: (lang === "ja" ? hit.captures_ja : hit.captures_en).slice(0, 2),
    signals,
    officialNotices: [],
    environmentEvidence: [],
  };
}

export async function getSiteBrief(
  lat: number,
  lng: number,
  lang: BriefLang = "ja",
): Promise<SiteBrief> {
  const signals = await fetchSiteSignals(lat, lng).catch(() => ({
    landcover: [] as Landcover[],
    nearbyLandcover: [] as Landcover[],
    waterDistanceM: null,
    elevationM: null,
  }));
  const brief = composeSiteBrief(signals, lang);
  const [officialNotices, canonicalEnvironmentEvidence] = await Promise.all([
    resolveOfficialNoticeCards(lat, lng, signals, lang).catch(() => []),
    getCanonicalPlaceEnvironmentEvidence(lat, lng).catch(() => []),
  ]);
  return {
    ...brief,
    officialNotices,
    environmentEvidence: canonicalEnvironmentEvidence.length > 0
      ? canonicalEnvironmentEvidence
      : environmentEvidenceFromSiteSignals(signals),
  };
}
