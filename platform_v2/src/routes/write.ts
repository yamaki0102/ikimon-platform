import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { invalidateUserVisibleSnapshots } from "../services/snapshotInvalidation.js";
import { getPool } from "../db.js";
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
import { buildContributionReceipts, buildRecordFeedbackLoop } from "../services/contributionReceipts.js";
import { recordGuideUnlocksForObservation } from "../services/guideUnlocks.js";
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
  resolveIdentificationDispute,
  type DisputeResolution,
} from "../services/identificationParticipation.js";
import { upsertTrack, type TrackUpsertInput } from "../services/trackWrite.js";
import { recordUiKpiEvent } from "../services/uiKpi.js";
import { updateOwnProfile, upsertUser, type ProfileSelfUpdateInput, type UserUpsertInput } from "../services/userWrite.js";
import { submitContact, verifyContactProof, type ContactSubmitInput } from "../services/contactSubmit.js";
import { getPostSavePlaceMemorySample, kickPlaceMemoryPhotoProcessingForVisit } from "../services/placeMemory.js";
import {
  emitAreaWatchNotificationForObservation,
  ensureAreaWatchParticipationForVisit,
} from "../services/areaWatchNotifications.js";
import { submitObservationRecordAiReview, type ObservationRecordAiReviewState } from "../services/observationRecordAiReview.js";
import {
  confirmReferenceDuplicateMerge,
  createKnowledgeSourceCorrection,
  createReferenceCaptureBatch,
  type KnowledgeSourceCorrectionInput,
  type ReferenceCaptureItemInput,
} from "../services/referenceLibrary.js";
import { assertAuthRateLimit, assertSameOriginRequest } from "../services/authSecurity.js";
import { cleanupStagingFixtures } from "../services/stagingFixtureCleanup.js";
import { stagingFixtureOpsEnabled } from "../services/stagingFixtureGuard.js";
import { seedStagingRegressionFixtures } from "../services/stagingRegressionFixtures.js";
import { refreshPublicMapSnapshot } from "../services/mapSnapshot.js";
import {
  generateRecordPhotoFeedback,
  normalizeRecordPhotoFeedbackContext,
  normalizeRecordPhotoFeedbackImages,
} from "../services/recordPhotoFeedback.js";
import { seedStagingRallyFixtures } from "../services/stagingRallyFixtures.js";
import {
  environmentRecordLabel,
  mergeUserEnvironmentRecordValues,
  normalizeEnvironmentRecordField,
  normalizeEnvironmentRecordValue,
  type EnvironmentRecordField,
} from "../services/environmentRecord.js";
import { assertObservationOwnedByUser } from "../services/writeGuardsPg.js";
import {
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
    error.message === "record_reading_card_not_found" ||
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
  if (error.message === "rate_limited") {
    return 429;
  }
  if (error.message === "record_feedback_image_required") {
    return 400;
  }
  return fallback;
}

const ORGANISM_ORIGIN_OPTIONS = [
  { value: "wild", label: "野生" },
  { value: "planted", label: "植栽" },
  { value: "captive", label: "飼育" },
  { value: "released", label: "放流" },
  { value: "unknown", label: "不明" },
] as const;

type OrganismOriginValue = typeof ORGANISM_ORIGIN_OPTIONS[number]["value"];

function normalizeOrganismOrigin(value: unknown): OrganismOriginValue {
  const raw = String(value ?? "").trim().toLowerCase();
  const option = ORGANISM_ORIGIN_OPTIONS.find((item) => item.value === raw);
  if (!option) {
    throw new Error("invalid_organism_origin");
  }
  return option.value;
}

function organismOriginLabel(value: OrganismOriginValue): string {
  return ORGANISM_ORIGIN_OPTIONS.find((item) => item.value === value)?.label ?? "不明";
}

