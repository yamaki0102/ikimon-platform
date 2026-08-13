import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA,
  ZUKAN_MOBILE_PLATFORM_OPERATION,
  ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA,
  canonicalMobilePlatformJson,
  canonicalReceiptForDuplicate,
  mobilePlatformRequestDigest,
  mobilePlatformRequestDigestPayload,
  mobilePlatformReceiptDigest,
  planMobilePlatformRequest,
  type MobilePlatformReceipt,
} from "./zukanMobilePlatformContract.js";

function fixtureRequest() {
  return {
    tenantId: "tenant-zukan-mobile-shadow",
    operation: ZUKAN_MOBILE_PLATFORM_OPERATION,
    idempotencyKey: "fixture-idempotency-001",
    payload: {
      kind: "source_record",
      subjectId: "entity:heritage:fixture-001",
      note: "Synthetic contract fixture. Not a verified fact.",
    },
    environment: "shadow_local" as const,
    runtimeMetadata: {
      schema: ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA,
      runtimeId: "zukan-mobile-client-fixture",
      runtimeVersion: "0.1.0-fixture",
      environment: "shadow_local" as const,
      buildIdentity: "fixture-build-001",
    },
  };
}

test("accepted request produces a stable success envelope with a canonical receipt", async () => {
  const plan = await planMobilePlatformRequest(fixtureRequest(), {
    receivedAt: "2026-07-29T00:00:00.000Z",
  });

  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.schema, ZUKAN_MOBILE_PLATFORM_CONTRACT_SCHEMA);
  assert.equal(plan.receipt.status, "accepted");
  assert.equal(plan.receipt.replayOfReceiptId, null);
  assert.equal(plan.receipt.receivedAt, "2026-07-29T00:00:00.000Z");
  assert.match(plan.receipt.receiptId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
  assert.equal(plan.receipt.receiptId[14], "4");
  assert.ok(["8", "9", "a", "b"].includes(plan.receipt.receiptId[19] ?? ""));
  assert.equal(plan.receipt.receiptSha256.length, 64);
  assert.equal(plan.receipt.requestSha256.length, 64);
  assert.equal(plan.runtimeMetadata.schema, ZUKAN_MOBILE_PLATFORM_RUNTIME_METADATA_SCHEMA);
  assert.equal(plan.runtimeMetadata.runtimeId, "zukan-mobile-client-fixture");
  assert.equal(plan.runtimeMetadata.runtimeVersion, "0.1.0-fixture");
  assert.equal(plan.runtimeMetadata.buildIdentity, "fixture-build-001");
});

test("duplicate request reuses the canonical receipt with replayed status", async () => {
  const first = await planMobilePlatformRequest(fixtureRequest(), {
    receivedAt: "2026-07-29T00:00:00.000Z",
  });
  const duplicate = await planMobilePlatformRequest(fixtureRequest(), {
    receivedAt: "2026-07-29T00:00:01.000Z",
    replayOfReceiptId: first.ok ? first.receipt.receiptId : null,
  });

  assert.ok(first.ok);
  assert.ok(duplicate.ok);
  if (!first.ok || !duplicate.ok) return;
  assert.equal(duplicate.receipt.receiptId, first.receipt.receiptId);
  assert.equal(duplicate.receipt.requestSha256, first.receipt.requestSha256);
  assert.equal(duplicate.receipt.status, "replayed");
  assert.equal(duplicate.receipt.replayOfReceiptId, first.receipt.receiptId);
});

test("canonicalReceiptForDuplicate recomputes digest and rejects digest mismatch", async () => {
  const originalPlan = await planMobilePlatformRequest(fixtureRequest(), {
    receivedAt: "2026-07-29T00:00:00.000Z",
  });
  const duplicatePlan = await planMobilePlatformRequest(fixtureRequest(), {
    receivedAt: "2026-07-29T00:00:01.000Z",
  });
  assert.ok(originalPlan.ok);
  assert.ok(duplicatePlan.ok);
  if (!originalPlan.ok || !duplicatePlan.ok) return;
  const original = originalPlan.receipt as MobilePlatformReceipt;
  const duplicate = duplicatePlan.receipt as MobilePlatformReceipt;

  const reused = await canonicalReceiptForDuplicate(original, duplicate.requestSha256);
  assert.equal(reused.receiptId, original.receiptId);
  assert.equal(reused.status, "replayed");
  assert.equal(reused.replayOfReceiptId, original.receiptId);
  assert.notEqual(reused.receiptSha256, original.receiptSha256);
  const recomputed = await mobilePlatformRequestDigest({
    ...fixtureRequest(),
  });
  assert.equal(reused.requestSha256, recomputed);
  assert.equal(reused.receiptSha256, await mobilePlatformReceiptDigest(reused));

  await assert.rejects(
    canonicalReceiptForDuplicate(original, "0".repeat(64)),
    /duplicate_request_digest_mismatch/u,
  );
});

