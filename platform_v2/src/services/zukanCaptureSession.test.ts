import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_CAPTURE_SESSION_CONTRACT_VERSION,
  appendZukanCaptureSessionCapture,
  closeZukanCaptureSession,
  createZukanCaptureSession,
  isZukanCaptureSessionIdentifier,
  isZukanCaptureSessionTimestamp,
  markZukanCaptureSessionReadyToSubmit,
  transitionZukanCaptureSession,
  validateZukanCaptureSession,
} from "./zukanCaptureSession.js";

const createdAt = "2026-08-14T00:00:00.000Z";
const capturedAt = "2026-08-14T00:01:00.000Z";
const readyAt = "2026-08-14T00:02:00.000Z";
const closedAt = "2026-08-14T00:03:00.000Z";

function createDraft() {
  return createZukanCaptureSession({
    sessionId: "session-zuk-003",
    ownerId: "owner-zuk-003",
    createdAt,
  });
}

function expectSuccess(result: ReturnType<typeof createZukanCaptureSession>) {
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

test("creates a private draft with explicit lifecycle timestamps", () => {
  const first = createDraft();
  const second = createDraft();

  assert.deepEqual(second, first);
  const session = expectSuccess(first);
  assert.equal(session.schema, ZUKAN_CAPTURE_SESSION_CONTRACT_VERSION);
  assert.equal(session.visibility, "private");
  assert.equal(session.status, "draft");
  assert.equal(session.createdAt, createdAt);
  assert.equal(session.updatedAt, createdAt);
  assert.equal(session.readyToSubmitAt, null);
  assert.equal(session.closedAt, null);
  assert.deepEqual(session.captures, []);
});

test("accepts one deterministic draft capture and leaves the input unchanged", () => {
  const draft = expectSuccess(createDraft());
  const first = appendZukanCaptureSessionCapture(draft, {
    captureId: "capture-zuk-003",
    capturedAt,
  });
  const second = appendZukanCaptureSessionCapture(draft, {
    captureId: "capture-zuk-003",
    capturedAt,
  });

  assert.deepEqual(second, first);
  assert.deepEqual(draft.captures, []);
  const session = expectSuccess(first);
  assert.equal(session.updatedAt, capturedAt);
  assert.deepEqual(session.captures, [{ captureId: "capture-zuk-003", capturedAt }]);
});

test("rejects duplicate captures and malformed capture input", () => {
  const draft = expectSuccess(createDraft());
  const withCapture = expectSuccess(appendZukanCaptureSessionCapture(draft, {
    captureId: "capture-zuk-003",
    capturedAt,
  }));

  const duplicate = appendZukanCaptureSessionCapture(withCapture, {
    captureId: "capture-zuk-003",
    capturedAt: readyAt,
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "duplicate_capture");

  const malformed = appendZukanCaptureSessionCapture(draft, {
    captureId: "capture-zuk-003",
    capturedAt,
    unexpected: true,
  });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "invalid_input");
});

test("follows draft -> ready_to_submit -> closed exactly once", () => {
  const draft = expectSuccess(createDraft());
  const ready = markZukanCaptureSessionReadyToSubmit(draft, readyAt);
  const readySession = expectSuccess(ready);
  assert.equal(readySession.status, "ready_to_submit");
  assert.equal(readySession.readyToSubmitAt, readyAt);
  assert.equal(readySession.updatedAt, readyAt);

  const closed = closeZukanCaptureSession(readySession, closedAt);
  const closedSession = expectSuccess(closed);
  assert.equal(closedSession.status, "closed");
  assert.equal(closedSession.closedAt, closedAt);
  assert.equal(closedSession.updatedAt, closedAt);

  const duplicateReady = transitionZukanCaptureSession(readySession, "ready_to_submit", closedAt);
  assert.equal(duplicateReady.ok, false);
  if (!duplicateReady.ok) assert.equal(duplicateReady.error.code, "duplicate_transition");

  const duplicateClose = closeZukanCaptureSession(closedSession, closedAt);
  assert.equal(duplicateClose.ok, false);
  if (!duplicateClose.ok) assert.equal(duplicateClose.error.code, "closed_session_mutation");
});

test("does not allow skipping readiness or mutating a ready session", () => {
  const draft = expectSuccess(createDraft());
  const skippedClose = closeZukanCaptureSession(draft, closedAt);
  assert.equal(skippedClose.ok, false);
  if (!skippedClose.ok) assert.equal(skippedClose.error.code, "invalid_transition");

  const ready = expectSuccess(markZukanCaptureSessionReadyToSubmit(draft, readyAt));
  const lateCapture = appendZukanCaptureSessionCapture(ready, {
    captureId: "capture-after-ready",
    capturedAt: closedAt,
  });
  assert.equal(lateCapture.ok, false);
  if (!lateCapture.ok) assert.equal(lateCapture.error.code, "session_not_mutable");
});

test("closed sessions reject capture mutation and never expose a public visibility", () => {
  const draft = expectSuccess(createDraft());
  const ready = expectSuccess(markZukanCaptureSessionReadyToSubmit(draft, readyAt));
  const closed = expectSuccess(closeZukanCaptureSession(ready, closedAt));
  const mutation = appendZukanCaptureSessionCapture(closed, {
    captureId: "capture-after-close",
    capturedAt: closedAt,
  });

  assert.equal(closed.visibility, "private");
  assert.equal(mutation.ok, false);
  if (!mutation.ok) assert.equal(mutation.error.code, "closed_session_mutation");
});

test("invalid identifiers and timestamps fail closed", () => {
  assert.equal(isZukanCaptureSessionIdentifier("owner-zuk-003"), true);
  assert.equal(isZukanCaptureSessionIdentifier(" owner-zuk-003"), false);
  assert.equal(isZukanCaptureSessionIdentifier(""), false);
  assert.equal(isZukanCaptureSessionIdentifier("owner/zuk-003"), false);
  assert.equal(isZukanCaptureSessionTimestamp(createdAt), true);
  assert.equal(isZukanCaptureSessionTimestamp("2026-02-30T00:00:00.000Z"), false);
  assert.equal(isZukanCaptureSessionTimestamp("2026-08-14T00:00:00Z"), false);

  const invalidId = createZukanCaptureSession({
    sessionId: " ",
    ownerId: "owner-zuk-003",
    createdAt,
  });
  assert.equal(invalidId.ok, false);
  if (!invalidId.ok) assert.equal(invalidId.error.code, "invalid_session_id");

  const invalidTime = createZukanCaptureSession({
    sessionId: "session-zuk-003",
    ownerId: "owner-zuk-003",
    createdAt: "not-a-timestamp",
  });
  assert.equal(invalidTime.ok, false);
  if (!invalidTime.ok) assert.equal(invalidTime.error.code, "invalid_timestamp");
});

test("transition timestamps cannot move the session backwards", () => {
  const draft = expectSuccess(createDraft());
  const result = markZukanCaptureSessionReadyToSubmit(draft, "2026-08-13T23:59:59.999Z");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "timestamp_order_invalid");
});

