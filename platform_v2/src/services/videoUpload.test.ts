import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("video upload lifecycle is owned by the Cloudflare Worker, not the Node origin", async () => {
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");
  const workerSource = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0094_publish_valid_video_observations.sql"), "utf8");

  assert.doesNotMatch(routeSource, /services\/videoUpload\.js/);
  assert.doesNotMatch(routeSource, /\/api\/v1\/videos\/direct-upload/);
  assert.doesNotMatch(routeSource, /\/api\/v1\/videos\/stream-webhook/);
  assert.doesNotMatch(routeSource, /\/api\/v1\/videos\/:uid\/finalize/);
  assert.match(workerSource, /\/api\/v1\/videos\/direct-upload/);
  assert.match(workerSource, /\/api\/v1\/videos\/stream-webhook/);
  assert.match(workerSource, /const videoFinalizeMatch = url\.pathname\.match/);
  assert.match(workerSource, /createCompatibleVideoDirectUpload/);
  assert.match(workerSource, /handleCompatibleVideoStreamWebhook/);
  assert.match(workerSource, /finalizeCompatibleVideo/);
  assert.match(migration, /0094_publish_valid_video_observations/);
  assert.match(migration, /ea\.asset_role = 'observation_video'/);
  assert.match(migration, /reason_code = 'native_no_photo'/);
});

test("video media processing no longer imports the retired Node video upload service", async () => {
  const queueSource = await readFile(path.join(process.cwd(), "src", "services", "mediaProcessingQueue.ts"), "utf8");
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0033_video_processing_jobs.sql"), "utf8");
  const mediaMigration = await readFile(path.join(process.cwd(), "db", "migrations", "0034_media_processing_jobs.sql"), "utf8");

  assert.match(queueSource, /processMediaProcessingJobs/);
  assert.match(queueSource, /photoDebounceSeconds/);
  assert.match(queueSource, /job_type <> 'photo_ready_reassess'/);
  assert.match(queueSource, /reassessFromVideoThumb/);
  assert.match(queueSource, /cloudflare_worker_video_lifecycle/);
  assert.doesNotMatch(queueSource, /markVideoReady/);
  assert.doesNotMatch(queueSource, /videoUpload\.js/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS video_processing_jobs/);
  assert.match(mediaMigration, /CREATE TABLE IF NOT EXISTS media_processing_jobs/);
  assert.match(mediaMigration, /migrated_from', 'video_processing_jobs'/);
});
