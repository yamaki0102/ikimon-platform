import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyUser } from "../legacy/compatibilityWriter.js";
import { recordCompatibilityFailure, upsertAssetBlob } from "./writeSupport.js";

export type UserUpsertInput = {
  userId: string;
  displayName: string;
  email?: string | null;
  passwordHash?: string | null;
  roleName?: string | null;
  rankLabel?: string | null;
  authProvider?: string | null;
  oauthId?: string | null;
  avatar?: {
    path: string;
    publicUrl?: string | null;
    mimeType?: string | null;
    sha256?: string | null;
    bytes?: number | null;
  } | null;
  banned?: boolean;
};

export async function upsertUser(input: UserUpsertInput) {
  if (!input.userId.trim()) {
    throw new Error("userId is required");
  }

  if (!input.displayName.trim()) {
    throw new Error("displayName is required");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    let avatarAssetId: string | null = null;
    if (input.avatar?.path) {
      const blobId = await upsertAssetBlob(client, {
        storageBackend: "local_fs",
        storagePath: input.avatar.path,
        mediaType: "image",
        mimeType: input.avatar.mimeType ?? null,
        publicUrl: input.avatar.publicUrl ?? input.avatar.path,
        sha256: input.avatar.sha256 ?? null,
        bytes: input.avatar.bytes ?? null,
        sourcePayload: { source: "v2_user_api" },
      });

      const existing = await client.query<{ asset_id: string }>(
        `select asset_id
         from evidence_assets
         where legacy_asset_key = $1
         limit 1`,
        [`avatar:${input.userId}`],
      );

      avatarAssetId = existing.rows[0]?.asset_id ?? null;
      if (!avatarAssetId) {
        const insert = await client.query<{ asset_id: string }>(
          `insert into evidence_assets (
              blob_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
           ) values (
              $1::uuid, 'avatar', $2, $3, $4::jsonb
           )
           returning asset_id`,
          [blobId, `avatar:${input.userId}`, input.avatar.path, JSON.stringify({ source: "v2_user_api" })],
        );
        avatarAssetId = insert.rows[0]?.asset_id ?? null;
      } else {
        await client.query(
          `update evidence_assets
           set blob_id = $2::uuid,
               legacy_relative_path = $3,
               source_payload = $4::jsonb
           where asset_id = $1::uuid`,
          [avatarAssetId, blobId, input.avatar.path, JSON.stringify({ source: "v2_user_api" })],
        );
      }
    }

    await client.query(
      `insert into users (
          user_id, legacy_user_id, display_name, email, password_hash, avatar_asset_id,
          role_name, rank_label, auth_provider, oauth_id, banned, created_at, updated_at
       ) values (
          $1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10, $11, now(), now()
       )
       on conflict (user_id) do update set
          display_name = excluded.display_name,
          email = excluded.email,
          password_hash = coalesce(excluded.password_hash, users.password_hash),
          avatar_asset_id = coalesce(excluded.avatar_asset_id, users.avatar_asset_id),
          role_name = excluded.role_name,
          rank_label = excluded.rank_label,
          auth_provider = excluded.auth_provider,
          oauth_id = excluded.oauth_id,
          banned = excluded.banned,
          updated_at = now()`,
      [
        input.userId,
        input.userId,
        input.displayName,
        input.email?.toLowerCase() ?? null,
        input.passwordHash ?? null,
        avatarAssetId,
        input.roleName ?? "Observer",
        input.rankLabel ?? "観察者",
        input.authProvider ?? "local",
        input.oauthId ?? null,
        Boolean(input.banned),
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const config = loadConfig();
  const compatibility = {
    attempted: config.compatibilityWriteEnabled,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (config.compatibilityWriteEnabled) {
    try {
      await writeLegacyUser(input.userId, {
        legacyDataRoot: config.legacyDataRoot,
        publicRoot: config.legacyPublicRoot,
      });
      compatibility.succeeded = true;
    } catch (error) {
      compatibility.error = error instanceof Error ? error.message : "compatibility_write_failed";
      const failureClient = await pool.connect();
      try {
        await recordCompatibilityFailure(failureClient, "user", input.userId, config.legacyDataRoot, {
          error: compatibility.error,
        });
      } finally {
        failureClient.release();
      }
    }
  }

  return {
    userId: input.userId,
    compatibility,
  };
}
