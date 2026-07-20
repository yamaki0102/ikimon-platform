import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "db", "migrations", "0132_record_observation_foundation.sql");

test("PostgreSQL observation foundation is additive and keeps AI, human claims, occurrence, and environment separate", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const tables = [
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

  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, "i"), table);
  }

  assert.doesNotMatch(sql, /^\s*(ALTER\s+TABLE|DROP|TRUNCATE|DELETE\s+FROM|UPDATE)\b/im);
  assert.match(sql, /origin\s+TEXT\s+NOT NULL[\s\S]*'owner'[\s\S]*'ai'[\s\S]*'community'[\s\S]*'import'[\s\S]*'system'/i);
  assert.match(sql, /assertion_status[\s\S]*'provisional'[\s\S]*'human_asserted'/i);
  assert.match(sql, /verification_status[\s\S]*'unreviewed'[\s\S]*'owner_confirmed'[\s\S]*'community_review'[\s\S]*'disputed'[\s\S]*'verified'/i);
  assert.match(sql, /data_use_scope[\s\S]*'personal_only'[\s\S]*'community_observation'[\s\S]*'research_export'/i);
  assert.match(sql, /external_proposals_enabled\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+TRUE/i);
  assert.match(sql, /observation_ai_suggestions[\s\S]*model_name[\s\S]*prompt_version[\s\S]*input_fingerprint/i);
  assert.match(sql, /observation_identification_claims[\s\S]*actor_kind[\s\S]*actor_user_id/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS\s+idx_observation_identification_claims_accepted[\s\S]*WHERE claim_status = 'accepted'/i);
  assert.match(sql, /occurrence_projection_versions[\s\S]*projection_status[\s\S]*privacy_rule_version[\s\S]*quality_rule_version/i);
  assert.match(sql, /environment_assessments[\s\S]*source_kind[\s\S]*assessment_status[\s\S]*input_provenance/i);
  assert.match(sql, /identification_queue_entries[\s\S]*priority_components[\s\S]*calculated_at/i);
  assert.doesNotMatch(sql, /ask_the_community|recruit|solicit|募集|みんなに聞く/i);
});
