import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isPromotableAudioSegment } from "./guideRecordPromotion.js";

test("guide promotion accepts only privacy-safe audio evidence", () => {
  assert.equal(isPromotableAudioSegment({
    blob_id: "blob-1",
    privacy_status: "clean",
    voice_flag: false,
    transcription_status: "pending",
    storage_path: "v2-audio/2026-05/session/chunk.webm",
  }), true);

  assert.equal(isPromotableAudioSegment({
    blob_id: "blob-1",
    privacy_status: "pending_voice_check",
    voice_flag: false,
    transcription_status: "pending",
    storage_path: "v2-audio/2026-05/session/chunk.webm",
  }), false);
  assert.equal(isPromotableAudioSegment({
    blob_id: "blob-1",
    privacy_status: "clean",
    voice_flag: true,
    transcription_status: "pending",
    storage_path: "v2-audio/2026-05/session/chunk.webm",
  }), false);
  assert.equal(isPromotableAudioSegment({
    blob_id: null,
    privacy_status: "clean",
    voice_flag: false,
    transcription_status: "pending",
    storage_path: "v2-audio/2026-05/session/chunk.webm",
  }), false);
  assert.equal(isPromotableAudioSegment({
    blob_id: "blob-1",
    privacy_status: "clean",
    voice_flag: false,
    transcription_status: "skipped",
    storage_path: "v2-audio/2026-05/session/chunk.webm",
  }), false);
});

test("guide promotion service keeps guide records as candidates until transactional promotion", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "guideRecordPromotion.ts"), "utf8");

  assert.match(source, /await client\.query\("begin"\)/);
  assert.match(source, /for update of gr/);
  assert.match(source, /row\.user_id !== input\.userId/);
  assert.match(source, /guide_record_forbidden/);
  assert.match(source, /if \(row\.occurrence_id\)/);
  assert.match(source, /existingPromotionResult/);
  assert.match(source, /guide_record_photo_required/);
  assert.match(source, /guide_record_evidence_required/);
  assert.match(source, /'observation_audio'/);
  assert.match(source, /privacy_status = 'clean'/);
  assert.match(source, /coalesce\(voice_flag, false\) = false/);
  assert.match(source, /not_used_as_observation_photo_evidence/);
  assert.match(source, /update guide_records[\s\S]*set occurrence_id = \$2/);
  assert.match(source, /await client\.query\("commit"\)/);
  assert.match(source, /await client\.query\("rollback"\)/);
});
