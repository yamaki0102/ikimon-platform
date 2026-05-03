import { getPool } from "../db.js";
import { computeBbox } from "./geoJsonBbox.js";

export type FieldSource =
  | "user_defined"
  | "nature_symbiosis_site"
  | "tsunag"
  | "protected_area"
  | "oecm";

function bboxColumnsFromPolygon(polygon: Record<string, unknown> | null | undefined): {
  minLat: number | null;
  maxLat: number | null;
  minLng: number | null;
  maxLng: number | null;
} {
  if (!polygon) return { minLat: null, maxLat: null, minLng: null, maxLng: null };
  const bbox = computeBbox(polygon);
  if (!bbox) return { minLat: null, maxLat: null, minLng: null, maxLng: null };
  return { minLat: bbox.minLat, maxLat: bbox.maxLat, minLng: bbox.minLng, maxLng: bbox.maxLng };
}

const SOURCE_TO_ADMIN_LEVEL: Record<FieldSource, string | null> = {
  user_defined: null,
  nature_symbiosis_site: "symbiosis",
  tsunag: "tsunag",
  protected_area: "protected",
  oecm: "oecm",
};

export interface ObservationField {
  fieldId: string;
  source: FieldSource;
  name: string;
  nameKana: string;
  summary: string;
  prefecture: string;
  city: string;
  lat: number;
  lng: number;
  radiusM: number;
  polygon: Record<string, unknown> | null;
  areaHa: number | null;
  certificationId: string;
  certifiedAt: string | null;
  officialUrl: string;
  ownerUserId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface RawFieldRow extends Record<string, unknown> {
  field_id: string;
  source: string;
  name: string;
  name_kana: string;
  summary: string;
  prefecture: string;
  city: string;
  lat: string | number;
  lng: string | number;
  radius_m: number;
  polygon: Record<string, unknown> | null;
  area_ha: string | number | null;
  certification_id: string;
  certified_at: string | null;
  official_url: string;
  owner_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  field_id, source, name, name_kana, summary, prefecture, city,
  lat::text AS lat, lng::text AS lng, radius_m, polygon,
  area_ha::text AS area_ha, certification_id,
  certified_at::text AS certified_at,
  official_url, owner_user_id, payload,
  created_at::text AS created_at, updated_at::text AS updated_at
`;

function isFieldSource(value: unknown): value is FieldSource {
  return typeof value === "string" &&
    ["user_defined", "nature_symbiosis_site", "tsunag", "protected_area", "oecm"].includes(value);
}

function mapRow(row: RawFieldRow): ObservationField {
  return {
    fieldId: row.field_id,
    source: isFieldSource(row.source) ? row.source : "user_defined",
    name: row.name,
    nameKana: row.name_kana ?? "",
    summary: row.summary ?? "",
    prefecture: row.prefecture ?? "",
    city: row.city ?? "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    radiusM: row.radius_m,
    polygon: row.polygon,
    areaHa: row.area_ha == null ? null : Number(row.area_ha),
    certificationId: row.certification_id ?? "",
    certifiedAt: row.certified_at,
    officialUrl: row.official_url ?? "",
    ownerUserId: row.owner_user_id,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateFieldInput {
  source?: FieldSource;
  name: string;
  nameKana?: string;
  summary?: string;
  prefecture?: string;
  city?: string;
  lat: number;
  lng: number;
  radiusM?: number;
  polygon?: Record<string, unknown> | null;
  areaHa?: number | null;
  certificationId?: string;
  certifiedAt?: string | null;
  officialUrl?: string;
  ownerUserId?: string | null;
  payload?: Record<string, unknown>;
}

export async function createField(input: CreateFieldInput): Promise<ObservationField> {
  const source = input.source ?? "user_defined";
  const bbox = bboxColumnsFromPolygon(input.polygon ?? null);
  const adminLevel = SOURCE_TO_ADMIN_LEVEL[source] ?? null;
  const result = await getPool().query<RawFieldRow>(
    `INSERT INTO observation_fields (
       source, name, name_kana, summary, prefecture, city,
       lat, lng, radius_m, polygon, area_ha,
       certification_id, certified_at, official_url, owner_user_id, payload,
       bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, admin_level
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10::jsonb, $11,
       $12, $13, $14, $15, $16::jsonb,
       $17, $18, $19, $20, $21
     )
     RETURNING ${SELECT}`,
    [
      source,
      input.name,
      input.nameKana ?? "",
      input.summary ?? "",
      input.prefecture ?? "",
      input.city ?? "",
      input.lat,
      input.lng,
      input.radiusM ?? 1000,
      input.polygon ? JSON.stringify(input.polygon) : null,
      input.areaHa ?? null,
      input.certificationId ?? "",
      input.certifiedAt ?? null,
      input.officialUrl ?? "",
      input.ownerUserId ?? null,
      JSON.stringify(input.payload ?? {}),
      bbox.minLat,
      bbox.maxLat,
      bbox.minLng,
      bbox.maxLng,
      adminLevel,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to create field");
  return mapRow(row);
}

export async function upsertCertifiedField(input: CreateFieldInput): Promise<ObservationField> {
  if (!input.certificationId) return createField(input);
  const source = input.source ?? "user_defined";
  const bbox = bboxColumnsFromPolygon(input.polygon ?? null);
  const adminLevel = SOURCE_TO_ADMIN_LEVEL[source] ?? null;
  const result = await getPool().query<RawFieldRow>(
    `INSERT INTO observation_fields (
       source, name, name_kana, summary, prefecture, city,
       lat, lng, radius_m, polygon, area_ha,
       certification_id, certified_at, official_url, owner_user_id, payload,
       bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, admin_level
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10::jsonb, $11,
       $12, $13, $14, $15, $16::jsonb,
       $17, $18, $19, $20, $21
     )
     ON CONFLICT (source, certification_id) WHERE certification_id <> ''
     DO UPDATE SET
       name         = EXCLUDED.name,
       name_kana    = EXCLUDED.name_kana,
       summary      = EXCLUDED.summary,
       prefecture   = EXCLUDED.prefecture,
       city         = EXCLUDED.city,
       lat          = EXCLUDED.lat,
       lng          = EXCLUDED.lng,
       radius_m     = EXCLUDED.radius_m,
       polygon      = COALESCE(EXCLUDED.polygon, observation_fields.polygon),
       area_ha      = COALESCE(EXCLUDED.area_ha, observation_fields.area_ha),
       certified_at = COALESCE(EXCLUDED.certified_at, observation_fields.certified_at),
       official_url = EXCLUDED.official_url,
       payload      = observation_fields.payload || EXCLUDED.payload,
       bbox_min_lat = COALESCE(EXCLUDED.bbox_min_lat, observation_fields.bbox_min_lat),
       bbox_max_lat = COALESCE(EXCLUDED.bbox_max_lat, observation_fields.bbox_max_lat),
       bbox_min_lng = COALESCE(EXCLUDED.bbox_min_lng, observation_fields.bbox_min_lng),
       bbox_max_lng = COALESCE(EXCLUDED.bbox_max_lng, observation_fields.bbox_max_lng),
       admin_level  = COALESCE(EXCLUDED.admin_level, observation_fields.admin_level),
       updated_at   = NOW()
     RETURNING ${SELECT}`,
    [
      source,
      input.name,
      input.nameKana ?? "",
      input.summary ?? "",
      input.prefecture ?? "",
      input.city ?? "",
      input.lat,
      input.lng,
      input.radiusM ?? 1000,
      input.polygon ? JSON.stringify(input.polygon) : null,
      input.areaHa ?? null,
      input.certificationId,
      input.certifiedAt ?? null,
      input.officialUrl ?? "",
      input.ownerUserId ?? null,
      JSON.stringify(input.payload ?? {}),
      bbox.minLat,
      bbox.maxLat,
      bbox.minLng,
      bbox.maxLng,
      adminLevel,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to upsert field");
  return mapRow(row);
}

export async function getField(fieldId: string): Promise<ObservationField | null> {
  const result = await getPool().query<RawFieldRow>(
    `SELECT ${SELECT} FROM observation_fields WHERE field_id = $1`,
    [fieldId],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export interface UpdateFieldInput {
  name?: string;
  nameKana?: string;
  summary?: string;
  prefecture?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
  polygon?: Record<string, unknown> | null;
  areaHa?: number | null;
  payload?: Record<string, unknown>;
}

export async function updateField(fieldId: string, input: UpdateFieldInput): Promise<ObservationField | null> {
  const sets: string[] = [];
  const values: unknown[] = [fieldId];
  let idx = 2;
  if (input.name !== undefined) { sets.push(`name = $${idx++}`); values.push(input.name); }
  if (input.nameKana !== undefined) { sets.push(`name_kana = $${idx++}`); values.push(input.nameKana); }
  if (input.summary !== undefined) { sets.push(`summary = $${idx++}`); values.push(input.summary); }
  if (input.prefecture !== undefined) { sets.push(`prefecture = $${idx++}`); values.push(input.prefecture); }
  if (input.city !== undefined) { sets.push(`city = $${idx++}`); values.push(input.city); }
  if (input.lat !== undefined) { sets.push(`lat = $${idx++}`); values.push(input.lat); }
  if (input.lng !== undefined) { sets.push(`lng = $${idx++}`); values.push(input.lng); }
  if (input.radiusM !== undefined) { sets.push(`radius_m = $${idx++}`); values.push(input.radiusM); }
  if (input.polygon !== undefined) {
    sets.push(`polygon = $${idx++}::jsonb`);
    values.push(input.polygon == null ? null : JSON.stringify(input.polygon));
    const bbox = bboxColumnsFromPolygon(input.polygon);
    sets.push(`bbox_min_lat = $${idx++}`); values.push(bbox.minLat);
    sets.push(`bbox_max_lat = $${idx++}`); values.push(bbox.maxLat);
    sets.push(`bbox_min_lng = $${idx++}`); values.push(bbox.minLng);
    sets.push(`bbox_max_lng = $${idx++}`); values.push(bbox.maxLng);
  }
  if (input.areaHa !== undefined) { sets.push(`area_ha = $${idx++}`); values.push(input.areaHa); }
  if (input.payload !== undefined) { sets.push(`payload = $${idx++}::jsonb`); values.push(JSON.stringify(input.payload)); }
  if (sets.length === 0) return getField(fieldId);
  sets.push("updated_at = NOW()");

  const result = await getPool().query<RawFieldRow>(
    `UPDATE observation_fields SET ${sets.join(", ")} WHERE field_id = $1 RETURNING ${SELECT}`,
    values,
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function listMyFields(userId: string, limit = 50): Promise<ObservationField[]> {
  const result = await getPool().query<RawFieldRow>(
    `SELECT ${SELECT} FROM observation_fields
     WHERE owner_user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, Math.min(Math.max(1, limit), 200)],
  );
  return result.rows.map(mapRow);
}

