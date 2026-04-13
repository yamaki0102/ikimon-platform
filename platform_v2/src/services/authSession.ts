import { randomBytes } from "node:crypto";
import { getPool } from "../db.js";
import { issueRememberToken, revokeRememberToken } from "./rememberTokenWrite.js";

export const SESSION_COOKIE_NAME = "ikimon_v2_session";

export type SessionIssueInput = {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  ttlHours?: number;
};

export type SessionSnapshot = {
  userId: string;
  displayName: string;
  rankLabel: string | null;
  expiresAt: string;
  tokenHash: string;
};

function parseCookies(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return headerValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }
      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      accumulator[name] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

export function buildSessionCookie(rawToken: string, expiresAt: string): string {
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`;
}

export function buildClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function readSessionTokenFromCookie(headerValue: string | undefined): string | null {
  const cookies = parseCookies(headerValue);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  return rawToken && rawToken.trim() ? rawToken.trim() : null;
}

export async function issueSession(input: SessionIssueInput) {
  if (!input.userId.trim()) {
    throw new Error("userId is required");
  }

  const ttlHours = Number.isFinite(input.ttlHours) && (input.ttlHours ?? 0) > 0 ? Number(input.ttlHours) : 24 * 30;
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const tokenResult = await issueRememberToken({
    userId: input.userId,
    rawToken,
    expiresAt,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
  const snapshot = await getSessionByRawToken(rawToken);
  if (!snapshot) {
    throw new Error("session_issue_failed");
  }
  return {
    rawToken,
    cookie: buildSessionCookie(rawToken, expiresAt),
    tokenHash: tokenResult.tokenHash,
    compatibility: tokenResult.compatibility,
    session: snapshot,
  };
}

export async function getSessionByRawToken(rawToken: string): Promise<SessionSnapshot | null> {
  if (!rawToken.trim()) {
    return null;
  }

  const pool = getPool();
  const result = await pool.query<{
    user_id: string;
    display_name: string;
    rank_label: string | null;
    expires_at: string;
    token_hash: string;
  }>(
    `update remember_tokens rt
     set last_used_at = now()
     from users u
     where rt.user_id = u.user_id
       and rt.token_hash = encode(digest($1, 'sha256'), 'hex')
       and rt.expires_at > now()
     returning rt.user_id, u.display_name, u.rank_label, rt.expires_at::text, rt.token_hash`,
    [rawToken],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    displayName: row.display_name,
    rankLabel: row.rank_label,
    expiresAt: row.expires_at,
    tokenHash: row.token_hash,
  };
}

export async function getSessionFromCookie(cookieHeader: string | undefined): Promise<SessionSnapshot | null> {
  const rawToken = readSessionTokenFromCookie(cookieHeader);
  if (!rawToken) {
    return null;
  }
  return getSessionByRawToken(rawToken);
}

export async function revokeSession(rawToken: string | null) {
  if (!rawToken) {
    return {
      revoked: false,
      tokenHash: null,
      compatibility: {
        attempted: false,
        succeeded: false,
      },
      clearedCookie: buildClearedSessionCookie(),
    };
  }

  const result = await revokeRememberToken(rawToken);
  return {
    revoked: true,
    tokenHash: result.tokenHash,
    compatibility: result.compatibility,
    clearedCookie: buildClearedSessionCookie(),
  };
}
