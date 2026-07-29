import { createHash } from "node:crypto";
import {
  IWATA_OPEN_DATA_ITEMS,
  IWATA_OPEN_DATA_LICENSE_LABEL,
  IWATA_OPEN_DATA_RETRIEVED_AT,
  type IwataOpenDataItem,
} from "./iwataOpenDataSnapshot.js";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";
import {
  deterministicFoundationUuid,
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";
import {
  planGenericRecordPersistence,
  type GenericRecordPersistencePlan,
} from "./zukanGenericRecordPersistencePlan.js";
import {
  deterministicRegionalKnowledgeUuid,
  planRegionalKnowledgeEnvelope,
  type RegionalKnowledgeClaimInput,
  type RegionalKnowledgeEnvelopePlan,
} from "./zukanRegionalKnowledgeEnvelope.js";

export const ZUKAN_IWATA_CULTURAL_SLICE_V2_SCHEMA =
  "zukan.iwata-cultural-slice/v2" as const;

const CULTURAL_SOURCE_ASSET_ID = "source:iwata:cultural-properties-linkdata";
const IWATA_PLACE_EXTERNAL_ID = "place:jp-shizuoka-iwata";

export type IwataCulturalField =
  | "name"
  | "address"
  | "summary"
  | "source_updated_at";

export type IwataCulturalReview = {
  reviewerSubjectId: string;
  reviewedAt: string;
  approvedFields: readonly IwataCulturalField[];
  rightsBasisId: string;
  publicationOwnerSubjectId: string;
};

export type IwataCulturalSliceInput = {
  tenantId: string;
  sourceRecordId: string;
  review?: IwataCulturalReview | null;
};

export type IwataCulturalIdentityCandidate = {
  state: "candidate";
  sourceEntitySubjectId: string;
  targetExternalRecordId: string;
  targetEntitySubjectId: string;
  reason: "source_attribute_same_place_candidate";
  automaticMergeAllowed: false;
};

export type IwataCulturalPublicationCandidate = {
  publicationCandidateId: string;
  outputKind: "regional_view" | "review_csv";
  state: "shadow_candidate";
  ownerSubjectId: string;
  reviewerSubjectId: string;
  reviewedAt: string;
  sourceRecordIds: string[];
  selectedClaimCandidateIds: string[];
  sourceEditionIds: string[];
  rightsBasisIds: string[];
  manifestSha256: string;
};

export type IwataCulturalSlicePlan = {
  schema: typeof ZUKAN_IWATA_CULTURAL_SLICE_V2_SCHEMA;
  mode: "shadow_only";
  tenantId: string;
  sourceItem: IwataOpenDataItem;
  sourceEditionId: string;
  placeSubjectId: string;
  entitySubjectId: string;
  envelope: RegionalKnowledgeEnvelopePlan;
  persistence: GenericRecordPersistencePlan;
  viewCandidate: {
    viewCandidateId: string;
    title: string;
    placeSubjectId: string;
    entitySubjectId: string;
    reviewState: "review_pending" | "reviewed_for_shadow_publication";
    location: {
      state: "missing_in_source" | "source_coordinates_available";
      latitude: number | null;
      longitude: number | null;
      address: string | null;
    };
    source: {
      sourceAssetId: string;
      sourceEditionId: string;
      sourceRecordId: string;
      sourceUrl: string;
      sourceUpdatedAt: string;
      retrievedAt: string;
      licenseLabel: string;
    };
    identityCandidates: IwataCulturalIdentityCandidate[];
  };
  publicationCandidates: IwataCulturalPublicationCandidate[];
  gates: string[];
  blockers: string[];
  warnings: string[];
  payloadSha256: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalTimestamp(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(raw)
    ? `${raw}T00:00:00.000Z`
    : raw;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function isCanonicalUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
}

function resolveCulturalItem(sourceRecordId: string): IwataOpenDataItem {
  const item = IWATA_OPEN_DATA_ITEMS.find((candidate) =>
    candidate.dataset === "cultural" && candidate.sourceRecordId === sourceRecordId);
  if (!item) throw new Error(`iwata_cultural_source_record_not_found:${sourceRecordId}`);
  return item;
}

function resolveCulturalSource() {
  const source = REGIONAL_SOURCE_ASSETS.find((candidate) =>
    candidate.sourceAssetId === CULTURAL_SOURCE_ASSET_ID);
  if (!source) throw new Error("iwata_cultural_source_asset_not_registered");
  return source;
}

function buildClaim(input: {
  item: IwataOpenDataItem;
  field: IwataCulturalField;
  value: unknown;
  subjectId: string;
  sourceEditionId: string;
  review: IwataCulturalReview | null;
  approved: ReadonlySet<IwataCulturalField>;
}): RegionalKnowledgeClaimInput {
  const reviewed = input.review !== null && input.approved.has(input.field);
  return {
    externalClaimId: `iwata:cultural:${input.item.sourceRecordId}:claim:${input.field}`,
    subjectId: input.subjectId,
    predicateUri: `https://zukan.earth/predicate/${input.field.replaceAll("_", "-")}`,
    predicateVersion: 1,
    value: input.value,
    evidenceRefs: [input.sourceEditionId],
    reviewState: reviewed ? "human_reviewed" : "unreviewed",
    accountableReviewerId: reviewed ? input.review?.reviewerSubjectId ?? null : null,
    specialistConclusion: false,
    visibility: reviewed ? "public_candidate" : "workspace",
  };
}

function buildClaims(input: {
  item: IwataOpenDataItem;
  subjectId: string;
  sourceEditionId: string;
  review: IwataCulturalReview | null;
}): RegionalKnowledgeClaimInput[] {
  const approved = new Set<IwataCulturalField>(
    input.review ? uniqueSorted(input.review.approvedFields) as IwataCulturalField[] : [],
  );
  const claims: RegionalKnowledgeClaimInput[] = [
    buildClaim({ ...input, approved, field: "name", value: input.item.name }),
    buildClaim({
      ...input,
      approved,
      field: "source_updated_at",
      value: canonicalTimestamp(input.item.sourceUpdatedAt),
    }),
  ];
  if (input.item.address !== null) {
    claims.push(buildClaim({ ...input, approved, field: "address", value: input.item.address }));
  }
  if (input.item.summary !== null) {
    claims.push(buildClaim({ ...input, approved, field: "summary", value: input.item.summary }));
  }
  return claims.sort((left, right) => left.externalClaimId.localeCompare(right.externalClaimId));
}

function identityCandidates(input: {
  tenantId: string;
  item: IwataOpenDataItem;
  entitySubjectId: string;
}): IwataCulturalIdentityCandidate[] {
  const target = input.item.attributes.samePlaceCandidate;
  if (typeof target !== "string" || target.trim() === "") return [];
  return [{
    state: "candidate",
    sourceEntitySubjectId: input.entitySubjectId,
    targetExternalRecordId: target,
    targetEntitySubjectId: deterministicFoundationUuid({
      tenantId: input.tenantId,
      entityKind: "subject_identity:regional_entity",
      externalId: target,
    }),
    reason: "source_attribute_same_place_candidate",
    automaticMergeAllowed: false,
  }];
}

function buildPublication(input: {
  tenantId: string;
  outputKind: IwataCulturalPublicationCandidate["outputKind"];
  envelope: RegionalKnowledgeEnvelopePlan;
  review: IwataCulturalReview;
}): IwataCulturalPublicationCandidate {
  const reviewedAt = canonicalTimestamp(input.review.reviewedAt);
  if (!reviewedAt) throw new Error("iwata_cultural_reviewed_at_invalid");
  const manifestCore = {
    outputKind: input.outputKind,
    ownerSubjectId: input.review.publicationOwnerSubjectId.trim(),
    reviewerSubjectId: input.review.reviewerSubjectId.trim(),
    reviewedAt,
    sourceRecordIds: [input.envelope.record.recordId],
    selectedClaimCandidateIds: input.envelope.claims
      .filter((claim) =>
        claim.reviewState === "human_reviewed" && claim.visibility === "public_candidate")
      .map((claim) => claim.claimCandidateId)
      .sort(),
    sourceEditionIds: [...input.envelope.record.sourceEditionIds].sort(),
    rightsBasisIds: [...input.envelope.record.rightsBasisIds].sort(),
  };
  return {
    publicationCandidateId: deterministicRegionalKnowledgeUuid({
      tenantId: input.tenantId,
      entityKind: `iwata_cultural_publication:${input.outputKind}`,
      externalId: input.envelope.record.externalRecordId,
    }),
    state: "shadow_candidate",
    ...manifestCore,
    manifestSha256: sha256(canonicalFoundationJson(manifestCore)),
  };
}

export function planIwataCulturalSliceV2(
  input: IwataCulturalSliceInput,
): IwataCulturalSlicePlan {
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("iwata_cultural_tenant_required");
  const sourceRecordId = input.sourceRecordId.trim();
  if (!sourceRecordId) throw new Error("iwata_cultural_source_record_required");

  const item = resolveCulturalItem(sourceRecordId);
  const source = resolveCulturalSource();
  const sourceImport = planRegionalSourceFoundationImport({
    tenantId,
    sourceAssets: [source],
  });
  if (sourceImport.blockers.length > 0) {
    throw new Error(`iwata_cultural_source_projection_blocked:${sourceImport.blockers.join(",")}`);
  }
  const sourceEdition = sourceImport.batch.sourceEditions[0];
  if (!sourceEdition) throw new Error("iwata_cultural_source_edition_missing");

  const placeSubjectId = deterministicFoundationUuid({
    tenantId,
    entityKind: "subject_identity:place",
    externalId: IWATA_PLACE_EXTERNAL_ID,
  });
  const entitySubjectId = deterministicFoundationUuid({
    tenantId,
    entityKind: "subject_identity:regional_entity",
    externalId: item.id,
  });
  const review = input.review ?? null;
  const claims = buildClaims({
    item,
    subjectId: entitySubjectId,
    sourceEditionId: sourceEdition.sourceEditionId,
    review,
  });

  const blockers: string[] = [];
  const gates: string[] = [];
  if (!review) {
    gates.push("human_review_pending", "rights_basis_materialization_pending");
  } else {
    if (!isCanonicalUuid(review.reviewerSubjectId)) blockers.push("reviewer_subject_not_canonical_uuid");
    if (!canonicalTimestamp(review.reviewedAt)) blockers.push("reviewed_at_invalid");
    if (uniqueSorted(review.approvedFields).length === 0) blockers.push("approved_claim_required");
    if (!isCanonicalUuid(review.rightsBasisId)) blockers.push("rights_basis_not_canonical_uuid");
    if (!isCanonicalUuid(review.publicationOwnerSubjectId)) {
      blockers.push("publication_owner_not_canonical_uuid");
    }
  }

  const approvedClaimIds = claims
    .filter((claim) => claim.reviewState === "human_reviewed")
    .map((claim) => claim.externalClaimId)
    .sort();
  const envelope = planRegionalKnowledgeEnvelope({
    tenantId,
    externalRecordId: `iwata:cultural:${item.sourceRecordId}:source-record`,
    recordKind: "source_record",
    recordedAt: IWATA_OPEN_DATA_RETRIEVED_AT,
    occurredAt: item.sourceUpdatedAt,
    placeSubjectIds: [placeSubjectId],
    entitySubjectIds: [entitySubjectId],
    sourceEditionIds: [sourceEdition.sourceEditionId],
    evidenceObjectIds: [],
    rightsBasisIds: review && isCanonicalUuid(review.rightsBasisId)
      ? [review.rightsBasisId]
      : [],
    provenanceStatus: "known",
    visibility: "workspace",
    payload: {
      dataset: item.dataset,
      sourceRecordId: item.sourceRecordId,
      sourceLocator: `linkdata-record:${item.sourceRecordId}`,
      sourceValues: {
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        summary: item.summary,
        attributes: item.attributes,
      },
      automaticIdentityMerge: false,
    },
    claims,
    publication: review && blockers.length === 0 && approvedClaimIds.length > 0
      ? {
        externalPublicationId: `iwata:cultural:${item.sourceRecordId}:regional-view`,
        audience: "iwata-regional-view-shadow",
        purpose: "reviewed-regional-knowledge-preview",
        selectedClaimExternalIds: approvedClaimIds,
      }
      : null,
    action: null,
  });
  const persistence = planGenericRecordPersistence(envelope);
  blockers.push(...envelope.blockers, ...persistence.blockers);

  const candidates = identityCandidates({ tenantId, item, entitySubjectId });
  if (candidates.length > 0) gates.push("identity_link_human_review_pending");

  const publicationCandidates = review && blockers.length === 0
    ? [
      buildPublication({ tenantId, outputKind: "regional_view", envelope, review }),
      buildPublication({ tenantId, outputKind: "review_csv", envelope, review }),
    ]
    : [];

  const planWithoutDigest = {
    schema: ZUKAN_IWATA_CULTURAL_SLICE_V2_SCHEMA,
    mode: "shadow_only" as const,
    tenantId,
    sourceItem: item,
    sourceEditionId: sourceEdition.sourceEditionId,
    placeSubjectId,
    entitySubjectId,
    envelope,
    persistence,
    viewCandidate: {
      viewCandidateId: deterministicRegionalKnowledgeUuid({
        tenantId,
        entityKind: "iwata_cultural_view_candidate",
        externalId: item.id,
      }),
      title: item.name,
      placeSubjectId,
      entitySubjectId,
      reviewState: publicationCandidates.length > 0
        ? "reviewed_for_shadow_publication" as const
        : "review_pending" as const,
      location: {
        state: item.latitude === null || item.longitude === null
          ? "missing_in_source" as const
          : "source_coordinates_available" as const,
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
      },
      source: {
        sourceAssetId: source.sourceAssetId,
        sourceEditionId: sourceEdition.sourceEditionId,
        sourceRecordId: item.sourceRecordId,
        sourceUrl: item.sourceUrl,
        sourceUpdatedAt: item.sourceUpdatedAt,
        retrievedAt: IWATA_OPEN_DATA_RETRIEVED_AT,
        licenseLabel: IWATA_OPEN_DATA_LICENSE_LABEL,
      },
      identityCandidates: candidates,
    },
    publicationCandidates,
    gates: [...new Set(gates)].sort(),
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set([...envelope.warnings, ...persistence.warnings])].sort(),
  };

  return {
    ...planWithoutDigest,
    payloadSha256: sha256(canonicalFoundationJson(planWithoutDigest)),
  };
}
