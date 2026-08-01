import type { FastifyInstance, FastifyRequest } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertSameOriginRequest } from "../services/authSecurity.js";
import {
  KUBIAKA_EXPERIENCE_KEY,
  KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX,
  type KubiakaDbQuery,
} from "./kubiakaFocusedExperience.js";

const KUBIAKA_PRIVATE_UPLOAD_ROUTE = `${KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX}/:id/photos/upload`;

export async function assertOwnedKubiakaPrivateUploadTarget(
  query: KubiakaDbQuery,
  recordId: string,
  userId: string,
): Promise<void> {
  const result = await query<{ visit_id: string }>(
    `select v.visit_id::text
       from visits v
       left join occurrences o on o.visit_id = v.visit_id
      where (v.visit_id::text = $1 or v.legacy_observation_id = $1 or o.occurrence_id::text = $1)
        and v.user_id = $2
        and v.public_visibility = 'hidden'
        and v.source_payload ->> 'experience_key' = $3
      limit 1`,
    [recordId, userId, KUBIAKA_EXPERIENCE_KEY],
  );
  if (result.rows.length !== 1) {
    throw new Error("kubiaka_private_upload_scope_required");
  }
}

function requestRouteUrl(request: FastifyRequest): string {
  return String(request.routeOptions?.url ?? "");
}

export async function registerKubiakaPrivateUploadGuard(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST" || requestRouteUrl(request) !== KUBIAKA_PRIVATE_UPLOAD_ROUTE) {
      return;
    }
    try {
      assertSameOriginRequest(request);
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) throw new Error("session_required");
      const recordId = String((request.params as { id?: unknown } | null)?.id ?? "").trim();
      if (!recordId) throw new Error("kubiaka_private_upload_scope_required");
      await assertOwnedKubiakaPrivateUploadTarget(
        (text, values) => getPool().query(text, values),
        recordId,
        session.userId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "kubiaka_private_upload_scope_required";
      const status = message === "session_required"
        ? 401
        : message === "same_origin_required"
          ? 403
          : 403;
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