test("malformed external session state is rejected before transition or mutation", () => {
  const draft = expectSuccess(createDraft());
  const malformed = { ...draft, status: "closed" };

  const validation = validateZukanCaptureSession(malformed);
  assert.equal(validation.ok, false);
  if (!validation.ok) assert.equal(validation.error.code, "invalid_session");

  const transition = closeZukanCaptureSession(malformed, closedAt);
  assert.equal(transition.ok, false);
  if (!transition.ok) assert.equal(transition.error.code, "invalid_session");
});

test("externally altered terminal timestamps fail closed", () => {
  const draft = expectSuccess(createDraft());
  const ready = expectSuccess(markZukanCaptureSessionReadyToSubmit(draft, readyAt));
  const malformedReady = { ...ready, updatedAt: closedAt };
  const readyValidation = validateZukanCaptureSession(malformedReady);
  assert.equal(readyValidation.ok, false);
  if (!readyValidation.ok) assert.equal(readyValidation.error.code, "timestamp_order_invalid");

  const closed = expectSuccess(closeZukanCaptureSession(ready, closedAt));
  const malformedClosed = { ...closed, updatedAt: readyAt };
  const closedValidation = validateZukanCaptureSession(malformedClosed);
  assert.equal(closedValidation.ok, false);
  if (!closedValidation.ok) assert.equal(closedValidation.error.code, "timestamp_order_invalid");
});