/**
 * 近隣検索: lat/lng box scan + Haversine 距離フィルタ。
 * GiST 不要。日本国内のスケールで 1ms 以内に収まる規模を想定。
 */
export async function listNearbyFields(
  lat: number,
  lng: number,
  km: number,
  options: { source?: FieldSource | null; limit?: number } = {},
): Promise<Array<ObservationField & { distanceKm: number }>> {
  const range = Math.max(0.5, Math.min(km, 200));
  const latDelta = range / 111;
  const lngDelta = range / (111 * Math.cos((lat * Math.PI) / 180));
  const limit = Math.min(Math.max(1, options.limit ?? 30), 100);
  const sourceClause = options.source ? "AND source = $7" : "";
  const limitPlaceholder = options.source ? "$8" : "$7";
  const params: unknown[] = options.source
    ? [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, lat, lng, options.source, limit]
    : [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, lat, lng, limit];

  const result = await getPool().query<RawFieldRow & { distance_km: string }>(
    `SELECT ${SELECT},
       (
         6371 * 2 * ASIN(SQRT(
           POWER(SIN(RADIANS(lat - ($5::float8)) / 2), 2) +
           COS(RADIANS($5::float8)) * COS(RADIANS(lat)) *
           POWER(SIN(RADIANS(lng - ($6::float8)) / 2), 2)
         ))
       )::text AS distance_km
     FROM observation_fields
     WHERE lat BETWEEN $1::float8 AND $2::float8
       AND lng BETWEEN $3::float8 AND $4::float8
       ${sourceClause}
     ORDER BY distance_km ASC
     LIMIT ${limitPlaceholder}`,
    params,
  );
  return result.rows
    .map((row) => ({ ...mapRow(row), distanceKm: Number(row.distance_km) }))
    .filter((f) => f.distanceKm <= range);
}

