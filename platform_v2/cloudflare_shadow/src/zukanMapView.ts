import type { Env } from "./core/env";
import { escapeHtml, finiteNumberOrNull, json } from "./core/http";
import { classifyInvasive } from "./mapInvasive";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { inferTaxonGroupForLabel } from "./zukanMapTaxonGroup";
import { SNAPSHOT_KEY, publicCellsForBbox } from "./placeAtlasProfileNative";

type PlacePinRow = {
  place_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  place_kind?: string | null;
  locality_label?: string | null;
  bbox_south?: number | null;
  bbox_north?: number | null;
  bbox_west?: number | null;
  bbox_east?: number | null;
};

export type MapPlaceCardExtras = {
  recordCount: number | null;
  photoUrl: string | null;
  latestRecord: { observationId: string; label: string | null; observedAt: string | null; photoUrl: string | null } | null;
};

export type MapPlaceCardProfileLike = {
  summary?: { recordCount?: number | null } | null;
  recentRecords?: Array<{
    recordId?: string | null;
    displayName?: string | null;
    observedAt?: string | null;
    mediaUrl?: string | null;
    mediaKind?: string | null;
  } | null> | null;
};

export function mapPlaceCardFromProfile(profile: MapPlaceCardProfileLike): MapPlaceCardExtras {
  const records = (profile.recentRecords ?? []).filter((r): r is NonNullable<typeof r> & { recordId: string } => Boolean(r && r.recordId));
  const summaryCount = typeof profile.summary?.recordCount === "number" ? profile.summary.recordCount : 0;
  const mediaRecords = records.filter((r) => r.mediaUrl && r.mediaKind !== "audio");
  const latest = records[0] ?? null;
  const latestIsPhoto = Boolean(latest?.mediaUrl) && latest?.mediaKind !== "audio";
  return {
    recordCount: summaryCount > 0 ? summaryCount : records.length,
    photoUrl: mediaRecords[0]?.mediaUrl ?? null,
    latestRecord: latest
      ? {
          observationId: latest.recordId,
          label: latest.displayName ?? null,
          observedAt: latest.observedAt ?? null,
          photoUrl: latestIsPhoto ? latest.mediaUrl ?? null : null,
        }
      : null,
  };
}

export const MAP_PLACES_DEFAULT_RADIUS_KM = 10;
export const MAP_PLACES_NEAREST_LIMIT = 20;
export const MAP_PLACES_ENRICH_TOP = 3;
const MAP_PLACES_MAX_RADIUS_KM = 50;
const KM_PER_DEG_LAT = 111.32;

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

function parseOptionalCoordParam(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === "") return null;
  return finiteNumberOrNull(raw);
}

type PublicPlaceRow = {
  placeId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  placeKind: string | null;
  localityLabel: string | null;
  bboxSouth: number | null;
  bboxNorth: number | null;
  bboxWest: number | null;
  bboxEast: number | null;
};

const MAP_PLACES_V2_DEFAULT_LIMIT = 400;
const MAP_PLACES_V2_MAX_LIMIT = 500;
const MAP_PLACES_V2_ENRICH_TOP = 12;
export const MAP_PLACES_V2_UNKNOWN_ENRICH_MAX = 12;
const MAP_PLACES_V2_CELL_QUERY_CHUNK = 80;
const MAP_PLACES_V2_CELL_QUERY_MAX_CELLS = 640;

type PlaceCellProbe = {
  placeId: string;
  lat: number | null;
  lng: number | null;
  bboxSouth: number | null;
  bboxNorth: number | null;
  bboxWest: number | null;
  bboxEast: number | null;
};

export function placeProbeCells(p: PlaceCellProbe): string[] | null {
  const south = p.bboxSouth ?? p.lat;
  const north = p.bboxNorth ?? p.lat;
  const west = p.bboxWest ?? p.lng;
  const east = p.bboxEast ?? p.lng;
  if (south === null || north === null || west === null || east === null) return [];
  return publicCellsForBbox([Math.min(west, east), Math.min(south, north), Math.max(west, east), Math.max(south, north)]);
}

