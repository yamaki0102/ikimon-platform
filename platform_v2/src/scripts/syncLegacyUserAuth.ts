import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";
import { readJsonArray } from "../legacy/legacyJsonStore.js";

type LegacyUser = {
  id?: unknown;
  email?: unknown;
  password_hash?: unknown;
  auth_provider?: unknown;
  oauth_id?: unknown;
};

type Options = {
  legacyDataRoot: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Options {
  const roots = resolveLegacyRoots(process.cwd(), {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
  });
  const options: Options = {
    legacyDataRoot: roots.legacyDataRoot,
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
    }
  }
  return options;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const usersPath = path.join(options.legacyDataRoot, "users.json");
  const legacyUsers = await readJsonArray<LegacyUser>(usersPath);
  const candidates = legacyUsers
    .map((user) => ({
      userId: asString(user.id),
      email: asString(user.email).toLowerCase(),
      passwordHash: asString(user.password_hash),
      authProvider: asString(user.auth_provider),
      oauthId: asString(user.oauth_id),
    }))
    .filter((user) => user.userId && (user.passwordHash || (user.authProvider && user.oauthId)));

  const summary = {
    usersPath,
    legacyUsers: legacyUsers.length,
    candidates: candidates.length,
    passwordHashesPlanned: candidates.filter((user) => user.passwordHash).length,
    oauthLinksPlanned: candidates.filter((user) => user.authProvider && user.oauthId).length,
    passwordHashesUpdated: 0,
    oauthLinksUpserted: 0,
    missingUsers: 0,
    dryRun: options.dryRun,
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const pool = getPool();
  for (const user of candidates) {
    const exists = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from users where user_id = $1) as exists",
      [user.userId],
    );
    if (!exists.rows[0]?.exists) {
      summary.missingUsers += 1;
      continue;
    }
    if (user.passwordHash) {
      const result = await pool.query<{ user_id: string }>(
        `update users
         set password_hash = $2,
             email = coalesce(nullif(email, ''), nullif($3, '')),
             updated_at = now()
         where user_id = $1
           and (password_hash is null or password_hash = '')
         returning user_id`,
        [user.userId, user.passwordHash, user.email],
      );
      summary.passwordHashesUpdated += result.rows.length;
    }
    if (user.authProvider && user.oauthId && user.authProvider !== "local") {
      await pool.query(
        `insert into oauth_accounts (user_id, provider, provider_user_id, provider_email, profile_json, linked_at)
         values ($1, $2, $3, nullif($4, ''), '{}'::jsonb, now())
         on conflict (provider, provider_user_id) do update set
           user_id = excluded.user_id,
           provider_email = coalesce(excluded.provider_email, oauth_accounts.provider_email),
           linked_at = now()`,
        [user.userId, user.authProvider, user.oauthId, user.email],
      );
      await pool.query(
        `update users
         set auth_provider = case when auth_provider is null or auth_provider = 'local' then $2 else auth_provider end,
             oauth_id = case when oauth_id is null or oauth_id = '' then $3 else oauth_id end,
             updated_at = now()
         where user_id = $1`,
        [user.userId, user.authProvider, user.oauthId],
      );
      summary.oauthLinksUpserted += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
