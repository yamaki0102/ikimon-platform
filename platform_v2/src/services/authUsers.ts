import { randomUUID } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyUser } from "../legacy/compatibilityWriter.js";
import { readJsonArray } from "../legacy/legacyJsonStore.js";
import { normalizeEmail } from "./authSecurity.js";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string | null;
  roleName: string;
  rankLabel: string;
};

export type OAuthProfile = {
  provider: "google" | "twitter";
  providerUserId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
};

type AuthUserRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  role_name: string | null;
  rank_label: string | null;
  banned: boolean | null;
};

const DUMMY_BCRYPT_HASH = "$2b$12$4uYgxXJtqQ5dEOR6W9tOIeI/U8P2tDeHV16uTGTfIrMB.j3UMLwUu";

type LegacyUserAuthRecord = {
  email?: unknown;
  password_hash?: unknown;
};

export function normalizeLegacyBcryptHash(hash: string): string {
  return hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
}

export async function verifyPasswordAgainstHash(password: string, storedHash: string | null | undefined): Promise<boolean> {
  const hash = storedHash && storedHash.trim() ? storedHash.trim() : DUMMY_BCRYPT_HASH;
  try {
    const ok = await bcrypt.compare(password, normalizeLegacyBcryptHash(hash));
    return Boolean(storedHash && ok);
  } catch {
    return false;
  }
}

async function findLegacyPasswordHashByEmail(email: string): Promise<string | null> {
  const config = loadConfig();
  const users = await readJsonArray<LegacyUserAuthRecord>(path.join(config.legacyDataRoot, "users.json"));
  const row = users.find((user) => normalizeEmail(user.email) === email);
  const hash = typeof row?.password_hash === "string" ? row.password_hash.trim() : "";
  return hash || null;
}

async function writeCompatibility(userId: string): Promise<void> {
  const config = loadConfig();
  if (!config.compatibilityWriteEnabled) {
    return;
  }
  await writeLegacyUser(userId, {
    legacyDataRoot: config.legacyDataRoot,
    publicRoot: config.legacyPublicRoot,
  });
}

function rowToAuthenticatedUser(row: {
  user_id: string;
  display_name: string;
  email: string | null;
  role_name: string | null;
  rank_label: string | null;
}): AuthenticatedUser {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    roleName: row.role_name ?? "Observer",
    rankLabel: row.rank_label ?? "観察者",
  };
}

