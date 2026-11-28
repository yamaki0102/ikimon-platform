import { isWeakTaxonLabel } from "./taxonNameResolver";

export type CountDb = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null> } } };

export type RegionCounts = { records: number; species: number; places: number; hiddenRecords: number };
export type RegionCountItem = RegionCounts & { area: string; prefecture: string | null };

export const PREFECTURE_PREFIX = /^(?:北海道|東京都|京都府|大阪府|[^\s都道府県]{2,3}県)(?=.)/;

const HIGHER_RANK_JA = /[界門綱目科]$/u;
const COARSE_WORDS = new Set(["クモ", "アリ", "ハチ", "ガ", "チョウ", "トンボ", "カエル", "魚", "鳥", "虫", "昆虫", "草", "木", "花", "きのこ", "キノコ", "貝", "カビ", "コケ", "シダ"]);
export function isHigherRankName(name: string): boolean {
  const n = String(name ?? "").normalize("NFKC").trim();
  if (!n) return false;
  if (COARSE_WORDS.has(n)) return true;
  if (n.length >= 2 && HIGHER_RANK_JA.test(n) && !/[A-Za-z]/.test(n)) return true;
  return /^[A-Z][a-z]+$/.test(n) && /(?:idae|aceae|ales|inae|opsida|mycota|mycetes|phyta)$/.test(n);
}

export const PUBLIC_RECORD_FROM_SQL = `FROM readmodel_public_observations r
  JOIN observations o ON o.observation_id = r.observation_id
 WHERE o.visibility = 'public' AND o.emergency_hidden = 0
   AND NOT EXISTS (
     SELECT 1 FROM observation_data_rights rights
      WHERE rights.visit_id = o.observation_id
        AND rights.withdrawal_status IS NOT NULL
        AND rights.withdrawal_status <> 'active')`;

export const PLACE_AREA_SQL = `public_profile_status = 'published' AND superseded_by_place_id IS NULL AND (
  municipality = ?1 OR prefecture = ?1 OR locality_label = ?1
  OR (locality_label LIKE '%' || ?1 AND length(locality_label) <= length(?1) + 4)
  OR (locality_label LIKE '%' || ?1 || '%区' AND length(locality_label) <= length(?1) + 8)
  OR CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.municipality') END = ?1)`;

type PlaceRow = { municipality: string | null; prefecture: string | null; locality_label: string | null; metadata_json?: string | null };

export function placeInArea(p: PlaceRow, area: string): boolean {
  if (p.municipality === area || p.prefecture === area || p.locality_label === area) return true;
  const l = p.locality_label;
  if (l) {
    if (l.endsWith(area) && l.length <= area.length + 4) return true;
    const i = l.indexOf(area);
    if (i >= 0 && l.length <= area.length + 8 && l.lastIndexOf("区") >= i + area.length && l.endsWith("区")) return true;
  }
  try { return (p.metadata_json ? (JSON.parse(p.metadata_json) as { municipality?: unknown }).municipality : null) === area; } catch { return false; }
}

async function safeAll<T>(run: () => Promise<{ results?: T[] }>): Promise<T[]> {
  try { return (await run()).results ?? []; } catch { return []; }
}

function countSpecies(labels: Iterable<string | null>): number {
  const fine = new Set<string>();
  for (const label of labels) {
    if (isWeakTaxonLabel(label)) continue;
    const name = String(label).normalize("NFKC").trim();
    if (!isHigherRankName(name)) fine.add(name);
  }
  return fine.size;
}

export async function loadRegionCounts(db: CountDb, area: string): Promise<RegionCounts> {
  const rows = await safeAll(() => db.prepare(
    `SELECT r.taxon_label AS label, COUNT(*) AS n ${PUBLIC_RECORD_FROM_SQL} AND r.public_area_label = ?1 GROUP BY r.taxon_label`,
  ).bind(area).all<{ label: string | null; n: number }>());
  const placeCount = await db.prepare(`SELECT COUNT(*) AS n FROM places WHERE ${PLACE_AREA_SQL}`).bind(area).first<{ n: number }>().catch(() => null);
  return {
    records: rows.reduce((s, r) => s + (Number(r.n) || 0), 0),
    species: countSpecies(rows.map((r) => r.label)),
    places: Number(placeCount?.n ?? 0),
    hiddenRecords: 0,
  };
}

export async function regionHasPublicRecords(db: CountDb, area: string): Promise<boolean> {
  try {
    return Boolean(await db.prepare(`SELECT 1 AS present ${PUBLIC_RECORD_FROM_SQL} AND r.public_area_label = ?1 LIMIT 1`).bind(area).first());
  } catch { return false; }
}

export async function listRegionAreasByRecords(db: CountDb, limit: number): Promise<string[]> {
  const rows = await safeAll(() => db.prepare(
    `SELECT r.public_area_label AS area, COUNT(*) AS n ${PUBLIC_RECORD_FROM_SQL} AND r.public_area_label IS NOT NULL GROUP BY r.public_area_label ORDER BY n DESC LIMIT ?1`,
  ).bind(limit).all<{ area: string | null }>());
  return rows.map((r) => (typeof r.area === "string" ? r.area : "")).filter((a) => a !== "");
}

export async function loadAllRegionCounts(db: CountDb, normalize: (v: string) => string | null, limit = 300): Promise<RegionCountItem[]> {
  const rows = await safeAll(() => db.prepare(
    `WITH pub AS (SELECT r.public_area_label AS area, r.taxon_label AS label ${PUBLIC_RECORD_FROM_SQL} AND r.public_area_label IS NOT NULL),
     top AS (SELECT area FROM pub GROUP BY area ORDER BY COUNT(*) DESC LIMIT ?1)
     SELECT p.area AS area, p.label AS label, COUNT(*) AS n
       FROM pub p JOIN top t ON t.area = p.area
      GROUP BY p.area, p.label LIMIT 30000`,
  ).bind(limit).all<{ area: string; label: string | null; n: number }>());
  if (rows.length === 0) return [];
  const placeRows = await safeAll(() => db.prepare(
    `SELECT municipality, prefecture, locality_label, metadata_json FROM places WHERE public_profile_status = 'published' AND superseded_by_place_id IS NULL LIMIT 5000`,
  ).bind().all<PlaceRow>());
  const agg = new Map<string, { records: number; labels: Array<string | null>; named: boolean }>();
  for (const r of rows) {
    if (typeof r.area !== "string" || normalize(r.area) !== r.area) continue;
    const g = agg.get(r.area) ?? { records: 0, labels: [], named: false };
    g.records += Number(r.n) || 0;
    g.labels.push(r.label);
    if (!isWeakTaxonLabel(r.label)) g.named = true;
    agg.set(r.area, g);
  }
  const items: RegionCountItem[] = [];
  for (const [area, g] of agg) {
    let places = 0;
    let pref: string | null = null;
    for (const p of placeRows) {
      if (placeInArea(p, area)) {
        places += 1;
        if (!pref && p.municipality === area && p.prefecture) pref = p.prefecture;
        if (!pref) pref = p.locality_label?.match(PREFECTURE_PREFIX)?.[0] ?? null;
      }
    }
    if (!g.named && places === 0) continue;
    if (!pref) pref = area.match(PREFECTURE_PREFIX)?.[0] ?? null;
    items.push({ area, prefecture: pref, records: g.records, species: countSpecies(g.labels), places, hiddenRecords: 0 });
  }
  items.sort((a, b) => b.records - a.records || a.area.localeCompare(b.area, "ja"));
  return items;
}
