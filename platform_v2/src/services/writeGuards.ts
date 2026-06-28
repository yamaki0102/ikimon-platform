import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
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
  for (const headerName of ["x-ikimon-write-key", "x-v2-privileged-write-api-key", "x-api-key"]) {
    const headerValue = request.headers[headerName];
    const direct = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (typeof direct === "string" && direct.trim() !== "") {
      return direct.trim();
    }
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
