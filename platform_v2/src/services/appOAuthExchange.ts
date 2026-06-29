import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";

type ExchangeRow = {
  user_id: string;
  session_token_ciphertext: string;
  session_token_iv: string;
  session_token_auth_tag: string;
  display_name: string;
  email: string | null;
  expires_at: string;
  consumed_at: string | null;
};

type QueryablePool = {
  query: <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  connect: () => Promise<{
    query: <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    release: () => void;
  }>;
};

export type ConsumedAppOAuthExchange = {
  token: string;
  userId: string;
  displayName: string;
  email: string | null;
};

function exchangeSecret(): string {
  const config = loadConfig();
  return config.oauthStateSecret
    ?? config.oauth.google?.clientSecret
    ?? config.oauth.twitter?.clientSecret
    ?? config.privilegedWriteApiKey
    ?? "ikimon-dev-app-oauth-exchange";
}

function exchangeKey(): Buffer {
  return createHash("sha256").update(exchangeSecret()).digest();
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function encryptToken(token: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", exchangeKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptToken(row: ExchangeRow): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    exchangeKey(),
    Buffer.from(row.session_token_iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(row.session_token_auth_tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.session_token_ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function createAppOAuthExchangeCode(input: {
  userId: string;
  displayName: string;
  email?: string | null;
  rawToken: string;
}, pool: QueryablePool = getPool()): Promise<{ code: string; expiresAt: string }> {
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const encrypted = encryptToken(input.rawToken);
  await pool.query(
    `insert into app_oauth_exchange_codes (
        code_hash, user_id, session_token_ciphertext, session_token_iv,
        session_token_auth_tag, display_name, email, expires_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
    [
      hashCode(code),
      input.userId,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      input.displayName,
      input.email ?? null,
      expiresAt,
    ],
  );
  return { code, expiresAt };
}

export async function consumeAppOAuthExchangeCode(
  codeInput: unknown,
  pool: Pick<QueryablePool, "connect"> = getPool(),
): Promise<ConsumedAppOAuthExchange> {
  const code = typeof codeInput === "string" ? codeInput.trim() : "";
  if (!code) {
    throw new Error("oauth_exchange_code_required");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<ExchangeRow>(
      `select user_id, session_token_ciphertext, session_token_iv, session_token_auth_tag,
              display_name, email, expires_at::text, consumed_at::text
         from app_oauth_exchange_codes
        where code_hash = $1
        for update`,
      [hashCode(code)],
    );
    const row = result.rows[0];
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new Error("oauth_exchange_code_invalid");
    }

    await client.query(
      `update app_oauth_exchange_codes
          set consumed_at = now()
        where code_hash = $1`,
      [hashCode(code)],
    );
    const token = decryptToken(row);
    await client.query("commit");
    return {
      token,
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
