import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { getLatestKnowledgeNavigationVersion } from "../services/knowledgeNavigation.js";

export async function registerKnowledgeNavigationApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/internal/knowledge-navigation/versions/latest", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.header("Cache-Control", "no-store");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return { ok: false, error: "admin_or_analyst_required" };
    }

    const version = await getLatestKnowledgeNavigationVersion();
    return { ok: true, version };
  });
}
