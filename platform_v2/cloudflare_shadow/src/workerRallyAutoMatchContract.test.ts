import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readWorkerSourceSync } from "./workerSource.testSupport.js";

const workerSource = readWorkerSourceSync();
const boundarySource = readFileSync(path.join(process.cwd(), "scripts/d1-migration-boundary-report.mjs"), "utf8");
const migrationSource = readFileSync(
  path.join(process.cwd(), "migrations/observations/0065_observation_rally_submission_idempotency.sql"),
  "utf8",
);

test("Worker auto-matches only active station-bound rally missions for eligible participants", () => {
  assert.match(workerSource, /async function autoMatchObservationToActiveRalliesNative/);
  assert.match(workerSource, /course\.status = 'live'/);
  assert.match(workerSource, /mission\.status = 'published'/);
  assert.match(workerSource, /station\.status = 'open'/);
  assert.match(workerSource, /mission\.location_binding IN \('station_required', 'any_registered_station'\)/);
  assert.match(workerSource, /event_session\.organizer_user_id = \?/);
  assert.match(workerSource, /FROM observation_event_participants participant/);
  assert.match(workerSource, /participant\.status IN \('registered', 'checked_in'\)/);
  assert.match(workerSource, /\[observation-rally-auto-match\] native post-save match failed/);
  assert.match(workerSource, /await autoMatchObservationToActiveRalliesNative[\s\S]*await hookLegacyObservationToEventNative/);
});

test("Worker rally matching uses exact coordinates only for distance and stores public coordinates", () => {
  assert.match(workerSource, /observationRallyDistanceMeters/);
  assert.match(workerSource, /roundPublicEventCoordinate\(input\.lat\)/);
  assert.match(workerSource, /roundPublicEventCoordinate\(input\.lng\)/);
  assert.match(workerSource, /exact_location_used: true/);
  assert.match(workerSource, /exact_location_stored: false/);
  assert.doesNotMatch(workerSource, /source: "observation_post_save_auto_match"[\s\S]{0,500}exact_lat/);
  assert.doesNotMatch(workerSource, /source: "observation_post_save_auto_match"[\s\S]{0,500}exact_lng/);
});

test("Worker rally auto-match is retry-safe and only auto-accepts auto verification", () => {
  assert.match(workerSource, /SELECT submission_id[\s\S]*source_type = 'observation_auto_match'/);
  assert.match(workerSource, /INSERT OR IGNORE INTO observation_rally_submissions/);
  assert.match(workerSource, /candidate\.verification_policy === "auto" \? "auto_accepted" : "pending"/);
  assert.match(workerSource, /Number\(insertResult\.meta\?\.changes \?\? 1\) === 0/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_rally_submission_source_once/);
  assert.match(boundarySource, /"platform_v2\/src\/services\/observationRallyAutoMatch\.ts": "cloudflare_observation_rally_post_save_auto_match"/);
});

test("D1 rally submission migration removes only duplicate retry identities", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE observation_rally_submissions (
      submission_id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      user_id TEXT,
      guest_token TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO observation_rally_submissions VALUES
      ('first', 'mission-1', 'observation_auto_match', 'visit-1', 'user-1', NULL, '2026-07-10T00:00:00Z'),
      ('retry', 'mission-1', 'observation_auto_match', 'visit-1', 'user-1', NULL, '2026-07-10T00:01:00Z'),
      ('other-user', 'mission-1', 'observation_auto_match', 'visit-1', 'user-2', NULL, '2026-07-10T00:02:00Z'),
      ('guest', 'mission-1', 'observation_auto_match', 'visit-1', NULL, 'guest-1', '2026-07-10T00:02:30Z'),
      ('manual', 'mission-1', 'manual_rally', NULL, 'user-1', NULL, '2026-07-10T00:03:00Z');
  `);
  db.exec(migrationSource);

  const remaining = db.prepare("SELECT submission_id FROM observation_rally_submissions ORDER BY submission_id").all()
    .map((row) => String(row.submission_id));
  assert.deepEqual(remaining, ["first", "guest", "manual", "other-user"]);
  assert.throws(
    () => db.exec("INSERT INTO observation_rally_submissions VALUES ('retry-2', 'mission-1', 'observation_auto_match', 'visit-1', 'user-1', NULL, '2026-07-10T00:04:00Z')"),
    /UNIQUE constraint failed/i,
  );
  db.exec("INSERT INTO observation_rally_submissions VALUES ('other-source', 'mission-1', 'manual_rally', 'visit-1', 'user-1', NULL, '2026-07-10T00:05:00Z')");
  db.close();
});
