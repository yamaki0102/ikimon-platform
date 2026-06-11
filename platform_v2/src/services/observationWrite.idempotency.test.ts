import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("observation writes expose client submission idempotency", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationWrite.ts"), "utf8");
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0040_observation_write_idempotency.sql"), "utf8");

  assert.match(source, /clientSubmissionId\?: string \| null/);
  assert.match(source, /observation_write_idempotency/);
  assert.match(source, /duplicate_count = duplicate_count \+ 1/);
  assert.match(source, /existingObservationResult/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS observation_write_idempotency/);
  assert.match(migration, /client_submission_id TEXT PRIMARY KEY/);
});

test("observation writes support unlocated note saves without downstream location side effects", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationWrite.ts"), "utf8");

  assert.match(source, /latitude: number \| null/);
  assert.match(source, /longitude: number \| null/);
  assert.match(source, /function normalizeObservationCoordinates/);
  assert.match(source, /latitude and longitude must be provided together/);
  assert.match(source, /throw new Error\("invalid_location"\)/);
  assert.match(source, /place:unlocated:\$\{visitId\}/);
  assert.match(source, /const spatialMesh = hasLocation[\s\S]*encodeJisMeshCodes/);
  assert.match(source, /if \(hasLocation\) \{[\s\S]*upsertPlaceMemoryForVisit/);
  assert.match(source, /if \(hasLocation\) \{[\s\S]*fetchSiteSignals/);
});
