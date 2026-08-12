export const MOBILE_PLATFORM_CONTRACT_VERSION = "ikimon.mobile-platform/v1" as const;

export type ProductId = "zukan" | "nocosil";

export type NocosilDomainKind =
  | "personal"
  | "household"
  | "solo"
  | "organization"
  | "project"
  | "private_vault";

export type ZukanDomainKind = "private_intake" | "workspace" | "public_projection";

export type SecurityDomainRef =
  | {
      product: "nocosil";
      domainKind: NocosilDomainKind;
      domainId: string;
    }
  | {
      product: "zukan";
      domainKind: ZukanDomainKind;
      domainId: string;
    };

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type MobileContractErrorCode =
  | "CONTRACT_VERSION_UNSUPPORTED"
  | "PRODUCT_DOMAIN_MISMATCH"
  | "DOMAIN_ID_REQUIRED"
  | "COMMAND_ID_REQUIRED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "PAYLOAD_DIGEST_REQUIRED"
  | "EXCHANGE_DIRECTION_INVALID"
  | "EXCHANGE_PRIVATE_INTAKE_REQUIRED"
  | "EXCHANGE_APPROVAL_REQUIRED"
  | "EXCHANGE_APPROVAL_NOT_REVOCABLE"
  | "EXCHANGE_PRIVACY_TRANSFORM_REQUIRED"
  | "EXCHANGE_RIGHTS_CLEARANCE_REQUIRED"
  | "EXCHANGE_FORBIDDEN_FIELD";

export class MobileContractError extends Error {
  readonly code: MobileContractErrorCode;
  readonly path?: string;

  constructor(code: MobileContractErrorCode, message: string, path?: string) {
    super(message);
    this.name = "MobileContractError";
    this.code = code;
    this.path = path;
  }
}

export type SyncCommand<TPayload extends JsonValue = JsonValue> = {
  contractVersion: typeof MOBILE_PLATFORM_CONTRACT_VERSION;
  commandId: string;
  idempotencyKey: string;
  product: ProductId;
  securityDomain: SecurityDomainRef;
  operation: string;
  payloadDigest: string;
  baseRevision?: string;
  payload: TPayload;
};

export function assertValidSyncCommand(command: SyncCommand): void {
  if (command.contractVersion !== MOBILE_PLATFORM_CONTRACT_VERSION) {
    throw new MobileContractError(
      "CONTRACT_VERSION_UNSUPPORTED",
      `Unsupported mobile contract version: ${command.contractVersion}`,
    );
  }
  if (command.product !== command.securityDomain.product) {
    throw new MobileContractError(
      "PRODUCT_DOMAIN_MISMATCH",
      "A mobile command cannot cross product security domains.",
      "securityDomain.product",
    );
  }
  if (!command.securityDomain.domainId.trim()) {
    throw new MobileContractError("DOMAIN_ID_REQUIRED", "Security domain id is required.", "securityDomain.domainId");
  }
  if (!command.commandId.trim()) {
    throw new MobileContractError("COMMAND_ID_REQUIRED", "Command id is required.", "commandId");
  }
  if (!command.idempotencyKey.trim()) {
    throw new MobileContractError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency key is required.", "idempotencyKey");
  }
  if (!command.payloadDigest.trim()) {
    throw new MobileContractError("PAYLOAD_DIGEST_REQUIRED", "Payload digest is required.", "payloadDigest");
  }
}

export type ReplayDecision = "FIRST_SEEN" | "REPLAY_SAME_PAYLOAD" | "CONFLICT_DIFFERENT_PAYLOAD";

export function decideIdempotentReplay(
  existing: Pick<SyncCommand, "idempotencyKey" | "payloadDigest"> | null,
  incoming: Pick<SyncCommand, "idempotencyKey" | "payloadDigest">,
): ReplayDecision {
  if (!existing || existing.idempotencyKey !== incoming.idempotencyKey) {
    return "FIRST_SEEN";
  }
  return existing.payloadDigest === incoming.payloadDigest
    ? "REPLAY_SAME_PAYLOAD"
    : "CONFLICT_DIFFERENT_PAYLOAD";
}

export type UploadIntentRequest = {
  contractVersion: typeof MOBILE_PLATFORM_CONTRACT_VERSION;
  product: ProductId;
  securityDomain: SecurityDomainRef;
  mediaKind: "photo" | "video" | "audio" | "pdf" | "other";
  contentType: string;
  byteLength: number;
  sha256: string;
};

export type UploadCapability = {
  uploadId: string;
  method: "PUT" | "POST";
  targetUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  finalizeToken: string;
};

export interface UploadIntentPort {
  requestUploadIntent(request: UploadIntentRequest): Promise<UploadCapability>;
  finalizeUpload(input: {
    uploadId: string;
    finalizeToken: string;
    observedSha256: string;
    observedByteLength: number;
  }): Promise<{ receiptId: string; acceptedAt: string }>;
}

