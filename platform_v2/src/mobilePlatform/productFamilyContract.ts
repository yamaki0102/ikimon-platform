export const MOBILE_PLATFORM_CONTRACT_FAMILY = "ikimon.mobile-platform.v1" as const;
export const PLATFORM_CONTRACT_VERSION = "1.0" as const;
export const ZUKAN_PRODUCT_CONTRACT_VERSION = "zukan.mobile.1.0" as const;
export const EVENT_CONTRACT_VERSION = "1.0" as const;
export const EXCHANGE_CONTRACT_VERSION = "1.0" as const;

export type ProductId = "zukan" | "nocosil";
export type EnvironmentId = "development" | "staging" | "production";
export type Sha256Digest = `sha256:${string}`;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type MobileContractErrorCode =
  | "PRODUCT_SCOPE_MISMATCH"
  | "COMMAND_ID_REQUIRED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "COMMAND_TYPE_REQUIRED"
  | "COMMAND_VERSION_REQUIRED"
  | "PURPOSE_REQUIRED"
  | "PAYLOAD_DIGEST_REQUIRED"
  | "EXCHANGE_DIRECTION_INVALID"
  | "EXCHANGE_APPROVAL_REQUIRED"
  | "EXCHANGE_APPROVAL_NOT_REVOCABLE"
  | "EXCHANGE_RIGHTS_REQUIRED"
  | "EXCHANGE_TRANSFORM_REQUIRED"
  | "EXCHANGE_PRIVATE_FIELDS_FLAG_REQUIRED"
  | "EXCHANGE_SIGNATURE_REQUIRED"
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
  command_id: string;
  idempotency_key: string;
  command_type: string;
  command_version: string;
  product: ProductId;
  domain_ref?: string;
  purpose: string;
  occurred_at?: string;
  created_at_local: string;
  base_revision?: string;
  payload_digest: Sha256Digest;
  attachment_refs?: Array<{
    local_media_id: string;
    upload_intent_id?: string;
    expected_digest: Sha256Digest;
  }>;
  payload: TPayload;
};

export function assertValidSyncCommand(command: SyncCommand, expectedProduct?: ProductId): void {
  if (expectedProduct && command.product !== expectedProduct) {
    throw new MobileContractError(
      "PRODUCT_SCOPE_MISMATCH",
      `Command product ${command.product} does not match the active product ${expectedProduct}.`,
      "product",
    );
  }
  if (!command.command_id.trim()) {
    throw new MobileContractError("COMMAND_ID_REQUIRED", "Command id is required.", "command_id");
  }
  if (!command.idempotency_key.trim()) {
    throw new MobileContractError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency key is required.", "idempotency_key");
  }
  if (!command.command_type.trim()) {
    throw new MobileContractError("COMMAND_TYPE_REQUIRED", "Command type is required.", "command_type");
  }
  if (!command.command_version.trim()) {
    throw new MobileContractError("COMMAND_VERSION_REQUIRED", "Command version is required.", "command_version");
  }
  if (!command.purpose.trim()) {
    throw new MobileContractError("PURPOSE_REQUIRED", "Purpose is required.", "purpose");
  }
  if (!command.payload_digest.trim()) {
    throw new MobileContractError("PAYLOAD_DIGEST_REQUIRED", "Payload digest is required.", "payload_digest");
  }
}

export type ReplayDecision = "FIRST_SEEN" | "REPLAY_SAME_PAYLOAD" | "CONFLICT_DIFFERENT_PAYLOAD";

export function decideIdempotentReplay(
  existing: Pick<SyncCommand, "idempotency_key" | "payload_digest"> | null,
  incoming: Pick<SyncCommand, "idempotency_key" | "payload_digest">,
): ReplayDecision {
  if (!existing || existing.idempotency_key !== incoming.idempotency_key) {
    return "FIRST_SEEN";
  }
  return existing.payload_digest === incoming.payload_digest
    ? "REPLAY_SAME_PAYLOAD"
    : "CONFLICT_DIFFERENT_PAYLOAD";
}

export type CommandReceiptStatus =
  | "ACCEPTED"
  | "ALREADY_ACCEPTED"
  | "REJECTED_POLICY"
  | "REJECTED_VALIDATION"
  | "CONFLICT"
  | "DEFERRED"
  | "STEP_UP_REQUIRED"
  | "REAUTH_REQUIRED"
  | "UPGRADE_REQUIRED"
  | "RETRYABLE";