export function selectUnknownCountCandidates(
  places: readonly PlaceCellProbe[],
  points: readonly { lat: number; lng: number }[],
  max: number = MAP_PLACES_V2_UNKNOWN_ENRICH_MAX,
): { candidates: string[]; overflow: string[] } {
  const hit: string[] = [];
  const pad = 0.00005;
  for (const p of places) {
    const south = (p.bboxSouth ?? p.lat);
    const north = (p.bboxNorth ?? p.lat);
    const west = (p.bboxWest ?? p.lng);
    const east = (p.bboxEast ?? p.lng);
    if (south === null || north === null || west === null || east === null) continue;
    const minLat = Math.min(south, north) - pad;
    const maxLat = Math.max(south, north) + pad;
    const minLng = Math.min(west, east) - pad;
    const maxLng = Math.max(west, east) + pad;
    if (points.some((q) => q.lat >= minLat && q.lat <= maxLat && q.lng >= minLng && q.lng <= maxLng)) hit.push(p.placeId);
  }
  return { candidates: hit.slice(0, max), overflow: hit.slice(max) };
}

async function loadSnapshotVisitPoints(db: Env["OBS_DB"], places: readonly PlaceCellProbe[]): Promise<Array<{ lat: number; lng: number }> | null> {
  const cells = new Set<string>();
  for (const p of places) {
    for (const c of placeProbeCells(p) ?? []) {
      cells.add(c);
      if (cells.size >= MAP_PLACES_V2_CELL_QUERY_MAX_CELLS) break;
    }
    if (cells.size >= MAP_PLACES_V2_CELL_QUERY_MAX_CELLS) break;
  }
  const list = [...cells];
  if (list.length === 0) return [];
  const out: Array<{ lat: number; lng: number }> = [];
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < list.length; i += MAP_PLACES_V2_CELL_QUERY_CHUNK) chunks.push(list.slice(i, i + MAP_PLACES_V2_CELL_QUERY_CHUNK));
    const results = await Promise.all(chunks.map((chunk) => db
      .prepare(`SELECT v.exact_lat AS lat, v.exact_lng AS lng
         FROM public_map_snapshot_records_v1 s
         JOIN production_import_visits v ON v.visit_id = s.visit_id
        WHERE s.snapshot_key = ? AND s.cell_1000 IN (${chunk.map(() => "?").join(", ")})
          AND v.exact_lat IS NOT NULL AND v.exact_lng IS NOT NULL
          AND COALESCE(v.public_visibility, 'private') = 'public'
        LIMIT 3000`)
      .bind(SNAPSHOT_KEY, ...chunk)
      .all<{ lat: number; lng: number }>()));
    for (const r of results) for (const row of r.results ?? []) {
      if (typeof row.lat === "number" && typeof row.lng === "number") out.push({ lat: row.lat, lng: row.lng });
    }
    return out;
  } catch {
    return null;
  }
}

function parseCenter(url: URL): { lat: number; lng: number; radiusKm: number } | null {
  const lat = parseOptionalCoordParam(url, "lat");
  const lng = parseOptionalCoordParam(url, "lng");
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const r = parseOptionalCoordParam(url, "radiusKm");
  const radiusKm = r !== null && r > 0 ? Math.min(r, MAP_PLACES_MAX_RADIUS_KM) : MAP_PLACES_DEFAULT_RADIUS_KM;
  return { lat, lng, radiusKm };
}

function parseQueryLimit(url: URL, isV2: boolean): number {
  const raw = url.searchParams.get("limit");
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), MAP_PLACES_V2_MAX_LIMIT);
  return isV2 ? MAP_PLACES_V2_DEFAULT_LIMIT : MAP_PLACES_NEAREST_LIMIT;
}

