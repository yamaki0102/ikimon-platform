import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("observation event capsule routes are organizer gated and expose review lifecycle", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "observationEventRecapApi.ts"), "utf8");

  assert.match(source, /\/api\/v1\/observation-events\/:sessionId\/capsule\/generate/);
  assert.match(source, /\/api\/v1\/observation-events\/:sessionId\/capsule"/);
  assert.match(source, /\/api\/v1\/observation-events\/:sessionId\/capsule\/review/);
  assert.match(source, /generatePlaceEventCapsule/);
  assert.match(source, /updatePlaceEventCapsuleReviewStatus/);
  assert.match(source, /auth\?\.userId === session\.organizerUserId/);
  assert.match(source, /privacy_risk_queue_not_resolved/);
});

test("observation event live stream accepts guide and field scan source events", () => {
  const liveSource = readFileSync(path.join(process.cwd(), "src", "services", "observationEventLive.ts"), "utf8");
  const migration = readFileSync(path.join(process.cwd(), "db", "migrations", "0104_observation_event_capsules.sql"), "utf8");

  assert.match(liveSource, /"guide_scene_added"/);
  assert.match(liveSource, /"field_scan_added"/);
  assert.match(migration, /'guide_scene_added'/);
  assert.match(migration, /'field_scan_added'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS observation_event_capsules/);
});
