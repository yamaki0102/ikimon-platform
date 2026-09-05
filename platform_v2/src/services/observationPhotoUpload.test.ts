import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY,
  KUBIAKA_PRIVATE_PHOTO_MAX_COUNT,
  assertKubiakaPrivatePhotoCapacity,
  isKubiakaPrivatePhotoSourcePayload,
  observationPhotoUploadTargetIds,
} from "./observationPhotoUpload.js";

const source = readFileSync(
  path.join(process.cwd(), "src/services/observationPhotoUpload.ts"),
  "utf8",
);

test("occurrence upload ids also resolve to the visit id", () => {
  assert.deepEqual(observationPhotoUploadTargetIds("occ:record-1:0"), [
    "occ:record-1:0",
    "record-1",
  ]);
  assert.deepEqual(observationPhotoUploadTargetIds("record-1"), ["record-1"]);
  assert.deepEqual(observationPhotoUploadTargetIds(""), []);
});

test("Kubiaka private scope comes from persisted visit context", () => {
  assert.equal(KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY, "kubiaka-watch");
  assert.equal(isKubiakaPrivatePhotoSourcePayload({ experience_key: "kubiaka-watch" }), true);
  assert.equal(isKubiakaPrivatePhotoSourcePayload({ experience_key: "other" }), false);
  assert.equal(isKubiakaPrivatePhotoSourcePayload(null), false);
});

test("Kubiaka permits at most six actual photos", () => {
  assert.equal(KUBIAKA_PRIVATE_PHOTO_MAX_COUNT, 6);
  for (let count = 0; count < 6; count += 1) {
    assert.doesNotThrow(() => assertKubiakaPrivatePhotoCapacity(count, false));
  }
  assert.throws(
    () => assertKubiakaPrivatePhotoCapacity(6, false),
    /kubiaka_photo_limit_exceeded/,
  );
  assert.doesNotThrow(() => assertKubiakaPrivatePhotoCapacity(6, true));
  assert.throws(
    () => assertKubiakaPrivatePhotoCapacity(-1, false),
    /kubiaka_photo_count_invalid/,
  );
});

test("generic upload is rejected before Kubiaka object writes", () => {
  const target = source.indexOf("const target = targetResult.rows[0]");
  const endpointGate = source.indexOf("kubiaka_private_upload_endpoint_required");
  const hiddenGate = source.indexOf("kubiaka_private_visibility_required");
  const firstObjectRead = source.indexOf("mediaObjectStore.exists(originalInput)");
  assert.ok(target >= 0);
  assert.ok(endpointGate > target);
  assert.ok(hiddenGate > endpointGate);
  assert.ok(firstObjectRead > hiddenGate);
  assert.match(source, /KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION/);
});

test("Kubiaka display media stays private and cannot become public", () => {
  assert.match(source, /privateKubiakaUpload \? "private-photos" : "uploads"/);
  assert.match(source, /visibility: privateKubiakaUpload \? "private" : "public"/);
  assert.match(source, /publicUrl: privateKubiakaUpload \? ""/);
  assert.match(source, /public_delivery_allowed: !privateKubiakaUpload/);
  assert.match(source, /experience_key', ''\) = \$2[\s\S]*then 'hidden'/);
});

test("Kubiaka capacity is serialized and counted from evidence assets", () => {
  assert.match(source, /observation-photo-count:\$\{visitId\}/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /count\(\*\)::int as photo_count/);
  assert.match(source, /asset_role = 'observation_photo'/);
  assert.match(source, /assertKubiakaPrivatePhotoCapacity/);
});

test("Kubiaka skips compatibility export and media reassessment", () => {
  assert.match(source, /compatibilityWriteEnabled && !privateKubiakaUpload/);
  assert.match(source, /if \(!privateKubiakaUpload\)/);
  assert.match(source, /enqueueMediaProcessingJobsStandalone/);
  assert.match(source, /private_no_public_processing/);
});

test("normalization, prepared WebP reuse, retry cleanup and non-Kubiaka behavior remain", () => {
  assert.match(source, /normalizeObservationImage/);
  assert.match(source, /canKeepPreparedPhoto/);
  assert.match(source, /mimeType === "image\/webp"/);
  assert.match(source, /metadata\.format === "webp"/);
  assert.match(source, /mimeType: normalizedMime/);
  assert.match(source, /width: 2560/);
  assert.match(source, /height: 2560/);
  assert.match(source, /createdMediaObjects\.push\(originalInput\)/);
  assert.match(source, /createdMediaObjects\.push\(publicInput\)/);
  assert.match(source, /cleanupCreatedObservationMedia/);
  assert.match(source, /privateKubiakaUpload \? "private" : "public"/);
  assert.match(source, /photo_ready_reassess/);
});
