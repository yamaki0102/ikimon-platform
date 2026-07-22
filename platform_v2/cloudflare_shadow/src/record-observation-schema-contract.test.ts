import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql");
const sql = readFileSync(migrationPath, "utf8");

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

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function insertObservation(db: DatabaseSync, id: string, sourceKey: string, origin = "ai"): void {
  db.prepare(`
    INSERT INTO record_observations (
      observation_id, record_runtime, record_id, owner_user_id, source_key, origin, subject_type
    ) VALUES (?, 'cloudflare_d1', 'record-1', 'owner-1', ?, ?, 'organism')
  `).run(id, sourceKey, origin);
}

test("D1 observation foundation applies to an empty database and is safely replayable", () => {
  assert.doesNotMatch(sql, /^\s*(ALTER\s+TABLE|DROP|TRUNCATE|DELETE\s+FROM|UPDATE)\b/im);
  assert.doesNotMatch(sql, /ask_the_community|recruit|solicit|募集|みんなに聞く/i);
  assert.match(sql, /json_valid\(/i);

  const db = openDb();
  db.exec(sql);
  db.exec(sql);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => String(row.name));
  for (const table of expectedTables) assert.ok(tables.includes(table), table);

  insertObservation(db, "00000000-0000-4000-8000-000000000001", "ai:run-1:candidate-1");
  db.exec(`
    INSERT INTO record_observation_policies (record_runtime, record_id, owner_user_id, visibility)
    VALUES ('cloudflare_d1', 'record-1', 'owner-1', 'public');
  `);

  const observation = db.prepare(`
    SELECT assertion_status, verification_status, lifecycle_status, data_use_scope, accepted_identification_id
    FROM record_observations WHERE observation_id = '00000000-0000-4000-8000-000000000001'
  `).get();
  assert.deepEqual(Object.fromEntries(Object.entries(observation ?? {})), {
    assertion_status: "provisional",
    verification_status: "unreviewed",
    lifecycle_status: "active",
    data_use_scope: "personal_only",
    accepted_identification_id: null,
  });
  assert.equal(db.prepare("SELECT accepts_identification_proposals FROM record_observation_policies WHERE record_id = 'record-1'").get()?.accepts_identification_proposals, 1);

  assert.throws(() => insertObservation(db, "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz", "bad-id", "owner"), /CHECK constraint failed/i);
  assert.throws(() => db.exec(`
    INSERT INTO record_observation_media (
      link_id, observation_id, media_source_runtime, media_id, source_key, locator_json
    ) VALUES (
      '00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001',
      'cloudflare_d1', 'media-1', 'media:1', '{bad json}'
    )
  `), /CHECK constraint failed/i);
  assert.throws(() => db.exec(`
    INSERT INTO observation_ai_suggestions (
      suggestion_id, observation_id, candidate_key, source_key, confidence_score,
      model_provider, model_name, model_version, prompt_version, rule_version, input_digest
    ) VALUES (
      '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001',
      'candidate-1', 'ai:run-1:candidate-1', 1.1, 'provider', 'model', 'v1', 'p1', 'r1', 'digest'
    )
  `), /CHECK constraint failed/i);
  assert.throws(() => db.exec(`
    UPDATE record_observations SET assertion_status = 'human_asserted'
    WHERE observation_id = '00000000-0000-4000-8000-000000000001'
  `), /CHECK constraint failed/i);
  db.close();
});

