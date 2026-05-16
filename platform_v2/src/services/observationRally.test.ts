import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateProgressPercent,
  defaultCountingPolicy,
  isLocationShareOpen,
  locationShareUntil,
  planRallyWeatherModeSwitch,
  progressStatus,
  resolveLocationShareConsent,
  shouldPublishMissionForWeatherMode,
  shouldReplaceMissionForWeatherMode,
} from "./observationRally.js";

test("rally progress is not capped at 100 percent", () => {
  assert.equal(calculateProgressPercent(42, 20), 210);
  assert.equal(progressStatus(210), "exceeded");
  assert.equal(progressStatus(100), "reached");
});

test("counting policy makes scene and individual counts explicit", () => {
  assert.match(String(defaultCountingPolicy("scene").multi_subject_photo), /1カウント/);
  assert.match(String(defaultCountingPolicy("individual").multi_subject_photo), /分割確認後のみ複数カウント/);
  assert.match(String(defaultCountingPolicy("location").one_count), /1地点/);
});

test("location share consent allows adults and guardian-approved minors only", () => {
  assert.equal(resolveLocationShareConsent({ wantsShare: true, isMinor: false }), "self");
  assert.equal(resolveLocationShareConsent({ wantsShare: false, isMinor: false }), null);
  assert.equal(resolveLocationShareConsent({ wantsShare: true, isMinor: true }), null);
  assert.equal(
    resolveLocationShareConsent({ wantsShare: true, isMinor: true, guardianConsent: true }),
    "guardian",
  );
});

test("location share window is restricted to event time with a four hour live default", () => {
  const liveSession = { startedAt: "2026-05-16T01:00:00.000Z", endedAt: null };
  assert.equal(locationShareUntil(liveSession)?.toISOString(), "2026-05-16T05:00:00.000Z");
  assert.equal(isLocationShareOpen(liveSession, new Date("2026-05-16T00:59:59.000Z")), false);
  assert.equal(isLocationShareOpen(liveSession, new Date("2026-05-16T03:00:00.000Z")), true);
  assert.equal(isLocationShareOpen(liveSession, new Date("2026-05-16T05:00:01.000Z")), false);

  const endedSession = { startedAt: "2026-05-16T01:00:00.000Z", endedAt: "2026-05-16T02:30:00.000Z" };
  assert.equal(locationShareUntil(endedSession)?.toISOString(), "2026-05-16T02:30:00.000Z");
  assert.equal(isLocationShareOpen(endedSession, new Date("2026-05-16T02:45:00.000Z")), false);
});

test("rain weather mode swaps only matching fallback groups", () => {
  assert.equal(
    shouldReplaceMissionForWeatherMode({
      fallbackGroup: "tree-main",
      status: "published",
      weatherSensitivity: "sunny_only",
    }, "rain"),
    true,
  );
  assert.equal(
    shouldReplaceMissionForWeatherMode({
      fallbackGroup: "",
      status: "published",
      weatherSensitivity: "sunny_only",
    }, "rain"),
    false,
  );
  assert.equal(
    shouldPublishMissionForWeatherMode({
      fallbackGroup: "tree-main",
      status: "paused",
      weatherSensitivity: "rain_ok",
    }, "rain", new Set(["tree-main"])),
    true,
  );
  assert.equal(
    shouldPublishMissionForWeatherMode({
      fallbackGroup: "other",
      status: "paused",
      weatherSensitivity: "rain_ok",
    }, "rain", new Set(["tree-main"])),
    false,
  );
});

test("rain weather mode plan keeps unrelated and already closed missions untouched", () => {
  const plan = planRallyWeatherModeSwitch([
    { missionId: "sunny-1", fallbackGroup: "tree-main", status: "published", weatherSensitivity: "sunny_only" },
    { missionId: "dry-1", fallbackGroup: "leaf-main", status: "published", weatherSensitivity: "dry_only" },
    { missionId: "rain-1", fallbackGroup: "tree-main", status: "paused", weatherSensitivity: "rain_ok" },
    { missionId: "rain-2", fallbackGroup: "leaf-main", status: "draft", weatherSensitivity: "all_weather" },
    { missionId: "orphan-rain", fallbackGroup: "orphan", status: "paused", weatherSensitivity: "rain_ok" },
    { missionId: "closed-sunny", fallbackGroup: "tree-main", status: "closed", weatherSensitivity: "sunny_only" },
    { missionId: "no-group", fallbackGroup: "", status: "published", weatherSensitivity: "sunny_only" },
  ], "rain");

  assert.deepEqual(plan.replaceMissionIds, ["sunny-1", "dry-1"]);
  assert.deepEqual(plan.publishMissionIds, ["rain-1", "rain-2"]);
  assert.deepEqual(plan.fallbackGroups, ["tree-main", "leaf-main"]);
});
