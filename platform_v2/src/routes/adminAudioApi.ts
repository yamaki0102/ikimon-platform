import type { FastifyInstance, FastifyRequest } from "fastify";
import { runClusterBatch } from "../services/audioCluster.js";
import {
  confirmCluster,
  flagForReview,
  getClusterDetail,
  listReviewQueue,
  pickRepresentative,
  rejectCluster,
  type ReviewStatus,
} from "../services/audioReview.js";
import {
  propagateClusterLabel,
  type PropagateMode,
} from "../services/audioPropagation.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";

async function assertAdminAudioAccess(request: FastifyRequest): Promise<{
  reviewerUserId: string;
  via: "session" | "write_key";
}> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { reviewerUserId: session.userId, via: "session" };
  }
  // Fallback: privileged write key (for cron / smoke / external admin tooling).
  assertPrivilegedWriteAccess(request);
  return { reviewerUserId: "system_write_key", via: "write_key" };
}

const VALID_REVIEW_STATUSES: ReadonlyArray<ReviewStatus | "any"> = [
  "ai_candidate",
  "needs_review",
  "confirmed",
  "published",
  "rejected",
  "any",
];

function adminErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message === "cluster_not_found" || message === "segment_not_in_cluster") return 404;
  if (message.endsWith("_required")) return 400;
  return 500;
}

/**
 * Phase 2: 音声クラスタ検証 admin API。
 *
 * - GET  /api/v1/admin/audio/clusters                        一覧 (status, priority, paging)
 * - GET  /api/v1/admin/audio/clusters/:id                    detail (members 含む)
 * - POST /api/v1/admin/audio/clusters/:id/representative     代表音差し替え
 * - POST /api/v1/admin/audio/clusters/:id/confirm            taxon 確定 + (任意) propagate
 * - POST /api/v1/admin/audio/clusters/:id/reject             却下
 * - POST /api/v1/admin/audio/clusters/:id/flag-for-review    要確認に上げる
 * - POST /api/v1/admin/audio/clusters/:id/propagate          代表 taxon を members に伝播
 * - POST /api/v1/admin/audio/cluster-runs                    新規バッチクラスタリング起動
 */
export async function registerAdminAudioApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      status?: string;
      priority?: string;
      limit?: string;
      offset?: string;
    };
  }>("/api/v1/admin/audio/clusters", async (request, reply) => {
    try {
      await assertAdminAudioAccess(request);
      const status = (request.query.status ?? "needs_review") as ReviewStatus | "any";
      if (!VALID_REVIEW_STATUSES.includes(status)) {
        reply.code(400);
        return { ok: false, error: "invalid_status" };
      }
      const priority = (request.query.priority ?? "any") as
        | "high"
        | "normal"
        | "archive"
        | "any";
      const limit = Number(request.query.limit ?? "");
      const offset = Number(request.query.offset ?? "");
      const clusters = await listReviewQueue({
        status,
        priority,
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
      });
      return { ok: true, clusters };
    } catch (error) {
      const message = error instanceof Error ? error.message : "list_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/audio/clusters/:id",
    async (request, reply) => {
      try {
        await assertAdminAudioAccess(request);
        const detail = await getClusterDetail(request.params.id);
        if (!detail) {
          reply.code(404);
          return { ok: false, error: "cluster_not_found" };
        }
        return { ok: true, ...detail };
      } catch (error) {
        const message = error instanceof Error ? error.message : "detail_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { segmentId?: string };
  }>(
    "/api/v1/admin/audio/clusters/:id/representative",
    async (request, reply) => {
      try {
        await assertAdminAudioAccess(request);
        const segmentId = request.body?.segmentId;
        if (!segmentId) {
          reply.code(400);
          return { ok: false, error: "segmentId_required" };
        }
        await pickRepresentative(request.params.id, segmentId);
        return { ok: true, clusterId: request.params.id, segmentId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "representative_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      taxonId?: string | null;
      label?: string;
      reviewerUserId?: string;
      gbifPublishEligible?: boolean;
      notes?: string;
      propagate?: boolean;
      propagateMode?: PropagateMode;
      scientificName?: string;
    };
  }>("/api/v1/admin/audio/clusters/:id/confirm", async (request, reply) => {
    try {
      const auth = await assertAdminAudioAccess(request);
      const body = request.body ?? {};
      if (!body.label) {
        reply.code(400);
        return { ok: false, error: "label_required" };
      }
      const reviewerUserId = body.reviewerUserId ?? auth.reviewerUserId;

      await confirmCluster({
        clusterId: request.params.id,
        taxonId: body.taxonId ?? null,
        label: body.label,
        reviewerUserId,
        gbifPublishEligible: body.gbifPublishEligible,
        notes: body.notes,
      });

      let propagation = null;
      if (body.propagate) {
        propagation = await propagateClusterLabel({
          clusterId: request.params.id,
          taxonName: body.label,
          scientificName: body.scientificName,
          mode: body.propagateMode ?? "high_conf",
        });
      }

      return { ok: true, clusterId: request.params.id, propagation };
    } catch (error) {
      const message = error instanceof Error ? error.message : "confirm_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{
    Params: { id: string };
    Body: { reviewerUserId?: string; reason?: string };
  }>("/api/v1/admin/audio/clusters/:id/reject", async (request, reply) => {
    try {
      const auth = await assertAdminAudioAccess(request);
      const body = request.body ?? {};
      const reviewerUserId = body.reviewerUserId ?? auth.reviewerUserId;
      await rejectCluster(
        request.params.id,
        reviewerUserId,
        body.reason ?? "rejected_without_reason",
      );
      return { ok: true, clusterId: request.params.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "reject_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/audio/clusters/:id/flag-for-review",
    async (request, reply) => {
      try {
        await assertAdminAudioAccess(request);
        await flagForReview(request.params.id);
        return { ok: true, clusterId: request.params.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : "flag_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      taxonName?: string;
      scientificName?: string;
      confidence?: number;
      mode?: PropagateMode;
    };
  }>("/api/v1/admin/audio/clusters/:id/propagate", async (request, reply) => {
    try {
      await assertAdminAudioAccess(request);
      const body = request.body ?? {};
      if (!body.taxonName) {
        reply.code(400);
        return { ok: false, error: "taxonName_required" };
      }
      const result = await propagateClusterLabel({
        clusterId: request.params.id,
        taxonName: body.taxonName,
        scientificName: body.scientificName,
        confidence: body.confidence,
        mode: body.mode ?? "high_conf",
      });
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "propagate_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{
    Body: {
      modelName?: string;
      modelVersion?: string;
      similarityThreshold?: number;
      limit?: number;
    };
  }>("/api/v1/admin/audio/cluster-runs", async (request, reply) => {
    try {
      await assertAdminAudioAccess(request);
      const body = request.body ?? {};
      const summary = await runClusterBatch({
        modelName: body.modelName,
        modelVersion: body.modelVersion,
        similarityThreshold: body.similarityThreshold,
        limit: body.limit,
      });
      return { ok: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "cluster_run_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });
}
