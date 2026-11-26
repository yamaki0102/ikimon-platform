import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import type { ObservationAiCandidate } from "./cloudflareObservationAi.js";
import { recordReadingInputs } from "./recordReadingInputs.js";
import { readRecordReading } from "./recordReading.js";
import {
  VIDEO_READ_MAX_BYTES,
  VIDEO_READ_MAX_VIDEOS,
  VIDEO_SCENES_SCHEMA,
  buildVideoSceneRequest,
  candidateWithVideoSubjects,
  mergedFromVideoReadings,
  parseVideoScenes,
  readVideos,
  videoReadEligibility,
  videoReadingInputs,
  type VideoAssetSource,
} from "./recordVideoReading.js";

const RECORD = "record-video";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");
const src = (name: string) => readFileSync(path.join(process.cwd(), "src", name), "utf8");
const noOrganism: ObservationAiCandidate = { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, nonBiological: true, coexistingSubjects: [] };

function openDb(assets: Array<{ id: string; mime: string; durationMs?: number | null }>): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  assets.forEach((asset, index) => {
    db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, duration_ms, processing_state, created_at)
      VALUES (?, 'draft-1', ?, 'owner-1', ?, ?, 10, ?, 'uploaded', ?)`).run(asset.id, RECORD, `key/${asset.id}`, asset.mime, asset.durationMs ?? null, `2026-11-25T00:00:0${index}Z`);
  });
  return db;
}
const query = (db: DatabaseSync) => async (sql: string, values: unknown[]) => db.prepare(sql).all(...(values as Array<string | number | null>)) as Array<Record<string, unknown>>;

const scene = (start: number, end: number, over: Record<string, unknown> = {}) => ({
  start_sec: start, end_sec: end, assessment_state: "informative",
  place_type: "unknown", contact_surface: "unknown", surrounding_cover: "unknown", environment_condition: "unknown", human_change: "unknown",
  feature_kinds: [], organisms: [], ...over,
});
const scenesText = (...scenes: Array<ReturnType<typeof scene>>) => JSON.stringify({ scenes });

test("eligibility: size, length and count limits are stated as exact skip reasons", () => {
  const row = (over: Partial<{ bytes: number | null; duration_ms: number | null }> = {}) => ({ asset_id: "v", mime: "video/mp4", bytes: 1000, duration_ms: 10_000, ...over });
  assert.deepEqual(videoReadEligibility(row(), 0), { eligible: true });
  assert.deepEqual(videoReadEligibility(row({ bytes: VIDEO_READ_MAX_BYTES + 1 }), 0), { eligible: false, reason: "too_large" });
  assert.deepEqual(videoReadEligibility(row({ bytes: null }), 0), { eligible: false, reason: "unknown_size" });
  assert.deepEqual(videoReadEligibility(row({ duration_ms: 61_000 }), 0), { eligible: false, reason: "too_long" });
  assert.deepEqual(videoReadEligibility(row({ duration_ms: null }), 0), { eligible: true });
  assert.deepEqual(videoReadEligibility(row(), VIDEO_READ_MAX_VIDEOS), { eligible: false, reason: "over_limit" });
});

test("scene parsing keeps [start,end) in whole milliseconds and drops anything outside the video", () => {
  const text = scenesText(
    scene(0, 2.5, { place_type: "water_edge", feature_kinds: ["water_surface"] }),
    scene(2.5, 9.9, { place_type: "woodland", feature_kinds: ["tree_canopy"] }),
    scene(8, 20, { place_type: "urban" }),
    scene(5, 5.2, { place_type: "urban" }),
    scene(4, 3, { place_type: "urban" }),
    scene(0, 2.5, { place_type: "coast" }),
    scene(10, 10.3, { place_type: "urban" }),
  );
  const scenes = parseVideoScenes(text, 10_000);
  assert.deepEqual(scenes.map((item) => [item.range.startMs, item.range.endMs]), [[0, 2500], [2500, 9900]]);
  assert.equal(scenes[0]!.fields.place_type, "water_edge");
  assert.deepEqual(scenes[1]!.featureKinds, ["tree_canopy"]);
  assert.deepEqual(parseVideoScenes("not json", 10_000), []);
  assert.deepEqual(parseVideoScenes(JSON.stringify({ scenes: [scene(0, 1)] }), 10_000).map((item) => item.range.endMs), [1000]);
  const slightlyOver = parseVideoScenes(scenesText(scene(8, 10.4)), 10_000);
  assert.deepEqual(slightlyOver.map((item) => [item.range.startMs, item.range.endMs]), [[8000, 10_000]]);
});

test("people are never kept as found organisms, and the request asks for names, not speech", () => {
  const scenes = parseVideoScenes(scenesText(scene(0, 3, { organisms: [
    { name: "ヒト", scientific_name: "Homo sapiens", rank: "species", confidence: 0.9 },
    { name: "アオサギ", scientific_name: "Ardea cinerea", rank: "species", confidence: 0.8 },
  ] })), 10_000);
  assert.deepEqual(scenes[0]!.organisms.map((organism) => organism.name), ["アオサギ"]);
  const request = buildVideoSceneRequest("r", { assetId: "v", mimeType: "video/mp4", base64Data: "AAAA" }, 10_000);
  const prompt = (request.contents[0]!.parts[1] as { text: string }).text;
  assert.match(prompt, /人・声・音声の内容は書かず/u);
  assert.match(prompt, /看板|表札|ナンバー/u);
  assert.equal(request.generationConfig.responseJsonSchema, VIDEO_SCENES_SCHEMA);
  assert.deepEqual((VIDEO_SCENES_SCHEMA.properties.scenes.items.required as readonly string[]).slice(0, 3), ["start_sec", "end_sec", "assessment_state"]);
});

const row = (id: string, over: Partial<VideoAssetSource> = {}): VideoAssetSource => ({ asset_id: id, object_key: `key/${id}`, mime: "video/mp4", bytes: 1000, duration_ms: 10_000, ...over });
const deps = (generate: (request: Record<string, unknown>) => Promise<string>, bytes: ArrayBuffer | null = new ArrayBuffer(8)) => ({ fetchBytes: async () => bytes, toBase64: () => "AAAA", generate });

test("coverage says exactly which videos were read and why others were skipped, and a failure never throws", async () => {
  const good = scenesText(scene(0, 4, { place_type: "water_edge" }), scene(4, 9, { place_type: "woodland" }));
  const calls: string[] = [];
  const result = await readVideos(RECORD, [
    row("v1"),
    row("v2", { bytes: VIDEO_READ_MAX_BYTES + 1 }),
    row("v3", { duration_ms: 90_000 }),
  ], deps(async () => { calls.push("call"); return good; }));
  assert.deepEqual(result.coverage, [
    { assetId: "v1", state: "read", scenes: 2 },
    { assetId: "v2", state: "skipped", reason: "too_large" },
    { assetId: "v3", state: "skipped", reason: "over_limit" },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(result.readings.length, 1);
  const failing = await readVideos(RECORD, [row("v1"), row("v2")], deps(async () => { throw new Error("boom"); }));
  assert.deepEqual(failing.coverage.map((item) => item.state === "skipped" && item.reason), ["read_failed", "read_failed"]);
  assert.equal(failing.readings.length, 0);
  assert.deepEqual((await readVideos(RECORD, [row("v1")], deps(async () => good, null))).coverage, [{ assetId: "v1", state: "skipped", reason: "object_missing" }]);
  assert.deepEqual((await readVideos(RECORD, [row("v1")], deps(async () => "{}"))).coverage, [{ assetId: "v1", state: "skipped", reason: "read_failed" }]);
});

async function apply(db: DatabaseSync, plan: Awaited<ReturnType<typeof buildObservationAiDualWritePlan>>, requestId: string) {
  const payload = `completed-${requestId}`;
  db.prepare("INSERT OR REPLACE INTO observation_reassessment_requests VALUES (?, 'completed', ?)").run(requestId, payload);
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, requestId, payload);
    db.prepare(guarded.sql).run(...guarded.values);
  }
}

test("a photo plus a video: each scene is stored on the video with its own time range and its own values, photos stay separate", async () => {
  const db = openDb([{ id: "p1", mime: "image/jpeg" }, { id: "v1", mime: "video/mp4", durationMs: 10_000 }]);
  const readings = [{ assetId: "v1", durationMs: 10_000, scenes: parseVideoScenes(scenesText(
    scene(0, 4, { place_type: "water_edge", contact_surface: "water", surrounding_cover: "water", environment_condition: "flowing", feature_kinds: ["water_surface", "revetment"] }),
    scene(4, 9.5, { place_type: "woodland", contact_surface: "soil", surrounding_cover: "trees_shrubs", environment_condition: "shaded", feature_kinds: ["tree_canopy"],
      organisms: [{ name: "アオサギ", scientific_name: "Ardea cinerea", rank: "species", confidence: 0.95 }] }),
  ), 10_000) }];
  const video = videoReadingInputs(readings, ["p1"]);
  assert.deepEqual(video.mediaIds, ["v1"]);
  assert.equal(video.subjects.length, 1);
  assert.ok(video.subjects[0]!.confidence <= 0.6);
  const photoPlace = [{ assetIndex: 0, scope: "photo" as const, assessmentState: "informative" as const, fields: { place_type: "urban", contact_surface: "artificial", surrounding_cover: "built_surface", environment_condition: "sunny", human_change: "none_visible" } }];
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds: ["p1", ...video.mediaIds], mediaMeta: [{ durationMs: null }, ...video.mediaMeta],
    legacyOccurrenceId: `occ:${RECORD}:0`, requestId: "req-1", aiRunId: "run-1",
    candidate: candidateWithVideoSubjects(noOrganism, video.subjects),
    features: [{ kind: "pavement", assetIndex: 0 }, ...video.features], place: [...photoPlace, ...video.place],
  });
  await apply(db, plan, "req-1");
  const items = db.prepare("SELECT kind, slot, anchor_asset_id, anchor_locator_key, anchor_locator_json FROM record_reading_items WHERE kind <> 'organism' ORDER BY anchor_asset_id, anchor_locator_key, slot, item_id").all() as Array<Record<string, string | null>>;
  const videoKeys = [...new Set(items.filter((item) => item.anchor_asset_id === "v1").map((item) => item.anchor_locator_key))].sort();
  assert.deepEqual(videoKeys, ["t:0-4000", "t:4000-9500"]);
  assert.equal(items.some((item) => item.anchor_asset_id === "p1" && item.anchor_locator_key !== "full"), false);
  const sceneOne = items.find((item) => item.anchor_locator_key === "t:0-4000")!;
  assert.deepEqual(JSON.parse(sceneOne.anchor_locator_json!), { startMs: 0, endMs: 4000 });
  const reading = await readRecordReading(query(db), RECORD);
  const videoMedia = reading.media.find((entry) => entry.assetId === "v1")!;
  assert.equal(videoMedia.mediaKind, "video");
  assert.deepEqual(videoMedia.found.filter((item) => item.kind === "feature").map((item) => [item.code, item.locator.kind, item.locator.startMs, item.locator.endMs]).sort(), [
    ["revetment", "time_range", 0, 4000], ["tree_canopy", "time_range", 4000, 9500], ["water_surface", "time_range", 0, 4000],
  ]);
  const organism = db.prepare("SELECT locator_kind, locator_json FROM record_observation_media WHERE media_id = 'v1'").all() as Array<{ locator_kind: string; locator_json: string }>;
  assert.equal(organism.length, 1);
  assert.deepEqual(JSON.parse(organism[0]!.locator_json), { startMs: 4000, endMs: 9500 });
  const photoMedia = reading.media.find((entry) => entry.assetId === "p1")!;
  assert.equal(photoMedia.place.place_type?.code, "urban");
  db.close();
});

test("a video-only record is read into scenes without any photo and says it was video-only", async () => {
  const db = openDb([{ id: "v1", mime: "video/mp4", durationMs: 8000 }]);
  const readings = [{ assetId: "v1", durationMs: 8000, scenes: parseVideoScenes(scenesText(
    scene(0, 3, { place_type: "grassland_urban_edge", contact_surface: "plant", surrounding_cover: "low_grass", feature_kinds: ["grass_patch"] }),
    scene(3, 8, { place_type: "water_edge", contact_surface: "water", feature_kinds: ["water_surface"] }),
  ), 8000) }];
  const merged = mergedFromVideoReadings(readings);
  assert.deepEqual(merged.qualityFlags, ["video_only"]);
  assert.equal(merged.recordClass, "environment");
  assert.equal(merged.candidate.nonBiological, true);
  const video = videoReadingInputs(readings, []);
  const plan = await buildObservationAiDualWritePlan({
    recordId: RECORD, ownerUserId: "owner-1", mediaIds: video.mediaIds, mediaMeta: video.mediaMeta, legacyOccurrenceId: `occ:${RECORD}:0`, requestId: "req-v", aiRunId: "run-v",
    candidate: merged.candidate, features: video.features, place: video.place,
  });
  await apply(db, plan, "req-v");
  const reading = await readRecordReading(query(db), RECORD);
  assert.equal(reading.analyzed, true);
  assert.equal(reading.media.length, 1);
  assert.equal(reading.media[0]!.mediaKind, "video");
  assert.ok(reading.media[0]!.found.length >= 2);
  assert.equal(reading.media[0]!.placeRead, true);
  const slots = db.prepare("SELECT anchor_locator_key, slot FROM record_reading_items WHERE kind = 'place_field' AND status = 'active' ORDER BY anchor_locator_key, slot").all() as Array<{ anchor_locator_key: string; slot: string }>;
  assert.deepEqual([...new Set(slots.map((item) => item.anchor_locator_key))], ["t:0-3000", "t:3000-8000"]);
  db.close();
});

test("video organisms: capped confidence, one candidate per name, and never a duplicate of the photo candidate", () => {
  const readings = [{ assetId: "v1", durationMs: 10_000, scenes: parseVideoScenes(scenesText(
    scene(0, 2, { organisms: [{ name: "アオサギ", scientific_name: "Ardea cinerea", rank: "species", confidence: 0.99 }, { name: "カルガモ", scientific_name: "Anas zonorhyncha", rank: "species", confidence: 0.7 }] }),
    scene(2, 8, { organisms: [{ name: "アオサギ", scientific_name: "Ardea cinerea", rank: "species", confidence: 0.9 }] }),
  ), 10_000) }];
  const all = videoReadingInputs(readings, ["p1"]).subjects;
  assert.deepEqual(all.map((subject) => subject.vernacularName).sort(), ["アオサギ", "カルガモ"]);
  assert.ok(all.every((subject) => subject.confidence <= 0.6 && subject.assetIndex === 1));
  const heron = all.find((subject) => subject.vernacularName === "アオサギ")!;
  assert.deepEqual(heron.subjectLocator, { timeRange: { startMs: 2000, endMs: 8000 } });
  const withPhoto = videoReadingInputs(readings, ["p1"], [{ candidateKey: "p", vernacularName: "アオサギ", scientificName: null, rank: "species", confidence: 0.9, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {} }]).subjects;
  assert.deepEqual(withPhoto.map((subject) => subject.vernacularName), ["カルガモ"]);
});

test("wiring: only the interactive card and direct paths accept video-only, coverage is recorded, photo reading is not replaced", () => {
  const index = src("index.ts");
  assert.equal((index.match(/loadPreparedGeminiObservation\(request, env, \{ allowVideoOnly: true \}\)/gu) ?? []).length, 2);
  assert.match(index, /if \(prepared\.videoOnly\) \{\s*await finalizeVideoOnlyReassessment\(prepared, env\);\s*return;\s*\}/u);
  assert.match(index, /videoReading: prepared\.videos\.length > 0 \? \{ promptVersion: VIDEO_READ_PROMPT_VERSION, model: VIDEO_READ_MODEL, coverage: video\.coverage, videoOnly: prepared\.videoOnly \} : null/u);
  assert.match(index, /preparedVideoRead\(prepared, env\)\.catch\(\(\) => \(\{ readings: \[\], coverage: \[\] \}/u);
  assert.match(index, /place: \[\.\.\.photo\.place, \.\.\.videoInputs\.place\]/u);
  const merged = mergedFromVideoReadings([]);
  assert.equal(merged.detectionState, "not_assessable");
  const empty = recordReadingInputs(merged, 0, false);
  assert.ok(Array.isArray(empty.place));
});
