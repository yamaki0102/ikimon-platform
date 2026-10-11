import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildObservationAiQualityBacklogPayload,
  GEMINI_QUALITY_BACKLOG_MAX_ACTIVE,
  GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK,
  GEMINI_QUALITY_BACKLOG_VERSION,
  OBSERVATION_AI_QUALITY_BACKLOG_CAS_SQL,
  OBSERVATION_AI_QUALITY_BACKLOG_INSERT_SQL,
  OBSERVATION_AI_QUALITY_BACKLOG_REVALIDATE_SQL,
  OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL,
  observationAiQualityBacklogCapacity,
} from "./observationAiQualityBacklog";

const MIGRATIONS = [
  "0001_observation_write_contract.sql",
  "0004_public_derivative_gate.sql",
  "0012_public_derivative_binary_verification.sql",
  "0022_observation_identifications.sql",
  "0023_observation_identification_disputes.sql",
  "0026_observation_reassessment_requests.sql",
  "0030_observation_data_rights.sql",
  "0035_observation_record_ai_reviews.sql",
  "0043_civic_observation_contexts.sql",
  "0067_record_observation_foundation.sql",
];
const RULE_VERSION = "record-observation-gemini-batch/v2";

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const migration of MIGRATIONS) {
    db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", migration), "utf8"));
  }
  return db;
}

function addPublicTarget(
  db: DatabaseSync,
  id: string,
  options: { label?: string | null; rank?: string | null; request?: { state: string; payload: string } | null } = {},
): void {
  db.prepare(`INSERT INTO observations
    (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, processing_state, created_at)
    VALUES (?, ?, 'owner-' || ?, '2025-01-01T00:00:00Z', 'cell', 'public', 'accepted', '2025-01-01T00:00:00Z')`)
    .run(id, `draft-${id}`, id);
  db.prepare(`INSERT INTO observation_data_rights
    (visit_id, occurrence_id, record_consent, withdrawal_status)
    VALUES (?, ?, 'public_summary', 'active')`).run(id, `occ:${id}:0`);
  db.prepare(`INSERT INTO asset_ledger
    (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility,
     processing_state, created_at, uploaded_at, public_derivative_key, public_derivative_sha256,
     public_derivative_verified_at, public_derivative_metadata_json, public_ready_at, exif_scrub_state)
    VALUES (?, ?, ?, 'owner-' || ?, ?, 'source-sha', 'image/jpeg', 100, 'public', 'uploaded',
     '2025-01-02T00:00:00Z', '2025-01-02T00:00:00Z', 'public.webp', 'derivative-sha',
     '2025-01-02T00:01:00Z', '{"verified":true}', '2025-01-02T00:01:00Z', 'scrubbed')`)
    .run(`asset-${id}`, `draft-${id}`, id, id, `original/${id}`);
  if (options.label !== undefined || options.rank !== undefined) {
    db.prepare(`INSERT INTO observation_ai_review_targets
      (occurrence_id, candidate_vernacular_name, candidate_taxon_rank)
      VALUES (?, ?, ?)`).run(`occ:${id}:0`, options.label ?? null, options.rank ?? null);
  }
  if (options.request) {
    db.prepare(`INSERT INTO observation_reassessment_requests
      (request_id, observation_id, request_kind, actor_user_id, request_state, source_payload_json)
      VALUES (?, ?, 'standard', 'owner-' || ?, ?, ?)`)
      .run(`request-${id}`, id, id, options.request.state, options.request.payload);
  }
}

function select(db: DatabaseSync, limit = 100) {
  return db.prepare(OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL).all(RULE_VERSION, limit) as Array<{
    request_id: string | null;
    observation_id: string;
    owner_user_id: string;
    request_state: string | null;
    source_payload_json: string | null;
    candidate_label: string | null;
    candidate_rank: string | null;
    quality_revision: string;
    needs_reason: string;
  }>;
}

