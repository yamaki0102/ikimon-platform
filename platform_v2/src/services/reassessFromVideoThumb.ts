import { getPool } from "../db.js";
import { reassessObservation, type ReassessResult } from "./observationReassess.js";

type VideoThumbTarget = {
  occurrenceId: string;
  thumbnailUrl: string;
};

export type ReassessFromVideoThumbResult = ReassessResult & {
  thumbnailUrl: string;
  frameUrl: string;
};

function normalizeImageMime(value: string | null): string {
  const normalized = (String(value ?? "").split(";")[0] ?? "")
    .trim()
    .toLowerCase();
  return normalized.startsWith("image/") ? normalized : "image/jpeg";
}

function buildVideoFrameUrl(thumbnailUrl: string): string {
  let url: URL;
  try {
    url = new URL(thumbnailUrl);
  } catch {
    throw new Error("invalid_video_thumbnail_url");
  }
  url.searchParams.set("time", "2s");
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
    thumbnail_url: string | null;
  }>(
    `select
        o.occurrence_id,
        coalesce(
          video.asset_source_payload ->> 'thumbnail_url',
          video.blob_source_payload ->> 'thumbnail_url',
          nullif(video.public_url, '')
        ) as thumbnail_url
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join lateral (
       select
         ea.source_payload as asset_source_payload,
         ab.source_payload as blob_source_payload,
         ab.public_url
       from evidence_assets ea
       join asset_blobs ab on ab.blob_id = ea.blob_id
       where ea.occurrence_id = o.occurrence_id
         and ea.asset_role = 'observation_video'
       order by ea.created_at desc
       limit 1
     ) video on true
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
    thumbnailUrl: row.thumbnail_url,
  };
}

export async function reassessFromVideoThumb(observationId: string): Promise<ReassessFromVideoThumbResult> {
  const target = await resolveVideoThumbTarget(observationId);
  if (!target) {
    throw new Error("observation_video_not_found");
  }
  const frameUrl = buildVideoFrameUrl(target.thumbnailUrl);
  const response = await fetch(frameUrl, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
  });
  if (!response.ok) {
    throw new Error("video_thumbnail_fetch_failed");
  }
  const contentType = response.headers.get("content-type");
  if (!String(contentType ?? "").toLowerCase().startsWith("image/")) {
    throw new Error("video_thumbnail_not_image");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength <= 0) {
    throw new Error("video_thumbnail_empty");
  }
  if (bytes.byteLength > 12 * 1024 * 1024) {
    throw new Error("video_thumbnail_too_large");
  }

  const reassess = await reassessObservation(target.occurrenceId, {
    photos: [
      {
        mime: normalizeImageMime(response.headers.get("content-type")),
        b64: bytes.toString("base64"),
      },
    ],
    promptVersion: "observation_reassess.md/v1+video_thumb",
    sourceTag: "video_thumb",
  });

  return {
    ...reassess,
    thumbnailUrl: target.thumbnailUrl,
    frameUrl,
  };
}