export type CommandReceipt = {
  command_id: string;
  status: CommandReceiptStatus;
  canonical_refs?: string[];
  canonical_revision?: string;
  materialization_state?: "complete" | "pending";
  workflow_receipt_ref?: string;
  retry_after_seconds?: number;
  receipt_id: string;
  receipt_digest: Sha256Digest;
  accepted_at?: string;
};

export interface MobileSyncPort {
  push(input: {
    batch_id: string;
    previous_batch_receipt?: string;
    commands: readonly SyncCommand[];
  }): Promise<{
    batch_id: string;
    receipts: readonly CommandReceipt[];
    next_pull_recommended: boolean;
  }>;
}

export type UploadIntentRequest = {
  idempotency_key: string;
  local_media_id: string;
  product: ProductId;
  domain_ref?: string;
  purpose: string;
  source_kind: "camera_photo" | "camera_video" | "audio" | "pdf" | "file" | "derived";
  media_type: string;
  byte_length: number;
  content_digest: Sha256Digest;
  dimensions?: { width: number; height: number };
  duration_ms?: number;
  classification: string;
  rights_policy_ref?: string;
  derivation?: {
    source_local_media_id: string;
    transform_id: string;
    transform_version: string;
    source_digest: Sha256Digest;
  };
};

export type UploadIntentResponse = {
  upload_intent_id: string;
  state: "CREATED" | "ALREADY_CREATED";
  mode: "single_put" | "multipart" | "server_mediated";
  object_ref: string;
  required_headers: Record<string, string>;
  expires_at: string;
  maximum_byte_length: number;
  expected_digest: Sha256Digest;
  single_put?: {
    url: string;
    method: "PUT";
  };
  multipart?: {
    upload_session_id: string;
    part_size: number;
    maximum_parts: number;
    create_part_capability_endpoint: string;
  };
  receipt_id: string;
};

export type FinalizeUploadReceipt = {
  upload_intent_id: string;
  state: "VERIFIED" | "ALREADY_VERIFIED" | "VERIFYING" | "REJECTED_MISMATCH" | "QUARANTINED";
  canonical_media_ref?: string;
  source_edition_ref?: string;
  verified_digest?: Sha256Digest;
  workflow_receipt_ref?: string;
  receipt_id: string;
  receipt_digest: Sha256Digest;
};

export interface UploadIntentPort {
  create(request: UploadIntentRequest): Promise<UploadIntentResponse>;
  finalize(input: {
    upload_intent_id: string;
    idempotency_key: string;
    content_digest: Sha256Digest;
    byte_length: number;
  }): Promise<FinalizeUploadReceipt>;
}

export type KnowledgeExchangePackageV1 = {
  package_id: string;
  package_version: "1.0";
  source_product: "nocosil";
  target_product: "zukan";
  idempotency_key: string;
  created_at: string;
  expires_at?: string;
  source_digest: Sha256Digest;
  transformed_payload_digest: Sha256Digest;
  classification_before: string;
  classification_after: string;
  transform: {
    policy_id: string;
    policy_version: string;
    implementation_version: string;
    transformation_receipt_refs: string[];
  };
  authority: {
    mode: "one_tap_approval" | "standing_opt_in";
    decision_ref: string;
    revocable: true;
  };
  rights: {
    license_ref: string;
    consent_refs: string[];
    restrictions: string[];
  };
  observation: {
    media_refs: Array<{ exchange_media_ref: string; digest: Sha256Digest }>;
    observed_time: { value?: string; precision: string };
    public_safe_location: { value?: JsonValue; precision: string };
    place_candidates?: string[];
    public_safe_note?: string;
    identification_candidate?: JsonValue;
  };
  prohibited_private_fields_absent: true;
  signature: string;
  signing_key_id: string;
};