test("deterministic digest is permutation-invariant for object keys and array order", async () => {
  const request = fixtureRequest();
  const first = await mobilePlatformRequestDigest(request);
  const second = await mobilePlatformRequestDigest({
    ...request,
    payload: {
      note: request.payload.note,
      subjectId: request.payload.subjectId,
      kind: request.payload.kind,
    },
  });
  assert.equal(second, first);

  const differentEnvironment = await mobilePlatformRequestDigest({
    ...request,
    environment: "production_disabled",
    runtimeMetadata: {
      ...request.runtimeMetadata,
      environment: "production_disabled",
    },
  });
  assert.notEqual(differentEnvironment, first);
});

test("volatile receipt metadata never enters the stable request digest", async () => {
  const request = fixtureRequest();
  const base = await mobilePlatformRequestDigest(request);
  const withVolatile = await mobilePlatformRequestDigest({
    ...request,
    payload: {
      ...request.payload,
      receivedAt: "2026-07-29T00:00:00.000Z",
      receiptId: "volatile-receipt-id",
      serverNonce: "volatile-nonce",
      traceId: "volatile-trace",
    },
  });
  assert.equal(withVolatile, base);

  const digestPayload = mobilePlatformRequestDigestPayload(request);
  assert.equal("receivedAt" in (digestPayload.payload as Record<string, unknown>), false);
  assert.equal("receiptId" in (digestPayload.payload as Record<string, unknown>), false);
  assert.equal("serverNonce" in (digestPayload.payload as Record<string, unknown>), false);
  assert.equal("traceId" in (digestPayload.payload as Record<string, unknown>), false);
  assert.equal("runtimeMetadata" in digestPayload, false);
});

test("unknown fields fail closed", async () => {
  const plan = await planMobilePlatformRequest({
    ...fixtureRequest(),
    unexpectedField: "nope",
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.equal(plan.error.code, "invalid_request");
  assert.ok(plan.blockers.includes("unknown_field:request.unexpectedField"));
});

test("malformed input fails closed", async () => {
  const missingTenant = await planMobilePlatformRequest({
    ...fixtureRequest(),
    tenantId: "",
  });
  assert.equal(missingTenant.ok, false);
  if (missingTenant.ok) return;
  assert.equal(missingTenant.error.code, "invalid_request");
  assert.ok(missingTenant.blockers.includes("invalid_string:request.tenantId"));

  const badPayload = await planMobilePlatformRequest({
    ...fixtureRequest(),
    payload: { kind: "source_record" },
  });
  assert.equal(badPayload.ok, false);
  if (badPayload.ok) return;
  assert.ok(badPayload.blockers.includes("invalid_string:request.payload.subjectId"));

  const nonObject = await planMobilePlatformRequest("not-an-object");
  assert.equal(nonObject.ok, false);
  if (nonObject.ok) return;
  assert.ok(nonObject.blockers.includes("invalid_object:request"));
});

test("production-disabled environment never produces a receipt", async () => {
  const plan = await planMobilePlatformRequest({
    ...fixtureRequest(),
    environment: "production_disabled",
    runtimeMetadata: {
      ...fixtureRequest().runtimeMetadata,
      environment: "production_disabled",
    },
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.equal(plan.error.code, "production_disabled");
  assert.ok(plan.warnings.includes("production_environment_disabled"));
});

test("runtime metadata contract is strict and rejects unknown fields", async () => {
  const plan = await planMobilePlatformRequest({
    ...fixtureRequest(),
    runtimeMetadata: {
      ...fixtureRequest().runtimeMetadata,
      unexpected: "nope",
    },
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.ok(plan.blockers.includes("unknown_field:request.runtimeMetadata.unexpected"));
});

test("environment metadata mismatch fails closed", async () => {
  const plan = await planMobilePlatformRequest({
    ...fixtureRequest(),
    environment: "production_disabled",
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.equal(plan.error.code, "invalid_request");
  assert.ok(plan.blockers.includes("runtime_metadata_environment_mismatch"));
});

test("runtime metadata build identity may be explicitly unknown", async () => {
  const plan = await planMobilePlatformRequest({
    ...fixtureRequest(),
    runtimeMetadata: {
      ...fixtureRequest().runtimeMetadata,
      buildIdentity: null,
    },
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.runtimeMetadata.buildIdentity, null);
});

test("canonical JSON serialization is deterministic and permutation-invariant", () => {
  const left = canonicalMobilePlatformJson({ b: 1, a: { d: 2, c: 3 } });
  const right = canonicalMobilePlatformJson({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(right, left);
  assert.equal(left, '{"a":{"c":3,"d":2},"b":1}');
});

test("canonical JSON serialization rejects malformed values", () => {
  assert.throws(
    () => canonicalMobilePlatformJson({ invalid: undefined }),
    /non_json_value/u,
  );
  assert.throws(
    () => canonicalMobilePlatformJson({ invalid: Number.NaN }),
    /non_finite_number/u,
  );
});
