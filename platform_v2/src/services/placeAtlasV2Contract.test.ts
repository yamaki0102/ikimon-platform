import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaceAtlasProfile } from "./placeAtlasContract.js";
import { buildPlaceAtlasProfileV2 } from "./placeAtlasV2Contract.js";

test("v2 preserves the v1 Record semantics while adding canonical identity and policy", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:1281984233",
      osmType: "way",
      osmId: 1281984233,
    },
    place: {
      name: "JUNGLIA OKINAWA",
      type: "theme_park",
      aliases: ["ジャングリア", "ジャングリア沖縄"],
      multilingualNames: { ja: "ジャングリア沖縄", en: "JUNGLIA OKINAWA" },
    },
    records: [
      {
        recordId: "record-1",
        observedAt: "2026-07-01T00:00:00Z",
        mediaKind: "photo",
        themes: ["activity"],
      },
      {
        recordId: "record-1",
        observedAt: "2026-07-01T00:00:00Z",
        mediaKind: "photo",
        themes: ["nature"],
      },
      {
        recordId: "record-2",
        observedAt: "2026-07-02T00:00:00Z",
        themes: ["scenery"],
      },
      {
        recordId: "record-3",
        observedAt: "2026-07-03T00:00:00Z",
        themes: ["facility"],
      },
    ],
    recordSetComplete: true,
    locationMode: "osm_area",
    sources: ["OpenStreetMap", "public_map_snapshot_records_v1"],
  });
  const v2 = buildPlaceAtlasProfileV2(v1, {
    boundary: {
      available: true,
      geometryKind: "Polygon",
      precision: "exact",
      confidence: 0.8,
      validationState: "source_validated",
    },
    sourceReferences: [{
      sourceType: "osm_way",
      sourceId: "1281984233",
      sourceUrl: "https://www.openstreetmap.org/way/1281984233",
      confidence: 0.8,
      verificationStatus: "source_verified",
      lastCheckedAt: "2026-07-23T00:00:00Z",
    }],
  });

  assert.equal(v2.version, 2);
  assert.equal(v2.place.placeKind, "theme_park");
  assert.equal(v2.recordSummary.recordCount, 3);
  assert.deepEqual(v2.place.aliases, ["ジャングリア", "ジャングリア沖縄"]);
  assert.equal(v2.policy.recordingPolicy, "check_rules");
  assert.equal(v2.policy.contributionCtaMode, "check_rules");
  assert.equal(v2.provenance.sourceReferences[0]?.sourceType, "osm_way");
  assert.doesNotMatch(JSON.stringify(v2), /exact_lat|exact_lng|latitude|longitude/);
});

test("public-cell v2 remains a privacy-safe fallback and distinguishes empty from zero", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "public_cell", cellId: "cell:34.97,138.38" },
    place: { name: "このあたりの地域図鑑", type: "public_cell" },
    records: [],
    recordSetComplete: true,
    locationMode: "public_cell",
    sources: ["public_map_snapshot_records_v1"],
  });
  const v2 = buildPlaceAtlasProfileV2(v1);
  assert.equal(v2.recordSummary.recordCount, 0);
  assert.equal(v2.publication.responseState, "empty");
  assert.equal(v2.place.boundary.precision, "public_cell");
  assert.equal(v2.place.boundary.available, false);
});
