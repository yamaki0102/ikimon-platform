import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";
import {
  deterministicRegionalKnowledgeUuid,
  type RegionalKnowledgeEnvelopePlan,
  type RegionalVisibility,
} from "./zukanRegionalKnowledgeEnvelope.js";
import {
  regionalCorePredicateByUri,
  type ZukanRegionalCorePredicate,
} from "./zukanRegionalCorePredicates.js";

export const ZUKAN_GENERIC_RECORD_PERSISTENCE_SCHEMA =
  "zukan.generic-record-persistence-plan/v1" as const;

export type GenericRecordValueArtifact = {
  artifactId: string;
  valueJson: string;
  contentSha256: string;
  availabilityStatus: "available";
};

export type GenericRecordPayloadScope = {
  payloadArtifactId: string;
  tenantId: string;
  workspaceId: null;
};

export type GenericRecordRow = {
  recordId: string;
  tenantId: string;
  workspaceId: null;
  recordKind: RegionalKnowledgeEnvelopePlan["record"]["recordKind"];
  recordedAt: string;
  occurredAt: string | null;
  actorSubjectId: string | null;
  payloadArtifactId: string;
  provenanceStatus: RegionalKnowledgeEnvelopePlan["record"]["provenanceStatus"];
  visibility: RegionalVisibility;
};

export type GenericRecordSubjectLink = {
  recordId: string;
  subjectId: string;
  subjectRole: "place" | "entity";
  ordinal: number;
};

export type GenericRecordSourceLink = {
  recordId: string;
  sourceEditionId: string;
  linkRole: "provenance";
  sourceSelectorJson: string;
};

export type GenericRecordClaim = {
  claimId: string;
  subjectId: string;
  predicateUri: string;
  predicateVersion: number;
  tenantId: string;
  workspaceId: null;
};

export type GenericRecordClaimRevision = {
  claimRevisionId: string;
  claimId: string;
  revision: 1;
  predicateUri: string;
  predicateVersion: number;
  valueArtifactId: string;
  assertedBySubjectId: string | null;
  polarity: "positive";
  observedAt: string | null;
  recordedAt: string;
  visibility: RegionalVisibility;
  revisionMetadataJson: string;
};

export type GenericClaimRecordLink = {
  claimRevisionId: string;
  recordId: string;
  linkRole: "asserted_from" | "reviewed_from";
};

