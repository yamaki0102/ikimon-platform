import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("video finalize promotes video-only observations out of native no-photo review", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "videoUpload.ts"), "utf8");

  assert.match(source, /'observation_video'/);
  assert.match(source, /public_visibility = 'public'/);
  assert.match(source, /quality_review_status = 'accepted'/);
  assert.match(source, /reason_code = 'native_no_photo'/);
  assert.match(source, /review_status = 'accepted'/);
  assert.match(source, /void kickVideoAiAfterFinalize\(record, target\.visitId\)/);
  assert.match(source, /v2_video_finalize_kick/);
});

test("video upload supports official tus direct uploads and ready webhooks", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "videoUpload.ts"), "utf8");
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");
  const queueSource = await readFile(path.join(process.cwd(), "src", "services", "videoProcessingQueue.ts"), "utf8");
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0033_video_processing_jobs.sql"), "utf8");

  assert.match(source, /uploadProtocol\?: "post" \| "tus"/);
  assert.match(source, /stream\?direct_user=true/);
  assert.match(source, /"Tus-Resumable": "1\.0\.0"/);
  assert.match(source, /"Upload-Length": String\(Math\.trunc\(fileSizeBytes\)\)/);
  assert.match(source, /verifyStreamWebhookSignature/);
  assert.match(routeSource, /webhook-signature/);
  assert.match(routeSource, /\/api\/v1\/videos\/stream-webhook/);
  assert.match(source, /video_thumbnail_refresh/);
  assert.match(source, /video_ready_reassess/);
  assert.match(queueSource, /processVideoProcessingJobs/);
  assert.match(queueSource, /reassessFromVideoThumb/);
  assert.match(queueSource, /markVideoReady/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS video_processing_jobs/);
});