export interface MobileSyncPort {
  push(commands: readonly SyncCommand[]): Promise<readonly SyncReceipt[]>;
}

export type SyncReceipt = {
  commandId: string;
  idempotencyKey: string;
  disposition: "accepted" | "replayed" | "rejected" | "conflict" | "deferred";
  canonicalRevision?: string;
  receiptId: string;
};

export type ExchangeApproval = {
  mode: "one_tap" | "standing_opt_in";
  approvedAt: string;
  revocable: true;
  grantId?: string;
};

export type ExchangePrivacyTransform = {
  location: "omitted" | "coarsened" | "approved_exact";
  face: "not_present" | "removed" | "approved";
  privateProperty: "not_applicable" | "removed" | "approved";
  rights: "cleared";
};

export type NocosilToZukanExchange<TPayload extends JsonValue = JsonValue> = {
  contractVersion: typeof MOBILE_PLATFORM_CONTRACT_VERSION;
  exchangeId: string;
  sourceProduct: "nocosil";
  targetProduct: "zukan";
  targetState: "private_intake";
  sourceEdition: {
    objectId: string;
    revision: string;
    evidenceDigest: string;
  };
  approval: ExchangeApproval;
  privacyTransform: ExchangePrivacyTransform;
  payload: TPayload;
};

const FORBIDDEN_EXCHANGE_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "rootidentityid",
  "nocosiltenantid",
  "nocosildomainid",
  "localdatabasepath",
  "localdbpath",
  "localfilepath",
  "privatenote",
  "rawprivatelocation",
  "uploadurl",
  "presignedurl",
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function findForbiddenExchangeField(value: JsonValue, path = "payload"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const child = value[index];
      if (child === undefined) continue;
      const found = findForbiddenExchangeField(child, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_EXCHANGE_KEYS.has(normalizeKey(key))) {
        return `${path}.${key}`;
      }
      const found = findForbiddenExchangeField(child, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

export function assertValidNocosilToZukanExchange(exchange: NocosilToZukanExchange): void {
  if (exchange.sourceProduct !== "nocosil" || exchange.targetProduct !== "zukan") {
    throw new MobileContractError(
      "EXCHANGE_DIRECTION_INVALID",
      "Knowledge exchange must cross from NOCOSIL to ZUKAN through the explicit boundary.",
    );
  }
  if (exchange.targetState !== "private_intake") {
    throw new MobileContractError(
      "EXCHANGE_PRIVATE_INTAKE_REQUIRED",
      "A NOCOSIL exchange must land in ZUKAN private intake, never directly in a public projection.",
      "targetState",
    );
  }
  if (!exchange.approval?.approvedAt || !exchange.approval.mode) {
    throw new MobileContractError(
      "EXCHANGE_APPROVAL_REQUIRED",
      "Explicit user approval or a standing opt-in grant is required.",
      "approval",
    );
  }
  if (exchange.approval.revocable !== true) {
    throw new MobileContractError(
      "EXCHANGE_APPROVAL_NOT_REVOCABLE",
      "Standing or one-tap approval must remain revocable.",
      "approval.revocable",
    );
  }
  if (!exchange.privacyTransform) {
    throw new MobileContractError(
      "EXCHANGE_PRIVACY_TRANSFORM_REQUIRED",
      "Privacy, safety and rights transformation is required before ZUKAN intake.",
      "privacyTransform",
    );
  }
  if (exchange.privacyTransform.rights !== "cleared") {
    throw new MobileContractError(
      "EXCHANGE_RIGHTS_CLEARANCE_REQUIRED",
      "Rights clearance is required before exchange.",
      "privacyTransform.rights",
    );
  }
  const forbiddenPath = findForbiddenExchangeField(exchange.payload);
  if (forbiddenPath) {
    throw new MobileContractError(
      "EXCHANGE_FORBIDDEN_FIELD",
      `Private trust-state field is not allowed in a cross-product exchange: ${forbiddenPath}`,
      forbiddenPath,
    );
  }
}

export type MobileCapabilityManifest = {
  contractVersion: typeof MOBILE_PLATFORM_CONTRACT_VERSION;
  product: ProductId;
  capabilities: readonly {
    id: string;
    version: string;
    state: "available" | "preview" | "contract_only";
  }[];
};

const PROVIDER_LEAK_MARKERS = [
  "cloudflare",
  "r2bucket",
  "r2_bucket",
  "d1database",
  "d1_database",
  "durableobject",
  "durable_object",
  "hyperdriveconfig",
  "hyperdrive_config",
];

export function assertProviderOpaqueManifest(manifest: MobileCapabilityManifest): void {
  const serialized = JSON.stringify(manifest).toLowerCase();
  for (const marker of PROVIDER_LEAK_MARKERS) {
    if (serialized.includes(marker)) {
      throw new Error(`Provider-specific implementation detail leaked into mobile contract: ${marker}`);
    }
  }
}
