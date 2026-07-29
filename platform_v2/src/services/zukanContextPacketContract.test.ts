import assert from "node:assert/strict";
import test from "node:test";
import type { FoundationSourceRegistryReadOnlyEvidence } from "./zukanFoundationV2ReadOnlyEvidence.js";
import {
  buildModelInputEnvelope,
  sealContextPacket,
  type ContextPacketPayload,
  type ContextPacketReceiptInput,
} from "./zukanContextPacketContract.js";
import { buildSourceImportEvidenceEnvelope } from "./zukanSourceImportEvidenceEnvelope.js";

function sourceEvidence(): FoundationSourceRegistryReadOnlyEvidence {
  const run = {
    manifestSha256: "1".repeat(64),
    payloadSha256: "2".repeat(64),
    itemDiffSha256: "3".repeat(64),
    itemDiff: [],
  };
  return {
    schema: "zukan.foundation-source-registry-read-only-evidence/v1",
    mode: "read_only_dry_run",
    source: {
      commitSha: "a".repeat(40),
      verification: "git_head_clean",
    },
    target: {
      evidenceKind: "direct_read_only",
      dialect: "postgres",
      locator: "postgres://read-only",
      capabilities: {
        available: true,
        dialect: "postgres",
        schemaVersion: "foundation_v2_integrity_0139",
        readOnly: false,
        blockers: [],
      },
      readOnlyEnforcement: "postgres_default_transaction_read_only",
    },
    tenantId: "tenant-a",
    sourceRegistry: {
      publisherCount: 1,
      sourceAssetCount: 1,
      entityCount: 4,
      projectionSha256: "4".repeat(64),
    },
    runs: [run, { ...run }],
    twoRunStability: {
      stable: true,
      manifestMatch: true,
      payloadMatch: true,
      itemDiffMatch: true,
    },
    identityCandidates: [],
    rights: {
      status: "unknown",
      warnings: ["rights_unknown_requires_review:b", "rights_unknown_requires_review:a"],
    },
    mutationEvidence: {
      before: { stateSha256: "5".repeat(64), entityCount: 0 },
      after: { stateSha256: "5".repeat(64), entityCount: 0 },
      mutationCount: 0,
      unchanged: true,
    },
    rolloutBoundary: {
      publicResponseChanged: false,
      writeMethodsInvoked: 0,
    },
  };
}

function contextPayload(): ContextPacketPayload {
  return {
    packetVersion: "zukan.context-packet/v1",
    purpose: "summarize accepted claims",
    scope: { tenantId: "tenant-a", workspaceId: null },
    derivedFrom: {
      resolutionRunId: "run-1",
      claimStoreSnapshotToken: "snapshot-1",
      claimStoreSequenceWatermark: 10,
      recordedTimeWatermark: "2026-07-29T00:00:00.000Z",
      predicateRegistrySnapshotHash: "a".repeat(64),
      authoritySnapshotHash: "b".repeat(64),
      policyId: "policy-1",
      policyVersion: "v1",
      evaluatorBuild: "build-1",
      targetTime: "2026-07-29T00:00:00.000Z",
      inputHash: "c".repeat(64),
      outputHash: "d".repeat(64),
    },
    reproducibility: {
      level: "full",
      missingFields: [],
    },
    visibility: "tenant",
    completeness: {
      status: "complete",
      admittedFacts: 1,
      omittedFacts: 0,
      omissionReasons: [],
      truncatedForBudget: false,
    },
    facts: [{
      claimId: "claim-1",
      claimRevision: 1,
      subjectId: "subject-1",
      predicateUri: "https://zukan.earth/predicate/example",
      predicateVersion: "v1",
      valueArtifactId: "value-1",
      admittedValue: { label: "example" },
      polarity: "positive",
      time: {
        valid: null,
        observed: null,
        recorded: "2026-07-29T00:00:00.000Z",
        publication: null,
      },
      visibility: "tenant",
      authorityAssertionIds: ["authority-1"],
      evidenceLinkIds: ["evidence-1"],
      rightsEvaluationId: "rights-1",
      rightsPurpose: "ai_input",
      rightsBasis: "allowed",
    }],
    conflicts: [],
    openGovernance: [],
  };
}

