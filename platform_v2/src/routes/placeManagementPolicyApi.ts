import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { savePlaceManagementPolicy } from "../services/placeManagementPolicy.js";

export async function registerPlaceManagementPolicyApiRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { placeId: string };
    Body: {
      managementGoal?: unknown;
      weedTolerance?: unknown;
      invasiveResponse?: unknown;
      mowingFrequency?: unknown;
      notes?: unknown;
    };
  }>("/api/v1/places/:placeId/management-policy", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session?.userId) {
      reply.code(401);
      return { ok: false, error: "login_required" };
    }
    const placeId = decodeURIComponent(request.params.placeId || "").trim();
    if (!placeId) {
      reply.code(400);
      return { ok: false, error: "place_id_required" };
    }
    try {
      const policy = await savePlaceManagementPolicy(placeId, session.userId, request.body ?? {});
      return { ok: true, policy };
    } catch (error) {
      console.warn("[placeManagementPolicy] save failed", error);
      reply.code(500);
      return { ok: false, error: "save_failed" };
    }
  });
}
