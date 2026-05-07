import { getPool } from "../db.js";
import { reassessObservation, type ReassessResult } from "./observationReassess.js";

type VideoThumbTarget = {
  occurrenceId: string;
  assetId: string;
  thumbnailUrl: string;
  durationMs: number | null;
};

export type ReassessFromVideoThumbResult = ReassessResult & {
  thumbnailUrl: string;
  frameUrl: string;
  frameUrls: string[];
  frameCount: number;
  frameTimesMs: number[];
};

function normalizeImageMime(value: string | null): string {
  const normalized = (String(value ?? "").split(";")[0] ?? "")
    .trim()
    .toLowerCase();
  return normalized.startsWith("image/") ? normalized : "image/jpeg";
}

function formatFrameTime(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
}

function uniqueFrameTimes(times: number[]): number[] {
  const sorted = times
    .map((time) => Math.max(0, Math.round(time)))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  const out: number[] = [];
  for (const time of sorted) {
    if (out.every((existing) => Math.abs(existing - time) >= 400)) {
      out.push(time);
    }
  }
  return out;
}

export function selectVideoFrameTimesMs(durationMs: number | null | undefined): number[] {
  const duration = Number(durationMs ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    return [1000, 2000, 4000];
  }
  if (duration <= 1200) {
    return [Math.max(100, Math.round(duration * 0.5))];
  }
  if (duration <= 5000) {
    return uniqueFrameTimes([
      Math.min(800, duration * 0.25),
      duration * 0.5,
      Math.max(400, duration - 500),
    ]);
  }
  return uniqueFrameTimes([
    Math.max(800, duration * 0.12),
    duration * 0.32,
    duration * 0.5,
    duration * 0.68,
    Math.min(duration - 500, duration * 0.88),
  ]).slice(0, 5);
}

export function buildVideoFrameUrl(thumbnailUrl: string, frameTimeMs: number): string {
  let url: URL;
  try {
    url = new URL(thumbnailUrl);
  } catch {
    throw new Error("invalid_video_thumbnail_url");
  }
  url.searchParams.set("time", formatFrameTime(frameTimeMs));
  if (!url.searchParams.has("height")) {
    url.searchParams.set("height", "720");
  }
  return url.toString();
}

async function resolveVideoThumbTarget(observationId: string): Promise<VideoThumbTarget | null> {
  const id = observationId.trim();
  if (!id) {
    return null;
  }
  const pool = getPool();
  const result = await pool.query<{
    occurrence_id: string;
    asset_id: string;
    thumbnail_url: string | null;
    duration_ms: string | number | null;
  }>(
    `select
        o.occurrence_id,
        video.asset_id::text as asset_id,
        coalesce(
          video.asset_source_payload ->> 'thumbnail_url',
          video.blob_source_payload ->> 'thumbnail_url',
          nullif(video.public_url, '')
        ) as thumbnail_url,
        coalesce(
          case when (video.asset_source_payload ->> 'duration_ms') ~ '^[0-9]+$'
            then (video.asset_source_payload ->> 'duration_ms')::bigint
            else null
          end,
          case when (video.blob_source_payload ->> 'duration_ms') ~ '^[0-9]+$'
            then (video.blob_source_payload ->> 'duration_ms')::bigint
            else null
          end,
          video.blob_duration_ms,
          vur.stream_duration_ms
        ) as duration_ms
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join lateral (
       select
         ea.asset_id,
         ea.source_payload as asset_source_payload,
         ab.source_payload as blob_source_payload,
         ab.public_url,
         ab.duration_ms as blob_duration_ms
       from evidence_assets ea
       join asset_blobs ab on ab.blob_id = ea.blob_id
       where ea.occurrence_id = o.occurrence_id
         and ea.asset_role = 'observation_video'
       order by ea.created_at desc
       limit 1
     ) video on true
     left join video_upload_requests vur
       on vur.stream_uid = coalesce(
         video.asset_source_payload ->> 'stream_uid',
         video.blob_source_payload ->> 'stream_uid'
       )
     where (o.occurrence_id = $1 or v.visit_id = $1 or v.legacy_observation_id = $1)
       and o.subject_index = 0
     limit 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row?.thumbnail_url) {
    return null;
  }
  return {
    occurrenceId: row.occurrence_id,
    assetId: row.asset_id,
    thumbnailUrl: row.thumbnail_url,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
  };
}

export async function reassessFromVideoThumb(observationId: string): Promise<ReassessFromVideoThumbResult> {
  const target = await resolveVideoThumbTarget(observationId);
  if (!target) {
    throw new Error("observation_video_not_found");
  }
  const frameTimesMs = selectVideoFrameTimesMs(target.durationMs);
  const frames: Array<{ frameUrl: string; frameTimeMs: number; mime: string; b64: string }> = [];
  for (const frameTimeMs of frameTimesMs) {
    const frameUrl = buildVideoFrameUrl(target.thumbnailUrl, frameTimeMs);
    const response = await fetch(frameUrl, {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
    });
    if (!response.ok) {
      continue;
    }
    const contentType = response.headers.get("content-type");
    if (!String(contentType ?? "").toLowerCase().startsWith("image/")) {
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 12 * 1024 * 1024) {
      continue;
    }
    frames.push({
      frameUrl,
      frameTimeMs,
      mime: normalizeImageMime(response.headers.get("content-type")),
      b64: bytes.toString("base64"),
    });
  }
  if (frames.length === 0) {
    throw new Error("video_frame_fetch_failed");
  }

  const reassess = await reassessObservation(target.occurrenceId, {
    photos: frames.map((frame) => ({
      mime: frame.mime,
      b64: frame.b64,
      assetId: target.assetId,
      frameTimeMs: frame.frameTimeMs,
    })),
    promptVersion: "observation_reassess.md/v2+video_frames",
    sourceTag: "video_frames",
  });

  return {
    ...reassess,
    thumbnailUrl: target.thumbnailUrl,
    frameUrl: frames[0]?.frameUrl ?? "",
    frameUrls: frames.map((frame) => frame.frameUrl),
    frameCount: frames.length,
    frameTimesMs: frames.map((frame) => frame.frameTimeMs),
  };
}
