import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

export type AdminLocality = {
  fieldId: string;
  prefecture: string | null;
  municipality: string | null;
  name: string | null;
  validFrom: string | null;
  validTo: string | null;
  entityKey: string | null;
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
  valid_from?: string | null;
  valid_to?: string | null;
  entity_key?: string | null;
};

type ResolveAdminLocalityOptions = {
  maxCandidates?: number;
  observedAt?: string | Date | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

function areaValue(value: string | number | null): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function dateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function activeOnDate(row: AdminLocalityRow, effectiveDate: string | null): boolean {
  if (!effectiveDate) return clean(row.valid_to) === null;
  const from = dateKey(row.valid_from ?? null);
  const to = dateKey(row.valid_to ?? null);
  return (!from || from <= effectiveDate) && (!to || to >= effectiveDate);
}

function adminLocalityQuery(validityClause: string, limitParamIndex: number): string {
  return `select field_id::text as field_id,
            name,
            prefecture,
            city,
            polygon,
            area_ha::text as area_ha,
            valid_from::text as valid_from,
            valid_to::text as valid_to,
            entity_key
       from observation_fields
      where polygon is not null
        ${validityClause}
        and coalesce(admin_level, source) = 'admin_municipality'
        and bbox_min_lat is not null
        and bbox_min_lat <= $1
        and bbox_max_lat >= $1
        and bbox_min_lng <= $2
        and bbox_max_lng >= $2
      order by area_ha nulls last, valid_from desc nulls last
      limit $${limitParamIndex}`;
}

export function chooseAdminLocalityForPoint(
  lat: number,
  lng: number,
  rows: AdminLocalityRow[],
  options: { observedAt?: string | Date | null } = {},
): AdminLocality | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const effectiveDate = dateKey(options.observedAt);
  const containing = rows
    .filter((row) => row.polygon && pointInGeoJsonPolygon(lng, lat, row.polygon));
  const active = containing.filter((row) => activeOnDate(row, effectiveDate));
  const matches = (active.length > 0 ? active : containing)
    .sort((left, right) => areaValue(left.area_ha) - areaValue(right.area_ha));
  const row = matches[0];
  if (!row) return null;
  return {
    fieldId: row.field_id,
    prefecture: clean(row.prefecture),
    municipality: clean(row.city) ?? clean(row.name),
    name: clean(row.name),
    validFrom: dateKey(row.valid_from ?? null),
    validTo: dateKey(row.valid_to ?? null),
    entityKey: clean(row.entity_key),
  };
}

export async function resolveAdminLocalityForPoint(
  queryable: Queryable,
  lat: number | null | undefined,
  lng: number | null | undefined,
  options: ResolveAdminLocalityOptions = {},
): Promise<AdminLocality | null> {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const limit = Math.max(20, Math.min(500, options.maxCandidates ?? 120));
  const effectiveDate = dateKey(options.observedAt);
  const params: unknown[] = [lat, lng];
  const validityClause = effectiveDate
    ? (
        params.push(effectiveDate),
        `and (valid_from is null or valid_from <= $${params.length}::date)
         and (valid_to is null or valid_to >= $${params.length}::date)`
      )
    : "and valid_to is null";
  params.push(limit);
  const result = await queryable.query<AdminLocalityRow>(
    adminLocalityQuery(validityClause, params.length),
    params,
  );
  const historicalMatch = chooseAdminLocalityForPoint(lat, lng, result.rows, { observedAt: effectiveDate });
  if (historicalMatch || !effectiveDate) return historicalMatch;

  const fallbackParams: unknown[] = [lat, lng, limit];
  const fallback = await queryable.query<AdminLocalityRow>(
    adminLocalityQuery("and valid_to is null", fallbackParams.length),
    fallbackParams,
  );
  return chooseAdminLocalityForPoint(lat, lng, fallback.rows);
}
