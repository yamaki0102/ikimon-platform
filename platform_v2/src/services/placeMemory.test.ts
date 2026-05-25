import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  PLACE_MEMORY_GRID_M,
  normalizePlaceMemoryInput,
  placeMemoryTagLabelsJa,
} from "./placeMemory.js";

test("place memory input keeps tags optional and clamps public/private notes", () => {
  const normalized = normalizePlaceMemoryInput({
    tags: ["refresh_walk", "refresh_walk", "invalid", "first_visit"],
    echoNote: "x".repeat(100),
    privateNote: "y".repeat(700),
    photoEchoEnabled: false,
  });

  assert.deepEqual(normalized?.tags, ["refresh_walk", "first_visit"]);
  assert.equal(normalized?.echoNote.length, 80);
  assert.equal(normalized?.privateNote.length, 600);
  assert.equal(normalized?.photoEchoEnabled, false);
  assert.equal(normalized?.shouldPersist, true);
});

test("place memory empty input does not create a residual entry", () => {
  const normalized = normalizePlaceMemoryInput({
    tags: [],
    echoNote: " ",
    privateNote: "",
    photoEchoEnabled: true,
  });

  assert.equal(normalized?.shouldPersist, false);
});

test("place memory full v1 migration defines cell unlock, moderation, photo safety, and alerts", () => {
  const migration = readFileSync(join(process.cwd(), "db/migrations/0116_place_memory_full_v1.sql"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS place_memory_entries/);
  assert.match(migration, /cell_grid_m\s+INT\s+NOT NULL DEFAULT 1000/);
  assert.match(migration, /char_length\(echo_note\) <= 80/);
  assert.match(migration, /place_memory_photo_derivatives/);
  assert.match(migration, /blocked_sensitive/);
  assert.match(migration, /blocked_privacy_processing/);
  assert.match(migration, /place_memory_reports/);
  assert.match(migration, /place_memory_user_hides/);
  assert.match(migration, /place_memory_controls/);
  assert.match(migration, /place_memory_like/);
  assert.match(migration, /place_memory_admin/);
});

test("place memory route is registered in the write scope", () => {
  const app = readFileSync(join(process.cwd(), "src/app.ts"), "utf8");
  assert.match(app, /registerPlaceMemoryApiRoutes/);
  assert.match(app, /await registerWriteRoutes\(writeScope\);\s*await registerPlaceMemoryApiRoutes\(writeScope\);/);
});

test("place memory save UI does not link users to the raw JSON API", () => {
  const readRoute = readFileSync(join(process.cwd(), "src/routes/read.ts"), "utf8");
  assert.doesNotMatch(readRoute, /もっと見る<\/a>/);
  assert.doesNotMatch(readRoute, /withBasePath\('\/api\/v1\/place-memory\?cellId=/);
});

test("place memory constants stay aligned with public cell privacy", () => {
  const labels = placeMemoryTagLabelsJa();
  assert.equal(PLACE_MEMORY_GRID_M, 1000);
  assert.equal(labels.refresh_walk, "気分転換に歩いた");
  assert.equal(labels.walked_with_someone, "誰かと歩いた");
});
