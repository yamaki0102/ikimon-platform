import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  hidePlaceMemoryForSelf,
  getPlaceMemoryUserPreferences,
  likePlaceMemory,
  listUnlockedPlaceMemories,
  reportPlaceMemory,
  requestPlaceMemoryPhotoReview,
  updatePlaceMemoryUserPreferences,
} from "../services/placeMemory.js";

async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
  if (!session) {
    void reply.code(401).send({ ok: false, error: "session_required" });
    return null;
  }
  return session.userId;
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "session_required" || message === "account_disabled") return 401;
  if (message === "place_memory_not_found") return 404;
  if (message.endsWith("_disabled") || message.includes("_not_allowed")) return 403;
  return 400;
}

export async function registerPlaceMemoryApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/place-memory/preferences", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    return { ok: true, preferences: await getPlaceMemoryUserPreferences(userId) };
  });

  app.post<{ Body: { defaultPhotoEchoEnabled?: boolean; defaultTagsPublic?: boolean } }>(
    "/api/v1/place-memory/preferences",
    async (request, reply) => {
      const userId = await requireUser(request, reply);
      if (!userId) return;
      return {
        ok: true,
        preferences: await updatePlaceMemoryUserPreferences(userId, {
          defaultPhotoEchoEnabled: request.body?.defaultPhotoEchoEnabled,
          defaultTagsPublic: request.body?.defaultTagsPublic,
        }),
      };
    },
  );

  app.get<{ Querystring: { cellId?: string; limit?: string; sample?: string } }>(
    "/api/v1/place-memory",
    async (request, reply) => {
      const userId = await requireUser(request, reply);
      if (!userId) return;
      const cellId = String(request.query.cellId ?? "").trim();
      if (!cellId) {
        void reply.code(400).send({ ok: false, error: "cellId_required" });
        return;
      }
      const limit = Number(request.query.limit ?? 12);
      return await listUnlockedPlaceMemories({
        userId,
        cellId,
        limit: Number.isFinite(limit) ? limit : 12,
        randomSample: request.query.sample === "1",
      });
    },
  );

  app.post<{ Params: { entryId: string } }>("/api/v1/place-memory/:entryId/like", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    try {
      return await likePlaceMemory(request.params.entryId, userId);
    } catch (error) {
      reply.code(errorStatus(error));
      return { ok: false, error: error instanceof Error ? error.message : "place_memory_like_failed" };
    }
  });

  app.post<{ Params: { entryId: string }; Body: { reasonCode?: string; reasonNote?: string } }>(
    "/api/v1/place-memory/:entryId/report",
    async (request, reply) => {
      const userId = await requireUser(request, reply);
      if (!userId) return;
      try {
        return await reportPlaceMemory(
          request.params.entryId,
          userId,
          request.body?.reasonCode ?? "other",
          request.body?.reasonNote ?? "",
        );
      } catch (error) {
        reply.code(errorStatus(error));
        return { ok: false, error: error instanceof Error ? error.message : "place_memory_report_failed" };
      }
    },
  );

  app.post<{ Params: { entryId: string }; Body: { reason?: string } }>(
    "/api/v1/place-memory/:entryId/hide",
    async (request, reply) => {
      const userId = await requireUser(request, reply);
      if (!userId) return;
      try {
        return await hidePlaceMemoryForSelf(request.params.entryId, userId, request.body?.reason ?? "self");
      } catch (error) {
        reply.code(errorStatus(error));
        return { ok: false, error: error instanceof Error ? error.message : "place_memory_hide_failed" };
      }
    },
  );

  app.post<{ Params: { entryId: string } }>(
    "/api/v1/place-memory/:entryId/photo-review",
    async (request, reply) => {
      const userId = await requireUser(request, reply);
      if (!userId) return;
      try {
        return await requestPlaceMemoryPhotoReview(request.params.entryId, userId);
      } catch (error) {
        reply.code(errorStatus(error));
        return { ok: false, error: error instanceof Error ? error.message : "place_memory_photo_review_failed" };
      }
    },
  );
}
