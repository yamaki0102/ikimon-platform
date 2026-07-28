import { createHash } from "node:crypto";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  type RegionalPublisher,
  type RegionalSourceAsset,
} from "./regionalSourceRegistry.js";
import {
  canonicalFoundationJson,
  foundationSourceImportEntityCount,
  type FoundationRepositoryCapabilities,
  type FoundationSourceImportBatch,
  type FoundationSourceImportState,
  type ZukanFoundationV2Repository,
} from "./zukanFoundationV2RepositoryContract.js";
import {
  lookupForFoundationSourceImport,
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";

export type FoundationReadOnlyRepository = Pick<
  ZukanFoundationV2Repository,
  "dialect" | "capabilities" | "readSourceImportState"
>;

export type FoundationIdentityCandidate = {
  subjectId: string;
  matchSignals: string[];
};

declare const verifiedFoundationEvidenceSourceSha: unique symbol;
export type VerifiedFoundationEvidenceSourceSha = string & {
  readonly [verifiedFoundationEvidenceSourceSha]: true;
};

export interface FoundationIdentityCandidateReader {
  searchIdentityCandidates(input: {
    tenantId: string;
    publisher: RegionalPublisher;
  }): Promise<FoundationIdentityCandidate[]>;
}

export type FoundationCanonicalItem = {
  kind:
    | "subject_identity"
    | "source_work"
    | "source_edition"
    | "content_fixity_event"
    | "content_object"
    | "public_identifier";
  id: string;
  canonicalJson: string;
};

export type FoundationShadowItemDiff = {
  kind: FoundationCanonicalItem["kind"];
  id: string;
  status: "would_insert" | "unchanged" | "conflict";
  desiredProjectionSha256: string;
  foundationSha256: string | null;
};

export type FoundationSourceRegistryReadOnlyEvidence = {
  schema: "zukan.foundation-source-registry-read-only-evidence/v1";
  mode: "read_only_dry_run";
  source: {
    commitSha: string;
    verification: "git_head_clean";
  };
  target: {
    evidenceKind: "direct_read_only" | "remote_snapshot_export";
    dialect: FoundationReadOnlyRepository["dialect"];
    locator: string;
    capabilities: FoundationRepositoryCapabilities;
    readOnlyEnforcement:
      | "postgres_default_transaction_read_only"
      | "d1_wrangler_select_only"
      | "d1_database_sync_read_only";
  };
  tenantId: string;
  sourceRegistry: {
    publisherCount: number;
    sourceAssetCount: number;
    entityCount: number;
    projectionSha256: string;
  };
  runs: [
    {
      manifestSha256: string;
      payloadSha256: string;
      itemDiffSha256: string;
      itemDiff: FoundationShadowItemDiff[];
    },
    {
      manifestSha256: string;
      payloadSha256: string;
      itemDiffSha256: string;
      itemDiff: FoundationShadowItemDiff[];
    },
  ];
  twoRunStability: {
    stable: boolean;
    manifestMatch: boolean;
    payloadMatch: boolean;
    itemDiffMatch: boolean;
  };
  identityCandidates: Array<{
    externalPublisherId: string;
    candidates: FoundationIdentityCandidate[];
    disposition: "manual_review_required";
    autoCanonicalized: false;
    autoSamePlace: false;
  }>;
  rights: {
    status: "unknown";
    warnings: string[];
  };
  mutationEvidence: {
    before: { stateSha256: string; entityCount: number };
    after: { stateSha256: string; entityCount: number };
    mutationCount: number;
    unchanged: boolean;
  };
  rolloutBoundary: {
    publicResponseChanged: false;
    writeMethodsInvoked: 0;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sortBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((left, right) => key(left).localeCompare(key(right)));
}

export function canonicalizeFoundationSourceImportState(
  state: FoundationSourceImportState,
): FoundationSourceImportState {
  return {
    subjects: sortBy(state.subjects, (item) => item.subjectId),
    sourceWorks: sortBy(state.sourceWorks, (item) => item.sourceWorkId),
    sourceEditions: sortBy(state.sourceEditions, (item) => item.sourceEditionId),
    contentFixityEvents: sortBy(state.contentFixityEvents, (item) => item.fixityEventId),
    contentObjects: sortBy(state.contentObjects, (item) => item.contentObjectId),
    publicIdentifiers: sortBy(state.publicIdentifiers, (item) => item.publicIdentifierId),
  };
}

export function canonicalFoundationItemsFromBatch(
  batch: FoundationSourceImportBatch,
): FoundationCanonicalItem[] {
  return [
    ...batch.subjects.map((item) => ({
      kind: "subject_identity" as const,
      id: item.subjectId,
      canonicalJson: canonicalFoundationJson(item),
    })),
    ...batch.sourceWorks.map((item) => ({
      kind: "source_work" as const,
      id: item.sourceWorkId,
      canonicalJson: canonicalFoundationJson(item),
    })),
    ...batch.sourceEditions.map((item) => ({
      kind: "source_edition" as const,
      id: item.sourceEditionId,
      canonicalJson: canonicalFoundationJson(item),
    })),
    ...batch.contentFixityEvents.map((item) => ({
      kind: "content_fixity_event" as const,
      id: item.fixityEventId,
      canonicalJson: canonicalFoundationJson(item),
    })),
    ...batch.contentObjects.map((item) => ({
      kind: "content_object" as const,
      id: item.contentObjectId,
      canonicalJson: canonicalFoundationJson(item),
    })),
    ...batch.publicIdentifiers.map((item) => ({
      kind: "public_identifier" as const,
      id: item.publicIdentifierId,
      canonicalJson: canonicalFoundationJson(item),
    })),
  ].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

export function canonicalFoundationItemsFromState(
  state: FoundationSourceImportState,
): FoundationCanonicalItem[] {
  return canonicalFoundationItemsFromBatch({
    schema: "zukan.foundation-source-import/v1",
    operation: "source_registry_import_v1",
    tenantId: "",
    ...canonicalizeFoundationSourceImportState(state),
    payloadSha256: "0".repeat(64),
  });
}

export function buildFoundationItemShadowDiff(input: {
  desired: FoundationSourceImportBatch;
  actual: FoundationSourceImportState;
}): FoundationShadowItemDiff[] {
  const actual = new Map(
    canonicalFoundationItemsFromState(input.actual)
      .map((item) => [`${item.kind}\u0000${item.id}`, item.canonicalJson]),
  );
  return canonicalFoundationItemsFromBatch(input.desired).map((item) => {
    const current = actual.get(`${item.kind}\u0000${item.id}`) ?? null;
    return {
      kind: item.kind,
      id: item.id,
      status: current === null
        ? "would_insert"
        : current === item.canonicalJson
          ? "unchanged"
          : "conflict",
      desiredProjectionSha256: sha256(item.canonicalJson),
      foundationSha256: current === null ? null : sha256(current),
    };
  });
}

function stateDigest(state: FoundationSourceImportState): {
  stateSha256: string;
  entityCount: number;
} {
  const canonical = canonicalizeFoundationSourceImportState(state);
  return {
    stateSha256: sha256(canonicalFoundationJson(canonical)),
    entityCount: canonical.subjects.length
      + canonical.sourceWorks.length
      + canonical.sourceEditions.length
      + canonical.contentFixityEvents.length
      + canonical.contentObjects.length
      + canonical.publicIdentifiers.length,
  };
}

async function readIdentityCandidates(input: {
  tenantId: string;
  publishers: readonly RegionalPublisher[];
  reader: FoundationIdentityCandidateReader;
}): Promise<FoundationSourceRegistryReadOnlyEvidence["identityCandidates"]> {
  const output = await Promise.all(input.publishers.map(async (publisher) => ({
    externalPublisherId: publisher.publisherId,
    candidates: sortBy(
      (await input.reader.searchIdentityCandidates({
        tenantId: input.tenantId,
        publisher,
      })).map((candidate) => ({
        subjectId: candidate.subjectId,
        matchSignals: [...new Set(candidate.matchSignals)].sort(),
      })),
      (candidate) => candidate.subjectId,
    ),
    disposition: "manual_review_required" as const,
    autoCanonicalized: false as const,
    autoSamePlace: false as const,
  })));
  return output.sort((left, right) =>
    left.externalPublisherId.localeCompare(right.externalPublisherId));
}

async function captureRun(input: {
  repository: FoundationReadOnlyRepository;
  candidateReader: FoundationIdentityCandidateReader;
  tenantId: string;
  publishers: readonly RegionalPublisher[];
  sourceAssets: readonly RegionalSourceAsset[];
}): Promise<{
  state: FoundationSourceImportState;
  identityCandidates: FoundationSourceRegistryReadOnlyEvidence["identityCandidates"];
  manifestSha256: string;
  payloadSha256: string;
  itemDiffSha256: string;
  itemDiff: FoundationShadowItemDiff[];
}> {
  const desired = planRegionalSourceFoundationImport({
    tenantId: input.tenantId,
    publishers: input.publishers,
    sourceAssets: input.sourceAssets,
  });
  const state = canonicalizeFoundationSourceImportState(
    await input.repository.readSourceImportState(lookupForFoundationSourceImport(desired.batch)),
  );
  const plan = planRegionalSourceFoundationImport({
    tenantId: input.tenantId,
    publishers: input.publishers,
    sourceAssets: input.sourceAssets,
    existing: state,
  });
  const itemDiff = buildFoundationItemShadowDiff({
    desired: plan.batch,
    actual: state,
  });
  const identityCandidates = await readIdentityCandidates({
    tenantId: input.tenantId,
    publishers: input.publishers,
    reader: input.candidateReader,
  });
  const itemDiffSha256 = sha256(canonicalFoundationJson(itemDiff));
  const manifest = {
    payloadSha256: plan.payloadSha256,
    blockers: plan.blockers,
    unmapped: plan.unmapped,
    counts: plan.counts,
    itemDiffSha256,
    identityCandidates,
  };
  return {
    state,
    identityCandidates,
    manifestSha256: sha256(canonicalFoundationJson(manifest)),
    payloadSha256: plan.payloadSha256,
    itemDiffSha256,
    itemDiff,
  };
}

export async function buildFoundationSourceRegistryReadOnlyEvidence(input: {
  repository: FoundationReadOnlyRepository;
  candidateReader: FoundationIdentityCandidateReader;
  tenantId: string;
  sourceSha: VerifiedFoundationEvidenceSourceSha;
  target: {
    evidenceKind: FoundationSourceRegistryReadOnlyEvidence["target"]["evidenceKind"];
    locator: string;
    readOnlyEnforcement: FoundationSourceRegistryReadOnlyEvidence["target"]["readOnlyEnforcement"];
  };
  publishers?: readonly RegionalPublisher[];
  sourceAssets?: readonly RegionalSourceAsset[];
}): Promise<FoundationSourceRegistryReadOnlyEvidence> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("foundation_evidence_tenant_required");
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha)) {
    throw new Error("foundation_evidence_source_sha_not_verified");
  }
  const targetLocator = input.target.locator.trim();
  if (!targetLocator) throw new Error("foundation_evidence_target_locator_required");
  const publishers = input.publishers ?? REGIONAL_PUBLISHERS;
  const sourceAssets = input.sourceAssets ?? REGIONAL_SOURCE_ASSETS;
  const capabilities = await input.repository.capabilities();
  if (!capabilities.available) {
    throw new Error(`foundation_evidence_repository_unavailable:${capabilities.blockers.join(",")}`);
  }

  const first = await captureRun({
    repository: input.repository,
    candidateReader: input.candidateReader,
    tenantId,
    publishers,
    sourceAssets,
  });
  const second = await captureRun({
    repository: input.repository,
    candidateReader: input.candidateReader,
    tenantId,
    publishers,
    sourceAssets,
  });
  const before = stateDigest(first.state);
  const after = stateDigest(second.state);
  const manifestMatch = first.manifestSha256 === second.manifestSha256;
  const payloadMatch = first.payloadSha256 === second.payloadSha256;
  const itemDiffMatch = first.itemDiffSha256 === second.itemDiffSha256
    && canonicalFoundationJson(first.itemDiff) === canonicalFoundationJson(second.itemDiff);
  const candidateMatch = canonicalFoundationJson(first.identityCandidates)
    === canonicalFoundationJson(second.identityCandidates);
  const unchanged = before.stateSha256 === after.stateSha256
    && before.entityCount === after.entityCount;
  const projection = planRegionalSourceFoundationImport({
    tenantId,
    publishers,
    sourceAssets,
  });

  return {
    schema: "zukan.foundation-source-registry-read-only-evidence/v1",
    mode: "read_only_dry_run",
    source: {
      commitSha: input.sourceSha,
      verification: "git_head_clean",
    },
    target: {
      evidenceKind: input.target.evidenceKind,
      dialect: input.repository.dialect,
      locator: targetLocator,
      capabilities,
      readOnlyEnforcement: input.target.readOnlyEnforcement,
    },
    tenantId,
    sourceRegistry: {
      publisherCount: publishers.length,
      sourceAssetCount: sourceAssets.length,
      entityCount: foundationSourceImportEntityCount(projection.batch),
      projectionSha256: sha256(canonicalFoundationJson(
        canonicalFoundationItemsFromBatch(projection.batch),
      )),
    },
    runs: [
      {
        manifestSha256: first.manifestSha256,
        payloadSha256: first.payloadSha256,
        itemDiffSha256: first.itemDiffSha256,
        itemDiff: first.itemDiff,
      },
      {
        manifestSha256: second.manifestSha256,
        payloadSha256: second.payloadSha256,
        itemDiffSha256: second.itemDiffSha256,
        itemDiff: second.itemDiff,
      },
    ],
    twoRunStability: {
      stable: manifestMatch && payloadMatch && itemDiffMatch && candidateMatch && unchanged,
      manifestMatch,
      payloadMatch,
      itemDiffMatch,
    },
    identityCandidates: first.identityCandidates,
    rights: {
      status: "unknown",
      warnings: sourceAssets
        .map((source) => `rights_unknown_requires_review:${source.sourceAssetId}`)
        .sort(),
    },
    mutationEvidence: {
      before,
      after,
      mutationCount: unchanged
        ? 0
        : Math.max(1, Math.abs(before.entityCount - after.entityCount)),
      unchanged,
    },
    rolloutBoundary: {
      publicResponseChanged: false,
      writeMethodsInvoked: 0,
    },
  };
}
