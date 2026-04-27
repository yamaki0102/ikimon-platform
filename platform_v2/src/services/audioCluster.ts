import type { PoolClient } from "pg";
import { getPool } from "../db.js";

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_BATCH_LIMIT = 200;
const EMBEDDING_DIMENSION = 1280;

export type ClusterRunSummary = {
  runId: string;
  method: "online_v1";
  modelName: string;
  modelVersion: string;
  similarityThreshold: number;
  segmentsProcessed: number;
  clustersCreated: number;
  segmentsAssignedToExisting: number;
  segmentsSkipped: number;
};

export type RunClusterBatchOptions = {
  modelName?: string;
  modelVersion?: string;
  similarityThreshold?: number;
  limit?: number;
};

function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v).toString()).join(",")}]`;
}

function parseVector(literal: string): number[] {
  const trimmed = literal.replace(/^\[/, "").replace(/\]$/, "");
  return trimmed
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

async function pickNearestCluster(
  client: PoolClient,
  vector: string,
  modelName: string,
  modelVersion: string,
  threshold: number,
): Promise<{ clusterId: string; similarity: number; distance: number } | null> {
  const result = await client.query<{
    cluster_id: string;
    similarity: number;
    distance: number;
  }>(
    `select cluster_id,
            1 - (centroid_embedding <=> $1::vector) as similarity,
            (centroid_embedding <=> $1::vector) as distance
       from sound_clusters
      where model_name = $2
        and model_version = $3
      order by centroid_embedding <=> $1::vector asc
      limit 1`,
    [vector, modelName, modelVersion],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (Number(row.similarity) < threshold) return null;
  return {
    clusterId: row.cluster_id,
    similarity: Number(row.similarity),
    distance: Number(row.distance),
  };
}

async function fetchPendingEmbeddings(
  client: PoolClient,
  modelName: string,
  modelVersion: string,
  limit: number,
): Promise<Array<{ segmentId: string; embedding: string }>> {
  const result = await client.query<{ segment_id: string; embedding: string }>(
    `select e.segment_id::text as segment_id,
            e.embedding::text as embedding
       from audio_embeddings e
       left join sound_cluster_members m on m.segment_id = e.segment_id
      where m.segment_id is null
        and e.model_name = $1
        and e.model_version = $2
      order by e.created_at asc
      limit $3`,
    [modelName, modelVersion, limit],
  );
  return result.rows.map((row) => ({
    segmentId: row.segment_id,
    embedding: row.embedding,
  }));
}

async function createCluster(
  client: PoolClient,
  input: {
    runId: string;
    modelName: string;
    modelVersion: string;
    representativeSegmentId: string;
    centroid: string;
  },
): Promise<string> {
  const result = await client.query<{ cluster_id: string }>(
    `insert into sound_clusters
       (cluster_method, cluster_run_id, model_name, model_version,
        representative_segment_id, centroid_embedding, member_count)
     values ('online_v1', $1, $2, $3, $4, $5::vector, 0)
     returning cluster_id`,
    [
      input.runId,
      input.modelName,
      input.modelVersion,
      input.representativeSegmentId,
      input.centroid,
    ],
  );
  const clusterId = result.rows[0]?.cluster_id;
  if (!clusterId) throw new Error("audio_cluster_insert_failed");
  return clusterId;
}

async function addClusterMember(
  client: PoolClient,
  clusterId: string,
  segmentId: string,
  distance: number,
): Promise<void> {
  await client.query(
    `insert into sound_cluster_members (cluster_id, segment_id, distance_to_centroid)
       values ($1, $2, $3)
       on conflict (cluster_id, segment_id) do nothing`,
    [clusterId, segmentId, distance],
  );
}

async function refreshClusterStats(
  client: PoolClient,
  clusterId: string,
): Promise<void> {
  // member_count を再計算し、centroid をメンバー embedding の平均で再計算する。
  // pgvector の AVG 集約は 0.7 以降で利用可能。dimension 一致が前提。
  await client.query(
    `update sound_clusters c
        set member_count = sub.cnt,
            centroid_embedding = sub.centroid,
            updated_at = now()
       from (
         select e.segment_id,
                count(*) over () as cnt,
                avg(e.embedding) over () as centroid
           from sound_cluster_members m
           join audio_embeddings e on e.segment_id = m.segment_id
                                  and e.model_name = c.model_name
                                  and e.model_version = c.model_version
          where m.cluster_id = $1
       ) sub
      where c.cluster_id = $1
      limit 1`,
    [clusterId],
  );
}

async function pickDominantTaxon(
  client: PoolClient,
  clusterId: string,
): Promise<void> {
  // メンバー segment の audio_detections から top taxon を選ぶ。
  await client.query(
    `update sound_clusters c
        set dominant_taxon_guess = sub.detected_taxon,
            taxon_confidence = sub.best_conf,
            updated_at = now()
       from (
         select d.detected_taxon, max(d.confidence) as best_conf, count(*) as freq
           from sound_cluster_members m
           join audio_detections d on d.segment_id = m.segment_id
          where m.cluster_id = $1
          group by d.detected_taxon
          order by count(*) desc, max(d.confidence) desc
          limit 1
       ) sub
      where c.cluster_id = $1
        and (c.confirmed_taxon_id is null)`,
    [clusterId],
  );
}

export async function runClusterBatch(
  options: RunClusterBatchOptions = {},
): Promise<ClusterRunSummary> {
  const modelName = options.modelName ?? "perch_v2";
  const modelVersion = options.modelVersion ?? "v2";
  const threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const limit = Math.max(1, Math.min(2000, options.limit ?? DEFAULT_BATCH_LIMIT));

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const runResult = await client.query<{ run_id: string }>(
      `select gen_random_uuid()::text as run_id`,
    );
    const runId = runResult.rows[0]?.run_id;
    if (!runId) throw new Error("audio_cluster_run_id_failed");

    const pending = await fetchPendingEmbeddings(client, modelName, modelVersion, limit);
    let clustersCreated = 0;
    let assignedToExisting = 0;
    let skipped = 0;
    const touchedClusters = new Set<string>();

    for (const segment of pending) {
      const numericVec = parseVector(segment.embedding);
      if (numericVec.length !== EMBEDDING_DIMENSION) {
        skipped += 1;
        continue;
      }
      const literal = vectorLiteral(numericVec);

      const nearest = await pickNearestCluster(client, literal, modelName, modelVersion, threshold);
      let clusterId: string;
      let distance = 0;

      if (nearest) {
        clusterId = nearest.clusterId;
        distance = nearest.distance;
        assignedToExisting += 1;
      } else {
        clusterId = await createCluster(client, {
          runId,
          modelName,
          modelVersion,
          representativeSegmentId: segment.segmentId,
          centroid: literal,
        });
        clustersCreated += 1;
      }

      await addClusterMember(client, clusterId, segment.segmentId, distance);
      touchedClusters.add(clusterId);
    }

    for (const clusterId of touchedClusters) {
      await refreshClusterStats(client, clusterId);
      await pickDominantTaxon(client, clusterId);
      await client.query(
        `insert into audio_review_queue (cluster_id, priority, review_status)
           values ($1, 'normal', 'ai_candidate')
           on conflict (cluster_id) do update set
             updated_at = now(),
             review_status = case
               when audio_review_queue.review_status in ('confirmed', 'published', 'rejected')
                 then audio_review_queue.review_status
               else 'ai_candidate'
             end`,
        [clusterId],
      );
    }

    await client.query("commit");

    return {
      runId,
      method: "online_v1",
      modelName,
      modelVersion,
      similarityThreshold: threshold,
      segmentsProcessed: pending.length,
      clustersCreated,
      segmentsAssignedToExisting: assignedToExisting,
      segmentsSkipped: skipped,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const __test__ = {
  vectorLiteral,
  parseVector,
  EMBEDDING_DIMENSION,
  DEFAULT_SIMILARITY_THRESHOLD,
};