test("D1 constraints keep accepted claims and active projections inside one observation with human provenance", () => {
  const db = openDb();
  db.exec(sql);
  insertObservation(db, "00000000-0000-4000-8000-000000000001", "ai:run-1:candidate-1");
  insertObservation(db, "00000000-0000-4000-8000-000000000002", "owner:submission-1:subject-2", "owner");

  db.exec(`
    INSERT INTO observation_identification_claims (
      identification_id, observation_id, actor_id, actor_kind, proposed_name, claim_status,
      source_key, decided_by_actor_kind, decided_by_actor_id, decided_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000001',
      'owner-1', 'owner', 'テスト種', 'accepted', 'claim:owner-1:1', 'owner', 'owner-1', CURRENT_TIMESTAMP
    );
    UPDATE record_observations SET
      assertion_status = 'human_asserted', verification_status = 'owner_confirmed',
      accepted_identification_id = '00000000-0000-4000-8000-000000000010',
      reviewed_by_actor_kind = 'owner', reviewed_by_actor_id = 'owner-1', reviewed_at = CURRENT_TIMESTAMP
    WHERE observation_id = '00000000-0000-4000-8000-000000000001';
    INSERT INTO occurrence_projection_versions (
      projection_id, observation_id, projection_version, projection_state, accepted_identification_id,
      basis_of_record, occurrence_status, projection_rule_version, source_digest,
      human_provenance_actor_kind, human_provenance_actor_id, activated_at,
      rights_decision_json, privacy_decision_json, quality_decision_json
    ) VALUES (
      '00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000001',
      1, 'active', '00000000-0000-4000-8000-000000000010', 'HumanObservation', 'present',
      'occurrence_projection/v1', 'digest-1', 'owner', 'owner-1', CURRENT_TIMESTAMP,
      '{"decision":"allow","rule_version":"rights/v1"}',
      '{"decision":"generalized","rule_version":"privacy/v1"}',
      '{"decision":"eligible","rule_version":"quality/v1"}'
    );
  `);

  assert.throws(() => db.exec(`
    UPDATE record_observations SET
      accepted_identification_id = '00000000-0000-4000-8000-000000000010',
      reviewed_by_actor_kind = 'owner', reviewed_by_actor_id = 'owner-1', reviewed_at = CURRENT_TIMESTAMP
    WHERE observation_id = '00000000-0000-4000-8000-000000000002'
  `), /accepted identification must be an accepted human claim/i);
  assert.throws(() => db.exec(`
    INSERT INTO occurrence_projection_versions (
      projection_id, observation_id, projection_version, projection_state, accepted_identification_id,
      basis_of_record, occurrence_status, projection_rule_version, source_digest
    ) VALUES (
      '00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000002',
      1, 'active', NULL, 'HumanObservation', 'present', 'occurrence_projection/v1', 'digest-2'
    )
  `), /active projection requires an active human-asserted observation/i);
  assert.throws(() => db.exec(`
    INSERT INTO occurrence_projection_versions (
      projection_id, observation_id, projection_version, projection_state, accepted_identification_id,
      basis_of_record, occurrence_status, projection_rule_version, source_digest,
      human_provenance_actor_kind, human_provenance_actor_id, activated_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001',
      2, 'active', '00000000-0000-4000-8000-000000000010', 'HumanObservation', 'present',
      'occurrence_projection/v1', 'digest-3', 'owner', 'owner-1', CURRENT_TIMESTAMP
    )
  `), /CHECK constraint failed/i);
  assert.throws(() => db.exec(`
    UPDATE record_observations SET verification_status = 'disputed'
    WHERE observation_id = '00000000-0000-4000-8000-000000000001'
  `), /deactivate the occurrence projection/i);
  assert.throws(() => db.exec(`
    UPDATE observation_identification_claims SET claim_status = 'withdrawn'
    WHERE identification_id = '00000000-0000-4000-8000-000000000010'
  `), /clear accepted pointers/i);
  assert.throws(() => db.exec(`
    UPDATE record_observations SET data_use_scope = 'research_export'
    WHERE observation_id = '00000000-0000-4000-8000-000000000002'
  `), /CHECK constraint failed/i);
  db.close();
});

test("D1 expand migration preserves a restored legacy fixture", () => {
  const db = openDb();
  db.exec(`
    CREATE TABLE observations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO observations VALUES ('legacy-record-1', 'owner-1', '2026-07-01T00:00:00Z');
  `);
  db.exec(sql);
  const legacyRow = db.prepare("SELECT * FROM observations").get();
  assert.deepEqual(Object.fromEntries(Object.entries(legacyRow ?? {})), {
    id: "legacy-record-1",
    user_id: "owner-1",
    created_at: "2026-07-01T00:00:00Z",
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observations").get()?.count, 0);
  db.close();
});