export async function searchFieldsByName(query: string, limit = 30): Promise<ObservationField[]> {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  const result = await getPool().query<RawFieldRow>(
    `SELECT ${SELECT} FROM observation_fields
     WHERE lower(name) LIKE '%' || $1 || '%'
        OR lower(name_kana) LIKE '%' || $1 || '%'
        OR lower(prefecture) LIKE '%' || $1 || '%'
        OR lower(city) LIKE '%' || $1 || '%'
     ORDER BY
       CASE WHEN lower(name) = $1 THEN 0
            WHEN lower(name) LIKE $1 || '%' THEN 1
            ELSE 2 END,
       updated_at DESC
     LIMIT $2`,
    [q, Math.min(Math.max(1, limit), 100)],
  );
  return result.rows.map(mapRow);
}

export async function listCertifiedFields(
  source: FieldSource,
  options: { prefecture?: string; limit?: number } = {},
): Promise<ObservationField[]> {
  const params: unknown[] = [source];
  let where = "source = $1";
  if (options.prefecture) {
    params.push(options.prefecture);
    where += ` AND prefecture = $${params.length}`;
  }
  params.push(Math.min(Math.max(1, options.limit ?? 100), 500));
  const result = await getPool().query<RawFieldRow>(
    `SELECT ${SELECT} FROM observation_fields
     WHERE ${where}
     ORDER BY prefecture, name
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(mapRow);
}

export interface FieldFilter {
  prefecture?: string;
  city?: string;
  source?: FieldSource | "any";
  query?: string;
  limit?: number;
  offset?: number;
}

export async function listFields(filter: FieldFilter = {}): Promise<ObservationField[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter.prefecture) {
    params.push(filter.prefecture);
    where.push(`prefecture = $${params.length}`);
  }
  if (filter.city) {
    params.push(filter.city);
    where.push(`city = $${params.length}`);
  }
  if (filter.source && filter.source !== "any") {
    params.push(filter.source);
    where.push(`source = $${params.length}`);
  }
  if (filter.query) {
    const q = filter.query.trim().toLowerCase();
    if (q) {
      params.push(q);
      const idx = params.length;
      where.push(`(
        lower(name) LIKE '%' || $${idx} || '%'
        OR lower(name_kana) LIKE '%' || $${idx} || '%'
        OR lower(prefecture) LIKE '%' || $${idx} || '%'
        OR lower(city) LIKE '%' || $${idx} || '%'
      )`);
    }
  }
  const limit = Math.min(Math.max(1, filter.limit ?? 60), 200);
  const offset = Math.max(0, filter.offset ?? 0);
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const result = await getPool().query<RawFieldRow>(
    `SELECT ${SELECT} FROM observation_fields
     ${whereClause}
     ORDER BY
       CASE WHEN source = 'user_defined' THEN 1 ELSE 0 END,
       prefecture, city, name
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );
  return result.rows.map(mapRow);
}

