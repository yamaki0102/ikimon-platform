import { getPool } from "../db.js";

export type FieldSource =
  | "user_defined"
  | "nature_symbiosis_site"
  | "tsunag"
  | "protected_area"
  | "oecm";

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
  const result = await getPool().query<RawFieldRow>(
    `INSERT INTO observation_fields (
       source, name, name_kana, summary, prefecture, city,
       lat, lng, radius_m, polygon, area_ha,
       certification_id, certified_at, official_url, owner_user_id, payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10::jsonb, $11,
       $12, $13, $14, $15, $16::jsonb
     )
     RETURNING ${SELECT}`,
    [
      input.source ?? "user_defined",
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
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to create field");
  return mapRow(row);
}

export async function upsertCertifiedField(input: CreateFieldInput): Promise<ObservationField> {
  if (!input.certificationId) return createField(input);
  const result = await getPool().query<RawFieldRow>(
    `INSERT INTO observation_fields (
       source, name, name_kana, summary, prefecture, city,
       lat, lng, radius_m, polygon, area_ha,
       certification_id, certified_at, official_url, owner_user_id, payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10::jsonb, $11,
       $12, $13, $14, $15, $16::jsonb
     )
     ON CONFLICT (source, certification_id) WHERE certification_id <> ''
     DO UPDATE SET
       name        = EXCLUDED.name,
       name_kana   = EXCLUDED.name_kana,
       summary     = EXCLUDED.summary,
       prefecture  = EXCLUDED.prefecture,
       city        = EXCLUDED.city,
       lat         = EXCLUDED.lat,
       lng         = EXCLUDED.lng,
       radius_m    = EXCLUDED.radius_m,
       polygon     = COALESCE(EXCLUDED.polygon, observation_fields.polygon),
       area_ha     = COALESCE(EXCLUDED.area_ha, observation_fields.area_ha),
       certified_at = COALESCE(EXCLUDED.certified_at, observation_fields.certified_at),
       official_url = EXCLUDED.official_url,
       payload     = observation_fields.payload || EXCLUDED.payload,
       updated_at  = NOW()
     RETURNING ${SELECT}`,
    [
      input.source ?? "user_defined",
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
