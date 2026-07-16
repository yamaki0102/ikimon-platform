import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiSource = readFileSync(new URL("./observationEventApi.ts", import.meta.url), "utf8");
const pagesSource = readFileSync(new URL("./observationEventPages.ts", import.meta.url), "utf8");
const recapSource = readFileSync(new URL("./observationEventRecapApi.ts", import.meta.url), "utf8");
const rallySource = readFileSync(new URL("../services/observationRally.ts", import.meta.url), "utf8");

function routeBlock(source: string, path: string): string {
  const start = source.indexOf(`"${path}"`);
  assert.notEqual(start, -1, `missing route ${path}`);
  const end = source.indexOf("\n  //", start);
  return source.slice(start, end < 0 ? undefined : end);
}

test("recap, recent, and live surfaces require an event participant or organizer", () => {
  const recent = routeBlock(apiSource, "/api/v1/observation-events/:sessionId/recent");
  const recapApi = routeBlock(recapSource, "/api/v1/observation-events/:sessionId/recap");
  const recapByCode = routeBlock(recapSource, "/api/v1/observation-events/by-code/:eventCode/recap");
  const rallyApi = routeBlock(apiSource, "/api/v1/observation-events/:sessionId/rally");
  const livePage = routeBlock(pagesSource, "/events/:sessionId/live");
  const rallyPage = routeBlock(pagesSource, "/events/:sessionId/rally");
  const recapPage = routeBlock(pagesSource, "/events/:sessionId/recap");

  for (const block of [recent, recapApi, recapByCode, rallyApi, livePage, rallyPage, recapPage]) {
    assert.match(block, /requireObservationEventViewerAccess/);
    assert.match(block, /event participant required/);
  }

  for (const block of [recent, recapApi, recapByCode, rallyApi]) {
    assert.match(block, /Cache-Control", "private, no-store/);
    assert.match(block, /Vary", "Cookie/);
  }
  assert.doesNotMatch(rallyApi, /send\(\{\s*session\s*,/);
});

test("recent responses use the public timeline allowlist", () => {
  const recent = routeBlock(apiSource, "/api/v1/observation-events/:sessionId/recent");
  assert.match(recent, /sanitizeObservationEventTimeline/);
});

test("authenticated check-in promotes and invalidates any event guest identity", () => {
  const checkin = routeBlock(apiSource, "/api/v1/observation-events/:sessionId/checkin");
  assert.match(checkin, /isObservationEventCheckinOpen/);
  assert.match(checkin, /promoteObservationEventGuestIdentity/);
  assert.match(checkin, /auth && guestCredentialDigest/);
  assert.doesNotMatch(checkin, /NOT EXISTS/);
});

test("rally live events do not embed the raw submission record", () => {
  assert.doesNotMatch(rallySource, /payload:\s*\{\s*submission\s*,/);
});
