import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { getTodayWalkSummary, upsertWalkSession } from "../services/walkWrite.js";

function checkPrivilegedKey(request: { headers: Record<string, unknown> }): boolean {
  const config = loadConfig();
  if (!config.privilegedWriteApiKey) return false;
  const header = String(request.headers["x-api-key"] ?? "");
  return header === config.privilegedWriteApiKey;
}

export function registerWalkApiRoutes(app: FastifyInstance): void {
  /**
   * POST /api/v1/walk/session/start
   * Called by FieldScan app when a walk begins.
   * Auth: session cookie OR X-API-Key header.
   * Body: { externalId, startedAt, biome?, source?, rawPayload? }
   */
  app.post("/api/v1/walk/session/start", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const isPrivileged = checkPrivilegedKey(request as unknown as { headers: Record<string, unknown> });

    if (!session?.userId && !isPrivileged) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const userId = session?.userId ?? (body.userId as string | undefined) ?? "anonymous";
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
  });

  /**
   * POST /api/v1/walk/session/end
   * Called by FieldScan app when a walk ends.
   * Body: { externalId, endedAt, distanceM?, stepCount?, topSpecies?, passiveDetectionCount?, rawPayload? }
   */
  app.post("/api/v1/walk/session/end", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const isPrivileged = checkPrivilegedKey(request as unknown as { headers: Record<string, unknown> });

    if (!session?.userId && !isPrivileged) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const userId = session?.userId ?? (body.userId as string | undefined) ?? "anonymous";

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
  });

  /**
   * GET /api/v1/walk/today
   * Returns today's walk summary for the logged-in user.
   * Used by the "今日のさんぽ" widget on Field Note.
   */
  app.get("/api/v1/walk/today", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session?.userId) return reply.status(401).send({ error: "unauthorized" });

    const summary = await getTodayWalkSummary(session.userId);
    return reply.send(summary);
  });
}
