import { getPool } from "../db.js";
import { reassessObservation } from "./observationReassess.js";
import { reassessFromVideoThumb } from "./reassessFromVideoThumb.js";
import { markVideoReady } from "./videoUpload.js";

type MediaProcessingJob = {
  jobId: string;
  mediaKind: string;
  mediaUid: string;
  observationId: string;
  occurrenceId: string | null;
  jobType: "photo_ready_reassess" | "video_thumbnail_refresh" | "video_ready_reassess" | string;
  attempts: number;
};

export type MediaProcessingRunResult = {
  processed: number;
  succeeded: number;
  failed: number;
  pending: number;
  stalePending: number;
  oldestPendingSeconds: number | null;
};

async function takePendingJobs(limit: number): Promise<MediaProcessingJob[]> {
  const result = await getPool().query<{
    job_id: string;
    media_kind: string;
    media_uid: string;
    observation_id: string;
    occurrence_id: string | null;
    job_type: string;
    attempts: number;
  }>(
    `update media_processing_jobs picked
        set job_status = 'running',
            attempts = attempts + 1,
            updated_at = now()
       from (
         select job_id
           from media_processing_jobs
          where job_status = 'pending'
          order by created_at asc
          limit $1
          for update skip locked
       ) pending
      where picked.job_id = pending.job_id
      returning picked.job_id::text,
                picked.media_kind,
                picked.media_uid,
                picked.observation_id,
                picked.occurrence_id,
                picked.job_type,
                picked.attempts`,
    [Math.max(1, Math.min(50, Math.trunc(limit)))],
  );
  return result.rows.map((row) => ({
    jobId: row.job_id,
    mediaKind: row.media_kind,
    mediaUid: row.media_uid,
    observationId: row.observation_id,
    occurrenceId: row.occurrence_id,
    jobType: row.job_type,
    attempts: Number(row.attempts),
  }));
}

async function finishJob(job: MediaProcessingJob, status: "succeeded" | "failed" | "pending", details: Record<string, unknown>): Promise<void> {
  await getPool().query(
    `update media_processing_jobs
        set job_status = $2,
            last_error = $3,
            source_payload = coalesce(source_payload, '{}'::jsonb) || $4::jsonb,
            updated_at = now(),
            finished_at = case when $2 in ('succeeded', 'failed') then now() else null end
      where job_id = $1::uuid`,
    [
      job.jobId,
      status,
      status === "failed" ? String(details.error ?? "media_processing_failed") : null,
      JSON.stringify(details),
    ],
  );
}

async function queueStats(staleSeconds: number): Promise<Pick<MediaProcessingRunResult, "pending" | "stalePending" | "oldestPendingSeconds">> {
  const result = await getPool().query<{
    pending: string;
    stale_pending: string;
    oldest_pending_seconds: string | null;
  }>(
    `select
        count(*) filter (where job_status = 'pending')::text as pending,
        count(*) filter (where job_status = 'pending' and created_at < now() - ($1::int * interval '1 second'))::text as stale_pending,
        floor(extract(epoch from now() - min(created_at) filter (where job_status = 'pending')))::text as oldest_pending_seconds
       from media_processing_jobs`,
    [Math.max(60, Math.trunc(staleSeconds))],
  );
  const row = result.rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    stalePending: Number(row?.stale_pending ?? 0),
    oldestPendingSeconds: row?.oldest_pending_seconds === null || row?.oldest_pending_seconds === undefined
      ? null
      : Number(row.oldest_pending_seconds),
  };
}

export async function processMediaProcessingJobs(limit = 10, staleSeconds = 15 * 60): Promise<MediaProcessingRunResult> {
  const jobs = await takePendingJobs(limit);
  const result: MediaProcessingRunResult = {
    processed: jobs.length,
    succeeded: 0,
    failed: 0,
    pending: 0,
    stalePending: 0,
    oldestPendingSeconds: null,
  };
  for (const job of jobs) {
    try {
      if (job.jobType === "photo_ready_reassess") {
        const reassess = await reassessObservation(job.occurrenceId || job.observationId);
        await finishJob(job, "succeeded", {
          source: "media_processing_worker",
          occurrence_id: reassess.occurrenceId,
          ai_run_id: reassess.aiRunId,
        });
        result.succeeded += 1;
        continue;
      }
      if (job.jobType === "video_thumbnail_refresh") {
        const record = await markVideoReady(job.mediaUid);
        await finishJob(job, "succeeded", {
          source: "media_processing_worker",
          ready_to_stream: record?.readyToStream ?? null,
          upload_status: record?.uploadStatus ?? null,
        });
        result.succeeded += 1;
        continue;
      }
      if (job.jobType === "video_ready_reassess") {
        const reassess = await reassessFromVideoThumb(job.observationId);
        await finishJob(job, "succeeded", {
          source: "media_processing_worker",
          occurrence_id: reassess.occurrenceId,
          ai_run_id: reassess.aiRunId,
        });
        result.succeeded += 1;
        continue;
      }
      throw new Error(`unknown_media_processing_job:${job.jobType}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "media_processing_failed";
      await finishJob(job, job.attempts >= 3 ? "failed" : "pending", {
        source: "media_processing_worker",
        error: message,
      });
      result.failed += 1;
    }
  }
  const stats = await queueStats(staleSeconds);
  return { ...result, ...stats };
}
