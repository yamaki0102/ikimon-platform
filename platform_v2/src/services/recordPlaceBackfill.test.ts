import assert from "node:assert/strict";
import test from "node:test";
import {
  buildD1RecordPlaceBackfillSql,
  classifyRecordThemes,
  runRecordPlaceBackfill,
} from "./recordPlaceBackfill.js";

const parent = {
  placeId: "place_parent",
  geometry: {
    type: "Polygon" as const,
    coordinates: [[[137, 34], [138, 34], [138, 35], [137, 35], [137, 34]]],
  },
  confidence: 0.95,
  precision: "exact" as const,
  hierarchyDepth: 0,
  areaHa: 100,
};
const child = {
  placeId: "place_child",
  geometry: {
    type: "Polygon" as const,
    coordinates: [[[137.2, 34.2], [137.4, 34.2], [137.4, 34.4], [137.2, 34.4], [137.2, 34.2]]],
  },
  confidence: 0.9,
  precision: "exact" as const,
  hierarchyDepth: 1,
  areaHa: 10,
};

test("one Record with multiple Occurrence-shaped input rows is counted once across multiple Places", () => {
  const record = {
    recordId: "record_1",
    exactLat: 34.3,
    exactLng: 137.3,
    uncertaintyM: 2,
    hasTaxonData: true,
  };
  const report = runRecordPlaceBackfill({
    records: [record, { ...record, note: "second occurrence compatibility row" }],
    boundaries: [parent, child],
  });
  assert.equal(report.inputRows, 2);
  assert.equal(report.uniqueRecords, 1);
  assert.equal(report.confirmedMemberships, 2);
  assert.equal(report.memberships.find((row) => row.placeId === "place_child")?.primary, true);
  assert.equal(report.sourceRecordsMutated, false);
});

test("missing exact location is skipped and never inferred from public location", () => {
  const report = runRecordPlaceBackfill({
    records: [{ recordId: "record_missing", exactLat: null, exactLng: null, uncertaintyM: null }],
    boundaries: [parent],
  });
  assert.equal(report.recordsMatched, 0);
  assert.equal(report.skippedReasons.missing_or_invalid_exact_location, 1);
});

test("backfill rerun produces stable IDs and idempotent SQL upserts", () => {
  const input = {
    records: [{
      recordId: "record_2",
      exactLat: 34.3,
      exactLng: 137.3,
      uncertaintyM: 0,
      occurrenceCount: 3,
      note: "夕焼けの風景に気づいた",
      mediaKinds: ["image"],
    }],
    boundaries: [parent, child],
  };
  const first = runRecordPlaceBackfill(input);
  const second = runRecordPlaceBackfill(input);
  assert.deepEqual(first.memberships.map((row) => row.membershipId), second.memberships.map((row) => row.membershipId));
  const sql = buildD1RecordPlaceBackfillSql(first);
  assert.match(sql, /ON CONFLICT\(record_id, place_id, calculation_version\) DO UPDATE/);
  assert.match(sql, /ON CONFLICT\(record_id, theme, assertion_source, rule_version\) DO UPDATE/);
  assert.doesNotMatch(sql, /UPDATE observations/);
  assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT)\b/, "Wrangler D1 execute rejects explicit transaction wrappers");
  assert.equal(first.sourceOccurrenceCount, 3);
});

test("deterministic themes retain provenance and never invent history", () => {
  const assertions = classifyRecordThemes({
    recordId: "record_theme",
    exactLat: null,
    exactLng: null,
    uncertaintyM: null,
    note: "散歩中に夕焼けの違いに気づいた",
    mediaKinds: ["video"],
  });
  assert.deepEqual(
    assertions.map((row) => row.theme).sort(),
    ["activity", "audio_visual", "insight", "scenery"].sort(),
  );
  assert.equal(assertions.some((row) => row.theme === "history"), false);
  assert.equal(assertions.every((row) => row.inputProvenance.exactLocationUsed === false), true);
});