async function queryPublicPlacesInBounds(url: URL, db: Env["OBS_DB"], opts: { unboundedFallback?: boolean } = {}): Promise<PublicPlaceRow[]> {
  const minLat = parseOptionalCoordParam(url, "minLat");
  const maxLat = parseOptionalCoordParam(url, "maxLat");
  const minLng = parseOptionalCoordParam(url, "minLng");
  const maxLng = parseOptionalCoordParam(url, "maxLng");
  const center = parseCenter(url);
  const hasBounds = minLat !== null && maxLat !== null && minLng !== null && maxLng !== null;
  if (!center && !hasBounds && !opts.unboundedFallback) return [];

  const isV2 = url.searchParams.get("v2") === "1";
  const limit = parseQueryLimit(url, isV2);
  const qText = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const runSelect = async (withExtendedCols: boolean): Promise<PlacePinRow[]> => {
    const ext = withExtendedCols
      ? ", p.place_kind AS place_kind, p.locality_label AS locality_label, b.bbox_south, b.bbox_north, b.bbox_west, b.bbox_east"
      : "";
    const base = `SELECT p.place_id AS place_id,
              p.canonical_name AS name,
              (b.bbox_south + b.bbox_north) / 2.0 AS lat,
              (b.bbox_west + b.bbox_east) / 2.0 AS lng${ext}
         FROM places p
         JOIN place_boundaries b
           ON b.boundary_id = (
                SELECT b2.boundary_id
                  FROM place_boundaries b2
                 WHERE b2.place_id = p.place_id
                   AND b2.valid_to IS NULL
                   AND b2.superseded_by_boundary_id IS NULL
                   AND b2.bbox_south IS NOT NULL AND b2.bbox_north IS NOT NULL
                   AND b2.bbox_west IS NOT NULL AND b2.bbox_east IS NOT NULL
                 ORDER BY b2.is_primary DESC, b2.boundary_version DESC
                 LIMIT 1)
        WHERE p.public_profile_status = 'published'
          AND p.superseded_by_place_id IS NULL`;

    if (center) {
      const cosLat = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
      const dLat = center.radiusKm / KM_PER_DEG_LAT;
      const dLng = center.radiusKm / (KM_PER_DEG_LAT * cosLat);
      let candidates =
        (
          await db
            .prepare(
              `${base}
                AND (b.bbox_south + b.bbox_north) / 2.0 BETWEEN ? AND ?
                AND (b.bbox_west + b.bbox_east) / 2.0 BETWEEN ? AND ?
              ORDER BY (((b.bbox_south + b.bbox_north) / 2.0 - ?) * ((b.bbox_south + b.bbox_north) / 2.0 - ?))
                     + ((((b.bbox_west + b.bbox_east) / 2.0 - ?) * ?) * (((b.bbox_west + b.bbox_east) / 2.0 - ?) * ?)) ASC
              LIMIT ${limit}`
            )
            .bind(center.lat - dLat, center.lat + dLat, center.lng - dLng, center.lng + dLng, center.lat, center.lat, center.lng, cosLat, center.lng, cosLat)
            .all<PlacePinRow>()
        ).results ?? [];
      candidates = candidates.filter((row) => {
        if (typeof row.lat !== "number" || typeof row.lng !== "number") return false;
        const dy = (row.lat - center.lat) * KM_PER_DEG_LAT;
        const dx = (row.lng - center.lng) * KM_PER_DEG_LAT * cosLat;
        return Math.sqrt(dx * dx + dy * dy) <= center.radiusKm;
      });
      return candidates;
    }
    if (hasBounds) {
      return (
        (
          await db
            .prepare(
              `${base}
                AND (b.bbox_south + b.bbox_north) / 2.0 BETWEEN ? AND ?
                AND (b.bbox_west + b.bbox_east) / 2.0 BETWEEN ? AND ?
              LIMIT ${limit}`
            )
            .bind(minLat, maxLat, minLng, maxLng)
            .all<PlacePinRow>()
        ).results ?? []
      );
    }
    return (await db.prepare(`${base} LIMIT ${limit}`).all<PlacePinRow>()).results ?? [];
  };

  let rows: PlacePinRow[] = [];
  try {
    try {
      rows = await runSelect(true);
    } catch {
      rows = await runSelect(false);
    }
  } catch (error) {
    console.error("map places query failed", error);
    rows = [];
  }

  if (qText) {
    rows = rows.filter((row) => String(row.name ?? "").toLowerCase().includes(qText));
  }

  return rows.map((row) => ({
    placeId: row.place_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    placeKind: row.place_kind ?? null,
    localityLabel: row.locality_label ?? null,
    bboxSouth: typeof row.bbox_south === "number" ? row.bbox_south : null,
    bboxNorth: typeof row.bbox_north === "number" ? row.bbox_north : null,
    bboxWest: typeof row.bbox_west === "number" ? row.bbox_west : null,
    bboxEast: typeof row.bbox_east === "number" ? row.bbox_east : null,
  }));
}

export type MapPlaceCardLoader = (placeId: string) => Promise<MapPlaceCardExtras | null>;

export type MapPlacesApiOptions = {
  viewerUserId?: string | null;
};

type BulkPlaceStats = {
  recordCount: number;
  ownCount: number;
  invasive: boolean;
  taxonGroups: Set<string>;
};

