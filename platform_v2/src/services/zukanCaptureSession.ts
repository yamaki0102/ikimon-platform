export const ZUKAN_CAPTURE_SESSION_CONTRACT_VERSION =
  "zukan.capture-session/v1" as const;
export const ZUKAN_CAPTURE_SESSION_SCHEMA =
  ZUKAN_CAPTURE_SESSION_CONTRACT_VERSION;
export const ZUKAN_CAPTURE_SESSION_VISIBILITY = "private" as const;

export type ZukanCaptureSessionStatus =
  | "draft"
  | "ready_to_submit"
  | "closed";

export type ZukanCaptureSessionTransition = "ready_to_submit" | "closed";

export type ZukanCaptureSessionCapture = Readonly<{
  captureId: string;
  capturedAt: string;
}>;

export type ZukanCaptureSession = Readonly<{
  schema: typeof ZUKAN_CAPTURE_SESSION_SCHEMA;
  sessionId: string;
  ownerId: string;
  visibility: typeof ZUKAN_CAPTURE_SESSION_VISIBILITY;
  status: ZukanCaptureSessionStatus;
  createdAt: string;
  updatedAt: string;
  readyToSubmitAt: string | null;
  closedAt: string | null;
  captures: readonly ZukanCaptureSessionCapture[];
}>;

export type ZukanCaptureSessionCreateInput = Readonly<{
  sessionId: string;
  ownerId: string;
  createdAt: string;
}>;

export type ZukanCaptureSessionCaptureInput = Readonly<{
  captureId: string;
  capturedAt: string;
}>;

export type ZukanCaptureSessionErrorCode =
  | "invalid_input"
  | "invalid_session"
  | "invalid_session_id"
  | "invalid_owner_id"
  | "invalid_capture_id"
  | "invalid_timestamp"
  | "timestamp_order_invalid"
  | "invalid_transition"
  | "duplicate_transition"
  | "session_not_mutable"
  | "closed_session_mutation"
  | "duplicate_capture";

export type ZukanCaptureSessionFailure = Readonly<{
  ok: false;
  session: null;
  error: Readonly<{
    code: ZukanCaptureSessionErrorCode;
    message: string;
  }>;
}>;

export type ZukanCaptureSessionSuccess = Readonly<{
  ok: true;
  session: ZukanCaptureSession;
}>;

export type ZukanCaptureSessionResult =
  | ZukanCaptureSessionSuccess
  | ZukanCaptureSessionFailure;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function isZukanCaptureSessionIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value === value.trim()
    && IDENTIFIER_PATTERN.test(value);
}

export function isZukanCaptureSessionTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || !CANONICAL_TIMESTAMP_PATTERN.test(value)
  ) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    && new Date(milliseconds).toISOString() === value;
}

function timestampMilliseconds(value: string): number {
  return Date.parse(value);
}

function failure(
  code: ZukanCaptureSessionErrorCode,
  message: string,
): ZukanCaptureSessionFailure {
  return {
    ok: false,
    session: null,
    error: { code, message },
  };
}

function success(session: ZukanCaptureSession): ZukanCaptureSessionSuccess {
  return { ok: true, session };
}

function invalidInput(message: string): ZukanCaptureSessionFailure {
  return failure("invalid_input", message);
}

function cloneCapture(capture: ZukanCaptureSessionCapture): ZukanCaptureSessionCapture {
  return {
    captureId: capture.captureId,
    capturedAt: capture.capturedAt,
  };
}

function cloneSession(session: ZukanCaptureSession): ZukanCaptureSession {
  return {
    schema: ZUKAN_CAPTURE_SESSION_SCHEMA,
    sessionId: session.sessionId,
    ownerId: session.ownerId,
    visibility: ZUKAN_CAPTURE_SESSION_VISIBILITY,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    readyToSubmitAt: session.readyToSubmitAt,
    closedAt: session.closedAt,
    captures: session.captures.map(cloneCapture),
  };
}

function validateCapture(
  value: unknown,
  errorCode: "invalid_capture_id" | "invalid_input",
): ZukanCaptureSessionCapture | ZukanCaptureSessionFailure {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["captureId", "capturedAt"])) {
    return failure(errorCode, "capture input is invalid");
  }
  if (!isZukanCaptureSessionIdentifier(value.captureId)) {
    return failure("invalid_capture_id", "captureId must be a safe identifier");
  }
  if (!isZukanCaptureSessionTimestamp(value.capturedAt)) {
    return failure("invalid_timestamp", "capturedAt must be a canonical UTC timestamp");
  }
  return {
    captureId: value.captureId,
    capturedAt: value.capturedAt,
  };
}

