import { getPool } from "../db.js";

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
  meta?: Record<string, unknown>;
};

export type AudioSegmentSubmitResult = {
  segmentId: string;
  created: boolean;
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

export type SessionRecap = {
  sessionId: string;
  segmentCount: number;
  totalDurationSec: number;
  lastRecordedAt: string | null;
  uniqueTaxa: Array<{ taxon: string; count: number; bestConfidence: number; provider: string }>;
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null;
};

function requireField<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${name}_required`);
  }
  return value;
}

export async function submitAudioSegment(input: AudioSegmentSubmitInput): Promise<AudioSegmentSubmitResult> {
  const sessionId = requireField(input.sessionId, "sessionId");
  const recordedAt = requireField(input.recordedAt, "recordedAt");
  const pool = getPool();
  const externalId = input.externalId ?? null;
  const result = await pool.query<{ segment_id: string; created: boolean }>(
    `insert into audio_segments
       (external_id, session_id, user_id, visit_id, place_id, recorded_at, duration_sec,
        lat, lng, azimuth, storage_path, storage_provider, mime_type, bytes, meta)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     on conflict (external_id) do update
       set duration_sec = excluded.duration_sec,
           storage_path = excluded.storage_path,
           bytes = excluded.bytes,
           meta = excluded.meta,
           updated_at = now()
     returning segment_id, (xmax = 0) as created`,
    [
      externalId,
      sessionId,
      input.userId ?? null,
      input.visitId ?? null,
      input.placeId ?? null,
      recordedAt,
      input.durationSec ?? 0,
      input.lat ?? null,
      input.lng ?? null,
      input.azimuth ?? null,
      input.storagePath ?? "",
      input.storageProvider ?? "local",
      input.mimeType ?? "audio/webm",
      input.bytes ?? 0,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  const row = result.rows[0]!;
  return { segmentId: row.segment_id, created: row.created };
}

export async function recordAudioDetections(input: AudioDetectionCallbackInput): Promise<{ inserted: number }> {
  if (!Array.isArray(input.detections) || input.detections.length === 0) {
    throw new Error("detections_required");
  }
  const pool = getPool();
  let segmentId = input.segmentId ?? null;
  if (!segmentId && input.externalId) {
    const lookup = await pool.query<{ segment_id: string }>(
      `select segment_id from audio_segments where external_id = $1 limit 1`,
      [input.externalId],
    );
    segmentId = lookup.rows[0]?.segment_id ?? null;
  }
  if (!segmentId) throw new Error("segmentId_required");

  let inserted = 0;
  for (const det of input.detections) {
    if (!det.detectedTaxon) continue;
    await pool.query(
      `insert into audio_detections
         (segment_id, detected_taxon, scientific_name, confidence, provider,
          offset_sec, duration_sec, dual_agree, raw_score)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        segmentId,
        det.detectedTaxon,
        det.scientificName ?? null,
        Math.max(0, Math.min(1, det.confidence ?? 0)),
        det.provider ?? "perch_v2",
        det.offsetSec ?? 0,
        det.durationSec ?? 0,
        det.dualAgree ?? false,
        JSON.stringify(det.rawScore ?? {}),
      ],
    );
    inserted += 1;
  }

  // マーク: 少なくとも 1件 detection が入った segment は transcription_status='done'
  await pool.query(
    `update audio_segments set transcription_status = 'done', updated_at = now() where segment_id = $1`,
    [segmentId],
  );

  return { inserted };
}

export async function getSessionRecap(sessionId: string): Promise<SessionRecap> {
  const pool = getPool();
  const seg = await pool.query<{
    segment_count: string;
    total_duration_sec: string;
    last_recorded_at: string | null;
    min_lat: number | null;
    max_lat: number | null;
    min_lng: number | null;
    max_lng: number | null;
  }>(
    `select count(*)::text as segment_count,
            coalesce(sum(duration_sec),0)::text as total_duration_sec,
            max(recorded_at) as last_recorded_at,
            min(lat) as min_lat, max(lat) as max_lat,
            min(lng) as min_lng, max(lng) as max_lng
       from audio_segments where session_id = $1`,
    [sessionId],
  );
  const segStat = seg.rows[0] ?? {
    segment_count: "0", total_duration_sec: "0", last_recorded_at: null,
    min_lat: null, max_lat: null, min_lng: null, max_lng: null,
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
      group by d.detected_taxon
      order by max(d.confidence) desc
      limit 50`,
    [sessionId],
  );

  const bbox = segStat.min_lat != null && segStat.max_lat != null && segStat.min_lng != null && segStat.max_lng != null
    ? { minLat: segStat.min_lat, maxLat: segStat.max_lat, minLng: segStat.min_lng, maxLng: segStat.max_lng }
    : null;

  return {
    sessionId,
    segmentCount: Number(segStat.segment_count),
    totalDurationSec: Number(segStat.total_duration_sec),
    lastRecordedAt: segStat.last_recorded_at,
    uniqueTaxa: taxa.rows.map((r) => ({
      taxon: r.detected_taxon,
      count: Number(r.cnt),
      bestConfidence: Number(r.best_confidence),
      provider: r.provider,
    })),
    bbox,
  };
}
