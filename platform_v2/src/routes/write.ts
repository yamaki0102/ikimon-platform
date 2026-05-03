import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { loadConfig } from "../config.js";
import {
  getSessionFromCookie,
  issueSession,
  readSessionTokenFromCookie,
  revokeSession,
} from "../services/authSession.js";
import { issueRememberToken, revokeRememberToken } from "../services/rememberTokenWrite.js";
import { uploadObservationPhoto, type ObservationPhotoUploadInput } from "../services/observationPhotoUpload.js";
import { upsertObservation, type ObservationUpsertInput } from "../services/observationWrite.js";
import { refreshProfileNoteDigestForObservation } from "../services/profileNoteDigest.js";
import { hookObservationToEvent } from "../services/observationEventDualWrite.js";
import {
  addReviewerAuthorityEvidence,
  grantReviewerAuthority,
  revokeReviewerAuthority,
  type ReviewerAuthorityEvidenceInput,
} from "../services/reviewerAuthorities.js";
import {
  createAuthorityRecommendation,
  grantAuthorityRecommendation,
  rejectAuthorityRecommendation,
  type AuthorityRecommendationEvidenceInput,
  type AuthorityRecommendationSourceKind,
} from "../services/authorityRecommendations.js";
import { recordSpecialistReview, type SpecialistDecision, type SpecialistLane } from "../services/specialistReview.js";
import {
  openObservationDispute,
  resolveIdentificationDispute,
  submitObservationIdentification,
  type DisputeResolution,
  type PublicIdentificationStance,
} from "../services/identificationParticipation.js";
import { upsertTrack, type TrackUpsertInput } from "../services/trackWrite.js";
import { recordUiKpiEvent } from "../services/uiKpi.js";
import { updateOwnProfile, upsertUser, type ProfileSelfUpdateInput, type UserUpsertInput } from "../services/userWrite.js";
import { submitContact, type ContactSubmitInput } from "../services/contactSubmit.js";
import {
  createVideoDirectUpload,
  finalizeVideoUpload,
  handleStreamWebhook,
  verifyStreamWebhookSignature,
} from "../services/videoUpload.js";
import { toggleReaction, isValidReactionType, type ReactionType } from "../services/observationReactions.js";
import { reassessObservation } from "../services/observationReassess.js";
import { reassessFromVideoThumb } from "../services/reassessFromVideoThumb.js";
import { adoptObservationCandidate } from "../services/observationCandidateAdoption.js";
import { confirmManagementActionCandidate } from "../services/managementActionConfirmation.js";
import { hideOwnObservation } from "../services/observationVisibility.js";
import { assertSameOriginRequest } from "../services/authSecurity.js";
import { cleanupStagingFixtures } from "../services/stagingFixtureCleanup.js";
import { stagingFixtureOpsEnabled } from "../services/stagingFixtureGuard.js";
import { seedStagingRegressionFixtures } from "../services/stagingRegressionFixtures.js";
import {
  assertObservationOwnedByUser,
  assertPrivilegedWriteAccess,
  assertSessionUser,
  assertSpecialistAdminSession,
  assertSpecialistSession,
} from "../services/writeGuards.js";

function errorStatus(error: unknown, fallback = 400): number {
  if (!(error instanceof Error)) {
    return fallback;
  }
  if (error.message === "session_required" || error.message === "account_disabled") {
    return 401;
  }
  if (error.message === "same_origin_required") {
    return 403;
  }
  if (
    error.message.startsWith("forbidden") ||
    error.message === "observation_not_owned" ||
    error.message === "specialist_role_required" ||
    error.message === "specialist_admin_required" ||
    error.message === "specialist_authority_required" ||
    error.message === "recommendation_grant_scope_required"
  ) {
    return 403;
  }
  if (
    error.message === "observation_not_found" ||
    error.message === "dispute_not_found" ||
    error.message === "video_not_found" ||
    error.message === "observation_video_not_found" ||
    error.message === "authority_recommendation_not_found" ||
    error.message === "user_not_found"
  ) {
    return 404;
  }
  if (
    error.message === "recommendation_not_needed_active_authority_exists" ||
    error.message === "authority_recommendation_not_pending"
  ) {
    return 409;
  }
  return fallback;
}

