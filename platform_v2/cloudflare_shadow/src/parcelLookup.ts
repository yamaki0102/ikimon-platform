import { SAFE_PUBLIC_FROM, speciesName } from "./regionSeason";

type Stmt = { bind(...v: unknown[]): Stmt; all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null> };
export type ParcelDb = { prepare(sql: string): Stmt };
export type Ring = number[][];
export type MultiPolygon = Ring[][];

export type ParcelRef = { pid: string; city_code: string; oaza: string; chome: string; koaza: string; chiban: string; label: string };
export type Parcel = ParcelRef & { rings: MultiPolygon; bbox: [number, number, number, number]; attribution: string | null };
export type ParcelRecord = { id: string; label: string | null; observedAt: string; photoUrl: string | null };
export type ParcelRecordDeps = {
  photoLoader: (ids: readonly string[]) => Promise<Map<string, string>>;
  blocked: (observationId: string) => Promise<boolean>;
};

export const PARCEL_CELL = 0.002;
export const PARCEL_RECORD_LIMIT = 60;

export const cellOf = (lng: number, lat: number): number => Math.trunc(lng / PARCEL_CELL) * 100000 + Math.trunc(lat / PARCEL_CELL);

const inRing = (lng: number, lat: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > lat !== yj! > lat && lng < ((xj! - xi!) * (lat - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
};

export function pointInMultiPolygon(lng: number, lat: number, polygons: MultiPolygon): boolean {
  for (const rings of polygons) {
    let inside = false;
    for (const ring of rings) if (inRing(lng, lat, ring)) inside = !inside;
    if (inside) return true;
  }
  return false;
}

const parseRings = (raw: unknown): MultiPolygon | null => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? (v as MultiPolygon) : null;
  } catch { return null; }
};

export const parcelLabel = (p: { oaza?: string | null; chome?: string | null; koaza?: string | null; chiban?: string | null }): string =>
  [p.oaza, p.chome, p.koaza, p.chiban].map((x) => String(x ?? "").trim()).filter(Boolean).join("");

type Row = { pid: string; city_code: string | null; oaza: string | null; chome: string | null; koaza: string | null; chiban: string | null; min_lng: number; min_lat: number; max_lng: number; max_lat: number; rings: string | null };

const refOf = (r: Row): ParcelRef => ({
  pid: r.pid, city_code: String(r.city_code ?? ""), oaza: String(r.oaza ?? ""), chome: String(r.chome ?? ""), koaza: String(r.koaza ?? ""), chiban: String(r.chiban ?? ""), label: parcelLabel(r),
});

export async function lookupParcel(db: ParcelDb | null | undefined, lng: number, lat: number): Promise<ParcelRef | null> {
  if (!db || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  try {
    const rows = (await db.prepare(
      `SELECT p.* FROM parcel_cells c JOIN parcels p ON p.pid = c.pid WHERE c.cell = ?1 AND p.min_lat <= ?2 AND p.max_lat >= ?2 AND p.min_lng <= ?3 AND p.max_lng >= ?3`,
    ).bind(cellOf(lng, lat), lat, lng).all<Row>()).results ?? [];
    const hits = rows
      .map((r) => ({ r, rings: parseRings(r.rings) }))
      .filter((x) => x.rings && pointInMultiPolygon(lng, lat, x.rings))
      .sort((a, b) => (a.r.max_lng - a.r.min_lng) * (a.r.max_lat - a.r.min_lat) - (b.r.max_lng - b.r.min_lng) * (b.r.max_lat - b.r.min_lat) || (a.r.pid < b.r.pid ? -1 : 1));
    return hits[0] ? refOf(hits[0].r) : null;
  } catch { return null; }
}

export async function loadParcel(db: ParcelDb | null | undefined, pid: string): Promise<Parcel | null> {
  if (!db || !pid) return null;
  try {
    const r = await db.prepare(`SELECT * FROM parcels WHERE pid = ?1`).bind(pid).first<Row & { source_version: string | null }>();
    if (!r) return null;
    const rings = parseRings(r.rings);
    if (!rings) return null;
    const src = r.source_version
      ? await db.prepare(`SELECT attribution_text FROM sources WHERE source_version = ?1`).bind(r.source_version).first<{ attribution_text: string | null }>().catch(() => null)
      : null;
    return { ...refOf(r), rings, bbox: [r.min_lng, r.min_lat, r.max_lng, r.max_lat], attribution: src?.attribution_text ?? null };
  } catch { return null; }
}

type RecRow = { id: string; label: string | null; at: string; lat: number | null; lng: number | null };

export async function recordsInParcel(
  env: { PLACE_DB?: ParcelDb; OBS_DB: ParcelDb },
  pid: string,
  deps: ParcelRecordDeps,
): Promise<ParcelRecord[]> {
  const parcel = await loadParcel(env.PLACE_DB, pid);
  if (!parcel) return [];
  let rows: RecRow[] = [];
  try {
    rows = (await env.OBS_DB.prepare(
      `SELECT r.observation_id AS id, r.taxon_label AS label, r.observed_at AS at, o.exact_lat AS lat, o.exact_lng AS lng ${SAFE_PUBLIC_FROM}
         AND o.exact_lat BETWEEN ?1 AND ?2 AND o.exact_lng BETWEEN ?3 AND ?4 ORDER BY r.observed_at DESC LIMIT 400`,
    ).bind(parcel.bbox[1], parcel.bbox[3], parcel.bbox[0], parcel.bbox[2]).all<RecRow>()).results ?? [];
  } catch { return []; }
  const seen = new Set<string>();
  const inside: RecRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id) || typeof r.lat !== "number" || typeof r.lng !== "number") continue;
    if (!pointInMultiPolygon(r.lng, r.lat, parcel.rings)) continue;
    seen.add(r.id);
    inside.push(r);
  }
  const allowed: RecRow[] = [];
  for (const r of inside) {
    if (allowed.length >= PARCEL_RECORD_LIMIT) break;
    if (await deps.blocked(r.id).catch(() => true)) continue;
    allowed.push(r);
  }
  const photos = allowed.length ? await deps.photoLoader(allowed.map((r) => r.id)).catch(() => new Map<string, string>()) : new Map<string, string>();
  const used = new Set<string>();
  return allowed.map((r) => {
    const url = photos.get(r.id) ?? null;
    const photoUrl = url && !used.has(url) ? url : null;
    if (photoUrl) used.add(photoUrl);
    return { id: r.id, label: speciesName(r.label), observedAt: r.at, photoUrl };
  });
}

export async function parcelRefForObservation(
  env: { PLACE_DB?: ParcelDb; OBS_DB: ParcelDb },
  observationId: string,
  blocked: (observationId: string) => Promise<boolean>,
): Promise<ParcelRef | null> {
  if (!env.PLACE_DB) return null;
  try {
    const row = await env.OBS_DB.prepare(`SELECT o.exact_lat AS lat, o.exact_lng AS lng ${SAFE_PUBLIC_FROM} AND r.observation_id = ?1 LIMIT 1`)
      .bind(observationId).first<{ lat: number | null; lng: number | null }>();
    if (!row || typeof row.lat !== "number" || typeof row.lng !== "number") return null;
    if (await blocked(observationId).catch(() => true)) return null;
    return await lookupParcel(env.PLACE_DB, row.lng, row.lat);
  } catch { return null; }
}
