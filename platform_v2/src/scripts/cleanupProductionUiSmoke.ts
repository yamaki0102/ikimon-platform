import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";

type CleanupOptions = {
  fixturePrefix: string;
  dryRun: boolean;
};

type CleanupSummary = {
  fixturePrefix: string;
  dryRun: boolean;
  matched: Record<string, number>;
  deleted: Record<string, number>;
  storagePaths: string[];
  cloudflare: Array<{ uid: string; status: number | "skipped"; error?: string }>;
  legacyJsonRemoved: number;
};

const SAFE_PREFIX_RE = /^smoke-ui-[A-Za-z0-9-]{6,96}$/;

function parseArgs(argv: string[]): CleanupOptions {
  let fixturePrefix = "";
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--fixture-prefix=")) {
      fixturePrefix = arg.slice("--fixture-prefix=".length).trim();
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  if (!SAFE_PREFIX_RE.test(fixturePrefix)) {
    throw new Error("fixture_prefix_must_match_smoke_ui_pattern");
  }
  return { fixturePrefix, dryRun };
}

function safeUploadPath(legacyPublicRoot: string, storagePath: string): string {
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(legacyPublicRoot, ...normalized.split("/"));
  const uploadsRoot = path.resolve(legacyPublicRoot, "uploads", "v2-observations");
  if (!absolute.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error(`unsafe_upload_cleanup_path:${storagePath}`);
  }
  return absolute;
}

function isLocalObservationUploadPath(storagePath: string): boolean {
  return storagePath.replace(/\\/g, "/").replace(/^\/+/, "").startsWith("uploads/v2-observations/");
}

