import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSharedArrivalContext,
  appendSharedArrivalContextToLocalHrefs,
  collectSharedArrivalContext,
} from "./sharedArrivalContext";

test("collects only the first safe value for the shared-arrival allowlist", () => {
  const query = new URLSearchParams();
  query.append("from", "LINE");
  query.append("from", "instagram");
  query.append("source", "nature-share.v2");
  query.append("utm_source", "Instagram");
  query.append("utm_medium", "story_tap");
  query.append("share", "timeline-1");
  query.append("invite", "event-day");
  query.append("event", "bioblitz-2026");
  query.append("subject", "occ:record-1:0");
  query.append("redirect", "javascript:alert(1)");

  assert.deepEqual(collectSharedArrivalContext(query), {
    from: "line",
    source: "nature-share.v2",
    utm_source: "instagram",
    utm_medium: "story_tap",
    share: "timeline-1",
    invite: "event-day",
    event: "bioblitz-2026",
  });
});

test("rejects URLs, protocols, emails, coordinates, long tokens, free text and unknown keys", () => {
  assert.deepEqual(collectSharedArrivalContext({
    from: "https://evil.example/path",
    source: "javascript:alert(1)",
    utm_source: "alice@example.com",
    utm_medium: "35.681236",
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
  }), {});
});

test("appends safe context to local follow-up links while retaining query, hash and HTML encoding", () => {
  const context = collectSharedArrivalContext({ from: "Line", utm_source: "Instagram" });
  assert.equal(
    appendSharedArrivalContext("/ja/record?start=gallery&revisit=record-1#top", context),
    "/ja/record?start=gallery&revisit=record-1&from=line&utm_source=instagram#top",
  );
  assert.equal(appendSharedArrivalContext("#identify", context), "#identify");
  assert.equal(appendSharedArrivalContext("https://other.example/record", context), "https://other.example/record");
  assert.equal(appendSharedArrivalContext("//other.example/record", context), "//other.example/record");
  assert.equal(appendSharedArrivalContext("javascript:alert(1)", context), "javascript:alert(1)");
  assert.equal(
    appendSharedArrivalContextToLocalHrefs('<a href="/record?start=gallery&amp;view=photo#top">Continue</a><a href="/ja/observations/next?subject=occ%3A1">Related</a><a href="/map">Map</a><a href="https://other.example/">External</a><script>const a = \'<a href="/record">dynamic</a>\';</script>', context),
    '<a href="/record?start=gallery&amp;view=photo&amp;from=line&amp;utm_source=instagram#top">Continue</a><a href="/ja/observations/next?subject=occ%3A1&amp;from=line&amp;utm_source=instagram">Related</a><a href="/map">Map</a><a href="https://other.example/">External</a><script>const a = \'<a href="/record">dynamic</a>\';</script>',
  );
});