export async function authenticateWithPassword(emailInput: unknown, passwordInput: unknown): Promise<AuthenticatedUser> {
  const email = normalizeEmail(emailInput);
  const password = typeof passwordInput === "string" ? passwordInput : "";
  if (!email || !password) {
    await verifyPasswordAgainstHash("", null);
    throw new Error("invalid_credentials");
  }

  const result = await getPool().query<{
    user_id: string;
    display_name: string;
    email: string | null;
    password_hash: string | null;
    role_name: string | null;
    rank_label: string | null;
    banned: boolean | null;
  }>(
    `select user_id, display_name, email, password_hash, role_name, rank_label, banned
     from users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );
  const row = result.rows[0];
  const legacyPasswordHash = row && !row.password_hash ? await findLegacyPasswordHashByEmail(email) : null;
  const passwordOk = await verifyPasswordAgainstHash(password, row?.password_hash ?? legacyPasswordHash);
  if (!row || !passwordOk) {
    throw new Error("invalid_credentials");
  }
  if (row.banned) {
    throw new Error("account_disabled");
  }

  await getPool().query(
    `update users
     set password_hash = coalesce(nullif(password_hash, ''), $2),
         last_login_at = now(),
         updated_at = now()
     where user_id = $1`,
    [row.user_id, legacyPasswordHash],
  );
  return rowToAuthenticatedUser(row);
}

export async function registerWithPassword(input: {
  displayName: unknown;
  email: unknown;
  password: unknown;
}): Promise<AuthenticatedUser> {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (displayName.length < 1) {
    throw new Error("display_name_required");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("invalid_email");
  }
  if (password.length < 8) {
    throw new Error("password_too_short");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = `user_${randomUUID()}`;
  try {
    const result = await getPool().query<{
      user_id: string;
      display_name: string;
      email: string | null;
      role_name: string | null;
      rank_label: string | null;
    }>(
      `insert into users (
          user_id, legacy_user_id, display_name, email, password_hash,
          role_name, rank_label, auth_provider, oauth_id, banned, created_at, updated_at, last_login_at
       ) values (
          $1, $1, $2, $3, $4, 'Observer', '観察者', 'local', null, false, now(), now(), now()
       )
       returning user_id, display_name, email, role_name, rank_label`,
      [userId, displayName, email, passwordHash],
    );
    await writeCompatibility(userId).catch(() => undefined);
    return rowToAuthenticatedUser(result.rows[0]!);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("email_already_registered");
    }
    throw error;
  }
}

async function findOAuthUser(client: PoolClient, provider: string, providerUserId: string): Promise<AuthenticatedUser | null> {
  const result = await client.query<{
    user_id: string;
    display_name: string;
    email: string | null;
    role_name: string | null;
    rank_label: string | null;
    banned: boolean | null;
  }>(
    `select u.user_id, u.display_name, u.email, u.role_name, u.rank_label, u.banned
     from oauth_accounts oa
     join users u on u.user_id = oa.user_id
     where oa.provider = $1 and oa.provider_user_id = $2
     limit 1`,
    [provider, providerUserId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  if (row.banned) {
    throw new Error("account_disabled");
  }
  return rowToAuthenticatedUser(row);
}

async function linkOAuthAccount(client: PoolClient, userId: string, profile: OAuthProfile): Promise<void> {
  await client.query(
    `insert into oauth_accounts (user_id, provider, provider_user_id, provider_email, profile_json, linked_at)
     values ($1, $2, $3, $4, $5::jsonb, now())
     on conflict (provider, provider_user_id) do update set
       user_id = excluded.user_id,
       provider_email = excluded.provider_email,
       profile_json = excluded.profile_json,
       linked_at = now()`,
    [userId, profile.provider, profile.providerUserId, profile.email, JSON.stringify(profile.rawProfile)],
  );
  await client.query(
    `update users
     set auth_provider = case when auth_provider is null or auth_provider = 'local' then $2 else auth_provider end,
         oauth_id = case when oauth_id is null or oauth_id = '' then $3 else oauth_id end,
         last_login_at = now(),
         updated_at = now()
     where user_id = $1`,
    [userId, profile.provider, profile.providerUserId],
  );
}

export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<AuthenticatedUser> {
  if (!profile.providerUserId.trim()) {
    throw new Error("oauth_profile_invalid");
  }

  const pool = getPool();
  const client = await pool.connect();
  let userIdForCompatibility: string | null = null;
  try {
    await client.query("begin");
    const oauthUser = await findOAuthUser(client, profile.provider, profile.providerUserId);
    if (oauthUser) {
      await client.query("update users set last_login_at = now(), updated_at = now() where user_id = $1", [oauthUser.userId]);
      await client.query("commit");
      userIdForCompatibility = oauthUser.userId;
      return oauthUser;
    }

    let userRow: AuthUserRow | undefined;
    const email = normalizeEmail(profile.email);
    if (email) {
      const byEmail = await client.query<AuthUserRow>(
        `select user_id, display_name, email, role_name, rank_label, banned
         from users
         where lower(email) = lower($1)
         limit 1`,
        [email],
      );
      userRow = byEmail.rows[0];
      if (userRow?.banned) {
        throw new Error("account_disabled");
      }
    }

    if (!userRow) {
      const newUserId = `user_${randomUUID()}`;
      const displayName = profile.name.trim() || "ikimon user";
      const inserted = await client.query<AuthUserRow>(
        `insert into users (
            user_id, legacy_user_id, display_name, email, password_hash,
            role_name, rank_label, auth_provider, oauth_id, banned, created_at, updated_at, last_login_at
         ) values (
            $1, $1, $2, $3, null, 'Observer', '観察者', $4, $5, false, now(), now(), now()
         )
         returning user_id, display_name, email, role_name, rank_label, banned`,
        [newUserId, displayName, email || null, profile.provider, profile.providerUserId],
      );
      userRow = inserted.rows[0];
    }

    await linkOAuthAccount(client, userRow!.user_id, profile);
    await client.query("commit");
    userIdForCompatibility = userRow!.user_id;
    return rowToAuthenticatedUser(userRow!);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    if (userIdForCompatibility) {
      await writeCompatibility(userIdForCompatibility).catch(() => undefined);
    }
  }
}
