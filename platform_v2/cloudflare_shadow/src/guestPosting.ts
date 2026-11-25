import type { Env } from "./core/env";

type D1Db = Env["OBS_DB"];

export const GUEST_PASS_COOKIE_NAME = "zukan_guest_pass";
export const GUEST_PASS_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const DEFAULT_GUEST_DESTINATION_MAX_COUNT = 50;

export type GuestDestination = {
  kind: "place" | "event";
  id: string;
};

export type GuestPassRow = {
  pass_id: string;
  token_hash: string;
  status: string;
  revoked_reason: string | null;
  last_used_at: number;
  expires_at: number;
  created_at: number;
};

export function isGuestPostingEnabled(env: Env): boolean {
  return env.GUEST_POSTING_ENABLED === "true";
}

export function destinationKey(dest: GuestDestination): string {
  return `${dest.kind}:${dest.id}`;
}

export function normalizeGuestDestination(kind: unknown, id: unknown): GuestDestination | null {
  if (kind !== "place" && kind !== "event") return null;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(trimmed)) return null;
  return { kind, id: trimmed };
}

export async function sha256HexString(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generate256BitToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function readCookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

export function buildGuestPassCookieHeader(rawToken: string, secure: boolean, maxAgeSeconds = Math.floor(GUEST_PASS_TTL_MS / 1000)): string {
  const secureAttr = secure ? " Secure;" : "";
  return `${GUEST_PASS_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax;${secureAttr} Max-Age=${maxAgeSeconds}`;
}

export function buildClearedGuestPassCookieHeader(secure: boolean): string {
  const secureAttr = secure ? " Secure;" : "";
  return `${GUEST_PASS_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secureAttr} Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

async function appendAuditEvent(
  db: D1Db,
  passId: string,
  eventType: string,
  actorType: "guest" | "admin" | "system",
  detail: Record<string, unknown>,
  now: number
): Promise<void> {
  await db.prepare(
    "INSERT INTO guest_pass_audit_events (event_id, pass_id, event_type, actor_type, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(`gpa_${crypto.randomUUID()}`, passId, eventType, actorType, JSON.stringify(detail), now).run();
}

export async function findActiveGuestPass(db: D1Db, request: Request, now = Date.now()): Promise<GuestPassRow | null> {
  const rawToken = readCookieValue(request, GUEST_PASS_COOKIE_NAME);
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = await sha256HexString(rawToken);
  const row = await db.prepare(
    "SELECT pass_id, token_hash, status, revoked_reason, last_used_at, expires_at, created_at FROM guest_passes WHERE token_hash = ? LIMIT 1"
  ).bind(tokenHash).first<GuestPassRow>();
  if (!row || row.status !== "active" || row.expires_at <= now) return null;
  return row;
}

export async function issueGuestPass(
  db: D1Db,
  options: { destination?: GuestDestination | null; now?: number } = {}
): Promise<{ passId: string; rawToken: string; expiresAt: number }> {
  const now = options.now ?? Date.now();
  const expiresAt = now + GUEST_PASS_TTL_MS;
  const passId = `gp_${crypto.randomUUID()}`;
  const rawToken = generate256BitToken();
  const tokenHash = await sha256HexString(rawToken);

  await db.prepare(
    "INSERT INTO guest_passes (pass_id, token_hash, status, revoked_reason, last_used_at, expires_at, created_at) VALUES (?, ?, 'active', NULL, ?, ?, ?)"
  ).bind(passId, tokenHash, now, expiresAt, now).run();

  if (options.destination) {
    await db.prepare(
      "INSERT OR IGNORE INTO guest_pass_destinations (id, pass_id, destination_kind, destination_id, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(`gpd_${crypto.randomUUID()}`, passId, options.destination.kind, options.destination.id, now).run();
  }

  await appendAuditEvent(db, passId, "pass_issued", "guest", {
    destination: options.destination ? destinationKey(options.destination) : null,
  }, now);

  return { passId, rawToken, expiresAt };
}

export async function revokeGuestPass(
  db: D1Db,
  passId: string,
  reason: "user_discarded" | "admin_stopped" | "claimed" | "expired",
  actorType: "guest" | "admin" | "system",
  now = Date.now()
): Promise<boolean> {
  const res = await db.prepare(
    "UPDATE guest_passes SET status = 'revoked', revoked_reason = ? WHERE pass_id = ? AND status = 'active'"
  ).bind(reason, passId).run();
  const changes = Number((res as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  if (changes > 0) {
    await appendAuditEvent(db, passId, "pass_revoked", actorType, { reason }, now);
  }
  return changes > 0;
}

export async function setDestinationQrStopped(
  db: D1Db,
  dest: GuestDestination,
  stopped: boolean,
  maxCount = DEFAULT_GUEST_DESTINATION_MAX_COUNT,
  now = Date.now()
): Promise<void> {
  const key = destinationKey(dest);
  await db.prepare(
    `INSERT INTO guest_destination_quotas (destination_key, qr_stopped, max_count, reserved_count, used_count, updated_at)
     VALUES (?, ?, ?, 0, 0, ?)
     ON CONFLICT(destination_key) DO UPDATE SET qr_stopped = excluded.qr_stopped, updated_at = excluded.updated_at`
  ).bind(key, stopped ? 1 : 0, maxCount, now).run();
}

export type GuestAdmitResult =
  | { admitted: true; passId: string; reservationId: string; ownerKey: string; destinationKey: string }
  | { admitted: false; status: 401 | 403 | 429; error: string };

export async function guestAdmit(
  db: D1Db,
  request: Request,
  dest: GuestDestination,
  options: { now?: number; defaultMaxCount?: number } = {}
): Promise<GuestAdmitResult> {
  const now = options.now ?? Date.now();
  const pass = await findActiveGuestPass(db, request, now);
  if (!pass) {
    return { admitted: false, status: 401, error: "guest_pass_required" };
  }

  const key = destinationKey(dest);
  const defaultMax = options.defaultMaxCount ?? DEFAULT_GUEST_DESTINATION_MAX_COUNT;
  await db.prepare(
    `INSERT OR IGNORE INTO guest_destination_quotas (destination_key, qr_stopped, max_count, reserved_count, used_count, updated_at)
     VALUES (?, 0, ?, 0, 0, ?)`
  ).bind(key, defaultMax, now).run();

  const quota = await db.prepare(
    "SELECT destination_key, qr_stopped, max_count, reserved_count, used_count FROM guest_destination_quotas WHERE destination_key = ? LIMIT 1"
  ).bind(key).first<{
    destination_key: string;
    qr_stopped: number;
    max_count: number;
    reserved_count: number;
    used_count: number;
  }>();

  if (quota && quota.qr_stopped === 1) {
    return { admitted: false, status: 403, error: "qr_stopped" };
  }

  const reserveRes = await db.prepare(
    `UPDATE guest_destination_quotas
        SET reserved_count = reserved_count + 1,
            updated_at = ?
      WHERE destination_key = ?
        AND qr_stopped = 0
        AND (reserved_count + used_count) < max_count`
  ).bind(now, key).run();
  const reservedChanges = Number((reserveRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  if (reservedChanges === 0) {
    return { admitted: false, status: 429, error: "destination_quota_exceeded" };
  }

  const reservationId = `gres_${crypto.randomUUID()}`;
  await db.prepare(
    "INSERT INTO guest_slot_reservations (reservation_id, pass_id, destination_key, status, created_at) VALUES (?, ?, ?, 'reserved', ?)"
  ).bind(reservationId, pass.pass_id, key, now).run();

  await db.prepare(
    "INSERT OR IGNORE INTO guest_pass_destinations (id, pass_id, destination_kind, destination_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(`gpd_${crypto.randomUUID()}`, pass.pass_id, dest.kind, dest.id, now).run();

  await db.prepare(
    "UPDATE guest_passes SET last_used_at = ?, expires_at = ? WHERE pass_id = ?"
  ).bind(now, now + GUEST_PASS_TTL_MS, pass.pass_id).run();

  return {
    admitted: true,
    passId: pass.pass_id,
    reservationId,
    ownerKey: `guest:${pass.pass_id}`,
    destinationKey: key,
  };
}
