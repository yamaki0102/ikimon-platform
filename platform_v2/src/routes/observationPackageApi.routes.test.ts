import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("observation package API is registered and owner or privileged-key gated", () => {
  const appSource = readFileSync(path.join(process.cwd(), "src", "app.ts"), "utf8");
  const routeSource = readFileSync(path.join(process.cwd(), "src", "routes", "observationPackageApi.ts"), "utf8");

  assert.match(appSource, /registerObservationPackageApiRoutes/);
  assert.match(routeSource, /\/api\/v1\/observations\/:id\/package/);
  assert.match(routeSource, /assertObservationOwnedByUser/);
  assert.match(routeSource, /assertPrivilegedWriteAccess/);
  assert.match(routeSource, /buildObservationPackage/);
  assert.match(routeSource, /\/api\/v1\/monitoring\/packages/);
  assert.match(routeSource, /MONITORING_PACKAGE_BLUEPRINTS/);
});
