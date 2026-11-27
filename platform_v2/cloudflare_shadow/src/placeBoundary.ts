import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";

export type PlaceBoundaryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

const MAX_POINTS = 4000;
const MAX_IDS = 50;

function validRing(ring: unknown): ring is number[][] {
  return Array.isArray(ring) && ring.length >= 4 && ring.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90);
}

export function parsePlaceBoundaryGeometry(raw: unknown): PlaceBoundaryGeometry | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const g = value as { type?: unknown; coordinates?: unknown };
  let count = 0;
  if (g.type === "Polygon" && Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every(validRing)) {
    for (const r of g.coordinates as number[][][]) count += r.length;
    return count <= MAX_POINTS ? { type: "Polygon", coordinates: g.coordinates as number[][][] } : null;
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates) && g.coordinates.length > 0
    && g.coordinates.every((poly) => Array.isArray(poly) && poly.length > 0 && poly.every(validRing))) {
    for (const poly of g.coordinates as number[][][][]) for (const r of poly) count += r.length;
    return count <= MAX_POINTS ? { type: "MultiPolygon", coordinates: g.coordinates as number[][][][] } : null;
  }
  return null;
}

export async function loadPlaceBoundaries(db: Env["OBS_DB"], placeIds: string[]): Promise<Map<string, PlaceBoundaryGeometry>> {
  const out = new Map<string, PlaceBoundaryGeometry>();
  const ids = Array.from(new Set(placeIds.filter((id) => typeof id === "string" && id.length > 0))).slice(0, MAX_IDS);
  if (ids.length === 0) return out;
  const marks = ids.map(() => "?").join(",");
  try {
    const rows = await db.prepare(
      `SELECT field_id, entity_key, geometry_json
         FROM production_import_area_polygon_readmodel
        WHERE entity_key IN (${marks}) OR field_id IN (${marks})`,
    ).bind(...ids, ...ids).all<{ field_id: string; entity_key: string | null; geometry_json: string }>();
    for (const row of rows.results ?? []) {
      const geometry = parsePlaceBoundaryGeometry(row.geometry_json);
      if (!geometry) continue;
      for (const key of [row.entity_key, row.field_id]) {
        if (key && ids.includes(key) && !out.has(key)) out.set(key, geometry);
      }
    }
  } catch (error) {
    if (/no such table|no such column|production_import_area_polygon_readmodel/i.test(String(error))) return out;
    throw error;
  }
  return out;
}

export function placeBoundaryPolygons(geometry: PlaceBoundaryGeometry): number[][][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

export function renderPlaceBoundarySection(geometry: PlaceBoundaryGeometry | null | undefined, lang: string, name: string): string {
  if (!geometry) return "";
  const polys = placeBoundaryPolygons(geometry);
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const poly of polys) for (const ring of poly) for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return "";
  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const w = Math.max((maxLng - minLng) * kx, 1e-9);
  const h = Math.max(maxLat - minLat, 1e-9);
  const box = 300;
  const scale = box / Math.max(w, h);
  const pad = 12;
  const vw = Math.round(w * scale + pad * 2);
  const vh = Math.round(h * scale + pad * 2);
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  const d = polys.map((poly) => poly.map((ring) =>
    "M" + ring.map(([lng, lat]) => `${fmt(pad + (lng - minLng) * kx * scale)} ${fmt(pad + (maxLat - lat) * scale)}`).join("L") + "Z",
  ).join("")).join("");
  const title = lang === "ja" ? "この場所の範囲" : "Area of this place";
  const label = `${title}: ${name}`;
  return `<section class="pbd" data-place-boundary aria-label="${escapeHtml(title)}"><style>.pbd{margin:24px 20px 0;padding:16px;border:1px solid #dde2dc;border-radius:16px;background:#fff;max-width:1080px;box-sizing:border-box}@media(min-width:1160px){.pbd{margin-left:auto;margin-right:auto}}.pbd h2{margin:0 0 10px;font-size:1.125rem;line-height:1.5}.pbd svg{display:block;width:100%;max-width:420px;max-height:320px;height:auto;margin:0 auto;background:#f3f6f2;border-radius:12px}</style><h2>${escapeHtml(title)}</h2><svg viewBox="0 0 ${vw} ${vh}" role="img" aria-label="${escapeHtml(label)}"><path d="${d}" fill="#143f2e" fill-opacity="0.08" stroke="#143f2e" stroke-width="2" stroke-linejoin="round" fill-rule="evenodd"/></svg></section>`;
}
