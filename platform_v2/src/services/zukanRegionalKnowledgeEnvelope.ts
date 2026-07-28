import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

export const ZUKAN_REGIONAL_KNOWLEDGE_ENVELOPE_SCHEMA =
  "zukan.regional-knowledge-envelope/v1" as const;
export const ZUKAN_REGIONAL_KNOWLEDGE_ID_NAMESPACE =
  "zukan.regional-knowledge-envelope/v1" as const;

export type RegionalRecordKind =
  | "source_record"
  | "field_observation"
  | "activity_record"
  | "event_record"
  | "testimony"
  | "case_outcome";

export type RegionalVisibility =
  | "private"
  | "workspace"
  | "restricted"
  | "public_candidate";

export type RegionalReviewState =
  | "unreviewed"
  | "ai_candidate"
  | "human_reviewed";

export type RegionalKnowledgeClaimInput = {
  externalClaimId: string;
  subjectId: string;
  predicateUri: string;
  predicateVersion: number;
  value: unknown;
  evidenceRefs: readonly string[];
  reviewState: RegionalReviewState;
  accountableReviewerId?: string | null;
  specialistConclusion?: boolean;
  visibility: RegionalVisibility;
};

export type RegionalPublicationCandidateInput = {
  externalPublicationId: string;
  audience: string;
  purpose: string;
  selectedClaimExternalIds: readonly string[];
};

export type RegionalActionCandidateInput = {
  externalCaseId: string;
  actionKind: "non_emergency_referral" | "inspection_request" | "correction_request";
  emergency: boolean;
  responseSlaGuaranteed: boolean;
  accountablePartyId: string | null;
};

export type RegionalKnowledgeEnvelopeInput = {
  tenantId: string;
  externalRecordId: string;
  recordKind: RegionalRecordKind;
  recordedAt: string;
  occurredAt: string | null;
  placeSubjectIds: readonly string[];
  entitySubjectIds: readonly string[];
  sourceEditionIds: readonly string[];
  evidenceObjectIds: readonly string[];
  rightsBasisIds: readonly string[];
  provenanceStatus: "known" | "partial" | "unknown";
  visibility: RegionalVisibility;
  payload: Record<string, unknown>;
  claims?: readonly RegionalKnowledgeClaimInput[];
  publication?: RegionalPublicationCandidateInput | null;
  action?: RegionalActionCandidateInput | null;
};

export type RegionalKnowledgeRecord = {
  recordId: string;
  externalRecordId: string;
  tenantId: string;
  recordKind: RegionalRecordKind;
  recordedAt: string;
  occurredAt: string | null;
  placeSubjectIds: string[];
  entitySubjectIds: string[];
  sourceEditionIds: string[];
  evidenceObjectIds: string[];
  rightsBasisIds: string[];
  provenanceStatus: "known" | "partial" | "unknown";
  visibility: RegionalVisibility;
  payloadJson: string;
  payloadSha256: string;
};

export type RegionalKnowledgeClaimCandidate = {
  claimCandidateId: string;
  externalClaimId: string;
  sourceRecordId: string;
  subjectId: string;
  predicateUri: string;
  predicateVersion: number;
  valueJson: string;
  evidenceRefs: string[];
  reviewState: RegionalReviewState;
  accountableReviewerId: string | null;
  specialistConclusion: boolean;
  visibility: RegionalVisibility;
};

export type RegionalPublicationCandidate = {
  publicationCandidateId: string;
  externalPublicationId: string;
  audience: string;
  purpose: string;
  sourceRecordIds: string[];
  selectedClaimCandidateIds: string[];
  sourceEditionIds: string[];
};

export type RegionalActionCandidate = {
  caseCandidateId: string;
  externalCaseId: string;
  sourceRecordId: string;
  actionKind: RegionalActionCandidateInput["actionKind"];
  emergency: false;
  responseSlaGuaranteed: false;
  accountablePartyId: string;
};

