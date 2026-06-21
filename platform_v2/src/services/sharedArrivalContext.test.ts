import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSharedArrivalContext,
  collectSharedArrivalContext,
  hasSharedArrivalContext,
} from "./sharedArrivalContext.js";

test("collectSharedArrivalContext keeps only safe shared source keys", () => {
  const context = collectSharedArrivalContext(new URLSearchParams({
    from: "Line",
    source: "sns-feed",
    utm_source: "Instagram",
    utm_medium: "story.tap",
    share: "timeline_1",
    invite: "event-day",
    event: "bioblitz-2026",
    subject: "occ:record-1:0",
    occurrence: "occ:record-1:1",
  }));

  assert.deepEqual(context, {
    from: "line",
    source: "sns-feed",
    utm_source: "instagram",
    utm_medium: "story.tap",
    share: "timeline_1",
    invite: "event-day",
    event: "bioblitz-2026",
  });
  assert.equal(hasSharedArrivalContext(context), true);
});

test("collectSharedArrivalContext drops URLs emails coordinates raw tokens free text and unknown keys", () => {
  const context = collectSharedArrivalContext({
    from: "https://evil.example/path",
    source: "alice@example.com",
    utm_source: "35.681236",
    utm_medium: "social campaign",
    share: "x".repeat(33),
    invite: "0123456789abcdef0123456789abcdef",
    event: "spring/walk",
    lat: "35.1",
    lng: "139.1",
    latitude: "35.1",
    longitude: "139.1",
    localityNote: "home near station",
    redirect: "/record",
    next: "record",
  });

  assert.deepEqual(context, {});
  assert.equal(hasSharedArrivalContext(context), false);
});

test("appendSharedArrivalContext preserves existing query and hash without touching fragment links", () => {
  const context = collectSharedArrivalContext({
    from: "line",
    utm_source: "instagram",
    subject: "occ:record-1:0",
    localityNote: "free text",
  });

  assert.equal(
    appendSharedArrivalContext("/ja/record?start=gallery&revisitObservationId=record-1#top", context),
    "/ja/record?start=gallery&revisitObservationId=record-1&from=line&utm_source=instagram#top",
  );
  assert.equal(appendSharedArrivalContext("#identify", context), "#identify");
});