function matchesV2TaxonFilter(filter: string, stats: BulkPlaceStats): boolean {
  if (!filter) return true;
  if (filter === "invasive") return stats.invasive;
  if (filter === "water") return stats.taxonGroups.has("water") || stats.taxonGroups.has("amphibian_reptile");
  return stats.taxonGroups.has(filter);
}

async function loadBulkV2PlaceStats(
  db: Env["OBS_DB"],
  placeIds: readonly string[],
  viewerUserId: string | null,
): Promise<Map<string, BulkPlaceStats>> {
  const out = new Map<string, BulkPlaceStats>();
  if (placeIds.length === 0) return out;
  const ensure = (id: string): BulkPlaceStats => {
    let entry = out.get(id);
    if (!entry) {
      entry = { recordCount: 0, ownCount: 0, invasive: false, taxonGroups: new Set<string>() };
      out.set(id, entry);
    }
    return entry;
  };
  try {
    for (let i = 0; i < placeIds.length; i += 80) {
      const chunk = placeIds.slice(i, i + 80);
      const placeholders = chunk.map(() => "?").join(", ");
      const res = await db
        .prepare(
          `SELECT m.place_id,
                  COUNT(DISTINCT m.record_id) AS rec_count,
                  SUM(CASE WHEN ? IS NOT NULL AND COALESCE(v.owner_user_id, '') = ? THEN 1 ELSE 0 END) AS own_count,
                  GROUP_CONCAT(COALESCE(o.taxon_rank, ''), '|') AS ranks,
                  GROUP_CONCAT(COALESCE(NULLIF(o.vernacular_name, ''), o.scientific_name, ''), '|') AS labels
             FROM record_place_memberships m
             JOIN production_import_visits v ON v.visit_id = m.record_id
             JOIN observation_data_rights rights ON rights.visit_id = v.visit_id
             LEFT JOIN production_import_occurrences o ON o.visit_id = v.visit_id
            WHERE m.place_id IN (${placeholders})
              AND m.public_precision = 'place'
              AND m.membership_state = 'confirmed'
              AND m.removed_at IS NULL
              AND COALESCE(v.public_visibility, 'private') = 'public'
              AND rights.withdrawal_status = 'active'
              AND rights.record_consent IN ('public_summary', 'external_export')
            GROUP BY m.place_id`,
        )
        .bind(viewerUserId, viewerUserId, ...chunk)
        .all<{ place_id: string; rec_count: number; own_count: number; ranks: string | null; labels: string | null }>();
      for (const row of res.results ?? []) {
        const s = ensure(row.place_id);
        s.recordCount += Number(row.rec_count ?? 0);
        if (viewerUserId) s.ownCount += Number(row.own_count ?? 0);
        const ranks = String(row.ranks ?? "").split("|");
        const labels = String(row.labels ?? "").split("|");
        for (let k = 0; k < Math.max(ranks.length, labels.length); k++) {
          const lbl = labels[k] ?? "";
          const rnk = ranks[k] ?? "";
          if (lbl && classifyInvasive(lbl)) s.invasive = true;
          const inferred = inferTaxonGroupForLabel(lbl || null, rnk || null);
          if (inferred && inferred !== "other") s.taxonGroups.add(inferred);
          if (/(?:魚|エビ|カニ|カメ|蛙|カエル|オタマジャクシ|水|メダカ|ザリガニ|コイ|フナ|カワニナ)/iu.test(lbl)) {
            s.taxonGroups.add("water");
          }
        }
      }
    }
  } catch {
    // Graceful degradation for DBs/tests without import membership tables
  }
  return out;
}

