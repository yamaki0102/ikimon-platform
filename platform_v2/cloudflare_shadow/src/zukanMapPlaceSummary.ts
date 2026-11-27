import type { Env } from "./core/env";
import { json } from "./core/http";
import {
  BUFFER_BBOX_LAT_DEG,
  BUFFER_BBOX_LNG_DEG,
  PLACE_ATLAS_GEOMETRY_BUFFER_M,
  loadPhotoUrls,
  parsePlaceAtlasGeometry,
  placeAtlasGeometryWithinRuntimeBudget,
  pointNearPlaceAtlasGeometry,
} from "./placeAtlasProfileNative";
import { PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS } from "../../src/services/placeAtlasContract";

export const MAP_PLACE_SUMMARY_RECORD_LIMIT = 60;
export const MAP_PLACE_SUMMARY_NEW_PAIR_LIMIT = 400;
export const MAP_PLACE_SUMMARY_PHOTOS = 4;
export const MAP_PLACE_SUMMARY_TAXA = 5;

const PLACEHOLDER_LABELS = new Set(["名前待ち", "名前なし", "同定待ち", "未同定", "不明", "unknown", "unidentified", "awaiting id"]);

export type MapPlaceSummary = {
  placeId: string;
  kind: string | null;
  locality: string | null;
  recordCount: number | null;
  hidden: boolean;
  speciesCount: number | null;
  lastObservedAt: string | null;
  recentPhotos: Array<{ observationId: string; photoUrl: string; label: string | null }>;
  recentTaxa: string[];
};

type Cand = { id: string; ids: string[]; label: string; observedAt: string };

function cleanLabel(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 120);
  if (!s || PLACEHOLDER_LABELS.has(s.toLowerCase())) return "";
  return s;
}

export function summarizeMapPlaceCandidates(
  cands: Cand[],
  photos: Map<string, string>,
  recordCount: number,
): Omit<MapPlaceSummary, "placeId" | "kind" | "locality"> {
  if (recordCount < PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS) {
    return { recordCount: recordCount > 0 ? null : 0, hidden: recordCount > 0, speciesCount: null, lastObservedAt: null, recentPhotos: [], recentTaxa: [] };
  }
  const sorted = [...cands].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const recentPhotos: MapPlaceSummary["recentPhotos"] = [];
  const taxa: string[] = [];
  const allTaxa = new Set<string>();
  for (const c of sorted) {
    const label = cleanLabel(c.label);
    if (label) {
      allTaxa.add(label);
      if (taxa.length < MAP_PLACE_SUMMARY_TAXA && !taxa.includes(label)) taxa.push(label);
    }
    if (recentPhotos.length >= MAP_PLACE_SUMMARY_PHOTOS || seenIds.has(c.id)) continue;
    const url = c.ids.map((i) => photos.get(i)).find((u): u is string => Boolean(u));
    if (!url || seenUrls.has(url)) continue;
    seenIds.add(c.id);
    seenUrls.add(url);
    recentPhotos.push({ observationId: c.id, photoUrl: url, label: label || null });
  }
  return {
    recordCount,
    hidden: false,
    speciesCount: allTaxa.size,
    lastObservedAt: sorted[0]?.observedAt || null,
    recentPhotos,
    recentTaxa: taxa,
  };
}

async function loadImportCandidates(db: Env["OBS_DB"], placeId: string): Promise<{ count: number; cands: Cand[] }> {
  const where = `FROM record_place_memberships m
             JOIN production_import_visits v ON v.visit_id = m.record_id
             JOIN observation_data_rights rights ON rights.visit_id = v.visit_id
             LEFT JOIN production_import_occurrences o ON o.visit_id = v.visit_id
            WHERE m.place_id = ?
              AND m.public_precision = 'place'
              AND m.membership_state = 'confirmed'
              AND m.removed_at IS NULL
              AND COALESCE(v.public_visibility, 'private') = 'public'
              AND rights.withdrawal_status = 'active'
              AND rights.record_consent IN ('public_summary', 'external_export')`;
  try {
    const countRow = await db
      .prepare(`SELECT COUNT(DISTINCT m.record_id) AS n ${where}`)
      .bind(placeId)
      .all<{ n: number }>();
    const rows = await db
      .prepare(
        `SELECT v.visit_id AS visit_id, o.occurrence_id AS occurrence_id,
                COALESCE(v.observed_at, o.created_at, '') AS observed_at,
                COALESCE(NULLIF(o.vernacular_name, ''), NULLIF(o.scientific_name, ''), '') AS label
           ${where}
          ORDER BY COALESCE(v.observed_at, o.created_at, '') DESC
          LIMIT ${MAP_PLACE_SUMMARY_RECORD_LIMIT}`,
      )
      .bind(placeId)
      .all<{ visit_id: string; occurrence_id: string | null; observed_at: string; label: string }>();
    return {
      count: Number(countRow.results?.[0]?.n ?? 0),
      cands: (rows.results ?? []).map((r) => ({
        id: r.occurrence_id || r.visit_id,
        ids: [r.visit_id, r.occurrence_id ?? ""].filter(Boolean),
        label: r.label,
        observedAt: String(r.observed_at ?? ""),
      })),
    };
  } catch {
    return { count: 0, cands: [] };
  }
}

