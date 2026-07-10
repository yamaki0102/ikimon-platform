import { getPool } from "../db.js";
import { refreshPublicMapSnapshot } from "../services/mapSnapshot.js";
import { runCacheInvalidateOnce } from "./cron/runCacheInvalidate.js";

type SmokeMode = "stale" | "critical";

type SmokeOptions = {
  apply: boolean;
  confirm: string;
  baseUrl: string;
  backdateHours: number;
  mode: SmokeMode;
  webhookUrl: string;
  requireWebhook: boolean;
  adminCookie: string;
  allowLocal: boolean;
  allowNonStaging: boolean;
};

type SnapshotRow = {
  snapshot_key: string;
  generated_at: string;
  refreshed_by: string | null;
  source_sample_size: number | string;
  public_record_count: number | string;
};

type AlertRow = {
  alert_id: string;
  severity: string;
  notes: string;
  notified_at: string | null;
  resolved_at: string | null;
  metadata: unknown;
};

type OpsStatusPayload = {
  status?: string;
  generatedAt?: string | null;
  ageSeconds?: number | null;
  refreshedBy?: string | null;
};

const SNAPSHOT_KEY = "public-map:v1:global";
const REGISTRY_KEY = "public_map_snapshot";
const CONFIRMATION = "public-map-snapshot-staging-smoke";

function parseArgs(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    apply: false,
    confirm: process.env.PUBLIC_MAP_SNAPSHOT_STAGING_SMOKE_CONFIRM?.trim() ?? "",
    baseUrl: process.env.V2_BASE_URL?.trim() || "https://staging.ikimon.life",
    backdateHours: Number(process.env.PUBLIC_MAP_SNAPSHOT_SMOKE_BACKDATE_HOURS ?? 8),
    mode: "stale",
    webhookUrl: process.env.IKIMON_OPS_STALENESS_WEBHOOK_URL?.trim()
      || process.env.IKIMON_OPS_WEBHOOK_URL?.trim()
      || "",
    requireWebhook: false,
    adminCookie: process.env.IKIMON_ADMIN_COOKIE?.trim() || "",
    allowLocal: false,
    allowNonStaging: false,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg.startsWith("--confirm=")) {
      options.confirm = arg.slice("--confirm=".length).trim();
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
      continue;
    }
    if (arg.startsWith("--backdate-hours=")) {
      const value = Number(arg.slice("--backdate-hours=".length));
      if (Number.isFinite(value) && value > 0) options.backdateHours = value;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length).trim();
      if (value === "stale" || value === "critical") options.mode = value;
      continue;
    }
    if (arg.startsWith("--webhook-url=")) {
      options.webhookUrl = arg.slice("--webhook-url=".length).trim();
      continue;
    }
    if (arg === "--require-webhook") {
      options.requireWebhook = true;
      continue;
    }
    if (arg.startsWith("--admin-cookie=")) {
      options.adminCookie = arg.slice("--admin-cookie=".length).trim();
      continue;
    }
    if (arg === "--allow-local") {
      options.allowLocal = true;
      continue;
    }
    if (arg === "--allow-non-staging") {
      options.allowNonStaging = true;
    }
  }

  return options;
}

function assertSafeSmokeTarget(options: SmokeOptions): void {
  if (!options.apply) {
    throw new Error("Refusing to mutate DB without --apply.");
  }
  if (options.confirm !== CONFIRMATION) {
    throw new Error("Refusing to mutate DB without --confirm=public-map-snapshot-staging-smoke.");
  }
  let hostname = "";
  try {
    hostname = new URL(options.baseUrl).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid --base-url: ${options.baseUrl}`);
  }
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const isStaging = hostname.includes("staging") || hostname.includes("localhost") || hostname === "127.0.0.1";
  const isProductionHost = hostname === "ikimon.life" || hostname === "www.ikimon.life";
  if (isProductionHost) {
    throw new Error("Refusing to run public map snapshot alert smoke against production host.");
  }
  if (isLocal && !options.allowLocal) {
    throw new Error("Local smoke requires --allow-local so staging is not confused with local DB.");
  }
  if (!isStaging && !options.allowNonStaging) {
    throw new Error("Smoke target must look like staging. Pass --allow-non-staging only for an isolated non-production lane.");
  }
  if (options.requireWebhook && !options.webhookUrl) {
    throw new Error("--require-webhook needs --webhook-url or IKIMON_OPS_STALENESS_WEBHOOK_URL.");
  }
  if (options.webhookUrl) {
    process.env.IKIMON_OPS_STALENESS_WEBHOOK_URL = options.webhookUrl;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(headers ?? {}),
    },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) as unknown : {};
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 300)}`);
  }
  return payload;
}

