import type { PoolClient } from "pg";
import { getPool } from "../db.js";

export type MediaProcessingJobInput = {
  mediaKind: "photo" | "video" | string;
  mediaUid: string;
  observationId: string;
  occurrenceId?: string | null;
  jobType: "photo_ready_reassess" | "video_thumbnail_refresh" | "video_ready_reassess" | string;
  sourcePayload?: Record<string, unknown>;
};

export async function enqueueMediaProcessingJobs(client: PoolClient, jobs: MediaProcessingJobInput[]): Promise<number> {
  let queued = 0;
  for (const job of jobs) {
    const mediaUid = job.mediaUid.trim();
    const observationId = job.observationId.trim();
    if (!mediaUid || !observationId) {
      continue;
    }
    const result = await client.query<{ job_id: string }>(
      `insert into media_processing_jobs (
          media_kind, media_uid, observation_id, occurrence_id, job_type, job_status, source_payload, created_at, updated_at
       )
       values ($1, $2, $3, $4, $5, 'pending', $6::jsonb, now(), now())
       on conflict do nothing
       returning job_id::text`,
      [
        job.mediaKind,
        mediaUid,
        observationId,
        job.occurrenceId?.trim() || null,
        job.jobType,
        JSON.stringify(job.sourcePayload ?? {}),
      ],
    );
    if (result.rows[0]?.job_id) queued += 1;
  }
  return queued;
}

export async function enqueueMediaProcessingJobsStandalone(jobs: MediaProcessingJobInput[]): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const queued = await enqueueMediaProcessingJobs(client, jobs);
    await client.query("commit");
    return queued;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // no-op
    }
    throw error;
  } finally {
    client.release();
  }
}