test("quality backlog reaches older public records, prioritizes coarse and ignores fine current results", () => {
  const db = database();
  addPublicTarget(db, "missing-old");
  addPublicTarget(db, "coarse-old", { label: "Bird", rank: "class" });
  addPublicTarget(db, "outdated-fine", {
    label: "A fine species", rank: "species",
    request: { state: "completed", payload: JSON.stringify({ ruleVersion: "record-observation-gemini-batch/v1" }) },
  });
  addPublicTarget(db, "fine-v2", {
    label: "A fine species", rank: "species",
    request: { state: "completed", payload: JSON.stringify({ ruleVersion: RULE_VERSION }) },
  });

  const rows = select(db);
  assert.deepEqual(rows.map((row) => row.observation_id), ["coarse-old", "missing-old", "outdated-fine"]);
  assert.equal(rows[0]?.needs_reason, "coarse_taxonomic_rank");
  assert.equal(rows[2]?.needs_reason, "outdated_ai_result");
  db.close();
});

test("bounded selection starts at the oldest stable eligible records, not the newest public-card window", () => {
  const db = database();
  for (let index = 0; index < 35; index += 1) {
    const id = `old-${String(index).padStart(2, "0")}`;
    addPublicTarget(db, id);
    db.prepare("UPDATE observations SET observed_at = ? WHERE observation_id = ?")
      .run(`2020-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`, id);
  }
  const firstWindow = select(db, 10);
  assert.equal(firstWindow.length, 10);
  assert.deepEqual(firstWindow.map((row) => row.observation_id), Array.from({ length: 10 }, (_, i) => `old-${String(i).padStart(2, "0")}`));
  assert.equal(select(db).length, 35);
  db.close();
});

test("backlog excludes private, hidden, withdrawn, unverified and human-protected records", () => {
  const db = database();
  addPublicTarget(db, "private");
  db.prepare("UPDATE observations SET visibility = 'private' WHERE observation_id = 'private'").run();
  addPublicTarget(db, "hidden");
  db.prepare("UPDATE observations SET emergency_hidden = 1 WHERE observation_id = 'hidden'").run();
  addPublicTarget(db, "withdrawn");
  db.prepare("UPDATE observation_data_rights SET withdrawal_status = 'withdrawn' WHERE visit_id = 'withdrawn'").run();
  addPublicTarget(db, "unverified");
  db.prepare("UPDATE asset_ledger SET public_derivative_verified_at = NULL WHERE observation_id = 'unverified'").run();
  addPublicTarget(db, "human-review");
  db.prepare(`INSERT INTO observation_record_ai_reviews
    (review_id, occurrence_id, actor_user_id, review_state) VALUES ('review', 'occ:human-review:0', 'human', 'agree')`).run();
  addPublicTarget(db, "human-identification");
  db.prepare(`INSERT INTO observation_identifications
    (identification_id, occurrence_id, actor_user_id, proposed_name, source_key)
    VALUES ('identification', 'occ:human-identification:0', 'human', 'Species', 'human-source')`).run();
  addPublicTarget(db, "foundation-human");
  db.prepare(`INSERT INTO record_observations
    (observation_id, record_runtime, record_id, owner_user_id, source_key, origin, assertion_status,
     subject_type, reviewed_by_actor_kind, reviewed_by_actor_id, reviewed_at)
    VALUES ('00000000-0000-4000-8000-000000000001', 'cloudflare_d1', 'foundation-human', 'owner',
     'source', 'owner', 'human_asserted', 'organism', 'owner', 'owner', CURRENT_TIMESTAMP)`).run();
  addPublicTarget(db, "foundation-accepted-claim");
  db.prepare(`INSERT INTO record_observations
    (observation_id, record_runtime, record_id, owner_user_id, source_key, origin, subject_type)
    VALUES ('00000000-0000-4000-8000-000000000002', 'cloudflare_d1', 'foundation-accepted-claim', 'owner',
     'foundation-accepted-source', 'owner', 'organism')`).run();
  db.prepare(`INSERT INTO observation_identification_claims
    (identification_id, observation_id, actor_id, actor_kind, claim_status, proposed_name, source_key,
     decided_by_actor_kind, decided_by_actor_id, decided_at)
    VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
     'human', 'owner', 'accepted', 'Species', 'accepted-source', 'owner', 'human', CURRENT_TIMESTAMP)`).run();
  addPublicTarget(db, "restricted-context");
  db.prepare(`INSERT INTO civic_observation_contexts
    (context_id, visit_id, audience_scope, public_precision, risk_lane)
    VALUES ('context', 'restricted-context', 'private', 'municipality', 'normal')`).run();

  assert.deepEqual(select(db), []);
  db.close();
});

