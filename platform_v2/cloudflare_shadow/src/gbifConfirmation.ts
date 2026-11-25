import { buildAncestryChain, getCoarseCeilingForAncestry, isProposalWithinCommunityCeiling } from "../../src/services/taxonPrecisionPolicy";
import { rankOrder, type TaxonRank } from "../../src/services/taxonRank";
import { matchLookupKey, nameKeyOf, rankKeyOf, type AcceptedTaxonMatch, type TaxonLineage } from "./gbifTaxonMatch.js";

export type ClaimActorKind = "owner" | "community_member" | "curator" | "import";
export type ConfirmationClaim = {
  claimId: string;
  actorId: string | null;
  actorKind: ClaimActorKind;
  claimStatus: string;
  stance: string;
  proposedName: string;
  proposedScientificName: string | null;
  proposedRank: string | null;
  acceptedName: string | null;
  acceptedRank: string | null;
  authorityBacked: boolean;
  updatedAt: string;
};
export type MatchByKey = (name: string, rank: string | null) => AcceptedTaxonMatch | null;

export type ConfirmedTaxon = {
  name: string;
  rank: string;
  usageKey: string | null;
  lineage: TaxonLineage;
  basis: "community_consensus" | "expert_verified";
  supporterCount: number;
  voterCount: number;
  vernacularHint: string | null;
};
export type ConfirmationResult =
  | { confirmed: true; taxon: ConfirmedTaxon }
  | { confirmed: false; reason: "no_human_claim" | "single_voter" | "objection" | "taxon_unmatched" | "no_consensus" | "rank_too_coarse" | "expert_conflict" };

const HUMAN_KINDS = new Set<ClaimActorKind>(["owner", "community_member", "curator"]);
const OBJECTION_STANCES = new Set(["not_organism", "needs_more_evidence"]);
const RANKS: ReadonlyArray<keyof TaxonLineage> = ["kingdom", "phylum", "class", "order", "family", "genus", "species"];
const RANK_FOR_ORDER: Record<string, TaxonRank> = { kingdom: "kingdom", phylum: "phylum", class: "class", order: "order", family: "family", genus: "genus", species: "species" };

type Node = { key: string; rank: keyof TaxonLineage | string; name: string; isOwn: boolean };

