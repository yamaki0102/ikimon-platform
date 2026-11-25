import type { Env } from "./core/env";
import { assertSameOriginRequest, json, normalizeOptionalText, readJson } from "./core/http";
import {
  GUEST_PASS_TTL_MS,
  buildGuestPassCookieHeader,
  findActiveGuestPass,
  generate256BitToken,
  isGuestPostingEnabled,
  revokeGuestPass,
  sha256HexString,
} from "./guestPosting";

const HANDOFF_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const HANDOFF_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type HandoffSession = {
  userId: string;
  banned?: boolean;
} | null;

function generateHandoffCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => HANDOFF_CODE_ALPHABET[b % HANDOFF_CODE_ALPHABET.length]!);
  return `ZKN-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function normalizeHandoffCode(raw: unknown): string | null {
  const text = normalizeOptionalText(raw);
  if (!text) return null;
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 8 || cleaned.length > 32) return null;
  return cleaned;
}

/**
 * Issue a one-time-displayed handoff code for the active guest pass.
 */
export async function handleIssueGuestHandoffCode(request: Request, env: Env): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const pass = await findActiveGuestPass(env.OBS_DB, request);
  if (!pass) {
    return json({ ok: false, error: "guest_pass_required" }, 401, { "cache-control": "no-store" });
  }

  const now = Date.now();
  const expiresAt = now + HANDOFF_CODE_TTL_MS;
  const code = generateHandoffCode();
  const normalized = normalizeHandoffCode(code)!;
  const codeHash = await sha256HexString(normalized);
  const codeId = `ghc_${crypto.randomUUID()}`;

  await env.OBS_DB.prepare(
    `INSERT INTO guest_handoff_codes (code_id, pass_id, code_hash, claimed_by_user_id, claimed_at, expires_at, created_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`
  ).bind(codeId, pass.pass_id, codeHash, expiresAt, now).run();

  await env.OBS_DB.prepare(
    `INSERT INTO guest_pass_audit_events (event_id, pass_id, event_type, actor_type, detail_json, created_at)
     VALUES (?, ?, 'handoff_code_issued', 'guest', ?, ?)`
  ).bind(`gpa_${crypto.randomUUID()}`, pass.pass_id, JSON.stringify({ codeId }), now).run();

  return json({ ok: true, code, expiresAt }, 201, { "cache-control": "no-store" });
}

/**
 * Claim a guest pass into a logged-in user account using a handoff code.
 * Enforces 3 conditions (valid unclaimed code, active pass, unclaimed owner) and first-claimer-wins.
 * Appends 1 row to `guest_owner_claims` without mutating `observations`.
 */
export async function handleClaimGuestHandoff(
  request: Request,
  env: Env,
  session: HandoffSession
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  if (!session || session.banned) {
    return json({ ok: false, error: "login_required" }, 401, { "cache-control": "no-store" });
  }

  const body = await readJson<{ handoffCode?: unknown }>(request);
  const normalized = normalizeHandoffCode(body.handoffCode);
  if (!normalized) {
    return json({ ok: false, error: "handoff_code_required" }, 400, { "cache-control": "no-store" });
  }

  const now = Date.now();
  const codeHash = await sha256HexString(normalized);
  const codeRow = await env.OBS_DB.prepare(
    `SELECT code_id, pass_id, claimed_by_user_id, expires_at
       FROM guest_handoff_codes
      WHERE code_hash = ?
      LIMIT 1`
  ).bind(codeHash).first<{
    code_id: string;
    pass_id: string;
    claimed_by_user_id: string | null;
    expires_at: number;
  }>();

  if (!codeRow || codeRow.expires_at <= now) {
    return json({ ok: false, error: "invalid_or_expired_handoff_code" }, 404, { "cache-control": "no-store" });
  }
  if (codeRow.claimed_by_user_id) {
    return json({ ok: false, error: "handoff_already_claimed" }, 409, { "cache-control": "no-store" });
  }

  const passRow = await env.OBS_DB.prepare(
    "SELECT pass_id, status, expires_at FROM guest_passes WHERE pass_id = ? LIMIT 1"
  ).bind(codeRow.pass_id).first<{ pass_id: string; status: string; expires_at: number }>();
  if (!passRow || passRow.status !== "active" || passRow.expires_at <= now) {
    return json({ ok: false, error: "guest_pass_not_active" }, 409, { "cache-control": "no-store" });
  }

  const claimRes = await env.OBS_DB.prepare(
    `UPDATE guest_handoff_codes
        SET claimed_by_user_id = ?, claimed_at = ?
      WHERE code_id = ?
        AND claimed_by_user_id IS NULL
        AND expires_at > ?`
  ).bind(session.userId, now, codeRow.code_id, now).run();
  const changes = Number((claimRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  if (changes !== 1) {
    return json({ ok: false, error: "handoff_already_claimed" }, 409, { "cache-control": "no-store" });
  }

  const guestOwnerKey = `guest:${passRow.pass_id}`;
  try {
    await env.OBS_DB.prepare(
      `INSERT INTO guest_owner_claims (guest_owner_key, pass_id, claimed_by_user_id, handoff_code_id, claimed_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(guestOwnerKey, passRow.pass_id, session.userId, codeRow.code_id, now).run();
  } catch {
    return json({ ok: false, error: "handoff_already_claimed" }, 409, { "cache-control": "no-store" });
  }

  await revokeGuestPass(env.OBS_DB, passRow.pass_id, "claimed", "guest", now);

  return json(
    {
      ok: true,
      guestOwnerKey,
      claimedByUserId: session.userId,
      claimedAt: now,
    },
    200,
    { "cache-control": "no-store" }
  );
}

