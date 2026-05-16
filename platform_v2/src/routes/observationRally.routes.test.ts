import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildApp } from "../app.js";

test("observation rally routes expose flexible mission operation and organizer-gated editing", () => {
  const apiSource = readFileSync(path.join(process.cwd(), "src", "routes", "observationEventApi.ts"), "utf8");
  const serviceSource = readFileSync(path.join(process.cwd(), "src", "services", "observationRally.ts"), "utf8");

  assert.match(apiSource, /\/api\/v1\/observation-events\/:sessionId\/rally/);
  assert.match(apiSource, /\/api\/v1\/observation-events\/:sessionId\/rally\/stations/);
  assert.match(apiSource, /\/api\/v1\/observation-events\/:sessionId\/rally\/missions/);
  assert.match(apiSource, /\/api\/v1\/observation-events\/:sessionId\/rally\/preflight\/weather-mode/);
  assert.match(apiSource, /\/api\/v1\/observation-events\/:sessionId\/rally\/submissions/);
  assert.match(serviceSource, /station_required_mission_needs_station_id/);
  assert.match(serviceSource, /switchRallyWeatherMode/);
  assert.match(serviceSource, /shouldReplaceMissionForWeatherMode/);
  assert.match(apiSource, /organizer only/);
  assert.match(apiSource, /publish", "pause", "replace", "extend", "close"/);
});

test("rally live events and migration include over-goal progress and time-limited location sharing", () => {
  const liveSource = readFileSync(path.join(process.cwd(), "src", "services", "observationEventLive.ts"), "utf8");
  const apiSource = readFileSync(path.join(process.cwd(), "src", "routes", "observationEventApi.ts"), "utf8");
  const migration = readFileSync(path.join(process.cwd(), "db", "migrations", "0110_observation_rally_foundation.sql"), "utf8");

  assert.match(liveSource, /"rally_goal_exceeded"/);
  assert.match(liveSource, /"participant_location_ping"/);
  assert.match(apiSource, /isLocationShareOpen\(session\)/);
  assert.match(apiSource, /scope: "organizer"/);
  assert.match(apiSource, /location_share_until >= NOW\(\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS observation_rally_missions/);
  assert.match(migration, /location_binding IN \('none', 'station_required', 'within_area', 'near_route', 'any_registered_station'\)/);
  assert.match(migration, /count_unit IN \('scene', 'individual', 'location', 'comparison_pair', 'station_clear', 'team_completion'\)/);
  assert.match(migration, /participant_location_ping/);
});

test("rally organizer mutation routes are gated before database writes", async () => {
  const app = buildApp();
  try {
    const weather = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events/00000000-0000-0000-0000-000000000000/rally/preflight/weather-mode",
      payload: { mode: "rain" },
    });
    assert.equal(weather.statusCode, 401);
    assert.deepEqual(weather.json(), { error: "login required" });

    const mission = await app.inject({
      method: "POST",
      url: "/api/v1/observation-events/00000000-0000-0000-0000-000000000000/rally/missions",
      payload: {
        title: "雨天用ミッション",
        target: "落ち葉",
        goal_count: 5,
        fallback_group: "rain-test",
      },
    });
    assert.equal(mission.statusCode, 401);
    assert.deepEqual(mission.json(), { error: "login required" });
  } finally {
    await app.close();
  }
});
