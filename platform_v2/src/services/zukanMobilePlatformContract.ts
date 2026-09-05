export const ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA =
  "zukan.mobile-platform-contract/v1" as const;
export const ZUKAN_MOBILE_PLATFORM_OPERATION =
  "mobile_platform_operation_v1" as const;
export const ZUKAN_MOBILE_PLATFORM_ID_NAMESPACE =
  "zukan.mobile-platform-contract/v1" as const;
export const ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA =
  "zukan.mobile-platform-runtime-metadata/v1" as const;

export type MobilePlatformEnvironment =
  | "shadow_local"
  | "production_disabled";

export type MobilePlatformOperation = typeof ZUKAN_MOBILE_PLATFORM_OPERATION;

export type MobilePlatformRuntimeMetadata = {
  schema: typeof ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA;
  runtimeId: string;
  runtimeVersion: string;
  environment: MobilePlatformEnvironment;
  buildIdentity: string | null;
};

export type MobilePlatformRequestInput = {
  tenantId: string;
  operation: MobilePlatformOperation;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  environment: MobilePlatformEnvironment;
  runtimeMetadata: MobilePlatformRuntimeMetadata;
};

export type MobilePlatformReceipt = {
  schema: typeof ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA;
  operation: MobilePlatformOperation;
  tenantId: string;
  idempotencyKey: string;
  receiptId: string;
  receiptSha256: string;
  requestSha256: string;
  receivedAt: string;
  status: "accepted" | "replayed";
  replayOfReceiptId: string | null;
};

export type MobilePlatformSuccess = {
  ok: true;
  schema: typeof ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA;
  environment: MobilePlatformEnvironment;
  receipt: MobilePlatformReceipt;
  runtimeMetadata: MobilePlatformRuntimeMetadata;
};

export type MobilePlatformError = {
  ok: false;
  schema: typeof ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA;
  error: {
    code: "invalid_request" | "production_disabled";
    message: string;
  };
  blockers: string[];
  warnings: string[];
};

export type MobilePlatformPlan = MobilePlatformSuccess | MobilePlatformError;

const VOLATILE_RECEIPT_FIELDS = new Set([
  "receivedAt",
  "receiptId",
  "serverNonce",
  "traceId",
]);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sortedCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non_finite_number");
    return value;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError("non_json_array_hole");
      }
    }
    return value.map(sortedCanonicalValue);
  }
  if (!isRecord(value)) throw new TypeError("non_json_value");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("non_plain_object");
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, sortedCanonicalValue(item)]),
  );
}

export function canonicalMobilePlatformJson(value: unknown): string {
  return JSON.stringify(sortedCanonicalValue(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
  blockers: string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      blockers.push(`unknown_field:${context}.${key}`);
    }
  }
}

function assertString(
  value: unknown,
  context: string,
  blockers: string[],
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    blockers.push(`invalid_string:${context}`);
    return null;
  }
  return value.trim();
}

function assertRecord(
  value: unknown,
  context: string,
  blockers: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    blockers.push(`invalid_object:${context}`);
    return null;
  }
  return value;
}

function assertEnvironment(
  value: unknown,
  context: string,
  blockers: string[],
): MobilePlatformEnvironment | null {
  if (value === "shadow_local" || value === "production_disabled") {
    return value;
  }
  blockers.push(`invalid_environment:${context}`);
  return null;
}

