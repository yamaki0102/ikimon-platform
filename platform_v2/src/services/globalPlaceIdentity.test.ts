import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceGeometry } from "./placeDomain.js";
import {
  canonicalNameAt, coexistingGeometryAssertionsAt, collectPlaceNameVariants,
  decideIdentityContinuity, geometryAssertionAt, isWellFormedNaturalPlace,
  overlappingMembershipsAt, pointMatchesPlaceGeometry, projectPublicGeometry,
  recordBindingMatchesView, resolveExternalIdentifiersAt, shouldTreatAsSamePlace,
  siteForStructureAt, viewsReadingBinding,
  type AssertionTime, type EvidenceRef, type PlaceExternalIdentifier,
  type PlaceGeometryAssertion, type PlaceIdentity, type PlaceNameAssertion,
  type PlaceRecordBinding, type PlaceRelation, type PlaceViewDefinition,
} from "./globalPlaceIdentity.js";

const evidence: EvidenceRef[] = [{ sourceType: "gazette", sourceId: "fixture", confidence: 0.95 }];
const time = (start: string | null, end: string | null): AssertionTime => ({
  validTime: { start, end }, recordedTime: { start: "2026-01-01", end: null },
});
const identity = (canonicalPlaceId: string, placeKind: PlaceIdentity["placeKind"] = "administrative_area"): PlaceIdentity => ({ canonicalPlaceId, placeKind, origin: "initial" });
function square(lng: number, lat: number, size = 0.01): PlaceGeometry {
  return { type: "Polygon", coordinates: [[[lng, lat], [lng + size, lat], [lng + size, lat + size], [lng, lat + size], [lng, lat]]] };
}
function name(placeId: string, value: string, nameType: PlaceNameAssertion["nameType"], start: string | null = null, end: string | null = null): PlaceNameAssertion {
  return { placeId, name: value, nameType, language: "ja", time: time(start, end), evidence, status: "asserted" };
}
function geometry(placeId: string, value: PlaceGeometry, precision: PlaceGeometryAssertion["precision"] = "exact", visibility: PlaceGeometryAssertion["visibility"] = "public", start: string | null = null, end: string | null = null): PlaceGeometryAssertion {
  return { placeId, geometry: value, precision, visibility, time: time(start, end), evidence, status: "asserted" };
}
function relation(fromPlaceId: string, toPlaceId: string, relationType: PlaceRelation["relationType"], start: string | null = null, end: string | null = null): PlaceRelation {
  return { fromPlaceId, toPlaceId, relationType, time: time(start, end), evidence, status: "asserted" };
}

test("fixture 1: rename retains the canonical identity", () => {
  const placeId = "place-rename";
  const result = decideIdentityContinuity({ predecessors: [identity(placeId)], change: { type: "rename" }, time: time("2005-04-01", null), evidence });
  assert.deepEqual(result.canonicalPlaceIds, [placeId]);
  assert.equal(canonicalNameAt([name(placeId, "旧市名", "canonical", null, "2005-04-01"), name(placeId, "新市名", "canonical", "2005-04-01")], placeId, "2010-01-01"), "新市名");
});

test("fixture 2: continuous boundary change uses time-bounded geometry", () => {
  const placeId = "place-boundary";
  const oldGeometry = geometry(placeId, square(137, 34), "exact", "public", null, "2010-01-01");
  const newGeometry = geometry(placeId, square(137, 34, 0.02), "exact", "public", "2010-01-01");
  const result = decideIdentityContinuity({ predecessors: [identity(placeId)], change: { type: "boundary_change", legalEntityContinues: true }, time: time("2010-01-01", null), evidence });
  assert.deepEqual(result.canonicalPlaceIds, [placeId]);
  assert.equal(geometryAssertionAt([oldGeometry, newGeometry], placeId, "2000-01-01"), oldGeometry);
  assert.equal(geometryAssertionAt([oldGeometry, newGeometry], placeId, "2020-01-01"), newGeometry);
});

