import type { FastifyInstance, FastifyReply } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  appendLiveEvent,
  listRecentLiveEvents,
  subscribeToSession,
  type LiveEventRow,
  type LiveEventScope,
} from "../services/observationEventLive.js";
import {
  createSession,
  endSession,
  getSessionById,
  getSessionByEventCode,
  isEventMode,
  switchPrimaryMode,
  updateSession,
  EVENT_MODES,
  type EventMode,
  type ObservationEventSessionRow,
} from "../services/observationEventModeManager.js";
import {
  recordMeshVisit,
  summarizeSessionEffort,
} from "../services/observationEventEffort.js";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function writeSse(reply: FastifyReply, event: string, payload: unknown): void {
  if (reply.raw.destroyed) return;
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

interface ParticipantContext {
  participantId: string | null;
  userId: string | null;
  guestToken: string | null;
  teamId: string | null;
  isOrganizer: boolean;
  isMinor: boolean;
}

async function resolveParticipantContext(
  session: ObservationEventSessionRow,
  cookieHeader: string | undefined,
  guestTokenOverride?: string | null,
): Promise<ParticipantContext> {
  const authSession = await getSessionFromCookie(cookieHeader ?? "").catch(() => null);
  const userId = authSession?.userId ?? null;
  const isOrganizer = userId !== null && userId === session.organizerUserId;

  const guestToken = guestTokenOverride ?? null;
  if (!userId && !guestToken) {
    return {
      participantId: null,
      userId: null,
      guestToken: null,
      teamId: null,
      isOrganizer: false,
      isMinor: false,
    };
  }

  const result = await getPool().query<{
    participant_id: string;
    team_id: string | null;
    is_minor: boolean;
  }>(
    `SELECT participant_id, team_id, is_minor
     FROM observation_event_participants
     WHERE session_id = $1
       AND (
         (user_id IS NOT NULL AND user_id = $2)
         OR (guest_token IS NOT NULL AND guest_token = $3)
       )
     LIMIT 1`,
    [session.sessionId, userId, guestToken],
  );
  const row = result.rows[0];
  return {
    participantId: row?.participant_id ?? null,
    userId,
    guestToken,
    teamId: row?.team_id ?? null,
    isOrganizer,
    isMinor: row?.is_minor ?? false,
  };
}

function shouldDeliverEvent(row: LiveEventRow, ctx: ParticipantContext): boolean {
  const scope = row.scope as LiveEventScope;
  if (scope === "all") return true;
  if (scope === "organizer") return ctx.isOrganizer;
  if (scope === "team") return ctx.teamId !== null && ctx.teamId === row.teamId;
  if (scope === "self") {
    const payload = row.payload as Record<string, unknown>;
    const targetUser = asString(payload.target_user_id);
    const targetGuest = asString(payload.target_guest_token);
    if (targetUser && ctx.userId === targetUser) return true;
    if (targetGuest && ctx.guestToken === targetGuest) return true;
    return false;
  }
  return true;
}

export async function registerObservationEventApiRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/observation-events  — セッション作成(主催者)
  app.post("/api/v1/observation-events", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session) return reply.status(401).send({ error: "login required" });

    const body = (request.body ?? {}) as Record<string, unknown>;
    const startedAtRaw = asString(body.started_at);
    if (!startedAtRaw) {
      return reply.status(400).send({ error: "started_at required" });
    }

    const primaryModeRaw = asString(body.primary_mode);
    const primaryMode: EventMode = isEventMode(primaryModeRaw) ? primaryModeRaw : "discovery";

    const activeModesRaw = Array.isArray(body.active_modes)
      ? (body.active_modes as unknown[]).filter(isEventMode)
      : [];
    const activeModes = activeModesRaw.length > 0 ? activeModesRaw : [primaryMode];

    const targetSpecies = Array.isArray(body.target_species)
      ? (body.target_species as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    try {
      const created = await createSession({
        legacyEventId: asString(body.legacy_event_id),
        eventCode: asString(body.event_code),
        title: asString(body.title) ?? "",
        organizerUserId: session.userId,
        corporationId: asString(body.corporation_id),
        plan: body.plan === "public" ? "public" : "community",
        primaryMode,
        activeModes,
        locationLat: asNumber(body.location_lat),
        locationLng: asNumber(body.location_lng),
        locationRadiusM: asNumber(body.location_radius_m) ?? 1000,
        startedAt: startedAtRaw,
        endedAt: asString(body.ended_at),
        targetSpecies,
        config: (body.config && typeof body.config === "object")
          ? (body.config as Record<string, unknown>)
          : {},
      });
      return reply.status(201).send(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "create failed";
      return reply.status(500).send({ error: message });
    }
  });

  // GET /api/v1/observation-events/:sessionId  — セッション取得
  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId",
    async (request, reply) => {
      const row = await getSessionById(request.params.sessionId);
      if (!row) return reply.status(404).send({ error: "session not found" });
      return reply.send({ session: row, modes: EVENT_MODES });
    },
  );

  // GET /api/v1/observation-events/by-code/:eventCode  — event_code でアクセス
  app.get<{ Params: { eventCode: string } }>(
    "/api/v1/observation-events/by-code/:eventCode",
    async (request, reply) => {
      const row = await getSessionByEventCode(request.params.eventCode);
      if (!row) return reply.status(404).send({ error: "session not found" });
      return reply.send({ session: row });
    },
  );

  // GET /api/v1/observation-events/:sessionId/recent  — ポーリング降格用
  app.get<{ Params: { sessionId: string }; Querystring: { limit?: string } }>(
    "/api/v1/observation-events/:sessionId/recent",
    async (request, reply) => {
      const row = await getSessionById(request.params.sessionId);
      if (!row) return reply.status(404).send({ error: "session not found" });
      const limit = Number(request.query.limit ?? 100);
      const events = await listRecentLiveEvents(
        request.params.sessionId,
        Number.isFinite(limit) ? limit : 100,
      );
      const ctx = await resolveParticipantContext(
        row,
        request.headers.cookie,
      );
      return reply.send({
        session: row,
        events: events.filter((e) => shouldDeliverEvent(e, ctx)),
      });
    },
  );

  // GET /api/v1/observation-events/:sessionId/live  — SSE
  app.get<{ Params: { sessionId: string }; Querystring: { guest_token?: string } }>(
    "/api/v1/observation-events/:sessionId/live",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const ctx = await resolveParticipantContext(
        session,
        request.headers.cookie,
        asString(request.query.guest_token),
      );

      reply.raw.writeHead(200, SSE_HEADERS);

      const recent = await listRecentLiveEvents(request.params.sessionId, 50);
      writeSse(reply, "snapshot", {
        session,
        events: recent.filter((e) => shouldDeliverEvent(e, ctx)).reverse(),
      });

      let unsubscribe: (() => void) | null = null;
      try {
        unsubscribe = await subscribeToSession(request.params.sessionId, (row) => {
          if (!shouldDeliverEvent(row, ctx)) return;
          writeSse(reply, "live", row);
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[obs-event-api] subscribe failed", error);
        writeSse(reply, "error", { error: "subscribe failed" });
        reply.raw.end();
        return reply;
      }

      const heartbeat = setInterval(() => {
        if (reply.raw.destroyed) {
          clearInterval(heartbeat);
          return;
        }
        writeSse(reply, "ping", { now: new Date().toISOString() });
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        if (unsubscribe) {
          try { unsubscribe(); } catch { /* noop */ }
        }
      };
      request.raw.on("close", cleanup);
      request.raw.on("error", cleanup);

      return reply;
    },
  );

  // POST /api/v1/observation-events/:sessionId/announce  — 主催者アナウンス
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/announce",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const message = asString(request.body?.message);
      if (!message) return reply.status(400).send({ error: "message required" });

      const row = await appendLiveEvent({
        sessionId: session.sessionId,
        type: "announce",
        scope: "all",
        actorUserId: auth.userId,
        payload: {
          message,
          template: asString(request.body?.template) ?? null,
        },
      });
      return reply.send({ event: row });
    },
  );

  // POST /api/v1/observation-events/:sessionId/teams  — 班作成
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/teams",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const name = asString(request.body?.name);
      if (!name) return reply.status(400).send({ error: "name required" });
      const color = asString(request.body?.color) ?? "#4f9d69";
      const leadUserId = asString(request.body?.lead_user_id);
      const targetTaxa = Array.isArray(request.body?.target_taxa)
        ? (request.body!.target_taxa as unknown[]).filter((s): s is string => typeof s === "string")
        : [];

      const result = await getPool().query<{
        team_id: string;
        name: string;
        color: string;
        lead_user_id: string | null;
        target_taxa: string[];
      }>(
        `INSERT INTO observation_event_teams (session_id, name, color, lead_user_id, target_taxa)
         VALUES ($1, $2, $3, $4, $5::text[])
         RETURNING team_id, name, color, lead_user_id, target_taxa`,
        [session.sessionId, name, color, leadUserId, targetTaxa],
      );
      const team = result.rows[0]!;
      await appendLiveEvent({
        sessionId: session.sessionId,
        type: "team_update",
        scope: "all",
        actorUserId: auth.userId,
        teamId: team.team_id,
        payload: { kind: "created", team },
      });
      return reply.status(201).send({ team });
    },
  );

  // POST /api/v1/observation-events/:sessionId/checkin  — チェックイン
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/checkin",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });

      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const guestToken = asString(request.body?.guest_token);
      const displayName = asString(request.body?.display_name) ?? "";
      const isMinor = request.body?.is_minor === true;
      const teamId = asString(request.body?.team_id);
      const shareLocation = request.body?.share_location !== false; // default ON

      if (!auth && !guestToken) {
        return reply.status(400).send({ error: "user or guest_token required" });
      }

      const upsert = await getPool().query<{ participant_id: string }>(
        `INSERT INTO observation_event_participants (
            session_id, user_id, guest_token, display_name, team_id, role, status,
            checked_in_at, share_location, is_minor
         ) VALUES ($1, $2, $3, $4, $5, 'participant', 'checked_in',
                   NOW(), $6, $7)
         ON CONFLICT (session_id, user_id)
         WHERE user_id IS NOT NULL DO UPDATE SET
            display_name = EXCLUDED.display_name,
            team_id      = COALESCE(EXCLUDED.team_id, observation_event_participants.team_id),
            status       = 'checked_in',
            checked_in_at = NOW(),
            share_location = EXCLUDED.share_location,
            is_minor     = EXCLUDED.is_minor
         RETURNING participant_id`,
        [
          session.sessionId,
          auth?.userId ?? null,
          guestToken,
          displayName,
          teamId,
          shareLocation && !isMinor,
          isMinor,
        ],
      );
      // Guest path uses different unique index, so we re-run for guests if needed.
      let participantId = upsert.rows[0]?.participant_id ?? null;
      if (!participantId && guestToken) {
        const guestUpsert = await getPool().query<{ participant_id: string }>(
          `INSERT INTO observation_event_participants (
              session_id, user_id, guest_token, display_name, team_id, role, status,
              checked_in_at, share_location, is_minor
           ) VALUES ($1, NULL, $2, $3, $4, 'participant', 'checked_in', NOW(), $5, $6)
           ON CONFLICT (session_id, guest_token)
           WHERE guest_token IS NOT NULL DO UPDATE SET
              display_name = EXCLUDED.display_name,
              team_id      = COALESCE(EXCLUDED.team_id, observation_event_participants.team_id),
              status       = 'checked_in',
              checked_in_at = NOW(),
              share_location = EXCLUDED.share_location,
              is_minor     = EXCLUDED.is_minor
           RETURNING participant_id`,
          [
            session.sessionId,
            guestToken,
            displayName,
            teamId,
            shareLocation && !isMinor,
            isMinor,
          ],
        );
        participantId = guestUpsert.rows[0]?.participant_id ?? null;
      }

      if (!participantId) {
        return reply.status(500).send({ error: "checkin failed" });
      }

      await appendLiveEvent({
        sessionId: session.sessionId,
        type: "checkin",
        scope: "organizer",
        actorUserId: auth?.userId ?? null,
        actorGuestToken: guestToken,
        teamId,
        payload: {
          participant_id: participantId,
          display_name: displayName,
          team_id: teamId,
        },
      });

      return reply.send({ participant_id: participantId });
    },
  );

  // POST /api/v1/observation-events/:sessionId/absences  — Absence 記録
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/absences",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });

      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const guestToken = asString(request.body?.guest_token);
      const taxon = asString(request.body?.searched_taxon);
      const lat = asNumber(request.body?.lat);
      const lng = asNumber(request.body?.lng);
      const effortSeconds = asNumber(request.body?.effort_seconds) ?? 0;
      const confidenceRaw = asString(request.body?.confidence) ?? "searched";
      const confidence = ["searched", "confirmed_absent", "expert_verified"].includes(confidenceRaw)
        ? confidenceRaw
        : "searched";
      const teamId = asString(request.body?.team_id);

      if (!taxon || lat === null || lng === null) {
        return reply.status(400).send({ error: "searched_taxon, lat, lng required" });
      }
      if (!auth && !guestToken) {
        return reply.status(400).send({ error: "user or guest_token required" });
      }

      const inserted = await getPool().query<{ absence_id: string }>(
        `INSERT INTO observation_event_absences (
            session_id, user_id, guest_token, team_id,
            searched_taxon, searched_at, effort_seconds, lat, lng, confidence, notes
         ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10)
         RETURNING absence_id`,
        [
          session.sessionId,
          auth?.userId ?? null,
          guestToken,
          teamId,
          taxon,
          Math.max(0, Math.round(effortSeconds)),
          lat,
          lng,
          confidence,
          asString(request.body?.notes) ?? "",
        ],
      );
      const absenceId = inserted.rows[0]?.absence_id;
      if (!absenceId) return reply.status(500).send({ error: "insert failed" });

      await recordMeshVisit({
        sessionId: session.sessionId,
        lat,
        lng,
        absenceDelta: 1,
        teamId,
      });

      const ev = await appendLiveEvent({
        sessionId: session.sessionId,
        type: "absence_recorded",
        scope: "all",
        actorUserId: auth?.userId ?? null,
        actorGuestToken: guestToken,
        teamId,
        payload: {
          absence_id: absenceId,
          searched_taxon: taxon,
          confidence,
        },
      });

      return reply.status(201).send({ absence_id: absenceId, event: ev });
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/mode  — モード切替
  app.patch<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/mode",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const next = asString(request.body?.primary_mode);
      if (!next || !isEventMode(next)) {
        return reply.status(400).send({ error: "invalid primary_mode" });
      }
      const updated = await switchPrimaryMode(session.sessionId, next, auth.userId);
      if (!updated) return reply.status(500).send({ error: "switch failed" });
      return reply.send({ session: updated });
    },
  );

  // PATCH /api/v1/observation-events/:sessionId  — セッション編集(主催者のみ)
  app.patch<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const body = request.body ?? {};
      const updates: Parameters<typeof updateSession>[1] = {};
      if (typeof body.title === "string") updates.title = body.title;
      if (typeof body.event_code === "string") updates.eventCode = body.event_code;
      const primaryRaw = asString(body.primary_mode);
      if (primaryRaw && isEventMode(primaryRaw)) updates.primaryMode = primaryRaw;
      if (Array.isArray(body.active_modes)) {
        const filtered = (body.active_modes as unknown[]).filter(isEventMode);
        if (filtered.length > 0) updates.activeModes = filtered;
      }
      if (body.location_lat !== undefined) updates.locationLat = asNumber(body.location_lat);
      if (body.location_lng !== undefined) updates.locationLng = asNumber(body.location_lng);
      if (body.location_radius_m !== undefined) {
        const r = asNumber(body.location_radius_m);
        if (r !== null) updates.locationRadiusM = r;
      }
      if (typeof body.started_at === "string") updates.startedAt = body.started_at;
      if (Array.isArray(body.target_species)) {
        updates.targetSpecies = (body.target_species as unknown[]).filter((s): s is string => typeof s === "string");
      }
      if (body.plan === "public" || body.plan === "community") updates.plan = body.plan;
      if (body.config && typeof body.config === "object") updates.config = body.config as Record<string, unknown>;

      const updated = await updateSession(session.sessionId, updates);
      if (!updated) return reply.status(500).send({ error: "update failed" });
      return reply.send({ session: updated });
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/role  — 役割宣言(参加者本人のみ)
  app.patch<{
    Params: { sessionId: string };
    Body: Record<string, unknown>;
  }>(
    "/api/v1/observation-events/:sessionId/role",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const guestToken = asString(request.body?.guest_token);
      const declaredJob = asString(request.body?.declared_job);
      const allowed = ["shoot", "identify", "map", "record", "absence", "free"] as const;
      if (!declaredJob || !(allowed as readonly string[]).includes(declaredJob)) {
        return reply.status(400).send({ error: "invalid declared_job" });
      }
      if (!auth && !guestToken) {
        return reply.status(400).send({ error: "user or guest_token required" });
      }
      const result = await getPool().query<{ participant_id: string; team_id: string | null }>(
        `UPDATE observation_event_participants
         SET declared_job = $4
         WHERE session_id = $1
           AND ((user_id IS NOT NULL AND user_id = $2) OR (guest_token IS NOT NULL AND guest_token = $3))
         RETURNING participant_id, team_id`,
        [session.sessionId, auth?.userId ?? null, guestToken, declaredJob],
      );
      const row = result.rows[0];
      if (!row) return reply.status(404).send({ error: "participant not found" });
      await appendLiveEvent({
        sessionId: session.sessionId,
        type: "team_update",
        scope: "team",
        teamId: row.team_id,
        actorUserId: auth?.userId ?? null,
        actorGuestToken: guestToken,
        payload: { kind: "role", participant_id: row.participant_id, declared_job: declaredJob },
      });
      return reply.send({ participant_id: row.participant_id, declared_job: declaredJob });
    },
  );

  // POST /api/v1/observation-events/:sessionId/end  — セッション終了
  app.post<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId/end",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const ended = await endSession(session.sessionId);
      return reply.send({ session: ended });
    },
  );

  // GET /api/v1/observation-events/:sessionId/effort  — Effort 集計
  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId/effort",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const targetCells = Number(
        (session.config as Record<string, unknown>).coverage_target_cells ?? 100,
      );
      const summary = await summarizeSessionEffort(
        session.sessionId,
        Number.isFinite(targetCells) && targetCells > 0 ? targetCells : 100,
      );
      return reply.send({ session, effort: summary });
    },
  );
}