export interface PrefectureBucket {
  prefecture: string;
  total: number;
  natureSymbiosisSite: number;
  tsunag: number;
  userDefined: number;
}

export async function listPrefectureBuckets(): Promise<PrefectureBucket[]> {
  const result = await getPool().query<{
    prefecture: string;
    total: string;
    nss: string;
    tsu: string;
    ud: string;
  }>(
    `SELECT
       prefecture,
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE source = 'nature_symbiosis_site')::text AS nss,
       COUNT(*) FILTER (WHERE source = 'tsunag')::text AS tsu,
       COUNT(*) FILTER (WHERE source = 'user_defined')::text AS ud
     FROM observation_fields
     WHERE prefecture <> ''
     GROUP BY prefecture
     ORDER BY COUNT(*) DESC, prefecture`,
  );
  return result.rows.map((r) => ({
    prefecture: r.prefecture,
    total: Number(r.total),
    natureSymbiosisSite: Number(r.nss),
    tsunag: Number(r.tsu),
    userDefined: Number(r.ud),
  }));
}

export interface FieldStats {
  fieldId: string;
  totalSessions: number;
  liveSessions: number;
  totalObservations: number;
  uniqueSpeciesCount: number;
  totalAbsences: number;
  totalParticipants: number;
  topTaxa: Array<{ name: string; count: number }>;
  recentSessions: Array<{
    sessionId: string;
    title: string;
    eventCode: string | null;
    startedAt: string;
    endedAt: string | null;
  }>;
}

