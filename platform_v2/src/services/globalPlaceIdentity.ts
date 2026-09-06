import {
  bboxForPlaceGeometry,
  bboxOverlapScore,
  normalizePlaceSearchText,
  pointInPlaceGeometry,
  type PlaceGeometry,
  type PlaceKind,
} from "./placeDomain.js";

export const PLACE_IDENTITY_CONTRACT_VERSION = "place_identity_contract/source-0" as const;

export type TemporalInterval = { start: string | null; end: string | null };
export type AssertionTime = { validTime: TemporalInterval; recordedTime: TemporalInterval; observedTime?: string | null };
export type AssertionStatus = "asserted" | "candidate" | "disputed" | "retracted";
export type EvidenceRef = { sourceType: string; sourceId: string; sourceUrl?: string | null; confidence: number; note?: string };
export type PlaceIdentityOrigin = "initial" | "rename" | "boundary_change" | "new_merger" | "absorption" | "split";

/** Mutable labels, geometry and external ids are assertions, never identity. */
export type PlaceIdentity = { canonicalPlaceId: string; placeKind: PlaceKind; origin: PlaceIdentityOrigin; note?: string };
export type PlaceNameType = "canonical" | "official" | "common" | "old_name" | "local" | "exonym" | "transliteration";
export type PlaceNameAssertion = { placeId: string; name: string; nameType: PlaceNameType; language?: string | null; script?: string | null; time: AssertionTime; evidence: EvidenceRef[]; status: AssertionStatus };
export type PlaceGeometryPrecision = "exact" | "approximate" | "public_cell" | "suppressed";
export type PlaceGeometryVisibility = "private" | "public";
export type PlaceGeometryAssertion = { placeId: string; geometry: PlaceGeometry | null; precision: PlaceGeometryPrecision; visibility: PlaceGeometryVisibility; time: AssertionTime; evidence: EvidenceRef[]; status: AssertionStatus };
export type PlaceExternalIdentifier = { placeId: string; scheme: string; value: string; time: AssertionTime; evidence: EvidenceRef[]; status: AssertionStatus };
export type PlaceRelationType = "part_of" | "contains" | "overlaps" | "predecessor_of" | "successor_of" | "split_into" | "merged_from" | "same_as_candidate" | "moved_to" | "located_on";
export type PlaceRelation = { fromPlaceId: string; toPlaceId: string; relationType: PlaceRelationType; time: AssertionTime; evidence: EvidenceRef[]; status: AssertionStatus };
export type PlaceViewDefinition = { viewId: string; scope: { placeIds?: string[]; query?: string }; targetInterval: TemporalInterval; theme?: string | null; program?: string | null; publicationPolicy: "public" | "restricted" | "private"; operator: string; provenance: EvidenceRef[] };
export type PlaceRecordBinding = { recordId: string; placeId: string; observedTime: string | null; membershipRole: "primary" | "secondary" };

function epoch(value: string | null): number | null { if (value === null) return null; const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed; }
export function isWithinInterval(interval: TemporalInterval, at: string): boolean {
  const point = Date.parse(at); if (Number.isNaN(point)) return false;
  const start = epoch(interval.start); const end = epoch(interval.end);
  return (start === null || point >= start) && (end === null || point < end);
}
function live<T extends { time: AssertionTime; status: AssertionStatus }>(items: T[], at: string): T[] {
  return items.filter((item) => item.status === "asserted" && isWithinInterval(item.time.validTime, at));
}
function newest<T extends { time: AssertionTime }>(items: T[]): T | null {
  return [...items].sort((a, b) => (epoch(b.time.validTime.start) ?? 0) - (epoch(a.time.validTime.start) ?? 0))[0] ?? null;
}

export function resolveCanonicalPlaceId(identity: PlaceIdentity): string { return identity.canonicalPlaceId; }
export function resolveExternalIdentifiersAt(identity: PlaceIdentity, ids: PlaceExternalIdentifier[], at: string) {
  return { canonicalPlaceId: identity.canonicalPlaceId, identifiers: live(ids.filter((id) => id.placeId === identity.canonicalPlaceId), at) };
}
export function canonicalNameAt(names: PlaceNameAssertion[], placeId: string, at: string): string | null {
  return newest(live(names.filter((name) => name.placeId === placeId && name.nameType === "canonical"), at))?.name ?? null;
}
export function collectPlaceNameVariants(names: PlaceNameAssertion[], placeId: string, at?: string): PlaceNameAssertion[] {
  return names.filter((name) => name.placeId === placeId && name.status !== "retracted" && (at === undefined || isWithinInterval(name.time.validTime, at)));
}
export function geometryAssertionAt(geometries: PlaceGeometryAssertion[], placeId: string, at: string): PlaceGeometryAssertion | null {
  return newest(live(geometries.filter((geometry) => geometry.placeId === placeId), at));
}
export type PublicGeometryProjection = { placeId: string; geometry: PlaceGeometry | null; precision: "approximate" | "public_cell" };
export function projectPublicGeometry(assertion: PlaceGeometryAssertion | null): PublicGeometryProjection | null {
  if (!assertion || assertion.visibility !== "public" || assertion.precision === "exact" || assertion.precision === "suppressed") return null;
  return { placeId: assertion.placeId, geometry: assertion.geometry, precision: assertion.precision };
}
export function shouldTreatAsSamePlace(left: { identity: PlaceIdentity; name: string; geometry: PlaceGeometry | null }, right: { identity: PlaceIdentity; name: string; geometry: PlaceGeometry | null }) {
  if (left.identity.canonicalPlaceId === right.identity.canonicalPlaceId) return { samePlace: true, candidateRelation: false, reason: "same_canonical_id" };
  const sameName = normalizePlaceSearchText(left.name) !== "" && normalizePlaceSearchText(left.name) === normalizePlaceSearchText(right.name);
  const overlap = bboxOverlapScore(bboxForPlaceGeometry(left.geometry), bboxForPlaceGeometry(right.geometry));
  return sameName && overlap >= 0.6
    ? { samePlace: false, candidateRelation: true, reason: "name_and_footprint_overlap_needs_human_review" }
    : { samePlace: false, candidateRelation: false, reason: "distinct_places" };
}

