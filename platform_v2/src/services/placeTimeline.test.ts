import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlaceTimeline,
  type PlaceTimelineInputRecord,
} from "./placeTimeline.js";

const NOW = new Date("2026-07-26T00:00:00.000Z");

function record(overrides: Partial<PlaceTimelineInputRecord> = {}): PlaceTimelineInputRecord {
  return {
    recordId: "record-1",
    observedAt: "2026-07-01T10:00:00+09:00",
    publicEligible: true,
    displayLabel: "現在の記録",
    publicMediaUrl: "/derived/example/display.webp",
    sourceLabel: "現地記録",
    verificationState: "verified",
    ...overrides,
  };
}

test("empty input returns an explicit empty state and first-record suggestion", () => {
  const result = buildPlaceTimeline([], { now: NOW });
  assert.equal(result.state, "empty");
  assert.equal(result.summaryKey, "no_public_records");
  assert.equal(result.recordCount, 0);
  assert.equal(result.recordingSuggestion, "first_record");
  assert.equal(result.changeAssessment, "not_assessed");
});

test("non-public records fail closed", () => {
  const result = buildPlaceTimeline([
    record({ publicEligible: false }),
  ], { now: NOW });
  assert.equal(result.state, "empty");
  assert.equal(result.excluded.notPublicEligible, 1);
});

test("invalid IDs and ambiguous or impossible dates are excluded", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "", observedAt: "2026-07-01T10:00:00Z" }),
    record({ recordId: "bad id", observedAt: "2026-07-01T10:00:00Z" }),
    record({ recordId: "bad-date", observedAt: "2026-02-30" }),
    record({ recordId: "no-zone", observedAt: "2026-07-01T10:00:00" }),
  ], { now: NOW });
  assert.equal(result.state, "empty");
  assert.equal(result.excluded.invalidRecordId, 2);
  assert.equal(result.excluded.invalidObservedAt, 2);
});

test("duplicate Record IDs are deterministically reduced to the newest valid candidate", () => {
  const result = buildPlaceTimeline([
    record({
      recordId: "record-duplicate",
      observedAt: "2025-01-01T00:00:00Z",
      displayLabel: "old",
      verificationState: "verified",
    }),
    record({
      recordId: "record-duplicate",
      observedAt: "2026-01-01T00:00:00Z",
      displayLabel: "new",
      verificationState: "candidate",
    }),
  ], { now: NOW });
  assert.equal(result.recordCount, 1);
  assert.equal(result.excluded.duplicateRecordId, 1);
  assert.equal(result.periods[0]?.items[0]?.displayLabel, "new");
});

test("one valid observation date is single_period and never claims change", () => {
  const result = buildPlaceTimeline([record()], { now: NOW });
  assert.equal(result.state, "single_period");
  assert.equal(result.distinctPeriodCount, 1);
  assert.equal(result.summaryKey, "one_observation_period");
  assert.equal(result.changeAssessment, "not_assessed");
});

test("two distinct observation dates form a chronological timeline without a change claim", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "record-new", observedAt: "2026-07-01T10:00:00+09:00" }),
    record({ recordId: "record-old", observedAt: "2024-03-05" }),
  ], { now: NOW });
  assert.equal(result.state, "timeline");
  assert.equal(result.distinctPeriodCount, 2);
  assert.deepEqual(result.periods.map((period) => period.periodKey), ["2024-03-05", "2026-07-01"]);
  assert.equal(result.changeAssessment, "not_assessed");
});

test("multiple Records on the same observation date stay in one period", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "record-a", observedAt: "2026-07-01T01:00:00Z" }),
    record({ recordId: "record-b", observedAt: "2026-07-01T20:00:00Z" }),
  ], { now: NOW });
  assert.equal(result.state, "single_period");
  assert.equal(result.recordCount, 2);
  assert.equal(result.periods[0]?.items.length, 2);
});

