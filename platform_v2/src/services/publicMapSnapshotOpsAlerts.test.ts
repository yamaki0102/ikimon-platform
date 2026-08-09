import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  __test__,
  buildPublicMapSnapshotOpsNotification,
  PUBLIC_MAP_SNAPSHOT_REFRESH_RUNBOOK,
  type PublicMapSnapshotOpsNotification,
} from "./publicMapSnapshotOpsAlerts.js";
import type { PublicMapSnapshotStatus } from "./mapSnapshot.js";

function status(overrides: Partial<PublicMapSnapshotStatus> = {}): PublicMapSnapshotStatus {
  return {
    ok: false,
    status: "stale",
    snapshotKey: "public-map:v1:global",
    generatedAt: "2026-06-19T00:00:00.000Z",
    ageSeconds: 25_200,
    maxAgeSeconds: 21_600,
    sourceSampleSize: 120,
    publicRecordCount: 90,
    refreshedBy: "scheduler:public-map-snapshot",
    ...overrides,
  };
}

function registry(overrides: Partial<{
  status: string;
  consecutive_failures: number | string;
  last_success_at: string | null;
  next_due_at: string | null;
}> = {}) {
  return {
    status: "stale",
    consecutive_failures: 0,
    last_success_at: "2026-06-19T00:00:00.000Z",
    next_due_at: "2026-06-19T06:00:00.000Z",
    ...overrides,
  };
}

test("public map snapshot ops notification includes age, actor, and refresh runbook", () => {
  const notification: PublicMapSnapshotOpsNotification = buildPublicMapSnapshotOpsNotification(
    status(),
    registry(),
  );

  assert.equal(notification.severity, "high");
  assert.match(notification.notes, /public_map_snapshot is stale/);
  assert.match(notification.notes, /snapshot_age=7\.0h/);
  assert.match(notification.notes, /snapshot_age_seconds=25200/);
  assert.match(notification.notes, /last_refresh_actor=scheduler:public-map-snapshot/);
  assert.match(notification.notes, /npm run refresh:public-map-snapshot/);
  assert.match(notification.notes, /\/ops\/public-map-snapshot/);
  assert.equal(notification.metadata.snapshotAgeSeconds, 25_200);
  assert.equal(notification.metadata.refreshedBy, "scheduler:public-map-snapshot");
  assert.equal(notification.metadata.refreshRunbook, PUBLIC_MAP_SNAPSHOT_REFRESH_RUNBOOK);
});

test("public map snapshot critical registry status escalates severity", () => {
  const notification = buildPublicMapSnapshotOpsNotification(
    status({ status: "error", refreshedBy: null, generatedAt: null, ageSeconds: null }),
    registry({ status: "critical", consecutive_failures: "3" }),
  );

  assert.equal(notification.severity, "critical");
  assert.match(notification.notes, /public_map_snapshot is critical/);
  assert.match(notification.notes, /snapshot_age=unknown/);
  assert.match(notification.notes, /last_refresh_actor=unknown/);
  assert.equal(notification.metadata.consecutiveFailures, 3);
});

test("public map snapshot ops alert is wired into cache invalidation cron", async () => {
  const source = await readFile(new URL("../scripts/cron/runCacheInvalidate.ts", import.meta.url), "utf8");

  assert.match(source, /export async function runCacheInvalidateOnce/);
  assert.match(source, /emitPublicMapSnapshotStalenessOpsNotification/);
  assert.match(source, /fr\.registry_key <> 'public_map_snapshot'/);
  assert.match(source, /public_map_notified=/);
});

