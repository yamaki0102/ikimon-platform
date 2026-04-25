import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import { matchTaxon, type GbifMatch } from "./gbifBackboneMatch.js";
import {
  DEFAULT_COARSE_CEILING,
  buildAncestryChain,
  getCoarseCeilingForAncestry,
  isProposalWithinCommunityCeiling,
} from "./taxonPrecisionPolicy.js";
import { normalizeRank, rankOrder, type TaxonRank } from "./taxonRank.js";

type Queryable = Pick<Pool | PoolClient, "query">;

export type ConsensusDisputeKind =
  | "alternative_id"
  | "needs_more_evidence"
  | "not_organism"
  | "location_date_issue";

export type ConsensusDisputeStatus = "open" | "resolved" | "withdrawn";

export type ConsensusIdentificationInput = {
  actorUserId?: string | null;
  actorKind?: string | null;
  proposedName: string;
  proposedRank?: string | null;
  acceptedRank?: string | null;
  isCurrent?: boolean | null;
  createdAt?: string | Date | null;
  notes?: string | null;
  sourcePayload?: Record<string, unknown> | null;
  gbifMatch?: GbifMatch | null;
};

export type ConsensusDisputeInput = {
  disputeId?: string | null;
  actorUserId?: string | null;
  kind: ConsensusDisputeKind;
  proposedName?: string | null;
  proposedRank?: string | null;
  reason?: string | null;
  status: ConsensusDisputeStatus;
  createdAt?: string | Date | null;
};

export type ConsensusTaxon = {
  name: string;
  rank: TaxonRank;
  supporterCount: number;
  supportRatio: number;
};

export type IdentificationConsensusResult = {
  occurrenceId: string | null;
  activeIdentificationCount: number;
  independentSupporterCount: number;
  communityTaxon: ConsensusTaxon | null;
  consensusStatus:
    | "no_identification"
    | "single_identification"
    | "community_consensus"
    | "authority_backed"
    | "open_dispute"
    | "gbif_match_failed"
    | "lineage_conflict";
  identificationVerificationStatus:
    | "needs_identification"
    | "needs_review"
    | "needs_media"
    | "blocked_open_dispute"
    | "blocked_taxonomy_match"
    | "blocked_lineage_conflict"
    | "community_consensus"
    | "authority_reviewed";
  hasOpenDispute: boolean;
  hasGbifMatchFailure: boolean;
  hasLineageConflict: boolean;
  hasAuthorityBackedPublicClaim: boolean;
  hasMedia: boolean;
  precisionCeilingRank: TaxonRank;
  canPromoteToTier3: boolean;
  openDisputes: ConsensusDisputeInput[];
  neededEvidence: string[];
};

type TaxonNode = {
  rank: TaxonRank;
  name: string;
  key: string;
};

type ActiveIdentification = ConsensusIdentificationInput & {
  actorKey: string;
  lineage: TaxonNode[];
};

