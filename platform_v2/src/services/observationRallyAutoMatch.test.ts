import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  haversineDistanceMeters,
  isObservationWithinRallyStation,
} from "./observationRallyAutoMatch.js";

test("haversine distance is zero for the same point", () => {
  assert.equal(
    haversineDistanceMeters(
      { lat: 34.7108, lng: 137.7261 },
      { lat: 34.7108, lng: 137.7261 },
    ),
    0,
  );
});

test("station matching respects the configured radius", () => {
  const station = { lat: 34.7108, lng: 137.7261, radiusM: 100 };
  const near = isObservationWithinRallyStation(
    { lat: 34.71125, lng: 137.7261 },
    station,
  );
  const far = isObservationWithinRallyStation(
    { lat: 34.713, lng: 137.7261 },
    station,
  );

  assert.equal(near.matched, true);
  assert.ok(near.distanceM > 40 && near.distanceM < 60);
  assert.equal(far.matched, false);
  assert.ok(far.distanceM > 200);
});

test("auto-match implementation stays post-save, non-blocking and idempotent", () => {
  const dualWrite = readFileSync(
    path.join(process.cwd(), "src/services/observationEventDualWrite.ts"),
    "utf8",
  );
  const autoMatch = readFileSync(
    path.join(process.cwd(), "src/services/observationRallyAutoMatch.ts"),
    "utf8",
  );
  const postgresMigration = readFileSync(
    path.join(process.cwd(), "db/migrations/0117_observation_rally_submission_idempotency.sql"),
    "utf8",
  );

  assert.match(dualWrite, /autoMatchObservationToActiveRallies/);
  assert.match(dualWrite, /observation rally auto-match failed/);
  assert.match(autoMatch, /source_type[\s\S]*'observation_auto_match'/);
  assert.match(autoMatch, /ON CONFLICT DO NOTHING/);
  assert.match(autoMatch, /exact_location_used: true/);
  assert.match(autoMatch, /course\.status = 'live'/);
  assert.match(autoMatch, /mission\.status = 'published'/);
  assert.match(autoMatch, /station\.status = 'open'/);
  assert.match(autoMatch, /station\.lat BETWEEN/);
  assert.match(postgresMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_rally_submission_source_once/);
});