test("staging smoke backdates, alerts, verifies admin, refreshes, and resolves", async () => {
  const smokeSource = await readFile(new URL("../scripts/smokePublicMapSnapshotAlert.ts", import.meta.url), "utf8");
  const packageSource = await readFile(new URL("../../package.json", import.meta.url), "utf8");

  assert.match(packageSource, /"smoke:public-map-snapshot-alert"/);
  assert.match(smokeSource, /--apply/);
  assert.match(smokeSource, /--confirm=public-map-snapshot-staging-smoke/);
  assert.match(smokeSource, /Refusing to run public map snapshot alert smoke against production host/);
  assert.match(smokeSource, /isCanonicalOrLegacyProductionHost\(hostname\)/);
  assert.match(smokeSource, /--capture-webhook/);
  assert.match(smokeSource, /startWebhookCapture/);
  assert.match(smokeSource, /required webhook capture did not receive a staleness notification/);
  assert.match(smokeSource, /--create-smoke-admin-session/);
  assert.match(smokeSource, /createSmokeAdminSession/);
  assert.match(smokeSource, /--require-admin/);
  assert.match(smokeSource, /update public_map_snapshots/);
  assert.match(smokeSource, /runCacheInvalidateOnce/);
  assert.match(smokeSource, /readActiveAlert/);
  assert.match(smokeSource, /\/admin\/data-health/);
  assert.match(smokeSource, /refreshPublicMapSnapshot/);
  assert.match(smokeSource, /expected refresh to resolve public_map_snapshot alerts/);
  assert.match(smokeSource, /\/ops\/public-map-snapshot/);
});

test("public map snapshot alert smoke stays documented while Cloudflare staging uses the command bus", async () => {
  const [
    manifestSource,
    manifestSyncSource,
    portableReleaseSource,
  ] = await Promise.all([
    readFile(new URL("../../../ops/deploy/staging_manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../../../scripts/check_staging_manifest_sync.ps1", import.meta.url), "utf8"),
    readFile(new URL("../../../scripts/run_cloudflare_staging_release.sh", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource) as {
    strategy?: string;
    githubActionsRequired?: boolean;
    portableReleaseScript?: string;
    promotion?: {
      commandBusOnly?: boolean;
      pinCommitSha?: boolean;
      executorIsolation?: string;
    };
    releaseGates?: Array<{ key: string; scope: string; command: string; workflowMarkers: string[] }>;
    notes?: string[];
  };
  const gate = manifest.releaseGates?.find((item) => item.key === "public_map_snapshot_alert_lifecycle");

  assert.equal(manifest.strategy, "cloudflare_queue_sandbox_executor");
  assert.equal(manifest.githubActionsRequired, false);
  assert.equal(manifest.portableReleaseScript, "scripts/run_cloudflare_staging_release.sh");
  assert.equal(manifest.promotion?.commandBusOnly, true);
  assert.equal(manifest.promotion?.pinCommitSha, true);
  assert.equal(manifest.promotion?.executorIsolation, "one_fresh_sandbox_per_job");
  assert.ok(gate);
  assert.equal(gate.scope, "verify_level_full");
  assert.match(gate.command, /smoke:public-map-snapshot-alert/);
  assert.match(gate.command, /--confirm=public-map-snapshot-staging-smoke/);
  assert.match(gate.command, /--allow-local/);
  assert.match(gate.command, /--create-smoke-admin-session/);
  assert.match(gate.command, /--require-admin/);
  assert.match(gate.command, /--capture-webhook/);
  assert.match(gate.command, /--require-webhook/);
  assert.match(portableReleaseSource, /deploy:staging:dry-run/);
  assert.match(portableReleaseSource, /Verify Cloudflare staging public routes/);
  assert.match(portableReleaseSource, /Staging D1 migration is a separate approval-bound operation/);
  assert.doesNotMatch(portableReleaseSource, /smoke:public-map-snapshot-alert/);
  assert.match(manifestSyncSource, /cloudflare_queue_sandbox_executor/);
  assert.match(manifestSyncSource, /Retired deploy workflow remains/);
  assert.ok(
    manifest.notes?.some((note) => note.includes("releaseGates currently documents the legacy VPS")),
  );
});

test("public map snapshot ops webhook resolves dedicated env before generic env", () => {
  assert.equal(
    __test__.resolveOpsWebhookUrl({
      IKIMON_OPS_STALENESS_WEBHOOK_URL: "https://ops.example/stale",
      IKIMON_OPS_WEBHOOK_URL: "https://ops.example/generic",
    }),
    "https://ops.example/stale",
  );
  assert.equal(__test__.formatAge(90), "1m");
  assert.equal(__test__.formatAge(7200), "2.0h");
});
