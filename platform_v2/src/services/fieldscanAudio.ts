import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { upsertAssetBlob } from "./writeSupport.js";

const AUDIO_STORAGE_BACKEND = "private_audio_fs";
const DEFAULT_CAPTURE_PROFILE = "opus_mono_24khz_32kbps_2s";
const ALLOWED_COMPRESSED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "video/webm",
  "audio/ogg",
  "audio/mp4",
]);

export type AudioPrivacyStatus = "pending_voice_check" | "clean" | "deleted_human_voice";

export type AudioFingerprintSummary = {
  version?: string;
  frameCount?: number;
  peakHz?: number;
  centroidHz?: number;
  rolloffHz?: number;
  energy?: number;
  voiceBandRatio?: number;
  bandEnergies?: number[];
};

export type ClientVadResult = {
  speechLikely: boolean;
  confidence?: number;
  reason?: string;
  voiceBandRatio?: number;
  energy?: number;
};

export type AudioSegmentMeta = Record<string, unknown> & {
  audioFingerprint?: AudioFingerprintSummary;
  captureProfile?: string;
  clientVadResult?: ClientVadResult;
};

export type AudioSegmentSubmitInput = {
  externalId?: string;
  sessionId: string;
  visitId?: string | null;
  placeId?: string | null;
  userId?: string | null;
  recordedAt: string;
  durationSec?: number;
  lat?: number | null;
  lng?: number | null;
  azimuth?: number | null;
  storagePath?: string;
  storageProvider?: string;
  mimeType?: string;
  bytes?: number;
  filename?: string;
  base64Data?: string;
  meta?: AudioSegmentMeta;
};

export type AudioSegmentSubmitResult = {
  segmentId: string;
  created: boolean;
  privacyStatus: AudioPrivacyStatus;
};

export type AudioDetectionCallbackInput = {
  segmentId?: string;
  externalId?: string;
  detections: Array<{
    detectedTaxon: string;
    scientificName?: string;
    confidence?: number;
    provider?: string;
    offsetSec?: number;
    durationSec?: number;
    dualAgree?: boolean;
    rawScore?: Record<string, unknown>;
  }>;
};

export type AudioPrivacyCallbackInput = {
  segmentId?: string;
  externalId?: string;
  decision: Extract<AudioPrivacyStatus, "clean" | "deleted_human_voice">;
  reason?: string;
  confidence?: number;
};

export type SoundBundle = {
  bundleId: string;
  label: string;
  segmentCount: number;
  totalDurationSec: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  representativeSegmentId: string | null;
  representativeAudioUrl: string | null;
  candidateTaxon: string | null;
  bestConfidence: number | null;
  dualAgree: boolean;
  note: string;
};

export type SessionRecap = {
  sessionId: string;
  segmentCount: number;
  cleanSegmentCount: number;
  totalDurationSec: number;
  naturalDurationSec: number;
  privacySkippedCount: number;
  lastRecordedAt: string | null;
  uniqueTaxa: Array<{ taxon: string; count: number; bestConfidence: number; provider: string }>;
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null;
  soundBundles: SoundBundle[];
};

type AudioSegmentRow = {
  segment_id: string;
  session_id: string;
  user_id: string | null;
  visit_id: string | null;
  place_id: string | null;
  recorded_at: string;
  duration_sec: number;
  storage_path: string;
  storage_provider: string;
  mime_type: string;
  bytes: number;
  blob_id: string | null;
  privacy_status: AudioPrivacyStatus;
  fingerprint: Record<string, unknown> | null;
};

type PendingDeletion = {
  storagePath: string;
};

