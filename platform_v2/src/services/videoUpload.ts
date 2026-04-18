import { loadConfig } from "../config.js";
import { getPool } from "../db.js";

const API_BASE = "https://api.cloudflare.com/client/v4/accounts/";
const DEFAULT_MAX_DURATION_SECONDS = 15;
const MIN_DURATION_SECONDS = 6;
const MAX_DURATION_SECONDS_HARD_CAP = 60;

export type CreateVideoUploadInput = {
  maxDurationSeconds?: number;
  filename?: string;
  actorId: string;
  observationId?: string | null;
};

export type CreateVideoUploadResult = {
  uid: string;
  uploadUrl: string;
  maxDurationSeconds: number;
  iframeUrl: string;
  thumbnailUrl: string;
};

export type VideoRecord = {
  provider: "cloudflare_stream";
  providerUid: string;
  mediaType: "video";
  assetRole: "observation_video";
  uploadStatus: string;
  durationMs: number;
  bytes: number;
  thumbnailUrl: string;
  iframeUrl: string;
  watchUrl: string;
  readyToStream: boolean;
  createdAt: string;
  uploadedAt: string | null;
};

function cfConfigOrThrow() {
  const cfg = loadConfig().cloudflare;
  if (!cfg) throw new Error("cloudflare_stream_not_configured");
  return cfg;
}

async function cfRequest(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const cfg = cfConfigOrThrow();
  const url = `${API_BASE}${encodeURIComponent(cfg.accountId)}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.streamApiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`cloudflare_invalid_response: ${text.slice(0, 200)}`);
  }
  if (!res.ok || (json as { success?: boolean }).success === false) {
    throw new Error(`cloudflare_error: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

export function buildIframeUrl(uid: string): string {
  const { streamCustomerSubdomain } = cfConfigOrThrow();
  return `https://${streamCustomerSubdomain}/${encodeURIComponent(uid)}/iframe`;
}

export function buildWatchUrl(uid: string): string {
  const { streamCustomerSubdomain } = cfConfigOrThrow();
  return `https://${streamCustomerSubdomain}/${encodeURIComponent(uid)}/watch`;
}

export function buildThumbnailUrl(uid: string, time = "1s", height = 720): string {
  const { streamCustomerSubdomain } = cfConfigOrThrow();
  const h = Math.max(120, Math.min(1080, height));
  return `https://${streamCustomerSubdomain}/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}&height=${h}`;
}

export async function createVideoDirectUpload(input: CreateVideoUploadInput): Promise<CreateVideoUploadResult> {
  const maxDurationSeconds = Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS_HARD_CAP, Math.trunc(input.maxDurationSeconds ?? DEFAULT_MAX_DURATION_SECONDS)),
  );
  const meta: Record<string, string> = {
    ikimon_actor: input.actorId,
    ikimon_origin: "v2_record",
  };
  if (input.observationId) meta.ikimon_observation_id = input.observationId;
  if (input.filename) meta.name = input.filename.slice(0, 120);

  const response = await cfRequest("POST", "stream/direct_upload", {
    maxDurationSeconds,
    meta,
  });
  const result = (response.result ?? {}) as Record<string, unknown>;
  const uid = String(result.uid ?? "");
  const uploadUrl = String(result.uploadURL ?? "");
  if (!uid || !uploadUrl) {
    throw new Error("cloudflare_missing_upload_info");
  }

  // Track in DB for audit trail.
  try {
    await getPool().query(
      `insert into video_upload_requests
         (stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename, meta)
       values ($1, $2, $3, 'issued', $4, $5, $6::jsonb)
       on conflict (stream_uid) do update
         set updated_at = now(),
             upload_status = 'issued'`,
      [uid, input.actorId, input.observationId ?? null, maxDurationSeconds, input.filename ?? "", JSON.stringify(meta)],
    );
  } catch {
    // Audit log failure must not block the upload URL — Cloudflare already issued it.
  }

  return {
    uid,
    uploadUrl,
    maxDurationSeconds,
    iframeUrl: buildIframeUrl(uid),
    thumbnailUrl: buildThumbnailUrl(uid),
  };
}

export async function fetchVideoRecord(uid: string): Promise<VideoRecord | null> {
  if (!uid.trim()) throw new Error("invalid_uid");
  try {
    const response = await cfRequest("GET", `stream/${encodeURIComponent(uid)}`);
    const result = (response.result ?? {}) as Record<string, unknown>;
    const durationSec = Number(result.duration ?? 0);
    const bytes = Number(result.size ?? 0);
    return {
      provider: "cloudflare_stream",
      providerUid: uid,
      mediaType: "video",
      assetRole: "observation_video",
      uploadStatus: String(((result.status ?? {}) as Record<string, unknown>).state ?? "unknown"),
      durationMs: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : 0,
      bytes: Number.isFinite(bytes) ? Math.round(bytes) : 0,
      thumbnailUrl: String(result.thumbnail ?? "") || buildThumbnailUrl(uid),
      iframeUrl: buildIframeUrl(uid),
      watchUrl: String(result.preview ?? "") || buildWatchUrl(uid),
      readyToStream: Boolean(result.readyToStream),
      createdAt: String(result.created ?? new Date().toISOString()),
      uploadedAt: typeof result.uploaded === "string" ? (result.uploaded as string) : null,
    };
  } catch {
    return null;
  }
}

export async function markVideoReady(uid: string): Promise<VideoRecord | null> {
  const record = await fetchVideoRecord(uid);
  if (!record) return null;
  try {
    await getPool().query(
      `update video_upload_requests
          set upload_status = $2,
              stream_duration_ms = $3,
              stream_bytes = $4,
              ready_to_stream = $5,
              updated_at = now()
        where stream_uid = $1`,
      [uid, record.uploadStatus, record.durationMs, record.bytes, record.readyToStream],
    );
  } catch {
    // best-effort
  }
  return record;
}
