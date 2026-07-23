import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildD1RecordPlaceBackfillSql,
  classifyRecordThemes,
  RECORD_PLACE_CALCULATION_VERSION,
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

test("backfill retires stale calculated memberships and does not override reviewed corrections", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE record_place_memberships (
      membership_id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      membership_type TEXT NOT NULL,
      membership_state TEXT NOT NULL,
      derivation_source TEXT NOT NULL,
      derivation_details_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      internal_precision TEXT NOT NULL,
      public_precision TEXT NOT NULL,
      is_primary INTEGER NOT NULL,
      reviewed_state TEXT NOT NULL,
      calculation_version TEXT NOT NULL,
      removed_at TEXT,
      corrected_by_membership_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(record_id, place_id, calculation_version)
    );
    CREATE TABLE record_theme_assertions (
      theme_assertion_id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      theme TEXT NOT NULL,
      assertion_source TEXT NOT NULL,
      confidence REAL NOT NULL,
      assertion_status TEXT NOT NULL,
      rule_version TEXT NOT NULL,
      input_provenance_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(record_id, theme, assertion_source, rule_version)
    );
    INSERT INTO record_place_memberships (
      membership_id, record_id, place_id, membership_type, membership_state,
      derivation_source, derivation_details_json, confidence, internal_precision,
      public_precision, is_primary, reviewed_state, calculation_version
    ) VALUES
      ('old-auto', 'record_moved', 'place_parent', 'inside', 'confirmed',
       'polygon_calculation', '{}', 0.9, 'exact_point', 'place', 1, 'unreviewed',
       '${RECORD_PLACE_CALCULATION_VERSION}'),
      ('owner-correction', 'record_moved', 'place_child', 'inside', 'confirmed',
       'owner', '{}', 1, 'exact_point', 'place', 0, 'corrected',
       '${RECORD_PLACE_CALCULATION_VERSION}');
  `);

  const outside = runRecordPlaceBackfill({
    records: [{
      recordId: "record_moved",
      exactLat: 36,
      exactLng: 140,
      uncertaintyM: 0,
    }],
    boundaries: [parent, child],
  });
  assert.equal(outside.recordsMatched, 0);
  assert.deepEqual(outside.evaluatedRecordIds, ["record_moved"]);
  const outsideSql = buildD1RecordPlaceBackfillSql(outside);
  db.exec(outsideSql);
  db.exec(outsideSql);

  const retired = db.prepare(
    "SELECT is_primary, removed_at FROM record_place_memberships WHERE membership_id = 'old-auto'"
  ).get() as { is_primary: number; removed_at: string | null };
  assert.equal(retired.is_primary, 0);
  assert.ok(retired.removed_at);
  const reviewed = db.prepare(
    "SELECT removed_at FROM record_place_memberships WHERE membership_id = 'owner-correction'"
  ).get() as { removed_at: string | null };
  assert.equal(reviewed.removed_at, null);

  const inside = runRecordPlaceBackfill({
    records: [{
      recordId: "record_moved",
      exactLat: 34.3,
      exactLng: 137.3,
      uncertaintyM: 0,
    }],
    boundaries: [parent],
  });
  db.exec(buildD1RecordPlaceBackfillSql(inside));
  const restored = db.prepare(
    "SELECT membership_state, is_primary, removed_at FROM record_place_memberships WHERE membership_id = 'old-auto'"
  ).get() as { membership_state: string; is_primary: number; removed_at: string | null };
  assert.equal(restored.membership_state, "confirmed");
  assert.equal(restored.is_primary, 1);
  assert.equal(restored.removed_at, null);
  const childInside = runRecordPlaceBackfill({
    records: [{
      recordId: "record_moved",
      exactLat: 34.3,
      exactLng: 137.3,
      uncertaintyM: 0,
    }],
    boundaries: [child],
  });
  db.exec(buildD1RecordPlaceBackfillSql(childInside));
  const reviewedAfterConflict = db.prepare(
    "SELECT derivation_source, reviewed_state, removed_at FROM record_place_memberships WHERE membership_id = 'owner-correction'"
  ).get() as { derivation_source: string; reviewed_state: string; removed_at: string | null };
  assert.equal(reviewedAfterConflict.derivation_source, "owner");
  assert.equal(reviewedAfterConflict.reviewed_state, "corrected");
  assert.equal(reviewedAfterConflict.removed_at, null);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM record_place_memberships").get() as { count: number }).count,
    2,
  );
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
