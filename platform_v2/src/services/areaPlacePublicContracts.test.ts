import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAreaPlacePublicContracts,
  serializeAreaPlacePublicContracts,
  type AreaPlacePublicContractsInput,
} from "./areaPlacePublicContracts.js";

const source = {
  sourceId: "source:synthetic-place-001",
  version: "v1",
  observedAt: "2026-09-08T00:00:00.000Z",
  freshness: "CURRENT" as const,
  authority: "OFFICIAL_VERIFIED" as const,
  rights: "PUBLIC" as const,
};

const baseInput: AreaPlacePublicContractsInput = {
  fixtureClass: "synthetic",
  area: { id: "area:001", name: "Synthetic Area", source, publicProjection: "AUTHORIZED" },
  places: [{ id: "place:001", areaId: "area:001", name: "Synthetic Place", source, sensitiveLocation: false }],
  naturalFeatures: [{ id: "feature:001", placeId: "place:001", name: "Synthetic River", source }],
  seasonalStates: [{ placeId: "place:001", season: "summer", state: "present", source }],
  scanPoints: [{ id: "place:001:main", placeId: "place:001", routeKey: "main", source, status: "ACTIVE" }],
};

test("compiles stable public Area/Place/Feature/SeasonalState/ScanPoint contracts", () => {
  const result = compileAreaPlacePublicContracts(baseInput);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reasonCode, "PUBLIC_CONTRACTS_COMPILED");
  assert.equal(result.contracts?.scanPoints[0]?.id, "place:001:main");
  assert.equal(result.effects.databaseWrites, 0);
  assert.equal(result.effects.publicationEffects, 0);
});

test("rejects stale, unknown, and uncertain seasonal state", () => {
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    seasonalStates: [{ ...baseInput.seasonalStates[0]!, state: "unknown" }],
  }).reasonCode, "SEASONAL_STATE_UNCERTAIN");
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    seasonalStates: [{ ...baseInput.seasonalStates[0]!, source: { ...source, freshness: "STALE" } }],
  }).reasonCode, "SOURCE_NOT_CURRENT");
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    seasonalStates: [{ ...baseInput.seasonalStates[0]!, source: { ...source, authority: "COMMUNITY_OBSERVED" } }],
  }).reasonCode, "SEASONAL_STATE_UNCERTAIN");
});

test("denies missing public projection authority and non-public rights", () => {
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    area: { ...baseInput.area, publicProjection: "DENIED" },
  }).reasonCode, "PUBLIC_AUTHORITY_DENIED");
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    places: [{ ...baseInput.places[0]!, source: { ...source, rights: "PRIVATE" } }],
  }).reasonCode, "SOURCE_NOT_PUBLIC");
});

test("excludes sensitive locations and invalid parent relationships", () => {
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    places: [{ ...baseInput.places[0]!, sensitiveLocation: true }],
  }).reasonCode, "SENSITIVE_LOCATION_EXCLUDED");
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    naturalFeatures: [{ ...baseInput.naturalFeatures[0]!, placeId: "place:missing" }],
  }).reasonCode, "RELATIONSHIP_INVALID");
});

test("keeps serialization deterministic and stable ScanPoint identities", () => {
  const reordered = {
    ...baseInput,
    places: [...baseInput.places].reverse(),
    naturalFeatures: [...baseInput.naturalFeatures].reverse(),
  };
  const first = compileAreaPlacePublicContracts(baseInput);
  const second = compileAreaPlacePublicContracts(reordered);
  assert.equal(first.serialized, second.serialized);
  assert.equal(serializeAreaPlacePublicContracts(first.contracts!), first.serialized);
  assert.equal(compileAreaPlacePublicContracts({
    ...baseInput,
    scanPoints: [{ ...baseInput.scanPoints[0]!, id: "unstable-id" }],
  }).reasonCode, "IDENTITY_INVALID");
});