function createdMs(value: string | Date | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function hasAuthorityBackedPayload(payload: Record<string, unknown> | null | undefined): boolean {
  const lane = payloadString(payload, ["lane"]);
  const reviewClass = payloadString(payload, ["reviewClass", "review_class"]);
  return lane === "public-claim" && (reviewClass === "authority_backed" || reviewClass === "admin_override");
}

function isMatchFailure(match: GbifMatch | null | undefined): boolean {
  if (!match) return true;
  if (match.matchType === "NONE") return true;
  if (!match.usageKey && !match.acceptedUsageKey) return true;
  if (!match.canonicalName && !match.species && !match.genus && !match.family) return true;
  return false;
}

function node(rank: TaxonRank, rawName: string | null | undefined): TaxonNode | null {
  const name = String(rawName ?? "").trim();
  if (!name) return null;
  return {
    rank,
    name,
    key: `${rank}:${name.toLowerCase()}`,
  };
}

function lineageFromIdentification(id: ConsensusIdentificationInput): TaxonNode[] {
  const match = id.gbifMatch;
  const nodes: TaxonNode[] = [];
  const seen = new Set<string>();
  const add = (candidate: TaxonNode | null) => {
    if (!candidate || seen.has(candidate.key)) return;
    seen.add(candidate.key);
    nodes.push(candidate);
  };

  if (match) {
    add(node("kingdom", match.kingdom));
    add(node("phylum", match.phylum));
    add(node("class", match.className));
    add(node("order", match.orderName));
    add(node("family", match.family));
    add(node("genus", match.genus));
    add(node("species", match.species));
    const matchRank = normalizeRank(match.rank);
    if (matchRank) {
      add(node(matchRank, match.canonicalName ?? id.proposedName));
    }
  }

  if (nodes.length === 0) {
    const proposedRank = normalizeRank(id.proposedRank);
    if (proposedRank) {
      add(node(proposedRank, id.proposedName));
    }
  }

  return nodes.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
}

function dedupeLatestPerActor(ids: ConsensusIdentificationInput[]): ActiveIdentification[] {
  const current = ids
    .map((id, index) => ({
      ...id,
      actorKey: id.actorUserId?.trim() || `unknown:${index}`,
    }))
    .filter((id) => id.isCurrent !== false)
    .sort((a, b) => createdMs(b.createdAt) - createdMs(a.createdAt));

  const latest = new Map<string, ActiveIdentification>();
  for (const id of current) {
    if (latest.has(id.actorKey)) continue;
    latest.set(id.actorKey, {
      ...id,
      lineage: lineageFromIdentification(id),
    });
  }
  return Array.from(latest.values());
}

function computeCommunityTaxon(active: ActiveIdentification[]): ConsensusTaxon | null {
  const activeCount = active.length;
  if (activeCount === 0) return null;

  const support = new Map<string, { node: TaxonNode; actors: Set<string> }>();
  for (const id of active) {
    for (const taxonNode of id.lineage) {
      const entry = support.get(taxonNode.key) ?? { node: taxonNode, actors: new Set<string>() };
      entry.actors.add(id.actorKey);
      support.set(taxonNode.key, entry);
    }
  }

  const candidates = Array.from(support.values())
    .map((entry) => ({
      node: entry.node,
      supporterCount: entry.actors.size,
      supportRatio: entry.actors.size / activeCount,
    }))
    .filter((entry) => entry.supporterCount >= 2 && entry.supportRatio >= 2 / 3)
    .sort((a, b) => rankOrder(b.node.rank) - rankOrder(a.node.rank));

  const best = candidates[0];
  if (!best) return null;
  return {
    name: best.node.name,
    rank: best.node.rank,
    supporterCount: best.supporterCount,
    supportRatio: best.supportRatio,
  };
}

function isResearchUsableRank(rank: TaxonRank): boolean {
  return rankOrder(rank) >= rankOrder("family");
}

function neededEvidenceFor(result: {
  activeCount: number;
  hasMedia: boolean;
  openDispute: boolean;
  matchFailure: boolean;
  lineageConflict: boolean;
  communityTaxon: ConsensusTaxon | null;
  authorityBacked: boolean;
  communityWithinPolicy: boolean;
}): string[] {
  const needed: string[] = [];
  if (!result.hasMedia) needed.push("写真・音声など観察証拠を追加する");
  if (result.activeCount === 0) needed.push("市民または専門家の同定を少なくとも1件追加する");
  if (result.activeCount === 1) needed.push("独立した2人目の同定、または専門家レビューを追加する");
  if (result.openDispute) needed.push("反対意見を解決する、または追加根拠を集める");
  if (result.matchFailure) needed.push("GBIF backbone で解釈できる学名・分類階級に直す");
  if (result.lineageConflict) needed.push("分類系列の衝突を専門家レビューへ回す");
  if (result.communityTaxon && !result.communityWithinPolicy && !result.authorityBacked) {
    needed.push("この細かさの分類は authority / expert review を通す");
  }
  return needed;
}

export function computeIdentificationConsensus(input: {
  occurrenceId?: string | null;
  identifications: ConsensusIdentificationInput[];
  disputes?: ConsensusDisputeInput[];
  hasMedia?: boolean;
  precisionCeilingRank?: TaxonRank;
}): IdentificationConsensusResult {
  const active = dedupeLatestPerActor(input.identifications);
  const openDisputes = (input.disputes ?? []).filter((dispute) => dispute.status === "open");
  const hasOpenDispute = openDisputes.length > 0;
  const hasMedia = Boolean(input.hasMedia);
  const precisionCeilingRank = input.precisionCeilingRank ?? DEFAULT_COARSE_CEILING;
  const communityTaxon = computeCommunityTaxon(active);
  const hasGbifMatchFailure = active.some((id) => isMatchFailure(id.gbifMatch));
  const hasLineageConflict =
    active.length >= 2
    && (!communityTaxon || !isResearchUsableRank(communityTaxon.rank));
  const hasAuthorityBackedPublicClaim = active.some((id) => hasAuthorityBackedPayload(id.sourcePayload));
  const communityWithinPolicy = Boolean(
    communityTaxon
    && isResearchUsableRank(communityTaxon.rank)
    && isProposalWithinCommunityCeiling(communityTaxon.rank, precisionCeilingRank),
  );

  const canPromoteToTier3 =
    hasMedia
    && !hasOpenDispute
    && !hasGbifMatchFailure
    && !hasLineageConflict
    && (hasAuthorityBackedPublicClaim || communityWithinPolicy);

  const consensusStatus: IdentificationConsensusResult["consensusStatus"] =
    hasOpenDispute
      ? "open_dispute"
      : hasGbifMatchFailure
        ? "gbif_match_failed"
        : hasLineageConflict
          ? "lineage_conflict"
          : hasAuthorityBackedPublicClaim
            ? "authority_backed"
            : communityTaxon
              ? "community_consensus"
              : active.length === 1
                ? "single_identification"
                : "no_identification";

  const identificationVerificationStatus: IdentificationConsensusResult["identificationVerificationStatus"] =
    canPromoteToTier3
      ? hasAuthorityBackedPublicClaim ? "authority_reviewed" : "community_consensus"
      : hasOpenDispute
        ? "blocked_open_dispute"
        : hasGbifMatchFailure
          ? "blocked_taxonomy_match"
          : hasLineageConflict
            ? "blocked_lineage_conflict"
            : !hasMedia
              ? "needs_media"
              : active.length === 0
                ? "needs_identification"
                : "needs_review";

  return {
    occurrenceId: input.occurrenceId ?? null,
    activeIdentificationCount: active.length,
    independentSupporterCount: active.length,
    communityTaxon,
    consensusStatus,
    identificationVerificationStatus,
    hasOpenDispute,
    hasGbifMatchFailure,
    hasLineageConflict,
    hasAuthorityBackedPublicClaim,
    hasMedia,
    precisionCeilingRank,
    canPromoteToTier3,
    openDisputes,
    neededEvidence: neededEvidenceFor({
      activeCount: active.length,
      hasMedia,
      openDispute: hasOpenDispute,
      matchFailure: hasGbifMatchFailure,
      lineageConflict: hasLineageConflict,
      communityTaxon,
      authorityBacked: hasAuthorityBackedPublicClaim,
      communityWithinPolicy,
    }),
  };
}

type IdentificationRow = {
  actor_user_id: string | null;
  actor_kind: string | null;
  proposed_name: string;
  proposed_rank: string | null;
  accepted_rank: string | null;
  is_current: boolean | null;
  notes: string | null;
  source_payload: Record<string, unknown> | null;
  created_at: string;
};

type DisputeRow = {
  dispute_id: string;
  actor_user_id: string | null;
  kind: ConsensusDisputeKind;
  proposed_name: string | null;
  proposed_rank: string | null;
  reason: string | null;
  status: ConsensusDisputeStatus;
  created_at: string;
};

export async function getIdentificationConsensus(
  occurrenceId: string,
  db: Queryable = getPool(),
): Promise<IdentificationConsensusResult> {
  const [occurrenceResult, idResult, disputeResult, mediaResult] = await Promise.all([
    db.query<{
      occurrence_id: string;
      scientific_name: string | null;
      taxon_rank: string | null;
      kingdom: string | null;
      phylum: string | null;
      class_name: string | null;
      order_name: string | null;
      family: string | null;
      genus: string | null;
    }>(
      `select occurrence_id, scientific_name, taxon_rank, kingdom, phylum, class_name, order_name, family, genus
         from occurrences
        where occurrence_id = $1
        limit 1`,
      [occurrenceId],
    ),
    db.query<IdentificationRow>(
      `select actor_user_id,
              actor_kind,
              proposed_name,
              proposed_rank,
              accepted_rank,
              is_current,
              notes,
              source_payload,
              created_at::text
         from identifications
        where occurrence_id = $1
          and coalesce(is_current, true) = true
        order by created_at desc`,
      [occurrenceId],
    ),
    db.query<DisputeRow>(
      `select dispute_id::text,
              actor_user_id,
              kind,
              proposed_name,
              proposed_rank,
              reason,
              status,
              created_at::text
         from identification_disputes
        where occurrence_id = $1
          and status = 'open'
        order by created_at desc`,
      [occurrenceId],
    ),
    db.query<{ has_media: boolean }>(
      `select exists(
          select 1
            from evidence_assets
           where occurrence_id = $1
             and asset_role in ('observation_photo', 'observation_audio', 'observation_video')
       ) as has_media`,
      [occurrenceId],
    ),
  ]);

  const occurrence = occurrenceResult.rows[0];
  if (!occurrence) {
    throw new Error("observation_not_found");
  }

  const uniqueMatches = new Map<string, GbifMatch>();
  const identifications: ConsensusIdentificationInput[] = [];
  for (const row of idResult.rows) {
    const matchKey = `${row.proposed_name}\u0000${row.proposed_rank ?? ""}`;
    let gbifMatch = uniqueMatches.get(matchKey);
    if (!gbifMatch) {
      gbifMatch = await matchTaxon({ name: row.proposed_name, rank: row.proposed_rank });
      uniqueMatches.set(matchKey, gbifMatch);
    }
    identifications.push({
      actorUserId: row.actor_user_id,
      actorKind: row.actor_kind,
      proposedName: row.proposed_name,
      proposedRank: row.proposed_rank,
      acceptedRank: row.accepted_rank,
      isCurrent: row.is_current,
      notes: row.notes,
      sourcePayload: row.source_payload,
      createdAt: row.created_at,
      gbifMatch,
    });
  }

  const ancestry = buildAncestryChain({
    kingdom: occurrence.kingdom,
    phylum: occurrence.phylum,
    className: occurrence.class_name,
    orderName: occurrence.order_name,
    family: occurrence.family,
    genus: occurrence.genus,
    species: occurrence.scientific_name,
  });
  const precisionCeilingRank = ancestry.length > 0
    ? await getCoarseCeilingForAncestry(ancestry)
    : DEFAULT_COARSE_CEILING;

  return computeIdentificationConsensus({
    occurrenceId: occurrence.occurrence_id,
    identifications,
    disputes: disputeResult.rows.map((row) => ({
      disputeId: row.dispute_id,
      actorUserId: row.actor_user_id,
      kind: row.kind,
      proposedName: row.proposed_name,
      proposedRank: row.proposed_rank,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
    })),
    hasMedia: Boolean(mediaResult.rows[0]?.has_media),
    precisionCeilingRank,
  });
}

