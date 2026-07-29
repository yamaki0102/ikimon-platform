import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModelInputEnvelope, sealContextPacket,
  type ContextPacketPayload, type ContextPacketReceiptInput,
} from "./zukanContextPacketContract.js";

function payload(): ContextPacketPayload {
  return {
    packetVersion: "zukan.context-packet/v2",
    purpose: "summarize accepted claims",
    scope: { tenantId: "tenant-a", workspaceId: null },
    derivedFrom: {
      resolutionRunId: "run-1", claimStoreSnapshotToken: "snapshot-1",
      claimStoreSequenceWatermark: 10, recordedTimeWatermark: "2026-07-29T00:00:00.000Z",
      predicateRegistrySnapshotHash: "a".repeat(64), authoritySnapshotHash: "b".repeat(64),
      policyId: "policy-1", policyVersion: "v1", evaluatorBuild: "build-1",
      targetTime: "2026-07-29T00:00:00.000Z", inputHash: "c".repeat(64), outputHash: "d".repeat(64),
    },
    reproducibility: { level: "full", missingFields: [] },
    visibility: "internal",
    completeness: { status: "complete", admittedFacts: 1, omittedFacts: 0, omissionReasons: [], truncatedForBudget: false },
    facts: [{
      claimId: "claim-1", claimRevision: 1, subjectId: "subject-1",
      predicateUri: "https://zukan.earth/predicate/example", predicateVersion: "v1",
      valueArtifactId: "value-1", admittedValue: { label: "example" }, polarity: "positive",
      time: { valid: null, observed: null, recorded: "2026-07-29T00:00:00.000Z", publication: null },
      visibility: "tenant",
      authorityAssertions: [{ id: "authority-1", visibility: "tenant" }],
      evidenceLinks: [{ id: "evidence-1", visibility: "internal" }],
      rights: {
        evaluationId: "rights-1", purpose: "ai_input", basis: "allowed",
        evaluatedAt: "2026-07-29T00:00:00.000Z", validFrom: "2026-07-29T00:00:00.000Z",
        validUntil: "2026-07-29T00:10:00.000Z", reviewDue: "2026-07-29T00:08:00.000Z",
        objectDigest: "e".repeat(64),
      },
    }],
    conflicts: [], openGovernance: [],
  };
}

function receipt(): ContextPacketReceiptInput {
  return {
    receiptVersion: "zukan.context-packet-receipt/v2", receiptId: "receipt-1",
    generatedAt: "2026-07-29T00:00:01.000Z",
    principal: { subjectId: "user-1", tenantId: "tenant-a", workspaceId: null, scopes: ["context:read", "ai:input"] },
    authorization: {
      decisionId: "authz-1", evaluatedAt: "2026-07-29T00:00:00.000Z",
      validUntil: "2026-07-29T00:20:00.000Z", allowed: true,
    },
  };
}

test("visibility includes facts evidence authority conflict and governance", () => {
  const context = sealContextPacket({ payload: payload(), receipt: receipt() });
  assert.equal(context.payload.visibility, "internal");
  const wrong = payload(); wrong.visibility = "tenant";
  assert.throws(() => sealContextPacket({ payload: wrong, receipt: receipt() }), /visibility_not_most_restrictive/u);
  const empty = payload(); empty.facts = []; empty.completeness.admittedFacts = 0; empty.visibility = "public";
  assert.throws(() => sealContextPacket({ payload: empty, receipt: receipt() }), /visibility_not_most_restrictive/u);
});

test("duplicate claim revisions and invalid reproducibility hashes are rejected", () => {
  const duplicate = payload(); duplicate.facts.push(structuredClone(duplicate.facts[0]!)); duplicate.completeness.admittedFacts = 2;
  assert.throws(() => sealContextPacket({ payload: duplicate, receipt: receipt() }), /duplicate_fact/u);
  const badHash = payload(); badHash.derivedFrom.inputHash = "bad";
  assert.throws(() => sealContextPacket({ payload: badHash, receipt: receipt() }), /invalid_hash/u);
});

test("model input is after generation and within authorization and rights windows", () => {
  const context = sealContextPacket({ payload: payload(), receipt: receipt() });
  const selectors = [{ claimId: "claim-1", claimRevision: 1, valueArtifactId: "value-1", rightsEvaluationId: "rights-1" }];
  const envelope = buildModelInputEnvelope({
    context, provider: "google", modelId: "gemini-3.1-flash-lite",
    requestedAt: "2026-07-29T00:05:00.000Z", selectors,
  });
  assert.equal(envelope.payload.expiresAt, "2026-07-29T00:08:00.000Z");
  assert.equal(envelope.payload.segments[0]?.rightsObjectDigest, "e".repeat(64));
  assert.throws(() => buildModelInputEnvelope({
    context, provider: "google", modelId: "gemini-3.1-flash-lite",
    requestedAt: "2026-07-29T00:00:00.500Z", selectors,
  }), /before_context_generation/u);
  assert.throws(() => buildModelInputEnvelope({
    context, provider: "google", modelId: "gemini-3.1-flash-lite",
    requestedAt: "2026-07-29T00:08:00.001Z", selectors,
  }), /rights_not_current/u);
});

test("rights must be current when context is sealed", () => {
  const expired = payload(); expired.facts[0]!.rights.validUntil = "2026-07-29T00:00:00.500Z";
  assert.throws(() => sealContextPacket({ payload: expired, receipt: receipt() }), /rights_not_current/u);
});

test("required scopes are fail closed", () => {
  const noAi = receipt(); noAi.principal.scopes = ["context:read"];
  assert.throws(() => sealContextPacket({ payload: payload(), receipt: noAi }), /required_scope_missing/u);
});
