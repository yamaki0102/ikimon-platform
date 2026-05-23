import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { monitoringWorkspaceApiRouteContract } from "./monitoringWorkspaceApi.js";

const routeSource = readFileSync(
  fileURLToPath(new URL("./monitoringWorkspaceApi.ts", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../app.ts", import.meta.url)),
  "utf8",
);

test("monitoring workspace read-model API is registered as a guarded read endpoint", () => {
  assert.equal(monitoringWorkspaceApiRouteContract.path, "/api/v1/monitoring/workspace/field");
  assert.deepEqual(monitoringWorkspaceApiRouteContract.requiredQuery, ["field_id", "start", "end"]);
  assert.match(appSource, /registerMonitoringWorkspaceApiRoutes/);
  assert.match(routeSource, /assertPrivilegedWriteAccess/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.doesNotMatch(routeSource, /app\.post/);
});

test("monitoring workspace API exposes the three P0 report purposes", () => {
  assert.deepEqual(monitoringWorkspaceApiRouteContract.allowedPurposes, [
    "formal_report",
    "identification_strengthening",
    "area_strengthening",
  ]);
  for (const purpose of monitoringWorkspaceApiRouteContract.allowedPurposes) {
    assert.match(routeSource, new RegExp(purpose));
  }
});