function validateSession(value: unknown): ZukanCaptureSession | ZukanCaptureSessionFailure {
  if (
    !isPlainRecord(value)
    || !hasOnlyKeys(value, [
      "schema",
      "sessionId",
      "ownerId",
      "visibility",
      "status",
      "createdAt",
      "updatedAt",
      "readyToSubmitAt",
      "closedAt",
      "captures",
    ])
  ) {
    return failure("invalid_session", "capture session shape is invalid");
  }
  if (value.schema !== ZUKAN_CAPTURE_SESSION_SCHEMA) {
    return failure("invalid_session", "capture session schema is invalid");
  }
  if (!isZukanCaptureSessionIdentifier(value.sessionId)) {
    return failure("invalid_session_id", "sessionId must be a safe identifier");
  }
  if (!isZukanCaptureSessionIdentifier(value.ownerId)) {
    return failure("invalid_owner_id", "ownerId must be a safe identifier");
  }
  if (value.visibility !== ZUKAN_CAPTURE_SESSION_VISIBILITY) {
    return failure("invalid_session", "capture sessions must remain private");
  }
  if (
    value.status !== "draft"
    && value.status !== "ready_to_submit"
    && value.status !== "closed"
  ) {
    return failure("invalid_session", "capture session status is invalid");
  }
  if (!isZukanCaptureSessionTimestamp(value.createdAt)) {
    return failure("invalid_timestamp", "createdAt must be a canonical UTC timestamp");
  }
  if (!isZukanCaptureSessionTimestamp(value.updatedAt)) {
    return failure("invalid_timestamp", "updatedAt must be a canonical UTC timestamp");
  }
  if (
    value.readyToSubmitAt !== null
    && !isZukanCaptureSessionTimestamp(value.readyToSubmitAt)
  ) {
    return failure("invalid_timestamp", "readyToSubmitAt must be a canonical UTC timestamp or null");
  }
  if (value.closedAt !== null && !isZukanCaptureSessionTimestamp(value.closedAt)) {
    return failure("invalid_timestamp", "closedAt must be a canonical UTC timestamp or null");
  }
  if (!Array.isArray(value.captures)) {
    return failure("invalid_session", "captures must be an array");
  }

  const captures: ZukanCaptureSessionCapture[] = [];
  const captureIds = new Set<string>();
  for (const item of value.captures) {
    const capture = validateCapture(item, "invalid_input");
    if (!("captureId" in capture)) return capture;
    if (captureIds.has(capture.captureId)) {
      return failure("duplicate_capture", "captureId must be unique within a session");
    }
    captureIds.add(capture.captureId);
    captures.push(capture);
  }

  const createdAt = timestampMilliseconds(value.createdAt);
  const updatedAt = timestampMilliseconds(value.updatedAt);
  if (updatedAt < createdAt) {
    return failure("timestamp_order_invalid", "updatedAt cannot precede createdAt");
  }

  const readyToSubmitAt = value.readyToSubmitAt;
  const closedAt = value.closedAt;
  if (value.status === "draft" && (readyToSubmitAt !== null || closedAt !== null)) {
    return failure("invalid_session", "draft sessions cannot have terminal timestamps");
  }
  if (value.status === "ready_to_submit" && (readyToSubmitAt === null || closedAt !== null)) {
    return failure("invalid_session", "ready_to_submit sessions require only readyToSubmitAt");
  }
  if (value.status === "closed" && (readyToSubmitAt === null || closedAt === null)) {
    return failure("invalid_session", "closed sessions require readyToSubmitAt and closedAt");
  }

  if (
    readyToSubmitAt !== null
    && timestampMilliseconds(readyToSubmitAt) < createdAt
  ) {
    return failure("timestamp_order_invalid", "readyToSubmitAt cannot precede createdAt");
  }
  if (
    readyToSubmitAt !== null
    && timestampMilliseconds(readyToSubmitAt) > updatedAt
  ) {
    return failure("timestamp_order_invalid", "readyToSubmitAt cannot follow updatedAt");
  }
  if (value.status === "ready_to_submit" && value.updatedAt !== readyToSubmitAt) {
    return failure("timestamp_order_invalid", "ready_to_submit updatedAt must equal readyToSubmitAt");
  }
  if (
    closedAt !== null
    && readyToSubmitAt !== null
    && timestampMilliseconds(closedAt) < timestampMilliseconds(readyToSubmitAt)
  ) {
    return failure("timestamp_order_invalid", "closedAt cannot precede readyToSubmitAt");
  }
  if (closedAt !== null && timestampMilliseconds(closedAt) > updatedAt) {
    return failure("timestamp_order_invalid", "closedAt cannot follow updatedAt");
  }
  if (value.status === "closed" && value.updatedAt !== closedAt) {
    return failure("timestamp_order_invalid", "closed updatedAt must equal closedAt");
  }
  if (captures.some((capture) => timestampMilliseconds(capture.capturedAt) < createdAt)) {
    return failure("timestamp_order_invalid", "captures cannot precede session creation");
  }
  if (captures.some((capture) => timestampMilliseconds(capture.capturedAt) > updatedAt)) {
    return failure("timestamp_order_invalid", "captures cannot follow updatedAt");
  }
  if (
    readyToSubmitAt !== null
    && captures.some((capture) => timestampMilliseconds(capture.capturedAt) > timestampMilliseconds(readyToSubmitAt))
  ) {
    return failure("timestamp_order_invalid", "captures cannot follow readyToSubmitAt");
  }

  return {
    schema: ZUKAN_CAPTURE_SESSION_SCHEMA,
    sessionId: value.sessionId,
    ownerId: value.ownerId,
    visibility: ZUKAN_CAPTURE_SESSION_VISIBILITY,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    readyToSubmitAt,
    closedAt,
    captures,
  };
}

