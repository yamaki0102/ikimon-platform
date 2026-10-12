import assert from "node:assert/strict";
import test from "node:test";
import { parseBiosecurityCaptureMetadata } from "./biosecurityCaptureContext";

const NOW = Date.parse("2026-10-12T00:00:00Z");
const time = { source: "photo_exif", localDateTime: "2026-10-01T09:30:15", offsetMinutes: 540, precision: "second", photoIndex: 0 };
const metadata = (overrides: Record<string, unknown> = {}) => JSON.stringify({ version: 1, time, location: { source: "unknown", photoIndex: null }, conflicts: { time: false, location: false }, ...overrides });
const parse = (raw: string, date = "", count = 1, location = false) => parseBiosecurityCaptureMetadata(raw, date, count, location, NOW);

test("photo time retains its timezone and original local value without using upload time", () => {
  const result = parse(metadata());
  assert.equal(result.time.instant, "2026-10-01T00:30:15.000Z");
  assert.equal(result.time.localDateTime, time.localDateTime);
  assert.equal(result.time.offsetMinutes, 540);
  assert.equal(result.time.source, "photo_exif");
  assert.equal(result.time.photoIndex, 0);
});
test("unknown, day-only and timezone-unknown photo times stay genuinely nullable", () => {
  assert.equal(parse("").time.instant, null);
  assert.equal(parse(metadata({ time: { ...time, offsetMinutes: null } })).time.instant, null);
  const dateOnly = parse(metadata({ time: { ...time, localDateTime: "2026-10-01", precision: "date" } }));
  assert.equal(dateOnly.time.instant, null);
  assert.equal(dateOnly.time.precision, "date");
  const cleared = parse(metadata({ time: { source: "user", localDateTime: null, precision: "unknown", offsetMinutes: null, photoIndex: null }, originalTime: time }));
  assert.equal(cleared.time.source, "user"); assert.equal(cleared.time.instant, null);
  assert.equal(cleared.originalTime?.localDateTime, time.localDateTime);
});
test("invalid calendar values and mismatched precision cannot roll over into a valid date", () => {
  for (const localDateTime of ["2026-02-30T09:30:15", "2026-13-01T09:30:15", "2026-01-01T24:00:00", "2026-01-01T12:60:00", "2026-01-01T12:00:60", "0000-01-01T00:00:00", "2026-10-15T10:00:00"]) {
    assert.throws(() => parse(metadata({ time: { ...time, localDateTime } })), /observed_at_invalid/);
  }
  assert.throws(() => parse(metadata({ time: { ...time, precision: "minute" } })), /observed_at_invalid/);
  assert.equal(parse(metadata({ time: { ...time, localDateTime: "2024-02-29T09:30:15" } })).time.instant, "2024-02-29T00:30:15.000Z");
});
test("provenance, photo indices, timezone offsets and adopted GPS must agree", () => {
  assert.throws(() => parse(metadata({ time: { ...time, offsetMinutes: 841 } })), /offset_invalid/);
  assert.throws(() => parse(metadata({ time: { ...time, photoIndex: 1 } })), /photo_source_invalid/);
  assert.throws(() => parse(metadata({ time: { ...time, source: "user" } })), /photo_source_invalid/);
  assert.throws(() => parse(metadata({ location: { source: "photo_exif", photoIndex: 0 } })), /location_source_invalid/);
  assert.throws(() => parse(metadata(), "", 1, true), /location_source_invalid/);
  assert.throws(() => parse(metadata(), "2026-10-01T09:30:15Z"), /time_mismatch/);
  assert.equal(parse(metadata({ location: { source: "photo_exif", photoIndex: 0 } }), "", 1, true).location.source, "photo_exif");
  assert.throws(() => parse(metadata({ time: { ...time, source: ["user"], photoIndex: null } })), /time_source_invalid/);
  assert.throws(() => parse(metadata({ location: { source: ["device"], photoIndex: null } }), "", 1, true), /location_source_invalid/);
});
test("older clients retain their explicit ISO instants and never receive a now fallback", () => {
  assert.equal(parse("", "2026-10-01T09:30:00+09:00").time.instant, "2026-10-01T00:30:00.000Z");
  assert.equal(parse("", "2026-10-01T00:30:00.123Z").time.instant, "2026-10-01T00:30:00.123Z");
  assert.equal(parse("", "2026-10-01T09:30:00-00:00").time.instant, null);
  assert.equal(parse("", "2026-10-01T09:30:00-00:00").time.localDateTime, "2026-10-01T09:30:00");
  assert.throws(() => parse("", "2026-02-30T00:30:00Z"), /observed_at_invalid/);
  assert.throws(() => parse("", "2026-10-01T09:30:00"), /observed_at_invalid/);
  assert.throws(() => parse("", "2026-10-01T09:30:00+09:99"), /offset_invalid/);
});
