import { createHash, randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { saveGuideRecord, type DetectedFeature, type GuideMode, type PrimarySubject } from "./guideSession.js";
import { upsertGuideEnvironmentMeshFromRecord } from "./guideEnvironmentMesh.js";
import { recordGuideRoutePoint } from "./guideRouteTrack.js";

type MovementMode = "walk" | "vehicle" | "focus";
type MonitoringContext = Record<string, unknown>;

export type MobileSceneDigestInput = {
  sessionId: string;
  clientSceneId: string;
  installId: string;
  userId?: string | null;
  lat: number;
  lng: number;
  capturedAt?: string | null;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
  movementMode: MovementMode;
  sceneDigest: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  areaResolutionSignals: string[];
  monitoringContext?: MonitoringContext;
  onDeviceModel?: {
    baseName?: string | null;
    releaseStage?: string | null;
    preference?: string | null;
    foregroundAiAvailable?: boolean | null;
    fallbackReason?: string | null;
  };
};

function asFinite(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeMovementMode(raw: unknown): MovementMode {
  return raw === "vehicle" ? "vehicle" : raw === "focus" ? "focus" : "walk";
}

function guideModeForMovement(mode: MovementMode): GuideMode {
  return mode === "vehicle" ? "vehicle" : "walk";
}

function normalizeStringArray(raw: unknown, limit = 12): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, limit);
}

function normalizeDetectedFeatures(raw: unknown): DetectedFeature[] {
  if (!Array.isArray(raw)) return [];
  const allowedTypes = new Set(["species", "vegetation", "landform", "structure", "sound"]);
  return raw.map((item): DetectedFeature | null => {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const name = String(obj.name ?? "").trim();
    if (!name) return null;
    const type = allowedTypes.has(String(obj.type)) ? String(obj.type) as DetectedFeature["type"] : "vegetation";
    const confidence = asFinite(obj.confidence);
    return {
      type,
      name,
      confidence: confidence ?? undefined,
      note: typeof obj.note === "string" ? obj.note.slice(0, 240) : undefined,
    };
  }).filter((item): item is DetectedFeature => Boolean(item)).slice(0, 16);
}

function normalizeObject(raw: unknown): MonitoringContext | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as MonitoringContext;
}

function primarySubjectFromSpecies(species: string[]): PrimarySubject | undefined {
  const first = species[0];
  return first ? { name: first, rank: "unknown", confidence: 0.55 } : undefined;
}

export function normalizeMobileSceneDigestBody(body: Record<string, unknown>, sessionIdParam: string): MobileSceneDigestInput {
  const lat = asFinite(body.lat);
  const lng = asFinite(body.lng);
  if (lat === null || lng === null) throw new Error("lat_lng_required");
  const sceneDigest = typeof body.scene_digest === "string" ? body.scene_digest.trim().slice(0, 1600) : "";
  if (!sceneDigest) throw new Error("scene_digest_required");
  const installId = typeof body.install_id === "string" ? body.install_id.trim() : "";
  if (!installId) throw new Error("install_id_required");

  return {
    sessionId: typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : sessionIdParam,
    clientSceneId: typeof body.client_scene_id === "string" && body.client_scene_id.trim() ? body.client_scene_id.trim() : randomUUID(),
    installId,
    lat,
    lng,
    capturedAt: typeof body.captured_at === "string" ? body.captured_at : null,
    accuracyM: asFinite(body.accuracy_m),
    speedMps: asFinite(body.speed_mps),
    headingDegrees: asFinite(body.heading_degrees),
    movementMode: normalizeMovementMode(body.movement_mode),
    sceneDigest,
    detectedSpecies: normalizeStringArray(body.detected_species),
    detectedFeatures: normalizeDetectedFeatures(body.detected_features),
    areaResolutionSignals: normalizeStringArray(body.area_resolution_signals, 16),
    monitoringContext: normalizeObject(body.monitoring_context),
    onDeviceModel: {
      baseName: typeof body.on_device_model_base_name === "string" ? body.on_device_model_base_name : null,
      releaseStage: typeof body.on_device_release_stage === "string" ? body.on_device_release_stage : null,
      preference: typeof body.on_device_model_preference === "string" ? body.on_device_model_preference : null,
      foregroundAiAvailable: typeof body.foreground_ai_available === "boolean" ? body.foreground_ai_available : null,
      fallbackReason: typeof body.fallback_reason === "string" ? body.fallback_reason : null,
    },
  };
}

