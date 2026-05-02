import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

type JsonRecord = Record<string, unknown>;

type ImportOptions = {
  legacyDataRoot: string;
  dryRun: boolean;
  limit: number | null;
  importVersion: string;
};

type LegacyAuthToken = JsonRecord & {
  user_id?: string;
  token_hash?: string;
  expires?: number | string;
  created_at?: string;
  ip?: string;
};

type ImportSummary = {
  tokensRead: number;
  tokensPlanned: number;
  tokensImported: number;
  tokensSkipped: number;
  tokensAlreadyImported: number;
  missingUsers: number;
};

function parseArgs(argv: string[]): ImportOptions {
  const projectRoot = process.cwd();
  const legacyRoots = resolveLegacyRoots(projectRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
  });
  const options: ImportOptions = {
    legacyDataRoot: legacyRoots.legacyDataRoot,
    dryRun: false,
    limit: null,
    importVersion: "v0-plan",
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      continue;
    }
    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || options.importVersion;
    }
  }

  return options;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) {
    return fallback;
  }
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeIp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function loadLegacyAuthTokens(options: ImportOptions): Promise<LegacyAuthToken[]> {
  const tokens = await readJsonFile<LegacyAuthToken[]>(path.join(options.legacyDataRoot, "auth_tokens.json"), []);
  const sorted = tokens
    .filter((token) => typeof token.user_id === "string" && token.user_id !== "" && typeof token.token_hash === "string" && token.token_hash !== "")
    .sort((left, right) => {
      const leftCreated = toIsoTimestamp(left.created_at ?? left.expires) ?? "";
      const rightCreated = toIsoTimestamp(right.created_at ?? right.expires) ?? "";
      if (leftCreated === rightCreated) {
        return String(left.user_id).localeCompare(String(right.user_id));
      }
      return leftCreated.localeCompare(rightCreated);
    });
  return options.limit === null ? sorted : sorted.slice(0, options.limit);
}

async function ensureDatabaseReady(): Promise<void> {
  await getPool().query("select 1");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const tokens = await loadLegacyAuthTokens(options);
  const summary: ImportSummary = {
    tokensRead: tokens.length,
    tokensPlanned: tokens.length,
    tokensImported: 0,
    tokensSkipped: 0,
    tokensAlreadyImported: 0,
    missingUsers: 0,
  };

  if (options.dryRun) {
    console.log(JSON.stringify({ options, summary }, null, 2));
    return;
  }

  await ensureDatabaseReady();
  const pool = getPool();
  const existingLedger = await pool.query<{
    legacy_id: string;
    import_status: string;
  }>(
    `select legacy_id, import_status
     from migration_ledger
     where entity_type = 'remember_token'
       and legacy_source = 'php_json'
       and import_version = $1`,
    [options.importVersion],
  );
  const completedLedger = new Set<string>();
  for (const row of existingLedger.rows) {
    if (row.import_status === "imported" || row.import_status === "skipped") {
      completedLedger.add(row.legacy_id);
    }
  }

  for (const token of tokens) {
    const userId = typeof token.user_id === "string" ? token.user_id : "";
    const tokenHash = typeof token.token_hash === "string" ? token.token_hash : "";
    const ledgerKey = tokenHash;
    if (completedLedger.has(ledgerKey)) {
      summary.tokensAlreadyImported += 1;
      continue;
    }

    const userExistsResult = await pool.query<{ exists: boolean }>(
      `select exists(select 1 from users where user_id = $1) as exists`,
      [userId],
    );
    const userExists = Boolean(userExistsResult.rows[0]?.exists);
    if (!userExists) {
      summary.missingUsers += 1;
      summary.tokensSkipped += 1;
      await pool.query(
        `insert into migration_ledger (
            migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
            canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
            import_status, skipped_reason, import_version, metadata
         ) values (
            gen_random_uuid(), 'remember_token', 'php_json', 'auth_token', $1,
            'remember_token', null, 'user', $2,
            'skipped', 'missing_required_fields', $3, $4::jsonb
         )
         on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
            import_status = excluded.import_status,
            skipped_reason = excluded.skipped_reason,
            canonical_parent_type = excluded.canonical_parent_type,
            canonical_parent_id = excluded.canonical_parent_id,
            metadata = excluded.metadata`,
        [
          ledgerKey,
          userId,
          options.importVersion,
          JSON.stringify({ importer: "importRememberTokens", reason: "missing_user" }),
        ],
      );
      continue;
    }

    const result = await pool.query<{ remember_token_id: string }>(
      `insert into remember_tokens (
          user_id, token_hash, token_family, user_agent, ip_address, expires_at, created_at
       ) values (
          $1, $2, 'legacy', null, $3::inet, $4, $5
       )
       on conflict (token_hash) do update set
          user_id = excluded.user_id,
          ip_address = excluded.ip_address,
          expires_at = excluded.expires_at,
          created_at = excluded.created_at
       returning remember_token_id`,
      [
        userId,
        tokenHash,
        normalizeIp(token.ip),
        toIsoTimestamp(token.expires) ?? new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
        toIsoTimestamp(token.created_at) ?? new Date().toISOString(),
      ],
    );

    const rememberTokenId = result.rows[0]?.remember_token_id ?? null;
    await pool.query(
      `insert into migration_ledger (
          migration_ledger_id, entity_type, legacy_source, legacy_entity_type, legacy_id,
          canonical_entity_type, canonical_id, canonical_parent_type, canonical_parent_id,
          import_status, skipped_reason, import_version, metadata
       ) values (
          gen_random_uuid(), 'remember_token', 'php_json', 'auth_token', $1,
          'remember_token', $2, 'user', $3,
          'imported', null, $4, $5::jsonb
       )
       on conflict (legacy_source, legacy_entity_type, legacy_id, import_version) do update set
          canonical_entity_type = excluded.canonical_entity_type,
          canonical_id = excluded.canonical_id,
          canonical_parent_type = excluded.canonical_parent_type,
          canonical_parent_id = excluded.canonical_parent_id,
          import_status = excluded.import_status,
          skipped_reason = excluded.skipped_reason,
          metadata = excluded.metadata`,
      [
        ledgerKey,
        rememberTokenId,
        userId,
        options.importVersion,
        JSON.stringify({ importer: "importRememberTokens" }),
      ],
    );

    summary.tokensImported += 1;
  }

  console.log(JSON.stringify({ options, summary }, null, 2));
  await pool.end();
}

void main();
