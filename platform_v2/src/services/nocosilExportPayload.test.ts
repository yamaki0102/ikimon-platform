import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNocosilExportPayload,
  type NocosilExportObservationInput,
} from "./nocosilExportPayload.js";

function observation(overrides: Partial<NocosilExportObservationInput> = {}): NocosilExportObservationInput {
  return {
    id: "observation-1",
    taxon: "Rana japonica",
    date: "2026-05-01",
    latitude: 35.12345,
    longitude: 138.98765,
    photoUrl: "https://media.example.org/observations/observation-1.jpg",
    photoUrlIsSanitizedRendition: true,
    sensitive: false,
    rights: {
      recordConsent: "external_export",
      researchUseConsent: "public_export",
      datasetLicense: "CC-BY-4.0",
      mediaLicense: "CC-BY-4.0",
      externalExportAllowed: true,
      withdrawalStatus: "active",
      consentSource: "user_selected",
      sourcePayload: { privateLabel: "home near 123 Oak St", internalToken: "secret" },
    },
    ...overrides,
  };
}

const base = {
  site: { id: "site-7", displayName: "Private Site Name" },
  period: { start: "2026-05-01", end: "2026-05-31" },
  selectedObservations: [observation()],
};

test("projects only explicitly consented active exports and excludes rights internals", () => {
  const result = buildNocosilExportPayload({
    ...base,
    selectedObservations: [
      observation(),
      observation({ id: "default-consent", rights: { ...observation().rights, consentSource: "default" } }),
      observation({ id: "withdrawn", rights: { ...observation().rights, withdrawalStatus: "withdrawn" } }),
      observation({ id: "private", rights: { ...observation().rights, recordConsent: "private" } }),
    ],
  });

  assert.equal(result.observations.length, 1);
  assert.deepEqual(result.observations[0], {
    id: "observation-1",
    taxon: "Rana japonica",
    date: "2026-05-01",
    location: { precision: "grid_10km", latitude: 35.12755, longitude: 138.98242 },
    photoUrl: "https://media.example.org/observations/observation-1.jpg",
    observerConsent: true,
  });
  assert.equal(JSON.stringify(result).includes("Oak St"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes("Private Site Name"), false);
});

test("rare or protected observations get coarse coordinates unless owner exact permission is trusted", () => {
  const selected = observation({ sensitive: true });
  const coarse = buildNocosilExportPayload({ ...base, selectedObservations: [selected] });
  assert.deepEqual(coarse.observations[0]!.location, {
    precision: "grid_10km",
    latitude: 35.12755,
    longitude: 138.98242,
  });

  const exact = buildNocosilExportPayload({
    ...base,
    selectedObservations: [selected],
    locationPolicy: { allowExactCoordinatesForOwner: true },
  });
  assert.deepEqual(exact.observations[0]!.location, {
    precision: "exact",
    latitude: 35.12345,
    longitude: 138.98765,
  });
});

test("grid snapping handles the poles, antimeridian, and invalid coordinates", () => {
  const polar = buildNocosilExportPayload({
    ...base,
    selectedObservations: [observation({ latitude: 90, longitude: 179.999 })],
  });
  const polarLocation = polar.observations[0]!.location;
  assert.equal(polarLocation.precision, "grid_10km");
  if ("latitude" in polarLocation) {
    assert.ok(polarLocation.latitude <= 90);
    assert.ok(polarLocation.longitude >= -180);
    assert.ok(polarLocation.longitude < 180);
  }

  const invalid = buildNocosilExportPayload({
    ...base,
    selectedObservations: [observation({ latitude: 91, longitude: 0 })],
  });
  assert.deepEqual(invalid.observations[0]!.location, { precision: "unavailable" });

  const acrossDateLine = buildNocosilExportPayload({
    ...base,
    selectedObservations: [
      observation({ id: "east", latitude: 12, longitude: 179.999 }),
      observation({ id: "west", latitude: 12, longitude: -179.999 }),
    ],
  });
  const eastEdge = acrossDateLine.observations[0]!.location;
  const westEdge = acrossDateLine.observations[1]!.location;
  assert.ok("longitude" in eastEdge && "longitude" in westEdge);
  if ("longitude" in eastEdge && "longitude" in westEdge) {
    assert.ok(Math.abs(360 - Math.abs(eastEdge.longitude - westEdge.longitude)) < 0.2);
  }

  const southPole = buildNocosilExportPayload({
    ...base,
    selectedObservations: [observation({ latitude: -90, longitude: -125 })],
  });
  assert.deepEqual(southPole.observations[0]!.location, {
    precision: "grid_10km",
    latitude: -89.95408,
    longitude: 0,
  });
});

test("grid cells preserve at least 10 km steps across latitude and longitude", () => {
  const observations = buildNocosilExportPayload({
    ...base,
    selectedObservations: [
      observation({ id: "south-row", latitude: -0.001, longitude: 0 }),
      observation({ id: "north-row", latitude: 0.001, longitude: 0 }),
      observation({ id: "west-column", latitude: 45, longitude: 0 }),
      observation({ id: "east-column", latitude: 45, longitude: 0.2 }),
    ],
  }).observations;
  const south = observations.find((item) => item.id === "south-row")!.location;
  const north = observations.find((item) => item.id === "north-row")!.location;
  const west = observations.find((item) => item.id === "west-column")!.location;
  const east = observations.find((item) => item.id === "east-column")!.location;
  assert.ok(south && north && west && east);
  if ("latitude" in south && "latitude" in north) {
    assert.ok((north.latitude - south.latitude) * 110_000 >= 10_000);
  }
  if ("longitude" in west && "longitude" in east) {
    const latitude = 45.1 * Math.PI / 180;
    const longitudeDistance = (east.longitude - west.longitude) * Math.PI / 180 * 6_371_000 * Math.cos(latitude);
    assert.ok(longitudeDistance >= 10_000);
  }
});

test("unsafe photo URLs are omitted while harmless HTTPS URLs are retained", () => {
  const result = buildNocosilExportPayload({
    ...base,
    selectedObservations: [
      observation({ photoUrl: "http://media.example.org/photo.jpg" }),
      observation({ id: "token-url", photoUrl: "https://media.example.org/photo.jpg?token=abc" }),
      observation({ id: "safe", photoUrl: "https://media.example.org/photo.jpg" }),
      observation({ id: "raw", photoUrl: "https://media.example.org/original-with-exif.jpg", photoUrlIsSanitizedRendition: false }),
    ],
  });
  const photosById = new Map(result.observations.map((item) => [item.id, item.photoUrl]));
  assert.equal(photosById.get("observation-1"), null);
  assert.equal(photosById.get("safe"), "https://media.example.org/photo.jpg");
  assert.equal(photosById.get("token-url"), null);
  assert.equal(photosById.get("raw"), null);
});

test("provenance digest is stable for the same projection and changes with projected content", () => {
  const first = buildNocosilExportPayload(base);
  const repeated = buildNocosilExportPayload(base);
  const changed = buildNocosilExportPayload({
    ...base,
    selectedObservations: [observation({ taxon: "Rana temporaria" })],
  });
  assert.equal(first.provenanceDigest, repeated.provenanceDigest);
  assert.notEqual(first.provenanceDigest, changed.provenanceDigest);
  assert.match(first.provenanceDigest, /^sha256:[a-f0-9]{64}$/);
});
