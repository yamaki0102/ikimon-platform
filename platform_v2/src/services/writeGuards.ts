import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import type { SessionSnapshot } from "./authSession.js";
import { getReviewerAccessContext, isAdminOrAnalystRole } from "./reviewerAuthorities.js";

function readBearerToken(headerValue: string | string[] | undefined): string | null {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();
  return token || null;
}

function readPrivilegedWriteToken(request: FastifyRequest): string | null {
  const headerValue = request.headers["x-ikimon-write-key"];
  const direct = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof direct === "string" && direct.trim() !== "") {
    return direct.trim();
  }
  return readBearerToken(request.headers.authorization);
}

export function assertPrivilegedWriteAccess(request: FastifyRequest): void {
  const config = loadConfig();
  const configuredKey = config.privilegedWriteApiKey;
  if (!configuredKey) {
    throw new Error("privileged_write_api_key_not_configured");
  }

  const provided = readPrivilegedWriteToken(request);
  if (!provided) {
    throw new Error("forbidden_privileged_write");
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(configuredKey);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("forbidden_privileged_write");
  }
}

export function assertSessionUser(session: SessionSnapshot | null, assertedUserId: string): SessionSnapshot {
  if (!session) {
    throw new Error("session_required");
  }
  if (session.banned) {
    throw new Error("account_disabled");
  }
  if (session.userId !== assertedUserId) {
    throw new Error("forbidden_user_mismatch");
  }
  return session;
}

export async function assertSpecialistSession(session: SessionSnapshot | null, actorUserId: string): Promise<SessionSnapshot> {
  const resolved = assertSessionUser(session, actorUserId);
  const access = await getReviewerAccessContext(resolved.userId, resolved.roleName, resolved.rankLabel);
  if (!access.hasSpecialistAccess) {
    throw new Error("specialist_role_required");
  }
  return resolved;
}

export function assertSpecialistAdminSession(session: SessionSnapshot | null, actorUserId: string): SessionSnapshot {
  const resolved = assertSessionUser(session, actorUserId);
  if (!isAdminOrAnalystRole(resolved.roleName, resolved.rankLabel)) {
    throw new Error("specialist_admin_required");
  }
  return resolved;
}

export async function assertObservationOwnedByUser(observationId: string, userId: string): Promise<void> {
  const pool = getPool();
  const result = await pool.query<{ owned: boolean }>(
    `select exists(
        select 1
        from visits v
        join occurrences o on o.visit_id = v.visit_id
        where (v.visit_id = $1 or v.legacy_observation_id = $1 or o.occurrence_id = $1)
          and v.user_id = $2
     ) as owned`,
    [observationId, userId],
  );

  if (!result.rows[0]?.owned) {
    throw new Error("observation_not_owned");
  }
}
