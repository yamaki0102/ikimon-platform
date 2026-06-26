import { getPool } from "../db.js";

export type LiveEventType =
  | "observation_added"
  | "guide_scene_added"
  | "field_scan_added"
  | "absence_recorded"
  | "target_hit"
  | "rare_species"
  | "milestone"
  | "announce"
  | "moderation"
  | "help_request"
  | "checkin"
  | "team_update"
  | "mode_switch"
  | "quest_offered"
  | "quest_accepted"
  | "quest_declined"
  | "quest_completed"
  | "rally_mission_published"
  | "rally_mission_paused"
  | "rally_mission_replaced"
  | "rally_mission_extended"
  | "rally_mission_closed"
  | "rally_progress_updated"
  | "rally_goal_reached"
  | "rally_goal_exceeded"
  | "rally_station_opened"
  | "rally_arrived"
  | "rally_task_submitted"
  | "rally_task_cleared"
  | "rally_help_requested"
  | "rally_next_action"
  | "participant_location_ping"
  | "fanfare"
  | "ping";

export type LiveEventScope = "all" | "organizer" | "team" | "self";

export interface LiveEventInput {
  sessionId: string;
  type: LiveEventType;
  scope?: LiveEventScope;
  actorUserId?: string | null;
  actorGuestToken?: string | null;
  teamId?: string | null;
  payload?: Record<string, unknown>;
}

export interface LiveEventRow {
  liveEventId: string;
  sessionId: string;
  type: LiveEventType;
  scope: LiveEventScope;
  teamId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function appendLiveEvent(input: LiveEventInput): Promise<LiveEventRow> {
  const result = await getPool().query<{
    live_event_id: string;
    session_id: string;
    type: string;
    scope: string;
    team_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>(
    `INSERT INTO observation_event_live_events (
       session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING live_event_id, session_id, type, scope, team_id, payload, created_at::text AS created_at`,
    [
      input.sessionId,
      input.type,
      input.scope ?? "all",
      input.actorUserId ?? null,
      input.actorGuestToken ?? null,
      input.teamId ?? null,
      input.payload ?? {},
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("failed to append live event");
  }
  return {
    liveEventId: row.live_event_id,
    sessionId: row.session_id,
    type: row.type as LiveEventType,
    scope: row.scope as LiveEventScope,
    teamId: row.team_id,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

export async function listRecentLiveEvents(
  sessionId: string,
  limit = 100,
): Promise<LiveEventRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const result = await getPool().query<{
    live_event_id: string;
    session_id: string;
    type: string;
    scope: string;
    team_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT live_event_id, session_id, type, scope, team_id, payload, created_at::text AS created_at
     FROM observation_event_live_events
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, safeLimit],
  );
  return result.rows.map((row) => ({
    liveEventId: row.live_event_id,
    sessionId: row.session_id,
    type: row.type as LiveEventType,
    scope: row.scope as LiveEventScope,
    teamId: row.team_id,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  }));
}
