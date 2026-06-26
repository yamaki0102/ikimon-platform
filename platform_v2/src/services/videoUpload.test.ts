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

test("video media processing is handled by Cloudflare Queues, not the Node PostgreSQL queue", async () => {
  const packageJson = await readFile(path.join(process.cwd(), "package.json"), "utf8");
  const smokeSource = await readFile(path.join(process.cwd(), "src", "scripts", "smokeProductionMediaUpload.ts"), "utf8");
  const workerSource = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");
  const wranglerConfig = await readFile(path.join(process.cwd(), "cloudflare_shadow", "wrangler.jsonc"), "utf8");
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0033_video_processing_jobs.sql"), "utf8");
  const mediaMigration = await readFile(path.join(process.cwd(), "db", "migrations", "0034_media_processing_jobs.sql"), "utf8");

  assert.doesNotMatch(packageJson, /process:media-jobs/);
  assert.doesNotMatch(packageJson, /process:video-jobs/);
  assert.doesNotMatch(smokeSource, /processMediaProcessingJobs/);
  assert.doesNotMatch(smokeSource, /media_worker/);
  assert.match(workerSource, /MEDIA_QUEUE/);
  assert.match(workerSource, /topic === "media\.process"/);
  assert.match(workerSource, /topic === "readmodel\.refresh"/);
  assert.match(workerSource, /await env\.MEDIA_QUEUE\.send\(job\)/);
  assert.match(wranglerConfig, /"binding": "MEDIA_QUEUE"/);
  assert.match(wranglerConfig, /"queue": "ikimon-prod-media-jobs"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS video_processing_jobs/);
  assert.match(mediaMigration, /CREATE TABLE IF NOT EXISTS media_processing_jobs/);
  assert.match(mediaMigration, /migrated_from', 'video_processing_jobs'/);
});