function assertRuntimeMetadata(
  value: unknown,
  context: string,
  blockers: string[],
): MobilePlatformRuntimeMetadata | null {
  const metadata = assertRecord(value, context, blockers);
  if (!metadata) return null;
  assertKnownKeys(
    metadata,
    ["schema", "runtimeId", "runtimeVersion", "environment", "buildIdentity"],
    context,
    blockers,
  );
  if (metadata.schema !== ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA) {
    blockers.push(`invalid_runtime_metadata_schema:${context}.schema`);
  }
  const runtimeId = assertString(metadata.runtimeId, `${context}.runtimeId`, blockers);
  const runtimeVersion = assertString(metadata.runtimeVersion, `${context}.runtimeVersion`, blockers);
  const environment = assertEnvironment(metadata.environment, `${context}.environment`, blockers);
  const hasBuildIdentity = Object.prototype.hasOwnProperty.call(metadata, "buildIdentity");
  const buildIdentity = metadata.buildIdentity;
  if (!hasBuildIdentity) {
    blockers.push(`missing_field:${context}.buildIdentity`);
  } else if (buildIdentity !== null && typeof buildIdentity !== "string") {
    blockers.push(`invalid_string:${context}.buildIdentity`);
  }
  if (
    metadata.schema !== ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA ||
    !runtimeId ||
    !runtimeVersion ||
    !environment ||
    !hasBuildIdentity
  ) {
    return null;
  }
  return {
    schema: ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA,
    runtimeId,
    runtimeVersion,
    environment,
    buildIdentity:
      typeof buildIdentity === "string" ? buildIdentity.trim() || null : null,
  };
}

function assertOperation(
  value: unknown,
  context: string,
  blockers: string[],
): MobilePlatformOperation | null {
  if (value === ZUKAN_MOBILE_PLATFORM_OPERATION) {
    return value;
  }
  blockers.push(`invalid_operation:${context}`);
  return null;
}

function assertPayload(
  value: unknown,
  context: string,
  blockers: string[],
): Record<string, unknown> | null {
  const payload = assertRecord(value, context, blockers);
  if (!payload) return null;
  assertKnownKeys(payload, ["kind", "subjectId", "note"], context, blockers);
  const kind = assertString(payload.kind, `${context}.kind`, blockers);
  const subjectId = assertString(payload.subjectId, `${context}.subjectId`, blockers);
  const note = payload.note;
  if (note !== undefined && typeof note !== "string") {
    blockers.push(`invalid_string:${context}.note`);
  }
  if (!kind || !subjectId) return null;
  return {
    kind,
    subjectId,
    ...(note === undefined ? {} : { note }),
  };
}

function parseRequest(
  input: unknown,
): { request: MobilePlatformRequestInput; blockers: string[] } {
  const blockers: string[] = [];
  const root = assertRecord(input, "request", blockers);
  if (!root) return { request: null as unknown as MobilePlatformRequestInput, blockers };
  assertKnownKeys(
    root,
    ["tenantId", "operation", "idempotencyKey", "payload", "environment", "runtimeMetadata"],
    "request",
    blockers,
  );
  const tenantId = assertString(root.tenantId, "request.tenantId", blockers);
  const operation = assertOperation(root.operation, "request.operation", blockers);
  const idempotencyKey = assertString(root.idempotencyKey, "request.idempotencyKey", blockers);
  const environment = assertEnvironment(root.environment, "request.environment", blockers);
  const payload = assertPayload(root.payload, "request.payload", blockers);
  const runtimeMetadata = assertRuntimeMetadata(
    root.runtimeMetadata,
    "request.runtimeMetadata",
    blockers,
  );
  if (
    environment &&
    runtimeMetadata &&
    runtimeMetadata.environment !== environment
  ) {
    blockers.push("runtime_metadata_environment_mismatch");
  }
  if (!tenantId || !operation || !idempotencyKey || !environment || !payload || !runtimeMetadata) {
    return { request: null as unknown as MobilePlatformRequestInput, blockers };
  }
  return {
    request: {
      tenantId,
      operation,
      idempotencyKey,
      payload,
      environment,
      runtimeMetadata,
    },
    blockers,
  };
}

export function mobilePlatformRequestDigestPayload(
  request: MobilePlatformRequestInput,
): Record<string, unknown> {
  const { payload, runtimeMetadata: _runtimeMetadata, ...rest } = request;
  const stablePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!VOLATILE_RECEIPT_FIELDS.has(key)) {
      stablePayload[key] = value;
    }
  }
  return {
    schema: ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
    operation: rest.operation,
    tenantId: rest.tenantId,
    idempotencyKey: rest.idempotencyKey,
    environment: rest.environment,
    payload: stablePayload,
  };
}

export async function mobilePlatformRequestDigest(
  request: MobilePlatformRequestInput,
): Promise<string> {
  return sha256Hex(canonicalMobilePlatformJson(mobilePlatformRequestDigestPayload(request)));
}

