import { getPool } from "../db.js";

type ReportOptions = {
  history: number;
  staleHours: number;
  json: boolean;
};

type MigrationRunRow = {
  migration_run_id: string;
  run_type: string;
  source_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_seen: string;
  rows_imported: string;
  rows_skipped: string;
  rows_failed: string;
  details: Record<string, unknown> | null;
};

type SyncCursorRow = {
  source_name: string;
  cursor_kind: string;
  cursor_value: string | null;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

type NormalizedVerifyRun = {
  migrationRunId: string;
  importVersion: string | null;
  limit: number | null;
  status: string;
  mismatchCount: number;
  startedAt: string;
  finishedAt: string | null;
  rowsSeen: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsFailed: number;
};

function parseArgs(argv: string[]): ReportOptions {
  const options: ReportOptions = {
    history: 5,
    staleHours: 24,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--history=")) {
      const parsed = Number.parseInt(arg.slice("--history=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.history = parsed;
      }
      continue;
    }
    if (arg.startsWith("--stale-hours=")) {
      const parsed = Number.parseInt(arg.slice("--stale-hours=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.staleHours = parsed;
      }
    }
  }

  return options;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function hoursSince(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return (Date.now() - timestamp.getTime()) / 3_600_000;
}

function normalizeVerifyRun(row: MigrationRunRow): NormalizedVerifyRun {
  const details = row.details ?? {};
  const report = (details.report ?? null) as Record<string, unknown> | null;
  const options = report?.options as Record<string, unknown> | undefined;
  const mismatches = Array.isArray(details.mismatches) ? details.mismatches : [];

  return {
    migrationRunId: row.migration_run_id,
    importVersion:
      typeof options?.importVersion === "string"
        ? options.importVersion
        : typeof details.import_version === "string"
          ? details.import_version
          : null,
    limit: typeof options?.limit === "number" ? options.limit : null,
    status: row.status,
    mismatchCount: mismatches.length,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rowsSeen: toNumber(row.rows_seen),
    rowsImported: toNumber(row.rows_imported),
    rowsSkipped: toNumber(row.rows_skipped),
    rowsFailed: toNumber(row.rows_failed),
  };
}

async function createReportRun(options: ReportOptions): Promise<string> {
  const result = await getPool().query<{ migration_run_id: string }>(
    `insert into migration_runs (
        run_type, source_name, status, details
     ) values (
        'legacy_drift_report', 'legacy_fs', 'running', $1::jsonb
     )
     returning migration_run_id`,
    [JSON.stringify({ reporter: "reportLegacyDrift", history: options.history, stale_hours: options.staleHours })],
  );

  const runId = result.rows[0]?.migration_run_id;
  if (!runId) {
    throw new Error("Failed to create legacy drift report run.");
  }
  return runId;
}

async function finalizeReportRun(
  runId: string,
  status: "succeeded" | "failed",
  rowsSeen: number,
  rowsFailed: number,
  details: unknown,
): Promise<void> {
  await getPool().query(
    `update migration_runs
     set status = $2,
         finished_at = now(),
         rows_seen = $3,
         rows_imported = $4,
         rows_failed = $5,
         details = $6::jsonb
     where migration_run_id = $1`,
    [runId, status, rowsSeen, Math.max(rowsSeen - rowsFailed, 0), rowsFailed, JSON.stringify(details)],
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();
  const runId = await createReportRun(options);

  try {
    const verifyRunsResult = await pool.query<MigrationRunRow>(
      `select
          migration_run_id,
          run_type,
          source_name,
          status,
          started_at::text,
          finished_at::text,
          rows_seen::text,
          rows_imported::text,
          rows_skipped::text,
          rows_failed::text,
          details
       from migration_runs
       where run_type = 'verify_legacy_parity'
       order by started_at desc
       limit $1`,
      [options.history],
    );

    const deltaRunsResult = await pool.query<MigrationRunRow>(
      `select
          migration_run_id,
          run_type,
          source_name,
          status,
          started_at::text,
          finished_at::text,
          rows_seen::text,
          rows_imported::text,
          rows_skipped::text,
          rows_failed::text,
          details
       from migration_runs
       where run_type = 'delta_sync'
       order by started_at desc
       limit $1`,
      [options.history],
    );

    const cursorResult = await pool.query<SyncCursorRow>(
      `select source_name, cursor_kind, cursor_value, updated_at::text, metadata
       from sync_cursors
       order by updated_at desc
       limit $1`,
      [options.history],
    );

    const normalizedVerifyRuns = verifyRunsResult.rows.map(normalizeVerifyRun);
    const latestVerify = normalizedVerifyRuns[0] ?? null;
    const latestDelta = deltaRunsResult.rows[0] ?? null;
    const latestCursor = cursorResult.rows[0] ?? null;

    const latestVerifyAgeHours = hoursSince(latestVerify?.finishedAt ?? latestVerify?.startedAt ?? null);
    const latestDeltaAgeHours = hoursSince(latestDelta?.finished_at ?? latestDelta?.started_at ?? null);
    const latestCursorAgeHours = hoursSince(latestCursor?.updated_at ?? null);

    const parityClean = latestVerify !== null && latestVerify.status === "succeeded" && latestVerify.mismatchCount === 0;
    const verifyFresh = latestVerifyAgeHours !== null && latestVerifyAgeHours <= options.staleHours;
    const deltaHealthy = latestDelta !== null && (latestDelta.status === "succeeded" || latestDelta.status === "skipped");
    const deltaFresh = latestDeltaAgeHours !== null && latestDeltaAgeHours <= options.staleHours;
    const cursorFresh = latestCursorAgeHours !== null && latestCursorAgeHours <= options.staleHours;

    let healthStatus = "healthy";
    if (!latestVerify) {
      healthStatus = "missing_verify";
    } else if (!parityClean) {
      healthStatus = "drift_detected";
    } else if (!verifyFresh) {
      healthStatus = "stale_verify";
    } else if (!latestDelta) {
      healthStatus = "missing_delta_sync";
    } else if (!deltaHealthy) {
      healthStatus = "delta_sync_failed";
    } else if (!deltaFresh) {
      healthStatus = "stale_delta_sync";
    } else if (!cursorFresh) {
      healthStatus = "stale_sync_cursor";
    }

    const summary = {
      status: healthStatus,
      staleHours: options.staleHours,
      parityClean,
      verifyFresh,
      deltaHealthy,
      deltaFresh,
      cursorFresh,
      latestImportVersion: latestVerify?.importVersion ?? null,
      latestVerifyAgeHours,
      latestDeltaAgeHours,
      latestCursorAgeHours,
    };

    const report = {
      summary,
      latestVerify,
      latestDeltaSync: latestDelta
        ? {
            migrationRunId: latestDelta.migration_run_id,
            status: latestDelta.status,
            startedAt: latestDelta.started_at,
            finishedAt: latestDelta.finished_at,
            rowsSeen: toNumber(latestDelta.rows_seen),
            rowsImported: toNumber(latestDelta.rows_imported),
            rowsSkipped: toNumber(latestDelta.rows_skipped),
            rowsFailed: toNumber(latestDelta.rows_failed),
          }
        : null,
      latestCursor: latestCursor
        ? {
            sourceName: latestCursor.source_name,
            cursorKind: latestCursor.cursor_kind,
            cursorValue: latestCursor.cursor_value,
            updatedAt: latestCursor.updated_at,
          }
        : null,
      recentVerifyRuns: normalizedVerifyRuns,
      recentDeltaSyncRuns: deltaRunsResult.rows.map((row) => ({
        migrationRunId: row.migration_run_id,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        rowsSeen: toNumber(row.rows_seen),
        rowsImported: toNumber(row.rows_imported),
        rowsSkipped: toNumber(row.rows_skipped),
        rowsFailed: toNumber(row.rows_failed),
      })),
      syncCursors: cursorResult.rows.map((row) => ({
        sourceName: row.source_name,
        cursorKind: row.cursor_kind,
        cursorValue: row.cursor_value,
        updatedAt: row.updated_at,
      })),
    };

    await finalizeReportRun(
      runId,
      "succeeded",
      normalizedVerifyRuns.length + deltaRunsResult.rows.length + cursorResult.rows.length,
      healthStatus === "healthy" ? 0 : 1,
      report,
    );

    console.log(JSON.stringify(report, null, 2));
    if (healthStatus !== "healthy") {
      process.exitCode = 1;
    }
  } catch (error) {
    await finalizeReportRun(runId, "failed", 0, 1, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  } finally {
    await pool.end();
  }
}

void main();
