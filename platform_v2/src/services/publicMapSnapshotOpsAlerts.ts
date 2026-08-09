import { getPool } from "../db.js";
import {
  getPublicMapSnapshotStatus,
  type PublicMapSnapshotStatus,
} from "./mapSnapshot.js";

const PUBLIC_MAP_REGISTRY_KEY = "public_map_snapshot";
const PUBLIC_MAP_ALERT_KIND = "overdue";

export const PUBLIC_MAP_SNAPSHOT_REFRESH_RUNBOOK = [
  "cd platform_v2",
  "npm run migrate",
  "npm run refresh:public-map-snapshot",
  "curl -fsS /ops/public-map-snapshot",
  "curl -fsS '/api/v1/map/cells?bbox=137.70,34.70,137.75,34.75&zoom=13'",
  "curl -fsS '/api/v1/map/observations?bbox=137.70,34.70,137.75,34.75&zoom=13'",
].join("\n");

type RegistryStatusRow = {
  status: string;
  consecutive_failures: number | string;
  last_success_at: string | null;
  next_due_at: string | null;
};

type AlertRow = {
  alert_id: string;
};

type PendingAlertRow = {
  alert_id: string;
  registry_key: string;
  severity: string;
  notes: string;
  metadata: unknown;
};

export type PublicMapSnapshotOpsNotification = {
  severity: "high" | "critical";
  notes: string;
  metadata: Record<string, unknown>;
};

export type PublicMapSnapshotOpsNotificationSummary = {
  alerted: number;
  updated: number;
  notified: number;
  notificationFailed: number;
  webhookConfigured: boolean;
};

type Queryable = Pick<ReturnType<typeof getPool>, "query">;

function numberFromDb(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return "unknown";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function resolveOpsWebhookUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env.IKIMON_OPS_STALENESS_WEBHOOK_URL?.trim()
    || env.IKIMON_OPS_WEBHOOK_URL?.trim()
    || null;
}

export function buildPublicMapSnapshotOpsNotification(
  status: PublicMapSnapshotStatus,
  registry: RegistryStatusRow,
): PublicMapSnapshotOpsNotification {
  const registryStatus = registry.status === "critical" ? "critical" : "stale";
  const severity = registryStatus === "critical" ? "critical" : "high";
  const refreshedBy = status.refreshedBy ?? "unknown";
  const ageLabel = formatAge(status.ageSeconds);
  const generatedAt = status.generatedAt ?? "missing";
  const nextDueAt = registry.next_due_at ?? "unknown";
  const lastSuccessAt = registry.last_success_at ?? "unknown";
  const consecutiveFailures = numberFromDb(registry.consecutive_failures);
  const notes = [
    `public_map_snapshot is ${registryStatus}.`,
    `snapshot_age=${ageLabel}`,
    `snapshot_age_seconds=${status.ageSeconds ?? "unknown"}`,
    `generated_at=${generatedAt}`,
    `last_refresh_actor=${refreshedBy}`,
    `last_success_at=${lastSuccessAt}`,
    `next_due_at=${nextDueAt}`,
    `consecutive_failures=${consecutiveFailures}`,
    "refresh_runbook:",
    PUBLIC_MAP_SNAPSHOT_REFRESH_RUNBOOK,
  ].join("\n");

  return {
    severity,
    notes,
    metadata: {
      registryKey: PUBLIC_MAP_REGISTRY_KEY,
      registryStatus,
      snapshotStatus: status.status,
      snapshotAgeSeconds: status.ageSeconds,
      snapshotAgeLabel: ageLabel,
      generatedAt: status.generatedAt,
      refreshedBy,
      lastSuccessAt: registry.last_success_at,
      nextDueAt: registry.next_due_at,
      consecutiveFailures,
      sourceSampleSize: status.sourceSampleSize,
      publicRecordCount: status.publicRecordCount,
      refreshRunbook: PUBLIC_MAP_SNAPSHOT_REFRESH_RUNBOOK,
      opsStatusPath: "/ops/public-map-snapshot",
    },
  };
}

async function readRegistryStatus(client: Queryable): Promise<RegistryStatusRow | null> {
  const result = await client.query<RegistryStatusRow>(
    `select status, consecutive_failures, last_success_at::text, next_due_at::text
       from freshness_registry
      where registry_key = $1
      limit 1`,
    [PUBLIC_MAP_REGISTRY_KEY],
  );
  return result.rows[0] ?? null;
}