async function loadNewCandidates(db: Env["OBS_DB"], placeId: string): Promise<Cand[]> {
  try {
    const pairs =
      (
        await db
          .prepare(
            `SELECT o.observation_id AS record_id, o.exact_lat AS lat, o.exact_lng AS lng,
                    o.taxon_label AS label, o.observed_at AS observed_at, b.boundary_geojson AS geojson
               FROM place_boundaries b
               JOIN observations o
                 ON o.exact_lat BETWEEN b.bbox_south - ? AND b.bbox_north + ?
                AND o.exact_lng BETWEEN b.bbox_west - ? AND b.bbox_east + ?
              WHERE b.place_id = ?
                AND b.is_primary = 1
                AND b.valid_to IS NULL
                AND b.superseded_by_boundary_id IS NULL
                AND o.visibility = 'public'
                AND COALESCE(o.emergency_hidden, 0) = 0
                AND NOT EXISTS (SELECT 1 FROM production_import_visits pv WHERE pv.visit_id = o.observation_id)
                AND EXISTS (
                  SELECT 1 FROM observation_data_rights rights
                   WHERE rights.visit_id = o.observation_id
                     AND rights.withdrawal_status = 'active'
                     AND rights.record_consent IN ('public_summary', 'external_export')
                )
              ORDER BY o.observed_at DESC
              LIMIT ${MAP_PLACE_SUMMARY_NEW_PAIR_LIMIT}`,
          )
          .bind(BUFFER_BBOX_LAT_DEG, BUFFER_BBOX_LAT_DEG, BUFFER_BBOX_LNG_DEG, BUFFER_BBOX_LNG_DEG, placeId)
          .all<{ record_id: string; lat: number; lng: number; label: string | null; observed_at: string; geojson: string | null }>()
      ).results ?? [];
    let geometry: ReturnType<typeof parsePlaceAtlasGeometry> | undefined;
    const seen = new Set<string>();
    const out: Cand[] = [];
    for (const p of pairs) {
      if (seen.has(p.record_id)) continue;
      if (geometry === undefined) {
        geometry = parsePlaceAtlasGeometry(p.geojson);
        if (geometry && !placeAtlasGeometryWithinRuntimeBudget(geometry)) geometry = null;
      }
      if (geometry && !pointNearPlaceAtlasGeometry(Number(p.lng), Number(p.lat), geometry, PLACE_ATLAS_GEOMETRY_BUFFER_M)) continue;
      seen.add(p.record_id);
      out.push({ id: p.record_id, ids: [p.record_id], label: String(p.label ?? ""), observedAt: String(p.observed_at ?? "") });
    }
    return out;
  } catch {
    return [];
  }
}

type PlaceMetaRow = { place_kind: string | null; locality_label: string | null };

export async function loadMapPlaceSummary(db: Env["OBS_DB"], placeId: string): Promise<MapPlaceSummary | null> {
  let meta: PlaceMetaRow | null = null;
  const base = `FROM places WHERE place_id = ? AND public_profile_status = 'published' AND superseded_by_place_id IS NULL LIMIT 1`;
  try {
    meta = (await db.prepare(`SELECT place_kind, locality_label ${base}`).bind(placeId).all<PlaceMetaRow>()).results?.[0] ?? null;
  } catch {
    try {
      meta = (await db.prepare(`SELECT NULL AS place_kind, NULL AS locality_label ${base}`).bind(placeId).all<PlaceMetaRow>()).results?.[0] ?? null;
    } catch {
      meta = null;
    }
  }
  if (!meta) return null;
  const [imp, fresh] = await Promise.all([loadImportCandidates(db, placeId), loadNewCandidates(db, placeId)]);
  const recordCount = imp.count + fresh.length;
  const cands = [...imp.cands, ...fresh].sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, 40);
  let photos = new Map<string, string>();
  if (recordCount >= PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS && cands.length > 0) {
    const ids = [...new Set(cands.flatMap((c) => c.ids))].slice(0, 80);
    photos = await loadPhotoUrls(db as never, ids).catch(() => new Map<string, string>());
  }
  return {
    placeId,
    kind: meta.place_kind ?? null,
    locality: meta.locality_label ?? null,
    ...summarizeMapPlaceCandidates(cands, photos, recordCount),
  };
}

export async function handleMapPlaceSummaryApi(db: Env["OBS_DB"], placeId: string): Promise<Response> {
  const summary = await loadMapPlaceSummary(db, placeId);
  if (!summary) return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  return json({ ok: true, summary }, 200, { "cache-control": "public, max-age=60" });
}