function summarizeUploadBody(body: Partial<Omit<ObservationPhotoUploadInput, "observationId">> | null | undefined): {
  filename: string | null;
  mimeType: string | null;
  mediaRole: string | null;
  base64Length: number;
} {
  const base64Data = typeof body?.base64Data === "string" ? body.base64Data : "";
  return {
    filename: typeof body?.filename === "string" ? body.filename.slice(0, 160) : null,
    mimeType: typeof body?.mimeType === "string" ? body.mimeType.slice(0, 80) : null,
    mediaRole: body?.mediaRole == null ? null : String(body.mediaRole).slice(0, 80),
    base64Length: base64Data.length,
  };
}

function isAuthApiMutationHandledByAuthRoutes(url: string): boolean {
  const path = url.split("?", 1)[0] ?? "";
  return path === "/api/v1/auth/login" || path === "/api/v1/auth/register";
}

function pendingVideoFinalizePayload(uid: string) {
  return {
    provider: "cloudflare_stream",
    providerUid: uid,
    mediaType: "video",
    assetRole: "observation_video",
    uploadStatus: "processing",
    durationMs: 0,
    bytes: 0,
    thumbnailUrl: "",
    iframeUrl: "",
    watchUrl: "",
    readyToStream: false,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    occurrenceId: null,
    visitId: null,
    pending: true,
  };
}

