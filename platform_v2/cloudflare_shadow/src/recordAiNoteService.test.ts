import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { ObservationAiCandidate, ObservationAiSubjectCandidate } from "./cloudflareObservationAi.js";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import { generateAndStoreAiNote, loadVisibleAiNote, loadStoredAiNote } from "./recordAiNoteService.js";
import { FEATURE_VOCAB_VERSION } from "./recordReading.js";

const RECORD = "record-1";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");

type Prepared = { bind(...values: unknown[]): Prepared; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }>; exec(): void };
function d1(db: DatabaseSync) {
  const make = (sql: string, values: unknown[] = []): Prepared => ({
    bind: (...next) => make(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(values as never[])).changes) } }),
    exec: () => { db.prepare(sql).run(...(values as never[])); },
  });
  return {
    prepare: (sql: string) => make(sql),
    batch: async (statements: Prepared[]) => {
      db.exec("BEGIN");
      try { statements.forEach((statement) => statement.exec()); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; }
      return [];
    },
  };
}

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql", "0082_record_ai_notes.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, duration_ms, processing_state, created_at)
    VALUES ('a1', 'draft-1', ?, 'owner-1', 'key/a1', 'image/jpeg', 10, NULL, 'uploaded', '2026-11-25T00:00:00Z')`).run(RECORD);
  return db;
}

const subject = (name: string): ObservationAiSubjectCandidate => ({
  candidateKey: name, vernacularName: name, scientificName: null, rank: "species", confidence: 0.8, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, assetIndex: 0,
});
const candidate = (name: string): ObservationAiCandidate => ({ ...subject(name), nonBiological: false, coexistingSubjects: [] });

async function seed(db: DatabaseSync, requestId = "request-1") {
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds: ["a1"], legacyOccurrenceId: `occ:${RECORD}:0`, requestId, aiRunId: `run-${requestId}`,
    candidate: candidate("コサギ"), features: [{ kind: "water_surface" }, { kind: "fence" }],
    place: [{ fields: { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" }, assessmentState: "informative", scope: "photo" }],
  });
  const payload = `completed-${requestId}`;
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES (?, 'completed', ?)").run(requestId, payload);
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, requestId, payload);
    db.prepare(guarded.sql).run(...guarded.values);
  }
}

const S1 = "水面が写っているので、コサギらしい鳥が待つ場所のようすが分かります。";
const S2 = "足もとの面は人工の面のようです。";
const S3 = "次は少し離れて、場所全体も一緒に入れると、まわりの変化も残せます。";

function fakeModel(spec: Array<{ slot: 1 | 2 | 3; text: string; labels: string[]; invite?: string }>) {
  const calls: string[] = [];
  const generate = async (request: Record<string, unknown>) => {
    const prompt = ((request.contents as Array<{ parts: Array<{ text: string }> }>)[0]!.parts[0]!.text);
    calls.push(prompt);
    const aliasFor = (label: string) => {
      const line = prompt.split("\n").find((entry) => /^e\d+: /u.test(entry) && entry.includes(label));
      assert.ok(line, `no evidence line for ${label}`);
      return line!.split(":")[0]!;
    };
    return JSON.stringify({ slots: spec.map((entry) => ({ slot: entry.slot, text: entry.text, evidence: entry.labels.map(aliasFor), invite_kind: entry.invite ?? "none" })) });
  };
  return { generate, calls };
}

const GOOD = [
  { slot: 1 as const, text: S1, labels: ["水面", "コサギ"] },
  { slot: 2 as const, text: S2, labels: ["足もとの面: 人工の面"] },
  { slot: 3 as const, text: S3, labels: ["水面"], invite: "step_back_whole" },
];

test("three passing slots are stored with the ids of the stored items they rest on", async () => {
  const db = openDb();
  await seed(db);
  const result = await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: fakeModel(GOOD).generate });
  assert.deepEqual(result.stored, [1, 2, 3]);
  const rows = db.prepare("SELECT slot, text_ja, evidence_json, invite_kind, status FROM record_ai_notes ORDER BY slot").all() as Array<{ slot: number; evidence_json: string; invite_kind: string | null; status: string }>;
  assert.equal(rows.length, 3);
  const itemIds = new Set((db.prepare("SELECT item_id FROM record_reading_items").all() as Array<{ item_id: string }>).map((row) => `item:${row.item_id}`));
  for (const row of rows) {
    const refs = JSON.parse(row.evidence_json) as Array<{ id: string; fp: string }>;
    assert.ok(refs.length > 0 && refs.every((ref) => itemIds.has(ref.id) && ref.fp.length > 0));
    assert.equal(row.status, "ready");
  }
  assert.equal(rows[2]!.invite_kind, "step_back_whole");
  assert.equal(rows[0]!.invite_kind, null);
  db.close();
});

test("a slot that breaks a check is dropped and its text is never stored or shown", async () => {
  const db = openDb();
  await seed(db);
  const model = fakeModel([
    { slot: 1, text: "水面が写っていて、よく撮れています。", labels: ["水面"] },
    { slot: 2, text: S2, labels: ["足もとの面: 人工の面"] },
    { slot: 3, text: "次は少し離れて撮ってください。", labels: ["水面"], invite: "step_back_whole" },
  ]);
  const result = await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: model.generate });
  assert.deepEqual(result.stored, [2]);
  assert.deepEqual(result.dropped.map((entry) => entry.slot), [1, 3]);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM record_ai_notes WHERE text_ja LIKE '%よく撮れ%' OR text_ja LIKE '%ください%'").get() as { c: number }).c, 0);
  const shown = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: false });
  assert.deepEqual(shown.slots.map((slot) => slot.slot), [2]);
  db.close();
});

test("the owner sees the invitation and every other viewer never does", async () => {
  const db = openDb();
  await seed(db);
  await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: fakeModel(GOOD).generate });
  const owner = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: false });
  const other = await loadVisibleAiNote(d1(db), RECORD, { isOwner: false, protectedRecord: false });
  assert.deepEqual(owner.slots.map((slot) => slot.slot), [1, 2, 3]);
  assert.deepEqual(other.slots.map((slot) => slot.slot), [1, 2]);
  assert.ok(!other.slots.some((slot) => slot.text === S3));
  db.close();
});

test("correcting a stored item hides the slots that rest on it, claims one regeneration, and the rebuilt slot shows again", async () => {
  const db = openDb();
  await seed(db);
  await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: fakeModel(GOOD).generate });
  const water = db.prepare("SELECT item_id FROM record_reading_items WHERE source_key LIKE '%:water_surface:%'").get() as { item_id: string };
  db.prepare(`INSERT INTO record_reading_revisions (revision_id, item_id, seq, action, actor_kind, actor_id, vocab_version, slot, value_code, request_id)
    VALUES ('44444444-4444-8444-8444-444444444444', ?, 2, 'set', 'owner', 'owner-1', ?, 'feature_kind', 'bridge', 'owner-fix')`).run(water.item_id, FEATURE_VOCAB_VERSION);
  const first = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: false });
  assert.deepEqual(first.slots.map((slot) => slot.slot), [2]);
  assert.deepEqual(first.claimedStale, [1, 3]);
  const second = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: false });
  assert.deepEqual(second.slots.map((slot) => slot.slot), [2]);
  assert.deepEqual(second.claimedStale, []);
  const rebuilt = fakeModel([
    { slot: 1, text: "橋が写っているので、コサギらしい鳥が待つ場所のようすが分かります。", labels: ["橋", "コサギ"] },
    { slot: 2, text: S2, labels: ["足もとの面: 人工の面"] },
  ]);
  await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: rebuilt.generate });
  const after = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: false });
  assert.deepEqual(after.slots.map((slot) => slot.slot), [1, 2]);
  assert.match(after.slots[0]!.text, /^橋が写っている/);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM record_ai_notes WHERE slot = 3").get() as { c: number }).c, 0);
  db.close();
});

test("a protected record gets no model call, no stored note, and shows nothing", async () => {
  const db = openDb();
  await seed(db);
  const model = fakeModel(GOOD);
  await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: model.generate });
  const hidden = await loadVisibleAiNote(d1(db), RECORD, { isOwner: true, protectedRecord: async () => true });
  assert.deepEqual(hidden.slots, []);
  const result = await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: model.generate, protectedRecord: true });
  assert.equal(result.called, false);
  assert.equal(model.calls.length, 1);
  assert.deepEqual((await loadStoredAiNote(d1(db), RECORD)).slots, []);
  db.close();
});

test("an invitation of the same kind as the owner's last three is withheld", async () => {
  const db = openDb();
  await seed(db);
  for (const [index, id] of ["r-a", "r-b", "r-c"].entries()) {
    db.prepare(`INSERT INTO record_ai_notes (note_id, record_id, owner_user_id, slot, rule_version, generation_id, text_ja, evidence_json, invite_kind, model, created_at)
      VALUES (?, ?, 'owner-1', 3, 'ai-note/1', 'g', ?, '[]', 'step_back_whole', 'm', ?)`).run(`0000000${index}-0000-4000-8000-000000000000`, id, S3, `2026-11-2${index + 1}T00:00:00Z`);
  }
  const result = await generateAndStoreAiNote({ db: d1(db), recordId: RECORD, ownerUserId: "owner-1", model: "m", generate: fakeModel(GOOD).generate });
  assert.deepEqual(result.stored, [1, 2]);
  assert.ok(result.dropped.some((entry) => entry.slot === 3 && entry.failures.includes("invite_recent")));
  db.close();
});

test("the table rejects an invitation without a kind and a kind on a non-invitation slot", () => {
  const db = openDb();
  const insert = (slot: number, kind: string | null) => db.prepare(`INSERT INTO record_ai_notes (note_id, record_id, owner_user_id, slot, rule_version, generation_id, text_ja, evidence_json, invite_kind, model)
    VALUES (?, ?, 'o', ?, 'ai-note/1', 'g', 't', '[]', ?, 'm')`).run(`1111111${slot}-0000-4000-8000-00000000000${slot}`, `rec-${slot}-${kind}`, slot, kind);
  assert.throws(() => insert(3, null));
  assert.throws(() => insert(1, "sound"));
  insert(3, "sound");
  insert(1, null);
  db.close();
});
