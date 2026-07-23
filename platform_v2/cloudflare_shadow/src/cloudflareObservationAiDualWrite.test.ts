import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseObservationAiCandidate } from "./cloudflareObservationAi.js";
import { buildObservationAiDualWritePlan } from "./cloudflareObservationAiDualWrite.js";

const candidate = parseObservationAiCandidate(JSON.stringify({
  vernacularName: "モンシロチョウ",
  scientificName: "Pieris rapae",
  rank: "species",
  confidence: 0.91,
  visualEvidence: ["白い翅"],
  needsMoreEvidence: [],
  nonBiological: false,
  subjectLocator: { rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
  coexistingSubjects: [{
    candidateKey: "flower-left",
    vernacularName: "アブラナ科",
    scientificName: "Brassicaceae",
    rank: "family",
    confidence: 0.72,
    visualEvidence: ["黄色い花"],
    needsMoreEvidence: ["葉の接写"],
    subjectLocator: { rect: { x: 0.02, y: 0.45, width: 0.58, height: 0.5 } },
  }],
}));

const input = {
  recordId: "record-1",
  ownerUserId: "owner-1",
  mediaIds: ["asset-1", "asset-2"],
  legacyOccurrenceId: "occ:record-1:0",
  requestId: "request-1",
  aiRunId: "ai-run-1",
  candidate,
};

test("exact AI input replay builds identical multi-subject observation identities", async () => {
  const first = await buildObservationAiDualWritePlan(input);
  const replay = await buildObservationAiDualWritePlan(input);
  assert.equal(first.observationIds.length, 2);
  assert.deepEqual(replay.observationIds, first.observationIds);
  assert.equal(new Set(first.observationIds).size, 2);
  for (const id of first.observationIds) assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
});

test("AI dual-write is idempotent and cannot create an accepted identification or active occurrence", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  const plan = await buildObservationAiDualWritePlan(input);
  const apply = () => {
    for (const mutation of plan.mutations) db.prepare(mutation.sql).run(...mutation.values);
  };
  apply();
  apply();

  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observations").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_media").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_ai_suggestions").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_lifecycle_events").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM record_observation_consistency_ledger").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM occurrence_projection_versions").get()?.count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observation_identification_claims").get()?.count, 0);

  const rows = db.prepare(`
    SELECT origin, assertion_status, verification_status, data_use_scope, accepted_identification_id
    FROM record_observations ORDER BY observation_id
  `).all();
  for (const row of rows) {
    assert.deepEqual(Object.fromEntries(Object.entries(row)), {
      origin: "ai",
      assertion_status: "provisional",
      verification_status: "unreviewed",
      data_use_scope: "personal_only",
      accepted_identification_id: null,
    });
  }
  db.close();
});

test("a no-biota reassessment excludes only stale provisional AI observations", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  db.prepare(`INSERT INTO record_observations (
    observation_id, record_runtime, record_id, owner_user_id, source_key, origin,
    assertion_status, verification_status, lifecycle_status, data_use_scope,
    subject_type, individual_certainty, captive_context, count_mode, context_json, provenance_json
  ) VALUES (?, 'cloudflare_d1', 'record-1', 'owner-1', ?, ?, ?, ?, 'active', ?, 'organism', 'unknown', 'unknown', 'unknown', '{}', '{}')`)
    .run("11111111-1111-8111-8111-111111111111", "old-ai", "ai", "provisional", "unreviewed", "personal_only");
  db.prepare(`INSERT INTO record_observations (
    observation_id, record_runtime, record_id, owner_user_id, source_key, origin,
    assertion_status, verification_status, lifecycle_status, data_use_scope,
    subject_type, individual_certainty, captive_context, count_mode, context_json, provenance_json,
    reviewed_by_actor_kind, reviewed_by_actor_id, reviewed_at
  ) VALUES (?, 'cloudflare_d1', 'record-1', 'owner-1', ?, 'owner',
    'human_asserted', 'owner_confirmed', 'active', 'personal_only', 'organism', 'unknown', 'unknown', 'unknown', '{}', '{}',
    'owner', 'owner-1', CURRENT_TIMESTAMP)`)
    .run("22222222-2222-8222-8222-222222222222", "owner-assertion");

  const noBiotaCandidate = parseObservationAiCandidate(JSON.stringify({
    vernacularName: null,
    scientificName: null,
    rank: "unknown",
    confidence: 0,
    visualEvidence: [],
    needsMoreEvidence: [],
    nonBiological: true,
    subjectLocator: {},
    coexistingSubjects: [],
  }));
  const plan = await buildObservationAiDualWritePlan({ ...input, candidate: noBiotaCandidate });
  assert.equal(plan.observationIds.length, 0);
  for (const mutation of plan.mutations) db.prepare(mutation.sql).run(...mutation.values);

  const states = db.prepare("SELECT source_key, lifecycle_status, excluded_reason FROM record_observations ORDER BY source_key").all();
  assert.deepEqual(states.map((row) => Object.fromEntries(Object.entries(row))), [
    { source_key: "old-ai", lifecycle_status: "excluded", excluded_reason: "ai_reassessment_no_visible_biota" },
    { source_key: "owner-assertion", lifecycle_status: "active", excluded_reason: null },
  ]);
  db.close();
});
