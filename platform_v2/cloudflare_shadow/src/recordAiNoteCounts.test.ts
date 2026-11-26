import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import { generateAndStoreAiNote, loadVisibleAiNote } from "./recordAiNoteService.js";
import { readPlaceSeasonCountFacts, type BandDeps, type BandPublicRow } from "./recordCountBand.js";

const RECORD = "record-1";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");
const src = (name: string) => readFileSync(path.join(process.cwd(), "src", name), "utf8");

type Prepared = { bind(...values: unknown[]): Prepared; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }>; exec(): void };
function d1(db: DatabaseSync) {
  const make = (sql: string, values: unknown[] = []): Prepared => ({
    bind: (...next) => make(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(values as never[])).changes) } }),
    exec: () => { db.prepare(sql).run(...(values as never[])); },
  });
  return { prepare: (sql: string) => make(sql), batch: async (statements: Prepared[]) => { statements.forEach((statement) => statement.exec()); return []; } };
}

async function openSeeded(): Promise<DatabaseSync> {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql", "0082_record_ai_notes.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, duration_ms, processing_state, created_at)
    VALUES ('a1', 'draft-1', ?, 'owner-1', 'key/a1', 'image/jpeg', 10, NULL, 'uploaded', '2026-11-25T00:00:00Z')`).run(RECORD);
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds: ["a1"], legacyOccurrenceId: `occ:${RECORD}:0`, requestId: "request-1", aiRunId: "run-1",
    candidate: { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, nonBiological: true, coexistingSubjects: [] },
    features: [{ kind: "water_surface" }, { kind: "fence" }],
    place: [{ fields: { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" }, assessmentState: "informative", scope: "photo" }],
  });
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES ('request-1', 'completed', 'done')").run();
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, "request-1", "done");
    db.prepare(guarded.sql).run(...guarded.values);
  }
  return db;
}

const COUNT_LABEL = "この場所とこの季節の確認済み記録";
const countFact = (count: number) => ({ id: "count:place-season", label: COUNT_LABEL, count });
const S1 = "水面と柵が写っているので、水際に人の手が入った場所だと分かります。";

function model(slot2: string) {
  const prompts: string[] = [];
  const generate = async (request: Record<string, unknown>) => {
    const prompt = ((request.contents as Array<{ parts: Array<{ text: string }> }>)[0]!.parts[0]!.text);
    prompts.push(prompt);
    const alias = (label: string) => prompt.split("\n").find((line) => /^e\d+: /u.test(line) && line.includes(label))!.split(":")[0]!;
    return JSON.stringify({ slots: [
      { slot: 1, text: S1, evidence: [alias("水面"), alias("柵")], invite_kind: "none" },
      { slot: 2, text: slot2, evidence: [alias(COUNT_LABEL)], invite_kind: "none" },
    ] });
  };
  return { generate, prompts };
}
const run = async (db: DatabaseSync, slot2: string, count: number) => {
  const fake = model(slot2);
  const result = await generateAndStoreAiNote({ db: d1(db) as never, recordId: RECORD, ownerUserId: "owner-1", model: "m", counts: [countFact(count)], generate: fake.generate });
  return { result, fake };
};

test("with 6 confirmed records the frequency sentence is stored for slot 2 and cites the count", async () => {
  const db = await openSeeded();
  const { result, fake } = await run(db, "この場所の秋の確認済みの記録は6件で、よく見られます。", 6);
  assert.ok(result.stored.includes(2), JSON.stringify(result.dropped));
  const row = db.prepare("SELECT evidence_json FROM record_ai_notes WHERE slot = 2").get() as { evidence_json: string };
  assert.ok((JSON.parse(row.evidence_json) as Array<{ id: string }>).some((ref) => ref.id === "count:place-season"));
  assert.match(fake.prompts[0]!, /e\d+: この場所とこの季節の確認済み記録: 6件/u);
  assert.match(fake.prompts[0]!, /頻度の言い方は、件数の根拠が5件以上の時だけ/u);
  db.close();
});

test("with 4 confirmed records a frequency sentence is dropped and the plain count sentence is kept", async () => {
  const db = await openSeeded();
  const frequent = await run(db, "この場所の秋の確認済みの記録は4件で、よく見られます。", 4);
  assert.equal(frequent.result.stored.includes(2), false);
  assert.ok(frequent.result.dropped.some((entry) => entry.slot === 2 && entry.failures.includes("frequency")));
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM record_ai_notes WHERE slot = 2").get() as { n: number }).n, 0);
  const plain = await run(db, "この場所の秋の確認済みの記録は4件あります。", 4);
  assert.ok(plain.result.stored.includes(2), JSON.stringify(plain.result.dropped));
  db.close();
});

test("without any count fact a frequency sentence is never stored", async () => {
  const db = await openSeeded();
  const generate = async (request: Record<string, unknown>) => {
    const prompt = ((request.contents as Array<{ parts: Array<{ text: string }> }>)[0]!.parts[0]!.text);
    const alias = prompt.split("\n").find((line) => /^e\d+: 写っているもの: 水面/u.test(line))!.split(":")[0]!;
    return JSON.stringify({ slots: [
      { slot: 1, text: S1, evidence: [alias], invite_kind: "none" },
      { slot: 2, text: "この場所では、よく見られます。", evidence: [alias], invite_kind: "none" },
    ] });
  };
  const result = await generateAndStoreAiNote({ db: d1(db) as never, recordId: RECORD, ownerUserId: "owner-1", model: "m", generate });
  assert.equal(result.stored.includes(2), false);
  db.close();
});

test("a stored count slot stays visible only while the count is the same, and the loader runs only when a slot cites a count", async () => {
  const db = await openSeeded();
  await run(db, "この場所の秋の確認済みの記録は6件で、よく見られます。", 6);
  const calls: number[] = [];
  const load = (count: number | null) => loadVisibleAiNote(d1(db) as never, RECORD, {
    isOwner: false, protectedRecord: false,
    counts: async () => { calls.push(1); return count === null ? [] : [countFact(count)]; },
  });
  const same = await load(6);
  assert.deepEqual(same.slots.map((slot) => slot.slot), [1, 2]);
  const changed = await load(7);
  assert.deepEqual(changed.slots.map((slot) => slot.slot), [1]);
  assert.deepEqual(changed.claimedStale, [2]);
  db.prepare("DELETE FROM record_ai_notes WHERE slot = 2").run();
  calls.length = 0;
  const noCountSlot = await load(6);
  assert.deepEqual(noCountSlot.slots.map((slot) => slot.slot), [1]);
  assert.equal(calls.length, 0);
  db.close();
});

const CELL = "cell:34.71,137.73";
function bandDb() {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0001_observation_write_contract.sql", "0030_observation_data_rights.sql", "0043_civic_observation_contexts.sql", "0049_observation_detail_edit_runtime.sql", "0052_public_area_label_readmodel.sql"]) db.exec(migration(file));
  return db;
}
function put(db: DatabaseSync, id: string, day: number, visibility = "public") {
  const at = `2025-10-${String(day).padStart(2, "0")}T09:00:00+09:00`;
  db.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, visibility, emergency_hidden) VALUES (?,?,?,?,?,?,?,0)").run(id, `d-${id}`, "u", at, "アオサギ", CELL, visibility);
  db.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)").run(id, CELL, at, "アオサギ", "みなと川の土手");
}
const depsOf = (db: DatabaseSync): BandDeps => ({
  query: async (sql, values) => db.prepare(sql).all(...(values as Array<string | number | null>)) as Array<Record<string, unknown>>,
  publicRows: async () => db.prepare("SELECT observation_id, public_cell, observed_at, taxon_label, public_area_label FROM readmodel_public_observations").all() as unknown as BandPublicRow[],
  nowMs: Date.parse("2026-11-25T12:00:00+09:00"),
});

test("the count fact is the number of confirmed public records of the same place and season, and absent below 3", async () => {
  const db = bandDb();
  put(db, "r1", 1);
  put(db, "r2", 2);
  assert.deepEqual(await readPlaceSeasonCountFacts(depsOf(db), "r1"), []);
  put(db, "r3", 3);
  put(db, "r4", 4);
  put(db, "r-private", 5, "private");
  assert.deepEqual(await readPlaceSeasonCountFacts(depsOf(db), "r1"), [{ id: "count:place-season", label: COUNT_LABEL, count: 4 }]);
  assert.deepEqual(await readPlaceSeasonCountFacts(depsOf(db), "r-private"), []);
  assert.deepEqual(await readPlaceSeasonCountFacts({ ...depsOf(db), publicRows: async () => { throw new Error("boom"); } }, "r1"), []);
  db.close();
});

test("the record page and the refresh path both hand the count to the AI note", () => {
  const index = src("index.ts");
  assert.match(index, /counts: gate\.blocked \? \[\] : await readPlaceSeasonCountFacts\(recordCountBandDeps\(env\), recordId\)/u);
  assert.match(index, /counts: \(\) => readPlaceSeasonCountFacts\(recordCountBandDeps\(env\), recordId\)/u);
  assert.match(index, /handleRecordCountBandRoute\(recordCountBandDeps\(env\)/u);
});