test("queued record is revalidated against current consent, derivative, and human authority before model input", () => {
  const db = database();
  addPublicTarget(db, "revalidate", { label: "Bird", rank: "class" });
  const eligible = db.prepare(OBSERVATION_AI_QUALITY_BACKLOG_REVALIDATE_SQL);
  assert.ok(eligible.get("revalidate"));
  db.prepare("UPDATE observation_data_rights SET withdrawal_status = 'withdrawn' WHERE visit_id = 'revalidate'").run();
  assert.equal(eligible.get("revalidate"), undefined);
  db.prepare("UPDATE observation_data_rights SET withdrawal_status = 'active' WHERE visit_id = 'revalidate'").run();
  db.prepare("UPDATE asset_ledger SET public_derivative_key = NULL WHERE observation_id = 'revalidate'").run();
  assert.equal(eligible.get("revalidate"), undefined);
  db.prepare("UPDATE asset_ledger SET public_derivative_key = 'public.webp' WHERE observation_id = 'revalidate'").run();
  db.prepare(`INSERT INTO observation_record_ai_reviews
    (review_id, occurrence_id, actor_user_id, review_state) VALUES ('revalidate-review', 'occ:revalidate:0', 'human', 'agree')`).run();
  assert.equal(eligible.get("revalidate"), undefined);
  db.close();
});

test("malformed request JSON is safely eligible and one completed source revision is a no-op", () => {
  const db = database();
  addPublicTarget(db, "bad-json", {
    label: "Bird", rank: "class",
    request: { state: "completed", payload: "{" },
  });
  const [candidate] = select(db);
  assert.ok(candidate);
  assert.equal(candidate.needs_reason, "coarse_taxonomic_rank");

  const payload = buildObservationAiQualityBacklogPayload("{", candidate.needs_reason as "coarse_taxonomic_rank", candidate.quality_revision, "2026-10-11T00:00:00Z");
  const completedPayload = JSON.stringify({ ...JSON.parse(payload), ruleVersion: RULE_VERSION });
  db.prepare("UPDATE observation_reassessment_requests SET source_payload_json = ?, request_state = 'completed' WHERE request_id = ?")
    .run(completedPayload, candidate.request_id);
  db.prepare("UPDATE observation_ai_review_targets SET candidate_vernacular_name = 'Plants' WHERE occurrence_id = 'occ:bad-json:0'").run();
  assert.deepEqual(select(db), []);
  db.prepare("UPDATE asset_ledger SET public_derivative_verified_at = '2026-10-03T00:00:00Z' WHERE observation_id = 'bad-json'").run();
  const [changedRevision] = select(db);
  assert.ok(changedRevision);
  const completedAgain = buildObservationAiQualityBacklogPayload(
    JSON.stringify({ ...JSON.parse(completedPayload), qualityBacklogRevision: changedRevision.quality_revision }),
    "coarse_taxonomic_rank",
    changedRevision.quality_revision,
    "2026-10-11T00:00:00Z",
  );
  db.prepare("UPDATE observation_reassessment_requests SET source_payload_json = ? WHERE request_id = ?")
    .run(JSON.stringify({ ...JSON.parse(completedAgain), ruleVersion: RULE_VERSION }), changedRevision.request_id);
  assert.deepEqual(select(db), []);
  db.prepare(`INSERT INTO asset_ledger
    (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility,
     processing_state, created_at, uploaded_at, public_derivative_key, public_derivative_sha256,
     public_derivative_verified_at, public_derivative_metadata_json, public_ready_at, exif_scrub_state)
    VALUES ('asset-bad-json-2', 'draft-bad-json', 'bad-json', 'owner-bad-json', 'original/2',
     'source-sha-2', 'image/jpeg', 100, 'public', 'uploaded', '2025-01-02T00:00:00Z',
     '2025-01-02T00:00:00Z', 'public-2.webp', 'derivative-sha-2', '2026-10-03T00:00:00Z',
     '{"verified":true}', '2026-10-03T00:00:00Z', 'scrubbed')`).run();
  assert.equal(select(db).length, 1, "a new source photo at the same timestamp is a different revision");
  db.close();
});