test("fixture 3: a new merger retains predecessors and creates a new identity", () => {
  const result = decideIdentityContinuity({ predecessors: [identity("merge-a"), identity("merge-b")], change: { type: "new_merger", newPlaceId: "merge-new" }, time: time("2005-04-01", null), evidence });
  assert.deepEqual(result.canonicalPlaceIds, ["merge-new"]);
  assert.deepEqual(result.retainedPredecessorIds.sort(), ["merge-a", "merge-b"]);
  assert.equal(result.relations.filter((r) => r.relationType === "predecessor_of").length, 2);
});

test("fixture 4: absorption identifies the surviving legal entity", () => {
  const result = decideIdentityContinuity({ predecessors: [identity("survivor"), identity("absorbed")], change: { type: "absorption", survivingPlaceId: "survivor" }, time: time("2006-03-31", null), evidence });
  assert.deepEqual(result.canonicalPlaceIds, ["survivor"]);
  assert.deepEqual(result.retainedPredecessorIds, ["absorbed"]);
  assert.ok(result.relations.some((r) => r.fromPlaceId === "absorbed" && r.toPlaceId === "survivor"));
});

test("fixture 5: split retains the predecessor and records all successors", () => {
  const result = decideIdentityContinuity({ predecessors: [identity("split-old")], change: { type: "split", successorPlaceIds: ["split-north", "split-south"] }, time: time("1990-10-01", null), evidence });
  assert.deepEqual(result.canonicalPlaceIds.sort(), ["split-north", "split-south"]);
  assert.deepEqual(result.retainedPredecessorIds, ["split-old"]);
  assert.equal(result.relations.filter((r) => r.relationType === "split_into").length, 2);
});

test("fixture 6: same labels never auto-merge distinct places", () => {
  const left = { identity: identity("park-a", "park"), name: "常磐公園", geometry: square(138, 35) };
  const right = { identity: identity("park-b", "park"), name: "常磐公園", geometry: square(142, 43) };
  assert.equal(shouldTreatAsSamePlace(left, right).samePlace, false);
  const overlapping = shouldTreatAsSamePlace(left, { ...right, geometry: square(138, 35) });
  assert.equal(overlapping.samePlace, false);
  assert.equal(overlapping.candidateRelation, true);
});

test("fixture 7: administrative and cultural memberships may overlap", () => {
  const memberships = overlappingMembershipsAt([relation("child", "admin", "part_of"), relation("child", "culture", "overlaps")], "child", "2020-01-01");
  assert.deepEqual(memberships.map((r) => r.toPlaceId).sort(), ["admin", "culture"]);
});

test("fixture 8: multilingual, script and historical names are retained", () => {
  const placeId = "multilingual";
  const names = [name(placeId, "ジャングリア沖縄", "canonical", "2025-07-01"), { ...name(placeId, "Junglia Okinawa", "common", "2025-07-01"), language: "en", script: "Latn" }, name(placeId, "旧計画名", "old_name", null, "2025-07-01"), name(placeId, "ジュングリア", "transliteration", "2025-07-01")];
  assert.equal(collectPlaceNameVariants(names, placeId).length, 4);
  assert.deepEqual(collectPlaceNameVariants(names, placeId, "2026-01-01").map((item) => item.nameType).sort(), ["canonical", "common", "transliteration"]);
});

test("fixture 9: concurrent boundary assertions coexist", () => {
  const placeId = "multi-boundary";
  const assertions = [geometry(placeId, square(137, 34), "exact", "public", "2015-01-01"), { ...geometry(placeId, square(137.001, 34.001), "approximate", "public", "2015-01-01"), evidence: [{ sourceType: "osm", sourceId: "way", confidence: 0.5 }] }];
  assert.equal(coexistingGeometryAssertionsAt(assertions, placeId, "2020-06-01").length, 2);
});

