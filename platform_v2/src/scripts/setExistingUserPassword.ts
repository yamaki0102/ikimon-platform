import { stdin } from "node:process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { readJsonArray, writeJsonAtomic } from "../legacy/legacyJsonStore.js";
import { normalizeEmail } from "../services/authSecurity.js";

type Options = {
  apply: boolean;
  userId: string;
  email: string;
  legacyDataRoot: string;
};

type TargetUser = {
  user_id: string;
  display_name: string;
  email: string | null;
  auth_provider: string | null;
  banned: boolean | null;
  has_password: boolean;
};

type LegacyUser = Record<string, unknown> & {
  id?: unknown;
  email?: unknown;
  password_hash?: unknown;
  auth_provider?: unknown;
};

function parseArgs(argv: string[]): Options {
  const config = loadConfig();
  const options: Options = {
    apply: false,
    userId: "",
    email: "",
    legacyDataRoot: config.legacyDataRoot,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }
    if (arg.startsWith("--user-id=")) {
      options.userId = arg.slice("--user-id=".length).trim();
      continue;
    }
    if (arg.startsWith("--email=")) {
      options.email = normalizeEmail(arg.slice("--email=".length));
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
    }
  }

  if (!options.userId && !options.email) {
    throw new Error("Provide --user-id=<id> or --email=<email>");
  }
  return options;
}

async function readPasswordFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

function publicUser(row: TargetUser | null) {
  return row
    ? {
        userId: row.user_id,
        displayName: row.display_name,
        email: row.email,
        authProvider: row.auth_provider,
        banned: Boolean(row.banned),
        hasPassword: row.has_password,
      }
    : null;
}

async function findTarget(options: Options): Promise<TargetUser | null> {
  const pool = getPool();
  const result = await pool.query<TargetUser>(
    `select user_id, display_name, email, auth_provider, banned,
            (password_hash is not null and password_hash <> '') as has_password
       from users
      where ($1 <> '' and user_id = $1)
         or ($2 <> '' and lower(email) = lower($2))
      order by case when user_id = $1 then 0 else 1 end
      limit 1`,
    [options.userId, options.email],
  );
  return result.rows[0] ?? null;
}

async function updateLegacyPassword(options: Options, target: TargetUser, passwordHash: string): Promise<number> {
  const usersPath = path.join(options.legacyDataRoot, "users.json");
  const users = await readJsonArray<LegacyUser>(usersPath);
  let updated = 0;
  const nextUsers = users.map((user) => {
    if (user.id !== target.user_id) {
      return user;
    }
    updated += 1;
    return {
      ...user,
      email: typeof user.email === "string" && user.email.trim() ? user.email : target.email,
      auth_provider: typeof user.auth_provider === "string" && user.auth_provider.trim() ? user.auth_provider : "local",
      password_hash: passwordHash,
    };
  });

  if (updated > 0) {
    await writeJsonAtomic(usersPath, nextUsers);
  }
  return updated;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const target = await findTarget(options);
  if (!target) {
    throw new Error("target_user_not_found");
  }

  const summary = {
    dryRun: !options.apply,
    target: publicUser(target),
    legacyDataRoot: options.legacyDataRoot,
    updates: {
      databasePasswordHash: options.apply ? 1 : target.has_password ? 0 : 1,
      legacyUsersJson: 0,
    },
  };

  if (!options.apply) {
    console.log(JSON.stringify(summary, null, 2));
    await getPool().end();
    return;
  }

  const password = await readPasswordFromStdin();
  if (password.length < 8) {
    throw new Error("password_too_short");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = getPool();
  await pool.query(
    `update users
        set password_hash = $2,
            auth_provider = case when auth_provider is null or auth_provider = '' then 'local' else auth_provider end,
            updated_at = now()
      where user_id = $1`,
    [target.user_id, passwordHash],
  );

  const legacyUpdated = await updateLegacyPassword(options, target, passwordHash);
  const after = await findTarget({ ...options, userId: target.user_id, email: "" });
  console.log(JSON.stringify({
    ...summary,
    dryRun: false,
    targetAfter: publicUser(after),
    updates: {
      databasePasswordHash: 1,
      legacyUsersJson: legacyUpdated,
    },
  }, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
