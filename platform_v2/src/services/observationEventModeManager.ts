import { getPool } from "../db.js";
import { appendLiveEvent } from "./observationEventLive.js";

export type EventMode =
  | "discovery"
  | "effort_maximize"
  | "bingo"
  | "absence_confirm"
  | "ai_quest";

export const EVENT_MODES: readonly EventMode[] = [
  "discovery",
  "effort_maximize",
  "bingo",
  "absence_confirm",
  "ai_quest",
] as const;

export function isEventMode(value: unknown): value is EventMode {
  return typeof value === "string" && (EVENT_MODES as readonly string[]).includes(value);
}

export interface ObservationEventSessionRow {
  sessionId: string;
  legacyEventId: string | null;
  eventCode: string | null;
  title: string;
  organizerUserId: string;
  corporationId: string | null;
  plan: "community" | "public";
  primaryMode: EventMode;
  activeModes: EventMode[];
  locationLat: number | null;
  locationLng: number | null;
  locationRadiusM: number;
  startedAt: string;
  endedAt: string | null;
  targetSpecies: string[];
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface RawSessionRow extends Record<string, unknown> {
  session_id: string;
  legacy_event_id: string | null;
  event_code: string | null;
  title: string;
  organizer_user_id: string;
  corporation_id: string | null;
  plan: string;
  primary_mode: string;
  active_modes: string[];
  location_lat: string | number | null;
  location_lng: string | number | null;
  location_radius_m: number;
  started_at: string;
  ended_at: string | null;
  target_species: string[];
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const SESSION_SELECT = `
  session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id, plan,
  primary_mode, active_modes,
  location_lat, location_lng, location_radius_m,
  started_at::text AS started_at,
  ended_at::text   AS ended_at,
  target_species, config,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

function mapSession(row: RawSessionRow): ObservationEventSessionRow {
  const activeModes = (row.active_modes ?? []).filter(isEventMode);
  return {
    sessionId: row.session_id,
    legacyEventId: row.legacy_event_id,
    eventCode: row.event_code,
    title: row.title ?? "",
    organizerUserId: row.organizer_user_id,
    corporationId: row.corporation_id,
    plan: (row.plan === "public" ? "public" : "community"),
    primaryMode: isEventMode(row.primary_mode) ? row.primary_mode : "discovery",
    activeModes: activeModes.length > 0 ? activeModes : ["discovery"],
    locationLat: row.location_lat == null ? null : Number(row.location_lat),
    locationLng: row.location_lng == null ? null : Number(row.location_lng),
    locationRadiusM: row.location_radius_m ?? 1000,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    targetSpecies: row.target_species ?? [],
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSessionInput {
  legacyEventId?: string | null;
  eventCode?: string | null;
  title?: string;
  organizerUserId: string;
  corporationId?: string | null;
  plan?: "community" | "public";
  primaryMode?: EventMode;
  activeModes?: EventMode[];
  locationLat?: number | null;
  locationLng?: number | null;
  locationRadiusM?: number;
  startedAt: string;
  endedAt?: string | null;
  targetSpecies?: string[];
  config?: Record<string, unknown>;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<ObservationEventSessionRow> {
  const primaryMode = input.primaryMode ?? "discovery";
  const activeModes = (input.activeModes && input.activeModes.length > 0
    ? input.activeModes
    : [primaryMode]).filter(isEventMode);

  const result = await getPool().query<RawSessionRow>(
    `INSERT INTO observation_event_sessions (
       legacy_event_id, event_code, title, organizer_user_id, corporation_id,
       plan, primary_mode, active_modes,
       location_lat, location_lng, location_radius_m,
       started_at, ended_at, target_species, config
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8::text[],
       $9, $10, $11,
       $12, $13, $14::text[], $15::jsonb
     )
     RETURNING ${SESSION_SELECT}`,
    [
      input.legacyEventId ?? null,
      input.eventCode ?? null,
      input.title ?? "",
      input.organizerUserId,
      input.corporationId ?? null,
      input.plan ?? "community",
      primaryMode,
      activeModes,
      input.locationLat ?? null,
      input.locationLng ?? null,
      input.locationRadiusM ?? 1000,
      input.startedAt,
      input.endedAt ?? null,
      input.targetSpecies ?? [],
      JSON.stringify(input.config ?? {}),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to create observation event session");
  return mapSession(row);
}

export async function getSessionById(
  sessionId: string,
): Promise<ObservationEventSessionRow | null> {
  const result = await getPool().query<RawSessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM observation_event_sessions
     WHERE session_id = $1`,
    [sessionId],
  );
  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

export async function getSessionByEventCode(
  eventCode: string,
): Promise<ObservationEventSessionRow | null> {
  const result = await getPool().query<RawSessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM observation_event_sessions
     WHERE event_code = $1`,
    [eventCode],
  );
  const row = result.rows[0];
  return row ? mapSession(row) : null;
}

export async function switchPrimaryMode(
  sessionId: string,
  nextMode: EventMode,
  actorUserId: string | null,
): Promise<ObservationEventSessionRow | null> {
  const updated = await getPool().query<RawSessionRow>(
    `UPDATE observation_event_sessions
     SET primary_mode = $2,
         active_modes = (
           SELECT ARRAY(SELECT DISTINCT m FROM unnest(active_modes || ARRAY[$2]::text[]) AS m)
         ),
         updated_at = NOW()
     WHERE session_id = $1
     RETURNING ${SESSION_SELECT}`,
    [sessionId, nextMode],
  );
  const row = updated.rows[0];
  if (!row) return null;
  await appendLiveEvent({
    sessionId,
    type: "mode_switch",
    scope: "all",
    actorUserId,
    payload: {
      primary_mode: nextMode,
      active_modes: row.active_modes,
    },
  });
  return mapSession(row);
}

export async function endSession(
  sessionId: string,
): Promise<ObservationEventSessionRow | null> {
  const updated = await getPool().query<RawSessionRow>(
    `UPDATE observation_event_sessions
     SET ended_at = COALESCE(ended_at, NOW()),
         updated_at = NOW()
     WHERE session_id = $1
     RETURNING ${SESSION_SELECT}`,
    [sessionId],
  );
  const row = updated.rows[0];
  return row ? mapSession(row) : null;
}

/**
 * 5 モードそれぞれが何を測るかの宣言:
 * - discovery: 種数・新種・目標達成率
 * - effort_maximize: 訪問メッシュ × 滞在時間 × カバレッジ
 * - bingo: ビンゴマス達成数(Absence マス含む)
 * - absence_confirm: Absence 確認数 + effort 時間
 * - ai_quest: AI Quest 受諾→達成数
 *
 * フロントの「メーター」表示はモードごとに分母が変わるので、
 * 主モードに応じて UI が出すべきラベルを返すだけのヘルパーをここに集約しておく。
 */
export interface ModeMeterDescriptor {
  label: string;
  unit: string;
  description: string;
}

export const MODE_METERS: Record<EventMode, ModeMeterDescriptor> = {
  discovery: {
    label: "目標達成",
    unit: "種",
    description: "目標種を見つけた数 / 目標種の総数",
  },
  effort_maximize: {
    label: "メッシュカバレッジ",
    unit: "%",
    description: "100m メッシュの踏破率と effort 値(人時)",
  },
  bingo: {
    label: "ビンゴ達成",
    unit: "マス",
    description: "通常マス + 不在確認マスの達成数",
  },
  absence_confirm: {
    label: "不在確認",
    unit: "種",
    description: "期待種から見つからなかったことを確かめた数",
  },
  ai_quest: {
    label: "クエスト達成",
    unit: "件",
    description: "AI が提案したクエストの受諾→達成数",
  },
};