test("fixture 10: natural places do not require an address", () => {
  const place = identity("ridge", "nature_area");
  const placeGeometry = geometry(place.canonicalPlaceId, square(138.16, 35.46), "approximate");
  assert.equal(isWellFormedNaturalPlace({ identity: place, names: [name(place.canonicalPlaceId, "赤石岳", "canonical")], geometry: placeGeometry }), true);
  assert.equal(pointMatchesPlaceGeometry({ lat: 35.465, lng: 138.165 }, placeGeometry), true);
});

test("fixture 11: a moved structure and its sites remain distinct identities", () => {
  const relations = [relation("structure", "old-site", "located_on", "1900-01-01", "1975-01-01"), relation("structure", "new-site", "located_on", "1975-01-01")];
  assert.equal(siteForStructureAt(relations, "structure", "1950-01-01"), "old-site");
  assert.equal(siteForStructureAt(relations, "structure", "2000-01-01"), "new-site");
  assert.notEqual("structure", "old-site");
});

test("fixture 12: one record binding is read by current, historical and thematic views", () => {
  const binding: PlaceRecordBinding = { recordId: "record", placeId: "target", observedTime: "2018-05-20", membershipRole: "primary" };
  const base = { scope: { placeIds: ["target"] }, publicationPolicy: "public" as const, operator: "operator", provenance: evidence };
  const views: PlaceViewDefinition[] = [
    { ...base, viewId: "current", targetInterval: { start: "2015-01-01", end: null } },
    { ...base, viewId: "history", targetInterval: { start: "2000-01-01", end: "2020-01-01" } },
    { ...base, viewId: "theme", targetInterval: { start: null, end: null }, theme: "birds" },
    { ...base, viewId: "outside", targetInterval: { start: "2019-01-01", end: null } },
  ];
  assert.deepEqual(viewsReadingBinding(binding, views).map((view) => view.viewId), ["current", "history", "theme"]);
  assert.equal(recordBindingMatchesView(binding, views[3]!), false);
});

test("fixture 13: private or exact geometry is never publicly projected", () => {
  const privateExact = geometry("private", square(137.5, 34.5), "exact", "private");
  const publicExact = geometry("private", square(137.5, 34.5), "exact", "public");
  const publicApprox = geometry("private", square(137.5, 34.5), "approximate", "public");
  assert.equal(projectPublicGeometry(privateExact), null);
  assert.equal(projectPublicGeometry(publicExact), null);
  assert.equal(projectPublicGeometry(publicApprox)?.geometry, publicApprox.geometry);
});

test("fixture 14: external-id changes preserve canonical identity", () => {
  const place = identity("external-stable", "park");
  const ids: PlaceExternalIdentifier[] = [
    { placeId: place.canonicalPlaceId, scheme: "osm", value: "way/old", time: time(null, "2026-01-01"), evidence, status: "asserted" },
    { placeId: place.canonicalPlaceId, scheme: "osm", value: "way/new", time: time("2026-01-01", null), evidence, status: "asserted" },
  ];
  assert.equal(resolveExternalIdentifiersAt(place, ids, "2020-01-01").canonicalPlaceId, place.canonicalPlaceId);
  assert.equal(resolveExternalIdentifiersAt(place, ids, "2026-06-01").identifiers[0]?.value, "way/new");
});

test("negative: historical assertions are not overwritten by current geometry", () => {
  const placeId = "historical";
  const old = geometry(placeId, square(137, 34), "exact", "public", null, "2010-01-01");
  const current = geometry(placeId, square(138, 35), "exact", "public", "2010-01-01");
  assert.equal(geometryAssertionAt([old, current], placeId, "2000-01-01")?.geometry, old.geometry);
});

test("negative: a shared label cannot establish same-place identity", () => {
  const result = shouldTreatAsSamePlace({ identity: identity("a", "park"), name: "同名", geometry: null }, { identity: identity("b", "park"), name: "同名", geometry: null });
  assert.equal(result.samePlace, false);
});

test("negative: private geometry cannot be disclosed by public projection", () => {
  const assertion = geometry("secret", square(139, 36), "approximate", "private");
  assert.equal(projectPublicGeometry(assertion), null);
});