async function findNearestRecordedPlace(
  db: Env["OBS_DB"],
  center: { lat: number; lng: number } | null,
): Promise<{ placeId: string; name: string; lat: number; lng: number; recordCount: number } | null> {
  if (!center) return null;
  try {
    const cosLat = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
    const row = await db
      .prepare(
        `SELECT p.place_id,
                p.canonical_name AS name,
                (b.bbox_south + b.bbox_north) / 2.0 AS lat,
                (b.bbox_west + b.bbox_east) / 2.0 AS lng,
                COUNT(DISTINCT m.record_id) AS record_count
           FROM places p
           JOIN place_boundaries b
             ON b.place_id = p.place_id AND b.is_primary = 1 AND b.valid_to IS NULL AND b.superseded_by_boundary_id IS NULL
           JOIN record_place_memberships m
             ON m.place_id = p.place_id AND m.public_precision = 'place' AND m.membership_state = 'confirmed' AND m.removed_at IS NULL
           JOIN production_import_visits v
             ON v.visit_id = m.record_id AND COALESCE(v.public_visibility, 'private') = 'public'
           JOIN observation_data_rights rights
             ON rights.visit_id = v.visit_id AND rights.withdrawal_status = 'active' AND rights.record_consent IN ('public_summary', 'external_export')
          WHERE p.public_profile_status = 'published'
            AND p.superseded_by_place_id IS NULL
          GROUP BY p.place_id
          ORDER BY (((b.bbox_south + b.bbox_north) / 2.0 - ?) * ((b.bbox_south + b.bbox_north) / 2.0 - ?))
                 + ((((b.bbox_west + b.bbox_east) / 2.0 - ?) * ?) * (((b.bbox_west + b.bbox_east) / 2.0 - ?) * ?)) ASC
          LIMIT 1`,
      )
      .bind(center.lat, center.lat, center.lng, cosLat, center.lng, cosLat)
      .first<{ place_id: string; name: string; lat: number; lng: number; record_count: number }>();
    if (!row || typeof row.lat !== "number" || typeof row.lng !== "number") return null;
    return {
      placeId: row.place_id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      recordCount: Number(row.record_count ?? 0),
    };
  } catch {
    return null;
  }
}

export async function handleMapPlacesBoundsApi(
  url: URL,
  db: Env["OBS_DB"],
  loadCard?: MapPlaceCardLoader,
  options?: MapPlacesApiOptions,
): Promise<Response> {
  const isV2 = url.searchParams.get("v2") === "1";
  const rows = await queryPublicPlacesInBounds(url, db);

  if (!isV2) {
    const cards = await Promise.all(
      rows.map((row, index) => (loadCard && index < MAP_PLACES_ENRICH_TOP ? loadCard(row.placeId).catch(() => null) : Promise.resolve(null))),
    );
    const places = rows.map((row, index) => {
      const card = cards[index];
      return {
        placeId: row.placeId,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        recordCount: card?.recordCount ?? null,
        photoUrl: card?.photoUrl ?? null,
        latestRecord: card?.latestRecord ?? null,
      };
    });
    return json({ ok: true, places }, 200, { "cache-control": "no-store" });
  }

  const viewerUserId = options?.viewerUserId ?? null;
  const taxonFilter = (url.searchParams.get("taxon_group") ?? "").trim().toLowerCase();
  const hasSearchQuery = Boolean((url.searchParams.get("q") ?? "").trim());
  const statsMap = await loadBulkV2PlaceStats(db, rows.map((r) => r.placeId), viewerUserId);

  const recordedIndices = rows
    .map((r, i) => ({ i, rc: statsMap.get(r.placeId)?.recordCount ?? 0 }))
    .filter((x) => x.rc > 0)
    .slice(0, MAP_PLACES_V2_ENRICH_TOP)
    .map((x) => x.i);
  const recordedSet = new Set(recordedIndices);

  const unknownIds = new Set<string>();
  const unknownCardIds = new Set<string>();
  if (loadCard && !taxonFilter) {
    const noStats = rows.filter((r) => !statsMap.has(r.placeId) && typeof r.lat === "number" && typeof r.lng === "number");
    const visitPoints = noStats.length > 0 ? await loadSnapshotVisitPoints(db, noStats) : null;
    if (visitPoints) {
      const picked = selectUnknownCountCandidates(noStats, visitPoints);
      picked.candidates.forEach((id) => unknownCardIds.add(id));
      picked.overflow.forEach((id) => unknownIds.add(id));
    }
  }

  const cards = await Promise.all(
    rows.map((row, index) => (loadCard && (recordedSet.has(index) || unknownCardIds.has(row.placeId)) ? loadCard(row.placeId).catch(() => null) : Promise.resolve(null))),
  );

  let places = rows.map((row, index) => {
    const stats = statsMap.get(row.placeId);
    const card = cards[index];
    const unknownCount = !stats && (unknownIds.has(row.placeId) || (unknownCardIds.has(row.placeId) && card?.recordCount == null));
    const rc: number | null = unknownCount ? null : (card?.recordCount ?? stats?.recordCount ?? 0);
    return {
      placeId: row.placeId,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      placeKind: row.placeKind ?? "park",
      recordCount: rc,
      speciesCount: null as number | null,
      ...(viewerUserId && stats && stats.ownCount > 0 ? { ownCount: stats.ownCount } : {}),
      photoUrl: card?.photoUrl ?? null,
      photos: card?.photoUrl ? [card.photoUrl] : [],
      latestRecord: card?.latestRecord ?? null,
      invasive: stats?.invasive ?? false,
      taxonGroups: stats ? Array.from(stats.taxonGroups) : [],
      _stats: stats,
    };
  });

  if (taxonFilter && !hasSearchQuery) {
    places = places.filter((p) => (p.recordCount ?? 0) > 0 && p._stats && matchesV2TaxonFilter(taxonFilter, p._stats));
  }

  const cleanPlaces = places.map(({ _stats, ...rest }) => rest);
  const recordedCount = cleanPlaces.filter((p) => (p.recordCount ?? 0) > 0).length;
  const nearestRecorded =
    recordedCount === 0 && !hasSearchQuery ? await findNearestRecordedPlace(db, parseCenter(url)) : null;

  return json(
    { ok: true, places: cleanPlaces, nearestRecorded },
    200,
    {
      "cache-control": viewerUserId ? "private, no-store" : "no-store",
      ...(viewerUserId ? { vary: "cookie, authorization" } : {}),
    },
  );
}

