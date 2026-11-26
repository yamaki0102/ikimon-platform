import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import type { ObservationAiCandidate } from "./cloudflareObservationAi.js";
import {
  GEMINI_ENVIRONMENT_SCHEMA,
  buildGeminiEnvironmentRequest,
  parseGeminiEnvironmentEvidence,
  parseGeminiPhotoReadings,
  type GeminiMergedObservation,
  type GeminiPhotoReading,
} from "./geminiObservationBatch.js";
import { buildCardMergedObservation } from "./observationCardMode.js";
import { PLACE_SLOTS, mediaOrderMutation, readRecordReading, writeRecordMediaOrder } from "./recordReading.js";
import { recordReadingInputs, validPhotoReadings } from "./recordReadingInputs.js";

const RECORD = "record-1b";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");

function openDb(assetIds: string[]): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  assetIds.forEach((id, index) => {
    db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state, created_at)
      VALUES (?, 'draft-1', ?, 'owner-1', ?, 'image/jpeg', 10, 'uploaded', ?)`).run(id, RECORD, `key/${id}`, `2026-11-25T00:00:0${index}Z`);
  });
  return db;
}
const query = (db: DatabaseSync) => async (sql: string, values: unknown[]) => db.prepare(sql).all(...(values as Array<string | number | null>)) as Array<Record<string, unknown>>;
const noOrganism: ObservationAiCandidate = { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, nonBiological: true, coexistingSubjects: [] };

const photo = (assetIndex: number, over: Partial<GeminiPhotoReading["fields"]> = {}, kinds: GeminiPhotoReading["feature_kinds"] = [], state: GeminiPhotoReading["assessment_state"] = "informative"): GeminiPhotoReading => ({
  asset_index: assetIndex, assessment_state: state, feature_kinds: kinds,
  fields: { place_type: "unknown", contact_surface: "unknown", surrounding_cover: "unknown", environment_condition: "unknown", human_change: "unknown", ...over },
});

const mergedOf = (photos: GeminiPhotoReading[] | undefined, over: Partial<GeminiMergedObservation> = {}): GeminiMergedObservation => ({
  candidate: noOrganism, topCandidates: [], genericCandidateOnly: false, candidateFusionRuleVersion: "candidate-fusion/v1", recordClass: "environment", informationState: "informative",
  detectionState: "not_detected",
  environment: { assessment_state: "informative", fields: { place_type: "urban", contact_surface: "artificial", surrounding_cover: "built_surface", environment_condition: "sunny", human_change: "none_visible" }, cues: [], uncertain_cues: [], photos },
  relations: [], qualityFlags: [], needsReview: false, reviewReasons: [], specialistEscalation: null, summary: null, ...over,
});

let seq = 0;
async function write(db: DatabaseSync, mediaIds: string[], merged: GeminiMergedObservation, cueIndexUnknown = false) {
  const requestId = `request-${++seq}`;
  const inputs = recordReadingInputs(merged, mediaIds.length, cueIndexUnknown);
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds, legacyOccurrenceId: `occ:${RECORD}:0`, requestId, aiRunId: `run-${requestId}`, candidate: merged.candidate, ...inputs,
  });
  const payload = `completed-${requestId}`;
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES (?, 'completed', ?)").run(requestId, payload);
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, requestId, payload);
    db.prepare(guarded.sql).run(...guarded.values);
  }
}

test("3-photo record stores different place values and structures per photo, not one set for the record", async () => {
  const db = openDb(["a1", "a2", "a3"]);
  const merged = mergedOf([
    photo(0, { place_type: "water_edge", contact_surface: "water", surrounding_cover: "water", environment_condition: "flowing", human_change: "none_visible" }, ["water_surface", "revetment"]),
    photo(1, { place_type: "urban", contact_surface: "artificial", surrounding_cover: "built_surface", environment_condition: "sunny", human_change: "construction" }, ["pavement", "building", "signboard"]),
    photo(2, { place_type: "woodland", contact_surface: "leaf_litter", surrounding_cover: "trees_shrubs", environment_condition: "shaded", human_change: "trampling" }, ["tree_canopy"]),
  ]);
  await write(db, ["a1", "a2", "a3"], merged);
  const reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.recordLevel.placeRead, false);
  assert.equal(reading.media.length, 3);
  const values = reading.media.map((media) => PLACE_SLOTS.map((slot) => media.place[slot]?.code));
  assert.deepEqual(values, [
    ["water_edge", "water", "water", "flowing", "none_visible"],
    ["urban", "artificial", "built_surface", "sunny", "construction"],
    ["woodland", "leaf_litter", "trees_shrubs", "shaded", "trampling"],
  ]);
  assert.deepEqual(reading.media.map((media) => media.found.map((item) => item.code)), [["water_surface", "revetment"], ["pavement", "building", "signboard"], ["tree_canopy"]]);
  assert.equal(new Set(values.map((row) => row.join("|"))).size, 3);
  db.close();
});

test("a rerun with per-photo reading supersedes the old record-level set", async () => {
  const db = openDb(["a1", "a2"]);
  await write(db, ["a1", "a2"], mergedOf(undefined));
  let reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.recordLevel.placeRead, true);
  assert.equal(reading.media.every((media) => !media.placeRead), true);
  await write(db, ["a1", "a2"], mergedOf([photo(0, { place_type: "coast" }), photo(1, { place_type: "farmland" })]));
  reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.recordLevel.placeRead, false);
  assert.deepEqual(reading.media.map((media) => media.place.place_type?.code), ["coast", "farmland"]);
  assert.equal(reading.media[1]!.place.place_type?.labelJa, "田畑");
  db.close();
});

test("photos with a bad index, a duplicate index or no photo entries are dropped and the legacy record set is the fallback", () => {
  const valid = validPhotoReadings([photo(0), photo(0, { place_type: "coast" }), photo(5), { ...photo(1), asset_index: -1 }, photo(1)], 3);
  assert.deepEqual(valid.map((entry) => entry.asset_index), [0, 1]);
  assert.equal(valid[0]!.fields.place_type, "unknown");
  const fallback = recordReadingInputs(mergedOf([photo(9)]), 3, false);
  assert.equal(fallback.place.length, 1);
  assert.equal(fallback.place[0]!.assetIndex, undefined);
  assert.equal(fallback.place[0]!.scope, "photo_set");
  const perPhoto = recordReadingInputs(mergedOf([photo(2, { place_type: "coast" }), photo(0)]), 3, true);
  assert.deepEqual(perPhoto.place.map((entry) => [entry.assetIndex, entry.scope]), [[0, "photo"], [2, "photo"]]);
});

test("person and document records never get structure kinds from photos, and parsing keeps codes only", () => {
  const merged = mergedOf([photo(0, {}, ["signboard", "building"])], { recordClass: "document" });
  assert.deepEqual(recordReadingInputs(merged, 1, false).features, []);
  const parsed = parseGeminiPhotoReadings([
    { asset_index: 0, assessment_state: "informative", place_type: "water_edge", contact_surface: 3, feature_kinds: ["signboard", "unknown_feature", "山田商店", "building", "building"] },
    { asset_index: "1" },
    { asset_index: 1.5 },
    null,
  ]);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0]!.feature_kinds, ["signboard", "building"]);
  assert.equal(parsed[0]!.fields.contact_surface, undefined);
  assert.deepEqual(parseGeminiPhotoReadings("x"), []);
});

test("environment lane asks once for per-photo outputs with the full vocabulary and no text reading", () => {
  const request = buildGeminiEnvironmentRequest("record-x", [{ assetId: "a1", mimeType: "image/webp", base64Data: "AA" }, { assetId: "a2", mimeType: "image/webp", base64Data: "AA" }]);
  const promptText = JSON.stringify(request.contents);
  assert.match(promptText, /写真1枚ごとに1件/u);
  assert.match(promptText, /ナンバー、人の名前は読まず/u);
  const photos = (GEMINI_ENVIRONMENT_SCHEMA.properties as Record<string, { items: { properties: Record<string, { enum?: string[] }> } }>).photos!;
  assert.ok(photos.items.properties.place_type!.enum!.includes("farmland"));
  assert.ok(photos.items.properties.contact_surface!.enum!.includes("leaf_litter"));
  assert.ok(!photos.items.properties.human_change!.enum!.includes("release"));
  assert.ok(!(photos.items.properties.feature_kinds as unknown as { items: { enum: string[] } }).items.enum.includes("unknown_feature"));
  assert.equal(JSON.stringify(request).match(/inlineData/gu)?.length, 2);
  const evidence = parseGeminiEnvironmentEvidence(JSON.stringify({ assessment_state: "informative", fields: {}, cues: [], uncertain_cues: [], photos: [{ asset_index: 1, assessment_state: "informative", place_type: "coast", feature_kinds: ["rock"] }] }));
  assert.equal(evidence.photos?.[0]?.asset_index, 1);
  assert.deepEqual(parseGeminiEnvironmentEvidence("{}").photos, []);
});

test("card mode carries per-photo readings from its single identification call into the merged observation", () => {
  const merged = buildCardMergedObservation({
    main_theme: "environment", habitat_type: "河川敷", record_class: "environment", narrative: "護岸と草", observer_boost: "水際まで写っている。", area_inference: {},
    photos: [{ asset_index: 0, assessment_state: "informative", place_type: "water_edge", contact_surface: "rock", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "mowing", feature_kinds: ["revetment"] }, { asset_index: 1, place_type: "urban", feature_kinds: ["pavement"] }],
  }, [], [], null);
  assert.equal(merged.environment.photos?.length, 2);
  const inputs = recordReadingInputs(merged, 2, true);
  assert.deepEqual(inputs.place.map((entry) => entry.assetIndex), [0, 1]);
  assert.deepEqual(inputs.features, [{ kind: "revetment", assetIndex: 0 }, { kind: "pavement", assetIndex: 1 }]);
});

test("media order: owner order is stored, a taken position falls to the next free one, and replays change nothing", async () => {
  const db = openDb(["b-late", "b-mid", "b-early"]);
  const exec = {
    prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({ run: async () => db.prepare(sql).run(...(values as Array<string | number | null>)) }) }),
  };
  assert.equal(await writeRecordMediaOrder(exec, RECORD, "b-early", 0), true);
  assert.equal(await writeRecordMediaOrder(exec, RECORD, "b-mid", 1), true);
  assert.equal(await writeRecordMediaOrder(exec, RECORD, "b-late", 1), true);
  assert.equal(await writeRecordMediaOrder(exec, RECORD, "b-early", 7), true);
  const stored = db.prepare("SELECT asset_id, position FROM record_media_order ORDER BY position").all() as Array<{ asset_id: string; position: number }>;
  assert.deepEqual(stored.map((row) => [row.asset_id, row.position]), [["b-early", 0], ["b-mid", 1], ["b-late", 2]]);
  const reading = await readRecordReading(query(db), RECORD);
  assert.deepEqual(reading.media.map((media) => media.assetId), ["b-early", "b-mid", "b-late"]);
  const noPosition = mediaOrderMutation(RECORD, "x", undefined);
  assert.equal(noPosition.values[2], null);
  assert.equal(mediaOrderMutation(RECORD, "x", -1).values[2], null);
  assert.equal(mediaOrderMutation(RECORD, "x", 1.5).values[2], null);
  db.close();
});

test("media order without a position appends after the highest one, and a failing database never throws", async () => {
  const db = openDb(["c1", "c2"]);
  const exec = { prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({ run: async () => db.prepare(sql).run(...(values as Array<string | number | null>)) }) }) };
  await writeRecordMediaOrder(exec, RECORD, "c2", 4);
  await writeRecordMediaOrder(exec, RECORD, "c1");
  assert.deepEqual((db.prepare("SELECT asset_id, position FROM record_media_order ORDER BY position").all() as Array<{ asset_id: string; position: number }>).map((row) => [row.asset_id, row.position]), [["c2", 4], ["c1", 5]]);
  const failing = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error("no such table: record_media_order"); } }) }) };
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try { assert.equal(await writeRecordMediaOrder(failing, RECORD, "c1", 0), false); } finally { console.warn = originalWarn; }
  db.close();
});

test("the post pages send each photo's position and the server stores it before the AI job is dispatched", () => {
  const indexSource = readFileSync(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const recoverySource = readFileSync(path.join(process.cwd(), "src", "recordRecoveryHtml.ts"), "utf8");
  assert.match(indexSource, /mediaRole: index === 0 \? "primary" : "context",\s*position: index,/u);
  assert.match(recoverySource, /mediaRole: index === 0 \? "primary" : "context",\s*position: index,/u);
  const uploadStart = indexSource.indexOf("async function uploadLegacyCompatiblePhoto");
  const body = indexSource.slice(uploadStart, indexSource.indexOf("const OBSERVATION_PHOTO_EXTENSIONS", uploadStart));
  assert.ok(body.indexOf("writeRecordMediaOrder(env.OBS_DB, observationId, assetId, input.position)") > 0);
  assert.ok(body.indexOf("writeRecordMediaOrder(env.OBS_DB, observationId, assetId, input.position)") < body.indexOf("dispatchOutboxBestEffort(env, ["));
  assert.match(indexSource, /await writeRecordMediaOrder\(env\.OBS_DB, input\.observationId, assetId\);/u);
});
