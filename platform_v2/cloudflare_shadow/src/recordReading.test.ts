import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseObservationAiCandidate, type ObservationAiCandidate, type ObservationAiSubjectCandidate } from "./cloudflareObservationAi.js";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import {
  FEATURE_TERMS,
  FEATURE_VOCAB_VERSION,
  PLACE_SLOTS,
  PLACE_TERMS,
  PLACE_VOCAB_VERSION,
  featureKindFromLabel,
  isFeatureKind,
  isPlaceCode,
  readRecordReading,
  type ReadingFeatureInput,
  type ReadingPlaceInput,
} from "./recordReading.js";

const RECORD = "record-1";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");

type Asset = { id: string; mime?: string; durationMs?: number | null };

function openDb(assets: Asset[]): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  assets.forEach((asset, index) => {
    db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, duration_ms, processing_state, created_at)
      VALUES (?, 'draft-1', ?, 'owner-1', ?, ?, 10, ?, 'uploaded', ?)`)
      .run(asset.id, RECORD, `key/${asset.id}`, asset.mime ?? "image/jpeg", asset.durationMs ?? null, `2026-11-25T00:00:0${index}Z`);
  });
  return db;
}

const query = (db: DatabaseSync) => async (sql: string, values: unknown[]) =>
  db.prepare(sql).all(...(values as Array<string | number | null>)) as Array<Record<string, unknown>>;

const subject = (name: string, over: Partial<ObservationAiSubjectCandidate> = {}): ObservationAiSubjectCandidate => ({
  candidateKey: name, vernacularName: name, scientificName: null, rank: "species", confidence: 0.8,
  visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, ...over,
});
const candidateOf = (primary: ObservationAiSubjectCandidate | null, others: ObservationAiSubjectCandidate[] = []): ObservationAiCandidate => primary
  ? { ...primary, nonBiological: false, coexistingSubjects: others }
  : { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, nonBiological: true, coexistingSubjects: [] };

const FIELDS = { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" };
const placeOf = (over: Partial<ReadingPlaceInput> = {}): ReadingPlaceInput => ({ fields: FIELDS, assessmentState: "informative", scope: "photo_set", ...over });

let requestSeq = 0;
async function write(db: DatabaseSync, input: {
  mediaIds: string[];
  candidate: ObservationAiCandidate;
  features?: ReadingFeatureInput[];
  place?: ReadingPlaceInput[];
  mediaMeta?: Array<{ durationMs?: number | null }>;
  requestId?: string;
}) {
  const requestId = input.requestId ?? `request-${++requestSeq}`;
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds: input.mediaIds, legacyOccurrenceId: `occ:${RECORD}:0`,
    requestId, aiRunId: `run-${requestId}`, candidate: input.candidate,
    features: input.features, place: input.place, mediaMeta: input.mediaMeta,
  });
  const payload = `completed-${requestId}`;
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES (?, 'completed', ?)").run(requestId, payload);
  const guard = `EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)`;
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, requestId, payload);
    db.prepare(guarded.sql).run(...guarded.values);
  }
  return plan;
}

const count = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { c: number }).c);
const foundSummary = (found: Array<{ kind: string; code: string | null; observationId: string | null }>) => found.map((item) => `${item.kind}:${item.code ?? item.observationId}`);

test("a photo with no organism still reads: features and the five place fields, no organism item", async () => {
  const db = openDb([{ id: "a1" }]);
  await write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [{ kind: "revetment" }, { kind: "grass_patch" }], place: [placeOf({ assetIndex: 0, scope: "photo" })] });
  const reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.analyzed, true);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_reading_items WHERE kind = 'organism'"), 0);
  const [photo] = reading.media;
  assert.deepEqual(photo!.found.map((item) => [item.kind, item.code, item.labelJa, item.state]), [
    ["feature", "revetment", "護岸", "ai_read"],
    ["feature", "grass_patch", "草むら", "ai_read"],
  ]);
  assert.equal(photo!.placeRead, true);
  assert.deepEqual(PLACE_SLOTS.map((slot) => photo!.place[slot]?.code), ["water_edge", "artificial", "low_grass", "sunny", "none_visible"]);
  assert.equal(photo!.place.place_type?.labelJa, "水辺");
  assert.equal(photo!.place.human_change?.labelJa, "写っている範囲では見当たらない");
  assert.equal(reading.recordLevel.found.length, 0);
  db.close();
});

test("the same bird in two photos is one item shown on both photos", async () => {
  const db = openDb([{ id: "a1" }, { id: "a2" }]);
  await write(db, { mediaIds: ["a1", "a2"], candidate: candidateOf(subject("コサギ", { assetIndex: 0, assetIndices: [0, 1], subjectLocator: { rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } } })), features: [], place: [placeOf()] });
  const reading = await readRecordReading(query(db), RECORD);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_observations"), 1);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_reading_items WHERE kind = 'organism'"), 1);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_observation_media WHERE active = 1"), 2);
  const [first, second] = reading.media;
  assert.equal(first!.found.length, 1);
  assert.equal(second!.found.length, 1);
  assert.equal(first!.found[0]!.itemId, second!.found[0]!.itemId);
  assert.equal(first!.found[0]!.locator.kind, "rect");
  assert.equal(second!.found[0]!.locator.kind, "full");
  assert.equal(first!.found[0]!.name?.vernacular, "コサギ");
  assert.equal(first!.found[0]!.state, "ai_read");
  assert.equal(reading.recordLevel.placeRead, true);
  assert.equal(first!.placeRead, false);
  db.close();
});

test("two different birds in one photo are two items of equal rank", async () => {
  const db = openDb([{ id: "a1" }]);
  await write(db, { mediaIds: ["a1"], candidate: candidateOf(subject("コサギ", { assetIndex: 0 }), [subject("カルガモ", { assetIndex: 0 })]), features: [{ kind: "bridge" }], place: [placeOf({ assetIndex: 0, scope: "photo" })] });
  const reading = await readRecordReading(query(db), RECORD);
  const found = reading.media[0]!.found;
  assert.equal(found.length, 3);
  assert.deepEqual(found.map((item) => item.kind), ["organism", "organism", "feature"]);
  assert.deepEqual(found.filter((item) => item.kind === "organism").map((item) => item.name?.vernacular), ["コサギ", "カルガモ"]);
  assert.equal(new Set(found.map((item) => item.itemId)).size, 3);
  assert.ok(found.every((item) => item.state === "ai_read"));
  db.close();
});

test("a feature-only video keeps the time range and the place fields of that scene", async () => {
  const db = openDb([{ id: "v1", mime: "video/mp4", durationMs: 10000 }]);
  await write(db, {
    mediaIds: ["v1"], mediaMeta: [{ durationMs: 10000 }], candidate: candidateOf(null),
    features: [
      { kind: "revetment", assetIndex: 0, timeRange: { startMs: 1000, endMs: 4000 } },
      { kind: "grass_patch", assetIndex: 0, timeRange: { startMs: 5000, endMs: 99999 } },
    ],
    place: [placeOf({ assetIndex: 0, timeRange: { startMs: 1000, endMs: 4000 }, scope: "photo" })],
  });
  const reading = await readRecordReading(query(db), RECORD);
  const video = reading.media[0]!;
  assert.equal(video.mediaKind, "video");
  assert.equal(video.durationMs, 10000);
  assert.deepEqual(video.found.map((item) => [item.code, item.locator.kind, item.locator.startMs, item.locator.endMs]), [
    ["revetment", "time_range", 1000, 4000],
    ["grass_patch", "full", undefined, undefined],
  ]);
  assert.equal(video.place.place_type?.locator.kind, "time_range");
  assert.equal(video.place.place_type?.locator.endMs, 4000);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_observations"), 0);
  db.close();
});

test("AI failure writes nothing and reads as not analyzed; a non-informative read is 'unknown', not 'unread'", async () => {
  const db = openDb([{ id: "a1" }]);
  assert.throws(() => parseObservationAiCandidate(JSON.stringify({ nonBiological: false, coexistingSubjects: [] })), /ai_candidate_name_missing/u);
  const failed = await readRecordReading(query(db), RECORD);
  assert.equal(failed.analyzed, false);
  assert.equal(failed.media[0]!.placeRead, false);
  assert.deepEqual(failed.media[0]!.found, []);
  assert.equal(failed.media[0]!.place.place_type, null);

  await write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [], place: [placeOf({ assessmentState: "not_informative", assetIndex: 0, scope: "photo" })] });
  const unknown = await readRecordReading(query(db), RECORD);
  assert.equal(unknown.analyzed, true);
  assert.equal(unknown.media[0]!.placeRead, true);
  assert.deepEqual(PLACE_SLOTS.map((slot) => unknown.media[0]!.place[slot]?.code), ["unknown", "unknown", "unknown", "unknown", "unknown"]);
  assert.equal(unknown.media[0]!.place.place_type?.labelJa, "分からない");
  const reason = db.prepare("SELECT DISTINCT reason_code FROM record_reading_revisions").all() as Array<{ reason_code: string }>;
  assert.deepEqual(reason.map((row) => row.reason_code), ["environment_not_informative"]);
  db.close();
});

test("an unresolvable photo index is never attached to the first photo, also on rerun", async () => {
  const db = openDb([{ id: "a1" }, { id: "a2" }]);
  await write(db, { mediaIds: ["a1", "a2"], candidate: candidateOf(subject("コサギ", { assetIndex: 7 }), [subject("カルガモ")]), features: [{ kind: "bridge", assetIndex: 9 }], place: [placeOf()] });
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_observations"), 2);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_observation_media"), 0);
  let reading = await readRecordReading(query(db), RECORD);
  assert.deepEqual(reading.media.map((media) => media.found.length), [0, 0]);
  assert.equal(reading.recordLevel.found.length, 3);
  assert.equal(reading.media.every((media) => !media.placeRead), true);

  const single = openDb([{ id: "only" }]);
  await write(single, { mediaIds: ["only"], candidate: candidateOf(subject("コサギ")), features: [], place: [placeOf()] });
  assert.equal(count(single, "SELECT COUNT(*) AS c FROM record_observation_media WHERE media_id = 'only'"), 1);
  single.close();

  const rerun = openDb([{ id: "a1" }, { id: "a2" }]);
  await write(rerun, { mediaIds: ["a1", "a2"], candidate: candidateOf(subject("コサギ", { assetIndex: 0 })), features: [], place: [placeOf()] });
  assert.deepEqual((await readRecordReading(query(rerun), RECORD)).media.map((media) => media.found.length), [1, 0]);
  await write(rerun, { mediaIds: ["a1", "a2"], candidate: candidateOf(subject("コサギ", { assetIndex: 1 })), features: [], place: [placeOf()] });
  reading = await readRecordReading(query(rerun), RECORD);
  assert.deepEqual(reading.media.map((media) => media.found.length), [0, 1]);
  assert.equal(count(rerun, "SELECT COUNT(*) AS c FROM record_observation_media WHERE active = 1"), 1);
  rerun.close();
  db.close();
});

test("vocabulary: migration seed equals code constants, and unknown codes are rejected or normalized", async () => {
  const db = openDb([{ id: "a1" }]);
  const seeded = new Set((db.prepare("SELECT vocab_version, slot, code, label_ja FROM record_vocabulary_terms").all() as Array<Record<string, string>>)
    .map((row) => `${row.vocab_version}|${row.slot}|${row.code}|${row.label_ja}`));
  const expected = new Set<string>();
  for (const slot of PLACE_SLOTS) for (const [code, label] of PLACE_TERMS[slot]) expected.add(`${PLACE_VOCAB_VERSION}|${slot}|${code}|${label}`);
  for (const [code, label] of FEATURE_TERMS) expected.add(`${FEATURE_VOCAB_VERSION}|feature_kind|${code}|${label}`);
  assert.deepEqual([...seeded].sort(), [...expected].sort());
  assert.equal(expected.size, 54);
  db.exec(migration("0081_record_reading_items.sql"));
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_vocabulary_terms"), 54);

  assert.equal(isPlaceCode("human_change", "none_visible"), true);
  assert.equal(isPlaceCode("human_change", "release"), false);
  assert.equal(isPlaceCode("place_type", "none_visible"), false);
  assert.equal(isFeatureKind("revetment"), true);
  assert.equal(isFeatureKind("shrine"), false);
  await assert.rejects(write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [{ kind: "shrine" }] }), /record_reading_invalid_feature_kind/u);

  await write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [], place: [placeOf({ assetIndex: 0, fields: { ...FIELDS, human_change: "release", place_type: "volcano" }, scope: "photo" })] });
  const reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.media[0]!.place.human_change?.code, "unknown");
  assert.equal(reading.media[0]!.place.place_type?.code, "unknown");
  const source = db.prepare("SELECT json_extract(value_json, '$.sourceValue') AS v FROM record_reading_revisions WHERE slot = 'human_change'").get() as { v: string };
  assert.equal(source.v, "release");

  const item = db.prepare("SELECT item_id FROM record_reading_items LIMIT 1").get() as { item_id: string };
  const insertRevision = (id: string, version: string, slot: string, code: string) =>
    db.prepare(`INSERT INTO record_reading_revisions (revision_id, item_id, seq, action, actor_kind, vocab_version, slot, value_code, request_id)
      VALUES (?, ?, 99, 'read', 'ai', ?, ?, ?, ?)`).run(id, item.item_id, version, slot, code, id);
  assert.throws(() => insertRevision("11111111-1111-8111-8111-111111111111", PLACE_VOCAB_VERSION, "place_type", "volcano"), /FOREIGN KEY/u);
  assert.throws(() => insertRevision("22222222-2222-8222-8222-222222222222", PLACE_VOCAB_VERSION, "human_change", "release"), /FOREIGN KEY/u);
  assert.throws(() => insertRevision("33333333-3333-8333-8333-333333333333", "place-state/9", "place_type", "urban"), /FOREIGN KEY/u);
  db.close();
});

test("signboard text, plates and people are never stored: labels map to kind codes only", async () => {
  assert.equal(featureKindFromLabel("山田さんの表札", true), "signboard");
  assert.equal(featureKindFromLabel("車のナンバープレート", true), null);
  assert.equal(featureKindFromLabel("人", true), null);
  assert.equal(featureKindFromLabel("人工物", true), "artifact");
  assert.equal(featureKindFromLabel("コンクリート護岸", false), "revetment");
  assert.equal(featureKindFromLabel("よく分からない何か", false), null);
  assert.equal(featureKindFromLabel("よく分からない何か", true), "unknown_feature");

  const db = openDb([{ id: "a1" }]);
  await write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [{ kind: featureKindFromLabel("山田さんの表札", true)! }], place: [placeOf()] });
  const dump = JSON.stringify([
    db.prepare("SELECT * FROM record_reading_items").all(),
    db.prepare("SELECT * FROM record_reading_revisions").all(),
  ]);
  assert.equal(dump.includes("山田"), false);
  assert.match(dump, /signboard/u);
  db.close();
});

test("state is computed from revisions: ai_read, proposed, confirmed, and removal", async () => {
  const db = openDb([{ id: "a1" }]);
  await write(db, { mediaIds: ["a1"], candidate: candidateOf(null), features: [{ kind: "revetment" }], place: [placeOf({ assetIndex: 0, scope: "photo" })] });
  const feature = db.prepare("SELECT item_id FROM record_reading_items WHERE kind = 'feature'").get() as { item_id: string };
  const placeItem = db.prepare("SELECT item_id FROM record_reading_items WHERE slot = 'place_type'").get() as { item_id: string };
  let seq = 10;
  const add = (itemId: string, action: string, actorKind: string, actorId: string, vocab: string, slot: string, code: string | null) => {
    seq += 1;
    db.prepare(`INSERT INTO record_reading_revisions (revision_id, item_id, seq, action, actor_kind, actor_id, vocab_version, slot, value_code, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`00000000-0000-8000-8000-${String(seq).padStart(12, "0")}`, itemId, seq, action, actorKind, actorId, vocab, slot, code, `req-${seq}`);
  };
  const stateOf = async () => {
    const media = (await readRecordReading(query(db), RECORD)).media[0]!;
    return { feature: media.found.find((item) => item.kind === "feature") ?? null, place: media.place.place_type };
  };
  assert.equal((await stateOf()).feature?.state, "ai_read");

  add(feature.item_id, "propose", "community", "user-a", FEATURE_VOCAB_VERSION, "feature_kind", "bridge");
  let now = await stateOf();
  assert.deepEqual([now.feature?.state, now.feature?.code], ["proposed", "bridge"]);

  add(feature.item_id, "agree", "community", "user-b", FEATURE_VOCAB_VERSION, "feature_kind", "bridge");
  now = await stateOf();
  assert.deepEqual([now.feature?.state, now.feature?.code], ["confirmed", "bridge"]);

  add(feature.item_id, "object", "community", "user-c", FEATURE_VOCAB_VERSION, "feature_kind", null);
  now = await stateOf();
  assert.equal(now.feature?.state, "proposed");

  add(placeItem.item_id, "propose", "community", "user-a", PLACE_VOCAB_VERSION, "place_type", "wetland");
  assert.deepEqual([(await stateOf()).place?.state, (await stateOf()).place?.code], ["proposed", "wetland"]);
  add(placeItem.item_id, "set", "owner", "owner-1", PLACE_VOCAB_VERSION, "place_type", "coast");
  assert.deepEqual([(await stateOf()).place?.state, (await stateOf()).place?.code, (await stateOf()).place?.actorKind], ["confirmed", "coast", "owner"]);

  add(feature.item_id, "remove", "owner", "owner-1", FEATURE_VOCAB_VERSION, "feature_kind", null);
  assert.equal((await stateOf()).feature, null);
  db.close();
});

