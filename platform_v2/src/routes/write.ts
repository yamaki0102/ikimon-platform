import type { FastifyInstance } from "fastify";
import {
  getSessionFromCookie,
  issueSession,
  readSessionTokenFromCookie,
  revokeSession,
} from "../services/authSession.js";
import { issueRememberToken, revokeRememberToken } from "../services/rememberTokenWrite.js";
import { uploadObservationPhoto, type ObservationPhotoUploadInput } from "../services/observationPhotoUpload.js";
import { upsertObservation, type ObservationUpsertInput } from "../services/observationWrite.js";
import { recordSpecialistReview, type SpecialistDecision, type SpecialistLane } from "../services/specialistReview.js";
import { upsertTrack, type TrackUpsertInput } from "../services/trackWrite.js";
import { recordUiKpiEvent } from "../services/uiKpi.js";
import { upsertUser, type UserUpsertInput } from "../services/userWrite.js";

export async function registerWriteRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      userId: string;
      ttlHours?: number;
    };
  }>("/api/v1/auth/session/issue", async (request, reply) => {
    try {
      const result = await issueSession({
        userId: request.body.userId,
        ttlHours: request.body.ttlHours,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.header("set-cookie", result.cookie);
      return {
        ok: true,
        tokenHash: result.tokenHash,
        compatibility: result.compatibility,
        session: result.session,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "session_issue_failed",
      };
    }
  });

  app.get("/api/v1/auth/session", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_not_found",
        };
      }
      return {
        ok: true,
        session,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "session_lookup_failed",
      };
    }
  });

  app.post("/api/v1/auth/session/logout", async (request, reply) => {
    try {
      const result = await revokeSession(readSessionTokenFromCookie(request.headers.cookie));
      reply.header("set-cookie", result.clearedCookie);
      return result;
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "session_logout_failed",
      };
    }
  });

  app.post<{ Body: UserUpsertInput }>("/api/v1/users/upsert", async (request, reply) => {
    try {
      return await upsertUser(request.body);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "user_upsert_failed",
      };
    }
  });

  app.post<{ Body: ObservationUpsertInput }>("/api/v1/observations/upsert", async (request, reply) => {
    try {
      const result = await upsertObservation(request.body);
      void recordUiKpiEvent({
        eventName: "task_completion",
        eventSource: "api",
        routeKey: "/api/v1/observations/upsert",
        actionKey: "record_observation",
        userId: request.body.userId,
        metadata: {
          visitId: result.visitId,
          occurrenceId: result.occurrenceId,
          placeId: result.placeId,
          compatibilityAttempted: result.compatibility?.attempted ?? false,
          compatibilitySucceeded: result.compatibility?.succeeded ?? false,
        },
      }).catch(() => undefined);
      return result;
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "observation_upsert_failed",
      };
    }
  });

  app.post<{ Params: { id: string }; Body: Omit<ObservationPhotoUploadInput, "observationId"> }>(
    "/api/v1/observations/:id/photos/upload",
    async (request, reply) => {
      try {
        return await uploadObservationPhoto({
          observationId: request.params.id,
          filename: request.body.filename,
          mimeType: request.body.mimeType,
          base64Data: request.body.base64Data,
        });
      } catch (error) {
        reply.code(400);
        return {
          ok: false,
          error: error instanceof Error ? error.message : "observation_photo_upload_failed",
        };
      }
    },
  );

  app.post<{ Body: TrackUpsertInput }>("/api/v1/tracks/upsert", async (request, reply) => {
    try {
      return await upsertTrack(request.body);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "track_upsert_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      actorUserId: string;
      lane: SpecialistLane;
      decision: SpecialistDecision;
      proposedName?: string | null;
      proposedRank?: string | null;
      notes?: string | null;
    };
  }>("/api/v1/specialist/occurrences/:id/review", async (request, reply) => {
    try {
      return await recordSpecialistReview({
        occurrenceId: request.params.id,
        actorUserId: request.body.actorUserId,
        lane: request.body.lane,
        decision: request.body.decision,
        proposedName: request.body.proposedName ?? null,
        proposedRank: request.body.proposedRank ?? null,
        notes: request.body.notes ?? null,
      });
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_review_failed",
      };
    }
  });

  app.post<{
    Body: {
      userId: string;
      rawToken: string;
      expiresAt: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }>("/api/v1/auth/remember-tokens/issue", async (request, reply) => {
    try {
      return await issueRememberToken(request.body);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "remember_token_issue_failed",
      };
    }
  });

  app.post<{
    Body: {
      token: string;
    };
  }>("/api/v1/auth/remember-tokens/revoke", async (request, reply) => {
    try {
      return await revokeRememberToken(request.body.token);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "remember_token_revoke_failed",
      };
    }
  });
}
