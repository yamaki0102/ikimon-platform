import assert from "node:assert/strict";
import test from "node:test";
import {
  ingestPlacePublicProjection,
  serializePlacePublicProjection,
  type PlacePublicProjectionIngressInput,
} from "./placePublicProjectionIngress.js";

const source = {
  sourceId: "source:place-001",
  revision: "revision:7",
  observedAt: "2026-09-08T00:00:00.000Z",
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  effectiveUntil: "2026-09-30T23:59:59.999Z",
  freshness: "CURRENT" as const,
  authority: "OFFICIAL_VERIFIED" as const,
  rights: "PUBLIC" as const,
};

const baseInput: PlacePublicProjectionIngressInput = {
  asOf: "2026-09-08T12:00:00.000Z",
  place: {
    id: "place:001",
    areaId: "area:001",
    name: "Synthetic Place",
    source,
    publicProjection: "AUTHORIZED",
  },
};

test("accepts a current, effective, public and authorized Place projection", () => {
  const result = ingestPlacePublicProjection(baseInput);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reasonCode, "PLACE_PUBLIC_PROJECTION_ACCEPTED");
  assert.deepEqual(result.projection, {
    id: "place:001",
    areaId: "area:001",
    name: "Synthetic Place",
    source,
  });
  assert.deepEqual(result.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
    runtimeMutations: 0,
  });
});

test("fails closed when freshness or effective period is not current", () => {
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, freshness: "STALE" } },
  }).reasonCode, "SOURCE_NOT_CURRENT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, effectiveUntil: "2026-09-08T11:59:59.999Z" } },
  }).reasonCode, "SOURCE_NOT_CURRENT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, effectiveFrom: "2026-09-08T12:00:00.001Z" } },
  }).reasonCode, "SOURCE_NOT_CURRENT");
});

test("requires public rights and explicit publication authority", () => {
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, publicProjection: "DENIED" },
  }).reasonCode, "PUBLIC_AUTHORITY_DENIED");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, rights: "RESTRICTED" } },
  }).reasonCode, "SOURCE_NOT_PUBLIC");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, rights: "PRIVATE" } },
  }).reasonCode, "SOURCE_NOT_PUBLIC");
});

test("rejects missing or malformed source revision and stable identity", () => {
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, revision: "" } },
  }).reasonCode, "INVALID_INPUT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, id: "" },
  }).reasonCode, "INVALID_INPUT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, sourceId: "" } },
  }).reasonCode, "INVALID_INPUT");
});

test("fails closed for malformed and unknown fields", () => {
  assert.equal(ingestPlacePublicProjection(null).reasonCode, "INVALID_INPUT");
  assert.equal(ingestPlacePublicProjection({ ...baseInput, extra: true }).reasonCode, "INVALID_INPUT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, extra: true },
  }).reasonCode, "INVALID_INPUT");
  assert.equal(ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, source: { ...source, extra: true } },
  }).reasonCode, "INVALID_INPUT");
  const pollutedPlace = Object.assign(Object.create({ polluted: true }), baseInput.place);
  assert.equal(ingestPlacePublicProjection({ ...baseInput, place: pollutedPlace }).reasonCode, "INVALID_INPUT");
});

test("preserves source and stable identity while serializing deterministically", () => {
  const renamed = ingestPlacePublicProjection({
    ...baseInput,
    place: { ...baseInput.place, name: "Renamed Place" },
  });
  assert.equal(renamed.projection?.id, baseInput.place.id);
  assert.equal(renamed.projection?.source.sourceId, source.sourceId);
  assert.equal(renamed.projection?.source.revision, source.revision);

  const first = ingestPlacePublicProjection(baseInput);
  const second = ingestPlacePublicProjection({
    asOf: baseInput.asOf,
    place: {
      publicProjection: "AUTHORIZED",
      source: { ...source },
      name: baseInput.place.name,
      areaId: baseInput.place.areaId,
      id: baseInput.place.id,
    },
  });
  assert.equal(first.serialized, second.serialized);
  assert.equal(serializePlacePublicProjection(first.projection!), first.serialized);
});
