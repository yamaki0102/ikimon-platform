import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyActorClassFromMetrics,
  classifyEffortActors,
  type EffortActivityPoint,
} from "./mapEffort.js";

test("classifyActorClassFromMetrics marks repeat visits as local steward", () => {
  assert.equal(
    classifyActorClassFromMetrics({
      totalActivities: 6,
      uniqueDays: 4,
      distinctPlaces: 3,
      revisitPlaces: 2,
    }),
    "local_steward",
  );
});

test("classifyActorClassFromMetrics marks dispersed short bursts as traveler", () => {
  assert.equal(
    classifyActorClassFromMetrics({
      totalActivities: 5,
      uniqueDays: 2,
      distinctPlaces: 5,
      revisitPlaces: 0,
    }),
    "traveler",
  );
});

test("classifyEffortActors separates casual, traveler, and local steward users", () => {
  const activities: EffortActivityPoint[] = [
    { kind: "note", lat: 34.71, lng: 137.72, userId: "local", timestamp: "2026-04-01T09:00:00.000Z", placeKey: "p-1" },
    { kind: "guide", lat: 34.71, lng: 137.72, userId: "local", timestamp: "2026-04-02T09:00:00.000Z", placeKey: "p-1" },
    { kind: "note", lat: 34.72, lng: 137.73, userId: "local", timestamp: "2026-04-09T09:00:00.000Z", placeKey: "p-2" },
    { kind: "scan", lat: 34.73, lng: 137.74, userId: "local", timestamp: "2026-04-15T09:00:00.000Z", placeKey: "p-2" },
    { kind: "note", lat: 34.70, lng: 137.71, userId: "traveler", timestamp: "2026-04-10T09:00:00.000Z", placeKey: "t-1" },
    { kind: "scan", lat: 34.76, lng: 137.75, userId: "traveler", timestamp: "2026-04-10T11:00:00.000Z", placeKey: "t-2" },
    { kind: "guide", lat: 34.79, lng: 137.79, userId: "traveler", timestamp: "2026-04-11T09:00:00.000Z", placeKey: "t-3" },
    { kind: "note", lat: 34.81, lng: 137.81, userId: "traveler", timestamp: "2026-04-11T12:00:00.000Z", placeKey: "t-4" },
    { kind: "note", lat: 34.75, lng: 137.75, userId: "casual", timestamp: "2026-04-20T09:00:00.000Z", placeKey: "c-1" },
  ];

  const actors = classifyEffortActors(activities);

  assert.equal(actors.local, "local_steward");
  assert.equal(actors.traveler, "traveler");
  assert.equal(actors.casual, "casual");
});