function requireField<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${name}_required`);
  }
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeNumericArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((entry) => numberFromUnknown(entry))
    .filter((entry): entry is number => entry !== undefined)
    .slice(0, 8);
  return out.length ? out : undefined;
}

function normalizeAudioFingerprint(value: unknown): AudioFingerprintSummary | null {
  const input = normalizeJsonRecord(value);
  if (Object.keys(input).length === 0) return null;
  return {
    version: typeof input.version === "string" ? input.version : "v1",
    frameCount: numberFromUnknown(input.frameCount),
    peakHz: numberFromUnknown(input.peakHz),
    centroidHz: numberFromUnknown(input.centroidHz),
    rolloffHz: numberFromUnknown(input.rolloffHz),
    energy: numberFromUnknown(input.energy),
    voiceBandRatio: numberFromUnknown(input.voiceBandRatio),
    bandEnergies: normalizeNumericArray(input.bandEnergies),
  };
}

function normalizeVadResult(value: unknown): ClientVadResult | null {
  const input = normalizeJsonRecord(value);
  if (typeof input.speechLikely !== "boolean") return null;
  return {
    speechLikely: input.speechLikely,
    confidence: numberFromUnknown(input.confidence),
    reason: typeof input.reason === "string" ? input.reason : undefined,
    voiceBandRatio: numberFromUnknown(input.voiceBandRatio),
    energy: numberFromUnknown(input.energy),
  };
}

function normalizeMeta(meta: AudioSegmentMeta | undefined): AudioSegmentMeta {
  const record = normalizeJsonRecord(meta);
  const captureProfile = typeof record.captureProfile === "string" && record.captureProfile.trim() !== ""
    ? record.captureProfile.trim()
    : DEFAULT_CAPTURE_PROFILE;
  const audioFingerprint = normalizeAudioFingerprint(record.audioFingerprint);
  const clientVadResult = normalizeVadResult(record.clientVadResult);
  return {
    ...record,
    captureProfile,
    ...(audioFingerprint ? { audioFingerprint } : {}),
    ...(clientVadResult ? { clientVadResult } : {}),
  };
}

function canonicalAudioMimeType(rawMime: string | undefined): string {
  const mime = (rawMime ?? "audio/webm").trim().toLowerCase();
  const baseMime = mime.split(";")[0]?.trim() || "audio/webm";
  if (baseMime === "video/webm") return "audio/webm";
  return baseMime || "audio/webm";
}

function assertCompressedAudioMime(rawMime: string | undefined): string {
  const requested = canonicalAudioMimeType(rawMime);
  const mime = canonicalAudioMimeType(rawMime);
  if (!ALLOWED_COMPRESSED_AUDIO_MIME_TYPES.has(requested || mime) && !ALLOWED_COMPRESSED_AUDIO_MIME_TYPES.has(mime)) {
    throw new Error("unsupported_audio_format");
  }
  return mime;
}

function extensionForAudioMime(mime: string): string {
  switch (canonicalAudioMimeType(mime)) {
    case "audio/ogg":
      return ".ogg";
    case "audio/mp4":
      return ".m4a";
    default:
      return ".webm";
  }
}

function normalizeBase64(input: string): string {
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function sanitizeFilename(filename: string): string {
  const safe = filename.trim().replace(/[^A-Za-z0-9._-]/g, "-");
  return safe === "" ? "chunk" : safe;
}

export function getAudioStorageRoot(): string {
  const config = loadConfig();
  return path.resolve(config.legacyDataRoot, "..", "private_uploads");
}

function resolveAudioAbsolutePath(storagePath: string): string {
  const root = getAudioStorageRoot();
  const full = path.resolve(root, storagePath);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("audio_storage_path_escape");
  }
  return full;
}

function audioUploadRelativePath(sessionId: string, recordedAt: string, mimeType: string, filename?: string): string {
  const date = new Date(recordedAt);
  const yearMonth = Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 7);
  const sessionSlug = sessionId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) || "session";
  const baseName = sanitizeFilename(filename ?? "chunk").replace(/\.[A-Za-z0-9]+$/, "");
  const stamped = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return path.posix.join("v2-audio", yearMonth, sessionSlug, `${baseName}-${stamped}${extensionForAudioMime(mimeType)}`);
}

function buildBundleKey(fingerprint: AudioFingerprintSummary | null, segmentId: string): string {
  if (!fingerprint) return `solo:${segmentId}`;
  const peakBucket = Math.max(0, Math.round((fingerprint.peakHz ?? 0) / 250));
  const centroidBucket = Math.max(0, Math.round((fingerprint.centroidHz ?? 0) / 400));
  const rolloffBucket = Math.max(0, Math.round((fingerprint.rolloffHz ?? 0) / 600));
  const energyBucket = Math.max(0, Math.round(clamp01(fingerprint.energy ?? 0) * 10));
  const voiceBucket = Math.max(0, Math.round(clamp01(fingerprint.voiceBandRatio ?? 0) * 10));
  const dominantBand = Array.isArray(fingerprint.bandEnergies) && fingerprint.bandEnergies.length
    ? fingerprint.bandEnergies
      .map((value, index) => ({ index, value }))
      .sort((left, right) => right.value - left.value)[0]?.index ?? 0
    : 0;
  return `v1:${dominantBand}:${peakBucket}:${centroidBucket}:${rolloffBucket}:${energyBucket}:${voiceBucket}`;
}

function bundleLabelForIndex(index: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return `音${alphabet[index]}`;
  return `音${index + 1}`;
}

function deriveBundleNote(candidateTaxon: string | null): string {
  if (candidateTaxon && candidateTaxon.trim() !== "") {
    return `候補: ${candidateTaxon}`;
  }
  return "まだ名前が付いていない音";
}

function decideInitialPrivacy(meta: AudioSegmentMeta, hasInlineAudio: boolean): {
  decision: Extract<AudioPrivacyStatus, "clean" | "deleted_human_voice">;
  reason: string;
  voiceFlag: boolean;
} {
  if (!hasInlineAudio) {
    return { decision: "clean", reason: "external_storage_path", voiceFlag: false };
  }

  const vad = normalizeVadResult(meta.clientVadResult);
  if (!vad) {
    return { decision: "deleted_human_voice", reason: "missing_client_vad", voiceFlag: true };
  }

  const confidence = vad.confidence ?? 0;
  const voiceBandRatio = vad.voiceBandRatio ?? 0;
  if (vad.speechLikely || voiceBandRatio >= 0.72) {
    return { decision: "deleted_human_voice", reason: vad.reason ?? "client_vad_speech", voiceFlag: true };
  }

  if (confidence < 0.55) {
    return { decision: "deleted_human_voice", reason: "client_vad_uncertain", voiceFlag: true };
  }

  return { decision: "clean", reason: vad.reason ?? "client_vad_clear", voiceFlag: false };
}

async function persistInlineAudio(client: PoolClient, input: AudioSegmentSubmitInput, mimeType: string, meta: AudioSegmentMeta): Promise<{
  storagePath: string;
  storageProvider: string;
  bytes: number;
  blobId: string;
  cleanupOnRollback: string;
}> {
  const base64Data = requireField(input.base64Data, "base64Data");
  const buffer = Buffer.from(normalizeBase64(base64Data), "base64");
  if (buffer.byteLength === 0) {
    throw new Error("decoded_audio_empty");
  }
  if (buffer.byteLength > 3 * 1024 * 1024) {
    throw new Error("audio_too_large");
  }

  const storagePath = audioUploadRelativePath(input.sessionId, input.recordedAt, mimeType, input.filename);
  const absolutePath = resolveAudioAbsolutePath(storagePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const blobId = await upsertAssetBlob(client, {
    storageBackend: AUDIO_STORAGE_BACKEND,
    storagePath,
    mediaType: "audio",
    mimeType,
    publicUrl: null,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.byteLength,
    durationMs: Math.round((input.durationSec ?? 0) * 1000),
    sourcePayload: {
      source: "fieldscan_audio_submit",
      sessionId: input.sessionId,
      captureProfile: meta.captureProfile ?? DEFAULT_CAPTURE_PROFILE,
    },
  });

  return {
    storagePath,
    storageProvider: AUDIO_STORAGE_BACKEND,
    bytes: buffer.byteLength,
    blobId,
    cleanupOnRollback: storagePath,
  };
}

async function findSegment(
  client: PoolClient,
  input: { segmentId?: string; externalId?: string },
): Promise<AudioSegmentRow | null> {
  const clauses: string[] = [];
  const params: Array<string> = [];
  if (input.segmentId) {
    params.push(input.segmentId);
    clauses.push(`segment_id = $${params.length}`);
  }
  if (input.externalId) {
    params.push(input.externalId);
    clauses.push(`external_id = $${params.length}`);
  }
  if (clauses.length === 0) return null;
  const result = await client.query<AudioSegmentRow>(
    `select segment_id, session_id, user_id, visit_id, place_id, recorded_at::text as recorded_at,
            duration_sec, storage_path, storage_provider, mime_type, bytes, blob_id, privacy_status, fingerprint
       from audio_segments
      where ${clauses.join(" or ")}
      order by created_at desc
      limit 1`,
    params,
  );
  return result.rows[0] ?? null;
}

async function deletePendingFiles(paths: PendingDeletion[]): Promise<void> {
  for (const item of paths) {
    try {
      await unlink(resolveAudioAbsolutePath(item.storagePath));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function markSegmentClean(
  client: PoolClient,
  segmentId: string,
  reason: string,
): Promise<void> {
  const payload = JSON.stringify({
    privacyDecision: {
      decidedAt: new Date().toISOString(),
      decision: "clean",
      reason,
    },
  });
  await client.query(
    `update audio_segments
        set privacy_status = 'clean',
            voice_flag = false,
            privacy_checked_at = now(),
            privacy_reason = $2,
            visibility = 'owner_only',
            meta = coalesce(meta, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where segment_id = $1`,
    [segmentId, reason, payload],
  );
}

async function markSegmentDeleted(
  client: PoolClient,
  segmentId: string,
  reason: string,
  confidence?: number,
): Promise<PendingDeletion[]> {
  const segment = await findSegment(client, { segmentId });
  if (!segment) {
    throw new Error("segment_not_found");
  }
  const pendingDeletions: PendingDeletion[] = [];
  if (segment.storage_provider === AUDIO_STORAGE_BACKEND && segment.storage_path) {
    pendingDeletions.push({ storagePath: segment.storage_path });
  }
  if (segment.blob_id) {
    await client.query(`delete from asset_blobs where blob_id = $1`, [segment.blob_id]);
  }
  const payload = JSON.stringify({
    privacyDecision: {
      decidedAt: new Date().toISOString(),
      decision: "deleted_human_voice",
      reason,
      confidence: confidence ?? null,
    },
  });
  await client.query(
    `update audio_segments
        set blob_id = null,
            storage_path = '',
            storage_provider = 'deleted',
            bytes = 0,
            privacy_status = 'deleted_human_voice',
            voice_flag = true,
            privacy_checked_at = now(),
            privacy_reason = $2,
            visibility = 'owner_only',
            transcription_status = 'skipped',
            meta = coalesce(meta, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where segment_id = $1`,
    [segmentId, reason, payload],
  );
  return pendingDeletions;
}

async function rebuildSessionBundles(client: PoolClient, sessionId: string): Promise<void> {
  await client.query(
    `delete from sound_bundle_members
      where bundle_id in (select bundle_id from sound_bundles where session_id = $1)`,
    [sessionId],
  );
  await client.query(`delete from sound_bundles where session_id = $1`, [sessionId]);

  const segmentResult = await client.query<{
    segment_id: string;
    user_id: string | null;
    visit_id: string | null;
    place_id: string | null;
    recorded_at: string;
    duration_sec: number;
    fingerprint: Record<string, unknown> | null;
  }>(
    `select segment_id,
            user_id,
            visit_id,
            place_id,
            recorded_at::text as recorded_at,
            duration_sec,
            fingerprint
       from audio_segments
      where session_id = $1
        and privacy_status = 'clean'
      order by recorded_at asc, segment_id asc`,
    [sessionId],
  );

  if (segmentResult.rows.length === 0) {
    return;
  }

  const detectionResult = await client.query<{
    segment_id: string;
    detected_taxon: string;
    confidence: number;
    dual_agree: boolean;
  }>(
    `select d.segment_id, d.detected_taxon, d.confidence, d.dual_agree
       from audio_detections d
       join audio_segments s on s.segment_id = d.segment_id
      where s.session_id = $1
        and s.privacy_status = 'clean'`,
    [sessionId],
  );

  const detectionsBySegment = new Map<string, Array<{ detectedTaxon: string; confidence: number; dualAgree: boolean }>>();
  for (const row of detectionResult.rows) {
    const bucket = detectionsBySegment.get(row.segment_id) ?? [];
    bucket.push({
      detectedTaxon: row.detected_taxon,
      confidence: Number(row.confidence),
      dualAgree: row.dual_agree,
    });
    detectionsBySegment.set(row.segment_id, bucket);
  }

  const bundleMap = new Map<string, typeof segmentResult.rows>();
  for (const row of segmentResult.rows) {
    const bundleKey = buildBundleKey(normalizeAudioFingerprint(row.fingerprint), row.segment_id);
    const bucket = bundleMap.get(bundleKey) ?? [];
    bucket.push(row);
    bundleMap.set(bundleKey, bucket);
  }

  for (const [bundleKey, rows] of bundleMap) {
    if (rows.length === 0) continue;
    let representative = rows[0]!;
    let representativeEnergy = normalizeAudioFingerprint(rows[0]!.fingerprint)?.energy ?? 0;
    let totalDurationSec = 0;
    let firstRecordedAt = rows[0]!.recorded_at;
    let lastRecordedAt = rows[0]!.recorded_at;
    let candidateTaxon: string | null = null;
    let bestConfidence = -1;
    let dualAgree = false;

    for (const row of rows) {
      totalDurationSec += Number(row.duration_sec) || 0;
      if (row.recorded_at < firstRecordedAt) firstRecordedAt = row.recorded_at;
      if (row.recorded_at > lastRecordedAt) lastRecordedAt = row.recorded_at;
      const fingerprint = normalizeAudioFingerprint(row.fingerprint);
      const energy = fingerprint?.energy ?? 0;
      if (energy > representativeEnergy) {
        representative = row;
        representativeEnergy = energy;
      }
      for (const detection of detectionsBySegment.get(row.segment_id) ?? []) {
        if (detection.confidence > bestConfidence) {
          bestConfidence = detection.confidence;
          candidateTaxon = detection.detectedTaxon;
          dualAgree = detection.dualAgree;
        }
      }
    }

    const bundleInsert = await client.query<{ bundle_id: string }>(
      `insert into sound_bundles (
          session_id, user_id, visit_id, place_id, bundle_key,
          representative_segment_id, representative_fingerprint,
          segment_count, total_duration_sec, first_recorded_at, last_recorded_at,
          candidate_taxon, best_confidence, dual_agree, updated_at
       ) values (
          $1, $2, $3, $4, $5,
          $6, $7::jsonb,
          $8, $9, $10, $11,
          $12, $13, $14, now()
       )
       returning bundle_id`,
      [
        sessionId,
        representative.user_id,
        representative.visit_id,
        representative.place_id,
        bundleKey,
        representative.segment_id,
        JSON.stringify(normalizeAudioFingerprint(representative.fingerprint) ?? {}),
        rows.length,
        totalDurationSec,
        firstRecordedAt,
        lastRecordedAt,
        candidateTaxon,
        bestConfidence >= 0 ? bestConfidence : null,
        dualAgree,
      ],
    );
    const bundleId = bundleInsert.rows[0]?.bundle_id;
    if (!bundleId) {
      throw new Error(`Failed to create sound bundle for session ${sessionId}`);
    }

    for (const row of rows) {
      await client.query(
        `insert into sound_bundle_members (bundle_id, segment_id) values ($1, $2)`,
        [bundleId, row.segment_id],
      );
    }
  }
}

export async function submitAudioSegment(input: AudioSegmentSubmitInput): Promise<AudioSegmentSubmitResult> {
  const sessionId = requireField(input.sessionId, "sessionId");
  requireField(input.recordedAt, "recordedAt");
  const meta = normalizeMeta(input.meta);
  const hasInlineAudio = typeof input.base64Data === "string" && input.base64Data.trim() !== "";
  if (!hasInlineAudio && !(input.storagePath && input.storagePath.trim() !== "")) {
    throw new Error("audio_payload_required");
  }

  const pool = getPool();
  const client = await pool.connect();
  const rollbackDeletions: PendingDeletion[] = [];
  const commitDeletions: PendingDeletion[] = [];
  try {
    await client.query("begin");

    let storagePath = input.storagePath ?? "";
    let storageProvider = input.storageProvider ?? "local";
    let mimeType = canonicalAudioMimeType(input.mimeType);
    let bytes = input.bytes ?? 0;
    let blobId: string | null = null;

    if (hasInlineAudio) {
      mimeType = assertCompressedAudioMime(input.mimeType);
      const persisted = await persistInlineAudio(client, input, mimeType, meta);
      storagePath = persisted.storagePath;
      storageProvider = persisted.storageProvider;
      bytes = persisted.bytes;
      blobId = persisted.blobId;
      rollbackDeletions.push({ storagePath: persisted.cleanupOnRollback });
    }

    const insertResult = await client.query<{ segment_id: string; created: boolean }>(
      `insert into audio_segments
         (external_id, session_id, user_id, visit_id, place_id, recorded_at, duration_sec,
          lat, lng, azimuth, blob_id, storage_path, storage_provider, mime_type, bytes,
          transcription_status, meta, privacy_status, voice_flag, visibility,
          compression_profile, fingerprint)
       values ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, $13, $14, $15,
               'pending', $16::jsonb, 'pending_voice_check', false, 'owner_only',
               $17, $18::jsonb)
       on conflict (external_id) do update set
          user_id = excluded.user_id,
          visit_id = excluded.visit_id,
          place_id = excluded.place_id,
          recorded_at = excluded.recorded_at,
          duration_sec = excluded.duration_sec,
          lat = excluded.lat,
          lng = excluded.lng,
          azimuth = excluded.azimuth,
          blob_id = coalesce(excluded.blob_id, audio_segments.blob_id),
          storage_path = excluded.storage_path,
          storage_provider = excluded.storage_provider,
          mime_type = excluded.mime_type,
          bytes = excluded.bytes,
          transcription_status = 'pending',
          meta = excluded.meta,
          privacy_status = 'pending_voice_check',
          voice_flag = false,
          visibility = 'owner_only',
          compression_profile = excluded.compression_profile,
          fingerprint = excluded.fingerprint,
          updated_at = now()
       returning segment_id, (xmax = 0) as created`,
      [
        input.externalId ?? null,
        sessionId,
        input.userId ?? null,
        input.visitId ?? null,
        input.placeId ?? null,
        input.recordedAt,
        input.durationSec ?? 0,
        input.lat ?? null,
        input.lng ?? null,
        input.azimuth ?? null,
        blobId,
        storagePath,
        storageProvider,
        mimeType,
        bytes,
        JSON.stringify(meta),
        meta.captureProfile ?? DEFAULT_CAPTURE_PROFILE,
        JSON.stringify(meta.audioFingerprint ?? {}),
      ],
    );

    const row = insertResult.rows[0];
    if (!row) {
      throw new Error("audio_segment_insert_failed");
    }

    const decision = decideInitialPrivacy(meta, hasInlineAudio);
    if (decision.decision === "clean") {
      await markSegmentClean(client, row.segment_id, decision.reason);
    } else {
      commitDeletions.push(...await markSegmentDeleted(client, row.segment_id, decision.reason));
    }

    await rebuildSessionBundles(client, sessionId);
    await client.query("commit");

    rollbackDeletions.length = 0;
    if (commitDeletions.length > 0) {
      await deletePendingFiles(commitDeletions);
    }

    return {
      segmentId: row.segment_id,
      created: row.created,
      privacyStatus: decision.decision,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (rollbackDeletions.length > 0) {
      await deletePendingFiles(rollbackDeletions).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAudioPrivacyDecision(input: AudioPrivacyCallbackInput): Promise<{ segmentId: string; privacyStatus: AudioPrivacyStatus }> {
  if (input.decision !== "clean" && input.decision !== "deleted_human_voice") {
    throw new Error("invalid_privacy_decision");
  }

  const pool = getPool();
  const client = await pool.connect();
  const commitDeletions: PendingDeletion[] = [];
  try {
    await client.query("begin");
    const segment = await findSegment(client, input);
    if (!segment) {
      throw new Error("segment_not_found");
    }

    if (input.decision === "clean") {
      if (segment.privacy_status === "deleted_human_voice") {
        throw new Error("deleted_segment_cannot_be_restored");
      }
      await markSegmentClean(client, segment.segment_id, input.reason ?? "privacy_callback_clean");
    } else {
      commitDeletions.push(...await markSegmentDeleted(
        client,
        segment.segment_id,
        input.reason ?? "privacy_callback_deleted",
        input.confidence,
      ));
    }

    await rebuildSessionBundles(client, segment.session_id);
    await client.query("commit");

    if (commitDeletions.length > 0) {
      await deletePendingFiles(commitDeletions);
    }

    return {
      segmentId: segment.segment_id,
      privacyStatus: input.decision,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAudioDetections(input: AudioDetectionCallbackInput): Promise<{ inserted: number; skipped: number }> {
  if (!Array.isArray(input.detections) || input.detections.length === 0) {
    throw new Error("detections_required");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const segment = await findSegment(client, input);
    if (!segment) {
      throw new Error("segmentId_required");
    }

    if (segment.privacy_status !== "clean") {
      await client.query(
        `update audio_segments
            set transcription_status = 'skipped',
                updated_at = now()
          where segment_id = $1`,
        [segment.segment_id],
      );
      await client.query("commit");
      return { inserted: 0, skipped: input.detections.length };
    }

    let inserted = 0;
    for (const det of input.detections) {
      if (!det.detectedTaxon) continue;
      await client.query(
        `insert into audio_detections
           (segment_id, detected_taxon, scientific_name, confidence, provider,
            offset_sec, duration_sec, dual_agree, raw_score)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          segment.segment_id,
          det.detectedTaxon,
          det.scientificName ?? null,
          clamp01(det.confidence ?? 0),
          det.provider ?? "perch_v2",
          det.offsetSec ?? 0,
          det.durationSec ?? 0,
          det.dualAgree ?? false,
          JSON.stringify(det.rawScore ?? {}),
        ],
      );
      inserted += 1;
    }

    await client.query(
      `update audio_segments
          set transcription_status = 'done',
              updated_at = now()
        where segment_id = $1`,
      [segment.segment_id],
    );
    await rebuildSessionBundles(client, segment.session_id);
    await client.query("commit");
    return { inserted, skipped: 0 };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getSessionRecap(sessionId: string, viewerUserId?: string | null): Promise<SessionRecap> {
  const pool = getPool();
  const seg = await pool.query<{
    segment_count: string;
    clean_segment_count: string;
    total_duration_sec: string;
    natural_duration_sec: string;
    privacy_skipped_count: string;
    last_recorded_at: string | null;
    min_lat: number | null;
    max_lat: number | null;
    min_lng: number | null;
    max_lng: number | null;
  }>(
    `select count(*)::text as segment_count,
            (count(*) filter (where privacy_status = 'clean'))::text as clean_segment_count,
            coalesce(sum(duration_sec), 0)::text as total_duration_sec,
            coalesce(sum(duration_sec) filter (where privacy_status = 'clean'), 0)::text as natural_duration_sec,
            (count(*) filter (where privacy_status <> 'clean'))::text as privacy_skipped_count,
            max(recorded_at)::text as last_recorded_at,
            min(lat) filter (where privacy_status = 'clean') as min_lat,
            max(lat) filter (where privacy_status = 'clean') as max_lat,
            min(lng) filter (where privacy_status = 'clean') as min_lng,
            max(lng) filter (where privacy_status = 'clean') as max_lng
       from audio_segments
      where session_id = $1`,
    [sessionId],
  );
  const segStat = seg.rows[0] ?? {
    segment_count: "0",
    clean_segment_count: "0",
    total_duration_sec: "0",
    natural_duration_sec: "0",
    privacy_skipped_count: "0",
    last_recorded_at: null,
    min_lat: null,
    max_lat: null,
    min_lng: null,
    max_lng: null,
  };

  const taxa = await pool.query<{
    detected_taxon: string;
    cnt: string;
    best_confidence: number;
    provider: string;
  }>(
    `select d.detected_taxon, count(*)::text as cnt,
            max(d.confidence) as best_confidence,
            (array_agg(d.provider order by d.confidence desc))[1] as provider
       from audio_detections d
       join audio_segments s on s.segment_id = d.segment_id
      where s.session_id = $1
        and s.privacy_status = 'clean'
      group by d.detected_taxon
      order by max(d.confidence) desc
      limit 50`,
    [sessionId],
  );

  const bundleRows = await pool.query<{
    bundle_id: string;
    segment_count: number;
    total_duration_sec: number;
    first_recorded_at: string | null;
    last_recorded_at: string | null;
    representative_segment_id: string | null;
    candidate_taxon: string | null;
    best_confidence: number | null;
    dual_agree: boolean;
  }>(
    `select bundle_id, segment_count, total_duration_sec,
            first_recorded_at::text as first_recorded_at,
            last_recorded_at::text as last_recorded_at,
            representative_segment_id, candidate_taxon, best_confidence, dual_agree
       from sound_bundles
      where session_id = $1
      order by first_recorded_at asc nulls last, bundle_id asc`,
    [sessionId],
  );

  const bbox = segStat.min_lat != null && segStat.max_lat != null && segStat.min_lng != null && segStat.max_lng != null
    ? { minLat: segStat.min_lat, maxLat: segStat.max_lat, minLng: segStat.min_lng, maxLng: segStat.max_lng }
    : null;

  return {
    sessionId,
    segmentCount: Number(segStat.segment_count),
    cleanSegmentCount: Number(segStat.clean_segment_count),
    totalDurationSec: Number(segStat.total_duration_sec),
    naturalDurationSec: Number(segStat.natural_duration_sec),
    privacySkippedCount: Number(segStat.privacy_skipped_count),
    lastRecordedAt: segStat.last_recorded_at,
    uniqueTaxa: taxa.rows.map((row) => ({
      taxon: row.detected_taxon,
      count: Number(row.cnt),
      bestConfidence: Number(row.best_confidence),
      provider: row.provider,
    })),
    bbox,
    soundBundles: bundleRows.rows.map((row, index) => ({
      bundleId: row.bundle_id,
      label: bundleLabelForIndex(index),
      segmentCount: Number(row.segment_count),
      totalDurationSec: Number(row.total_duration_sec),
      firstRecordedAt: row.first_recorded_at,
      lastRecordedAt: row.last_recorded_at,
      representativeSegmentId: row.representative_segment_id,
      representativeAudioUrl: viewerUserId && row.representative_segment_id
        ? `/api/v1/fieldscan/audio/segment/${encodeURIComponent(row.representative_segment_id)}`
        : null,
      candidateTaxon: row.candidate_taxon,
      bestConfidence: row.best_confidence != null ? Number(row.best_confidence) : null,
      dualAgree: row.dual_agree,
      note: deriveBundleNote(row.candidate_taxon),
    })),
  };
}

export async function loadAudioSegmentForPlayback(segmentId: string, userId: string): Promise<{ mimeType: string; data: Buffer } | null> {
  const pool = getPool();
  const result = await pool.query<{
    user_id: string | null;
    privacy_status: AudioPrivacyStatus;
    storage_provider: string;
    storage_path: string;
    mime_type: string;
  }>(
    `select user_id, privacy_status, storage_provider, storage_path, mime_type
       from audio_segments
      where segment_id = $1
      limit 1`,
    [segmentId],
  );
  const row = result.rows[0];
  if (!row || row.privacy_status !== "clean") {
    return null;
  }
  if (!row.user_id || row.user_id !== userId) {
    return null;
  }
  if (row.storage_provider !== AUDIO_STORAGE_BACKEND || !row.storage_path) {
    return null;
  }
  const data = await readFile(resolveAudioAbsolutePath(row.storage_path));
  return {
    mimeType: canonicalAudioMimeType(row.mime_type),
    data,
  };
}