function nodesOf(taxon: AcceptedTaxonMatch): Node[] {
  const out: Node[] = [];
  const seen = new Set<string>();
  const add = (rank: string, name: string | undefined, isOwn: boolean) => {
    if (!name) return;
    const key = `${rank}:${nameKeyOf(name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, rank, name, isOwn });
  };
  for (const rank of RANKS) add(rank, taxon.lineage[rank], taxon.rank === rank && nameKeyOf(taxon.lineage[rank]) === nameKeyOf(taxon.name));
  add(taxon.rank, taxon.name, true);
  return out;
}

const nameOfClaim = (claim: ConfirmationClaim): { name: string; rank: string | null } => ({
  name: claim.acceptedName ?? claim.proposedScientificName ?? claim.proposedName,
  rank: claim.acceptedRank ?? claim.proposedRank,
});

export function latestClaimPerActor(claims: ConfirmationClaim[]): ConfirmationClaim[] {
  const current = claims
    .filter((claim) => (claim.claimStatus === "candidate" || claim.claimStatus === "accepted") && HUMAN_KINDS.has(claim.actorKind) && claim.actorId)
    .sort((a, b) => (b.updatedAt === a.updatedAt ? b.claimId.localeCompare(a.claimId) : b.updatedAt.localeCompare(a.updatedAt)));
  const latest = new Map<string, ConfirmationClaim>();
  for (const claim of current) if (!latest.has(claim.actorId!)) latest.set(claim.actorId!, claim);
  return [...latest.values()];
}

export async function evaluateHumanConfirmation(input: {
  claims: ConfirmationClaim[];
  openDisputeCount: number;
  recordDisputed: boolean;
  matchOf: MatchByKey;
}): Promise<ConfirmationResult> {
  const voters = latestClaimPerActor(input.claims);
  if (voters.length === 0) return { confirmed: false, reason: "no_human_claim" };
  if (input.openDisputeCount > 0 || input.recordDisputed || voters.some((claim) => OBJECTION_STANCES.has(claim.stance))) return { confirmed: false, reason: "objection" };

  const matched = voters.map((claim) => {
    const target = nameOfClaim(claim);
    return { claim, taxon: input.matchOf(target.name, target.rank) };
  });

  const experts = matched.filter((entry) => entry.claim.actorKind === "curator" || entry.claim.authorityBacked);
  if (experts.length > 0) {
    const resolved = experts.filter((entry) => entry.taxon);
    if (resolved.length === 0) return { confirmed: false, reason: "taxon_unmatched" };
    const names = new Set(resolved.map((entry) => `${entry.taxon!.rank}:${nameKeyOf(entry.taxon!.name)}`));
    if (names.size > 1 || resolved.length < experts.length) return { confirmed: false, reason: "expert_conflict" };
    const taxon = resolved[0]!.taxon!;
    return { confirmed: true, taxon: { ...taxon, basis: "expert_verified", supporterCount: experts.length, voterCount: voters.length, vernacularHint: vernacularOf(resolved[0]!.claim, taxon) } };
  }

  if (voters.length < 2) return { confirmed: false, reason: "single_voter" };
  if (!matched.some((entry) => entry.taxon)) return { confirmed: false, reason: "taxon_unmatched" };

  const support = new Map<string, { node: Node; actors: Set<string>; source: AcceptedTaxonMatch; claim: ConfirmationClaim }>();
  for (const entry of matched) {
    if (!entry.taxon) continue;
    for (const node of nodesOf(entry.taxon)) {
      const slot = support.get(node.key) ?? { node, actors: new Set<string>(), source: entry.taxon, claim: entry.claim };
      slot.actors.add(entry.claim.actorId!);
      support.set(node.key, slot);
    }
  }
  const candidates = [...support.values()]
    .filter((slot) => slot.actors.size >= 2 && slot.actors.size / voters.length >= 2 / 3)
    .sort((a, b) => rankOrder(RANK_FOR_ORDER[b.node.rank] ?? "species") - rankOrder(RANK_FOR_ORDER[a.node.rank] ?? "species"));
  if (candidates.length === 0) return { confirmed: false, reason: "no_consensus" };

  let sawTooCoarse = false;
  for (const slot of candidates) {
    const rank = RANK_FOR_ORDER[slot.node.rank];
    if (!rank) continue;
    if (rankOrder(rank) < rankOrder("family")) { sawTooCoarse = true; continue; }
    const ancestry = buildAncestryChain({
      kingdom: slot.source.lineage.kingdom, phylum: slot.source.lineage.phylum, className: slot.source.lineage.class,
      orderName: slot.source.lineage.order, family: slot.source.lineage.family, genus: slot.source.lineage.genus, species: slot.source.lineage.species,
    });
    const ceiling = await getCoarseCeilingForAncestry(ancestry);
    if (!isProposalWithinCommunityCeiling(rank, ceiling)) continue;
    const lineage: TaxonLineage = {};
    for (const key of RANKS) {
      lineage[key] = slot.source.lineage[key];
      if (key === slot.node.rank) break;
    }
    const own = nameKeyOf(slot.source.name) === nameKeyOf(slot.node.name) && rankKeyOf(slot.source.rank) === rankKeyOf(slot.node.rank);
    return {
      confirmed: true,
      taxon: {
        name: slot.node.name, rank: String(slot.node.rank), usageKey: own ? slot.source.usageKey : null,
        lineage: Object.fromEntries(Object.entries(lineage).filter(([, value]) => value)) as TaxonLineage,
        basis: "community_consensus", supporterCount: slot.actors.size, voterCount: voters.length,
        vernacularHint: own ? vernacularOf(slot.claim, slot.source) : null,
      },
    };
  }
  return { confirmed: false, reason: sawTooCoarse && candidates.every((slot) => rankOrder(RANK_FOR_ORDER[slot.node.rank] ?? "species") < rankOrder("family")) ? "rank_too_coarse" : "no_consensus" };
}

function vernacularOf(claim: ConfirmationClaim, taxon: AcceptedTaxonMatch): string | null {
  const candidate = (claim.proposedName ?? "").trim();
  if (!candidate || nameKeyOf(candidate) === nameKeyOf(taxon.name) || !/[぀-ヿ一-鿿]/u.test(candidate) || candidate.length > 40) return null;
  return candidate;
}

export { matchLookupKey };
