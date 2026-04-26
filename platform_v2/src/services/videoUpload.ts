import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { upsertAssetBlob } from "./writeSupport.js";
import { normalizeMediaRole, type MediaRole } from "./mediaRole.js";
import { upsertEvidenceAssetMediaRole } from "./evidenceAssetMediaRole.js";

const API_BASE = "https://api.cloudflare.com/client/v4/accounts/";
const DEFAULT_MAX_DURATION_SECONDS = 15;
const MIN_DURATION_SECONDS = 6;
const MAX_DURATION_SECONDS_HARD_CAP = 60;

export type CreateVideoUploadInput = {
  maxDurationSeconds?: number;
  filename?: string;
  actorId: string;
  observationId?: string | null;
  mediaRole?: MediaRole | string | null;
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

export type FinalizeVideoUploadInput = {
  uid: string;
  actorId: string;
  observationId?: string | null;
  mediaRole?: MediaRole | string | null;
};

export type FinalizeVideoUploadResult = VideoRecord & {
  occurrenceId: string | null;
  visitId: string | null;
};

type ObservationTarget = {
  occurrenceId: string;
  visitId: string;
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
    ikimon_media_role: normalizeMediaRole(input.mediaRole),
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

async function resolveObservationTarget(client: PoolClient, observationId: string): Promise<ObservationTarget | null> {
  const id = observationId.trim();
  if (!id) {
    return null;
  }
  const target = await client.query<{ occurrence_id: string; visit_id: string }>(
    `select
        o.occurrence_id,
        v.visit_id
     from visits v
     join occurrences o on o.visit_id = v.visit_id
     where (v.visit_id = $1 or v.legacy_observation_id = $1 or o.occurrence_id = $1)
     order by o.subject_index asc, o.created_at asc
     limit 1`,
    [id],
  );
  const row = target.rows[0];
  if (!row) {
    return null;
  }
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
  };
}

function maxDurationFromRecord(record: VideoRecord): number {
  const sec = Math.ceil(Math.max(1, record.durationMs) / 1000);
  return Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS_HARD_CAP, sec));
}

export async function finalizeVideoUpload(input: FinalizeVideoUploadInput): Promise<FinalizeVideoUploadResult | null> {
  const uid = input.uid.trim();
  if (!uid) {
    throw new Error("invalid_uid");
  }
  const record = await fetchVideoRecord(uid);
  if (!record) {
    return null;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const current = await client.query<{ actor_id: string; observation_id: string | null; meta: Record<string, unknown> | null }>(
      `select actor_id, observation_id, meta
         from video_upload_requests
        where stream_uid = $1
        for update`,
      [uid],
    );
    const issued = current.rows[0];
    if (issued && issued.actor_id !== input.actorId) {
      throw new Error("forbidden_video_owner");
    }

    const requestedObservationId = input.observationId?.trim() || issued?.observation_id || null;
    const target = requestedObservationId ? await resolveObservationTarget(client, requestedObservationId) : null;
    if (requestedObservationId && !target) {
      throw new Error("observation_not_found");
    }

    const issuedMeta = issued?.meta && typeof issued.meta === "object" ? issued.meta : {};
    const mediaRole = normalizeMediaRole(input.mediaRole ?? issuedMeta.ikimon_media_role ?? issuedMeta.media_role);
    const meta = {
      source: "v2_video_finalize",
      stream_uid: uid,
      media_role: mediaRole,
      iframe_url: record.iframeUrl,
      watch_url: record.watchUrl,
      thumbnail_url: record.thumbnailUrl,
      upload_status: record.uploadStatus,
      ready_to_stream: record.readyToStream,
      observation_id: requestedObservationId,
    };

    await client.query(
      `insert into video_upload_requests (
          stream_uid, actor_id, observation_id, upload_status, max_duration_seconds,
          stream_duration_ms, stream_bytes, ready_to_stream, meta, created_at, updated_at
       ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), now()
       )
       on conflict (stream_uid) do update set
          observation_id = coalesce(excluded.observation_id, video_upload_requests.observation_id),
          upload_status = excluded.upload_status,
          stream_duration_ms = excluded.stream_duration_ms,
          stream_bytes = excluded.stream_bytes,
          ready_to_stream = excluded.ready_to_stream,
          meta = coalesce(video_upload_requests.meta, '{}'::jsonb) || excluded.meta,
          updated_at = now()`,
      [
        uid,
        input.actorId,
        requestedObservationId,
        record.uploadStatus,
        maxDurationFromRecord(record),
        record.durationMs,
        record.bytes,
        record.readyToStream,
        JSON.stringify(meta),
      ],
    );

    const blobId = await upsertAssetBlob(client, {
      storageBackend: "cloudflare_stream",
      storagePath: uid,
      mediaType: "video",
      mimeType: "video/mp4",
      publicUrl: record.watchUrl,
      bytes: record.bytes > 0 ? record.bytes : null,
      durationMs: record.durationMs > 0 ? record.durationMs : null,
      sourcePayload: meta,
    });

    if (target) {
      const legacyAssetKey = `observation_video:${target.visitId}:${uid}`;
      const legacyRelativePath = `cloudflare_stream/${uid}`;
      const assetResult = await client.query<{ asset_id: string }>(
        `insert into evidence_assets (
            asset_id, blob_id, occurrence_id, visit_id, asset_role,
            legacy_asset_key, legacy_relative_path, source_payload, captured_at
         ) values (
            $1::uuid, $2::uuid, $3, $4, 'observation_video',
            $5, $6, $7::jsonb, $8::timestamptz
         )
         on conflict (legacy_asset_key) do update set
            blob_id = excluded.blob_id,
            occurrence_id = excluded.occurrence_id,
            visit_id = excluded.visit_id,
            legacy_relative_path = excluded.legacy_relative_path,
            source_payload = excluded.source_payload,
            captured_at = excluded.captured_at
         returning asset_id::text`,
        [
          randomUUID(),
          blobId,
          target.occurrenceId,
          target.visitId,
          legacyAssetKey,
          legacyRelativePath,
          JSON.stringify(meta),
          record.uploadedAt,
        ],
      );
      const assetId = assetResult.rows[0]?.asset_id;
      if (!assetId) {
        throw new Error("failed_to_upsert_video_asset");
      }
      await upsertEvidenceAssetMediaRole(client, {
        assetId,
        occurrenceId: target.occurrenceId,
        visitId: target.visitId,
        assetRole: "observation_video",
        mediaRole,
        mediaRoleSource: "user",
        sourcePayload: {
          source: "v2_video_finalize",
          stream_uid: uid,
        },
      });
    }

    await client.query("commit");
    return {
      ...record,
      occurrenceId: target?.occurrenceId ?? null,
      visitId: target?.visitId ?? null,
    };
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
