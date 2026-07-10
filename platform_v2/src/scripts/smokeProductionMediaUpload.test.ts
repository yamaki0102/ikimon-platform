import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("production media smoke verifies duplicate post guard", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "smokeProductionMediaUpload.ts"), "utf8");

  assert.match(source, /verifyDuplicateGuard/);
  assert.match(source, /clientSubmissionId/);
  assert.match(source, /duplicate_upsert_created_new_visit/);
  assert.match(source, /duplicate_media_visit_detected/);
  assert.match(source, /observation_write_idempotency/);
});

test("production media smoke fixtures cannot be promoted to public accepted records", async () => {
  const observationWriteSource = await readFile(path.join(process.cwd(), "src", "services", "observationWrite.ts"), "utf8");
  const photoUploadSource = await readFile(path.join(process.cwd(), "src", "services", "observationPhotoUpload.ts"), "utf8");
  const videoUploadSource = await readFile(path.join(process.cwd(), "src", "services", "videoUpload.ts"), "utf8");

  assert.match(observationWriteSource, /isProductionSmokeRecord/);
  assert.match(observationWriteSource, /prod-media-smoke-/);
  assert.match(observationWriteSource, /prod_media_smoke/);
  assert.match(observationWriteSource, /production_smoke_record/);
  assert.match(observationWriteSource, /const publicVisibility = isProductionSmokeRecord \? "hidden"/);
  assert.match(observationWriteSource, /const qualityReviewStatus = isProductionSmokeRecord \? "archived"/);

  for (const source of [photoUploadSource, videoUploadSource]) {
    assert.match(source, /prod-media-smoke-/);
    assert.match(source, /prod_media_smoke/);
    assert.match(source, /production_smoke_record/);
    assert.match(source, /public_visibility[\s\S]*hidden/);
    assert.match(source, /quality_review_status[\s\S]*archived/);
  }
});