async function deterministicReceiptId(
  tenantId: string,
  operation: MobilePlatformOperation,
  idempotencyKey: string,
  requestSha256: string,
): Promise<string> {
  const digest = await sha256Hex([
    ZUKAN_MOBILE_PLATFORM_ID_NAMESPACE,
    tenantId,
    operation,
    idempotencyKey,
    requestSha256,
  ].join("\u0000"));
  const hex = digest.slice(0, 32);
  const chars = hex.split("");
  chars[12] = "4";
  chars[16] = nibbleToHex((parseInt(chars[16] ?? "0", 16) & 0x03) | 0x08);
  const uuidHex = chars.join("");
  return `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20)}`;
}

function nibbleToHex(value: number): string {
  return value.toString(16);
}

export async function mobilePlatformReceiptDigest(
  receipt: MobilePlatformReceipt,
): Promise<string> {
  const { receiptSha256: _receiptSha256, receivedAt: _receivedAt, ...canonicalBody } = receipt;
  return sha256Hex(canonicalMobilePlatformJson(canonicalBody));
}

async function buildReceipt(
  request: MobilePlatformRequestInput,
  requestSha256: string,
  receivedAt: string,
  status: "accepted" | "replayed",
  replayOfReceiptId: string | null,
): Promise<MobilePlatformReceipt> {
  const receiptId = await deterministicReceiptId(
    request.tenantId,
    request.operation,
    request.idempotencyKey,
    requestSha256,
  );
  const receiptBody: Omit<MobilePlatformReceipt, "receiptSha256" | "receivedAt"> = {
    schema: ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
    operation: request.operation,
    tenantId: request.tenantId,
    idempotencyKey: request.idempotencyKey,
    receiptId,
    requestSha256,
    status,
    replayOfReceiptId,
  };
  return {
    ...receiptBody,
    receiptSha256: await sha256Hex(canonicalMobilePlatformJson(receiptBody)),
    receivedAt,
  };
}

export async function planMobilePlatformRequest(
  input: unknown,
  options?: { receivedAt?: string; replayOfReceiptId?: string | null },
): Promise<MobilePlatformPlan> {
  const { request, blockers } = parseRequest(input);
  const warnings: string[] = [];
  if (blockers.length > 0) {
    return {
      ok: false,
      schema: ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
      error: {
        code: "invalid_request",
        message: "request validation failed",
      },
      blockers,
      warnings,
    };
  }
  if (request.environment === "production_disabled") {
    return {
      ok: false,
      schema: ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
      error: {
        code: "production_disabled",
        message: "production environment is disabled for this contract slice",
      },
      blockers: [],
      warnings: ["production_environment_disabled"],
    };
  }
  const requestSha256 = await mobilePlatformRequestDigest(request);
  const receivedAt = options?.receivedAt ?? new Date().toISOString();
  const replayOfReceiptId = options?.replayOfReceiptId ?? null;
  const status = replayOfReceiptId ? "replayed" : "accepted";
  const receipt = await buildReceipt(
    request,
    requestSha256,
    receivedAt,
    status,
    replayOfReceiptId,
  );
  return {
    ok: true,
    schema: ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
    environment: request.environment,
    receipt,
    runtimeMetadata: request.runtimeMetadata,
  };
}

export async function canonicalReceiptForDuplicate(
  original: MobilePlatformReceipt,
  duplicateRequestSha256: string,
): Promise<MobilePlatformReceipt> {
  if (original.requestSha256 !== duplicateRequestSha256) {
    throw new Error("duplicate_request_digest_mismatch");
  }
  const {
    receiptSha256: _receiptSha256,
    receivedAt: _receivedAt,
    ...originalBody
  } = original;
  const replayedBody: Omit<MobilePlatformReceipt, "receiptSha256" | "receivedAt"> = {
    ...originalBody,
    status: "replayed" as const,
    replayOfReceiptId: original.receiptId,
  };
  return {
    ...replayedBody,
    receiptSha256: await sha256Hex(canonicalMobilePlatformJson(replayedBody)),
    receivedAt: original.receivedAt,
  };
}
