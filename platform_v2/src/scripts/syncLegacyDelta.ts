import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

type SyncOptions = {
  legacyDataRoot: string;
  uploadsRoot: string;
  publicRoot?: string;
  importVersion?: string;
  force: boolean;
  sourceName: string;
};

type WatchFile = {
  filePath: string;
  mtimeMs: number;
};

function parseArgs(argv: string[]): SyncOptions {
  const resolvedRoots = resolveLegacyRoots(process.cwd(), {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: SyncOptions = {
    legacyDataRoot: resolvedRoots.legacyDataRoot,
    uploadsRoot: resolvedRoots.uploadsRoot,
    publicRoot: resolvedRoots.publicRoot,
    force: false,
    sourceName: "legacy_fs",
  };

  for (const arg of argv) {
    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }

    if (arg.startsWith("--uploads-root=")) {
      options.uploadsRoot = path.resolve(arg.slice("--uploads-root=".length));
      continue;
    }

    if (arg.startsWith("--public-root=")) {
      options.publicRoot = path.resolve(arg.slice("--public-root=".length));
      continue;
    }

    if (arg.startsWith("--mirror-root=")) {
      const mirrorRoots = resolveLegacyRoots(process.cwd(), {
        mirrorRoot: arg.slice("--mirror-root=".length),
      });
      options.legacyDataRoot = mirrorRoots.legacyDataRoot;
      options.uploadsRoot = mirrorRoots.uploadsRoot;
      options.publicRoot = mirrorRoots.publicRoot;
      continue;
    }

    if (arg.startsWith("--source-name=")) {
      options.sourceName = arg.slice("--source-name=".length);
      continue;
    }

    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || undefined;
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

async function gatherWatchFiles(options: SyncOptions): Promise<WatchFile[]> {
  const files: WatchFile[] = [];
  const directFiles = [
    path.join(options.legacyDataRoot, "users.json"),
    path.join(options.legacyDataRoot, "auth_tokens.json"),
    path.join(options.legacyDataRoot, "invites.json"),
    path.join(options.legacyDataRoot, "observations.json"),
  ];

  for (const filePath of directFiles) {
    if (!(await exists(filePath))) {
      continue;
    }

    const fileStat = await stat(filePath);
    files.push({ filePath, mtimeMs: fileStat.mtimeMs });
  }

  const observationsDir = path.join(options.legacyDataRoot, "observations");
  if (await exists(observationsDir)) {
    for (const name of await readdir(observationsDir)) {
      if (!name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(observationsDir, name);
      const fileStat = await stat(filePath);
      files.push({ filePath, mtimeMs: fileStat.mtimeMs });
    }
  }

  const tracksDir = path.join(options.legacyDataRoot, "tracks");
  if (await exists(tracksDir)) {
    for (const userDir of await readdir(tracksDir)) {
      const userRoot = path.join(tracksDir, userDir);
      const userStat = await stat(userRoot);
      if (!userStat.isDirectory()) {
        continue;
      }

      for (const name of await readdir(userRoot)) {
        if (!name.endsWith(".json")) {
          continue;
        }

        const filePath = path.join(userRoot, name);
        const fileStat = await stat(filePath);
        files.push({ filePath, mtimeMs: fileStat.mtimeMs });
      }
    }
  }

  return files.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

async function getCursorValue(sourceName: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ cursor_value: string | null }>(
    `select cursor_value
     from sync_cursors
     where source_name = $1`,
    [sourceName],
  );

  return Number(result.rows[0]?.cursor_value ?? 0);
}

async function createRun(sourceName: string, cursorValue: string | null, details: Record<string, unknown>) {
  const pool = getPool();
  const result = await pool.query<{ migration_run_id: string }>(
    `insert into migration_runs (
        run_type, source_name, status, cursor_value, details
     ) values (
        'delta_sync', $1, 'running', $2, $3::jsonb
     )
     returning migration_run_id`,
    [sourceName, cursorValue, JSON.stringify(details)],
  );

  return result.rows[0]?.migration_run_id ?? null;
}

async function finishRun(
  migrationRunId: string | null,
  status: string,
  stats: {
    rowsSeen?: number;
    rowsImported?: number;
    rowsSkipped?: number;
    rowsFailed?: number;
    cursorValue?: string | null;
    details?: Record<string, unknown>;
  },
) {
  if (!migrationRunId) {
    return;
  }

  const pool = getPool();
  await pool.query(
    `update migration_runs
     set status = $2,
         finished_at = now(),
         rows_seen = $3,
         rows_imported = $4,
         rows_skipped = $5,
         rows_failed = $6,
         cursor_value = $7,
         details = $8::jsonb
     where migration_run_id = $1`,
    [
      migrationRunId,
      status,
      stats.rowsSeen ?? 0,
      stats.rowsImported ?? 0,
      stats.rowsSkipped ?? 0,
      stats.rowsFailed ?? 0,
      stats.cursorValue ?? null,
      JSON.stringify(stats.details ?? {}),
    ],
  );
}

async function upsertCursor(sourceName: string, cursorValue: number, metadata: Record<string, unknown>) {
  const pool = getPool();
  await pool.query(
    `insert into sync_cursors (
        source_name, cursor_kind, cursor_value, updated_at, metadata
     ) values (
        $1, 'mtime_ms', $2, now(), $3::jsonb
     )
     on conflict (source_name) do update set
        cursor_kind = excluded.cursor_kind,
        cursor_value = excluded.cursor_value,
        updated_at = now(),
        metadata = excluded.metadata`,
    [sourceName, String(cursorValue), JSON.stringify(metadata)],
  );
}

function runImporter(options: SyncOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "run",
      "import:legacy",
      "--",
      `--legacy-data-root=${options.legacyDataRoot}`,
      `--uploads-root=${options.uploadsRoot}`,
    ];

    if (process.env.LEGACY_MIRROR_ROOT) {
      args.push(`--mirror-root=${process.env.LEGACY_MIRROR_ROOT}`);
    }

    if (options.publicRoot) {
      args.push(`--public-root=${options.publicRoot}`);
    }
    if (options.importVersion) {
      args.push(`--import-version=${options.importVersion}`);
    }

    const child = spawn("npm", args, {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`import:legacy exited with code ${code ?? -1}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const watchFiles = await gatherWatchFiles(options);
  const rowsSeen = watchFiles.length;
  const latestMtimeMs = watchFiles.reduce((max, file) => Math.max(max, file.mtimeMs), 0);
  const previousCursor = await getCursorValue(options.sourceName);
  const changedFiles = options.force
    ? watchFiles
    : watchFiles.filter((file) => file.mtimeMs > previousCursor);

  const migrationRunId = await createRun(options.sourceName, previousCursor > 0 ? String(previousCursor) : null, {
    force: options.force,
    rowsSeen,
    changedFilesPreview: changedFiles.slice(0, 20).map((file) => file.filePath),
  });

  if (changedFiles.length === 0) {
    await finishRun(migrationRunId, "skipped", {
      rowsSeen,
      rowsSkipped: rowsSeen,
      cursorValue: String(previousCursor),
      details: {
        reason: "no_changed_files",
      },
    });
    console.log(
      JSON.stringify(
        {
          sourceName: options.sourceName,
          status: "skipped",
          previousCursor,
          latestMtimeMs,
          changedFiles: 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    await runImporter(options);
    const nextCursor = Math.max(previousCursor, latestMtimeMs);
    await upsertCursor(options.sourceName, nextCursor, {
      changedFiles: changedFiles.length,
      latestMtimeMs,
    });
    await finishRun(migrationRunId, "succeeded", {
      rowsSeen,
      rowsImported: changedFiles.length,
      cursorValue: String(nextCursor),
      details: {
        changedFiles: changedFiles.length,
      },
    });
    console.log(
      JSON.stringify(
        {
          sourceName: options.sourceName,
          status: "succeeded",
          previousCursor,
          nextCursor,
          changedFiles: changedFiles.length,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await finishRun(migrationRunId, "failed", {
      rowsSeen,
      rowsFailed: changedFiles.length,
      cursorValue: String(previousCursor),
      details: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  } finally {
    await getPool().end();
  }
}

void main();
