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
import { getCachedSignals, putCachedSignals } from "./siteSignalsCache.js";

type Landcover =
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
    if (s.waterDistanceM != null && s.waterDistanceM <= w.water_distance_m_gt) return false;
  }
  return true;
}

export function composeSiteBrief(signals: SiteSignals, lang: BriefLang = "ja"): SiteBrief {
  const rules = loadRules();
  const hit = rules.find((r) => ruleMatches(r, signals));
  if (!hit) {
    return {
      hypothesis: {
        id: "generic",
        label: lang === "ja" ? "一般的な観察ポイント" : "Generic observation point",
        confidence: 0.2,
      },
      reasons: lang === "ja" ? ["手がかりが少ない"] : ["Low signal coverage"],
      checks:
        lang === "ja"
          ? ["周囲の植生層を眺める", "水・岩・人工物の有無", "光と影の方向"]
          : ["Scan surrounding vegetation layers", "Water, rock, or built surfaces", "Light and shadow direction"],
      captureHints:
        lang === "ja" ? ["広角で1枚", "気になった要素の寄り1枚"] : ["One wide shot", "One close-up of the most interesting element"],
      signals,
    };
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
  return composeSiteBrief(signals, lang);
}
