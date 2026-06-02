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

test("Lenri area intelligence routes are registered and role gated", () => {
  assert.equal(adminLenriAreaIntelligenceRouteContract.path, "/admin/lenri-area-intelligence");
  assert.equal(adminLenriAreaIntelligenceRouteContract.apiPath, "/api/v1/admin/lenri-area-intelligence");
  assert.equal(adminLenriAreaIntelligenceRouteContract.guard, "admin_or_analyst_session");
  assert.equal(adminLenriAreaIntelligenceRouteContract.writesData, false);
  assert.equal(adminLenriAreaIntelligenceRouteContract.externalCalls, false);
  assert.equal(adminLenriAreaIntelligenceRouteContract.pdiSubscriptionAllowedWithoutBudgetProof, false);
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
