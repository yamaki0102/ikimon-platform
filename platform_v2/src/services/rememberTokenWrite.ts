import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import {
  revokeLegacyRememberToken,
  writeLegacyRememberToken,
} from "../legacy/compatibilityWriter.js";
import { recordCompatibilityFailure } from "./writeSupport.js";

export type RememberTokenIssueInput = {
  userId: string;
  rawToken: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function issueRememberToken(input: RememberTokenIssueInput) {
  if (!input.userId.trim()) {
    throw new Error("userId is required");
  }

  if (!input.rawToken.trim()) {
    throw new Error("rawToken is required");
  }

  const tokenHash = hashToken(input.rawToken);
  const pool = getPool();
  await pool.query(
    `insert into remember_tokens (
        user_id, token_hash, token_family, user_agent, ip_address, expires_at, created_at
     ) values (
        $1, $2, 'v2', $3, $4::inet, $5, now()
     )
     on conflict (token_hash) do update set
        user_id = excluded.user_id,
        user_agent = excluded.user_agent,
        ip_address = excluded.ip_address,
        expires_at = excluded.expires_at`,
    [
      input.userId,
      tokenHash,
      input.userAgent ?? null,
      input.ipAddress ?? null,
      input.expiresAt,
    ],
  );

  const config = loadConfig();
  const compatibility = {
    attempted: config.compatibilityWriteEnabled,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (config.compatibilityWriteEnabled) {
    try {
      await writeLegacyRememberToken(tokenHash, {
        legacyDataRoot: config.legacyDataRoot,
        publicRoot: config.legacyPublicRoot,
      });
      compatibility.succeeded = true;
    } catch (error) {
      compatibility.error = error instanceof Error ? error.message : "compatibility_write_failed";
      const client = await pool.connect();
      try {
        await recordCompatibilityFailure(client, "remember_token", tokenHash, config.legacyDataRoot, {
          error: compatibility.error,
        });
      } finally {
        client.release();
      }
    }
  }

  return {
    tokenHash,
    compatibility,
  };
}

export async function revokeRememberToken(rawTokenOrHash: string) {
  if (!rawTokenOrHash.trim()) {
    throw new Error("token is required");
  }

  const tokenHash = rawTokenOrHash.length === 64 ? rawTokenOrHash : hashToken(rawTokenOrHash);
  const pool = getPool();
  await pool.query("delete from remember_tokens where token_hash = $1", [tokenHash]);

  const config = loadConfig();
  const compatibility = {
    attempted: config.compatibilityWriteEnabled,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (config.compatibilityWriteEnabled) {
    try {
      await revokeLegacyRememberToken(tokenHash, {
        legacyDataRoot: config.legacyDataRoot,
        publicRoot: config.legacyPublicRoot,
      });
      compatibility.succeeded = true;
    } catch (error) {
      compatibility.error = error instanceof Error ? error.message : "compatibility_write_failed";
      const client = await pool.connect();
      try {
        await recordCompatibilityFailure(client, "remember_token", tokenHash, config.legacyDataRoot, {
          error: compatibility.error,
        });
      } finally {
        client.release();
      }
    }
  }

  return {
    tokenHash,
    compatibility,
  };
}
