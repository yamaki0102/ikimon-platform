import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_PLATFORM_CONTRACT_FAMILY,
  MobileContractError,
  assertProviderOpaqueCapabilities,
  assertValidNocosilToZukanExchange,
  assertValidSyncCommand,
  decideIdempotentReplay,
  findForbiddenExchangeField,
  type CapabilityResponse,
  type JsonValue,
  type KnowledgeExchangePackageV1,
  type SyncCommand,
} from "./productFamilyContract.js";

function validNocosilCommand(): SyncCommand {
  return {
    command_id: "cmd_01",
    idempotency_key: "idem_01",
    command_type: "nocosil.source.capture",
    command_version: "1",
    product: "nocosil",
    domain_ref: "domain_opaque_01",
    purpose: "personal.capture",
    created_at_local: "2026-08-13T08:34:00+09:00",
    payload_digest: "sha256:abc",
    payload: { evidence_ref: "e_01" },
  };
}

function validExchange(): KnowledgeExchangePackageV1 {
  return {
    package_id: "x_01",
    package_version: "1.0",
    source_product: "nocosil",
    target_product: "zukan",
    idempotency_key: "exchange-idem-01",
    created_at: "2026-08-13T08:34:00+09:00",
    source_digest: "sha256:source",
    transformed_payload_digest: "sha256:transformed",
    classification_before: "private",
    classification_after: "public_safe",
    transform: {
      policy_id: "privacy-transform",
      policy_version: "1",
      implementation_version: "1",
      transformation_receipt_refs: ["transform-receipt-01"],
    },
    authority: {
      mode: "one_tap_approval",
      decision_ref: "decision-01",
      revocable: true,
    },
    rights: {
      license_ref: "license-01",
      consent_refs: ["consent-01"],
      restrictions: [],
    },
    observation: {
      media_refs: [{ exchange_media_ref: "exchange-media-01", digest: "sha256:media" }],
      observed_time: { value: "2026-08-13", precision: "day" },
      public_safe_location: { value: { area_ref: "opaque-area" }, precision: "area" },
      public_safe_note: "transformed safe note",
    },
    prohibited_private_fields_absent: true,
    signature: "fixture-signature",
    signing_key_id: "fixture-signing-key",
  };
}

test("implementation contract family matches canonical v1 naming", () => {
  assert.equal(MOBILE_PLATFORM_CONTRACT_FAMILY, "ikimon.mobile-platform.v1");
});

test("sync command cannot be accepted under another active product scope", () => {
  const command = validNocosilCommand();
  const invalid: SyncCommand = { ...command, product: "zukan" };

  assert.throws(
    () => assertValidSyncCommand(invalid, "nocosil"),
    (error: unknown) => error instanceof MobileContractError && error.code === "PRODUCT_SCOPE_MISMATCH",
  );
});

test("same idempotency key and payload digest is a safe replay", () => {
  const command = validNocosilCommand();
  assert.equal(decideIdempotentReplay(command, command), "REPLAY_SAME_PAYLOAD");
  assert.equal(
    decideIdempotentReplay(command, { ...command, payload_digest: "sha256:different" }),
    "CONFLICT_DIFFERENT_PAYLOAD",
  );
});

test("knowledge exchange direction is fixed NOCOSIL to ZUKAN", () => {
  const exchange = validExchange();
  assert.doesNotThrow(() => assertValidNocosilToZukanExchange(exchange));

  assert.throws(
    () => assertValidNocosilToZukanExchange({ ...exchange, target_product: "nocosil" as "zukan" }),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_DIRECTION_INVALID",
  );
});

test("NOCOSIL exchange requires revocable authority", () => {
  const exchange = validExchange();
  assert.throws(
    () => assertValidNocosilToZukanExchange({
      ...exchange,
      authority: { ...exchange.authority, revocable: false as true },
    }),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_APPROVAL_NOT_REVOCABLE",
  );
});

test("cross-product package rejects private trust-state fields recursively", () => {
  const exchange = validExchange();
  const unsafe = {
    ...exchange,
    observation: {
      ...exchange.observation,
      identification_candidate: {
        candidate: "safe",
        nested: { refresh_token: "must-not-cross" },
      },
    },
  } satisfies KnowledgeExchangePackageV1;

  assert.equal(
    findForbiddenExchangeField(unsafe as unknown as JsonValue),
    "package.observation.identification_candidate.nested.refresh_token",
  );
  assert.throws(
    () => assertValidNocosilToZukanExchange(unsafe),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_FORBIDDEN_FIELD",
  );
});

test("capability ids remain provider-resource opaque", () => {
  const response: CapabilityResponse = {
    minimum_app_version: "0.0.0",
    recommended_app_version: "0.0.0",
    maintenance_mode: "none",
    contracts: {
      platform: { min: "1.0", max: "1.0" },
      product: { min: "zukan.mobile.1.0", max: "zukan.mobile.1.0" },
      event: { min: "1.0", max: "1.0" },
      exchange: { min: "1.0", max: "1.0" },
    },
    capabilities: [
      { capability_id: "mobile.media.upload.single", version: "1", state: "disabled", valid_until: "2026-08-13T09:00:00+09:00" },
    ],
    kill_switches: [],
    config_digest: "sha256:fixture",
    valid_until: "2026-08-13T09:00:00+09:00",
  };
  assert.doesNotThrow(() => assertProviderOpaqueCapabilities(response));

  assert.throws(() => assertProviderOpaqueCapabilities({
    ...response,
    capabilities: [
      { capability_id: "mobile.r2_bucket.upload", version: "1", state: "disabled", valid_until: response.valid_until },
    ],
  }));
});