export type ContinuityChange = { type: "rename" } | { type: "boundary_change"; legalEntityContinues: boolean } | { type: "new_merger"; newPlaceId: string } | { type: "absorption"; survivingPlaceId: string } | { type: "split"; successorPlaceIds: string[] };
export type ContinuityDecision = { canonicalPlaceIds: string[]; retainedPredecessorIds: string[]; relations: PlaceRelation[]; reason: string };
function relation(fromPlaceId: string, toPlaceId: string, relationType: PlaceRelationType, time: AssertionTime, evidence: EvidenceRef[]): PlaceRelation { return { fromPlaceId, toPlaceId, relationType, time, evidence, status: "asserted" }; }
export function decideIdentityContinuity(input: { predecessors: PlaceIdentity[]; change: ContinuityChange; time: AssertionTime; evidence: EvidenceRef[] }): ContinuityDecision {
  const ids = input.predecessors.map((place) => place.canonicalPlaceId); const { change, time, evidence } = input;
  if (change.type === "rename") return { canonicalPlaceIds: ids, retainedPredecessorIds: [], relations: [], reason: "rename_keeps_identity_add_new_name_assertion" };
  if (change.type === "boundary_change") return { canonicalPlaceIds: ids, retainedPredecessorIds: [], relations: [], reason: change.legalEntityContinues ? "same_legal_entity_keeps_identity_add_new_geometry_assertion" : "boundary_change_without_legal_continuity_is_unresolved_hold_as_candidate" };
  if (change.type === "new_merger") return { canonicalPlaceIds: [change.newPlaceId], retainedPredecessorIds: ids, relations: ids.flatMap((id) => [relation(id, change.newPlaceId, "predecessor_of", time, evidence), relation(change.newPlaceId, id, "successor_of", time, evidence)]), reason: "new_merger_creates_new_identity_and_retains_predecessors" };
  if (change.type === "absorption") { const absorbed = ids.filter((id) => id !== change.survivingPlaceId); return { canonicalPlaceIds: [change.survivingPlaceId], retainedPredecessorIds: absorbed, relations: absorbed.flatMap((id) => [relation(id, change.survivingPlaceId, "predecessor_of", time, evidence), relation(change.survivingPlaceId, id, "successor_of", time, evidence)]), reason: "absorption_keeps_surviving_legal_entity_identity_with_evidence" }; }
  return { canonicalPlaceIds: change.successorPlaceIds, retainedPredecessorIds: ids, relations: change.successorPlaceIds.flatMap((successor) => ids.flatMap((id) => [relation(id, successor, "split_into", time, evidence), relation(successor, id, "predecessor_of", time, evidence)])), reason: "split_creates_successor_identities_and_retains_predecessor" };
}
export function overlappingMembershipsAt(relations: PlaceRelation[], placeId: string, at: string): PlaceRelation[] { return live(relations.filter((r) => r.fromPlaceId === placeId && (r.relationType === "part_of" || r.relationType === "overlaps")), at); }
export function coexistingGeometryAssertionsAt(geometries: PlaceGeometryAssertion[], placeId: string, at: string): PlaceGeometryAssertion[] { return live(geometries.filter((g) => g.placeId === placeId), at); }
export function isWellFormedNaturalPlace(input: { identity: PlaceIdentity; names: PlaceNameAssertion[]; geometry: PlaceGeometryAssertion | null }): boolean { return input.names.some((name) => name.placeId === input.identity.canonicalPlaceId && name.name.trim() !== "") && Boolean(input.geometry?.placeId === input.identity.canonicalPlaceId && input.geometry.geometry); }
export function siteForStructureAt(relations: PlaceRelation[], structurePlaceId: string, at: string): string | null { return newest(live(relations.filter((r) => r.fromPlaceId === structurePlaceId && r.relationType === "located_on"), at))?.toPlaceId ?? null; }
export function recordBindingMatchesView(binding: PlaceRecordBinding, view: PlaceViewDefinition): boolean { return (view.scope.placeIds ?? []).includes(binding.placeId) && (binding.observedTime === null || isWithinInterval(view.targetInterval, binding.observedTime)); }
export function viewsReadingBinding(binding: PlaceRecordBinding, views: PlaceViewDefinition[]): PlaceViewDefinition[] { return views.filter((view) => recordBindingMatchesView(binding, view)); }
export function pointMatchesPlaceGeometry(point: { lat: number; lng: number }, assertion: PlaceGeometryAssertion | null): boolean { return Boolean(assertion?.geometry && pointInPlaceGeometry(point, assertion.geometry)); }
