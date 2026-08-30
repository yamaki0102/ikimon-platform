import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { adminMonitoringWorkspaceRouteContract } from "./adminMonitoringWorkspace.js";

const routeSource = readFileSync(
  fileURLToPath(new URL("./adminMonitoringWorkspace.ts", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../app.ts", import.meta.url)),
  "utf8",
);

test("admin monitoring workspace page is registered and role gated", () => {
  assert.equal(adminMonitoringWorkspaceRouteContract.path, "/admin/monitoring-workspace");
  assert.equal(adminMonitoringWorkspaceRouteContract.apiPath, "/api/v1/monitoring/workspace/field");
  assert.equal(adminMonitoringWorkspaceRouteContract.observationAiQueueHealthApiPath, "/api/v1/admin/observation-ai/queue-health");
  assert.equal(adminMonitoringWorkspaceRouteContract.guard, "admin_or_analyst_session");
  assert.equal(adminMonitoringWorkspaceRouteContract.writesData, false);
  assert.match(appSource, /registerAdminMonitoringWorkspaceRoutes/);
  assert.match(routeSource, /getSessionFromCookie/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.doesNotMatch(routeSource, /app\.post|app\.put|app\.delete/);
});

test("admin monitoring workspace page exposes P0 queues and analysis modes", () => {
  assert.deepEqual(adminMonitoringWorkspaceRouteContract.queues, [
    "identification_waiting",
    "evidence_insufficient",
    "area_coverage_attention",
    "location_privacy_review",
    "export_request",
  ]);
  assert.deepEqual(adminMonitoringWorkspaceRouteContract.purposes, [
    "formal_report",
    "identification_strengthening",
    "area_strengthening",
  ]);
  for (const key of adminMonitoringWorkspaceRouteContract.queues) {
    assert.match(routeSource, new RegExp(key));
  }
  for (const purpose of adminMonitoringWorkspaceRouteContract.purposes) {
    assert.match(routeSource, new RegExp(purpose));
  }
});

test("admin monitoring workspace keeps candidate records and readiness visible", () => {
  assert.match(routeSource, /候補を正式指標に混ぜない/);
  assert.match(routeSource, /monitoring_ready/);
  assert.match(routeSource, /export_ready/);
  assert.match(routeSource, /メッシュ網羅/);
  assert.match(routeSource, /季節カバー/);
});

test("admin monitoring workspace displays observation AI backlog and exhausted retries read-only", () => {
  assert.match(routeSource, /data-ai-queue-health/u);
  assert.match(routeSource, /retry exhausted/u);
  assert.match(routeSource, /observationAiQueueHealthApiPath/u);
  assert.match(routeSource, /queueHealthResponse\.json/u);
});