/**
 * Recover an active, unclaimed guest pass onto the current browser using the handoff code,
 * rotating the pass token hash so any lost cookie can no longer be used.
 */
export async function handleRecoverGuestPass(request: Request, env: Env): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJson<{ handoffCode?: unknown }>(request);
  const normalized = normalizeHandoffCode(body.handoffCode);
  if (!normalized) {
    return json({ ok: false, error: "handoff_code_required" }, 400, { "cache-control": "no-store" });
  }

  const now = Date.now();
  const codeHash = await sha256HexString(normalized);
  const codeRow = await env.OBS_DB.prepare(
    `SELECT code_id, pass_id, claimed_by_user_id, expires_at
       FROM guest_handoff_codes
      WHERE code_hash = ?
      LIMIT 1`
  ).bind(codeHash).first<{
    code_id: string;
    pass_id: string;
    claimed_by_user_id: string | null;
    expires_at: number;
  }>();

  if (!codeRow || codeRow.expires_at <= now) {
    return json({ ok: false, error: "invalid_or_expired_handoff_code" }, 404, { "cache-control": "no-store" });
  }
  if (codeRow.claimed_by_user_id) {
    return json({ ok: false, error: "handoff_already_claimed" }, 409, { "cache-control": "no-store" });
  }

  const newRawToken = generate256BitToken();
  const newTokenHash = await sha256HexString(newRawToken);
  const newExpiresAt = now + GUEST_PASS_TTL_MS;

  const rotateRes = await env.OBS_DB.prepare(
    `UPDATE guest_passes
        SET token_hash = ?, last_used_at = ?, expires_at = ?
      WHERE pass_id = ?
        AND status = 'active'
        AND expires_at > ?`
  ).bind(newTokenHash, now, newExpiresAt, codeRow.pass_id, now).run();
  const changes = Number((rotateRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  if (changes !== 1) {
    return json({ ok: false, error: "handoff_unavailable" }, 409, { "cache-control": "no-store" });
  }

  await env.OBS_DB.prepare(
    `INSERT INTO guest_pass_audit_events (event_id, pass_id, event_type, actor_type, detail_json, created_at)
     VALUES (?, ?, 'pass_recovered', 'guest', ?, ?)`
  ).bind(`gpa_${crypto.randomUUID()}`, codeRow.pass_id, JSON.stringify({ codeId: codeRow.code_id }), now).run();

  const secure = new URL(request.url).protocol === "https:";
  return json(
    { ok: true, passId: codeRow.pass_id, expiresAt: newExpiresAt },
    200,
    { "set-cookie": buildGuestPassCookieHeader(newRawToken, secure), "cache-control": "no-store" }
  );
}

/**
 * Resolve all `guest:<passId>` owner keys claimed by a logged-in user.
 */
export async function getClaimedGuestOwnerKeysForUser(
  db: Env["OBS_DB"],
  userId: string
): Promise<string[]> {
  const rows = (await db.prepare(
    "SELECT guest_owner_key FROM guest_owner_claims WHERE claimed_by_user_id = ? ORDER BY claimed_at DESC"
  ).bind(userId).all<{ guest_owner_key: string }>()).results;
  return rows.map((r) => r.guest_owner_key);
}
