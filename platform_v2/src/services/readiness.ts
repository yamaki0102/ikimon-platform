import { getPool } from "../db.js";

export async function getReadinessSnapshot() {
  const pool = getPool();

  const countsResult = await pool.query<{
    users: string;
    visits: string;
    occurrences: string;
    observation_photo_assets: string;
    avatar_assets: string;
    track_points: string;
  }>(
    `select
        (select count(*)::text from users) as users,
        (select count(*)::text from visits) as visits,
        (select count(*)::text from occurrences) as occurrences,
        (select count(*)::text from evidence_assets where asset_role = 'observation_photo') as observation_photo_assets,
        (select count(*)::text from evidence_assets where asset_role = 'avatar') as avatar_assets,
        (select count(*)::text from visit_track_points) as track_points`,
  );

  const syncCursorResult = await pool.query<{
    source_name: string;
    cursor_kind: string;
    cursor_value: string | null;
    updated_at: string;
    metadata: Record<string, unknown>;
  }>(
    `select source_name, cursor_kind, cursor_value, updated_at::text, metadata
     from sync_cursors
     order by updated_at desc
     limit 5`,
  );

  const runResult = await pool.query<{
    run_type: string;
    source_name: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    rows_seen: string;
    rows_imported: string;
    rows_failed: string;
    cursor_value: string | null;
    details: Record<string, unknown>;
  }>(
    `select
        run_type,
        source_name,
        status,
        started_at::text,
        finished_at::text,
        rows_seen::text,
        rows_imported::text,
        rows_failed::text,
        cursor_value,
        details
     from migration_runs
     where run_type in ('delta_sync', 'verify_legacy_parity', 'legacy_drift_report')
     order by started_at desc
     limit 20`,
  );

  const latestTypedRunsResult = await pool.query<{
    run_type: string;
    source_name: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    rows_seen: string;
    rows_imported: string;
    rows_failed: string;
    cursor_value: string | null;
    details: Record<string, unknown>;
  }>(
    `select distinct on (run_type)
        run_type,
        source_name,
        status,
        started_at::text,
        finished_at::text,
        rows_seen::text,
        rows_imported::text,
        rows_failed::text,
        cursor_value,
        details
     from migration_runs
     where run_type in ('delta_sync', 'verify_legacy_parity', 'legacy_drift_report')
     order by run_type, started_at desc`,
  );

  const compatibilityResult = await pool.query<{
    entity_type: string;
    canonical_id: string;
    write_status: string;
    attempted_at: string;
    legacy_target: string;
  }>(
    `select entity_type, canonical_id, write_status, attempted_at::text, legacy_target
     from compatibility_write_ledger
     order by attempted_at desc
     limit 10`,
  );

  const counts = countsResult.rows[0];
  const latestVerifyRun = latestTypedRunsResult.rows.find((row) => row.run_type === "verify_legacy_parity");
  const latestDeltaSyncRun = latestTypedRunsResult.rows.find((row) => row.run_type === "delta_sync");
  const latestDriftReportRun = latestTypedRunsResult.rows.find((row) => row.run_type === "legacy_drift_report");
  const latestCompatibilityWrite = compatibilityResult.rows[0] ?? null;
  const latestVerifyMismatches = Array.isArray(latestVerifyRun?.details?.mismatches)
    ? latestVerifyRun?.details?.mismatches.length
    : null;
  const latestDriftSummary =
    latestDriftReportRun?.details && typeof latestDriftReportRun.details === "object"
      ? (latestDriftReportRun.details.summary as Record<string, unknown> | undefined)
      : undefined;

  const gates = {
    parityVerified: latestVerifyRun?.status === "succeeded" && latestVerifyMismatches === 0,
    deltaSyncHealthy:
      latestDeltaSyncRun?.status === "succeeded" || latestDeltaSyncRun?.status === "skipped",
    driftReportHealthy:
      latestDriftReportRun?.status === "succeeded" &&
      latestDriftSummary?.status === "healthy",
    compatibilityWriteWorking: latestCompatibilityWrite?.write_status === "succeeded",
    rollbackSafetyWindowReady:
      (latestVerifyRun?.status === "succeeded" && latestVerifyMismatches === 0) &&
      (latestDeltaSyncRun?.status === "succeeded" || latestDeltaSyncRun?.status === "skipped") &&
      latestDriftReportRun?.status === "succeeded" &&
      latestDriftSummary?.status === "healthy" &&
      latestCompatibilityWrite?.write_status === "succeeded",
  };

  return {
    status: gates.rollbackSafetyWindowReady ? "near_ready" : "needs_work",
    gates,
    counts: {
      users: Number(counts?.users ?? 0),
      visits: Number(counts?.visits ?? 0),
      occurrences: Number(counts?.occurrences ?? 0),
      observationPhotoAssets: Number(counts?.observation_photo_assets ?? 0),
      avatarAssets: Number(counts?.avatar_assets ?? 0),
      trackPoints: Number(counts?.track_points ?? 0),
    },
    syncCursors: syncCursorResult.rows,
    recentRuns: runResult.rows.map((row) => ({
      ...row,
      rows_seen: Number(row.rows_seen),
      rows_imported: Number(row.rows_imported),
      rows_failed: Number(row.rows_failed),
    })),
    latestDriftReport: latestDriftReportRun
      ? {
          run_type: latestDriftReportRun.run_type,
          status: latestDriftReportRun.status,
          started_at: latestDriftReportRun.started_at,
          finished_at: latestDriftReportRun.finished_at,
          rows_seen: Number(latestDriftReportRun.rows_seen),
          rows_imported: Number(latestDriftReportRun.rows_imported),
          rows_failed: Number(latestDriftReportRun.rows_failed),
          summary: latestDriftSummary ?? null,
        }
      : null,
    recentCompatibilityWrites: compatibilityResult.rows,
  };
}
