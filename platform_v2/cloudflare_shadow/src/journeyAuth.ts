export const JOURNEY_IDENTITY = "journey-synthetic";
export const JOURNEY_USER_ID = "user_journey_synthetic";
export const JOURNEY_EMAIL = "journey-synthetic@zukan.invalid";
export const JOURNEY_SESSION_TTL = 600;
export const JOURNEY_PATH = "/__journey/session";
const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface JourneyDatabase {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export interface JourneyUser {
  user_id: string; email: string; password_hash: string | null;
  display_name: string; role_name: string; rank_label: string | null; banned: number;
}
type JourneyEnv = { CORE_DB: JourneyDatabase; JOURNEY_SESSION_HMAC_SECRET?: string };

export function withJourneyPrivacy(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function reply(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: PRIVATE_HEADERS });
}

/** The fixed principal is never an owner account; even privileged API routes are fenced. */
export function journeyReadOnlyGuard(request: Request, session: { userId: string } | null): Response | null {
  if (session?.userId !== JOURNEY_USER_ID) return null;
  if (request.method === "GET" || request.method === "HEAD") return null;
  if (request.method === "POST" && new URL(request.url).pathname === "/api/v1/auth/session/logout") return null;
  return reply("journey_read_only", 403);
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeKey(secret: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const bytes = Uint8Array.from(atob(secret.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
  return bytes.length === 32 && base64url(bytes) === secret ? bytes : null;
}

async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < 43; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

async function ensurePrincipal(db: JourneyDatabase): Promise<JourneyUser> {
  const existing = await db.prepare("SELECT user_id FROM users WHERE user_id = ?").bind(JOURNEY_USER_ID).first<{ user_id: string }>();
  if (existing && !await db.prepare("SELECT user_id FROM auth_users WHERE user_id = ?").bind(JOURNEY_USER_ID).first())
    throw new Error("journey_principal_conflict");
  if (await db.prepare("SELECT user_id FROM oauth_accounts WHERE user_id = ? LIMIT 1").bind(JOURNEY_USER_ID).first())
    throw new Error("journey_principal_conflict");
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(JOURNEY_USER_ID),
    db.prepare(`INSERT OR IGNORE INTO auth_users
      (user_id, email, password_hash, display_name, role_name, rank_label, banned)
      VALUES (?, ?, NULL, 'Journey Synthetic', 'Observer', NULL, 0)`).bind(JOURNEY_USER_ID, JOURNEY_EMAIL),
  ]);
  const user = await db.prepare(`SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned
    FROM auth_users WHERE user_id = ?`).bind(JOURNEY_USER_ID).first<JourneyUser>();
  if (!user || user.email !== JOURNEY_EMAIL || user.password_hash !== null || user.display_name !== "Journey Synthetic"
    || user.role_name !== "Observer" || user.rank_label !== null || user.banned !== 0) throw new Error("journey_principal_conflict");
  return user;
}

/** Only the existing session issuer supplies token generation/hashing and cookie semantics. */
export async function handleJourneySession(
  request: Request,
  env: JourneyEnv,
  issue: (user: JourneyUser, ttlSeconds: number) => Promise<{ cookie: string }>,
  readOnlyDenied = false,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== JOURNEY_PATH) return null;
  const observedAt = new Date().toISOString();
  const targetDigest = await digest(`${request.method}\n${request.url}`);
  const audit = async (outcome: "accepted" | "denied" | "failed", reason: string) => {
    await env.CORE_DB.prepare(`INSERT INTO operation_audit (audit_id, operation_type, target_id, payload_json)
      VALUES (?, 'journey.session', ?, ?)`)
      .bind(crypto.randomUUID(), targetDigest, JSON.stringify({ outcome, reason, request_target_digest: targetDigest, observed_at: observedAt })).run();
  };
  const deny = async (reason: string, status: number) => {
    await audit("denied", reason);
    return reply(reason, status);
  };
  try {
    if (readOnlyDenied) return await deny("journey_read_only", 403);
    const keyBytes = decodeKey(env.JOURNEY_SESSION_HMAC_SECRET);
    if (!keyBytes) return await deny("disabled", 404);
    if (request.method !== "POST" || url.href.includes("?") || request.body !== null) return await deny("journey_invalid_request", 400);
    const header = (name: string) => request.headers.get(`X-Zukan-Journey-${name}`) ?? "";
    const identity = header("Identity");
    if (identity !== JOURNEY_IDENTITY) return await deny("journey_identity_invalid", 403);
    const timestamp = header("Timestamp");
    const nonce = header("Nonce");
    const workId = header("Work-Id");
    const now = Math.floor(Date.now() / 1000);
    if (!/^[0-9]{1,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return await deny("journey_timestamp_invalid", 403);
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(nonce) || !/^ZUKAN-[A-Z0-9-]{1,96}$/.test(workId)) return await deny("journey_headers_invalid", 403);
    const signature = header("Signature");
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const canonical = `POST\n${JOURNEY_PATH}\n${timestamp}\n${nonce}\n${identity}\n${workId}`;
    const expected = base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical))));
    if (!/^[A-Za-z0-9_-]{43}$/.test(signature) || !constantTimeEqual(expected, signature)) return await deny("journey_signature_invalid", 403);

    // A future-dated accepted signature can remain valid for 600s. Retain nonces past that window.
    await env.CORE_DB.prepare("DELETE FROM journey_session_nonces WHERE minted_at < ?").bind(now - 601).run();
    const nonceHash = await digest(nonce);
    // One atomic SQL statement serializes both replay protection and the global sliding-minute cap.
    const claimed = await env.CORE_DB.prepare(`INSERT INTO journey_session_nonces (nonce_hash, minted_at)
      SELECT ?, ? WHERE (SELECT COUNT(*) FROM journey_session_nonces WHERE minted_at > ?) < 30
      ON CONFLICT(nonce_hash) DO NOTHING RETURNING nonce_hash`)
      .bind(nonceHash, now, now - 60).first<{ nonce_hash: string }>();
    if (!claimed) {
      const replay = await env.CORE_DB.prepare("SELECT nonce_hash FROM journey_session_nonces WHERE nonce_hash = ?")
        .bind(nonceHash).first<{ nonce_hash: string }>();
      return await deny(replay ? "journey_nonce_replay" : "journey_rate_limited", replay ? 409 : 429);
    }
    const user = await ensurePrincipal(env.CORE_DB);
    const { cookie } = await issue(user, JOURNEY_SESSION_TTL);
    await audit("accepted", "issued");
    return Response.json({ identity: JOURNEY_IDENTITY, expires_in: JOURNEY_SESSION_TTL, schema: "zukan.journey-session/v1" },
      { headers: { ...PRIVATE_HEADERS, "set-cookie": `${cookie}; Max-Age=${JOURNEY_SESSION_TTL}` } });
  } catch {
    // Fail closed; diagnostics contain no headers, tokens, signatures, keys, or raw URL.
    try { await audit("failed", "journey_unavailable"); } catch {
      console.error(JSON.stringify({ operation: "journey.session", outcome: "failed", reason: "audit_unavailable", request_target_digest: targetDigest, observed_at: observedAt }));
    }
    return reply("journey_unavailable", 503);
  }
}
