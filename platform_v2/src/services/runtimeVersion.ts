import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type RuntimeVersionSnapshot = {
  gitSha: string;
  builtAt: string;
  migrationHead: string | null;
  schemaVersion: "monitoring_package/v1.1" | "monitoring_package/v1.2";
  featureFlags: Record<string, boolean>;
  runtimeEnv: string;
};

function fallbackGitSha(): string {
  const envSha = process.env.GITHUB_SHA?.trim() || process.env.IKIMON_GIT_SHA?.trim();
  if (envSha) return envSha;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: path.resolve(process.cwd(), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function builtAt(): string {
  const raw = process.env.IKIMON_BUILT_AT?.trim() || process.env.BUILD_TIME?.trim();
  if (raw) return raw;
  return "unknown";
}

export async function getMigrationHead(queryable?: Queryable): Promise<string | null> {
  try {
    const db = queryable ?? getPool();
    const present = await db.query<{ present: boolean }>(
      `select to_regclass('public.schema_migrations') is not null as present`,
    );
    if (!present.rows[0]?.present) return null;
    const result = await db.query<{ filename: string }>(
      `select filename
         from schema_migrations
        order by filename desc
        limit 1`,
    );
    return result.rows[0]?.filename ?? null;
  } catch {
    return null;
  }
}

export async function getRuntimeVersionSnapshot(
  queryable?: Queryable,
): Promise<RuntimeVersionSnapshot> {
  const config = loadConfig();
  return {
    gitSha: fallbackGitSha(),
    builtAt: builtAt(),
    migrationHead: await getMigrationHead(queryable),
    schemaVersion: "monitoring_package/v1.2",
    featureFlags: {
      monitoringPackageV11: true,
      monitoringPackageV12: true,
      waterRecordExtensionV0: true,
      observationDataRightsV0: true,
      readinessGatesV0: true,
      observationDataProductChainV0: true,
      fieldScanContextV0: true,
      governanceContextV0: true,
    },
    runtimeEnv: config.nodeEnv,
  };
}
