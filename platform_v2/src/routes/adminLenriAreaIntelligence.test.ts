import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { adminLenriAreaIntelligenceRouteContract } from "./adminLenriAreaIntelligence.js";

const routeSource = readFileSync(
  fileURLToPath(new URL("./adminLenriAreaIntelligence.ts", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../app.ts", import.meta.url)),
  "utf8",
);
const serviceSource = readFileSync(
  fileURLToPath(new URL("../services/lenriAreaIntelligence.ts", import.meta.url)),
  "utf8",
);

test("Lenri area intelligence routes are registered and role gated", () => {
  assert.equal(adminLenriAreaIntelligenceRouteContract.path, "/admin/lenri-area-intelligence");
  assert.equal(adminLenriAreaIntelligenceRouteContract.apiPath, "/api/v1/admin/lenri-area-intelligence");
  assert.equal(adminLenriAreaIntelligenceRouteContract.guard, "admin_or_analyst_session");
  assert.equal(adminLenriAreaIntelligenceRouteContract.writesData, false);
  assert.equal(adminLenriAreaIntelligenceRouteContract.externalCalls, false);
  assert.equal(adminLenriAreaIntelligenceRouteContract.pdiSubscriptionAllowedWithoutBudgetProof, false);
  assert.equal(adminLenriAreaIntelligenceRouteContract.effortReadinessSchema, "lenri_effort_readiness/v0");
  assert.equal(adminLenriAreaIntelligenceRouteContract.liveEffortSchema, "lenri_live_effort/v0");
  assert.match(appSource, /registerAdminLenriAreaIntelligenceRoutes/);
  assert.match(routeSource, /getSessionFromCookie/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.doesNotMatch(routeSource, /app\.post|app\.put|app\.delete/);
});

test("Lenri area intelligence page keeps contract and claim boundaries visible", () => {
  assert.match(routeSource, /contract guard/);
  assert.match(routeSource, /PDI本契約前/);
  assert.match(routeSource, /現時点は未契約/);
  assert.match(routeSource, /cannot say yet/);
  assert.match(routeSource, /JSON/);
});

test("Lenri area intelligence page exposes effort readiness and survey planning", () => {
  assert.match(routeSource, /effort readiness/);
  assert.match(routeSource, /next survey plan/);
  assert.match(routeSource, /trend claim/);
  assert.match(routeSource, /effort\.metricDefinitions/);
  assert.match(serviceSource, /non_detection/);
  assert.match(routeSource, /effort guardrails/);
});

test("Lenri area intelligence page uses live effort ledger for authenticated views", () => {
  assert.match(routeSource, /getLenriAreaIntelligenceSnapshotWithLiveEffort/);
  assert.match(routeSource, /live effort ledger/);
  assert.match(routeSource, /effort filled/);
  assert.match(routeSource, /non-detection/);
});
