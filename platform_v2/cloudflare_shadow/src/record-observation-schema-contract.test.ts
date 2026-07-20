import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "migrations",
  "observations",
  "0067_record_observation_foundation.sql",
);

const expectedTables = [
  "record_observations",
  "record_observation_policies",
  "record_observation_source_map",
  "record_observation_media",
  "observation_ai_suggestions",
  "observation_identification_claims",
  "observation_lifecycle_events",
  "occurrence_projection_versions",
  "environment_assessments",
  "environment_assessment_media",
  "record_observation_consistency_ledger",
  "identification_queue_entries",
];

test("D1 observation foundation applies to an empty database and creates only additive structures", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.doesNotMatch(sql, /^\s*(ALTER\s+TABLE|DROP|TRUNCATE|DELETE\s+FROM|UPDATE)\b/im);
  assert.doesNotMatch(sql, /ask_the_community|recruit|solicit|募集|みんなに聞く/i);

  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(sql);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all().map((row) => String(row.name));
  for (const table of expectedTables) assert.ok(tables.includes(table), table);

  db.exec(`
    INSERT INTO record_observations (
      observation_id, record_id, owner_user_id, origin, subject_type, individual_certainty
    ) VALUES (
      '00000000-0000-4000-8000-000000000001', 'record-1', 'owner-1', 'ai', 'organism', 'unknown'
    );
    INSERT INTO record_observation_policies (record_id, owner_user_id, visibility)
    VALUES ('record-1', 'owner-1', 'public');
  `);

  const observationRow = db.prepare(`
    SELECT assertion_status, verification_status, lifecycle_status, data_use_scope,
           accepted_identification_id
    FROM record_observations
    WHERE observation_id = '00000000-0000-4000-8000-000000000001'
  `).get();
  const observation = Object.fromEntries(Object.entries(observationRow ?? {}));
  assert.deepEqual(observation, {
    assertion_status: "provisional",
    verification_status: "unreviewed",
    lifecycle_status: "active",
    data_use_scope: "personal_only",
    accepted_identification_id: null,
  });
  assert.equal(
    db.prepare("SELECT external_proposals_enabled FROM record_observation_policies WHERE record_id = 'record-1'").get()
      ?.external_proposals_enabled,
    1,
  );

  db.exec(`
    INSERT INTO observation_identification_claims (
      identification_id, observation_id, actor_user_id, actor_kind, proposed_name, claim_status, source_key
    ) VALUES (
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000001',
      'owner-1', 'owner', 'テスト種', 'accepted', 'claim-1'
    )
  `);
  assert.throws(() => db.exec(`
    INSERT INTO observation_identification_claims (
      identification_id, observation_id, actor_user_id, actor_kind, proposed_name, claim_status, source_key
    ) VALUES (
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000001',
      'curator-1', 'curator', '別のテスト種', 'accepted', 'claim-2'
    )
  `), /UNIQUE constraint failed/i);

  assert.throws(() => db.exec(`
    INSERT INTO record_observations (
      observation_id, record_id, owner_user_id, origin, assertion_status, subject_type, individual_certainty
    ) VALUES (
      '00000000-0000-4000-8000-000000000002', 'record-1', 'owner-1', 'ai', 'accepted', 'organism', 'unknown'
    )
  `), /CHECK constraint failed/i);
  assert.throws(() => db.exec(`
    INSERT INTO record_observations (
      observation_id, record_id, owner_user_id, origin, subject_type, individual_certainty
    ) VALUES ('legacy-short-id', 'record-1', 'owner-1', 'owner', 'organism', 'individual')
  `), /CHECK constraint failed/i);
  db.close();
});