export async function handleMapExploreRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const places = await queryPublicPlacesInBounds(url, db, { unboundedFallback: true });
  const selectedId = url.searchParams.get("placeId") ?? places[0]?.placeId ?? null;
  const selected = places.find((p) => p.placeId === selectedId) ?? places[0] ?? null;

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const pinsListHtml = places
    .map(
      (p) => `<button type="button" class="zm-pin-btn" data-place-id="${escapeHtml(p.placeId)}" data-place-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>`
    )
    .join("");

  const selectedHtml = selected
    ? `<section class="zt-hub-card" id="zukan-map-selected-card" data-selected-place="${escapeHtml(selected.placeId)}">
        <h2 id="zm-sel-title">${escapeHtml(selected.name)}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <a id="zm-sel-link" class="zt-btn-outline" href="${escapeHtml(`${prefix}/places/${encodeURIComponent(selected.placeId)}`)}">${isEn ? "Open place" : "この場所を見る"}</a>
          <a id="zm-sel-capture" class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?placeId=${encodeURIComponent(selected.placeId)}`)}">${isEn ? "Capture here" : "ここで撮る"}</a>
        </div>
      </section>`
    : `<section class="zt-hub-card" id="zukan-map-selected-card"><p>${isEn ? "Select a place pin on the map." : "地図上の場所を選ぶと詳細が出ます。"}</p></section>`;

  const bodyHtml = `<style>
    .zm-wrap{display:grid;gap:16px}
    .zm-canvas{min-height:320px;border-radius:14px;border:1px solid var(--line);background:var(--surface);padding:14px;display:grid;gap:10px;align-content:start}
    .zm-pins{display:flex;flex-wrap:wrap;gap:8px}
    .zm-pin-btn{min-height:44px;padding:6px 12px;border-radius:999px;border:1px solid var(--green);background:#fff;color:var(--green);font:inherit;font-weight:700;cursor:pointer}
    @media(min-width:960px){.zm-wrap{grid-template-columns:1.6fr 1fr;align-items:start}.zm-canvas{min-height:480px}}
  </style>
  <div class="zm-wrap" data-map-view="g1-g3">
    <div id="zukan-maplibre-canvas" class="zm-canvas" data-maplibre-ready="1">
      <p style="margin:0;color:var(--muted);font-size:14px;">${isEn ? "MapLibre public places" : "マップ（公開場所）"}</p>
      <div class="zm-pins">${pinsListHtml}</div>
    </div>
    ${selectedHtml}
  </div>
  <script>
    (() => {
      const prefix = ${JSON.stringify(prefix)};
      document.querySelectorAll(".zm-pin-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-place-id");
          const name = btn.getAttribute("data-place-name");
          if (!id || !name) return;
          const title = document.getElementById("zm-sel-title");
          const link = document.getElementById("zm-sel-link");
          const cap = document.getElementById("zm-sel-capture");
          if (title) title.textContent = name;
          if (link) link.setAttribute("href", prefix + "/places/" + encodeURIComponent(id));
          if (cap) cap.setAttribute("href", prefix + "/record?placeId=" + encodeURIComponent(id));
        });
      });
    })();
  </script>`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Map" : "マップ",
    activeNav: "places",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/map/explore`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
