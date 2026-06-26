import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { observationPhotoUploadTargetIds } from "./observationPhotoUpload.js";

test("photo upload target ids fall back from occurrence id to visit id", () => {
  assert.deepEqual(observationPhotoUploadTargetIds("occ:record-1781909848532:0"), [
    "occ:record-1781909848532:0",
    "record-1781909848532",
  ]);
  assert.deepEqual(observationPhotoUploadTargetIds("record-1781909848532"), ["record-1781909848532"]);
  assert.deepEqual(observationPhotoUploadTargetIds(""), []);
});

test("photo upload promotes native no-photo reviews after adding evidence", () => {
  const source = readFileSync(path.join(process.cwd(), "src/services/observationPhotoUpload.ts"), "utf8");

  assert.match(source, /normalizeObservationImage/);
  assert.match(source, /canKeepPreparedJpeg/);
  assert.match(source, /ALLOWED_OBSERVATION_IMAGE_MIME_TYPES/);
  assert.match(source, /metadata\.format === "jpeg"/);
  assert.match(source, /!metadata\.orientation \|\| metadata\.orientation === 1/);
  assert.match(source, /!hasSensitiveMetadata/);
  assert.match(source, /width: 2560/);
  assert.match(source, /height: 2560/);
  assert.match(source, /fit: "inside"/);
  assert.match(source, /throw new Error\("image_normalization_failed"\)/);
  assert.doesNotMatch(source, /normalizedMime === "image\/gif"[\s\S]*return \{ buffer/);
  assert.match(source, /widthPx: normalizedImage\.widthPx/);
  assert.match(source, /heightPx: normalizedImage\.heightPx/);
  assert.match(source, /normalizeFacePrivacy/);
  assert.match(source, /face_privacy: facePrivacy/);
  assert.match(source, /"pending", "redacted", "no_faces", "unavailable"/);
  assert.match(source, /createLegacyMediaObjectStore/);
  assert.match(source, /mediaObjectStore\.write/);
  assert.match(source, /photo-originals/);
  assert.match(source, /storageBackend: originalObject\.storageBackend/);
  assert.match(source, /storageBackend: publicObject\.storageBackend/);
  assert.match(source, /observation_photo_original/);
  assert.match(source, /privacy_processing_status: "pending"/);
  assert.match(source, /original_relative_path: originalRelativePath/);
  assert.match(source, /original_storage_backend: originalObject\.storageBackend/);
  assert.match(source, /set public_visibility = case[\s\S]*else 'public'[\s\S]*end/);
  assert.match(source, /quality_review_status = case[\s\S]*else 'accepted'[\s\S]*end/);
  assert.match(source, /visit_id like 'prod-media-smoke-%'[\s\S]*then 'hidden'/);
  assert.match(source, /coalesce\(source_payload->>'source', ''\) = 'prod_media_smoke'[\s\S]*then 'archived'/);
  assert.match(source, /reason <> 'missing_photo'/);
  assert.match(source, /reason_code = 'native_no_photo'/);
  assert.match(source, /review_status = case[\s\S]*else 'accepted'[\s\S]*end/);
  assert.match(source, /enqueueMediaProcessingJobsStandalone/);
  assert.match(source, /photo_ready_reassess/);
  assert.match(source, /observationPhotoUploadTargetIds/);
  assert.match(source, /v\.visit_id = any\(\$1::text\[\]\)/);
  assert.match(source, /o\.occurrence_id = any\(\$1::text\[\]\)/);
  assert.match(source, /throw new Error\("observation_not_found"\)/);
  assert.doesNotMatch(source, /observation not found: \$\{input\.observationId\}/);

  const worker = readFileSync(path.join(process.cwd(), "cloudflare_shadow/src/index.ts"), "utf8");
  const wranglerConfig = readFileSync(path.join(process.cwd(), "cloudflare_shadow/wrangler.jsonc"), "utf8");
  assert.match(worker, /MEDIA_QUEUE/);
  assert.match(worker, /topic === "media\.process"/);
  assert.match(worker, /topic === "readmodel\.refresh"/);
  assert.match(wranglerConfig, /"binding": "MEDIA_QUEUE"/);
  assert.match(wranglerConfig, /"queue": "ikimon-prod-media-jobs"/);
});