async function deleteCloudflareVideo(uid: string): Promise<{ uid: string; status: number | "skipped"; error?: string }> {
  const cfg = loadConfig().cloudflare;
  if (!cfg) return { uid, status: "skipped", error: "cloudflare_config_missing" };
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/stream/${encodeURIComponent(uid)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cfg.streamApiToken}` },
      },
    );
    if (!response.ok && response.status !== 404) {
      return { uid, status: response.status, error: `cloudflare_delete_failed:${response.status}` };
    }
    return { uid, status: response.status };
  } catch (error) {
    return { uid, status: "skipped", error: error instanceof Error ? error.message : "cloudflare_delete_failed" };
  }
}

async function deleteCount(client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>, sql: string, params: unknown[]): Promise<number> {
  const result = await client.query<{ c: string }>(
    `with deleted_rows as (${sql} returning 1) select count(*)::text as c from deleted_rows`,
    params,
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function removeLegacyJson(fixturePrefix: string): Promise<number> {
  const config = loadConfig();
  const observed = new Date();
  const fileName = `${observed.getFullYear()}-${String(observed.getMonth() + 1).padStart(2, "0")}.json`;
  const filePath = path.join(config.legacyDataRoot, "observations", fileName);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf8")));
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed)) return 0;
  const next = parsed.filter((row) => !JSON.stringify(row).includes(fixturePrefix));
  const removed = parsed.length - next.length;
  if (removed > 0) {
    await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  return removed;
}

async function cleanupProductionUiSmoke(options: CleanupOptions): Promise<CleanupSummary> {
  const pool = getPool();
  const client = await pool.connect();
  const config = loadConfig();
  const matched: Record<string, number> = {};
  const deleted: Record<string, number> = {};
  const prefixLike = `${options.fixturePrefix}-%@example.invalid`;
  const exactEmail = `${options.fixturePrefix}@example.invalid`;
  let storagePaths: string[] = [];
  let streamUids: string[] = [];

  try {
    const users = await client.query<{ user_id: string }>(
      `select user_id
         from users
        where email = $1
           or email like $2
           or display_name = $3
           or display_name like $4`,
      [exactEmail, prefixLike, `候補UIスモーク ${options.fixturePrefix}`, `候補UIスモーク ${options.fixturePrefix}-%`],
    );
    const userIds = users.rows.map((row) => row.user_id);
    matched.users = userIds.length;

    const visits = await client.query<{ visit_id: string; place_id: string | null }>(
      `select distinct visit_id, place_id
         from visits
        where ($1::text[] <> '{}'::text[] and user_id = any($1::text[]))
           or source_payload::text like $2
           or locality_note like $3
           or note like $3`,
      [userIds, `%${options.fixturePrefix}%`, `%${options.fixturePrefix}%`],
    );
    const visitIds = visits.rows.map((row) => row.visit_id);
    const placeIds = [...new Set(visits.rows.map((row) => row.place_id).filter((value): value is string => Boolean(value)))];
    matched.visits = visitIds.length;

    const occurrences = await client.query<{ occurrence_id: string }>(
      `select occurrence_id from occurrences where visit_id = any($1::text[]) or source_payload::text like $2`,
      [visitIds, `%${options.fixturePrefix}%`],
    );
    const occurrenceIds = occurrences.rows.map((row) => row.occurrence_id);
    matched.occurrences = occurrenceIds.length;

    const assets = await client.query<{ asset_id: string; blob_id: string | null; legacy_relative_path: string | null; storage_path: string | null }>(
      `select ea.asset_id::text, ea.blob_id::text, ea.legacy_relative_path, ab.storage_path
         from evidence_assets ea
         left join asset_blobs ab on ab.blob_id = ea.blob_id
        where ea.visit_id = any($1::text[])
           or ea.occurrence_id = any($2::text[])`,
      [visitIds, occurrenceIds],
    );
    const assetIds = assets.rows.map((row) => row.asset_id);
    const blobIds = [...new Set(assets.rows.map((row) => row.blob_id).filter((value): value is string => Boolean(value)))];
    storagePaths = [...new Set(assets.rows.flatMap((row) => [row.legacy_relative_path, row.storage_path].filter((value): value is string => Boolean(value))))];
    matched.assets = assetIds.length;
    matched.blobs = blobIds.length;
    matched.files = storagePaths.filter(isLocalObservationUploadPath).length;

    const videos = await client.query<{ stream_uid: string }>(
      `select distinct stream_uid
         from video_upload_requests
        where ($1::text[] <> '{}'::text[] and actor_id = any($1::text[]))
           or observation_id = any($2::text[])
           or observation_id = any($3::text[])
           or meta::text like $4`,
      [userIds, visitIds, occurrenceIds, `%${options.fixturePrefix}%`],
    );
    streamUids = videos.rows.map((row) => row.stream_uid).filter(Boolean);
    matched.videos = streamUids.length;

    if (!options.dryRun) {
      await client.query("begin");
      try {
        deleted.mediaJobs = await deleteCount(
          client,
          `delete from media_processing_jobs
            where observation_id = any($1::text[])
               or occurrence_id = any($2::text[])
               or source_payload::text like $3`,
          [visitIds, occurrenceIds, `%${options.fixturePrefix}%`],
        );
        deleted.videoRequests = await deleteCount(
          client,
          `delete from video_upload_requests
            where stream_uid = any($1::text[])
               or actor_id = any($2::text[])
               or observation_id = any($3::text[])
               or observation_id = any($4::text[])`,
          [streamUids, userIds, visitIds, occurrenceIds],
        );
        deleted.idempotency = await deleteCount(
          client,
          `delete from observation_write_idempotency
            where user_id = any($1::text[])
               or visit_id = any($2::text[])`,
          [userIds, visitIds],
        );
        deleted.compatibilityLedger = await deleteCount(
          client,
          `delete from compatibility_write_ledger
            where canonical_id = any($1::text[])
               or details::text like $2`,
          [visitIds, `%${options.fixturePrefix}%`],
        );
        deleted.rememberTokens = await deleteCount(client, `delete from remember_tokens where user_id = any($1::text[])`, [userIds]);
        deleted.identifications = await deleteCount(
          client,
          `delete from identifications
            where occurrence_id = any($1::text[])
               or actor_user_id = any($2::text[])`,
          [occurrenceIds, userIds],
        );
        deleted.reactions = await deleteCount(
          client,
          `delete from observation_reactions
            where occurrence_id = any($1::text[])
               or user_id = any($2::text[])`,
          [occurrenceIds, userIds],
        );
        deleted.assets = await deleteCount(client, `delete from evidence_assets where asset_id = any($1::uuid[])`, [assetIds]);
        deleted.visits = await deleteCount(client, `delete from visits where visit_id = any($1::text[])`, [visitIds]);
        deleted.blobs = await deleteCount(
          client,
          `delete from asset_blobs ab
            where ab.blob_id = any($1::uuid[])
              and not exists (select 1 from evidence_assets ea where ea.blob_id = ab.blob_id)`,
          [blobIds],
        );
        deleted.users = await deleteCount(client, `delete from users where user_id = any($1::text[])`, [userIds]);
        deleted.places = await deleteCount(
          client,
          `delete from places p
            where p.place_id = any($1::text[])
              and not exists (select 1 from visits v where v.place_id = p.place_id)`,
          [placeIds],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
  }

  let deletedFiles = 0;
  if (!options.dryRun) {
    for (const storagePath of storagePaths.filter(isLocalObservationUploadPath)) {
      await rm(safeUploadPath(config.legacyPublicRoot, storagePath), { force: true });
      deletedFiles += 1;
    }
  }
  deleted.files = deletedFiles;

  const cloudflare = options.dryRun ? streamUids.map((uid) => ({ uid, status: "skipped" as const, error: "dry_run" })) : await Promise.all(streamUids.map(deleteCloudflareVideo));
  const legacyJsonRemoved = options.dryRun ? 0 : await removeLegacyJson(options.fixturePrefix);
  return {
    fixturePrefix: options.fixturePrefix,
    dryRun: options.dryRun,
    matched,
    deleted,
    storagePaths,
    cloudflare,
    legacyJsonRemoved,
  };
}

async function main(): Promise<void> {
  const summary = await cleanupProductionUiSmoke(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
