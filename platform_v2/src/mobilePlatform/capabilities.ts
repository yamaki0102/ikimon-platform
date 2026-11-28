import { createHash } from "node:crypto";
import {
  EVENT_CONTRACT_VERSION,
  EXCHANGE_CONTRACT_VERSION,
  PLATFORM_CONTRACT_VERSION,
  ZUKAN_PRODUCT_CONTRACT_VERSION,
  assertProviderOpaqueCapabilities,
  type CapabilityDescriptor,
  type CapabilityResponse,
  type EnvironmentId,
  type PlatformDescriptor,
  type Sha256Digest,
} from "./productFamilyContract.js";

const CAPABILITY_TTL_MS = 5 * 60 * 1000;

function sha256Json(value: unknown): Sha256Digest {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `sha256:${digest}` as Sha256Digest;
}

export function mobileEnvironmentForOrigin(origin: string): EnvironmentId {
  const hostname = new URL(origin).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "development";
  }
  if (hostname.startsWith("staging.") || hostname.includes("-staging.")) {
    return "staging";
  }
  return "production";
}

export function buildZukanPlatformDescriptor(origin: string, now = new Date()): PlatformDescriptor {
  const descriptorWithoutDigest = {
    platform: "ikimon-cloudflare-os" as const,
    environment: mobileEnvironmentForOrigin(origin),
    product: "zukan" as const,
    capability_endpoint: "/v1/capabilities",
    authorization_issuer: origin,
    supported_platform_contracts: [PLATFORM_CONTRACT_VERSION],
    server_time: now.toISOString(),
  };
  return {
    ...descriptorWithoutDigest,
    descriptor_digest: sha256Json(descriptorWithoutDigest),
  };
}

function capability(
  capability_id: string,
  state: CapabilityDescriptor["state"],
  valid_until: string,
): CapabilityDescriptor {
  return {
    capability_id,
    version: "1",
    state,
    required_step_up: "none",
    valid_until,
  };
}

export function buildZukanCapabilityResponse(now = new Date()): CapabilityResponse {
  const validUntil = new Date(now.getTime() + CAPABILITY_TTL_MS).toISOString();
  const capabilities: CapabilityDescriptor[] = [
    // Existing current-runtime field companion capabilities.
    capability("zukan.field_session.start", "available", validUntil),
    capability("zukan.field_session.scene_digest", "available", validUntil),
    capability("zukan.field_session.audio_events", "available", validUntil),
    capability("zukan.field_session.recap", "available", validUntil),

    // Canonical mobile-v1 capabilities reserved by the architecture but not yet live.
    capability("mobile.auth.pkce", "disabled", validUntil),
    capability("mobile.device.register", "disabled", validUntil),
    capability("mobile.sync.push", "disabled", validUntil),
    capability("mobile.sync.pull", "disabled", validUntil),
    capability("mobile.media.upload.single", "disabled", validUntil),
    capability("mobile.media.upload.multipart", "disabled", validUntil),
    capability("mobile.notification.register", "disabled", validUntil),
    capability("mobile.deep_link.typed", "disabled", validUntil),
    capability("knowledge.contracts.read", "disabled", validUntil),
    capability("zukan.observation.capture", "disabled", validUntil),
    capability("zukan.observation.private_read", "disabled", validUntil),
    capability("zukan.observation.review", "disabled", validUntil),
    capability("zukan.map.public_layers", "disabled", validUntil),
    capability("zukan.quest.read", "disabled", validUntil),
    capability("zukan.publication.approve", "disabled", validUntil),
    capability("zukan.exchange.accept_nocosil", "disabled", validUntil),
  ];

  const responseWithoutDigest = {
    minimum_app_version: "0.0.0",
    recommended_app_version: "0.0.0",
    maintenance_mode: "none" as const,
    contracts: {
      platform: { min: PLATFORM_CONTRACT_VERSION, max: PLATFORM_CONTRACT_VERSION },
      product: { min: ZUKAN_PRODUCT_CONTRACT_VERSION, max: ZUKAN_PRODUCT_CONTRACT_VERSION },
      event: { min: EVENT_CONTRACT_VERSION, max: EVENT_CONTRACT_VERSION },
      exchange: { min: EXCHANGE_CONTRACT_VERSION, max: EXCHANGE_CONTRACT_VERSION },
    },
    capabilities,
    kill_switches: [] as CapabilityResponse["kill_switches"],
    valid_until: validUntil,
  };

  const response: CapabilityResponse = {
    ...responseWithoutDigest,
    config_digest: sha256Json(responseWithoutDigest),
  };
  assertProviderOpaqueCapabilities(response);
  return response;
}
