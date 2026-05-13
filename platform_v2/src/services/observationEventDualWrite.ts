import { getPool } from "../db.js";
import { appendLiveEvent } from "./observationEventLive.js";
import { runQuestGeneration } from "./observationEventQuestEngine.js";
import { recordMeshVisit } from "./observationEventEffort.js";

/**
 * 観察投稿が観察会(observation_event_sessions)に紐付いていれば、
 * live_events を 1 件 INSERT して SSE 経由で全班に push する。
 *
 * 既存の upsertObservation ロジックは絶対に変えない。
 * ここはあくまで side effect の非ブロック呼び出し専用。
 */

interface ObservationLikeInput {
  // クライアント側(レコードフォーム / iOS / Android)で観察会を意識して投稿するときに乗せる
  eventCode?: unknown;
  eventSessionId?: unknown;
  teamId?: unknown;
  participantRole?: unknown;
  // 既存 upsert input の良くある形
  userId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  observedAt?: unknown;
  taxon?: { vernacularName?: unknown; scientificName?: unknown } | null | unknown;
  fieldScan?: unknown;
  visitMode?: unknown;
  governanceContext?: unknown;
}

interface ObservationLikeResult {
  visitId?: string;
  occurrenceId?: string;
  occurrenceIds?: string[];
}

interface SessionLookup {
  sessionId: string;
  isLive: boolean;
}

export interface ObservationEventSourcePayload {
  eventCode?: unknown;
  eventSessionId?: unknown;
  teamId?: unknown;
  participantRole?: unknown;
}

const eventCodeCache = new Map<string, { value: SessionLookup | null; expiresAt: number }>();
const EVENT_CODE_TTL_MS = 60 * 1000;

async function lookupSessionByEventCode(eventCode: string): Promise<SessionLookup | null> {
  const cached = eventCodeCache.get(eventCode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const result = await getPool().query<{ session_id: string; ended_at: string | null }>(
      `SELECT session_id, ended_at::text AS ended_at
       FROM observation_event_sessions
       WHERE event_code = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [eventCode],
    );
    const row = result.rows[0];
    const value: SessionLookup | null = row
      ? { sessionId: row.session_id, isLive: row.ended_at === null }
      : null;
    eventCodeCache.set(eventCode, { value, expiresAt: Date.now() + EVENT_CODE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

async function lookupSessionById(sessionId: string): Promise<SessionLookup | null> {
  try {
    const result = await getPool().query<{ session_id: string; ended_at: string | null }>(
      `SELECT session_id, ended_at::text AS ended_at
       FROM observation_event_sessions
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId],
    );
    const row = result.rows[0];
    return row ? { sessionId: row.session_id, isLive: row.ended_at === null } : null;
  } catch {
    return null;
  }
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractTaxonName(input: ObservationLikeInput): string | null {
  const t = input.taxon as { vernacularName?: unknown; scientificName?: unknown } | null | undefined;
  if (!t) return null;
  return asString(t.vernacularName) ?? asString(t.scientificName);
}

async function resolveLiveEventSession(input: ObservationEventSourcePayload): Promise<string | null> {
  const eventCode = asString(input.eventCode);
  const explicitSessionId = asString(input.eventSessionId);
  if (explicitSessionId) {
    const lookup = await lookupSessionById(explicitSessionId);
    return lookup?.isLive ? lookup.sessionId : null;
  }
  if (eventCode) {
    const lookup = await lookupSessionByEventCode(eventCode);
    return lookup?.isLive ? lookup.sessionId : null;
  }
  return null;
}

function observationLiveType(input: ObservationLikeInput): "observation_added" | "field_scan_added" {
  if (input.fieldScan && typeof input.fieldScan === "object") return "field_scan_added";
  return "observation_added";
}