export type GenericRecordPersistencePlan = {
  schema: typeof ZUKAN_GENERIC_RECORD_PERSISTENCE_SCHEMA;
  mode: "dry_run";
  tenantId: string;
  writeEnabled: false;
  predicates: ZukanRegionalCorePredicate[];
  valueArtifacts: GenericRecordValueArtifact[];
  recordPayloadScopes: GenericRecordPayloadScope[];
  records: GenericRecordRow[];
  recordSubjectLinks: GenericRecordSubjectLink[];
  recordSourceLinks: GenericRecordSourceLink[];
  claims: GenericRecordClaim[];
  claimRevisions: GenericRecordClaimRevision[];
  claimRecordLinks: GenericClaimRecordLink[];
  dependencies: {
    subjectIds: string[];
    sourceEditionIds: string[];
    rightsBasisIds: string[];
    predicateKeys: string[];
  };
  blockers: string[];
  warnings: string[];
  payloadSha256: string;
  counts: {
    valueArtifacts: number;
    recordPayloadScopes: number;
    records: number;
    subjectLinks: number;
    sourceLinks: number;
    claims: number;
    claimRevisions: number;
    claimRecordLinks: number;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isCanonicalUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function sourceSelectorJson(payloadJson: string): string {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "{}";
    const payload = parsed as Record<string, unknown>;
    const locator = payload.sourceRecordLocator ?? payload.sourceLocator ?? null;
    return canonicalFoundationJson(locator === null ? {} : { locator: String(locator) });
  } catch {
    return "{}";
  }
}

function requireCanonicalIds(
  kind: string,
  values: readonly string[],
  blockers: string[],
): void {
  for (const value of values) {
    if (!isCanonicalUuid(value)) blockers.push(`${kind}_not_canonical_uuid:${value}`);
  }
}

export function planGenericRecordPersistence(
  envelope: RegionalKnowledgeEnvelopePlan,
): GenericRecordPersistencePlan {
  const blockers = [...envelope.blockers];
  const warnings = [...envelope.warnings];
  const tenantId = envelope.tenantId.trim();
  const record = envelope.record;

  if (!isCanonicalUuid(record.recordId)) {
    blockers.push(`record_id_not_canonical_uuid:${record.recordId}`);
  }

  const placeSubjectIds = uniqueSorted(record.placeSubjectIds);
  const entitySubjectIds = uniqueSorted(record.entitySubjectIds);
  const sourceEditionIds = uniqueSorted(record.sourceEditionIds);
  const rightsBasisIds = uniqueSorted(record.rightsBasisIds);
  const subjectIds = uniqueSorted([
    ...placeSubjectIds,
    ...entitySubjectIds,
    ...envelope.claims.map((claim) => claim.subjectId),
    ...envelope.claims.flatMap((claim) =>
      claim.accountableReviewerId ? [claim.accountableReviewerId] : []),
  ]);
  requireCanonicalIds("subject_id", subjectIds, blockers);
  requireCanonicalIds("source_edition_id", sourceEditionIds, blockers);
  requireCanonicalIds("rights_basis_id", rightsBasisIds, blockers);

  const payloadArtifactId = deterministicRegionalKnowledgeUuid({
    tenantId,
    entityKind: "record_payload_artifact",
    externalId: record.externalRecordId,
  });
  const valueArtifacts: GenericRecordValueArtifact[] = [{
    artifactId: payloadArtifactId,
    valueJson: record.payloadJson,
    contentSha256: record.payloadSha256,
    availabilityStatus: "available",
  }];
  const recordPayloadScopes: GenericRecordPayloadScope[] = [{
    payloadArtifactId,
    tenantId,
    workspaceId: null,
  }];

  const records: GenericRecordRow[] = [{
    recordId: record.recordId,
    tenantId,
    workspaceId: null,
    recordKind: record.recordKind,
    recordedAt: record.recordedAt,
    occurredAt: record.occurredAt,
    actorSubjectId: null,
    payloadArtifactId,
    provenanceStatus: record.provenanceStatus,
    visibility: record.visibility,
  }];

  const recordSubjectLinks: GenericRecordSubjectLink[] = [
    ...placeSubjectIds.map((subjectId, ordinal) => ({
      recordId: record.recordId,
      subjectId,
      subjectRole: "place" as const,
      ordinal,
    })),
    ...entitySubjectIds.map((subjectId, ordinal) => ({
      recordId: record.recordId,
      subjectId,
      subjectRole: "entity" as const,
      ordinal,
    })),
  ].sort((left, right) =>
    left.subjectRole.localeCompare(right.subjectRole)
    || left.ordinal - right.ordinal
    || left.subjectId.localeCompare(right.subjectId));

  const selectorJson = sourceSelectorJson(record.payloadJson);
  const recordSourceLinks: GenericRecordSourceLink[] = sourceEditionIds.map((sourceEditionId) => ({
    recordId: record.recordId,
    sourceEditionId,
    linkRole: "provenance",
    sourceSelectorJson: selectorJson,
  }));

  const predicates = new Map<string, ZukanRegionalCorePredicate>();
  const claims: GenericRecordClaim[] = [];
  const claimRevisions: GenericRecordClaimRevision[] = [];
  const claimRecordLinks: GenericClaimRecordLink[] = [];

  for (const candidate of [...envelope.claims]
    .sort((left, right) => left.externalClaimId.localeCompare(right.externalClaimId))) {
    const predicate = regionalCorePredicateByUri(candidate.predicateUri, candidate.predicateVersion);
    if (!predicate) {
      blockers.push(`predicate_not_registered:${candidate.predicateUri}:${candidate.predicateVersion}`);
      continue;
    }
    predicates.set(`${predicate.predicateUri}@${predicate.predicateVersion}`, predicate);

    if (!isCanonicalUuid(candidate.subjectId)) {
      blockers.push(`claim_subject_not_canonical_uuid:${candidate.externalClaimId}`);
    }
    if (candidate.accountableReviewerId && !isCanonicalUuid(candidate.accountableReviewerId)) {
      blockers.push(`claim_reviewer_not_canonical_uuid:${candidate.externalClaimId}`);
    }
    if (candidate.visibility === "restricted") {
      blockers.push(`d1_restricted_claim_visibility_not_supported:${candidate.externalClaimId}`);
    }
    if (candidate.visibility === "public_candidate"
      && (candidate.reviewState !== "human_reviewed"
        || !candidate.accountableReviewerId
        || !candidate.assertedAt)) {
      blockers.push(`public_claim_requires_accountable_review:${candidate.externalClaimId}`);
    }
    if (candidate.visibility === "public_candidate" && rightsBasisIds.length === 0) {
      blockers.push(`public_claim_requires_rights_basis:${candidate.externalClaimId}`);
    }

    const claimId = deterministicRegionalKnowledgeUuid({
      tenantId,
      entityKind: "claim",
      externalId: candidate.externalClaimId,
    });
    const claimRevisionId = deterministicRegionalKnowledgeUuid({
      tenantId,
      entityKind: "claim_revision:1",
      externalId: candidate.externalClaimId,
    });
    const valueArtifactId = deterministicRegionalKnowledgeUuid({
      tenantId,
      entityKind: "claim_value_artifact",
      externalId: candidate.externalClaimId,
    });
    valueArtifacts.push({
      artifactId: valueArtifactId,
      valueJson: candidate.valueJson,
      contentSha256: sha256(candidate.valueJson),
      availabilityStatus: "available",
    });
    claims.push({
      claimId,
      subjectId: candidate.subjectId,
      predicateUri: candidate.predicateUri,
      predicateVersion: candidate.predicateVersion,
      tenantId,
      workspaceId: null,
    });
    claimRevisions.push({
      claimRevisionId,
      claimId,
      revision: 1,
      predicateUri: candidate.predicateUri,
      predicateVersion: candidate.predicateVersion,
      valueArtifactId,
      assertedBySubjectId: candidate.accountableReviewerId,
      polarity: "positive",
      observedAt: record.occurredAt,
      recordedAt: candidate.assertedAt ?? record.recordedAt,
      visibility: candidate.visibility,
      revisionMetadataJson: canonicalFoundationJson({
        externalClaimId: candidate.externalClaimId,
        sourceRecordId: record.recordId,
        reviewState: candidate.reviewState,
        assertedAt: candidate.assertedAt,
        specialistConclusion: candidate.specialistConclusion,
        evidenceRefs: uniqueSorted(candidate.evidenceRefs),
      }),
    });
    claimRecordLinks.push({
      claimRevisionId,
      recordId: record.recordId,
      linkRole: candidate.reviewState === "human_reviewed" ? "reviewed_from" : "asserted_from",
    });
  }

  if (envelope.publication) {
    warnings.push("publication_candidate_requires_resolution_snapshot_before_persistence");
  }
  warnings.push("record_status_and_public_reader_remain_disabled");

  const dependencies = {
    subjectIds,
    sourceEditionIds,
    rightsBasisIds,
    predicateKeys: [...predicates.keys()].sort(),
  };

  const planWithoutDigest = {
    schema: ZUKAN_GENERIC_RECORD_PERSISTENCE_SCHEMA,
    mode: "dry_run" as const,
    tenantId,
    writeEnabled: false as const,
    predicates: [...predicates.values()].sort((left, right) =>
      left.predicateUri.localeCompare(right.predicateUri)
      || left.predicateVersion - right.predicateVersion),
    valueArtifacts: valueArtifacts.sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
    recordPayloadScopes,
    records,
    recordSubjectLinks,
    recordSourceLinks,
    claims: claims.sort((left, right) => left.claimId.localeCompare(right.claimId)),
    claimRevisions: claimRevisions.sort((left, right) =>
      left.claimRevisionId.localeCompare(right.claimRevisionId)),
    claimRecordLinks: claimRecordLinks.sort((left, right) =>
      left.claimRevisionId.localeCompare(right.claimRevisionId)),
    dependencies,
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
  };

  const payloadSha256 = sha256(canonicalFoundationJson(planWithoutDigest));
  return {
    ...planWithoutDigest,
    payloadSha256,
    counts: {
      valueArtifacts: planWithoutDigest.valueArtifacts.length,
      recordPayloadScopes: planWithoutDigest.recordPayloadScopes.length,
      records: planWithoutDigest.records.length,
      subjectLinks: planWithoutDigest.recordSubjectLinks.length,
      sourceLinks: planWithoutDigest.recordSourceLinks.length,
      claims: planWithoutDigest.claims.length,
      claimRevisions: planWithoutDigest.claimRevisions.length,
      claimRecordLinks: planWithoutDigest.claimRecordLinks.length,
    },
  };
}
