import { getPool } from "../db.js";
import type { ObservationField } from "./observationFieldRegistry.js";
import { computeBbox } from "./geoJsonBbox.js";
import { haversineMeters } from "./observationEventAreaGeometry.js";
import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

type CandidateVisitRow = {
  visit_id: string;
  point_latitude: string | number | null;
  point_longitude: string | number | null;
  source_field_id: string | null;
  resolved_match: boolean | null;
};

function radiusBbox(field: Pick<ObservationField, "lat" | "lng" | "radiusM">): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const radius = Math.max(50, Math.min(field.radiusM || 1000, 200000));
  const latPad = radius / 111_000;
  const lngPad = radius / (111_000 * Math.max(0.05, Math.cos((field.lat * Math.PI) / 180)));
  return {
    minLat: field.lat - latPad,
    maxLat: field.lat + latPad,
    minLng: field.lng - lngPad,
    maxLng: field.lng + lngPad,
  };
}

function fieldSearchBbox(field: ObservationField): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const polygonBbox = computeBbox(field.polygon);
  return polygonBbox ?? radiusBbox(field);
}

export function visitMatchesAreaScope(
  field: Pick<ObservationField, "fieldId" | "lat" | "lng" | "radiusM" | "polygon">,
  visit: Pick<CandidateVisitRow, "point_latitude" | "point_longitude" | "source_field_id" | "resolved_match">,
): boolean {
  const lat = Number(visit.point_latitude);
  const lng = Number(visit.point_longitude);
  const hasPoint = visit.point_latitude != null &&
    visit.point_longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  if (hasPoint) {
    if (field.polygon) return pointInGeoJsonPolygon(lng, lat, field.polygon);
    const radius = Math.max(50, Math.min(field.radiusM || 1000, 200000));
    return haversineMeters(field.lat, field.lng, lat, lng) <= radius;
  }

  if (visit.resolved_match) return true;
  return visit.source_field_id === field.fieldId;
}

export async function loadAreaSnapshotVisitIds(
  field: ObservationField,
  placeId: string | null,
): Promise<string[]> {
  const bbox = fieldSearchBbox(field);
  const pool = getPool();
  const result = await pool.query<CandidateVisitRow>(
    `select v.visit_id,
            v.point_latitude::text as point_latitude,
            v.point_longitude::text as point_longitude,
            v.source_payload->>'field_id' as source_field_id,
            $1::uuid = any(coalesce(v.resolved_field_ids, array[]::uuid[])) as resolved_match
       from visits v
      where v.source_payload->>'field_id' = $1::text
         or ($2::text is not null and v.place_id = $2)
         or $1::uuid = any(coalesce(v.resolved_field_ids, array[]::uuid[]))
         or (
              v.point_latitude between $3 and $4
          and v.point_longitude between $5 and $6
         )`,
    [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
  );
  return result.rows
    .filter((row) => visitMatchesAreaScope(field, row))
    .map((row) => row.visit_id);
}

export const __test__ = {
  fieldSearchBbox,
  radiusBbox,
  visitMatchesAreaScope,
};
