import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pagesSource = readFileSync(new URL("./observationEventPages.ts", import.meta.url), "utf8");
const recapSource = readFileSync(new URL("./observationEventRecapApi.ts", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("./observationEventApi.ts", import.meta.url), "utf8");
const participantAccessSource = readFileSync(
  new URL("../services/observationEventParticipantAccess.ts", import.meta.url),
  "utf8",
);
const stagingJourneySource = readFileSync(
  new URL("../../e2e/renri-science-adventure-journey.staging.spec.ts", import.meta.url),
  "utf8",
);
const stagingRallySource = readFileSync(
  new URL("../../e2e/observation-rally.staging.spec.ts", import.meta.url),
  "utf8",
);

function routeBlock(path: string): string {
  const start = apiSource.indexOf(`"${path}"`);
  assert.notEqual(start, -1, `missing route ${path}`);
  const end = apiSource.indexOf("\n  //", start);
  return apiSource.slice(start, end < 0 ? undefined : end);
}

test("event pages issue the host-only guest cookie and never put credentials in URLs", () => {
  assert.match(pagesSource, /createObservationEventGuestCredential/);
  assert.match(pagesSource, /buildObservationEventGuestCookie/);
  assert.match(pagesSource, /requireObservationEventViewerAccess/);
  assert.match(participantAccessSource, /observationEventGuestCredentialDigestFromCookie/);
  assert.match(pagesSource, /!auth && !readObservationEventGuestCredential/);
  assert.doesNotMatch(pagesSource, /request\.query\.token|guestToken:/);

  const join = (() => {
    const start = pagesSource.indexOf('"/community/events/:eventCode/join"');
    assert.notEqual(start, -1);
    const end = pagesSource.indexOf("\n  //", start);
    return pagesSource.slice(start, end);
  })();
  assert.match(join, /isObservationEventCheckinOpen/);
  assert.match(join, /code\(303\)\.redirect/);
  assert.ok(join.indexOf("isObservationEventCheckinOpen") < join.indexOf("createObservationEventGuestCredential"));
});

test("recap APIs ignore query credentials and resolve the per-event cookie digest", () => {
  assert.match(recapSource, /requireObservationEventViewerAccess/);
  assert.match(participantAccessSource, /observationEventGuestCredentialDigestFromCookie/);
  assert.doesNotMatch(recapSource, /request\.query\.token/);
});

test("participant mutations use same-origin requests and server-side cookie identity", () => {
  assert.match(apiSource, /assertSameOriginRequest/);
  assert.match(apiSource, /observationEventGuestCredentialDigestFromCookie/);
  assert.doesNotMatch(apiSource, /request\.body\?\.guest_token/);
  assert.doesNotMatch(apiSource, /guestTokenOverride/);

  for (const path of [
    "/api/v1/observation-events/:sessionId/checkin",
    "/api/v1/observation-events/:sessionId/absences",
    "/api/v1/observation-events/:sessionId/role",
    "/api/v1/observation-events/:sessionId/rally/submissions",
    "/api/v1/observation-events/:sessionId/location",
  ]) {
    assert.match(routeBlock(path), /assertSameOriginRequest\(request\)/, path);
  }

  const checkin = routeBlock("/api/v1/observation-events/:sessionId/checkin");
  assert.match(checkin, /share_location === true/);
  assert.match(checkin, /guardian consent required for minor location sharing/);
  assert.doesNotMatch(checkin, /request\.body\?\.location_share_consent_type/);
});

test("credential-bearing staging journey disables retained network traces", () => {
  for (const source of [stagingJourneySource, stagingRallySource]) {
    assert.match(source, /test\.use\(\{\s*trace:\s*"off"\s*\}\)/);
    assert.match(source, /V2_PRIVILEGED_WRITE_API_KEY/);
    assert.match(source, /x-ikimon-write-key/);
  }
});
