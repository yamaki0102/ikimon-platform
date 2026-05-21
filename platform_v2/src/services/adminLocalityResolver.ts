import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

export type AdminLocality = {
  fieldId: string;
  prefecture: string | null;
  municipality: string | null;
  name: string | null;
};

type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};

type AdminLocalityRow = {
  field_id: string;
  name: string | null;
  prefecture: string | null;
  city: string | null;
  polygon: Record<string, unknown> | null;
  area_ha: string | number | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

function areaValue(value: string | number | null): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

export function chooseAdminLocalityForPoint(
  lat: number,
  lng: number,
  rows: AdminLocalityRow[],
): AdminLocality | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const matches = rows
    .filter((row) => row.polygon && pointInGeoJsonPolygon(lng, lat, row.polygon))
    .sort((left, right) => areaValue(left.area_ha) - areaValue(right.area_ha));
  const row = matches[0];
  if (!row) return null;
  return {
    fieldId: row.field_id,
    prefecture: clean(row.prefecture),
    municipality: clean(row.city) ?? clean(row.name),
    name: clean(row.name),
  };
}

export async function resolveAdminLocalityForPoint(
  queryable: Queryable,
  lat: number | null | undefined,
  lng: number | null | undefined,
  options: { maxCandidates?: number } = {},
): Promise<AdminLocality | null> {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const limit = Math.max(20, Math.min(500, options.maxCandidates ?? 120));
  const result = await queryable.query<AdminLocalityRow>(
    `select field_id::text as field_id,
            name,
            prefecture,
            city,
            polygon,
            area_ha::text as area_ha
       from observation_fields
      where polygon is not null
        and valid_to is null
        and coalesce(admin_level, source) = 'admin_municipality'
        and bbox_min_lat is not null
        and bbox_min_lat <= $1
        and bbox_max_lat >= $1
        and bbox_min_lng <= $2
        and bbox_max_lng >= $2
      order by area_ha nulls last
      limit $3`,
    [lat, lng, limit],
  );
  return chooseAdminLocalityForPoint(lat, lng, result.rows);
}
