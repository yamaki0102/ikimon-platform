import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  generatePlaceEventCapsule,
  getPlaceEventCapsule,
  publicCapsuleView,
  updatePlaceEventCapsuleReviewStatus,
  type CapsuleReviewStatus,
} from "../services/observationEventCapsule.js";
import { buildRecap } from "../services/observationEventRecap.js";
import { requireObservationEventViewerAccess } from "../services/observationEventParticipantAccess.js";
import { getSessionByEventCode, getSessionById } from "../services/observationEventModeManager.js";
import {
  buildOfficialEventReport,
  canAccessOfficialEventOutputs,
  officialSpeciesCsv,
} from "../services/observationEventOfficialReport.js";
import { runQuestGeneration } from "../services/observationEventQuestEngine.js";
import { decideQuest } from "../services/observationEventQuestEngine.js";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function capsuleStatusCode(message: string): number {
  if (message === "session_not_found" || message === "capsule_not_found") return 404;
  if (message === "organizer_only") return 403;
  if (message === "privacy_risk_queue_not_resolved") return 409;
  if (message.endsWith("_required") || message === "invalid_review_status") return 400;
  return 500;
}

function parseReviewStatus(value: unknown): CapsuleReviewStatus | null {
  const allowed = ["draft", "needs_review", "approved_private", "approved_public", "published"] as const;
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? value as CapsuleReviewStatus
    : null;
}

