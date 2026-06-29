import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { loadConfig } from "../config.js";

const EXCHANGE_CODE_TTL_MS = 5 * 60 * 1000;
const EXCHANGE_CODE_VERSION = "v1";

type AppOAuthExchangePayload = {
  token: string;
  userId: string;
  displayName: string;
  email: string | null;
  expiresAt: number;
  nonce: string;
};

const consumedCodeHashes = new Map<string, number>();

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

function pruneConsumedCodes(now = Date.now()): void {
  for (const [codeHash, expiresAt] of consumedCodeHashes.entries()) {
    if (expiresAt <= now) {
      consumedCodeHashes.delete(codeHash);
    }
  }
}

function sealPayload(payload: AppOAuthExchangePayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", exchangeKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [
    EXCHANGE_CODE_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function parsePayload(value: unknown): AppOAuthExchangePayload {
  if (!value || typeof value !== "object") {
    throw new Error("oauth_exchange_code_invalid");
  }
  const payload = value as Partial<AppOAuthExchangePayload>;
  if (
    typeof payload.token !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.displayName !== "string" ||
    (payload.email !== null && typeof payload.email !== "string") ||
    typeof payload.expiresAt !== "number" ||
    typeof payload.nonce !== "string"
  ) {
    throw new Error("oauth_exchange_code_invalid");
  }
  return {
    token: payload.token,
    userId: payload.userId,
    displayName: payload.displayName,
    email: payload.email ?? null,
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
  };
}

function openPayload(code: string): AppOAuthExchangePayload {
  const [version, iv, authTag, ciphertext] = code.split(".");
  if (version !== EXCHANGE_CODE_VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("oauth_exchange_code_invalid");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", exchangeKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return parsePayload(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof Error && error.message === "oauth_exchange_code_invalid") {
      throw error;
    }
    throw new Error("oauth_exchange_code_invalid");
  }
}

export async function createAppOAuthExchangeCode(input: {
  userId: string;
  displayName: string;
  email?: string | null;
  rawToken: string;
}): Promise<{ code: string; expiresAt: string }> {
  const expiresAtMs = Date.now() + EXCHANGE_CODE_TTL_MS;
  const code = sealPayload({
    token: input.rawToken,
    userId: input.userId,
    displayName: input.displayName,
    email: input.email ?? null,
    expiresAt: expiresAtMs,
    nonce: randomBytes(16).toString("base64url"),
  });
  return { code, expiresAt: new Date(expiresAtMs).toISOString() };
}

export async function consumeAppOAuthExchangeCode(codeInput: unknown): Promise<ConsumedAppOAuthExchange> {
  const code = typeof codeInput === "string" ? codeInput.trim() : "";
  if (!code) {
    throw new Error("oauth_exchange_code_required");
  }

  const codeHash = hashCode(code);
  const now = Date.now();
  pruneConsumedCodes(now);
  if (consumedCodeHashes.has(codeHash)) {
    throw new Error("oauth_exchange_code_invalid");
  }

  const payload = openPayload(code);
  if (payload.expiresAt <= now) {
    throw new Error("oauth_exchange_code_invalid");
  }
  consumedCodeHashes.set(codeHash, payload.expiresAt);
  return {
    token: payload.token,
    userId: payload.userId,
    displayName: payload.displayName,
    email: payload.email,
  };
}

export function resetAppOAuthExchangeForTests(): void {
  consumedCodeHashes.clear();
}
