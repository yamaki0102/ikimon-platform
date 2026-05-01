import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { audioFingerprintToEmbedding } from "../services/audioFingerprintEmbedding.js";
import { getAudioStorageRoot, recordAudioDetections, type AudioDetectionCallbackInput } from "../services/fieldscanAudio.js";

const FINGERPRINT_MODEL_NAME = "ikimon_audio_fingerprint";
const FINGERPRINT_MODEL_VERSION = "v1";

type Args = {
  limit: number;
  birdnetUrl: string;
  minConfidence: number;
  detectionsOnly: boolean;
  embeddingsOnly: boolean;
};

type PendingAudioSegment = {
  segment_id: string;
  storage_path: string;
  storage_provider: string;
  mime_type: string;
  lat: number | null;
  lng: number | null;
  fingerprint: Record<string, unknown> | null;
  transcription_status: string;
  has_detection: boolean;
  has_fingerprint_embedding: boolean;
};

type BirdnetDetection = {
  scientific_name?: string;
  common_name?: string;
  confidence?: number;
  start_time?: number;
  end_time?: number;
};

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(): Args {
  const limit = Number(argValue("limit") ?? process.argv[2] ?? 20);
  const minConfidence = Number(argValue("min-confidence") ?? 0.25);
  const raw = new Set(process.argv.slice(2));
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.trunc(limit)) : 20,
    birdnetUrl: argValue("birdnet-url") ?? process.env.BIRDNET_V3_URL ?? "http://127.0.0.1:8101/analyze",
    minConfidence: Number.isFinite(minConfidence) ? Math.max(0, Math.min(1, minConfidence)) : 0.25,
    detectionsOnly: raw.has("--detections-only"),
    embeddingsOnly: raw.has("--embeddings-only"),
  };
}

function resolveAudioPath(storagePath: string): string | null {
  const root = getAudioStorageRoot();
  const full = path.resolve(root, storagePath);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

async function loadPendingSegments(args: Args): Promise<PendingAudioSegment[]> {
  const clauses = [
    "s.privacy_status = 'clean'",
    "s.storage_provider = 'private_audio_fs'",
    "s.storage_path is not null",
    "s.storage_path <> ''",
  ];
  if (args.detectionsOnly) {
    clauses.push("not exists (select 1 from audio_detections d where d.segment_id = s.segment_id)");
    clauses.push("s.transcription_status <> 'done'");
  } else if (args.embeddingsOnly) {
    clauses.push(`not exists (
      select 1 from audio_embeddings e
       where e.segment_id = s.segment_id
         and e.model_name = '${FINGERPRINT_MODEL_NAME}'
         and e.model_version = '${FINGERPRINT_MODEL_VERSION}'
    )`);
  } else {
    clauses.push(`(
      (
        s.transcription_status <> 'done'
        and not exists (select 1 from audio_detections d where d.segment_id = s.segment_id)
      )
      or not exists (
        select 1 from audio_embeddings e
         where e.segment_id = s.segment_id
           and e.model_name = '${FINGERPRINT_MODEL_NAME}'
           and e.model_version = '${FINGERPRINT_MODEL_VERSION}'
      )
    )`);
  }

  const result = await getPool().query<PendingAudioSegment>(
    `select s.segment_id::text,
            s.storage_path,
            s.storage_provider,
            s.mime_type,
            s.lat,
            s.lng,
            s.fingerprint,
            s.transcription_status,
            exists (select 1 from audio_detections d where d.segment_id = s.segment_id) as has_detection,
            exists (
              select 1 from audio_embeddings e
               where e.segment_id = s.segment_id
                 and e.model_name = $2
                 and e.model_version = $3
            ) as has_fingerprint_embedding
       from audio_segments s
      where ${clauses.join(" and ")}
      order by s.created_at asc
      limit $1`,
    [args.limit, FINGERPRINT_MODEL_NAME, FINGERPRINT_MODEL_VERSION],
  );
  return result.rows;
}

async function callBirdnet(segment: PendingAudioSegment, audioPath: string, args: Args): Promise<AudioDetectionCallbackInput["detections"]> {
  const audio = await readFile(audioPath);
  const boundary = `----ikimon-audio-${Date.now().toString(36)}`;
  const field = (name: string, value: string): Buffer => Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  const fileHead = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${path.basename(audioPath)}"\r\nContent-Type: ${segment.mime_type || "audio/webm"}\r\n\r\n`,
  );
  const body = Buffer.concat([
    fileHead,
    audio,
    Buffer.from("\r\n"),
    field("lat", String(segment.lat ?? 35.0)),
    field("lng", String(segment.lng ?? 139.0)),
    field("min_conf", String(args.minConfidence)),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  const response = await fetch(args.birdnetUrl, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  if (!response.ok) {
    throw new Error(`birdnet_http_${response.status}`);
  }
  const payload = await response.json() as { detections?: BirdnetDetection[] };
  return (payload.detections ?? [])
    .map((item) => {
      const start = Number(item.start_time ?? 0);
      const end = Number(item.end_time ?? start);
      return {
        detectedTaxon: item.common_name || item.scientific_name || "unknown",
        scientificName: item.scientific_name || undefined,
        confidence: Number(item.confidence ?? 0),
        provider: "birdnet_v3",
        offsetSec: Number.isFinite(start) ? start : 0,
        durationSec: Number.isFinite(end - start) && end > start ? end - start : 3,
        dualAgree: false,
        rawScore: { model: "BirdNET-V3.0-preview3" },
      };
    })
    .filter((item) => item.detectedTaxon !== "unknown" && (item.confidence ?? 0) >= args.minConfidence)
    .slice(0, 10);
}

async function processSegment(segment: PendingAudioSegment, args: Args): Promise<"processed" | "missing_file" | "birdnet_failed"> {
  const audioPath = resolveAudioPath(segment.storage_path);
  if (!audioPath) return "missing_file";

  const embeddings = args.detectionsOnly || segment.has_fingerprint_embedding
    ? []
    : [{
        modelName: FINGERPRINT_MODEL_NAME,
        modelVersion: FINGERPRINT_MODEL_VERSION,
        frameOffsetSec: 0,
        frameDurationSec: 2,
        qualityScore: 0.55,
        vector: audioFingerprintToEmbedding(segment.fingerprint),
      }];

  let detections: AudioDetectionCallbackInput["detections"] = [];
  let birdnetFailed = false;
  if (!args.embeddingsOnly && !segment.has_detection) {
    try {
      detections = await callBirdnet(segment, audioPath, args);
    } catch {
      birdnetFailed = true;
    }
  }

  if (detections.length === 0 && embeddings.length === 0) {
    return birdnetFailed ? "birdnet_failed" : "processed";
  }
  await recordAudioDetections({
    segmentId: segment.segment_id,
    detections,
    embeddings,
    embeddingModelName: FINGERPRINT_MODEL_NAME,
    embeddingModelVersion: FINGERPRINT_MODEL_VERSION,
  });
  return birdnetFailed ? "birdnet_failed" : "processed";
}

async function main(): Promise<void> {
  const args = parseArgs();
  const segments = await loadPendingSegments(args);
  const counts: Record<string, number> = { scanned: segments.length, processed: 0, missing_file: 0, birdnet_failed: 0 };
  for (const segment of segments) {
    const outcome = await processSegment(segment, args);
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  console.log(JSON.stringify({ ok: true, ...counts }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