test("replay is idempotent; a new run appends a revision and supersedes dropped AI features but not human-touched ones", async () => {
  const db = openDb([{ id: "a1" }]);
  const input = { mediaIds: ["a1"], candidate: candidateOf(subject("コサギ", { assetIndex: 0 })), features: [{ kind: "revetment" }, { kind: "bridge" }, { kind: "fence" }], place: [placeOf({ assetIndex: 0, scope: "photo" })], requestId: "request-fixed" };
  await write(db, input);
  await write(db, input);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_reading_items"), 1 + 3 + 5);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_reading_revisions"), 1 + 3 + 5);

  const fence = db.prepare("SELECT item_id FROM record_reading_items WHERE source_key LIKE '%:fence:%'").get() as { item_id: string };
  db.prepare(`INSERT INTO record_reading_revisions (revision_id, item_id, seq, action, actor_kind, actor_id, vocab_version, slot, value_code, request_id)
    VALUES ('44444444-4444-8444-8444-444444444444', ?, 2, 'agree', 'owner', 'owner-1', ?, 'feature_kind', 'fence', 'owner-agree')`).run(fence.item_id, FEATURE_VOCAB_VERSION);

  await write(db, { ...input, features: [{ kind: "revetment" }], requestId: "request-second" });
  const reading = await readRecordReading(query(db), RECORD);
  assert.deepEqual(foundSummary(reading.media[0]!.found).filter((entry) => entry.startsWith("feature")), ["feature:revetment", "feature:fence"]);
  assert.equal(count(db, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE seq = 2 AND actor_kind = 'ai'"), 1 + 1 + 5);
  assert.equal(reading.media[0]!.found.find((item) => item.code === "fence")?.state, "confirmed");
  db.close();
});
