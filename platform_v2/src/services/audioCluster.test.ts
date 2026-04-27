import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { __test__ } from "./audioCluster.js";

test("0038 migration creates sound_clusters with vector centroid + ivfflat index", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "db", "migrations", "0038_sound_clusters.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS sound_clusters/);
  assert.match(sql, /centroid_embedding\s+VECTOR\(1280\)\s+NOT NULL/);
  assert.match(sql, /USING ivfflat \(centroid_embedding vector_cosine_ops\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS sound_cluster_members/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS cluster_id UUID/);
});

test("0039 migration creates audio_review_queue with status state-machine", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "db", "migrations", "0039_audio_review_workflow.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audio_review_queue/);
  assert.match(sql, /UNIQUE \(cluster_id\)/);
  assert.match(sql, /'ai_candidate'/);
  assert.match(sql, /'needs_review'/);
  assert.match(sql, /'confirmed'/);
  assert.match(sql, /'published'/);
  assert.match(sql, /'rejected'/);
  assert.match(sql, /gbif_publish_eligible BOOLEAN/);
});

test("audioCluster service uses cosine distance + skips out-of-dim vectors", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "services", "audioCluster.js"),
    "utf8",
  ).catch(() =>
    readFile(path.join(process.cwd(), "src", "services", "audioCluster.ts"), "utf8"),
  );
  assert.match(source, /<=>/); // pgvector cosine distance operator
  assert.match(source, /audio_review_queue/);
  assert.match(source, /online_v1/);
  assert.match(source, /EMBEDDING_DIMENSION/);
});

test("audioReview exposes confirm/reject/representative/flag flow", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "services", "audioReview.ts"),
    "utf8",
  );
  assert.match(source, /export async function confirmCluster/);
  assert.match(source, /export async function rejectCluster/);
  assert.match(source, /export async function pickRepresentative/);
  assert.match(source, /export async function flagForReview/);
  assert.match(source, /export async function listReviewQueue/);
  assert.match(source, /export async function getClusterDetail/);
});

test("audioPropagation gates by similarity threshold and writes detections", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "services", "audioPropagation.ts"),
    "utf8",
  );
  assert.match(source, /HIGH_CONF_THRESHOLD/);
  assert.match(source, /'cluster_propagation'/);
  assert.match(source, /propagated_label_status = 'propagated'/);
  assert.match(source, /high_conf|all/);
});

test("admin audio API exposes the full review surface and is privileged", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "routes", "adminAudioApi.ts"),
    "utf8",
  );
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id\/representative/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id\/confirm/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id\/reject/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id\/flag-for-review/);
  assert.match(source, /\/api\/v1\/admin\/audio\/clusters\/:id\/propagate/);
  assert.match(source, /\/api\/v1\/admin\/audio\/cluster-runs/);
  assert.match(source, /assertPrivilegedWriteAccess/);

  const appSource = await readFile(
    path.join(process.cwd(), "src", "app.ts"),
    "utf8",
  );
  assert.match(appSource, /registerAdminAudioApiRoutes/);
});

test("vector literal serializer + parser round-trip preserves values", () => {
  const original = [0.5, -0.25, 1, 0];
  const literal = __test__.vectorLiteral(original);
  assert.equal(literal, "[0.5,-0.25,1,0]");
  const parsed = __test__.parseVector(literal);
  assert.deepEqual(parsed, original);
});

test("default similarity threshold is conservative enough for distinct birds", () => {
  // 0.85 is the agreed bar: close-but-different bird calls should NOT collapse
  // into a single cluster. Tighten only after we collect labelled data.
  assert.equal(__test__.DEFAULT_SIMILARITY_THRESHOLD, 0.85);
});

test("EMBEDDING_DIMENSION matches Phase 1 (Perch v2 = 1280)", () => {
  assert.equal(__test__.EMBEDDING_DIMENSION, 1280);
});

test("Perch server exposes include_embedding param", async () => {
  const source = await readFile(
    path.join(process.cwd(), "..", "upload_package", "scripts", "perch_server", "main.py"),
    "utf8",
  );
  assert.match(source, /include_embedding/);
  assert.match(source, /"model_name": "perch_v2"/);
  assert.match(source, /"vector": vector/);
});

test("audio_v2_embedding_worker.py wires Perch -> v2 callback with auth", async () => {
  const source = await readFile(
    path.join(process.cwd(), "..", "upload_package", "scripts", "audio_v2_embedding_worker.py"),
    "utf8",
  );
  assert.match(source, /\/api\/v1\/fieldscan\/audio\/callback/);
  assert.match(source, /x-ikimon-write-key/);
  assert.match(source, /include_embedding/);
  assert.match(source, /audio_embeddings/);
});

test("admin sound-review SSR page is gated to admin/analyst sessions", async () => {
  const pageSource = await readFile(
    path.join(process.cwd(), "src", "routes", "adminSoundReviewPages.ts"),
    "utf8",
  );
  assert.match(pageSource, /\/admin\/sound-review/);
  assert.match(pageSource, /isAdminOrAnalystRole/);
  assert.match(pageSource, /reply\.code\(403\)/);

  const uiSource = await readFile(
    path.join(process.cwd(), "src", "ui", "admin", "soundReview.ts"),
    "utf8",
  );
  assert.match(uiSource, /confirm\('/);
  assert.match(uiSource, /reject\('/);
  assert.match(uiSource, /flag-for-review/);
  assert.match(uiSource, /cluster-runs/);
  assert.match(uiSource, /escapeHtml/);

  const appSource = await readFile(
    path.join(process.cwd(), "src", "app.ts"),
    "utf8",
  );
  assert.match(appSource, /registerAdminSoundReviewPagesRoutes/);
});

test("admin audio API accepts admin session OR write key", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "routes", "adminAudioApi.ts"),
    "utf8",
  );
  assert.match(source, /assertAdminAudioAccess/);
  assert.match(source, /isAdminOrAnalystRole/);
  assert.match(source, /assertPrivilegedWriteAccess/);
  // helper should not require reviewerUserId in body when session derives it
  assert.doesNotMatch(source, /if \(!body\.reviewerUserId\) \{[^}]*reviewerUserId_required/);
});
