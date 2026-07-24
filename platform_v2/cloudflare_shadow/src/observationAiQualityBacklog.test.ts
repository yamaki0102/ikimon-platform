import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL,
  observationAiQualityBacklogCapacity,
  observationAiQualityBacklogReason,
  type ObservationAiQualityBacklogTargetRow,
} from "./observationAiQualityBacklog.js";

const currentRuleVersion = "record-observation-gemini-batch/v3";

function createBacklogFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      visibility TEXT NOT NULL,
      emergency_hidden INTEGER NOT NULL DEFAULT 0,
      observed_at TEXT NOT NULL
    );
    CREATE TABLE asset_ledger (
      observation_id TEXT NOT NULL,
      processing_state TEXT NOT NULL,
      mime TEXT NOT NULL,
      public_derivative_key TEXT,
      public_derivative_verified_at TEXT,
      exif_scrub_state TEXT NOT NULL
    );
    CREATE TABLE observation_ai_review_targets (
      occurrence_id TEXT PRIMARY KEY,
      candidate_vernacular_name TEXT,
      candidate_scientific_name TEXT,
      candidate_taxon_rank TEXT,
      ai_recommended_taxon_name TEXT,
      ai_recommended_rank TEXT,
      vernacular_name TEXT,
      scientific_name TEXT,
      taxon_rank TEXT
    );
    CREATE TABLE observation_reassessment_requests (
      request_id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      request_kind TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      request_state TEXT NOT NULL,
      source_payload_json TEXT NOT NULL,
      UNIQUE(observation_id, request_kind, actor_user_id)
    );
  `);
  return db;
}

function addObservation(
  db: DatabaseSync,
  id: string,
  options: {
    visibility?: "public" | "private";
    emergencyHidden?: number;
    photoReady?: boolean;
    observedAt?: string;
    label?: string | null;
    rank?: string | null;
    requestState?: string | null;
    ruleVersion?: string | null;
    rawPayload?: string;
  } = {},
): void {
  const owner = `owner:${id}`;
  db.prepare(
    "INSERT INTO observations VALUES (?, ?, ?, ?, ?)",
  ).run(
    id,
    owner,
    options.visibility ?? "public",
    options.emergencyHidden ?? 0,
    options.observedAt ?? "2026-06-01T00:00:00Z",
  );
  if (options.photoReady !== false) {
    db.prepare("INSERT INTO asset_ledger VALUES (?, 'uploaded', 'image/webp', ?, '2026-07-24T00:00:00Z', 'scrubbed')")
      .run(id, `derived/${id}.webp`);
  }
  if (options.label !== undefined || options.rank !== undefined) {
    db.prepare(
      `INSERT INTO observation_ai_review_targets (
         occurrence_id, candidate_vernacular_name, candidate_taxon_rank
       ) VALUES (?, ?, ?)`,
    ).run(`occ:${id}:0`, options.label ?? null, options.rank ?? null);
  }
  if (options.requestState) {
    const payload = options.rawPayload ?? JSON.stringify({ ruleVersion: options.ruleVersion });
    db.prepare(
      `INSERT INTO observation_reassessment_requests
         (request_id, observation_id, request_kind, actor_user_id, request_state, source_payload_json)
       VALUES (?, ?, 'standard', ?, ?, ?)`,
    ).run(`request:${id}`, id, owner, options.requestState, payload);
  }
}

test("quality backlog prefers coarse old results, then missing AI, and excludes current or unsafe records", () => {
  const db = createBacklogFixture();
  addObservation(db, "record-1780552463658", {
    label: "鳥類",
    rank: "class",
    requestState: "completed",
    ruleVersion: "record-observation-gemini-batch/v2",
    observedAt: "2026-06-04T00:00:00Z",
  });
  addObservation(db, "generic-malformed-json", {
    label: "鳥",
    rank: "class",
    requestState: "completed",
    rawPayload: "{broken",
    observedAt: "2026-06-03T00:00:00Z",
  });
  addObservation(db, "missing-ai", {
    observedAt: "2026-07-01T00:00:00Z",
  });
  addObservation(db, "specific-old", {
    label: "ムクドリ",
    rank: "species",
    requestState: "completed",
    ruleVersion: "record-observation-gemini-batch/v2",
  });
  addObservation(db, "generic-current", {
    label: "鳥類",
    rank: "class",
    requestState: "completed",
    ruleVersion: currentRuleVersion,
  });
  addObservation(db, "still-processing", {
    label: "鳥類",
    rank: "class",
    requestState: "processing",
    ruleVersion: "record-observation-gemini-batch/v2",
  });
  addObservation(db, "private-record", { visibility: "private" });
  addObservation(db, "no-public-photo", { photoReady: false });

  const selected = db.prepare(OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL)
    .all(currentRuleVersion, 20) as unknown as ObservationAiQualityBacklogTargetRow[];

  assert.deepEqual(
    selected.map((row) => row.observation_id),
    ["record-1780552463658", "generic-malformed-json", "missing-ai", "specific-old"],
  );
  assert.equal(selected.some((row) => row.observation_id === "generic-current"), false);
  assert.equal(selected.some((row) => row.observation_id === "still-processing"), false);
  assert.equal(selected.some((row) => row.observation_id === "private-record"), false);
  assert.equal(selected.some((row) => row.observation_id === "no-public-photo"), false);
});

test("quality backlog capacity and reasons prevent unbounded or repeated scheduling", () => {
  assert.equal(observationAiQualityBacklogCapacity(0), 10);
  assert.equal(observationAiQualityBacklogCapacity(35), 5);
  assert.equal(observationAiQualityBacklogCapacity(40), 0);
  assert.equal(observationAiQualityBacklogCapacity(99), 0);

  assert.equal(observationAiQualityBacklogReason({
    request_id: null,
    candidate_label: null,
    candidate_rank: null,
  }), "missing_reassessment_request");
  assert.equal(observationAiQualityBacklogReason({
    request_id: "request-1",
    candidate_label: "鳥類",
    candidate_rank: "class",
  }), "coarse_taxonomic_rank");
  assert.equal(observationAiQualityBacklogReason({
    request_id: "request-2",
    candidate_label: "ムクドリ",
    candidate_rank: "species",
  }), "outdated_ai_result");
});
