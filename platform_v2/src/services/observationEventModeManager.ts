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
  fieldId: string | null;
  templateSourceSessionId: string | null;
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
  field_id: string | null;
  template_source_session_id: string | null;
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
  field_id, template_source_session_id,
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
    fieldId: row.field_id,
    templateSourceSessionId: row.template_source_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSessionInput {
  legacyEventId?: string | null;
  eventCode: string;
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
  fieldId?: string | null;
  templateSourceSessionId?: string | null;
}

export const OBSERVATION_EVENT_ACTIVATION_CONFLICT = "observation_event_activation_conflict";

export class ObservationEventActivationConflictError extends Error {
  readonly code = OBSERVATION_EVENT_ACTIVATION_CONFLICT;
  readonly statusCode = 409;

  constructor() {
    super(OBSERVATION_EVENT_ACTIVATION_CONFLICT);
    this.name = "ObservationEventActivationConflictError";
  }
}

export type ObservationEventSessionQuery = (
  statement: string,
  values: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>;

export async function createSession(
  input: CreateSessionInput,
  query?: ObservationEventSessionQuery,
): Promise<ObservationEventSessionRow> {
  const eventCode = input.eventCode.trim();
  if (!eventCode) throw new Error("event_code activation key required");

  const primaryMode = input.primaryMode ?? "discovery";
  const activeModes = (input.activeModes && input.activeModes.length > 0
    ? input.activeModes
    : [primaryMode]).filter(isEventMode);

  const runQuery: ObservationEventSessionQuery = query ?? (
    (statement, values) => getPool().query<RawSessionRow>(statement, values)
  );
  const result = await runQuery(
    `INSERT INTO observation_event_sessions AS activated (
       legacy_event_id, event_code, title, organizer_user_id, corporation_id,
       plan, primary_mode, active_modes,
       location_lat, location_lng, location_radius_m,
       started_at, ended_at, target_species, config,
       field_id, template_source_session_id
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8::text[],
       $9, $10, $11,
       $12, $13, $14::text[], $15::jsonb,
       $16, $17
     )
     ON CONFLICT (event_code) DO UPDATE
     SET event_code = EXCLUDED.event_code
     WHERE activated.organizer_user_id IS NOT DISTINCT FROM EXCLUDED.organizer_user_id
       AND activated.legacy_event_id IS NOT DISTINCT FROM EXCLUDED.legacy_event_id
       AND activated.title IS NOT DISTINCT FROM EXCLUDED.title
       AND activated.corporation_id IS NOT DISTINCT FROM EXCLUDED.corporation_id
       AND activated.plan IS NOT DISTINCT FROM EXCLUDED.plan
       AND activated.primary_mode IS NOT DISTINCT FROM EXCLUDED.primary_mode
       AND activated.active_modes IS NOT DISTINCT FROM EXCLUDED.active_modes
       AND activated.location_lat IS NOT DISTINCT FROM EXCLUDED.location_lat
       AND activated.location_lng IS NOT DISTINCT FROM EXCLUDED.location_lng
       AND activated.location_radius_m IS NOT DISTINCT FROM EXCLUDED.location_radius_m
       AND activated.started_at IS NOT DISTINCT FROM EXCLUDED.started_at
       AND activated.ended_at IS NOT DISTINCT FROM EXCLUDED.ended_at
       AND activated.target_species IS NOT DISTINCT FROM EXCLUDED.target_species
       AND activated.config IS NOT DISTINCT FROM EXCLUDED.config
       AND activated.field_id IS NOT DISTINCT FROM EXCLUDED.field_id
       AND activated.template_source_session_id IS NOT DISTINCT FROM EXCLUDED.template_source_session_id
     RETURNING ${SESSION_SELECT}`,
    [
      input.legacyEventId ?? null,
      eventCode,
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
      input.fieldId ?? null,
      input.templateSourceSessionId ?? null,
    ],
  );
  const row = result.rows[0] as RawSessionRow | undefined;
  if (!row) throw new ObservationEventActivationConflictError();
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

export interface UpdateSessionInput {
  title?: string;
  eventCode?: string | null;
  primaryMode?: EventMode;
  activeModes?: EventMode[];
  locationLat?: number | null;
  locationLng?: number | null;
  locationRadiusM?: number;
  startedAt?: string;
  targetSpecies?: string[];
  plan?: "community" | "public";
  config?: Record<string, unknown>;
  fieldId?: string | null;
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
): Promise<ObservationEventSessionRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [sessionId];
  let idx = 2;
  if (input.title !== undefined) { setClauses.push(`title = $${idx++}`); values.push(input.title); }
  if (input.eventCode !== undefined) { setClauses.push(`event_code = $${idx++}`); values.push(input.eventCode); }
  if (input.primaryMode !== undefined) { setClauses.push(`primary_mode = $${idx++}`); values.push(input.primaryMode); }
  if (input.activeModes !== undefined) { setClauses.push(`active_modes = $${idx++}::text[]`); values.push(input.activeModes); }
  if (input.locationLat !== undefined) { setClauses.push(`location_lat = $${idx++}`); values.push(input.locationLat); }
  if (input.locationLng !== undefined) { setClauses.push(`location_lng = $${idx++}`); values.push(input.locationLng); }
  if (input.locationRadiusM !== undefined) { setClauses.push(`location_radius_m = $${idx++}`); values.push(input.locationRadiusM); }
  if (input.startedAt !== undefined) { setClauses.push(`started_at = $${idx++}`); values.push(input.startedAt); }
  if (input.targetSpecies !== undefined) { setClauses.push(`target_species = $${idx++}::text[]`); values.push(input.targetSpecies); }
  if (input.plan !== undefined) { setClauses.push(`plan = $${idx++}`); values.push(input.plan); }
  if (input.config !== undefined) { setClauses.push(`config = $${idx++}::jsonb`); values.push(JSON.stringify(input.config)); }
  if (input.fieldId !== undefined) { setClauses.push(`field_id = $${idx++}`); values.push(input.fieldId); }
  if (setClauses.length === 0) return getSessionById(sessionId);
  setClauses.push("updated_at = NOW()");

  const updated = await getPool().query<RawSessionRow>(
    `UPDATE observation_event_sessions
     SET ${setClauses.join(", ")}
     WHERE session_id = $1
     RETURNING ${SESSION_SELECT}`,
    values,
  );
  const row = updated.rows[0];
  return row ? mapSession(row) : null;
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
