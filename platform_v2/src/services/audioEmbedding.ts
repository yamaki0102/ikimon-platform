import type { PoolClient } from "pg";
import { getPool } from "../db.js";

const EMBEDDING_DIMENSION = 1280;

export type RecordSegmentEmbeddingInput = {
  segmentId: string;
  modelName: string;
  modelVersion: string;
  embedding: number[];
  frameOffsetSec?: number;
  frameDurationSec?: number;
  qualityScore?: number;
};

export type SimilarSegment = {
  embeddingId: string;
  segmentId: string;
  modelName: string;
  modelVersion: string;
  frameOffsetSec: number;
  frameDurationSec: number;
  qualityScore: number | null;
  similarity: number;
  recordedAt: string | null;
  sessionId: string | null;
  candidateTaxon: string | null;
  bestConfidence: number | null;
};

export type FindSimilarOptions = {
  limit?: number;
  modelName?: string;
  modelVersion?: string;
  minSimilarity?: number;
  excludeSegmentId?: string;
  privacyStatus?: "clean" | "any";
};

function assertVectorShape(vector: number[]): void {
  if (!Array.isArray(vector)) {
    throw new Error("embedding_vector_required");
  }
  if (vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(`embedding_dimension_mismatch:${vector.length}`);
  }
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error("embedding_vector_non_finite");
    }
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => Number(v).toString()).join(",")}]`;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 25;
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}

function clampSimilarity(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export async function recordSegmentEmbedding(
  input: RecordSegmentEmbeddingInput,
  client?: PoolClient,
): Promise<{ embeddingId: string; created: boolean }> {
  if (!input.segmentId) throw new Error("segmentId_required");
  if (!input.modelName) throw new Error("modelName_required");
  if (!input.modelVersion) throw new Error("modelVersion_required");
  assertVectorShape(input.embedding);

  const frameOffsetSec = Number.isFinite(input.frameOffsetSec) ? Number(input.frameOffsetSec) : 0;
  const frameDurationSec = Number.isFinite(input.frameDurationSec) ? Number(input.frameDurationSec) : 5.0;
  const qualityScore = Number.isFinite(input.qualityScore) ? Number(input.qualityScore) : null;
  const literal = toVectorLiteral(input.embedding);

  const sql = `
    insert into audio_embeddings
      (segment_id, model_name, model_version, embedding,
       frame_offset_sec, frame_duration_sec, quality_score)
    values ($1, $2, $3, $4::vector, $5, $6, $7)
    on conflict (segment_id, model_name, model_version, frame_offset_sec) do update set
      embedding = excluded.embedding,
      frame_duration_sec = excluded.frame_duration_sec,
      quality_score = excluded.quality_score
    returning embedding_id, (xmax = 0) as created
  `;
  const params = [
    input.segmentId,
    input.modelName,
    input.modelVersion,
    literal,
    frameOffsetSec,
    frameDurationSec,
    qualityScore,
  ];

  const runner = client ?? getPool();
  const result = await runner.query<{ embedding_id: string; created: boolean }>(sql, params);
  const row = result.rows[0];
  if (!row) {
    throw new Error("audio_embedding_insert_failed");
  }
  return { embeddingId: row.embedding_id, created: row.created };
}

export async function findSimilarByVector(
  vector: number[],
  options: FindSimilarOptions = {},
): Promise<SimilarSegment[]> {
  assertVectorShape(vector);
  const limit = clampLimit(options.limit);
  const minSimilarity = clampSimilarity(options.minSimilarity);
  const literal = toVectorLiteral(vector);
  const privacyStatus = options.privacyStatus ?? "clean";

  const params: Array<string | number> = [literal, limit];
  const filters: string[] = [];
  if (options.modelName) {
    params.push(options.modelName);
    filters.push(`e.model_name = $${params.length}`);
  }
  if (options.modelVersion) {
    params.push(options.modelVersion);
    filters.push(`e.model_version = $${params.length}`);
  }
  if (options.excludeSegmentId) {
    params.push(options.excludeSegmentId);
    filters.push(`e.segment_id <> $${params.length}`);
  }
  if (privacyStatus === "clean") {
    filters.push(`s.privacy_status = 'clean'`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";

  const sql = `
    select e.embedding_id,
           e.segment_id,
           e.model_name,
           e.model_version,
           e.frame_offset_sec,
           e.frame_duration_sec,
           e.quality_score,
           1 - (e.embedding <=> $1::vector) as similarity,
           s.recorded_at::text as recorded_at,
           s.session_id,
           top_det.detected_taxon as candidate_taxon,
           top_det.confidence as best_confidence
      from audio_embeddings e
      join audio_segments s on s.segment_id = e.segment_id
      left join lateral (
        select detected_taxon, confidence
          from audio_detections
         where segment_id = e.segment_id
         order by confidence desc
         limit 1
      ) top_det on true
      ${whereClause}
     order by e.embedding <=> $1::vector asc
     limit $2
  `;

  const result = await getPool().query<{
    embedding_id: string;
    segment_id: string;
    model_name: string;
    model_version: string;
    frame_offset_sec: number;
    frame_duration_sec: number;
    quality_score: number | null;
    similarity: number;
    recorded_at: string | null;
    session_id: string | null;
    candidate_taxon: string | null;
    best_confidence: number | null;
  }>(sql, params);

  return result.rows
    .filter((row) => Number(row.similarity) >= minSimilarity)
    .map((row) => ({
      embeddingId: row.embedding_id,
      segmentId: row.segment_id,
      modelName: row.model_name,
      modelVersion: row.model_version,
      frameOffsetSec: Number(row.frame_offset_sec),
      frameDurationSec: Number(row.frame_duration_sec),
      qualityScore: row.quality_score != null ? Number(row.quality_score) : null,
      similarity: Number(row.similarity),
      recordedAt: row.recorded_at,
      sessionId: row.session_id,
      candidateTaxon: row.candidate_taxon,
      bestConfidence: row.best_confidence != null ? Number(row.best_confidence) : null,
    }));
}

export async function findSimilarSegments(
  segmentId: string,
  options: FindSimilarOptions = {},
): Promise<SimilarSegment[]> {
  if (!segmentId) throw new Error("segmentId_required");
  const pool = getPool();

  const params: Array<string> = [segmentId];
  const filters: string[] = ["segment_id = $1"];
  if (options.modelName) {
    params.push(options.modelName);
    filters.push(`model_name = $${params.length}`);
  }
  if (options.modelVersion) {
    params.push(options.modelVersion);
    filters.push(`model_version = $${params.length}`);
  }

  const baseRow = await pool.query<{
    embedding: string;
    model_name: string;
    model_version: string;
  }>(
    `select embedding::text as embedding, model_name, model_version
       from audio_embeddings
      where ${filters.join(" and ")}
      order by frame_offset_sec asc, quality_score desc nulls last
      limit 1`,
    params,
  );
  const seed = baseRow.rows[0];
  if (!seed) {
    return [];
  }

  const numericVector = seed.embedding
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (numericVector.length !== EMBEDDING_DIMENSION) {
    throw new Error(`embedding_dimension_corruption:${numericVector.length}`);
  }

  return findSimilarByVector(numericVector, {
    ...options,
    modelName: options.modelName ?? seed.model_name,
    modelVersion: options.modelVersion ?? seed.model_version,
    excludeSegmentId: options.excludeSegmentId ?? segmentId,
  });
}

export const __test__ = {
  EMBEDDING_DIMENSION,
  toVectorLiteral,
  clampLimit,
  clampSimilarity,
};
