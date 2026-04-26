import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
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

export type ProfileSelfUpdateInput = {
  userId: string;
  displayName: unknown;
  profileBio?: unknown;
  expertise?: unknown;
  avatar?: {
    filename?: unknown;
    mimeType?: unknown;
    base64Data?: unknown;
  } | null;
};

function normalizedOptionalText(value: unknown, maxLength: number, errorName: string): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(errorName);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(errorName);
  }
  return normalized;
}

function normalizedDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("display_name_required");
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("display_name_required");
  }
  if (normalized.length > 50) {
    throw new Error("display_name_too_long");
  }
  return normalized;
}

function normalizeBase64Image(input: unknown): Buffer | null {
  if (input === undefined || input === null || input === "") {
    return null;
  }
  if (typeof input !== "string") {
    throw new Error("avatar_invalid");
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const commaIndex = trimmed.indexOf(",");
  const raw = trimmed.startsWith("data:") && commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
  const buffer = Buffer.from(raw, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("avatar_empty");
  }
  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("avatar_too_large");
  }
  return buffer;
}

function normalizeAvatarMimeType(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("avatar_invalid");
  }
  const mimeType = value.trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("avatar_invalid_type");
  }
  return mimeType;
}

function avatarExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}

async function persistProfileAvatar(
  client: PoolClient,
  userId: string,
  avatar: ProfileSelfUpdateInput["avatar"],
): Promise<string | null> {
  const buffer = normalizeBase64Image(avatar?.base64Data);
  if (!buffer) {
    return null;
  }
  const mimeType = normalizeAvatarMimeType(avatar?.mimeType);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const config = loadConfig();
  const relativePath = path.posix.join("uploads", "avatars", `${userId}_${sha256.slice(0, 12)}${avatarExtension(mimeType)}`);
  const absolutePath = path.join(config.legacyPublicRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const blobId = await upsertAssetBlob(client, {
    storageBackend: "local_fs",
    storagePath: relativePath,
    mediaType: "image",
    mimeType,
    publicUrl: `/${relativePath}`,
    sha256,
    bytes: buffer.byteLength,
    sourcePayload: {
      source: "profile_settings",
      filename: typeof avatar?.filename === "string" ? avatar.filename : null,
    },
  });

  const existing = await client.query<{ asset_id: string }>(
    `select asset_id
       from evidence_assets
      where legacy_asset_key = $1
      limit 1`,
    [`avatar:${userId}`],
  );
  const assetId = existing.rows[0]?.asset_id ?? null;
  if (assetId) {
    await client.query(
      `update evidence_assets
          set blob_id = $2::uuid,
              legacy_relative_path = $3,
              source_payload = $4::jsonb
        where asset_id = $1::uuid`,
      [
        assetId,
        blobId,
        relativePath,
        JSON.stringify({ source: "profile_settings", filename: typeof avatar?.filename === "string" ? avatar.filename : null }),
      ],
    );
    return assetId;
  }

  const inserted = await client.query<{ asset_id: string }>(
    `insert into evidence_assets (
        blob_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
     ) values (
        $1::uuid, 'avatar', $2, $3, $4::jsonb
     )
     returning asset_id`,
    [
      blobId,
      `avatar:${userId}`,
      relativePath,
      JSON.stringify({ source: "profile_settings", filename: typeof avatar?.filename === "string" ? avatar.filename : null }),
    ],
  );
  return inserted.rows[0]?.asset_id ?? null;
}

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

export async function updateOwnProfile(input: ProfileSelfUpdateInput) {
  if (!input.userId.trim()) {
    throw new Error("session_required");
  }

  const displayName = normalizedDisplayName(input.displayName);
  const profileBio = normalizedOptionalText(input.profileBio, 500, "profile_bio_too_long");
  const expertise = normalizedOptionalText(input.expertise, 120, "expertise_too_long");

  const pool = getPool();
  const client = await pool.connect();
  let updated:
    | {
        user_id: string;
        display_name: string;
        rank_label: string | null;
        profile_bio: string | null;
        expertise: string | null;
      }
    | undefined;

  try {
    await client.query("begin");
    const avatarAssetId = await persistProfileAvatar(client, input.userId, input.avatar);
    const result = await client.query<{
      user_id: string;
      display_name: string;
      rank_label: string | null;
      profile_bio: string | null;
      expertise: string | null;
    }>(
      `update users
          set display_name = $2,
              avatar_asset_id = coalesce($5::uuid, avatar_asset_id),
              stats_json = jsonb_set(
                jsonb_set(coalesce(stats_json, '{}'::jsonb), '{profile,bio}', to_jsonb($3::text), true),
                '{profile,expertise}', to_jsonb($4::text),
                true
              ),
              updated_at = now()
        where user_id = $1
        returning
          user_id,
          display_name,
          rank_label,
          coalesce(stats_json, '{}'::jsonb) #>> '{profile,bio}' as profile_bio,
          coalesce(stats_json, '{}'::jsonb) #>> '{profile,expertise}' as expertise`,
      [input.userId, displayName, profileBio, expertise, avatarAssetId],
    );

    updated = result.rows[0];
    if (!updated) {
      throw new Error("user_not_found");
    }

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
    user: {
      userId: updated.user_id,
      displayName: updated.display_name,
      rankLabel: updated.rank_label,
      profileBio: updated.profile_bio ?? "",
      expertise: updated.expertise ?? "",
    },
    compatibility,
  };
}
