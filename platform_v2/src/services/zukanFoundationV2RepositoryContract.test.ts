import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import {
  canonicalFoundationJson,
  foundationSourceImportPayloadForDigest,
  validateFoundationWriteRequest,
} from "./zukanFoundationV2RepositoryContract.js";
import {
  deterministicFoundationUuid,
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";

function digestBatch(
  batch: ReturnType<typeof planRegionalSourceFoundationImport>["batch"],
): string {
  return createHash("sha256")
    .update(canonicalFoundationJson(foundationSourceImportPayloadForDigest(batch)))
    .digest("hex");
}

function enabledRequest(batch: ReturnType<typeof planRegionalSourceFoundationImport>["batch"]) {
  return {
    batch,
    idempotencyKey: "regional-source:contract-0001",
    policy: {
      enabled: true,
      killSwitch: false,
      allowedTenants: ["tenant-a"],
      allowedOperations: ["source_registry_import_v1"] as const,
      maxEntities: 16,
    },
  };
}

test("write validation rejects a payload digest that does not cover the exact batch", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const outcome = await validateFoundationWriteRequest(enabledRequest({
    ...plan.batch,
    payloadSha256: "0".repeat(64),
  }));
  assert.equal(outcome?.auditCode, "payload_digest_mismatch");
});

test("write validation rejects cross-tenant and dangling batch references", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const work = plan.batch.sourceWorks[0];
  assert.ok(work);
  const crossTenantWithoutDigest = {
    ...plan.batch,
    sourceWorks: [{ ...work, tenantId: "tenant-b" }],
  };
  const crossTenant = {
    ...crossTenantWithoutDigest,
    payloadSha256: digestBatch(crossTenantWithoutDigest),
  };
  const tenantOutcome = await validateFoundationWriteRequest(enabledRequest(crossTenant));
  assert.equal(tenantOutcome?.auditCode, "batch_reference_invalid");

  const edition = plan.batch.sourceEditions[0];
  assert.ok(edition);
  const danglingWithoutDigest = {
    ...plan.batch,
    sourceEditions: [{ ...edition, sourceWorkId: crypto.randomUUID() }],
  };
  const dangling = {
    ...danglingWithoutDigest,
    payloadSha256: digestBatch(danglingWithoutDigest),
  };
  const referenceOutcome = await validateFoundationWriteRequest(enabledRequest(dangling));
  assert.equal(referenceOutcome?.auditCode, "batch_reference_invalid");
});

test("write validation requires a verified fixity event for every available source object", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const edition = plan.batch.sourceEditions[0];
  assert.ok(edition);
  const contentObjectId = deterministicFoundationUuid({
    tenantId: "tenant-a",
    entityKind: "content_object",
    externalId: source.sourceAssetId,
  });
  const contentSha256 = "a".repeat(64);
  const batchWithoutDigest = {
    ...plan.batch,
    contentFixityEvents: [{
      fixityEventId: deterministicFoundationUuid({
        tenantId: "tenant-a",
        entityKind: "content_fixity_event",
        externalId: source.sourceAssetId,
      }),
      contentObjectId,
      contentSha256,
      verificationStatus: "verified" as const,
      verifier: "source-registry-import",
      verifiedAt: "2026-07-28T00:00:00.000Z",
    }],
    contentObjects: [{
      contentObjectId,
      sourceEditionId: edition.sourceEditionId,
      parentContentObjectId: null,
      objectKind: "source_object" as const,
      derivationKind: null,
      mimeType: "application/pdf",
      byteLength: 1024,
      contentSha256,
      storageLocator: "r2://zukan/source.pdf",
      availabilityStatus: "available" as const,
    }],
  };
  const batch = {
    ...batchWithoutDigest,
    payloadSha256: digestBatch(batchWithoutDigest),
  };
  assert.equal(await validateFoundationWriteRequest(enabledRequest(batch)), null);

  const missingFixityWithoutDigest = {
    ...batch,
    contentFixityEvents: [],
  };
  const missingFixity = {
    ...missingFixityWithoutDigest,
    payloadSha256: digestBatch(missingFixityWithoutDigest),
  };
  const outcome = await validateFoundationWriteRequest(enabledRequest(missingFixity));
  assert.equal(outcome?.auditCode, "batch_reference_invalid");
});

test("write validation rejects a public identifier outside the tenant-scoped URI namespace", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const identifier = plan.batch.publicIdentifiers[0];
  assert.ok(identifier);
  const unscopedWithoutDigest = {
    ...plan.batch,
    publicIdentifiers: [{
      ...identifier,
      identifierUri: "https://zukan.earth/id/source-registry/source/collision",
    }],
  };
  const unscoped = {
    ...unscopedWithoutDigest,
    payloadSha256: digestBatch(unscopedWithoutDigest),
  };
  const outcome = await validateFoundationWriteRequest(enabledRequest(unscoped));
  assert.equal(outcome?.auditCode, "batch_reference_invalid");
});

test("write validation rejects non-canonical IDs, JSON text, and timestamps", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const subject = plan.batch.subjects[0];
  const edition = plan.batch.sourceEditions[0];
  assert.ok(subject && edition);
  const variants = [
    {
      ...plan.batch,
      subjects: [{ ...subject, subjectId: subject.subjectId.toUpperCase() }],
    },
    {
      ...plan.batch,
      subjects: [{ ...subject, metadataJson: '{"z":1,"a":2}' }],
    },
    {
      ...plan.batch,
      sourceEditions: [{
        ...edition,
        issuedAt: "2026-07-28",
      }],
    },
    {
      ...plan.batch,
      sourceEditions: [{
        ...edition,
        validFrom: "2026-07-29T00:00:00.000Z",
        validTo: "2026-07-28T00:00:00.000Z",
      }],
    },
  ];
  for (const withoutDigest of variants) {
    const batch = {
      ...withoutDigest,
      payloadSha256: digestBatch(withoutDigest),
    };
    const outcome = await validateFoundationWriteRequest(enabledRequest(batch));
    assert.equal(outcome?.auditCode, "batch_reference_invalid");
  }
});
