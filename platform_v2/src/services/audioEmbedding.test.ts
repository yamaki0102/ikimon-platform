import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { __test__ } from "./audioEmbedding.js";

test("audio embedding migration sets up pgvector and ivfflat index", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "db", "migrations", "0036_audio_embeddings.sql"),
    "utf8",
  );
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS audio_embeddings/);
  assert.match(migration, /embedding\s+VECTOR\(1280\)\s+NOT NULL/);
  assert.match(migration, /USING ivfflat \(embedding vector_cosine_ops\)/);
  assert.match(migration, /UNIQUE \(segment_id, model_name, model_version, frame_offset_sec\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS frequency_band_hz_low/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sample_rate_hz/);
});

test("audioEmbedding service exposes record + similar APIs", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "services", "audioEmbedding.ts"),
    "utf8",
  );
  assert.match(source, /export async function recordSegmentEmbedding/);
  assert.match(source, /export async function findSimilarByVector/);
  assert.match(source, /export async function findSimilarSegments/);
  assert.match(source, /USING ivfflat|<=>/);
  assert.match(source, /embedding_dimension_mismatch/);
});

test("fieldscan callback accepts optional embeddings payload", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "services", "fieldscanAudio.ts"),
    "utf8",
  );
  assert.match(source, /embeddings\?: AudioEmbeddingPayload\[\]/);
  assert.match(source, /recordSegmentEmbedding\(/);
  assert.match(source, /detections_or_embeddings_required/);
  assert.match(source, /embeddingsInserted: number;/);
});

test("fieldscan route exposes privileged similar-search endpoint", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "routes", "fieldscanApi.ts"),
    "utf8",
  );
  assert.match(source, /\/api\/v1\/fieldscan\/audio\/segment\/:id\/similar/);
  assert.match(source, /assertPrivilegedWriteAccess/);
  assert.match(source, /findSimilarSegments/);
});

test("vector literal serializer emits pgvector text format", () => {
  const literal = __test__.toVectorLiteral([0.1, -0.5, 1, 2.5]);
  assert.equal(literal, "[0.1,-0.5,1,2.5]");
});

test("clampLimit and clampSimilarity bound user-facing inputs", () => {
  assert.equal(__test__.clampLimit(undefined), 25);
  assert.equal(__test__.clampLimit(0), 1);
  assert.equal(__test__.clampLimit(9999), 200);
  assert.equal(__test__.clampLimit(Number.NaN), 25);
  assert.equal(__test__.clampSimilarity(undefined), 0);
  assert.equal(__test__.clampSimilarity(-0.5), 0);
  assert.equal(__test__.clampSimilarity(1.5), 1);
  assert.equal(__test__.clampSimilarity(0.42), 0.42);
});

test("EMBEDDING_DIMENSION matches Perch v2 default (1280)", () => {
  assert.equal(__test__.EMBEDDING_DIMENSION, 1280);
});
