// Biodiversity Freshness OS: user_output_cache cache invalidation cron.
//
// Runs every 5 minutes via systemd timer. Two responsibilities:
//   1. Hard-delete rows whose expires_at < NOW() - 1 day (gc).
//   2. (Sprint 4 will wire) sweep newly-created *_versions rows and invalidate
//      affected cache_keys via invalidateByVersionRef().
//
// Usage:
//   tsx src/scripts/cron/runCacheInvalidate.ts        # one-shot
//   node dist/scripts/cron/runCacheInvalidate.js      # production via systemd

import { pathToFileURL } from "node:url";
import { getPool } from "../../db.js";
import { emitPublicMapSnapshotStalenessOpsNotification } from "../../services/publicMapSnapshotOpsAlerts.js";

export type CacheInvalidateSummary = {
  removed: number;
  freshnessRefreshed: number;
  newAlerts: number;
  publicMapAlerted: number;
  publicMapUpdated: number;
  publicMapNotified: number;
  publicMapNotifyFailed: number;
  elapsedMs: number;
};

async function gcExpiredCache(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ removed: string }>(
    `WITH removed AS (
       DELETE FROM user_output_cache
        WHERE expires_at IS NOT NULL
          AND expires_at < NOW() - INTERVAL '1 day'
        RETURNING cache_key
     )
     SELECT COUNT(*)::text AS removed FROM removed`,
  );
  return Number(result.rows[0]?.removed ?? 0);
}

async function refreshFreshnessRegistryStatus(): Promise<number> {
  const pool = getPool();
  // Mark stale / critical based on next_due_at + consecutive_failures.
  // Append-only contract: only updates the derived `status` column, never the
  // underlying snapshot data.
  const result = await pool.query<{ updated: string }>(
    `WITH updated AS (
       UPDATE freshness_registry
          SET status = CASE
            WHEN consecutive_failures >= 3 THEN 'critical'
            WHEN next_due_at IS NOT NULL AND next_due_at < NOW() - (expected_freshness_days || ' day')::interval
              THEN 'critical'
            WHEN next_due_at IS NOT NULL AND next_due_at < NOW() THEN 'stale'
            WHEN last_success_at IS NULL THEN 'unknown'
            ELSE 'fresh'
          END,
              updated_at = NOW()
        WHERE status NOT IN ('paused')
        RETURNING registry_key
     )
     SELECT COUNT(*)::text AS updated FROM updated`,
  );
  return Number(result.rows[0]?.updated ?? 0);
}

async function emitOverdueAlerts(): Promise<number> {
  const pool = getPool();
  // Insert a staleness_alert for any registry that turned 'critical' but has
  // no active (resolved_at IS NULL) overdue alert yet.
  const result = await pool.query<{ inserted: string }>(
    `WITH new_alerts AS (
       INSERT INTO staleness_alerts (registry_key, alert_kind, severity, notes)
       SELECT fr.registry_key,
              'overdue',
              CASE WHEN fr.consecutive_failures >= 3 THEN 'critical' ELSE 'high' END,
              CONCAT('auto: status=', fr.status, ', consecutive_failures=', fr.consecutive_failures)
       FROM freshness_registry fr
       WHERE fr.status = 'critical'
          AND fr.registry_key <> 'public_map_snapshot'
           AND NOT EXISTS (
             SELECT 1
               FROM staleness_alerts sa
              WHERE sa.registry_key = fr.registry_key
                AND sa.alert_kind = 'overdue'
                AND sa.resolved_at IS NULL
           )
       RETURNING alert_id
     )
     SELECT COUNT(*)::text AS inserted FROM new_alerts`,
  );
  return Number(result.rows[0]?.inserted ?? 0);
}

export async function runCacheInvalidateOnce(): Promise<CacheInvalidateSummary> {
  const startedAt = Date.now();
  const removed = await gcExpiredCache();
  const refreshed = await refreshFreshnessRegistryStatus();
  const alerts = await emitOverdueAlerts();
  const publicMapSnapshotAlerts = await emitPublicMapSnapshotStalenessOpsNotification().catch((error) => {
    console.warn("[cache-invalidate] public map snapshot ops alert failed", error);
    return { alerted: 0, updated: 0, notified: 0, notificationFailed: 1, webhookConfigured: false };
  });
  const elapsed = Date.now() - startedAt;
  return {
    removed,
    freshnessRefreshed: refreshed,
    newAlerts: alerts,
    publicMapAlerted: publicMapSnapshotAlerts.alerted,
    publicMapUpdated: publicMapSnapshotAlerts.updated,
    publicMapNotified: publicMapSnapshotAlerts.notified,
    publicMapNotifyFailed: publicMapSnapshotAlerts.notificationFailed,
    elapsedMs: elapsed,
  };
}

async function main(): Promise<void> {
  const pool = getPool();
  try {
    const summary = await runCacheInvalidateOnce();
    // eslint-disable-next-line no-console
    console.log(
      `[cache-invalidate] gc=${summary.removed} freshness_refreshed=${summary.freshnessRefreshed} new_alerts=${summary.newAlerts} public_map_alerted=${summary.publicMapAlerted} public_map_updated=${summary.publicMapUpdated} public_map_notified=${summary.publicMapNotified} public_map_notify_failed=${summary.publicMapNotifyFailed} elapsed=${summary.elapsedMs}ms`,
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[cache-invalidate] failed:", error);
    process.exit(1);
  });
}