const FORBIDDEN_EXCHANGE_KEYS = new Set([
  "rootidentityid",
  "privatenocosildomainid",
  "privatenocosiltenantid",
  "nocosildomainid",
  "nocosiltenantid",
  "localdatabasepath",
  "localdbpath",
  "localfilepath",
  "privateexactcoordinate",
  "rawprivatelocation",
  "privatenote",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "uploadurl",
  "presignedurl",
  "privateserverendpoint",
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function findForbiddenExchangeField(value: JsonValue, path = "package"): string | null {
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

export function assertValidNocosilToZukanExchange(exchange: KnowledgeExchangePackageV1): void {
  if (exchange.source_product !== "nocosil" || exchange.target_product !== "zukan") {
    throw new MobileContractError(
      "EXCHANGE_DIRECTION_INVALID",
      "Knowledge exchange must cross from NOCOSIL to ZUKAN through the explicit package boundary.",
    );
  }
  if (!exchange.authority?.decision_ref || !exchange.authority.mode) {
    throw new MobileContractError(
      "EXCHANGE_APPROVAL_REQUIRED",
      "Explicit one-tap approval or a standing opt-in decision is required.",
      "authority",
    );
  }
  if (exchange.authority.revocable !== true) {
    throw new MobileContractError(
      "EXCHANGE_APPROVAL_NOT_REVOCABLE",
      "Knowledge exchange authority must remain revocable.",
      "authority.revocable",
    );
  }
  if (!exchange.transform?.policy_id || !exchange.transform.policy_version || !exchange.transform.implementation_version) {
    throw new MobileContractError(
      "EXCHANGE_TRANSFORM_REQUIRED",
      "A versioned rights/privacy transform is required before ZUKAN intake.",
      "transform",
    );
  }
  if (!exchange.rights?.license_ref) {
    throw new MobileContractError(
      "EXCHANGE_RIGHTS_REQUIRED",
      "A rights/license reference is required before ZUKAN intake.",
      "rights.license_ref",
    );
  }
  if (exchange.prohibited_private_fields_absent !== true) {
    throw new MobileContractError(
      "EXCHANGE_PRIVATE_FIELDS_FLAG_REQUIRED",
      "The package must attest that prohibited private fields are absent.",
      "prohibited_private_fields_absent",
    );
  }
  if (!exchange.signature || !exchange.signing_key_id) {
    throw new MobileContractError(
      "EXCHANGE_SIGNATURE_REQUIRED",
      "The immutable exchange package requires a signature and signing key id.",
      "signature",
    );
  }

  const forbiddenPath = findForbiddenExchangeField(exchange as unknown as JsonValue);
  if (forbiddenPath) {
    throw new MobileContractError(
      "EXCHANGE_FORBIDDEN_FIELD",
      `Private trust-state field is not allowed in a cross-product exchange: ${forbiddenPath}`,
      forbiddenPath,
    );
  }
}

export type CapabilityState = "available" | "degraded" | "read_only" | "disabled";

export type CapabilityDescriptor = {
  capability_id: string;
  version: string;
  state: CapabilityState;
  required_scope?: string;
  required_step_up?: "none" | "local_biometric" | "passkey" | "strong";
  limits?: Record<string, number | string | boolean>;
  valid_until: string;
};

export type CapabilityResponse = {
  minimum_app_version: string;
  recommended_app_version: string;
  minimum_runtime_version?: string;
  maintenance_mode: "none" | "read_only" | "unavailable";
  contracts: {
    platform: { min: string; max: string };
    product: { min: string; max: string };
    event: { min: string; max: string };
    exchange?: { min: string; max: string };
  };
  capabilities: CapabilityDescriptor[];
  kill_switches: Array<{
    capability_id: string;
    state: "enabled" | "disabled";
    reason_code?: string;
  }>;
  config_digest: Sha256Digest;
  valid_until: string;
};

export type PlatformDescriptor = {
  platform: "ikimon-cloudflare-os";
  environment: EnvironmentId;
  product: ProductId;
  capability_endpoint: string;
  authorization_issuer: string;
  supported_platform_contracts: string[];
  server_time: string;
  descriptor_digest: Sha256Digest;
  signature?: string;
  key_id?: string;
};

const PROVIDER_LEAK_MARKERS = [
  "r2bucket",
  "r2_bucket",
  "d1database",
  "d1_database",
  "durableobject",
  "durable_object",
  "hyperdriveconfig",
  "hyperdrive_config",
  "queuebinding",
  "queue_binding",
];

export function assertProviderOpaqueCapabilities(response: CapabilityResponse): void {
  for (const capability of response.capabilities) {
    const normalized = capability.capability_id.toLowerCase();
    for (const marker of PROVIDER_LEAK_MARKERS) {
      if (normalized.includes(marker)) {
        throw new Error(`Provider-specific implementation detail leaked into capability id: ${marker}`);
      }
    }
  }
}
