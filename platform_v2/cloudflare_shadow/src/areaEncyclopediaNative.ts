import {
  distanceToPlaceBoundaryMeters,
  pointInPlaceGeometry,
  type PlaceGeometry,
} from "../../src/services/placeDomain";

export const RYUYO_FIELD_ID = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
export const RYUYO_NEARBY_METERS = 300;

export type AreaRecordClass = "core" | "nearby" | "outside";

export interface AreaRecordCandidate {
  visitId: string;
  observedAt: string | null;
  displayName: string | null;
  lat: number;
  lng: number;
}

export interface AreaRecordContext {
  core: AreaRecordCandidate[];
  nearby: AreaRecordCandidate[];
}

/**
 * Classifies a read-time candidate without changing canonical field membership.
 * Nearby context is deliberately enabled only for the adopted Ryuyo fixture.
 */
export function classifyAreaRecord(
  fieldId: string,
  geometry: PlaceGeometry,
  point: { lat: number; lng: number },
): AreaRecordClass {
  if (pointInPlaceGeometry(point, geometry)) return "core";
  if (fieldId !== RYUYO_FIELD_ID) return "outside";
  const distance = distanceToPlaceBoundaryMeters(point, geometry);
  return Number.isFinite(distance) && distance > 0 && distance <= RYUYO_NEARBY_METERS
    ? "nearby"
    : "outside";
}

export function classifyAreaRecordCandidates(
  fieldId: string,
  geometry: PlaceGeometry,
  candidates: AreaRecordCandidate[],
): AreaRecordContext {
  const context: AreaRecordContext = { core: [], nearby: [] };
  for (const candidate of candidates) {
    const classification = classifyAreaRecord(fieldId, geometry, candidate);
    if (classification !== "outside") context[classification].push(candidate);
  }
  context.core.sort(newestFirst);
  context.nearby.sort(newestFirst);
  return context;
}

function newestFirst(a: AreaRecordCandidate, b: AreaRecordCandidate): number {
  return String(b.observedAt ?? "").localeCompare(String(a.observedAt ?? ""));
}
