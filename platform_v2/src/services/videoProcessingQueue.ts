import { getPool } from "../db.js";
import { reassessFromVideoThumb } from "./reassessFromVideoThumb.js";
import { markVideoReady } from "./videoUpload.js";

type VideoProcessingJob = {
  jobId: string;
  streamUid: string;
  observationId: string | null;
  jobType: "video_thumbnail_refresh" | "video_ready_reassess" | string;
  attempts: number;
};

export type VideoProcessingRunResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

async function takePendingJobs(limit: number): Promise<VideoProcessingJob[]> {
  const pool = getPool();
  const result = await pool.query<{
    job_id: string;
    stream_uid: string;
    observation_id: string | null;
    job_type: string;
    attempts: number;
  }>(
    `update video_processing_jobs picked
        set job_status = 'running',
            attempts = attempts + 1,
            updated_at = now()
       from (
         select job_id
           from video_processing_jobs
          where job_status = 'pending'
          order by created_at asc
          limit $1
          for update skip locked
       ) pending
      where picked.job_id = pending.job_id
      returning picked.job_id::text,
                picked.stream_uid,
                picked.observation_id,
                picked.job_type,
                picked.attempts`,
    [Math.max(1, Math.min(20, Math.trunc(limit)))],
  );
  return result.rows.map((row) => ({
    jobId: row.job_id,
    streamUid: row.stream_uid,
    observationId: row.observation_id,
    jobType: row.job_type,
    attempts: Number(row.attempts),
  }));
}

async function finishJob(job: VideoProcessingJob, status: "succeeded" | "failed" | "pending", details: Record<string, unknown>): Promise<void> {
  await getPool().query(
    `update video_processing_jobs
        set job_status = $2,
            last_error = $3,
            source_payload = coalesce(source_payload, '{}'::jsonb) || $4::jsonb,
            updated_at = now(),
            finished_at = case when $2 in ('succeeded', 'failed') then now() else null end
      where job_id = $1::uuid`,
    [
      job.jobId,
      status,
      status === "failed" ? String(details.error ?? "video_processing_failed") : null,
      JSON.stringify(details),
    ],
  );
}

export async function processVideoProcessingJobs(limit = 5): Promise<VideoProcessingRunResult> {
  const jobs = await takePendingJobs(limit);
  const result: VideoProcessingRunResult = { processed: jobs.length, succeeded: 0, failed: 0 };
  for (const job of jobs) {
    try {
      if (job.jobType === "video_thumbnail_refresh") {
        const record = await markVideoReady(job.streamUid);
        await finishJob(job, "succeeded", {
          source: "video_processing_worker",
          ready_to_stream: record?.readyToStream ?? null,
          upload_status: record?.uploadStatus ?? null,
        });
        result.succeeded += 1;
        continue;
      }
      if (job.jobType === "video_ready_reassess") {
        if (!job.observationId) {
          throw new Error("video_processing_observation_missing");
        }
        const reassess = await reassessFromVideoThumb(job.observationId);
        await finishJob(job, "succeeded", {
          source: "video_processing_worker",
          occurrence_id: reassess.occurrenceId,
          ai_run_id: reassess.aiRunId,
        });
        result.succeeded += 1;
        continue;
      }
      throw new Error(`unknown_video_processing_job:${job.jobType}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "video_processing_failed";
      await finishJob(job, job.attempts >= 3 ? "failed" : "pending", {
        source: "video_processing_worker",
        error: message,
      });
      result.failed += 1;
    }
  }
  return result;
}
