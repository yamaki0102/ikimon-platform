import { createHash, randomBytes } from "node:crypto";

const EVENT_GUEST_COOKIE_PREFIX = "__Host-ikimon_evt_";
const EVENT_GUEST_CREDENTIAL_RE = /^[a-f0-9]{64}$/;
const DEFAULT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function observationEventGuestCookieName(sessionId: string): string {
  return `${EVENT_GUEST_COOKIE_PREFIX}${sha256(sessionId).slice(0, 16)}`;
}

export function createObservationEventGuestCredential(): string {
  return randomBytes(32).toString("hex");
}

export function observationEventGuestCredentialDigest(credential: string): string {
  if (!EVENT_GUEST_CREDENTIAL_RE.test(credential)) {
    throw new Error("invalid_observation_event_guest_credential");
  }
  return sha256(credential);
}

export function readObservationEventGuestCredential(
  sessionId: string,
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;
  const cookieName = observationEventGuestCookieName(sessionId);
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() !== cookieName) continue;
    const credential = segment.slice(separator + 1).trim();
    return EVENT_GUEST_CREDENTIAL_RE.test(credential) ? credential : null;
  }
  return null;
}

export function buildObservationEventGuestCookie(
  sessionId: string,
  credential: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
): string {
  if (!EVENT_GUEST_CREDENTIAL_RE.test(credential)) {
    throw new Error("invalid_observation_event_guest_credential");
  }
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  return [
    `${observationEventGuestCookieName(sessionId)}=${credential}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function buildClearedObservationEventGuestCookie(sessionId: string): string {
  return [
    `${observationEventGuestCookieName(sessionId)}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function observationEventGuestCredentialDigestFromCookie(
  sessionId: string,
  cookieHeader: string | undefined,
): string | null {
  const credential = readObservationEventGuestCredential(sessionId, cookieHeader);
  return credential ? observationEventGuestCredentialDigest(credential) : null;
}
