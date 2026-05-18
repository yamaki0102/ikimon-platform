import type { Pool, PoolClient } from "pg";
import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

export type HamamatsuWardField = {
  fieldId: string;
  city: string | null;
  name: string | null;
  polygon: Record<string, unknown> | null;
  label: string;
};

type Queryable = Pick<Pool | PoolClient, "query">;

const HAMAMATSU_BBOX = {
  minLat: 34.55,
  maxLat: 35.32,
  minLng: 137.45,
  maxLng: 138.08,
};

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function labelKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―ー−]/g, "-")
    .replace(/\s+/g, " ");
}

export function isCoarseHamamatsuLabel(value: string | null | undefined): boolean {
  const raw = text(value);
  const key = labelKey(raw);
  return raw === ""
    || raw === "浜松"
    || raw === "浜松市"
    || key === "hamamatsu"
    || key === "hamamatsu city"
    || key === "hamamatsu-shi"
    || key === "hamamatsu / shizuoka";
}

function inHamamatsuBbox(lat: number, lng: number): boolean {
  return lat >= HAMAMATSU_BBOX.minLat
    && lat <= HAMAMATSU_BBOX.maxLat
    && lng >= HAMAMATSU_BBOX.minLng
    && lng <= HAMAMATSU_BBOX.maxLng;
}

export function wardLabelFromField(row: Pick<HamamatsuWardField, "city" | "name">): string | null {
  const city = text(row.city);
  const name = text(row.name);
  const fromCity = city.startsWith("浜松市") && city.endsWith("区")
    ? city
    : city.endsWith("区")
      ? `浜松市${city}`
      : "";
  if (fromCity) return fromCity;
  const match = name.match(/浜松市[^\s/]+区/);
  return match?.[0] ?? null;
}

export function resolveHamamatsuWardLabel(
  input: {
    municipality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  wardFields: HamamatsuWardField[],
): string | null {
  const current = text(input.municipality);
  if (!isCoarseHamamatsuLabel(current)) return current || null;
  const lat = typeof input.latitude === "number" && Number.isFinite(input.latitude) ? input.latitude : null;
  const lng = typeof input.longitude === "number" && Number.isFinite(input.longitude) ? input.longitude : null;
  if (lat === null || lng === null || !inHamamatsuBbox(lat, lng)) return current || null;

  for (const field of wardFields) {
    if (field.polygon && pointInGeoJsonPolygon(lng, lat, field.polygon)) {
      return field.label;
    }
  }
  return current || null;
}

export async function loadHamamatsuWardFields(queryable: Queryable): Promise<HamamatsuWardField[]> {
  const result = await queryable.query<{
    field_id: string;
    city: string | null;
    name: string | null;
    polygon: Record<string, unknown> | null;
  }>(
    `SELECT field_id::text, city, name, polygon
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND valid_to IS NULL
        AND coalesce(admin_level, source) = 'admin_municipality'
        AND prefecture = '静岡県'
        AND bbox_min_lat <= $1
        AND bbox_max_lat >= $2
        AND bbox_min_lng <= $3
        AND bbox_max_lng >= $4
        AND (city LIKE '%区' OR name LIKE '%区%')
      ORDER BY coalesce(area_ha, 999999999) ASC, city ASC, name ASC`,
    [HAMAMATSU_BBOX.maxLat, HAMAMATSU_BBOX.minLat, HAMAMATSU_BBOX.maxLng, HAMAMATSU_BBOX.minLng],
  );

  return result.rows
    .map((row) => ({ fieldId: row.field_id, city: row.city, name: row.name, polygon: row.polygon, label: wardLabelFromField(row) }))
    .filter((row): row is HamamatsuWardField => Boolean(row.label));
}