export async function registerObservationEventRecapRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/observation-events/:sessionId/recap
  app.get<{ Params: { sessionId: string }; Querystring: { limit?: string } }>(
    "/api/v1/observation-events/:sessionId/recap",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      reply.header("Cache-Control", "private, no-store");
      reply.header("Vary", "Cookie");
      const viewer = await requireObservationEventViewerAccess(session, request.headers.cookie);
      if (!viewer) return reply.status(403).send({ error: "event participant required" });
      const limit = Number(request.query.limit ?? 200);
      const recap = await buildRecap(request.params.sessionId, {
        viewerUserId: viewer.userId,
        viewerGuestToken: viewer.guestCredentialDigest,
        timelineLimit: Number.isFinite(limit) ? limit : 200,
      });
      if (!recap) return reply.status(404).send({ error: "session not found" });
      return reply.send(recap);
    },
  );

  // GET /api/v1/observation-events/by-code/:eventCode/recap
  app.get<{ Params: { eventCode: string }; Querystring: { limit?: string } }>(
    "/api/v1/observation-events/by-code/:eventCode/recap",
    async (request, reply) => {
      const session = await getSessionByEventCode(request.params.eventCode);
      if (!session) return reply.status(404).send({ error: "session not found" });
      reply.header("Cache-Control", "private, no-store");
      reply.header("Vary", "Cookie");
      const viewer = await requireObservationEventViewerAccess(session, request.headers.cookie);
      if (!viewer) return reply.status(403).send({ error: "event participant required" });
      const recap = await buildRecap(session.sessionId, {
        viewerUserId: viewer.userId,
        viewerGuestToken: viewer.guestCredentialDigest,
        timelineLimit: 200,
      });
      if (!recap) return reply.status(404).send({ error: "recap not built" });
      return reply.send(recap);
    },
  );

  // GET /api/v1/observation-events/:sessionId/species.csv
  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId/species.csv",
    async (request, reply) => {
      const report = await buildOfficialEventReport(request.params.sessionId);
      if (!report) return reply.status(404).send({ error: "session not found" });
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!canAccessOfficialEventOutputs(report.session, auth?.userId ?? null)) {
        return reply.status(403).send({ error: "public plan or organizer required" });
      }
      const filename = `zukan-event-${report.session.sessionId}-species.csv`;
      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`);
      return officialSpeciesCsv(report);
    },
  );

  // POST /api/v1/observation-events/:sessionId/capsule/generate
  app.post<{ Params: { sessionId: string }; Body: { use_ai?: boolean; useAi?: boolean } }>(
    "/api/v1/observation-events/:sessionId/capsule/generate",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      try {
        const capsule = await generatePlaceEventCapsule({
          sessionId: request.params.sessionId,
          actorUserId: auth.userId,
          useAi: request.body?.useAi ?? request.body?.use_ai,
        });
        return reply.send({ ok: true, capsule });
      } catch (error) {
        const message = error instanceof Error ? error.message : "capsule_generate_failed";
        return reply.status(capsuleStatusCode(message)).send({ ok: false, error: message });
      }
    },
  );

  // GET /api/v1/observation-events/:sessionId/capsule
  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/observation-events/:sessionId/capsule",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      const capsule = await getPlaceEventCapsule(session.sessionId);
      if (!capsule) return reply.status(404).send({ error: "capsule not found" });
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (auth?.userId === session.organizerUserId) {
        return reply.send({ ok: true, capsule, visibility: "organizer" });
      }
      const publicView = publicCapsuleView(capsule);
      if (!publicView) return reply.status(403).send({ error: "capsule not public" });
      return reply.send({ ok: true, capsule: publicView, visibility: "public" });
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/capsule/review
  app.patch<{ Params: { sessionId: string }; Body: { review_status?: string; reviewStatus?: string } }>(
    "/api/v1/observation-events/:sessionId/capsule/review",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const reviewStatus = parseReviewStatus(request.body?.reviewStatus ?? request.body?.review_status);
      if (!reviewStatus) return reply.status(400).send({ ok: false, error: "invalid_review_status" });
      try {
        const capsule = await updatePlaceEventCapsuleReviewStatus({
          sessionId: request.params.sessionId,
          actorUserId: auth.userId,
          reviewStatus,
        });
        return reply.send({ ok: true, capsule });
      } catch (error) {
        const message = error instanceof Error ? error.message : "capsule_review_failed";
        return reply.status(capsuleStatusCode(message)).send({ ok: false, error: message });
      }
    },
  );

  // POST /api/v1/observation-events/:sessionId/quests/run
  app.post<{ Params: { sessionId: string }; Body: { trigger?: string } }>(
    "/api/v1/observation-events/:sessionId/quests/run",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const session = await getSessionById(request.params.sessionId);
      if (!session) return reply.status(404).send({ error: "session not found" });
      if (session.organizerUserId !== auth.userId) {
        return reply.status(403).send({ error: "organizer only" });
      }
      const triggerRaw = asString(request.body?.trigger) ?? "manual";
      const allowedTriggers = ["interval", "new_species", "target_hit", "stuck", "rare_alert", "ending_soon", "manual"] as const;
      const trigger = (allowedTriggers as readonly string[]).includes(triggerRaw)
        ? (triggerRaw as (typeof allowedTriggers)[number])
        : "manual";
      const result = await runQuestGeneration(session.sessionId, {
        trigger,
        fallbackLat: session.locationLat,
        fallbackLng: session.locationLng,
        skipDedup: true,
      });
      return reply.send(result);
    },
  );

  // PATCH /api/v1/observation-events/:sessionId/quests/:questId
  app.patch<{
    Params: { sessionId: string; questId: string };
    Body: { decision?: string };
  }>(
    "/api/v1/observation-events/:sessionId/quests/:questId",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const decisionRaw = asString(request.body?.decision);
      const allowed = ["accepted", "declined", "completed", "expired"] as const;
      const decision = decisionRaw && (allowed as readonly string[]).includes(decisionRaw)
        ? (decisionRaw as (typeof allowed)[number])
        : null;
      if (!decision) return reply.status(400).send({ error: "invalid decision" });
      try {
        await decideQuest({
          questId: request.params.questId,
          decision,
          decidedBy: auth?.userId ?? null,
        });
        return reply.send({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "decide failed";
        return reply.status(500).send({ error: message });
      }
    },
  );
}
