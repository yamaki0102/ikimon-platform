import assert from "node:assert/strict";
import test from "node:test";
import type { FoundationSourceRegistryReadOnlyEvidence } from "./zukanFoundationV2ReadOnlyEvidence.js";
import {
  buildModelInputEnvelope,
  sealContextPacket,
  type ContextPacketPayload,
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

test("context packet digest excludes the digest field and is deterministic", () => {
  const first = sealContextPacket(contextPayload());
  const second = sealContextPacket(contextPayload());
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.equal(first.payload.completeness.admittedFacts, first.payload.facts.length);
});

test("model input only accepts segments admitted by the sealed context packet", () => {
  const context = sealContextPacket(contextPayload());
  const envelope = buildModelInputEnvelope({
    context,
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    segments: [{
      claimId: "claim-1",
      claimRevision: 1,
      rightsEvaluationId: "rights-1",
      text: "example",
    }],
  });
  assert.equal(envelope.payload.contextPacketSha256, context.payloadSha256);
  assert.throws(() => buildModelInputEnvelope({
    context,
    provider: "google",
    modelId: "gemini-3.1-flash-lite",
    segments: [{
      claimId: "claim-1",
      claimRevision: 1,
      rightsEvaluationId: "rights-other",
      text: "example",
    }],
  }), /model_input_segment_not_admitted/u);
});

test("context packet rejects admitted count drift", () => {
  const payload = contextPayload();
  payload.completeness.admittedFacts = 2;
  assert.throws(() => sealContextPacket(payload), /context_packet_admitted_fact_count_mismatch/u);
});
