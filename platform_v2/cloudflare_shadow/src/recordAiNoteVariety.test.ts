import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import { aiNoteTextFailures, buildAiNoteEvidence, buildAiNotePrompt, focusEvidenceIds, promptEvidence } from "./recordAiNote.js";
import { generateAndStoreAiNote } from "./recordAiNoteService.js";
import { d1ReadingQuery, readRecordReading } from "./recordReading.js";

const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");
const OWNER = "owner-1";

type Prepared = { bind(...values: unknown[]): Prepared; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }>; exec(): void };
function d1(db: DatabaseSync) {
  const make = (sql: string, values: unknown[] = []): Prepared => ({
    bind: (...next) => make(sql, next),
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(values as never[])).changes) } }),
    exec: () => { db.prepare(sql).run(...(values as never[])); },
  });
  return { prepare: (sql: string) => make(sql), batch: async (statements: Prepared[]) => { statements.forEach((statement) => statement.exec()); return []; } };
}

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql", "0082_record_ai_notes.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  return db;
}

async function seedRecord(db: DatabaseSync, recordId: string, photos: Array<{ id: string; place_type: string; contact_surface: string; kinds: string[] }>) {
  photos.forEach((photo, index) => db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state, created_at)
    VALUES (?, 'd', ?, ?, ?, 'image/jpeg', 10, 'uploaded', ?)`).run(photo.id, recordId, OWNER, `k/${photo.id}`, `2026-11-25T00:00:0${index}Z`));
  const requestId = `req-${recordId}`;
  const plan = await buildObservationAiDualWritePlan({
    recordId, ownerUserId: OWNER, mediaIds: photos.map((photo) => photo.id), legacyOccurrenceId: `occ:${recordId}:0`, requestId, aiRunId: `run-${requestId}`,
    candidate: { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, nonBiological: true, coexistingSubjects: [] },
    features: photos.flatMap((photo, assetIndex) => photo.kinds.map((kind) => ({ kind, assetIndex }))),
    place: photos.map((photo, assetIndex) => ({ assetIndex, scope: "photo" as const, assessmentState: "informative" as const, fields: { place_type: photo.place_type, contact_surface: photo.contact_surface, surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" } })),
  });
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES (?, 'completed', ?)").run(requestId, `done-${requestId}`);
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, requestId, `done-${requestId}`);
    db.prepare(guarded.sql).run(...guarded.values);
  }
}

const PHOTOS = [
  { id: "p1", place_type: "water_edge", contact_surface: "water", kinds: ["water_surface", "revetment"] },
  { id: "p2", place_type: "water_edge", contact_surface: "artificial", kinds: ["pavement", "bridge"] },
  { id: "p3", place_type: "water_edge", contact_surface: "rock", kinds: ["rock", "grass_patch"] },
];

async function evidenceOf(recordId: string, db: DatabaseSync) {
  return buildAiNoteEvidence(await readRecordReading(d1ReadingQuery(d1(db) as never), recordId));
}

test("identical labels from several photos are shown to the model once, and the alias maps to the first stored id", async () => {
  const db = openDb();
  await seedRecord(db, "r-dedupe", [PHOTOS[0]!, { ...PHOTOS[1]!, place_type: "water_edge", kinds: ["water_surface"] }]);
  const evidence = await evidenceOf("r-dedupe", db);
  const waters = evidence.filter((item) => item.label.startsWith("写っているもの: 水面"));
  assert.equal(waters.length, 2);
  assert.equal(promptEvidence(evidence).filter((item) => item.label.startsWith("写っているもの: 水面")).length, 1);
  const { prompt, aliases } = buildAiNotePrompt({ evidence, inviteKind: null, recordId: "r-dedupe" });
  assert.equal(prompt.split("\n").filter((line) => /^e\d+: 写っているもの: 水面/u.test(line)).length, 1);
  assert.equal(aliases.size, promptEvidence(evidence).length);
  db.close();
});

test("the focus facts are deterministic per record, capture facts only, and different records get different focus", async () => {
  const db = openDb();
  await seedRecord(db, "r-focus-a", PHOTOS);
  await seedRecord(db, "r-focus-b", PHOTOS.map((photo) => ({ ...photo, id: `${photo.id}-b` })));
  const evidence = await evidenceOf("r-focus-a", db);
  const first = focusEvidenceIds(evidence, "r-focus-a");
  assert.deepEqual(first, focusEvidenceIds(evidence, "r-focus-a"));
  assert.equal(first.length, 2);
  const byId = new Map(evidence.map((item) => [item.id, item]));
  assert.ok(first.every((id) => byId.get(id)?.capture && byId.get(id)?.focus));
  assert.ok(evidence.filter((item) => item.label.startsWith("場所の種類") || item.label.includes("写っている範囲では見当たらない")).every((item) => !item.focus));
  const focusSets = new Set(Array.from({ length: 12 }, (_, index) => focusEvidenceIds(evidence, `record-${index}`).join("|")));
  assert.ok(focusSets.size >= 4, `focus should vary across records, got ${focusSets.size}`);
  assert.deepEqual(focusEvidenceIds(evidence, undefined), []);
  const { prompt } = buildAiNotePrompt({ evidence, inviteKind: null, recordId: "r-focus-a" });
  assert.match(prompt, /少なくとも1つを必ず使う/u);
  assert.doesNotMatch(buildAiNotePrompt({ evidence, inviteKind: null }).prompt, /少なくとも1つを必ず使う/u);
  db.close();
});

test("the owner's recent slot-1 sentences are handed to the next generation and never include the same record or another owner", async () => {
  const db = openDb();
  await seedRecord(db, "r-old", PHOTOS);
  await seedRecord(db, "r-new", PHOTOS.map((photo) => ({ ...photo, id: `${photo.id}-n` })));
  const insert = db.prepare(`INSERT INTO record_ai_notes (note_id, record_runtime, record_id, owner_user_id, slot, rule_version, generation_id, text_ja, evidence_json, invite_kind, model, status, created_at)
    VALUES (?, 'cloudflare_d1', ?, ?, 1, 'ai-note/2', 'g', ?, '[]', NULL, 'm', 'ready', ?)`);
  insert.run("00000000-0000-4000-8000-000000000001", "r-old", OWNER, "柵と舗装が写っているので、人の暮らしに近い場所だと分かります。", "2026-11-25 00:00:01");
  insert.run("00000000-0000-4000-8000-000000000002", "r-other-owner", "owner-2", "他人の文が写っているので、混ざらないことが分かります。", "2026-11-25 00:00:02");
  insert.run("00000000-0000-4000-8000-000000000003", "r-new", OWNER, "自分の記録の文が写っているので、除かれることが分かります。", "2026-11-25 00:00:03");
  const prompts: string[] = [];
  await generateAndStoreAiNote({
    db: d1(db) as never, recordId: "r-new", ownerUserId: OWNER, model: "m",
    generate: async (request) => { prompts.push(((request.contents as Array<{ parts: Array<{ text: string }> }>)[0]!.parts[0]!.text)); return JSON.stringify({ slots: [] }); },
  });
  assert.equal(prompts.length >= 1, true);
  assert.match(prompts[0]!, /直近の記録の枠1: 「柵と舗装が写っているので、人の暮らしに近い場所だと分かります。」/u);
  assert.doesNotMatch(prompts[0]!, /混ざらない|除かれる/u);
  db.close();
});

test("a first record has no recent line, and habits like 'prefers' or 'gathers' are banned from slot 1", () => {
  const { prompt } = buildAiNotePrompt({ evidence: [], inviteKind: null, recordId: "r" });
  assert.doesNotMatch(prompt, /直近の記録の枠1/u);
  assert.ok(aiNoteTextFailures(1, "草と鳥が写っているので、草地が好まれる場所だと分かります。", null).includes("narration"));
  assert.ok(aiNoteTextFailures(1, "木と鳥が写っているので、鳥が集まる場所だと分かります。", null).includes("narration"));
  assert.deepEqual(aiNoteTextFailures(1, "護岸と水面が写っているので、水際に人の手が入った場所だと分かります。", null), []);
});