function normalizeObservationObservedAt(value: unknown): string {
  const raw = String(value ?? "").trim();
  const parsed = new Date(raw);
  if (!raw || !Number.isFinite(parsed.getTime())) {
    throw new Error("invalid_observed_at");
  }
  const now = Date.now();
  if (parsed.getTime() > now + 24 * 60 * 60 * 1000) {
    throw new Error("invalid_observed_at");
  }
  return parsed.toISOString();
}

function normalizeObservationLatitude(value: unknown): number {
  const latitude = Number(value);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("invalid_latitude");
  }
  return Number(latitude.toFixed(6));
}

function normalizeObservationLongitude(value: unknown): number {
  const longitude = Number(value);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("invalid_longitude");
  }
  return Number(longitude.toFixed(6));
}

async function assertMutationRateLimit(
  request: FastifyRequest,
  scope: string,
  userId: string,
  maxAttempts = 30,
  windowMs = 10 * 60 * 1000,
): Promise<void> {
  await assertAuthRateLimit([scope, userId, request.ip], maxAttempts, windowMs);
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

const AUTH_API_MUTATION_ROUTES_HANDLED_BY_AUTH_ROUTES = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
] as const;

const PRIVILEGED_AUTH_WRITE_ROUTES = [
  "/api/v1/auth/session/issue",
  "/api/v1/auth/remember-tokens/issue",
  "/api/v1/auth/remember-tokens/revoke",
] as const;

function isAuthApiMutationHandledByAuthRoutes(url: string): boolean {
  const path = url.split("?", 1)[0] ?? "";
  return AUTH_API_MUTATION_ROUTES_HANDLED_BY_AUTH_ROUTES.includes(path as (typeof AUTH_API_MUTATION_ROUTES_HANDLED_BY_AUTH_ROUTES)[number]);
}

