import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function openCoreBase(): DatabaseSync {
  const sqlite = new DatabaseSync(":memory:");
  for (const filename of [
    "0009_zukan_foundation_v2_source_identity.sql",
    "0010_zukan_foundation_v2_predicate_claims.sql",
    "0011_zukan_foundation_v2_authority_resolution.sql",
    "0012_zukan_foundation_v2_governance_rights.sql",
    "0013_zukan_foundation_v2_disputes_coverage.sql",
    "0014_zukan_foundation_v2_integrity_hardening.sql",
  ]) {
    sqlite.exec(readFileSync(new URL(`../migrations/core/${filename}`, import.meta.url), "utf8"));
  }
  return sqlite;
}

const MIGRATION_0026 = readFileSync(
  new URL("../migrations/core/0026_place_steward_predicates.sql", import.meta.url),
  "utf8",
);

test("0026 registers place.steward, place.activity_org, and place.contact on empty and existing DBs and enforces valid_from", (t) => {
  // 1. Empty DB (schema only) -> apply 0026
  const emptyDb = openCoreBase();
  t.after(() => emptyDb.close());
  emptyDb.exec(MIGRATION_0026);
  // Idempotent re-apply
  emptyDb.exec(MIGRATION_0026);

  const defs = emptyDb.prepare(
    `SELECT predicate_uri, predicate_version, status, cardinality, polarity_mode, temporal_profile
       FROM zukan_predicate_definitions
      WHERE predicate_uri IN ('place.steward', 'place.activity_org', 'place.contact')
      ORDER BY predicate_uri`,
  ).all() as Array<Record<string, unknown>>;
  assert.deepEqual(defs.map((row) => ({ ...row })), [
    { predicate_uri: "place.activity_org", predicate_version: 1, status: "active", cardinality: "many", polarity_mode: "positive_or_negative", temporal_profile: "valid_time" },
    { predicate_uri: "place.contact", predicate_version: 1, status: "active", cardinality: "many", polarity_mode: "positive_or_negative", temporal_profile: "valid_time" },
    { predicate_uri: "place.steward", predicate_version: 1, status: "active", cardinality: "many", polarity_mode: "positive_or_negative", temporal_profile: "valid_time" },
  ]);

  // 2. Existing DB with pre-existing predicate & claim -> apply 0026
  const existingDb = openCoreBase();
  t.after(() => existingDb.close());
  existingDb.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('place:plc_1', 'zukan', 'place');
    INSERT INTO zukan_predicate_definitions(predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile)
    VALUES ('species.native_status', 1, 'string', 'one', 'positive_or_negative', 'valid_time');
    INSERT INTO zukan_claims(claim_id, subject_id, predicate_uri, predicate_version, tenant_id)
    VALUES ('clm_existing', 'place:plc_1', 'species.native_status', 1, 'zukan');
  `);
  existingDb.exec(MIGRATION_0026);

  // Existing predicate write still passes (even without valid_from)
  existingDb.prepare(
    `INSERT INTO zukan_claim_revisions(claim_revision_id, claim_id, revision, predicate_uri, predicate_version, polarity, valid_from)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev_existing_1", "clm_existing", 1, "species.native_status", 1, "positive", null);

  // New place.* predicates reject missing valid_from
  for (const predicate of ["place.steward", "place.activity_org", "place.contact"]) {
    const claimId = `clm_${predicate}`;
    existingDb.prepare(
      `INSERT INTO zukan_claims(claim_id, subject_id, predicate_uri, predicate_version, tenant_id)
       VALUES (?, ?, ?, 1, 'zukan')`,
    ).run(claimId, "place:plc_1", predicate);

    assert.throws(() => {
      existingDb.prepare(
        `INSERT INTO zukan_claim_revisions(claim_revision_id, claim_id, revision, predicate_uri, predicate_version, polarity, valid_from)
         VALUES (?, ?, 1, ?, 1, 'positive', NULL)`,
      ).run(`rev_null_${predicate}`, claimId, predicate);
    }, /place_claim_valid_from_required/);

    // With valid_from (+ negative polarity), write succeeds
    existingDb.prepare(
      `INSERT INTO zukan_claim_revisions(claim_revision_id, claim_id, revision, predicate_uri, predicate_version, polarity, valid_from, valid_to)
       VALUES (?, ?, 1, ?, 1, 'negative', '2026-11-25T00:00:00Z', '2027-11-25T00:00:00Z')`,
    ).run(`rev_ok_${predicate}`, claimId, predicate);
  }
});