async function fetchText(url: string, headers?: HeadersInit): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
      ...(headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 300)}`);
  }
  return body;
}

function adminHeaders(options: SmokeOptions): HeadersInit | undefined {
  return options.adminCookie ? { cookie: options.adminCookie } : undefined;
}

async function ensureSnapshotExists(): Promise<SnapshotRow> {
  const pool = getPool();
  const existing = await pool.query<SnapshotRow>(
    `select snapshot_key, generated_at::text, refreshed_by, source_sample_size, public_record_count
       from public_map_snapshots
      where snapshot_key = $1
      limit 1`,
    [SNAPSHOT_KEY],
  );
  if (existing.rows[0]) return existing.rows[0];
  await refreshPublicMapSnapshot({ refreshedBy: "smoke:public-map-snapshot-alert:initial" });
  const created = await pool.query<SnapshotRow>(
    `select snapshot_key, generated_at::text, refreshed_by, source_sample_size, public_record_count
       from public_map_snapshots
      where snapshot_key = $1
      limit 1`,
    [SNAPSHOT_KEY],
  );
  const row = created.rows[0];
  if (!row) throw new Error("public_map_snapshots row was not created");
  return row;
}

async function backdateSnapshot(options: SmokeOptions): Promise<string> {
  const backdatedAt = new Date(Date.now() - options.backdateHours * 60 * 60 * 1000).toISOString();
  const maxAgeSeconds = 6 * 60 * 60;
  const consecutiveFailures = options.mode === "critical" ? 3 : 0;
  const pool = getPool();
  await pool.query(
    `update public_map_snapshots
        set generated_at = $2::timestamptz,
            payload = jsonb_set(payload, '{generatedAt}', to_jsonb($2::text), true),
            refreshed_by = $3
      where snapshot_key = $1`,
    [SNAPSHOT_KEY, backdatedAt, "smoke:public-map-snapshot-alert:backdate"],
  );
  await pool.query(
    `update freshness_registry
        set last_attempt_at = $2::timestamptz,
            last_success_at = $2::timestamptz,
            next_due_at = $2::timestamptz + ($3::int * interval '1 second'),
            consecutive_failures = $4,
            status = 'fresh',
            updated_at = now()
      where registry_key = $1`,
    [REGISTRY_KEY, backdatedAt, maxAgeSeconds, consecutiveFailures],
  );
  return backdatedAt;
}

async function readActiveAlert(): Promise<AlertRow | null> {
  const pool = getPool();
  const result = await pool.query<AlertRow>(
    `select alert_id::text, severity, notes, notified_at::text, resolved_at::text, metadata
       from staleness_alerts
      where registry_key = $1
        and alert_kind = 'overdue'
        and resolved_at is null
      order by detected_at desc
      limit 1`,
    [REGISTRY_KEY],
  );
  return result.rows[0] ?? null;
}

async function countActiveAlerts(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count
       from staleness_alerts
      where registry_key = $1
        and alert_kind = 'overdue'
        and resolved_at is null`,
    [REGISTRY_KEY],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function validateOpsSnapshotPayload(payload: unknown, expectedStatus: "stale" | "fresh"): OpsStatusPayload {
  if (!isRecord(payload)) {
    throw new Error("/ops/public-map-snapshot did not return an object");
  }
  const typed = payload as OpsStatusPayload;
  if (typed.status !== expectedStatus) {
    throw new Error(`/ops/public-map-snapshot expected ${expectedStatus}, got ${String(typed.status)}`);
  }
  return typed;
}

function validateAlert(alert: AlertRow | null, options: SmokeOptions): AlertRow {
  if (!alert) throw new Error("public_map_snapshot active staleness alert was not created");
  const expectedSeverity = options.mode === "critical" ? "critical" : "high";
  if (alert.severity !== expectedSeverity) {
    throw new Error(`expected alert severity ${expectedSeverity}, got ${alert.severity}`);
  }
  for (const marker of ["snapshot_age=", "last_refresh_actor=smoke:public-map-snapshot-alert:backdate", "refresh_runbook:", "npm run refresh:public-map-snapshot"]) {
    if (!alert.notes.includes(marker)) {
      throw new Error(`alert notes missing marker: ${marker}`);
    }
  }
  if (options.requireWebhook && !alert.notified_at) {
    throw new Error("alert was not marked notified_at even though webhook was required");
  }
  return alert;
}

async function verifyAdminDataHealth(options: SmokeOptions): Promise<{ checked: boolean; matched: boolean }> {
  if (!options.adminCookie) return { checked: false, matched: false };
  const html = await fetchText(`${options.baseUrl.replace(/\/+$/, "")}/admin/data-health`, adminHeaders(options));
  const matched = html.includes("未解決 staleness alerts")
    && html.includes("public_map_snapshot")
    && html.includes("refresh_runbook");
  if (!matched) {
    throw new Error("/admin/data-health did not render public_map_snapshot staleness alert details");
  }
  return { checked: true, matched };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertSafeSmokeTarget(options);

  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const originalSnapshot = await ensureSnapshotExists();
  const backdatedAt = await backdateSnapshot(options);

  const staleOpsPayload = validateOpsSnapshotPayload(
    await fetchJson(`${baseUrl}/ops/public-map-snapshot`),
    "stale",
  );
  const cacheInvalidate = await runCacheInvalidateOnce();
  const alert = validateAlert(await readActiveAlert(), options);
  const admin = await verifyAdminDataHealth(options);

  const refresh = await refreshPublicMapSnapshot({
    refreshedBy: "smoke:public-map-snapshot-alert:resolve",
  });
  const activeAlertsAfterRefresh = await countActiveAlerts();
  if (activeAlertsAfterRefresh !== 0) {
    throw new Error(`expected refresh to resolve public_map_snapshot alerts, active=${activeAlertsAfterRefresh}`);
  }
  const freshOpsPayload = validateOpsSnapshotPayload(
    await fetchJson(`${baseUrl}/ops/public-map-snapshot`),
    "fresh",
  );

  console.log(JSON.stringify({
    status: "passed",
    baseUrl,
    mode: options.mode,
    originalSnapshot,
    backdatedAt,
    staleOpsPayload,
    cacheInvalidate,
    alert: {
      alertId: alert.alert_id,
      severity: alert.severity,
      notifiedAt: alert.notified_at,
    },
    webhook: {
      configured: Boolean(options.webhookUrl),
      required: options.requireWebhook,
    },
    adminDataHealth: admin,
    refresh,
    activeAlertsAfterRefresh,
    freshOpsPayload,
  }, null, 2));

  await getPool().end();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await getPool().end().catch(() => undefined);
  } catch {
    // Pool may not be configured yet if argument guards failed before DB use.
  }
  process.exitCode = 1;
});