export async function getFieldStats(fieldId: string): Promise<FieldStats | null> {
  const pool = getPool();
  const fieldExists = await pool.query<{ field_id: string }>(
    `SELECT field_id FROM observation_fields WHERE field_id = $1`,
    [fieldId],
  );
  if (fieldExists.rows.length === 0) return null;

  const [sessionsRow, recentRow, obsRow, absenceRow, taxaRow, participantsRow] = await Promise.all([
    pool.query<{ total: string; live: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE ended_at IS NULL)::text AS live
       FROM observation_event_sessions
       WHERE field_id = $1`,
      [fieldId],
    ),
    pool.query<{
      session_id: string;
      title: string;
      event_code: string | null;
      started_at: string;
      ended_at: string | null;
    }>(
      `SELECT session_id, title, event_code,
              started_at::text AS started_at,
              ended_at::text AS ended_at
       FROM observation_event_sessions
       WHERE field_id = $1
       ORDER BY started_at DESC
       LIMIT 12`,
      [fieldId],
    ),
    pool.query<{ obs_count: string; species_count: string }>(
      `WITH live AS (
         SELECT e.payload
         FROM observation_event_live_events e
         JOIN observation_event_sessions s ON s.session_id = e.session_id
         WHERE s.field_id = $1 AND e.type = 'observation_added'
       )
       SELECT COUNT(*)::text AS obs_count,
              COUNT(DISTINCT (payload->>'taxon_name'))::text AS species_count
       FROM live
       WHERE payload->>'taxon_name' IS NOT NULL`,
      [fieldId],
    ),
    pool.query<{ absence_count: string }>(
      `SELECT COUNT(*)::text AS absence_count
       FROM observation_event_absences a
       JOIN observation_event_sessions s ON s.session_id = a.session_id
       WHERE s.field_id = $1`,
      [fieldId],
    ),
    pool.query<{ taxon_name: string; cnt: string }>(
      `SELECT e.payload->>'taxon_name' AS taxon_name, COUNT(*)::text AS cnt
       FROM observation_event_live_events e
       JOIN observation_event_sessions s ON s.session_id = e.session_id
       WHERE s.field_id = $1
         AND e.type = 'observation_added'
         AND e.payload->>'taxon_name' IS NOT NULL
       GROUP BY e.payload->>'taxon_name'
       ORDER BY COUNT(*) DESC
       LIMIT 8`,
      [fieldId],
    ),
    pool.query<{ participants: string }>(
      `SELECT COUNT(*)::text AS participants
       FROM observation_event_participants p
       JOIN observation_event_sessions s ON s.session_id = p.session_id
       WHERE s.field_id = $1`,
      [fieldId],
    ),
  ]);

  return {
    fieldId,
    totalSessions: Number(sessionsRow.rows[0]?.total ?? 0),
    liveSessions: Number(sessionsRow.rows[0]?.live ?? 0),
    totalObservations: Number(obsRow.rows[0]?.obs_count ?? 0),
    uniqueSpeciesCount: Number(obsRow.rows[0]?.species_count ?? 0),
    totalAbsences: Number(absenceRow.rows[0]?.absence_count ?? 0),
    totalParticipants: Number(participantsRow.rows[0]?.participants ?? 0),
    topTaxa: taxaRow.rows.map((r) => ({ name: r.taxon_name, count: Number(r.cnt) })),
    recentSessions: recentRow.rows.map((r) => ({
      sessionId: r.session_id,
      title: r.title,
      eventCode: r.event_code,
      startedAt: r.started_at,
      endedAt: r.ended_at,
    })),
  };
}