test("input order does not change the result", () => {
  const inputs = [
    record({ recordId: "record-b", observedAt: "2026-07-02T00:00:00Z" }),
    record({ recordId: "record-a", observedAt: "2025-07-02T00:00:00Z" }),
    record({ recordId: "record-a", observedAt: "2024-07-02T00:00:00Z" }),
  ];
  const first = buildPlaceTimeline(inputs, { now: NOW });
  const second = buildPlaceTimeline([...inputs].reverse(), { now: NOW });
  assert.deepEqual(second, first);
});

test("observations beyond the future tolerance fail closed", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "future", observedAt: "2027-01-01T00:00:00Z" }),
  ], { now: NOW, futureToleranceDays: 1 });
  assert.equal(result.state, "empty");
  assert.equal(result.excluded.futureObservedAt, 1);
});

test("stale latest Record suggests a revisit", () => {
  const result = buildPlaceTimeline([
    record({ observedAt: "2025-01-01T00:00:00Z" }),
  ], { now: NOW, recentWindowDays: 180 });
  assert.equal(result.recordingSuggestion, "revisit");
});

test("recent Record does not suggest a revisit", () => {
  const result = buildPlaceTimeline([
    record({ observedAt: "2026-07-01T00:00:00Z" }),
  ], { now: NOW, recentWindowDays: 180 });
  assert.equal(result.recordingSuggestion, "none");
});

test("unsafe public media URLs are removed", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "relative-api", publicMediaUrl: "/api/v1/auth/session" }),
    record({ recordId: "absolute-api", publicMediaUrl: "https://ikimon.life/api/v1/auth/session" }),
    record({ recordId: "zukan-media", publicMediaUrl: "https://media.zukan.earth/derived/example/display.webp" }),
    record({ recordId: "allowed-media", publicMediaUrl: "https://media.ikimon.life/derived/example/display.webp" }),
    record({ recordId: "evil-zukan-suffix", publicMediaUrl: "https://zukan.earth.evil.example/derived/example/display.webp" }),
    record({ recordId: "evil-legacy-suffix", publicMediaUrl: "https://ikimon.life.evil.example/derived/example/display.webp" }),
  ], { now: NOW });
  assert.equal(result.periods[0]?.items.find((item) => item.recordId === "relative-api")?.publicMediaUrl, null);
  assert.equal(result.periods[0]?.items.find((item) => item.recordId === "absolute-api")?.publicMediaUrl, null);
  assert.equal(
    result.periods[0]?.items.find((item) => item.recordId === "allowed-media")?.publicMediaUrl,
    "https://media.ikimon.life/derived/example/display.webp",
  );
  assert.equal(
    result.periods[0]?.items.find((item) => item.recordId === "zukan-media")?.publicMediaUrl,
    "https://media.zukan.earth/derived/example/display.webp",
  );
  assert.equal(result.periods[0]?.items.find((item) => item.recordId === "evil-zukan-suffix")?.publicMediaUrl, null);
  assert.equal(result.periods[0]?.items.find((item) => item.recordId === "evil-legacy-suffix")?.publicMediaUrl, null);
});

test("periods are ordered by observation date even when timezone instants cross", () => {
  const result = buildPlaceTimeline([
    record({ recordId: "local-later", observedAt: "2026-07-02T00:30:00+14:00" }),
    record({ recordId: "local-earlier", observedAt: "2026-07-01T23:30:00-12:00" }),
  ], { now: NOW });
  assert.deepEqual(result.periods.map((period) => period.periodKey), ["2026-07-01", "2026-07-02"]);
});

test("extra exact coordinates and owner identity are never projected", () => {
  const unsafeInput = {
    ...record(),
    exactLat: 34.7,
    exactLng: 137.8,
    ownerId: "user-secret",
  } as PlaceTimelineInputRecord;
  const result = buildPlaceTimeline([unsafeInput], { now: NOW });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /exactLat|exactLng|ownerId|user-secret/u);
});

test("invalid build options fail fast", () => {
  assert.throws(
    () => buildPlaceTimeline([], { now: new Date("invalid") }),
    /place_timeline_invalid_now/u,
  );
  assert.throws(
    () => buildPlaceTimeline([], { now: NOW, recentWindowDays: -1 }),
    /place_timeline_invalid_recent_window_days/u,
  );
});
