import { createHash } from "node:crypto";
import {
  IWATA_OPEN_DATA_ITEMS,
  IWATA_OPEN_DATA_LICENSE_LABEL,
  IWATA_OPEN_DATA_RETRIEVED_AT,
  type IwataOpenDataItem,
} from "./iwataOpenDataSnapshot.js";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import {
  canonicalFoundationJson,
} from "./zukanFoundationV2RepositoryContract.js";
import {
  deterministicFoundationUuid,
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";
import {
  deterministicRegionalKnowledgeUuid,
  planRegionalKnowledgeEnvelope,
  type RegionalKnowledgeEnvelopePlan,
  type RegionalKnowledgeClaimInput,
} from "./zukanRegionalKnowledgeEnvelope.js";

export const ZUKAN_IWATA_CULTURAL_VERTICAL_SLICE_SCHEMA =
  "zukan.iwata-cultural-vertical-slice/v1" as const;

const CULTURAL_SOURCE_ASSET_ID = "source:iwata:cultural-properties-linkdata";
const IWATA_PLACE_EXTERNAL_ID = "place:jp-shizuoka-iwata";

export type IwataCulturalClaimField =
  | "name"
  | "address"
  | "summary"
  | "source_updated_at";

export type IwataCulturalReviewApproval = {
  reviewerSubjectId: string;
  reviewedAt: string;
  approvedFields: readonly IwataCulturalClaimField[];
  rightsBasisId: string;
  publicationOwnerSubjectId: string;
};

export type IwataCulturalVerticalSliceInput = {
  tenantId: string;
  sourceRecordId: string;
  review?: IwataCulturalReviewApproval | null;
};

export type IwataIdentityLinkCandidate = {
  state: "candidate";
  sourceEntitySubjectId: string;
  targetExternalRecordId: string;
  targetEntitySubjectId: string;
  reason: "source_attribute_same_place_candidate";
  automaticMergeAllowed: false;
};

export type IwataCulturalViewCandidate = {
  viewCandidateId: string;
  placeSubjectId: string;
  entitySubjectId: string;
  title: string;
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
  claimCandidateIds: string[];
  identityLinkCandidates: IwataIdentityLinkCandidate[];
};

export type IwataPublicationManifestCandidate = {
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

export type IwataFoundationMappingReadiness = {
  existingPrimitives: string[];
  requiredBeforeWriter: string[];
  writerEnabled: false;
  runtimeReaderEnabled: false;
};

export type IwataCulturalVerticalSlicePlan = {
  schema: typeof ZUKAN_IWATA_CULTURAL_VERTICAL_SLICE_SCHEMA;
  mode: "shadow_only";
  tenantId: string;
  sourceItem: IwataOpenDataItem;
  sourceEditionId: string;
  placeSubjectId: string;
  entitySubjectId: string;
  envelope: RegionalKnowledgeEnvelopePlan;
  viewCandidate: IwataCulturalViewCandidate;
  publicationCandidates: IwataPublicationManifestCandidate[];
  foundationReadiness: IwataFoundationMappingReadiness;
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
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function culturalItem(sourceRecordId: string): IwataOpenDataItem {
  const item = IWATA_OPEN_DATA_ITEMS.find((candidate) =>
    candidate.dataset === "cultural" && candidate.sourceRecordId === sourceRecordId);
  if (!item) throw new Error(`iwata_cultural_source_record_not_found:${sourceRecordId}`);
  return item;
}

function culturalSourceAsset() {
  const source = REGIONAL_SOURCE_ASSETS.find((candidate) =>
    candidate.sourceAssetId === CULTURAL_SOURCE_ASSET_ID);
  if (!source) throw new Error("iwata_cultural_source_asset_not_registered");
  return source;
}

function approvedFieldSet(review: IwataCulturalReviewApproval | null): Set<IwataCulturalClaimField> {
  return new Set(review ? uniqueSorted(review.approvedFields) as IwataCulturalClaimField[] : []);
}

function claimInput(input: {
  item: IwataOpenDataItem;
  field: IwataCulturalClaimField;
  value: unknown;
  subjectId: string;
  sourceEditionId: string;
  review: IwataCulturalReviewApproval | null;
  approved: Set<IwataCulturalClaimField>;
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
  review: IwataCulturalReviewApproval | null;
}): RegionalKnowledgeClaimInput[] {
  const approved = approvedFieldSet(input.review);
  const claims: RegionalKnowledgeClaimInput[] = [
    claimInput({ ...input, field: "name", value: input.item.name, approved }),
    claimInput({ ...input, field: "source_updated_at", value: input.item.sourceUpdatedAt, approved }),
  ];
  if (input.item.address !== null) {
    claims.push(claimInput({ ...input, field: "address", value: input.item.address, approved }));
  }
  if (input.item.summary !== null) {
    claims.push(claimInput({ ...input, field: "summary", value: input.item.summary, approved }));
  }
  return claims.sort((left, right) => left.externalClaimId.localeCompare(right.externalClaimId));
}

function identityLinkCandidates(input: {
  tenantId: string;
  item: IwataOpenDataItem;
  entitySubjectId: string;
}): IwataIdentityLinkCandidate[] {
  const samePlaceCandidate = input.item.attributes.samePlaceCandidate;
  if (typeof samePlaceCandidate !== "string" || samePlaceCandidate.trim() === "") return [];
  return [{
    state: "candidate",
    sourceEntitySubjectId: input.entitySubjectId,
    targetExternalRecordId: samePlaceCandidate,
    targetEntitySubjectId: deterministicFoundationUuid({
      tenantId: input.tenantId,
      entityKind: "subject_identity:regional_entity",
      externalId: samePlaceCandidate,
    }),
    reason: "source_attribute_same_place_candidate",
    automaticMergeAllowed: false,
  }];
}

function publicationManifest(input: {
  tenantId: string;
  outputKind: IwataPublicationManifestCandidate["outputKind"];
  envelope: RegionalKnowledgeEnvelopePlan;
  review: IwataCulturalReviewApproval;
}): IwataPublicationManifestCandidate {
  const reviewedAt = canonicalTimestamp(input.review.reviewedAt);
  if (!reviewedAt) throw new Error("iwata_cultural_reviewed_at_invalid");
  const selectedClaimCandidateIds = input.envelope.claims
    .filter((claim) => claim.reviewState === "human_reviewed" && claim.visibility === "public_candidate")
    .map((claim) => claim.claimCandidateId)
    .sort();
  const sourceRecordIds = [input.envelope.record.recordId];
  const sourceEditionIds = [...input.envelope.record.sourceEditionIds].sort();
  const rightsBasisIds = [...input.envelope.record.rightsBasisIds].sort();
  const manifestCore = {
    outputKind: input.outputKind,
    ownerSubjectId: input.review.publicationOwnerSubjectId.trim(),
    reviewerSubjectId: input.review.reviewerSubjectId.trim(),
    reviewedAt,
    sourceRecordIds,
    selectedClaimCandidateIds,
    sourceEditionIds,
    rightsBasisIds,
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

export function planIwataCulturalVerticalSlice(
  input: IwataCulturalVerticalSliceInput,
): IwataCulturalVerticalSlicePlan {
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("iwata_cultural_tenant_required");
  const sourceRecordId = input.sourceRecordId.trim();
  if (!sourceRecordId) throw new Error("iwata_cultural_source_record_required");
  const item = culturalItem(sourceRecordId);
  const source = culturalSourceAsset();
  const sourcePlan = planRegionalSourceFoundationImport({
    tenantId,
    sourceAssets: [source],
  });
  if (sourcePlan.blockers.length > 0) {
    throw new Error(`iwata_cultural_source_projection_blocked:${sourcePlan.blockers.join(",")}`);
  }
  const sourceEdition = sourcePlan.batch.sourceEditions[0];
  if (!sourceEdition) throw new Error("iwata_cultural_source_edition_projection_missing");

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
  const claims = buildClaims({ item, subjectId: entitySubjectId, sourceEditionId: sourceEdition.sourceEditionId, review });
  const approvedClaimIds = claims
    .filter((claim) => claim.reviewState === "human_reviewed")
    .map((claim) => claim.externalClaimId)
    .sort();
  const rightsBasisIds = review?.rightsBasisId.trim() ? [review.rightsBasisId.trim()] : [];

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
    rightsBasisIds,
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
      extractionBoundary: "source_snapshot_only",
      automaticIdentityMerge: false,
    },
    claims,
    publication: review && approvedClaimIds.length > 0 && rightsBasisIds.length > 0
      ? {
        externalPublicationId: `iwata:cultural:${item.sourceRecordId}:regional-view`,
        audience: "iwata-regional-view-shadow",
        purpose: "reviewed-regional-knowledge-preview",
        selectedClaimExternalIds: approvedClaimIds,
      }
      : null,
    action: null,
  });

  const gates: string[] = [];
  const blockers = [...envelope.blockers];
  const warnings = [...envelope.warnings];
  if (!review) {
    gates.push("human_review_pending", "rights_basis_materialization_pending");
  } else {
    if (!review.reviewerSubjectId.trim()) blockers.push("reviewer_subject_required");
    if (!canonicalTimestamp(review.reviewedAt)) blockers.push("reviewed_at_invalid");
    if (approvedClaimIds.length === 0) blockers.push("approved_claim_required_for_publication");
    if (!review.rightsBasisId.trim()) blockers.push("rights_basis_required_for_publication");
    if (!review.publicationOwnerSubjectId.trim()) blockers.push("publication_owner_required");
  }

  const links = identityLinkCandidates({ tenantId, item, entitySubjectId });
  if (links.length > 0) gates.push("identity_link_human_review_pending");

  const publicationCandidates = review && blockers.length === 0
    ? [
      publicationManifest({ tenantId, outputKind: "regional_view", envelope, review }),
      publicationManifest({ tenantId, outputKind: "review_csv", envelope, review }),
    ]
    : [];

  const viewCandidate: IwataCulturalViewCandidate = {
    viewCandidateId: deterministicRegionalKnowledgeUuid({
      tenantId,
      entityKind: "iwata_cultural_view_candidate",
      externalId: item.id,
    }),
    placeSubjectId,
    entitySubjectId,
    title: item.name,
    reviewState: publicationCandidates.length > 0 ? "reviewed_for_shadow_publication" : "review_pending",
    location: {
      state: item.latitude === null || item.longitude === null
        ? "missing_in_source"
        : "source_coordinates_available",
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
    claimCandidateIds: envelope.claims.map((claim) => claim.claimCandidateId).sort(),
    identityLinkCandidates: links,
  };

  const foundationReadiness: IwataFoundationMappingReadiness = {
    existingPrimitives: [
      "zukan_subject_identities",
      "zukan_source_works",
      "zukan_source_editions",
      "zukan_value_artifacts",
      "zukan_claims",
      "zukan_claim_revisions",
      "zukan_projection_snapshots",
      "zukan_publication_editions",
    ],
    requiredBeforeWriter: [
      "first_class_generic_record_contract",
      "record_to_source_and_evidence_link_contract",
      "predicate_registry_entries_for_iwata_cultural_fields",
      "materialized_rights_basis",
      "shadow_tenant_writer_allowlist",
    ],
    writerEnabled: false,
    runtimeReaderEnabled: false,
  };

  const planWithoutDigest = {
    schema: ZUKAN_IWATA_CULTURAL_VERTICAL_SLICE_SCHEMA,
    mode: "shadow_only" as const,
    tenantId,
    sourceItem: item,
    sourceEditionId: sourceEdition.sourceEditionId,
    placeSubjectId,
    entitySubjectId,
    envelope,
    viewCandidate,
    publicationCandidates,
    foundationReadiness,
    gates: [...new Set(gates)].sort(),
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
  };

  return {
    ...planWithoutDigest,
    payloadSha256: sha256(canonicalFoundationJson(planWithoutDigest)),
  };
}