export async function hookObservationToEvent(args: {
  body: ObservationLikeInput;
  result: ObservationLikeResult;
}): Promise<void> {
  const sessionId = await resolveLiveEventSession(args.body);
  if (!sessionId) return;

  const teamId = asString(args.body.teamId);
  const userId = asString(args.body.userId);
  const lat = asNumber(args.body.latitude);
  const lng = asNumber(args.body.longitude);
  const observedAt = asString(args.body.observedAt);
  const taxonName = extractTaxonName(args.body);

  try {
    await appendLiveEvent({
      sessionId,
      type: observationLiveType(args.body),
      scope: "all",
      actorUserId: userId,
      teamId,
      payload: {
        visit_id: args.result.visitId ?? null,
        occurrence_id: args.result.occurrenceId ?? null,
        taxon_name: taxonName,
        lat,
        lng,
        observed_at: observedAt,
        source_type: observationLiveType(args.body) === "field_scan_added" ? "field_scan" : "record",
        participant_role: asString(args.body.participantRole),
        field_scan: args.body.fieldScan && typeof args.body.fieldScan === "object" ? args.body.fieldScan as Record<string, unknown> : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[observation-event-dual-write] live event failed", err);
  }

  if (lat !== null && lng !== null) {
    try {
      await recordMeshVisit({
        sessionId,
        lat,
        lng,
        observationDelta: 1,
        teamId,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[observation-event-dual-write] mesh upsert failed", err);
    }
  }

  // 「新種が出た」即時 trigger: 過去 60 秒に同じ taxon が記録されていなければ new_species。
  if (taxonName) {
    try {
      const recentResult = await getPool().query<{ recent: string }>(
        `SELECT COUNT(*)::text AS recent
         FROM observation_event_live_events
         WHERE session_id = $1
           AND type = 'observation_added'
           AND created_at > NOW() - INTERVAL '60 seconds'
           AND payload->>'taxon_name' = $2`,
        [sessionId, taxonName],
      );
      const isNewWindow = Number(recentResult.rows[0]?.recent ?? 0) <= 1;
      if (isNewWindow) {
        void runQuestGeneration(sessionId, { trigger: "new_species" }).catch(() => undefined);
      }
    } catch {
      // sliding-window 検出は best-effort
    }
  }
}

export async function hookGuideSceneToEvent(args: {
  body: ObservationEventSourcePayload;
  guideRecordId?: string | null;
  sceneId?: string | null;
  guideSessionId?: string | null;
  userId?: string | null;
  teamId?: string | null;
  lat?: number | null;
  lng?: number | null;
  capturedAt?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sessionId = await resolveLiveEventSession(args.body);
  if (!sessionId) return;
  await appendLiveEvent({
    sessionId,
    type: "guide_scene_added",
    scope: "all",
    actorUserId: args.userId ?? null,
    teamId: args.teamId ?? asString(args.body.teamId),
    payload: {
      guide_record_id: args.guideRecordId ?? null,
      scene_id: args.sceneId ?? null,
      guide_session_id: args.guideSessionId ?? null,
      lat: args.lat ?? null,
      lng: args.lng ?? null,
      captured_at: args.capturedAt ?? null,
      participant_role: asString(args.body.participantRole),
      ...(args.payload ?? {}),
    },
  });
}

export async function hookFieldScanAudioToEvent(args: {
  body: ObservationEventSourcePayload;
  segmentId: string;
  fieldscanSessionId: string;
  userId?: string | null;
  lat?: number | null;
  lng?: number | null;
  recordedAt?: string | null;
  durationSec?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sessionId = await resolveLiveEventSession(args.body);
  if (!sessionId) return;
  await appendLiveEvent({
    sessionId,
    type: "field_scan_added",
    scope: "all",
    actorUserId: args.userId ?? null,
    teamId: asString(args.body.teamId),
    payload: {
      segment_id: args.segmentId,
      fieldscan_session_id: args.fieldscanSessionId,
      scan_mode: "audio_segment",
      lat: args.lat ?? null,
      lng: args.lng ?? null,
      recorded_at: args.recordedAt ?? null,
      duration_sec: args.durationSec ?? null,
      participant_role: asString(args.body.participantRole),
      ...(args.payload ?? {}),
    },
  });
}
