import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_PLATFORM_CONTRACT_VERSION,
  MobileContractError,
  assertProviderOpaqueManifest,
  assertValidNocosilToZukanExchange,
  assertValidSyncCommand,
  decideIdempotentReplay,
  findForbiddenExchangeField,
  type NocosilToZukanExchange,
  type SyncCommand,
} from "./productFamilyContract.js";

function validNocosilCommand(): SyncCommand {
  return {
    contractVersion: MOBILE_PLATFORM_CONTRACT_VERSION,
    commandId: "cmd_01",
    idempotencyKey: "idem_01",
    product: "nocosil",
    securityDomain: {
      product: "nocosil",
      domainKind: "personal",
      domainId: "domain_opaque_01",
    },
    operation: "evidence.capture",
    payloadDigest: "sha256:abc",
    payload: { evidenceId: "e_01" },
  };
}

function validExchange(): NocosilToZukanExchange {
  return {
    contractVersion: MOBILE_PLATFORM_CONTRACT_VERSION,
    exchangeId: "x_01",
    sourceProduct: "nocosil",
    targetProduct: "zukan",
    targetState: "private_intake",
    sourceEdition: {
      objectId: "record_01",
      revision: "rev_04",
      evidenceDigest: "sha256:def",
    },
    approval: {
      mode: "one_tap",
      approvedAt: "2026-08-13T08:34:00+09:00",
      revocable: true,
    },
    privacyTransform: {
      location: "coarsened",
      face: "removed",
      privateProperty: "not_applicable",
      rights: "cleared",
    },
    payload: {
      observation: {
        mediaRef: "exchange-media-01",
        publicLocationCell: "mesh-8-opaque",
      },
    },
  };
}

test("sync command cannot cross product security domains", () => {
  const command = validNocosilCommand();
  const invalid: SyncCommand = {
    ...command,
    securityDomain: {
      product: "zukan",
      domainKind: "private_intake",
      domainId: "zukan-private",
    },
  };

  assert.throws(
    () => assertValidSyncCommand(invalid),
    (error: unknown) => error instanceof MobileContractError && error.code === "PRODUCT_DOMAIN_MISMATCH",
  );
});

test("same idempotency key and payload digest is a safe replay", () => {
  const command = validNocosilCommand();
  assert.equal(decideIdempotentReplay(command, command), "REPLAY_SAME_PAYLOAD");
  assert.equal(
    decideIdempotentReplay(command, { ...command, payloadDigest: "sha256:different" }),
    "CONFLICT_DIFFERENT_PAYLOAD",
  );
});

test("NOCOSIL exchange can only land in ZUKAN private intake", () => {
  const exchange = validExchange();
  assert.doesNotThrow(() => assertValidNocosilToZukanExchange(exchange));

  assert.throws(
    () => assertValidNocosilToZukanExchange({ ...exchange, targetState: "public_projection" as never }),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_PRIVATE_INTAKE_REQUIRED",
  );
});

test("NOCOSIL exchange requires revocable approval", () => {
  const exchange = validExchange();
  assert.throws(
    () => assertValidNocosilToZukanExchange({
      ...exchange,
      approval: { ...exchange.approval, revocable: false as true },
    }),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_APPROVAL_NOT_REVOCABLE",
  );
});

test("cross-product payload rejects private trust-state fields recursively", () => {
  const exchange = validExchange();
  const unsafe = {
    ...exchange,
    payload: {
      observation: {
        mediaRef: "exchange-media-01",
        nested: {
          refresh_token: "must-not-cross",
        },
      },
    },
  } satisfies NocosilToZukanExchange;

  assert.equal(findForbiddenExchangeField(unsafe.payload), "payload.observation.nested.refresh_token");
  assert.throws(
    () => assertValidNocosilToZukanExchange(unsafe),
    (error: unknown) => error instanceof MobileContractError && error.code === "EXCHANGE_FORBIDDEN_FIELD",
  );
});

test("mobile capability manifest remains provider opaque", () => {
  const manifest = {
    contractVersion: MOBILE_PLATFORM_CONTRACT_VERSION,
    product: "zukan" as const,
    capabilities: [
      { id: "media.upload.intent", version: "1", state: "contract_only" as const },
      { id: "sync.push", version: "1", state: "contract_only" as const },
    ],
  };
  assert.doesNotThrow(() => assertProviderOpaqueManifest(manifest));

  assert.throws(() => assertProviderOpaqueManifest({
    ...manifest,
    capabilities: [{ id: "cloudflare.r2_bucket", version: "1", state: "contract_only" as const }],
  }));
});