function assertRegisteredPrivilegedAuthWriteRoute(route: (typeof PRIVILEGED_AUTH_WRITE_ROUTES)[number]): void {
  if (!PRIVILEGED_AUTH_WRITE_ROUTES.includes(route)) {
    throw new Error("privileged_auth_write_route_not_registered");
  }
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
      assertRegisteredPrivilegedAuthWriteRoute("/api/v1/auth/session/issue");
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
        const query = request.query as { optional?: unknown };
        if (query.optional === "1" || query.optional === "true") {
          return {
            ok: false,
            error: "session_not_found",
            session: null,
          };
        }
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

  app.post<{
    Body: {
      images?: unknown;
      context?: unknown;
    };
  }>("/api/v1/record/photo-feedback", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSessionUser(session, session?.userId ?? "");
      await assertAuthRateLimit(["record-photo-feedback", resolvedSession.userId, request.ip], 10, 10 * 60 * 1000);
      const images = normalizeRecordPhotoFeedbackImages(request.body?.images);
      const context = normalizeRecordPhotoFeedbackContext(request.body?.context);
      const result = await generateRecordPhotoFeedback({
        userId: resolvedSession.userId,
        images,
        context,
      });
      return {
        ok: true,
        feedback: result,
      };
    } catch (error) {
      reply.code(errorStatus(error, 503));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "record_photo_feedback_failed",
      };
    }
  });

  app.post<{
    Body: {
      items?: ReferenceCaptureItemInput[];
      countryCode?: string | null;
    };
  }>("/api/v1/references/capture-batches", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      return await createReferenceCaptureBatch({
        userId: session.userId,
        items: Array.isArray(request.body?.items) ? request.body.items : [],
        countryCode: request.body?.countryCode ?? null,
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "reference_capture_failed",
      };
    }
  });

  app.post<{
    Body: {
      canonicalSourceId?: string | null;
      duplicateSourceId?: string | null;
    };
  }>("/api/v1/references/duplicates/merge", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSpecialistAdminSession(session, session?.userId ?? "");
      const canonicalSourceId = request.body?.canonicalSourceId?.trim();
      const duplicateSourceId = request.body?.duplicateSourceId?.trim();
      if (!canonicalSourceId || !duplicateSourceId) {
        throw new Error("reference_source_id_required");
      }
      const result = await confirmReferenceDuplicateMerge({
        canonicalSourceId,
        duplicateSourceId,
        actorUserId: resolvedSession.userId,
      });
      return {
        ok: true,
        result,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "reference_duplicate_merge_failed",
      };
    }
  });

  app.post<{
    Params: { sourceId: string };
    Body: Omit<KnowledgeSourceCorrectionInput, "sourceId" | "verifiedByUserId">;
  }>("/api/v1/references/:sourceId/corrections", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      await assertSpecialistSession(session, session.userId);
      return await createKnowledgeSourceCorrection({
        ...request.body,
        sourceId: request.params.sourceId,
        verifiedByUserId: request.body?.verificationStatus === "official_confirmed" ? session.userId : null,
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "reference_correction_failed",
      };
    }
  });

  app.post<{ Body: ObservationUpsertInput }>("/api/v1/observations/upsert", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSessionUser(session, request.body.userId);
      await assertMutationRateLimit(request, "observation-upsert", resolvedSession.userId, 30);
      const result = await upsertObservation(request.body);
      invalidateUserVisibleSnapshots();
      const placeMemorySample = result.placeMemory
        ? await getPostSavePlaceMemorySample({ userId: request.body.userId, visitId: result.visitId, limit: 3 }).catch(() => [])
        : [];
      const latitude = typeof request.body.latitude === "number" && Number.isFinite(request.body.latitude)
        ? request.body.latitude
        : null;
      const longitude = typeof request.body.longitude === "number" && Number.isFinite(request.body.longitude)
        ? request.body.longitude
        : null;
      const guideUnlocks = latitude !== null && longitude !== null
        ? await recordGuideUnlocksForObservation({
            userId: request.body.userId,
            visitId: result.visitId,
            occurrenceId: result.occurrenceId,
            latitude,
            longitude,
            sourcePayload: request.body.sourcePayload ?? null,
          }).catch((error) => {
            request.log.warn({ err: error, visitId: result.visitId }, "guide unlock write failed");
            return [];
          })
        : [];
      const contributionReceipts = buildContributionReceipts({
        input: request.body,
        result,
        guideUnlocks,
      });
      const feedbackLoop = buildRecordFeedbackLoop({ result });
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
          contributionReceiptKinds: contributionReceipts.map((item) => item.kind),
          feedbackLoopStatus: feedbackLoop.status,
          guideUnlockCount: guideUnlocks.length,
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
      void ensureAreaWatchParticipationForVisit({ visitId: result.visitId }).catch((error) => {
        request.log.warn({ err: error, visitId: result.visitId }, "area watch participation failed");
      });
      void emitAreaWatchNotificationForObservation({
        occurrenceId: result.occurrenceId,
        visitId: result.visitId,
      }).catch((error) => {
        request.log.warn({ err: error, occurrenceId: result.occurrenceId, visitId: result.visitId }, "area watch notification failed");
      });
      return {
        ok: true,
        ...result,
        placeMemorySample,
        contributionReceipts,
        feedbackLoop,
        guideUnlocks,
      };
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "observation_upsert_failed",
      };
    }
  });

  app.post<{ Params: { id: string }; Body: { organismOrigin?: unknown } }>(
    "/api/v1/occurrences/:id/origin",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertMutationRateLimit(request, "occurrence-origin-update", session.userId, 30);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const organismOrigin = normalizeOrganismOrigin(request.body?.organismOrigin);
        const result = await getPool().query<{ occurrence_id: string }>(
          `update occurrences
              set organism_origin = $2
            where occurrence_id = $1
            returning occurrence_id`,
          [request.params.id, organismOrigin],
        );
        if (result.rows.length === 0) {
          throw new Error("observation_not_found");
        }
        return {
          ok: true,
          occurrenceId: request.params.id,
          organismOrigin,
          label: organismOriginLabel(organismOrigin),
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "occurrence_origin_update_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { observedAt?: unknown } }>(
    "/api/v1/occurrences/:id/observed-at",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertMutationRateLimit(request, "occurrence-observed-at-update", session.userId, 30);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const observedAt = normalizeObservationObservedAt(request.body?.observedAt);
        const result = await getPool().query<{ occurrence_id: string; visit_id: string; observed_at: string }>(
          `update visits v
              set observed_at = $2::timestamptz,
                  source_payload = coalesce(v.source_payload, '{}'::jsonb) || $3::jsonb,
                  updated_at = now()
             from occurrences o
            where o.occurrence_id = $1
              and o.visit_id = v.visit_id
            returning o.occurrence_id::text as occurrence_id,
                      v.visit_id::text as visit_id,
                      v.observed_at::text as observed_at`,
          [
            request.params.id,
            observedAt,
            JSON.stringify({
              observation_detail_edit: {
                field: "observed_at",
                updated_by: session.userId,
                updated_at: new Date().toISOString(),
              },
            }),
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error("observation_not_found");
        }
        return {
          ok: true,
          occurrenceId: row.occurrence_id,
          visitId: row.visit_id,
          observedAt: row.observed_at,
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "occurrence_observed_at_update_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { latitude?: unknown; longitude?: unknown } }>(
    "/api/v1/occurrences/:id/location",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertMutationRateLimit(request, "occurrence-location-update", session.userId, 30);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const latitude = normalizeObservationLatitude(request.body?.latitude);
        const longitude = normalizeObservationLongitude(request.body?.longitude);
        const result = await getPool().query<{
          occurrence_id: string;
          visit_id: string;
          latitude: number;
          longitude: number;
        }>(
          `update visits v
              set point_latitude = $2,
                  point_longitude = $3,
                  source_payload = coalesce(v.source_payload, '{}'::jsonb) || $4::jsonb,
                  updated_at = now()
             from occurrences o
            where o.occurrence_id = $1
              and o.visit_id = v.visit_id
            returning o.occurrence_id::text as occurrence_id,
                      v.visit_id::text as visit_id,
                      v.point_latitude as latitude,
                      v.point_longitude as longitude`,
          [
            request.params.id,
            latitude,
            longitude,
            JSON.stringify({
              observation_detail_edit: {
                field: "location",
                updated_by: session.userId,
                updated_at: new Date().toISOString(),
              },
            }),
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error("observation_not_found");
        }
        return {
          ok: true,
          occurrenceId: row.occurrence_id,
          visitId: row.visit_id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          label: `${Number(row.latitude).toFixed(6)}, ${Number(row.longitude).toFixed(6)}`,
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "occurrence_location_update_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { field?: unknown; value?: unknown } }>(
    "/api/v1/occurrences/:id/environment-field",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertMutationRateLimit(request, "occurrence-environment-field-update", session.userId, 60);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const field = normalizeEnvironmentRecordField(request.body?.field);
        const value = normalizeEnvironmentRecordValue(field, request.body?.value);
        const pool = getPool();
        const current = await pool.query<{
          occurrence_id: string;
          lat: number | null;
          lng: number | null;
          structured: Record<string, unknown> | null;
        }>(
          `select o.occurrence_id,
                  coalesce(v.point_latitude, p.center_latitude) as lat,
                  coalesce(v.point_longitude, p.center_longitude) as lng,
                  fc.structured
             from occurrences o
             join visits v on v.visit_id = o.visit_id
             left join places p on p.place_id = v.place_id
             left join lateral (
               select structured
                 from field_context fc
                where fc.occurrence_id = o.occurrence_id
                order by fc.created_at desc
                limit 1
             ) fc on true
            where o.occurrence_id = $1
            limit 1`,
          [request.params.id],
        );
        const row = current.rows[0];
        if (!row) {
          throw new Error("observation_not_found");
        }
        const lat = row.lat == null ? NaN : Number(row.lat);
        const lng = row.lng == null ? NaN : Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("occurrence_location_required");
        }
        const previous = row.structured && typeof row.structured === "object" && !Array.isArray(row.structured)
          ? row.structured as Record<string, unknown>
          : {};
        const structured = mergeUserEnvironmentRecordValues(previous, { [field]: value });
        await pool.query(
          `insert into field_context (
             occurrence_id, lat, lng, structured, source_lang
           ) values ($1, $2, $3, $4::jsonb, 'ja')`,
          [request.params.id, lat, lng, JSON.stringify(structured)],
        );
        return {
          ok: true,
          occurrenceId: request.params.id,
          field,
          value,
          label: environmentRecordLabel(field, value),
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "occurrence_environment_field_update_failed",
        };
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { values?: Record<string, unknown> } }>(
    "/api/v1/occurrences/:id/environment-record",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie);
        if (!session) {
          throw new Error("session_required");
        }
        await assertMutationRateLimit(request, "occurrence-environment-record-update", session.userId, 30);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const rawValues = request.body?.values && typeof request.body.values === "object"
          ? request.body.values
          : {};
        const values: Partial<Record<EnvironmentRecordField, string>> = {};
        for (const [rawField, rawValue] of Object.entries(rawValues)) {
          const field = normalizeEnvironmentRecordField(rawField);
          values[field] = normalizeEnvironmentRecordValue(field, rawValue);
        }
        if (Object.keys(values).length === 0) {
          throw new Error("invalid_environment_record_value");
        }
        const pool = getPool();
        const current = await pool.query<{
          occurrence_id: string;
          lat: number | null;
          lng: number | null;
          structured: Record<string, unknown> | null;
        }>(
          `select o.occurrence_id,
                  coalesce(v.point_latitude, p.center_latitude) as lat,
                  coalesce(v.point_longitude, p.center_longitude) as lng,
                  fc.structured
             from occurrences o
             join visits v on v.visit_id = o.visit_id
             left join places p on p.place_id = v.place_id
             left join lateral (
               select structured
                 from field_context fc
                where fc.occurrence_id = o.occurrence_id
                order by fc.created_at desc
                limit 1
             ) fc on true
            where o.occurrence_id = $1
            limit 1`,
          [request.params.id],
        );
        const row = current.rows[0];
        if (!row) {
          throw new Error("observation_not_found");
        }
        const lat = row.lat == null ? NaN : Number(row.lat);
        const lng = row.lng == null ? NaN : Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("occurrence_location_required");
        }
        const previous = row.structured && typeof row.structured === "object" && !Array.isArray(row.structured)
          ? row.structured as Record<string, unknown>
          : {};
        const structured = mergeUserEnvironmentRecordValues(previous, values);
        await pool.query(
          `insert into field_context (
             occurrence_id, lat, lng, structured, source_lang
           ) values ($1, $2, $3, $4::jsonb, 'ja')`,
          [request.params.id, lat, lng, JSON.stringify(structured)],
        );
        const savedValues = Object.fromEntries(
          Object.entries(values).map(([field, value]) => [field, {
            value,
            label: environmentRecordLabel(field as EnvironmentRecordField, value),
            source: "user",
          }]),
        );
        return {
          ok: true,
          occurrenceId: request.params.id,
          values: savedValues,
        };
      } catch (error) {
        reply.code(errorStatus(error, 400));
        return {
          ok: false,
          error: error instanceof Error ? error.message : "occurrence_environment_record_update_failed",
        };
      }
    },
  );

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
        await assertMutationRateLimit(request, "observation-photo-upload", session.userId, 24);
        await assertObservationOwnedByUser(request.params.id, session.userId);
        const result = await uploadObservationPhoto({
          observationId: request.params.id,
          filename: request.body.filename,
          mimeType: request.body.mimeType,
          base64Data: request.body.base64Data,
          mediaRole: request.body.mediaRole,
          facePrivacy: request.body.facePrivacy,
        });
        void emitAreaWatchNotificationForObservation({
          occurrenceId: result.occurrenceId,
          visitId: result.visitId,
        }).catch((error) => {
          request.log.warn({ err: error, occurrenceId: result.occurrenceId, visitId: result.visitId }, "area watch notification failed");
        });
        void kickPlaceMemoryPhotoProcessingForVisit(result.visitId).catch((error) => {
          request.log.warn({ err: error, visitId: result.visitId }, "place memory photo processing failed");
        });
        return {
          ok: true,
          ...result,
        };
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

  app.post<{ Body: TrackUpsertInput }>("/api/v1/tracks/upsert", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSessionUser(session, request.body.userId);
      await assertMutationRateLimit(request, "track-upsert", resolvedSession.userId, 240);
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
      reviewState?: ObservationRecordAiReviewState;
    };
  }>("/api/v1/observation-records/:id/ai-review", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        throw new Error("session_required");
      }
      await assertMutationRateLimit(request, "observation-ai-review", session.userId, 20);
      return await submitObservationRecordAiReview({
        occurrenceId: request.params.id,
        actorUserId: session.userId,
        reviewState: request.body?.reviewState ?? "later",
      });
    } catch (error) {
      reply.code(errorStatus(error, 400));
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ai_review_submit_failed",
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
      await assertMutationRateLimit(request, "authority-recommendation-create", session.userId, 12);

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
      await assertMutationRateLimit(request, "authority-recommendation-grant", resolvedSession.userId, 30);
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
      await assertMutationRateLimit(request, "authority-recommendation-reject", resolvedSession.userId, 30);
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
      await assertMutationRateLimit(request, "specialist-review", resolvedSession.userId, 60);
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
      await assertMutationRateLimit(request, "specialist-dispute-resolve", resolvedSession.userId, 30);
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
      await assertMutationRateLimit(request, "specialist-authority-grant", resolvedSession.userId, 30);
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
      await assertMutationRateLimit(request, "specialist-authority-revoke", resolvedSession.userId, 30);
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
      await assertMutationRateLimit(request, "specialist-authority-evidence", resolvedSession.userId, 60);
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
      assertRegisteredPrivilegedAuthWriteRoute("/api/v1/auth/remember-tokens/issue");
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
      assertRegisteredPrivilegedAuthWriteRoute("/api/v1/auth/remember-tokens/revoke");
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
      await refreshPublicMapSnapshot({
        refreshedBy: "staging-fixture:seed-regression",
      });
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
    };
  }>("/api/v1/ops/staging/fixtures/seed-rally", async (request, reply) => {
    try {
      assertPrivilegedWriteAccess(request);
      if (!stagingFixtureOpsEnabled()) {
        throw new Error("staging_rally_seed_disabled");
      }
      const fixturePrefix = request.body?.fixturePrefix?.trim();
      if (!fixturePrefix) {
        throw new Error("fixture_prefix_required");
      }
      const fixture = await seedStagingRallyFixtures({ fixturePrefix });
      return {
        ok: true,
        fixture,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "staging_rally_seed_failed";
      reply.code(message === "staging_rally_seed_disabled" ? 404 : errorStatus(error, 400));
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
      if (!cleanup.dryRun) {
        await refreshPublicMapSnapshot({
          refreshedBy: "staging-fixture:cleanup",
        });
      }
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

  // /contact フォーム POST。認証不要、Gmail SMTP relay (msmtp) 経由で通知送信。
  // 原文は contact_submissions テーブルに保存される（メール到達と独立に原本確保）。
  // 公開 endpoint のため @fastify/rate-limit で IP 単位 5 req/hour 制限（FINDING-004）。
  app.post<{ Body: ContactSubmitInput }>("/api/v1/contact/submit", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 hour",
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body ?? ({} as ContactSubmitInput);
      const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
      const botTrap = [body.website, body.spamTrap].some((value) => String(value ?? "").trim().length > 0);
      if (botTrap) {
        return {
          ok: true,
          submissionId: "",
          notificationSent: false,
          autoReplySent: false,
        };
      }
      if (!verifyContactProof(body.contactProof)) {
        reply.code(400);
        return { ok: false, error: "contact_antispam_failed" };
      }
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