export async function registerWriteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      if (!isAuthApiMutationHandledByAuthRoutes(request.url)) {
        assertSameOriginRequest(request);
      }
    }
  });

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

  app.post<{
    Body: Omit<ProfileSelfUpdateInput, "userId">;
  }>("/api/v1/profile/me", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      const result = await updateOwnProfile({
        userId: session.userId,
        displayName: request.body.displayName,
        profileBio: request.body.profileBio,
        expertise: request.body.expertise,
        avatar: request.body.avatar,
      });
      return {
        ok: true,
        ...result,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "profile_update_failed",
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
          occurrenceIds: result.occurrenceIds,
          occurrenceCount: result.occurrenceIds.length,
          placeId: result.placeId,
          compatibilityAttempted: result.compatibility?.attempted ?? false,
          compatibilitySucceeded: result.compatibility?.succeeded ?? false,
        },
      }).catch(() => undefined);
      void refreshProfileNoteDigestForObservation({
        userId: request.body.userId,
        visitId: result.visitId,
      }).catch(() => undefined);
      void hookObservationToEvent({
        body: request.body as unknown as Parameters<typeof hookObservationToEvent>[0]["body"],
        result: {
          visitId: result.visitId,
          occurrenceId: result.occurrenceId,
          occurrenceIds: result.occurrenceIds,
        },
      }).catch(() => undefined);
      return {
        ok: true,
        ...result,
      };
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
      let sessionUserId: string | null = null;
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        sessionUserId = session.userId;
        await assertObservationOwnedByUser(request.params.id, session.userId);
        return await uploadObservationPhoto({
          observationId: request.params.id,
          filename: request.body.filename,
          mimeType: request.body.mimeType,
          base64Data: request.body.base64Data,
          mediaRole: request.body.mediaRole,
          facePrivacy: request.body.facePrivacy,
        });
      } catch (error) {
        request.log.warn({
          err: error,
          observationId: request.params.id,
          sessionUserId,
          upload: summarizeUploadBody(request.body),
        }, "observation photo upload failed");
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "observation_photo_upload_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string; candidateId: string } }>(
    "/api/v1/observations/:id/candidates/:candidateId/adopt",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        const result = await adoptObservationCandidate({
          visitId: request.params.id,
          candidateId: request.params.candidateId,
          actorUserId: session.userId,
        });
        return {
          ok: true,
          ...result,
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "candidate_adoption_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/observations/:id/hide",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        const result = await hideOwnObservation({
          observationId: request.params.id,
          actorUserId: session.userId,
        });
        return { ok: true, ...result };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "observation_hide_failed",
        };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      proposedName?: string | null;
      proposedRank?: string | null;
      notes?: string | null;
      stance?: PublicIdentificationStance;
    };
  }>("/api/v1/observations/:id/identifications", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      const stance = request.body?.stance === "alternative" ? "alternative" : "support";
      return await submitObservationIdentification({
        occurrenceId: request.params.id,
        actorUserId: session.userId,
        proposedName: request.body?.proposedName ?? "",
        proposedRank: request.body?.proposedRank ?? null,
        notes: request.body?.notes ?? null,
        stance,
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "identification_submit_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      kind?: "alternative_id" | "needs_more_evidence" | "not_organism" | "location_date_issue";
      proposedName?: string | null;
      proposedRank?: string | null;
      reason?: string | null;
    };
  }>("/api/v1/observations/:id/disputes", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      const kind = request.body?.kind ?? "alternative_id";
      return await openObservationDispute({
        occurrenceId: request.params.id,
        actorUserId: session.userId,
        kind,
        proposedName: request.body?.proposedName ?? null,
        proposedRank: request.body?.proposedRank ?? null,
        reason: request.body?.reason ?? null,
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "dispute_submit_failed",
      };
    }
  });

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
    Body: {
      subjectUserId?: string | null;
      sourceKind: AuthorityRecommendationSourceKind;
      scopeTaxonName: string;
      scopeTaxonRank?: string | null;
      scopeTaxonKey?: string | null;
      evidence?: AuthorityRecommendationEvidenceInput[];
      sourcePayload?: Record<string, unknown>;
    };
  }>("/api/v1/authority/recommendations", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }

      if (request.body.sourceKind === "ops_registered") {
        assertSpecialistAdminSession(session, session.userId);
      } else if (
        request.body.sourceKind !== "self_claim" ||
        (request.body.subjectUserId && request.body.subjectUserId.trim() && request.body.subjectUserId.trim() !== session.userId)
      ) {
        throw new Error("forbidden_recommendation_subject");
      }

      const recommendation = await createAuthorityRecommendation({
        actorUserId: session.userId,
        subjectUserId: request.body.subjectUserId ?? null,
        sourceKind: request.body.sourceKind,
        scopeTaxonName: request.body.scopeTaxonName,
        scopeTaxonRank: request.body.scopeTaxonRank ?? null,
        scopeTaxonKey: request.body.scopeTaxonKey ?? null,
        evidence: request.body.evidence ?? [],
        sourcePayload: request.body.sourcePayload ?? {},
      });
      return {
        ok: true,
        recommendation,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendation_create_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      actorUserId: string;
      resolutionNote?: string | null;
    };
  }>("/api/v1/specialist/recommendations/:id/grant", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = await assertSpecialistSession(session, request.body.actorUserId);
      const result = await grantAuthorityRecommendation({
        recommendationId: request.params.id,
        actorUserId: resolvedSession.userId,
        actorRoleName: resolvedSession.roleName,
        actorRankLabel: resolvedSession.rankLabel,
        resolutionNote: request.body.resolutionNote ?? null,
      });
      return {
        ok: true,
        ...result,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendation_grant_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      resolutionNote: string;
    };
  }>("/api/v1/specialist/recommendations/:id/reject", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSpecialistAdminSession(session, session?.userId ?? "");
      const recommendation = await rejectAuthorityRecommendation({
        recommendationId: request.params.id,
        actorUserId: resolvedSession.userId,
        resolutionNote: request.body.resolutionNote,
      });
      return {
        ok: true,
        recommendation,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendation_reject_failed",
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
      const resolvedSession = await assertSpecialistSession(session, request.body.actorUserId);
      return await recordSpecialistReview({
        occurrenceId: request.params.id,
        actorUserId: request.body.actorUserId,
        actorRoleName: resolvedSession.roleName,
        actorRankLabel: resolvedSession.rankLabel,
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
    Params: { id: string };
    Body: {
      actorUserId?: string | null;
      resolution: DisputeResolution;
      note?: string | null;
    };
  }>("/api/v1/specialist/disputes/:id/resolve", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const actorUserId = request.body.actorUserId ?? session?.userId ?? "";
      const resolvedSession = await assertSpecialistSession(session, actorUserId);
      return await resolveIdentificationDispute({
        disputeId: request.params.id,
        actorUserId: resolvedSession.userId,
        resolution: request.body.resolution,
        note: request.body.note ?? null,
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "dispute_resolve_failed",
      };
    }
  });

  app.post<{
    Body: {
      subjectUserId: string;
      scopeTaxonName: string;
      scopeTaxonRank?: string | null;
      scopeTaxonKey?: string | null;
      reason?: string | null;
      evidence?: ReviewerAuthorityEvidenceInput[];
    };
  }>("/api/v1/specialist/authorities/grant", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSpecialistAdminSession(session, session?.userId ?? "");
      const authority = await grantReviewerAuthority({
        subjectUserId: request.body.subjectUserId,
        grantedByUserId: resolvedSession.userId,
        scopeTaxonName: request.body.scopeTaxonName,
        scopeTaxonRank: request.body.scopeTaxonRank ?? null,
        scopeTaxonKey: request.body.scopeTaxonKey ?? null,
        reason: request.body.reason ?? null,
        evidence: request.body.evidence ?? [],
      });
      return {
        ok: true,
        authority,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_grant_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      reason: string;
    };
  }>("/api/v1/specialist/authorities/:id/revoke", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSpecialistAdminSession(session, session?.userId ?? "");
      const authority = await revokeReviewerAuthority({
        authorityId: request.params.id,
        revokedByUserId: resolvedSession.userId,
        reason: request.body.reason,
      });
      return {
        ok: true,
        authority,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_revoke_failed",
      };
    }
  });

  app.post<{
    Params: { id: string };
    Body: ReviewerAuthorityEvidenceInput;
  }>("/api/v1/specialist/authorities/:id/evidence", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSpecialistAdminSession(session, session?.userId ?? "");
      const authority = await addReviewerAuthorityEvidence({
        authorityId: request.params.id,
        actorUserId: resolvedSession.userId,
        evidence: request.body,
      });
      return {
        ok: true,
        authority,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_evidence_failed",
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

  app.post<{
    Body: {
      fixturePrefix?: string | null;
    };
  }>("/api/v1/ops/staging/fixtures/seed-regression", async (request, reply) => {
    try {
      assertPrivilegedWriteAccess(request);
      if (!stagingFixtureOpsEnabled()) {
        throw new Error("staging_regression_seed_disabled");
      }
      const fixturePrefix = request.body?.fixturePrefix?.trim();
      if (!fixturePrefix) {
        throw new Error("fixture_prefix_required");
      }
      const fixture = await seedStagingRegressionFixtures({ fixturePrefix });
      return {
        ok: true,
        fixture,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "staging_regression_seed_failed";
      reply.code(message === "staging_regression_seed_disabled" ? 404 : errorStatus(error, 400));
      return {
        ok: false,
        error: message,
      };
    }
  });

  app.post<{
    Body: {
      fixturePrefix?: string | null;
      dryRun?: boolean;
    };
  }>("/api/v1/ops/staging/fixtures/cleanup", async (request, reply) => {
    try {
      assertPrivilegedWriteAccess(request);
      if (!stagingFixtureOpsEnabled()) {
        throw new Error("staging_fixture_cleanup_disabled");
      }
      const cleanup = await cleanupStagingFixtures({
        fixturePrefix: request.body?.fixturePrefix ?? null,
        dryRun: request.body?.dryRun ?? false,
      });
      return {
        ok: true,
        cleanup,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "staging_fixture_cleanup_failed";
      reply.code(message === "staging_fixture_cleanup_disabled" ? 404 : errorStatus(error, 400));
      return {
        ok: false,
        error: message,
      };
    }
  });

  // 動画アップロード（Cloudflare Stream Direct Creator Upload）。
  // ユーザーのブラウザが直接アップロード先に送るので、サーバ帯域は消費しない。
  // 認証必須（セッション or guest はダメ）。
  app.post<{ Body: { maxDurationSeconds?: number; filename?: string; observationId?: string | null; mediaRole?: string | null; uploadProtocol?: "post" | "tus"; fileSizeBytes?: number | null } }>(
    "/api/v1/videos/direct-upload",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        const body = request.body ?? {};
        const observationId = typeof body.observationId === "string" ? body.observationId.trim() : "";
        if (observationId) {
          await assertObservationOwnedByUser(observationId, session.userId);
        }
        const result = await createVideoDirectUpload({
          actorId: session.userId,
          maxDurationSeconds: body.maxDurationSeconds,
          filename: body.filename,
          observationId: observationId || null,
          mediaRole: body.mediaRole,
          uploadProtocol: body.uploadProtocol === "tus" ? "tus" : "post",
          fileSizeBytes: typeof body.fileSizeBytes === "number" ? body.fileSizeBytes : null,
        });
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "video_upload_failed";
        reply.code(message === "session_required" ? 401 : 500);
        return { ok: false, error: message };
      }
    },
  );

  app.post<{ Body: unknown }>(
    "/api/v1/videos/stream-webhook",
    {
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawBody = Buffer.concat(chunks);
        (request as unknown as { rawBody?: Buffer }).rawBody = rawBody;
        return Readable.from([rawBody]);
      },
    },
    async (request, reply) => {
      try {
        const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
        const signature = Array.isArray(request.headers["webhook-signature"])
          ? request.headers["webhook-signature"][0]
          : request.headers["webhook-signature"];
        const secret = loadConfig().cloudflare?.streamWebhookSecret;
        if (!verifyStreamWebhookSignature(rawBody, signature, secret)) {
          reply.code(401);
          return { ok: false, error: "invalid_webhook_signature" };
        }
        const result = await handleStreamWebhook(request.body && typeof request.body === "object" ? request.body : {});
        return result;
      } catch (error) {
        reply.code(errorStatus(error, 500));
        return { ok: false, error: error instanceof Error ? error.message : "stream_webhook_failed" };
      }
    },
  );

  // アップロード完了を client から通知するルート。Stream 本体情報を取得し、
  // upload_status / duration / bytes を DB に反映する。フロント側で tus アップロード完了後に呼ぶ。
  app.post<{
    Params: { uid: string };
    Body: { observationId?: string | null; mediaRole?: string | null };
  }>(
    "/api/v1/videos/:uid/finalize",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        const observationId = typeof request.body?.observationId === "string"
          ? request.body.observationId.trim()
          : "";
        if (observationId) {
          await assertObservationOwnedByUser(observationId, session.userId);
        }
        const record = await finalizeVideoUpload({
          uid: request.params.uid,
          actorId: session.userId,
          observationId: observationId || null,
          mediaRole: request.body?.mediaRole,
        });
        if (!record) {
          return { ok: true, video: pendingVideoFinalizePayload(request.params.uid) };
        }
        return { ok: true, video: record };
      } catch (error) {
        reply.code(errorStatus(error, 500));
        return { ok: false, error: error instanceof Error ? error.message : "finalize_failed" };
      }
    },
  );

  // 観察へのリアクション (like/helpful/curious/thanks) トグル。
  // session 必須、同じ user が既にそのリアクションをしていれば削除、いなければ追加。
  app.post<{ Params: { id: string; type: string } }>(
    "/api/v1/observations/:id/reactions/:type",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        const type = request.params.type as ReactionType;
        if (!isValidReactionType(type)) {
          reply.code(400);
          return { ok: false, error: "invalid_reaction_type" };
        }
        const result = await toggleReaction(request.params.id, session.userId, type);
        return { ok: true, ...result };
      } catch (error) {
        reply.code(500);
        return { ok: false, error: error instanceof Error ? error.message : "reaction_failed" };
      }
    },
  );

  // 観察 AI 再判定。session + owner only。
  // 既存 observation_ai_assessments には履歴として残しつつ、新 assessment を追加。
  // coexisting_taxa は subject_index ≥ 1 で occurrences に追加される（ADR-0004 準拠、AI 単独昇格なし）。
  app.post<{ Params: { id: string } }>(
    "/api/v1/observations/:id/reassess",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const result = await reassessObservation(request.params.id);
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "reassess_failed";
        reply.code(errorStatus(error, 500));
        return { ok: false, error: message };
      }
    },
  );

  // 観察 AI 再判定（動画サムネイル版）。session + owner only。
  // Cloudflare Stream thumbnail(time=2s) を使って candidate を更新する。
  app.post<{ Params: { id: string } }>(
    "/api/v1/observations/:id/reassess-from-video",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const result = await reassessFromVideoThumb(request.params.id);
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "reassess_from_video_failed";
        reply.code(errorStatus(error, 500));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{
    Params: { id: string; index: string };
    Body: { confirmState?: string };
  }>(
    "/api/v1/observations/:id/management-candidates/:index/confirm",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          reply.code(401);
          return { ok: false, error: "session_required" };
        }
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const confirmState = request.body?.confirmState;
        if (confirmState !== "suggested" && confirmState !== "confirmed" && confirmState !== "rejected") {
          reply.code(400);
          return { ok: false, error: "invalid_confirm_state" };
        }
        const result = await confirmManagementActionCandidate({
          observationId: request.params.id,
          candidateIndex: Number(request.params.index),
          confirmState,
          actorUserId: session.userId,
        });
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "management_candidate_confirm_failed";
        reply.code(errorStatus(error, 500));
        return { ok: false, error: message };
      }
    },
  );

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
