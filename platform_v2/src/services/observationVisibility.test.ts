import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("origin PostgreSQL owner-hide service is retired in favor of Worker native hide", async () => {
  assert.equal(existsSync(path.join(process.cwd(), "src", "services", "observationVisibility.ts")), false);

  const writeRoutes = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");
  assert.doesNotMatch(writeRoutes, /observationVisibility/);
  assert.doesNotMatch(writeRoutes, /\/api\/v1\/observations\/:id\/hide/);

  const workerSource = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");
  assert.match(workerSource, /hideCompatibleObservation/);
  assert.match(workerSource, /POST \/api\/v1\/observations\/:id\/hide/);
  assert.match(workerSource, /UPDATE observations SET emergency_hidden = 1/);
  assert.match(workerSource, /DELETE FROM readmodel_public_observations WHERE observation_id = \?/);
});

test("observation upsert keeps an owner-hidden visit hidden on re-upsert", async () => {
  const source = await readFile(path.join(process.cwd(), "src/services/observationWrite.ts"), "utf8");
  assert.match(source, /when visits\.public_visibility = 'hidden' then 'hidden'/);
  assert.match(source, /when visits\.public_visibility = 'hidden' then visits\.quality_review_status/);
  assert.match(source, /'owner_hidden_at', visits\.source_payload->>'owner_hidden_at'/);
});
