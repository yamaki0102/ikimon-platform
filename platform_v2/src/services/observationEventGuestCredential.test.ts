import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClearedObservationEventGuestCookie,
  buildObservationEventGuestCookie,
  createObservationEventGuestCredential,
  observationEventGuestCookieName,
  observationEventGuestCredentialDigest,
  readObservationEventGuestCredential,
} from "./observationEventGuestCredential.js";

test("event guest credential is scoped to a secure per-event host cookie", () => {
  const sessionId = "evt-renri-20260719";
  const otherSessionId = "evt-other";
  const credential = createObservationEventGuestCredential();
  const cookieName = observationEventGuestCookieName(sessionId);

  assert.match(cookieName, /^__Host-ikimon_evt_[a-f0-9]{16}$/);
  assert.notEqual(cookieName, observationEventGuestCookieName(otherSessionId));
  assert.match(credential, /^[a-f0-9]{64}$/);
  assert.match(observationEventGuestCredentialDigest(credential), /^[a-f0-9]{64}$/);
  assert.notEqual(observationEventGuestCredentialDigest(credential), credential);

  const setCookie = buildObservationEventGuestCookie(sessionId, credential);
  assert.match(setCookie, new RegExp(`^${cookieName}=${credential};`));
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.doesNotMatch(setCookie, /Domain=/);

  assert.equal(readObservationEventGuestCredential(sessionId, `${cookieName}=${credential}; theme=dark`), credential);
  assert.equal(readObservationEventGuestCredential(otherSessionId, `${cookieName}=${credential}`), null);
  assert.equal(readObservationEventGuestCredential(sessionId, `${cookieName}=attacker-controlled`), null);

  const cleared = buildClearedObservationEventGuestCookie(sessionId);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /HttpOnly/);
  assert.match(cleared, /Secure/);
  assert.match(cleared, /SameSite=Lax/);
});