function receipt(overrides: Partial<ContextPacketReceiptInput> = {}): ContextPacketReceiptInput {
  return {
    receiptVersion: "zukan.context-packet-receipt/v1",
    receiptId: "receipt-1",
    generatedAt: "2026-07-29T00:00:01.000Z",
    principal: {
      subjectId: "user-1",
      tenantId: "tenant-a",
      workspaceId: null,
      scopes: ["context:read"],
    },
    authorization: {
      decisionId: "authz-1",
      evaluatedAt: "2026-07-29T00:00:00.000Z",
      allowed: true,
    },
    ...overrides,
  };
}

test("source import evidence remains separate and blocks AI input while rights are unknown", () => {
  const first = buildSourceImportEvidenceEnvelope(sourceEvidence());
  const second = buildSourceImportEvidenceEnvelope(sourceEvidence());
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.equal(first.payload.rightsReview.aiInputAdmitted, false);
  assert.deepEqual(first.payload.rightsReview.warnings, [
    "rights_unknown_requires_review:a",
    "rights_unknown_requires_review:b",
  ]);
  assert.equal("facts" in first.payload, false);
  assert.equal("derivedFrom" in first.payload, false);
});

test("context semantic digest is independent from generation receipt", () => {
  const first = sealContextPacket({ payload: contextPayload(), receipt: receipt() });
  const second = sealContextPacket({
    payload: contextPayload(),
    receipt: receipt({ receiptId: "receipt-2", generatedAt: "2026-07-29T00:00:02.000Z" }),
  });
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.notEqual(first.receipt.receiptId, second.receipt.receiptId);
  assert.equal(first.receipt.contextPacketSha256, first.payloadSha256);
});

test("context packet normalizes set-like arrays before hashing", () => {
  const firstPayload = contextPayload();
  firstPayload.facts[0]!.authorityAssertionIds = ["authority-2", "authority-1"];
  const secondPayload = contextPayload();
  secondPayload.facts[0]!.authorityAssertionIds = ["authority-1", "authority-2"];
  const first = sealContextPacket({ payload: firstPayload, receipt: receipt() });
  const second = sealContextPacket({ payload: secondPayload, receipt: receipt() });
  assert.equal(first.payloadSha256, second.payloadSha256);
});

test("model input is derived only from facts admitted by the sealed context packet", () => {
  const context = sealContextPacket({ payload: contextPayload(), receipt: receipt() });
  const envelope = buildModelInputEnvelope({
    context,
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    selectors: [{
      claimId: "claim-1",
      claimRevision: 1,
      rightsEvaluationId: "rights-1",
    }],
  });
  assert.equal(envelope.payload.contextPacketSha256, context.payloadSha256);
  assert.equal(envelope.payload.contextReceiptId, context.receipt.receiptId);
  assert.equal(envelope.payload.segments[0]?.text, "{\"label\":\"example\"}");
  assert.throws(() => buildModelInputEnvelope({
    context,
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    selectors: [{
      claimId: "claim-1",
      claimRevision: 1,
      rightsEvaluationId: "rights-other",
    }],
  }), /model_input_segment_not_admitted/u);
});

test("context packet rejects admitted count drift", () => {
  const payload = contextPayload();
  payload.completeness.admittedFacts = 2;
  assert.throws(
    () => sealContextPacket({ payload, receipt: receipt() }),
    /context_packet_admitted_fact_count_mismatch/u,
  );
});

test("context packet rejects receipt generated before authorization", () => {
  assert.throws(() => sealContextPacket({
    payload: contextPayload(),
    receipt: receipt({ generatedAt: "2026-07-28T23:59:59.000Z" }),
  }), /context_packet_receipt_generated_before_authorization/u);
});

test("model input rejects a tampered authorization receipt", () => {
  const context = sealContextPacket({ payload: contextPayload(), receipt: receipt() });
  const tampered = {
    ...context,
    receipt: {
      ...context.receipt,
      authorization: { ...context.receipt.authorization, decisionId: "authz-tampered" },
    },
  };
  assert.throws(() => buildModelInputEnvelope({
    context: tampered,
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    selectors: [{ claimId: "claim-1", claimRevision: 1, rightsEvaluationId: "rights-1" }],
  }), /context_packet_receipt_signature_mismatch/u);
});

test("context receipt must match the semantic tenant and workspace scope", () => {
  assert.throws(() => sealContextPacket({
    payload: contextPayload(),
    receipt: receipt({
      principal: {
        subjectId: "user-1",
        tenantId: "tenant-other",
        workspaceId: null,
        scopes: ["context:read"],
      },
    }),
  }), /context_packet_receipt_scope_mismatch/u);
});