/**
 * Creates one private, immutable-by-convention capture session in draft state.
 * All timestamps are supplied by the caller so the result is deterministic.
 */
export function createZukanCaptureSession(input: unknown): ZukanCaptureSessionResult {
  if (!isPlainRecord(input) || !hasOnlyKeys(input, ["sessionId", "ownerId", "createdAt"])) {
    return invalidInput("session input is invalid");
  }
  if (!isZukanCaptureSessionIdentifier(input.sessionId)) {
    return failure("invalid_session_id", "sessionId must be a safe identifier");
  }
  if (!isZukanCaptureSessionIdentifier(input.ownerId)) {
    return failure("invalid_owner_id", "ownerId must be a safe identifier");
  }
  if (!isZukanCaptureSessionTimestamp(input.createdAt)) {
    return failure("invalid_timestamp", "createdAt must be a canonical UTC timestamp");
  }

  return success({
    schema: ZUKAN_CAPTURE_SESSION_SCHEMA,
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    visibility: ZUKAN_CAPTURE_SESSION_VISIBILITY,
    status: "draft",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    readyToSubmitAt: null,
    closedAt: null,
    captures: [],
  });
}

/**
 * Re-validates a session before a caller passes it to another pure helper.
 * Invalid or externally altered state never gets treated as a valid session.
 */
export function validateZukanCaptureSession(input: unknown): ZukanCaptureSessionResult {
  const session = validateSession(input);
  return "sessionId" in session ? success(cloneSession(session)) : session;
}

/**
 * Applies exactly one legal lifecycle transition. The lifecycle cannot skip a
 * state, repeat a transition, move backwards, or be changed after closing.
 */
export function transitionZukanCaptureSession(
  input: unknown,
  transition: unknown,
  transitionedAt: unknown,
): ZukanCaptureSessionResult {
  const session = validateSession(input);
  if (!("sessionId" in session)) return session;
  if (transition !== "ready_to_submit" && transition !== "closed") {
    return failure("invalid_transition", "capture session transition is invalid");
  }
  if (!isZukanCaptureSessionTimestamp(transitionedAt)) {
    return failure("invalid_timestamp", "transition time must be a canonical UTC timestamp");
  }

  const at = timestampMilliseconds(transitionedAt);
  if (at < timestampMilliseconds(session.updatedAt)) {
    return failure("timestamp_order_invalid", "transition time cannot precede updatedAt");
  }
  if (session.status === "closed") {
    return failure("closed_session_mutation", "closed capture sessions cannot be changed");
  }
  if (transition === "ready_to_submit") {
    if (session.status !== "draft") {
      return failure("duplicate_transition", "ready_to_submit has already been applied");
    }
    return success({
      ...cloneSession(session),
      status: "ready_to_submit",
      updatedAt: transitionedAt,
      readyToSubmitAt: transitionedAt,
    });
  }

  if (session.status !== "ready_to_submit") {
    return failure("invalid_transition", "capture session must be ready before closing");
  }
  return success({
    ...cloneSession(session),
    status: "closed",
    updatedAt: transitionedAt,
    closedAt: transitionedAt,
  });
}

export function markZukanCaptureSessionReadyToSubmit(
  input: unknown,
  transitionedAt: unknown,
): ZukanCaptureSessionResult {
  return transitionZukanCaptureSession(input, "ready_to_submit", transitionedAt);
}

export function closeZukanCaptureSession(
  input: unknown,
  closedAt: unknown,
): ZukanCaptureSessionResult {
  return transitionZukanCaptureSession(input, "closed", closedAt);
}

/**
 * Adds one private capture only while the session is still a draft. The
 * operation returns a new session and never mutates the supplied value.
 */
export function appendZukanCaptureSessionCapture(
  input: unknown,
  captureInput: unknown,
): ZukanCaptureSessionResult {
  const session = validateSession(input);
  if (!("sessionId" in session)) return session;
  if (session.status === "closed") {
    return failure("closed_session_mutation", "closed capture sessions cannot be changed");
  }
  if (session.status !== "draft") {
    return failure("session_not_mutable", "only draft capture sessions can receive captures");
  }

  const capture = validateCapture(captureInput, "invalid_input");
  if (!("captureId" in capture)) return capture;
  if (session.captures.some((item) => item.captureId === capture.captureId)) {
    return failure("duplicate_capture", "captureId must be unique within a session");
  }
  if (timestampMilliseconds(capture.capturedAt) < timestampMilliseconds(session.createdAt)) {
    return failure("timestamp_order_invalid", "capturedAt cannot precede session creation");
  }

  const updatedAt = timestampMilliseconds(capture.capturedAt)
    > timestampMilliseconds(session.updatedAt)
    ? capture.capturedAt
    : session.updatedAt;
  return success({
    ...cloneSession(session),
    updatedAt,
    captures: [...session.captures.map(cloneCapture), capture],
  });
}
