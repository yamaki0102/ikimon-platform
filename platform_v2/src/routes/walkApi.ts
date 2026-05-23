import type { FastifyInstance } from "fastify";
import { getSessionFromMobileAuth, type SessionSnapshot } from "../services/authSession.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { getTodayWalkSummary, upsertWalkSession } from "../services/walkWrite.js";

function hasPrivilegedWriteAccess(request: Parameters<typeof assertPrivilegedWriteAccess>[0]): boolean {
  try {
    assertPrivilegedWriteAccess(request);
    return true;
  } catch {
    return false;
  }
}

function requestedUserId(body: Record<string, unknown>): string | null {
  return typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
}

function resolveTrustedWalkUserId(body: Record<string, unknown>, session: SessionSnapshot | null, isPrivileged: boolean): string {
  const requested = requestedUserId(body);
  if (session?.userId) {
    if (requested && requested !== session.userId) {
      throw new Error("forbidden_user_mismatch");
    }
    return session.userId;
  }
  if (isPrivileged && requested) {
    return requested;
  }
  return "anonymous";
}

export function registerWalkApiRoutes(app: FastifyInstance): void {
  /**
   * POST /api/v1/walk/session/start
   * Called by FieldScan app when a walk begins.
   * Auth: session cookie OR X-API-Key header.
   * Body: { externalId, startedAt, biome?, source?, rawPayload? }
   */
  app.post("/api/v1/walk/session/start", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const session = await getSessionFromMobileAuth(request).catch(() => null);
      const isPrivileged = hasPrivilegedWriteAccess(request);

      if (!session?.userId && !isPrivileged) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      const userId = resolveTrustedWalkUserId(body, session, isPrivileged);
      const startedAt = typeof body.startedAt === "string" ? body.startedAt : new Date().toISOString();

      const result = await upsertWalkSession({
        externalId: typeof body.externalId === "string" ? body.externalId : null,
        userId,
        startedAt,
        source: typeof body.source === "string" ? body.source : "fieldscan",
        biome: typeof body.biome === "string" ? body.biome : null,
        rawPayload: typeof body.rawPayload === "object" && body.rawPayload !== null
          ? (body.rawPayload as Record<string, unknown>)
          : {},
      });

      return reply.status(201).send({ walkSessionId: result.walkSessionId, created: result.created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "walk_session_start_failed";
      return reply.status(message.startsWith("forbidden") ? 403 : 500).send({ error: message });
    }
  });

  /**
   * POST /api/v1/walk/session/end
   * Called by FieldScan app when a walk ends.
   * Body: { externalId, endedAt, distanceM?, stepCount?, topSpecies?, passiveDetectionCount?, rawPayload? }
   */
  app.post("/api/v1/walk/session/end", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const session = await getSessionFromMobileAuth(request).catch(() => null);
      const isPrivileged = hasPrivilegedWriteAccess(request);

      if (!session?.userId && !isPrivileged) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      const userId = resolveTrustedWalkUserId(body, session, isPrivileged);

      const topSpecies = Array.isArray(body.topSpecies)
        ? (body.topSpecies as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 10)
        : [];

      const result = await upsertWalkSession({
        externalId: typeof body.externalId === "string" ? body.externalId : null,
        userId,
        startedAt: typeof body.startedAt === "string" ? body.startedAt : new Date().toISOString(),
        endedAt: typeof body.endedAt === "string" ? body.endedAt : new Date().toISOString(),
        distanceM: typeof body.distanceM === "number" ? body.distanceM : null,
        stepCount: typeof body.stepCount === "number" ? body.stepCount : null,
        passiveDetectionCount: typeof body.passiveDetectionCount === "number" ? body.passiveDetectionCount : 0,
        topSpecies,
        rawPayload: typeof body.rawPayload === "object" && body.rawPayload !== null
          ? (body.rawPayload as Record<string, unknown>)
          : {},
      });

      return reply.send({ walkSessionId: result.walkSessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "walk_session_end_failed";
      return reply.status(message.startsWith("forbidden") ? 403 : 500).send({ error: message });
    }
  });

  /**
   * GET /api/v1/walk/today
   * Returns today's walk summary for the logged-in user.
   * Used by the "今日のさんぽ" widget on Field Note.
   */
  app.get("/api/v1/walk/today", async (request, reply) => {
    const session = await getSessionFromMobileAuth(request).catch(() => null);
    if (!session?.userId) return reply.status(401).send({ error: "unauthorized" });

    const summary = await getTodayWalkSummary(session.userId);
    return reply.send(summary);
  });
}