async function upsertStalenessAlert(
  client: Queryable,
  notification: PublicMapSnapshotOpsNotification,
): Promise<{ inserted: number; updated: number; alertId: string | null }> {
  const existing = await client.query<AlertRow>(
    `select alert_id::text
       from staleness_alerts
      where registry_key = $1
        and alert_kind = $2
        and resolved_at is null
      order by detected_at desc
      limit 1`,
    [PUBLIC_MAP_REGISTRY_KEY, PUBLIC_MAP_ALERT_KIND],
  );
  const alertId = existing.rows[0]?.alert_id ?? null;
  if (alertId) {
    await client.query(
      `update staleness_alerts
          set severity = $2,
              notes = $3,
              metadata = $4::jsonb,
              notified_at = case
                when severity <> $2 or coalesce(metadata->>'registryStatus', '') <> coalesce($5, '')
                  then null
                else notified_at
              end
        where alert_id = $1::uuid`,
      [
        alertId,
        notification.severity,
        notification.notes,
        JSON.stringify(notification.metadata),
        String(notification.metadata.registryStatus ?? ""),
      ],
    );
    return { inserted: 0, updated: 1, alertId };
  }

  const inserted = await client.query<AlertRow>(
    `insert into staleness_alerts (registry_key, alert_kind, severity, notes, metadata)
     values ($1, $2, $3, $4, $5::jsonb)
     returning alert_id::text`,
    [
      PUBLIC_MAP_REGISTRY_KEY,
      PUBLIC_MAP_ALERT_KIND,
      notification.severity,
      notification.notes,
      JSON.stringify(notification.metadata),
    ],
  );
  return { inserted: 1, updated: 0, alertId: inserted.rows[0]?.alert_id ?? null };
}

async function notifyPendingPublicMapAlerts(client: Queryable): Promise<{ sent: number; failed: number; webhookConfigured: boolean }> {
  const webhookUrl = resolveOpsWebhookUrl();
  if (!webhookUrl) return { sent: 0, failed: 0, webhookConfigured: false };

  const pending = await client.query<PendingAlertRow>(
    `select alert_id::text, registry_key, severity, notes, metadata
       from staleness_alerts
      where registry_key = $1
        and alert_kind = $2
        and resolved_at is null
        and notified_at is null
      order by detected_at asc
      limit 10`,
    [PUBLIC_MAP_REGISTRY_KEY, PUBLIC_MAP_ALERT_KIND],
  );

  let sent = 0;
  let failed = 0;
  for (const row of pending.rows) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `[ZUKAN ops] ${row.registry_key} ${row.severity}\n${row.notes}`,
          registryKey: row.registry_key,
          severity: row.severity,
          notes: row.notes,
          metadata: row.metadata,
        }),
      });
      if (!response.ok) {
        throw new Error(`ops_staleness_webhook_failed:${response.status}`);
      }
      await client.query(
        `update staleness_alerts
            set notified_at = now()
          where alert_id = $1::uuid`,
        [row.alert_id],
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      console.warn("[public-map-snapshot] ops notification failed", error);
    }
  }
  return { sent, failed, webhookConfigured: true };
}

export async function emitPublicMapSnapshotStalenessOpsNotification(): Promise<PublicMapSnapshotOpsNotificationSummary> {
  const pool = getPool();
  const registry = await readRegistryStatus(pool);
  if (!registry || !["stale", "critical"].includes(registry.status)) {
    const notification = await notifyPendingPublicMapAlerts(pool);
    return {
      alerted: 0,
      updated: 0,
      notified: notification.sent,
      notificationFailed: notification.failed,
      webhookConfigured: notification.webhookConfigured,
    };
  }

  const status = await getPublicMapSnapshotStatus();
  const notification = buildPublicMapSnapshotOpsNotification(status, registry);
  const alert = await upsertStalenessAlert(pool, notification);
  const delivery = await notifyPendingPublicMapAlerts(pool);
  return {
    alerted: alert.inserted,
    updated: alert.updated,
    notified: delivery.sent,
    notificationFailed: delivery.failed,
    webhookConfigured: delivery.webhookConfigured,
  };
}

export const __test__ = {
  formatAge,
  resolveOpsWebhookUrl,
};