export type RegionalKnowledgeEnvelopePlan = {
  schema: typeof ZUKAN_REGIONAL_KNOWLEDGE_ENVELOPE_SCHEMA;
  mode: "shadow_only";
  tenantId: string;
  record: RegionalKnowledgeRecord;
  claims: RegionalKnowledgeClaimCandidate[];
  publication: RegionalPublicationCandidate | null;
  action: RegionalActionCandidate | null;
  blockers: string[];
  warnings: string[];
  payloadSha256: string;
  counts: {
    records: 1;
    claims: number;
    publications: 0 | 1;
    actions: 0 | 1;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalTimestamp(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function deterministicRegionalKnowledgeUuid(input: {
  tenantId: string;
  entityKind: string;
  externalId: string;
}): string {
  const digest = sha256([
    ZUKAN_REGIONAL_KNOWLEDGE_ID_NAMESPACE,
    input.tenantId,
    input.entityKind,
    input.externalId,
  ].join("\u0000"));
  const bytes = Buffer.from(digest.slice(0, 32), "hex");
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function planRegionalKnowledgeEnvelope(
  input: RegionalKnowledgeEnvelopeInput,
): RegionalKnowledgeEnvelopePlan {
  const tenantId = input.tenantId.trim();
  const externalRecordId = input.externalRecordId.trim();
  if (!tenantId) throw new Error("regional_knowledge_tenant_required");
  if (!externalRecordId) throw new Error("regional_knowledge_record_id_required");

  const blockers: string[] = [];
  const warnings: string[] = [];
  const recordedAt = canonicalTimestamp(input.recordedAt);
  const occurredAt = canonicalTimestamp(input.occurredAt);
  if (!recordedAt) blockers.push("recorded_at_invalid");
  if (input.occurredAt !== null && !occurredAt) blockers.push("occurred_at_invalid");

  const placeSubjectIds = uniqueSorted(input.placeSubjectIds);
  const entitySubjectIds = uniqueSorted(input.entitySubjectIds);
  const sourceEditionIds = uniqueSorted(input.sourceEditionIds);
  const evidenceObjectIds = uniqueSorted(input.evidenceObjectIds);
  const rightsBasisIds = uniqueSorted(input.rightsBasisIds);
  if (placeSubjectIds.length === 0 && entitySubjectIds.length === 0) {
    blockers.push("place_or_entity_reference_required");
  }
  if (input.provenanceStatus === "known" && sourceEditionIds.length === 0 && evidenceObjectIds.length === 0) {
    blockers.push("known_provenance_requires_source_or_evidence");
  }
  if (input.provenanceStatus === "unknown") {
    warnings.push("provenance_unknown_explicit");
  }
  if (rightsBasisIds.length === 0) warnings.push("rights_basis_not_linked");

  const recordId = deterministicRegionalKnowledgeUuid({
    tenantId,
    entityKind: "record",
    externalId: externalRecordId,
  });
  const payloadJson = canonicalFoundationJson(input.payload);
  const record: RegionalKnowledgeRecord = {
    recordId,
    externalRecordId,
    tenantId,
    recordKind: input.recordKind,
    recordedAt: recordedAt ?? input.recordedAt.trim(),
    occurredAt,
    placeSubjectIds,
    entitySubjectIds,
    sourceEditionIds,
    evidenceObjectIds,
    rightsBasisIds,
    provenanceStatus: input.provenanceStatus,
    visibility: input.visibility,
    payloadJson,
    payloadSha256: sha256(payloadJson),
  };

  const allowedSubjects = new Set([...placeSubjectIds, ...entitySubjectIds]);
  const allowedEvidence = new Set([...sourceEditionIds, ...evidenceObjectIds]);
  const externalClaimIds = new Set<string>();
  const claims = [...(input.claims ?? [])]
    .sort((left, right) => left.externalClaimId.localeCompare(right.externalClaimId))
    .map((claim): RegionalKnowledgeClaimCandidate => {
      const externalClaimId = claim.externalClaimId.trim();
      if (!externalClaimId) blockers.push("claim_external_id_required");
      if (externalClaimIds.has(externalClaimId)) blockers.push(`duplicate_claim_external_id:${externalClaimId}`);
      externalClaimIds.add(externalClaimId);
      const subjectId = claim.subjectId.trim();
      if (!allowedSubjects.has(subjectId)) blockers.push(`claim_subject_outside_record:${externalClaimId}`);
      if (!/^https:\/\//u.test(claim.predicateUri)) blockers.push(`claim_predicate_uri_invalid:${externalClaimId}`);
      if (!Number.isInteger(claim.predicateVersion) || claim.predicateVersion < 1) {
        blockers.push(`claim_predicate_version_invalid:${externalClaimId}`);
      }
      const evidenceRefs = uniqueSorted(claim.evidenceRefs);
      if (evidenceRefs.length === 0) blockers.push(`claim_evidence_required:${externalClaimId}`);
      for (const reference of evidenceRefs) {
        if (!allowedEvidence.has(reference)) blockers.push(`claim_evidence_outside_record:${externalClaimId}:${reference}`);
      }
      const accountableReviewerId = claim.accountableReviewerId?.trim() || null;
      if (claim.reviewState === "human_reviewed" && !accountableReviewerId) {
        blockers.push(`human_review_requires_accountable_reviewer:${externalClaimId}`);
      }
      if (claim.specialistConclusion === true
        && (claim.reviewState !== "human_reviewed" || !accountableReviewerId)) {
        blockers.push(`specialist_conclusion_requires_accountable_review:${externalClaimId}`);
      }
      return {
        claimCandidateId: deterministicRegionalKnowledgeUuid({
          tenantId,
          entityKind: "claim_candidate",
          externalId: externalClaimId,
        }),
        externalClaimId,
        sourceRecordId: recordId,
        subjectId,
        predicateUri: claim.predicateUri.trim(),
        predicateVersion: claim.predicateVersion,
        valueJson: canonicalFoundationJson(claim.value),
        evidenceRefs,
        reviewState: claim.reviewState,
        accountableReviewerId,
        specialistConclusion: claim.specialistConclusion === true,
        visibility: claim.visibility,
      };
    });

  const claimByExternalId = new Map(claims.map((claim) => [claim.externalClaimId, claim]));
  let publication: RegionalPublicationCandidate | null = null;
  if (input.publication) {
    const externalPublicationId = input.publication.externalPublicationId.trim();
    if (!externalPublicationId) blockers.push("publication_external_id_required");
    const selectedClaimCandidateIds: string[] = [];
    for (const externalClaimId of uniqueSorted(input.publication.selectedClaimExternalIds)) {
      const claim = claimByExternalId.get(externalClaimId);
      if (!claim) {
        blockers.push(`publication_claim_not_found:${externalClaimId}`);
        continue;
      }
      if (claim.reviewState !== "human_reviewed") {
        blockers.push(`publication_claim_not_human_reviewed:${externalClaimId}`);
      }
      if (claim.visibility !== "public_candidate") {
        blockers.push(`publication_claim_not_public_candidate:${externalClaimId}`);
      }
      selectedClaimCandidateIds.push(claim.claimCandidateId);
    }
    publication = {
      publicationCandidateId: deterministicRegionalKnowledgeUuid({
        tenantId,
        entityKind: "publication_candidate",
        externalId: externalPublicationId,
      }),
      externalPublicationId,
      audience: input.publication.audience.trim(),
      purpose: input.publication.purpose.trim(),
      sourceRecordIds: [recordId],
      selectedClaimCandidateIds: selectedClaimCandidateIds.sort(),
      sourceEditionIds,
    };
  }

  let action: RegionalActionCandidate | null = null;
  if (input.action) {
    const externalCaseId = input.action.externalCaseId.trim();
    if (!externalCaseId) blockers.push("action_external_case_id_required");
    if (input.action.emergency) blockers.push("emergency_action_not_supported");
    if (input.action.responseSlaGuaranteed) blockers.push("response_sla_not_supported");
    const accountablePartyId = input.action.accountablePartyId?.trim() || "";
    if (!accountablePartyId) blockers.push("action_accountable_party_required");
    if (!input.action.emergency && !input.action.responseSlaGuaranteed && accountablePartyId) {
      action = {
        caseCandidateId: deterministicRegionalKnowledgeUuid({
          tenantId,
          entityKind: "case_candidate",
          externalId: externalCaseId,
        }),
        externalCaseId,
        sourceRecordId: recordId,
        actionKind: input.action.actionKind,
        emergency: false,
        responseSlaGuaranteed: false,
        accountablePartyId,
      };
    }
  }

  const envelopeWithoutDigest = {
    schema: ZUKAN_REGIONAL_KNOWLEDGE_ENVELOPE_SCHEMA,
    mode: "shadow_only" as const,
    tenantId,
    record,
    claims,
    publication,
    action,
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
  };
  const payloadSha256 = sha256(canonicalFoundationJson(envelopeWithoutDigest));
  return {
    ...envelopeWithoutDigest,
    payloadSha256,
    counts: {
      records: 1,
      claims: claims.length,
      publications: publication ? 1 : 0,
      actions: action ? 1 : 0,
    },
  };
}