test("active reservations use atomic 40-active cap and stale CAS cannot requeue", () => {
  const db = database();
  for (let index = 0; index < GEMINI_QUALITY_BACKLOG_MAX_ACTIVE - 2; index += 1) {
    db.prepare(`INSERT INTO observation_reassessment_requests
      (request_id, observation_id, request_kind, actor_user_id, request_state)
      VALUES (?, ?, 'standard', 'owner', 'pending')`).run(`active-${index}`, `record-${index}`);
  }
  const insert = db.prepare(OBSERVATION_AI_QUALITY_BACKLOG_INSERT_SQL);
  assert.equal(Number(insert.run("last-slot", "last-record", "owner", "{}", GEMINI_QUALITY_BACKLOG_MAX_ACTIVE).changes), 1);

  db.prepare(`INSERT INTO observation_reassessment_requests
    (request_id, observation_id, request_kind, actor_user_id, request_state, source_payload_json)
    VALUES ('cas', 'cas-record', 'standard', 'owner', 'completed', '{"ruleVersion":"old"}')`).run();
  const cas = db.prepare(OBSERVATION_AI_QUALITY_BACKLOG_CAS_SQL);
  assert.equal(Number(cas.run("{}", "cas", "wrong-snapshot", GEMINI_QUALITY_BACKLOG_MAX_ACTIVE).changes), 0);
  assert.equal(Number(cas.run("{}", "cas", '{"ruleVersion":"old"}', GEMINI_QUALITY_BACKLOG_MAX_ACTIVE).changes), 1);
  assert.equal(Number(insert.run("over-cap", "over-record", "owner", "{}", GEMINI_QUALITY_BACKLOG_MAX_ACTIVE).changes), 0);
  assert.equal(observationAiQualityBacklogCapacity(0), GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK);
  assert.equal(observationAiQualityBacklogCapacity(30), GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK);
  assert.equal(observationAiQualityBacklogCapacity(39), 1);
  assert.equal(observationAiQualityBacklogCapacity(40), 0);
  assert.equal(observationAiQualityBacklogCapacity(60), 0);
  db.close();
});

test("backlog payload preserves prior idempotency and human-source fields", () => {
  const payload = JSON.parse(buildObservationAiQualityBacklogPayload(
    JSON.stringify({ requestKey: "stable-key", owner: "owner", qualityBacklogRevision: "old" }),
    "outdated_ai_result",
    "[\"revision\"]",
    "2026-10-11T00:00:00Z",
  )) as Record<string, unknown>;
  assert.equal(payload.requestKey, "stable-key");
  assert.equal(payload.owner, "owner");
  assert.equal(payload.qualityBacklogVersion, GEMINI_QUALITY_BACKLOG_VERSION);
  assert.equal(payload.qualityBacklogRevision, '["revision"]');
  assert.equal(payload.attemptCount, 0);
});
