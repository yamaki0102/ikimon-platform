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
import { submitContact, type ContactSubmitInput } from "../services/contactSubmit.js";
import {
  assertObservationOwnedByUser,
  assertPrivilegedWriteAccess,
  assertSessionUser,
  assertSpecialistSession,
} from "../services/writeGuards.js";

function errorStatus(error: unknown, fallback = 400): number {
  if (!(error instanceof Error)) {
    return fallback;
  }
  if (error.message === "session_required" || error.message === "account_disabled") {
    return 401;
  }
  if (
    error.message.startsWith("forbidden") ||
    error.message === "observation_not_owned" ||
    error.message === "specialist_role_required"
  ) {
    return 403;
  }
  return fallback;
}

export async function registerWriteRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      userId: string;
      ttlHours?: number;
    };
  }>("/api/v1/auth/session/issue", async (request, reply) => {
    try {
      assertPrivilegedWriteAccess(request);
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
      reply.code(errorStatus(error, 400));
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
      assertPrivilegedWriteAccess(request);
      return await upsertUser(request.body);
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "user_upsert_failed",
      };
    }
  });

  app.post<{ Body: ObservationUpsertInput }>("/api/v1/observations/upsert", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSessionUser(session, request.body.userId);
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
      reply.code(errorStatus(error, 400));
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
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertObservationOwnedByUser(request.params.id, session.userId);
        return await uploadObservationPhoto({
          observationId: request.params.id,
          filename: request.body.filename,
          mimeType: request.body.mimeType,
          base64Data: request.body.base64Data,
        });
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "observation_photo_upload_failed",
        };
      }
    },
  );

  app.post<{ Body: TrackUpsertInput }>("/api/v1/tracks/upsert", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSessionUser(session, request.body.userId);
      return await upsertTrack(request.body);
    } catch (error) {
      reply.code(errorStatus(error, 400));
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
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSpecialistSession(session, request.body.actorUserId);
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
      reply.code(errorStatus(error, 400));
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
      assertPrivilegedWriteAccess(request);
      return await issueRememberToken(request.body);
    } catch (error) {
      reply.code(errorStatus(error, 400));
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
      assertPrivilegedWriteAccess(request);
      return await revokeRememberToken(request.body.token);
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "remember_token_revoke_failed",
      };
    }
  });

  // /contact フォーム POST。認証不要、Gmail SMTP relay (msmtp) 経由で通知送信。
  // 原文は contact_submissions テーブルに保存される（メール到達と独立に原本確保）。
  app.post<{ Body: ContactSubmitInput }>("/api/v1/contact/submit", async (request, reply) => {
    try {
      const body = request.body ?? ({} as ContactSubmitInput);
      const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
      const result = await submitContact({
        category: body.category,
        name: body.name,
        email: body.email,
        organization: body.organization,
        message: body.message,
        sourceUrl: body.sourceUrl ?? (request.headers.referer as string | undefined),
        userAgent: body.userAgent ?? (request.headers["user-agent"] as string | undefined),
        ip: request.ip,
        userId: session?.userId ?? null,
      });
      return {
        ok: true,
        submissionId: result.submissionId,
        notificationSent: result.notificationSent,
        autoReplySent: result.autoReplySent,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "contact_submit_failed";
      const code = message === "invalid_category" || message === "message_too_short" || message === "invalid_email" ? 400 : 500;
      reply.code(code);
      return { ok: false, error: message };
    }
  });
}
