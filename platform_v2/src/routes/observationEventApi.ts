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
import { planObservationEventArea } from "../services/observationEventAreaPlanner.js";
import { getAreaLocalSignals } from "../services/observationEventAreaSignals.js";
import { listNearbyFields } from "../services/observationFieldRegistry.js";
import { getSiteBrief } from "../services/siteBrief.js";
import {
  changeRallyMission,
  createRallyMission,
  createRallyStation,
  ensureRallyCourse,
  getRallySnapshot,
  isLocationShareOpen,
  locationShareUntil,
  recordRallySubmission,
  resolveLocationShareConsent,
  reviewRallySubmission,
  switchRallyWeatherMode,
  type RallyRevisionAction,
} from "../services/observationRally.js";

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

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
  // POST /api/v1/observation-events/area-suggestions — 開催範囲のAI補正候補
  app.post("/api/v1/observation-events/area-suggestions", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session) return reply.status(401).send({ error: "login required" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    const centerRaw = body.center && typeof body.center === "object"
      ? (body.center as Record<string, unknown>)
      : {};
    const lat = asNumber(centerRaw.lat);
    const lng = asNumber(centerRaw.lng);
    if (lat === null || lng === null) {
      return reply.status(400).send({ error: "center.lat and center.lng required" });
    }
    const nearbyFieldsPromise = listNearbyFields(lat, lng, 1.2, { limit: 8 }).catch(() => []);
    const siteBriefPromise = getSiteBrief(lat, lng, "ja").catch(() => null);
    const nearbyFields = await nearbyFieldsPromise;
    const [siteBrief, localSignals] = await Promise.all([
      siteBriefPromise,
      getAreaLocalSignals({
        center: { lat, lng },
        nearbyFields,
      }).catch(() => null),
    ]);
    const plan = await planObservationEventArea({
      center: { lat, lng },
      radiusM: asNumber(body.radius_m) ?? asNumber(body.radiusM),
      drawnPolygon: (body.drawn_polygon && typeof body.drawn_polygon === "object")
        ? (body.drawn_polygon as Record<string, unknown>)
        : (body.drawnPolygon && typeof body.drawnPolygon === "object")
          ? (body.drawnPolygon as Record<string, unknown>)
          : null,
      placeLabel: asString(body.place_label) ?? asString(body.placeLabel),
      intent: asString(body.intent),
      nearbyFields: nearbyFields.map((f) => ({
        name: f.name,
        source: f.adminLevel ?? f.source,
        distanceKm: f.distanceKm,
      })),
      siteBrief,
      localSignals,
      userId: session.userId,
    });
    return reply.send(plan);
  });

  // POST /api/v1/observation-events  — セッション作成(主催者)
  app.post("/api/v1/observation-events", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session) return reply.status(401).send({ error: "login required" });

    const body = (request.body ?? {}) as Record<string, unknown>;
    const startedAtRaw = asString(body.started_at);
    if (!startedAtRaw) {
      return reply.status(400).send({ error: "started_at required" });
    }
    const title = asString(body.title);
    if (!title) {
      return reply.status(400).send({ error: "title required" });
    }
    const fieldId = asString(body.field_id);
    const locationLat = asNumber(body.location_lat);
    const locationLng = asNumber(body.location_lng);
    if (!fieldId && (locationLat === null || locationLng === null)) {
      return reply.status(400).send({ error: "field_id or location_lat/location_lng required" });
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
        title,
        organizerUserId: session.userId,
        corporationId: asString(body.corporation_id),
        plan: body.plan === "public" ? "public" : "community",
        primaryMode,
        activeModes,
        locationLat,
        locationLng,
        locationRadiusM: asNumber(body.location_radius_m) ?? 1000,
        startedAt: startedAtRaw,
        endedAt: asString(body.ended_at),
        targetSpecies,
        config: (body.config && typeof body.config === "object")
          ? (body.config as Record<string, unknown>)
          : {},
        fieldId,
        templateSourceSessionId: asString(body.template_source_session_id),
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
      const locationConsent = resolveLocationShareConsent({
        wantsShare: shareLocation,
        isMinor,
        consentType: asString(request.body?.location_share_consent_type),
        guardianConsent: request.body?.guardian_location_consent === true,
      });
      const shareUntil = locationConsent !== null ? locationShareUntil(session)?.toISOString() ?? null : null;
      const locationShareEnabled = locationConsent !== null && shareUntil !== null;

      if (!auth && !guestToken) {
        return reply.status(400).send({ error: "user or guest_token required" });
      }

      const upsert = await getPool().query<{ participant_id: string }>(
        `INSERT INTO observation_event_participants (
            session_id, user_id, guest_token, display_name, team_id, role, status,
            checked_in_at, share_location, is_minor,
            location_share_started_at, location_share_until, location_share_consent_type
         ) VALUES ($1, $2, $3, $4, $5, 'participant', 'checked_in',
                   NOW(), $6, $7,
                   CASE WHEN $6 THEN NOW() ELSE NULL END, $8, $9)
         ON CONFLICT (session_id, user_id)
         WHERE user_id IS NOT NULL DO UPDATE SET
            display_name = EXCLUDED.display_name,
            team_id      = COALESCE(EXCLUDED.team_id, observation_event_participants.team_id),
            status       = 'checked_in',
            checked_in_at = NOW(),
            share_location = EXCLUDED.share_location,
            is_minor     = EXCLUDED.is_minor,
            location_share_started_at = EXCLUDED.location_share_started_at,
            location_share_until = EXCLUDED.location_share_until,
            location_share_consent_type = EXCLUDED.location_share_consent_type
         RETURNING participant_id`,
        [
          session.sessionId,
          auth?.userId ?? null,
          guestToken,
          displayName,
          teamId,
          locationShareEnabled,
          isMinor,
          shareUntil,
          locationConsent,
        ],
      );
      // Guest path uses different unique index, so we re-run for guests if needed.
      let participantId = upsert.rows[0]?.participant_id ?? null;
      if (!participantId && guestToken) {
        const guestUpsert = await getPool().query<{ participant_id: string }>(
          `INSERT INTO observation_event_participants (
              session_id, user_id, guest_token, display_name, team_id, role, status,
              checked_in_at, share_location, is_minor,
              location_share_started_at, location_share_until, location_share_consent_type
           ) VALUES ($1, NULL, $2, $3, $4, 'participant', 'checked_in', NOW(), $5, $6,
                     CASE WHEN $5 THEN NOW() ELSE NULL END, $7, $8)
           ON CONFLICT (session_id, guest_token)
           WHERE guest_token IS NOT NULL DO UPDATE SET
              display_name = EXCLUDED.display_name,
              team_id      = COALESCE(EXCLUDED.team_id, observation_event_participants.team_id),
              status       = 'checked_in',
              checked_in_at = NOW(),
              share_location = EXCLUDED.share_location,
              is_minor     = EXCLUDED.is_minor,
              location_share_started_at = EXCLUDED.location_share_started_at,
              location_share_until = EXCLUDED.location_share_until,
              location_share_consent_type = EXCLUDED.location_share_consent_type
           RETURNING participant_id`,
          [
            session.sessionId,
            guestToken,
            displayName,
            teamId,
            locationShareEnabled,
            isMinor,
            shareUntil,
            locationConsent,
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
          location_share: locationShareEnabled,
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
      if (body.field_id !== undefined) updates.fieldId = asString(body.field_id);

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

  // GET /api/v1/observation-events/:sessionId/rally  — 観察ラリー snapshot
  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId/rally",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const rally = await getRallySnapshot(session.sessionId);
      return reply.send({ session, rally });
    },
  );

  // POST /api/v1/observation-events/:sessionId/rally/course  — 主催者がラリーを開始/更新
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/course",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const statusRaw = asString(request.body?.status);
      const course = await ensureRallyCourse({
        sessionId: session.sessionId,
        actorUserId: auth.userId,
        title: asString(request.body?.title) ?? "観察ラリー",
        status: statusRaw === "live" || statusRaw === "closed" || statusRaw === "draft"
          ? statusRaw
          : "preflight",
        config: asObject(request.body?.config) ?? {},
      });
      return reply.send({ course });
    },
  );

  // POST /api/v1/observation-events/:sessionId/rally/stations  — 主催者が地点/範囲/ルートを追加
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/stations",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const name = asString(request.body?.name);
      if (!name) return reply.status(400).send({ error: "name required" });
      const station = await createRallyStation({
        sessionId: session.sessionId,
        actorUserId: auth.userId,
        station: {
          fieldId: asString(request.body?.field_id),
          code: asString(request.body?.code),
          name,
          description: asString(request.body?.description),
          lat: asNumber(request.body?.lat),
          lng: asNumber(request.body?.lng),
          radiusM: asNumber(request.body?.radius_m),
          polygon: asObject(request.body?.polygon),
          routeGeojson: asObject(request.body?.route_geojson),
          isPrivate: request.body?.is_private === true,
          accessNote: asString(request.body?.access_note),
          dangerNote: asString(request.body?.danger_note),
          sortOrder: Math.round(asNumber(request.body?.sort_order) ?? 0),
        },
      });
      return reply.status(201).send({ station });
    },
  );

  // POST /api/v1/observation-events/:sessionId/rally/missions  — 主催者が地点固定/非固定ミッションを追加
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/missions",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const title = asString(request.body?.title);
      const target = asString(request.body?.target);
      const goalCount = asNumber(request.body?.goal_count);
      if (!title || !target || goalCount === null || goalCount <= 0) {
        return reply.status(400).send({ error: "title, target, positive goal_count required" });
      }
      try {
        const mission = await createRallyMission({
          sessionId: session.sessionId,
          actorUserId: auth.userId,
          mission: {
            stationId: asString(request.body?.station_id),
            replacementForMissionId: asString(request.body?.replacement_for_mission_id),
            scope: asString(request.body?.scope),
            locationBinding: asString(request.body?.location_binding),
            title,
            target,
            countUnit: asString(request.body?.count_unit),
            goalCount,
            countingPolicy: asObject(request.body?.counting_policy),
            verificationPolicy: asString(request.body?.verification_policy),
            weatherSensitivity: asString(request.body?.weather_sensitivity),
            fallbackGroup: asString(request.body?.fallback_group),
            status: asString(request.body?.status),
            startsAt: asString(request.body?.starts_at),
            endsAt: asString(request.body?.ends_at),
            sortOrder: Math.round(asNumber(request.body?.sort_order) ?? 0),
          },
        });
        return reply.status(201).send({ mission });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "mission create failed" });
      }
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/rally/missions/:missionId  — publish/pause/replace/extend/close
  app.patch<{ Params: { sessionId: string; missionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/missions/:missionId",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const actionRaw = asString(request.body?.action);
      const allowed = ["publish", "pause", "replace", "extend", "close"] as const;
      if (!actionRaw || !(allowed as readonly string[]).includes(actionRaw)) {
        return reply.status(400).send({ error: "invalid action" });
      }
      try {
        const mission = await changeRallyMission({
          sessionId: session.sessionId,
          missionId: request.params.missionId,
          action: actionRaw as RallyRevisionAction,
          actorUserId: auth.userId,
          reason: asString(request.body?.reason),
          goalCount: asNumber(request.body?.goal_count),
          endsAt: asString(request.body?.ends_at),
        });
        return reply.send({ mission });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "mission update failed" });
      }
    },
  );

  // POST /api/v1/observation-events/:sessionId/rally/preflight/weather-mode  — fallback_group 単位の雨天切替
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/preflight/weather-mode",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const mode = asString(request.body?.mode);
      if (mode !== "rain") return reply.status(400).send({ error: "invalid weather mode" });
      try {
        const result = await switchRallyWeatherMode({
          sessionId: session.sessionId,
          actorUserId: auth.userId,
          mode,
          reason: asString(request.body?.reason),
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "weather mode switch failed" });
      }
    },
  );

  // POST /api/v1/observation-events/:sessionId/rally/submissions  — 参加者がミッションへ追加
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/submissions",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const guestToken = asString(request.body?.guest_token);
      if (!auth && !guestToken) return reply.status(400).send({ error: "user or guest_token required" });
      const missionId = asString(request.body?.mission_id);
      if (!missionId) return reply.status(400).send({ error: "mission_id required" });
      const ctx = await resolveParticipantContext(session, request.headers.cookie, guestToken);
      try {
        const result = await recordRallySubmission({
          sessionId: session.sessionId,
          missionId,
          userId: auth?.userId ?? null,
          guestToken,
          teamId: asString(request.body?.team_id) ?? ctx.teamId,
          stationId: asString(request.body?.station_id),
          sourceType: asString(request.body?.source_type),
          sourceRef: asString(request.body?.source_ref),
          countValue: asNumber(request.body?.count_value),
          lat: asNumber(request.body?.lat),
          lng: asNumber(request.body?.lng),
          payload: asObject(request.body?.payload) ?? {},
        });
        return reply.status(201).send(result);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "submission failed" });
      }
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/rally/submissions/:submissionId/review  — 主催者承認
  app.patch<{ Params: { sessionId: string; submissionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/rally/submissions/:submissionId/review",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) return reply.status(403).send({ error: "organizer only" });
      const next = request.body?.review_status === "rejected" ? "rejected" : "accepted";
      try {
        const result = await reviewRallySubmission({
          sessionId: session.sessionId,
          submissionId: request.params.submissionId,
          reviewStatus: next,
          actorUserId: auth.userId,
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "review failed" });
      }
    },
  );

  // POST /api/v1/observation-events/:sessionId/location  — 開催時間限定・主催者限定の位置共有
  app.post<{ Params: { sessionId: string }; Body: Record<string, unknown> }>(
    "/api/v1/observation-events/:sessionId/location",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const guestToken = asString(request.body?.guest_token);
      if (!auth && !guestToken) return reply.status(400).send({ error: "user or guest_token required" });
      if (!isLocationShareOpen(session)) return reply.status(403).send({ error: "location sharing is outside event time" });
      const lat = asNumber(request.body?.lat);
      const lng = asNumber(request.body?.lng);
      if (lat === null || lng === null) return reply.status(400).send({ error: "lat and lng required" });
      const participantResult = await getPool().query<{
        participant_id: string;
        display_name: string;
        team_id: string | null;
        share_location: boolean;
        location_share_until: string | null;
      }>(
        `SELECT participant_id, display_name, team_id, share_location,
                location_share_until::text AS location_share_until
         FROM observation_event_participants
         WHERE session_id = $1
           AND (
             (user_id IS NOT NULL AND user_id = $2)
             OR (guest_token IS NOT NULL AND guest_token = $3)
           )
         LIMIT 1`,
        [session.sessionId, auth?.userId ?? null, guestToken],
      );
      const participant = participantResult.rows[0];
      if (!participant) return reply.status(404).send({ error: "participant not found" });
      const shareUntilMs = participant.location_share_until ? Date.parse(participant.location_share_until) : 0;
      if (!participant.share_location || !Number.isFinite(shareUntilMs) || Date.now() > shareUntilMs) {
        return reply.status(403).send({ error: "location sharing is not enabled" });
      }
      await getPool().query(
        `UPDATE observation_event_participants
         SET last_lat = $3, last_lng = $4, last_ping_at = NOW()
         WHERE session_id = $1
           AND participant_id = $2
           AND share_location = TRUE
           AND location_share_until >= NOW()`,
        [session.sessionId, participant.participant_id, lat, lng],
      );
      const event = await appendLiveEvent({
        sessionId: session.sessionId,
        type: "participant_location_ping",
        scope: "organizer",
        actorUserId: auth?.userId ?? null,
        actorGuestToken: guestToken,
        teamId: participant.team_id,
        payload: {
          participant_id: participant.participant_id,
          display_name: participant.display_name,
          team_id: participant.team_id,
          lat,
          lng,
        },
      });
      return reply.send({ ok: true, event });
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
