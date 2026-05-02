import type { PoolClient } from "pg";
import { getPool } from "../db.js";

interface PgNotification {
  channel?: string;
  payload?: string;
  processId?: number;
}

type EventfulClient = PoolClient & {
  on(event: "notification", listener: (msg: PgNotification) => void): EventfulClient;
  on(event: "error", listener: (err: Error) => void): EventfulClient;
  on(event: "end", listener: () => void): EventfulClient;
};

export type LiveEventType =
  | "observation_added"
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

interface LiveNotification {
  id: string;
  type: LiveEventType;
  scope: LiveEventScope;
  team_id: string | null;
  created_at: string;
}

type Subscriber = (row: LiveEventRow) => void;

const channelName = (sessionId: string): string =>
  `obs_evt_${sessionId.replace(/-/g, "")}`;

class ObservationEventLiveHub {
  private listenerClient: PoolClient | null = null;
  private listenerReady: Promise<void> | null = null;
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly listening = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;

  async subscribe(sessionId: string, fn: Subscriber): Promise<() => void> {
    await this.ensureListener();
    let bucket = this.subscribers.get(sessionId);
    if (!bucket) {
      bucket = new Set();
      this.subscribers.set(sessionId, bucket);
    }
    bucket.add(fn);

    if (!this.listening.has(sessionId)) {
      try {
        await this.listenerClient?.query(`LISTEN ${channelName(sessionId)}`);
        this.listening.add(sessionId);
      } catch (error) {
        bucket.delete(fn);
        if (bucket.size === 0) this.subscribers.delete(sessionId);
        throw error;
      }
    }

    return () => this.unsubscribe(sessionId, fn);
  }

  private unsubscribe(sessionId: string, fn: Subscriber): void {
    const bucket = this.subscribers.get(sessionId);
    if (!bucket) return;
    bucket.delete(fn);
    if (bucket.size === 0) {
      this.subscribers.delete(sessionId);
      void this.listenerClient
        ?.query(`UNLISTEN ${channelName(sessionId)}`)
        .catch(() => undefined);
      this.listening.delete(sessionId);
    }
  }

  private async ensureListener(): Promise<void> {
    if (this.listenerClient && this.listenerReady) {
      await this.listenerReady;
      return;
    }
    if (this.listenerReady) {
      await this.listenerReady;
      return;
    }
    this.listenerReady = (async () => {
      const baseClient = await getPool().connect();
      const client = baseClient as EventfulClient;
      client.on("notification", (msg: PgNotification) => {
        if (!msg.channel || !msg.payload) return;
        if (!msg.channel.startsWith("obs_evt_")) return;
        let parsed: LiveNotification;
        try {
          parsed = JSON.parse(msg.payload) as LiveNotification;
        } catch {
          return;
        }
        void this.dispatch(msg.channel, parsed);
      });
      client.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("[obs-event-live] listener error", err);
        this.scheduleReconnect();
      });
      client.on("end", () => {
        this.scheduleReconnect();
      });
      this.listenerClient = client;

      // Re-LISTEN any sessions we already had subscribers for (reconnect case).
      for (const sessionId of this.subscribers.keys()) {
        try {
          await client.query(`LISTEN ${channelName(sessionId)}`);
          this.listening.add(sessionId);
        } catch {
          // best effort
        }
      }
    })();
    try {
      await this.listenerReady;
    } catch (error) {
      this.listenerClient = null;
      this.listenerReady = null;
      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.listenerClient = null;
    this.listenerReady = null;
    this.listening.clear();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureListener().catch(() => undefined);
    }, 2_000);
  }

  private async dispatch(channel: string, note: LiveNotification): Promise<void> {
    // recover sessionId from channel by matching prefix to known subscribers
    const stripped = channel.replace(/^obs_evt_/, "");
    let matchedSessionId: string | null = null;
    for (const sessionId of this.subscribers.keys()) {
      if (sessionId.replace(/-/g, "") === stripped) {
        matchedSessionId = sessionId;
        break;
      }
    }
    if (!matchedSessionId) return;
    const bucket = this.subscribers.get(matchedSessionId);
    if (!bucket || bucket.size === 0) return;

    let row: LiveEventRow | null = null;
    try {
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
         WHERE live_event_id = $1`,
        [note.id],
      );
      const data = result.rows[0];
      if (!data) return;
      row = {
        liveEventId: data.live_event_id,
        sessionId: data.session_id,
        type: data.type as LiveEventType,
        scope: data.scope as LiveEventScope,
        teamId: data.team_id,
        payload: data.payload ?? {},
        createdAt: data.created_at,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[obs-event-live] dispatch fetch failed", error);
      return;
    }

    for (const fn of bucket) {
      try {
        fn(row);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[obs-event-live] subscriber error", error);
      }
    }
  }
}

let hubSingleton: ObservationEventLiveHub | null = null;

function hub(): ObservationEventLiveHub {
  if (!hubSingleton) {
    hubSingleton = new ObservationEventLiveHub();
  }
  return hubSingleton;
}

export async function subscribeToSession(
  sessionId: string,
  fn: Subscriber,
): Promise<() => void> {
  return hub().subscribe(sessionId, fn);
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
