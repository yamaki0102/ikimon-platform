import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  getReviewerAccessContext,
  listReviewerAuthorityAudit,
  type ReviewerAuthorityAuditAction,
} from "../services/reviewerAuthorities.js";
import {
  listAuthorityRecommendationsForUser,
  listPendingAuthorityRecommendationsForReviewer,
} from "../services/authorityRecommendations.js";
import {
  assertSpecialistAdminSession,
  assertSpecialistSession,
} from "../services/writeGuards.js";

export async function registerSpecialistReadApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/specialist/me/authorities", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const access = await getReviewerAccessContext(session.userId, session.roleName, session.rankLabel);
      return {
        ok: true,
        globalRole: access.globalRole,
        hasSpecialistAccess: access.hasSpecialistAccess,
        authorities: access.activeAuthorities,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authorities_lookup_failed",
      };
    }
  });

  app.get("/api/v1/authority/recommendations/me", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const recommendations = await listAuthorityRecommendationsForUser(session.userId);
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/recommendations/pending", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = await assertSpecialistSession(session, session?.userId ?? "");
      const recommendations = await listPendingAuthorityRecommendationsForReviewer({
        actorUserId: resolvedSession.userId,
        actorRoleName: resolvedSession.roleName,
        actorRankLabel: resolvedSession.rankLabel,
      });
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/authorities/audit", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSpecialistAdminSession(session, session?.userId ?? "");
      const query = (typeof request.query === "object" && request.query ? request.query : {}) as Record<string, unknown>;
      const rawAction = typeof query.action === "string" ? query.action.trim() : "";
      const rawStatus = typeof query.status === "string" ? query.status.trim() : "";
      const recommendations = await listReviewerAuthorityAudit({
        subjectUserId: typeof query.subjectUserId === "string" ? query.subjectUserId.trim() : null,
        scopeTaxonName: typeof query.scopeTaxonName === "string" ? query.scopeTaxonName.trim() : null,
        action: (rawAction === "grant" || rawAction === "revoke" || rawAction === "update")
          ? rawAction as ReviewerAuthorityAuditAction
          : null,
        status: rawStatus === "active" || rawStatus === "revoked" ? rawStatus : null,
        limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
      });
      return {
        ok: true,
        audit: recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_audit_lookup_failed",
      };
    }
  });
}