export async function saveMobileSceneDigest(input: MobileSceneDigestInput): Promise<{ guideRecordId: string; duplicate: boolean }> {
  const pool = getPool();
  const existing = await pool.query<{ guide_record_id: string }>(
    `select guide_record_id::text from mobile_field_scene_receipts where install_id = $1 and client_scene_id = $2`,
    [input.installId, input.clientSceneId],
  );
  const existingId = existing.rows[0]?.guide_record_id;
  if (existingId) return { guideRecordId: existingId, duplicate: true };

  const guideMode = guideModeForMovement(input.movementMode);
  const sceneHash = createHash("sha256")
    .update(`mobile-scene:${input.installId}:${input.clientSceneId}:${input.sceneDigest}`)
    .digest("hex");
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const meta = {
    source: "mobile_field_companion",
    movementMode: input.movementMode,
    areaResolutionSignals: input.areaResolutionSignals,
    monitoringContext: input.monitoringContext ?? null,
    onDeviceModel: input.onDeviceModel ?? {},
    installId: input.installId,
    clientSceneId: input.clientSceneId,
    rawMediaStored: false,
  };

  const guideRecordId = await saveGuideRecord({
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    lat: input.lat,
    lng: input.lng,
    capturedAt,
    returnedAt: new Date().toISOString(),
    deliveryState: "ready",
    seenState: "saved",
    sceneHash,
    sceneSummary: input.sceneDigest,
    detectedSpecies: input.detectedSpecies,
    detectedFeatures: input.detectedFeatures,
    primarySubject: primarySubjectFromSpecies(input.detectedSpecies),
    environmentContext: input.areaResolutionSignals.join(" / ") || null,
    coexistingTaxa: [],
    mediaRefs: { rawMediaStored: false },
    meta: { guideMode, ...meta },
    lang: "ja",
  });

  await upsertGuideEnvironmentMeshFromRecord({
    guideRecordId,
    userId: input.userId ?? null,
    sessionId: input.sessionId,
    lat: input.lat,
    lng: input.lng,
    detectedFeatures: input.detectedFeatures,
    seenAt: capturedAt,
    locationQuality: {
      accuracyM: input.accuracyM ?? null,
      speedMps: input.speedMps ?? null,
      headingDegrees: input.headingDegrees ?? null,
      positionCapturedAt: capturedAt,
      source: "mobile_field_companion",
    },
  });

  if (input.movementMode === "vehicle") {
    await recordGuideRoutePoint({
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      clientSceneId: input.clientSceneId,
      guideMode: "vehicle",
      lat: input.lat,
      lng: input.lng,
      observedAt: capturedAt,
      accuracyM: input.accuracyM ?? null,
      speedMps: input.speedMps ?? null,
      headingDegrees: input.headingDegrees ?? null,
      positionCapturedAt: capturedAt,
    });
  }

  await pool.query(
    `insert into mobile_field_scene_receipts
       (install_id, client_scene_id, session_id, guide_record_id, movement_mode, scene_digest, payload)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     on conflict (install_id, client_scene_id) do update set
       updated_at = now()
     returning receipt_id`,
    [
      input.installId,
      input.clientSceneId,
      input.sessionId,
      guideRecordId,
      input.movementMode,
      input.sceneDigest,
      JSON.stringify(meta),
    ],
  );

  return { guideRecordId, duplicate: false };
}

export async function getMobileFieldSessionRecap(sessionId: string, userId?: string | null): Promise<{
  sessionId: string;
  sceneCount: number;
  latestDigest: string;
  nextLook: string[];
}> {
  const pool = getPool();
  const result = await pool.query<{
    scene_count: string;
    latest_digest: string | null;
    next_look: string[] | null;
  }>(
    `select count(*)::text as scene_count,
            (array_agg(scene_digest order by created_at desc))[1] as latest_digest,
            coalesce(array_agg(distinct signals.signal) filter (where signals.signal is not null), '{}') as next_look
       from mobile_field_scene_receipts r
       left join lateral jsonb_array_elements_text(r.payload->'areaResolutionSignals') as signals(signal) on true
      where r.session_id = $1
        and ($2::uuid is null or exists (
          select 1 from guide_records gr where gr.guide_record_id::text = r.guide_record_id::text and gr.user_id = $2::uuid
        ))`,
    [sessionId, userId ?? null],
  );
  const row = result.rows[0];
  return {
    sessionId,
    sceneCount: Number(row?.scene_count ?? 0),
    latestDigest: row?.latest_digest ?? "",
    nextLook: row?.next_look ?? [],
  };
}
