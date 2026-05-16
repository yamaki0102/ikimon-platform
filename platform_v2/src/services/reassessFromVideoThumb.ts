import { getPool } from "../db.js";
import { reassessObservation, type ReassessResult } from "./observationReassess.js";
import {
  adaptiveCandidateFrameTimesMs,
  extractVideoFrameFeature,
  fallbackVideoFrameTimesMs,
  selectAdaptiveVideoFramesFromFeatures,
  type VideoFrameFeature,
  type VideoFrameSelection,
} from "./videoAdaptiveFrameSelection.js";

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
  selectionStrategy: "adaptive" | "fallback";
  selectedFrames: Array<{
    frameTimeMs: number;
    selectionScore: number;
    selectionReason: string;
    differenceScore: number;
    qualityScore: number;
  }>;
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
  return fallbackVideoFrameTimesMs(durationMs);
}

export function buildVideoFrameUrl(thumbnailUrl: string, frameTimeMs: number, height = 720): string {
  let url: URL;
  try {
    url = new URL(thumbnailUrl);
  } catch {
    throw new Error("invalid_video_thumbnail_url");
  }
  url.searchParams.set("time", formatFrameTime(frameTimeMs));
  if (height > 0) {
    url.searchParams.set("height", String(Math.round(height)));
  } else if (!url.searchParams.has("height")) {
    url.searchParams.set("height", "720");
  }
  return url.toString();
}

async function fetchVideoFrame(thumbnailUrl: string, frameTimeMs: number, height: number): Promise<{
  frameUrl: string;
  frameTimeMs: number;
  mime: string;
  bytes: Buffer;
} | null> {
  const frameUrl = buildVideoFrameUrl(thumbnailUrl, frameTimeMs, height);
  const response = await fetch(frameUrl, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type");
  if (!String(contentType ?? "").toLowerCase().startsWith("image/")) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > 12 * 1024 * 1024) return null;
  return {
    frameUrl,
    frameTimeMs,
    mime: normalizeImageMime(response.headers.get("content-type")),
    bytes,
  };
}

async function selectAdaptiveFrames(target: VideoThumbTarget): Promise<{
  strategy: "adaptive" | "fallback";
  selections: VideoFrameSelection[];
}> {
  const candidateTimes = adaptiveCandidateFrameTimesMs(target.durationMs);
  const features: VideoFrameFeature[] = [];
  let previous: { grays: number[]; histogram: number[] } | null = null;
  for (const frameTimeMs of candidateTimes) {
    const frame = await fetchVideoFrame(target.thumbnailUrl, frameTimeMs, 240).catch(() => null);
    if (!frame) continue;
    const extracted: Awaited<ReturnType<typeof extractVideoFrameFeature>> | null =
      await extractVideoFrameFeature(frameTimeMs, frame.bytes, previous).catch(() => null);
    if (!extracted) continue;
    features.push(extracted.feature);
    previous = { grays: extracted.grays, histogram: extracted.histogram };
  }
  const selections = selectAdaptiveVideoFramesFromFeatures(features, {
    maxSelected: Number(target.durationMs ?? 0) > 90_000 ? 8 : 6,
    minSelected: 1,
    minGapMs: Number(target.durationMs ?? 0) > 30_000 ? 1800 : 1000,
  });
  if (selections.length > 0) {
    return { strategy: "adaptive", selections };
  }
  return {
    strategy: "fallback",
    selections: fallbackVideoFrameTimesMs(target.durationMs).map((frameTimeMs) => ({
      frameTimeMs,
      brightness: 0,
      edgeScore: 0,
      diffScore: 0,
      colorDiffScore: 0,
      qualityScore: 0,
      selectionScore: 0,
      selectionReason: "固定時刻fallback",
    })),
  };
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
  const selected = await selectAdaptiveFrames(target);
  const frames: Array<{
    frameUrl: string;
    frameTimeMs: number;
    mime: string;
    b64: string;
    selection: VideoFrameSelection;
  }> = [];
  for (const selection of selected.selections) {
    const frame = await fetchVideoFrame(target.thumbnailUrl, selection.frameTimeMs, 720).catch(() => null);
    if (!frame) continue;
    frames.push({
      frameUrl: frame.frameUrl,
      frameTimeMs: frame.frameTimeMs,
      mime: frame.mime,
      b64: frame.bytes.toString("base64"),
      selection,
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
      selectionScore: frame.selection.selectionScore,
      selectionReason: frame.selection.selectionReason,
      differenceScore: Math.max(frame.selection.diffScore, frame.selection.colorDiffScore),
      qualityScore: frame.selection.qualityScore,
    })),
    promptVersion: "observation_reassess.md/v5.4+video_adaptive_frames",
    sourceTag: "video_adaptive_frames",
  });

  return {
    ...reassess,
    thumbnailUrl: target.thumbnailUrl,
    frameUrl: frames[0]?.frameUrl ?? "",
    frameUrls: frames.map((frame) => frame.frameUrl),
    frameCount: frames.length,
    frameTimesMs: frames.map((frame) => frame.frameTimeMs),
    selectionStrategy: selected.strategy,
    selectedFrames: frames.map((frame) => ({
      frameTimeMs: frame.frameTimeMs,
      selectionScore: frame.selection.selectionScore,
      selectionReason: frame.selection.selectionReason,
      differenceScore: Math.max(frame.selection.diffScore, frame.selection.colorDiffScore),
      qualityScore: frame.selection.qualityScore,
    })),
  };
}
