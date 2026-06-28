import type { TaxonRank } from "./taxonRank.js";
import { normalizeRank, rankOrder } from "./taxonRank.js";

/**
 * Per-taxon coarse ceiling rank for community-support acceptance.
 *
 * The DEFAULT ceiling for any taxon not listed in `taxon_precision_policy`
 * is `genus` (§3.1 of docs/policy/identification_granularity_policy.md).
 *
 * Exceptions are stored as a static runtime policy. When given a taxon ancestry chain
 * (e.g. kingdom → phylum → class → order → family → genus), this module
 * finds the most specific (finest) matching override and returns it.
 */

export const DEFAULT_COARSE_CEILING: TaxonRank = "genus";

export type PrecisionPolicyEntry = {
  taxonKey: string;
  coarseCeilingRank: TaxonRank;
  notes: string | null;
};

type PolicyRow = {
  taxon_key: string;
  coarse_ceiling_rank: string;
  notes: string | null;
};

const STATIC_POLICY_ROWS: readonly PolicyRow[] = [
  {
    taxon_key: "Aves",
    coarse_ceiling_rank: "species",
    notes: "国内鳥類は図鑑定着度が高く市民 species 識別が比較的安定。公開用途への昇格は authority 確認が必要。",
  },
  {
    taxon_key: "Mammalia",
    coarse_ceiling_rank: "species",
    notes: "国内哺乳類は種数が限定的、形態識別が比較的安定。",
  },
  {
    taxon_key: "Amphibia",
    coarse_ceiling_rank: "species",
    notes: "国内両生類は種数が限定的。",
  },
  {
    taxon_key: "Reptilia",
    coarse_ceiling_rank: "species",
    notes: "国内爬虫類は種数が限定的。",
  },
  {
    taxon_key: "Lepidoptera",
    coarse_ceiling_rank: "genus",
    notes: "チョウ目は科〜属で迷う群が多い。種は authority 経由を原則とする。",
  },
  {
    taxon_key: "Coleoptera",
    coarse_ceiling_rank: "subfamily",
    notes: "コウチュウ目は亜科止めが健全な群が多い。",
  },
  {
    taxon_key: "Hymenoptera",
    coarse_ceiling_rank: "subfamily",
    notes: "ハチ目（ハナバチ類含む）は亜科止めを原則とする。",
  },
  {
    taxon_key: "Diptera",
    coarse_ceiling_rank: "subfamily",
    notes: "ハエ目は亜科止めを原則とする。",
  },
  {
    taxon_key: "Fungi",
    coarse_ceiling_rank: "family",
    notes: "顕微鏡観察・培養なしでは属以下が危うい。",
  },
];

function normalizeKey(raw: string | null | undefined): string {
  return String(raw ?? "").trim();
}

export function buildAncestryChain(match: {
  kingdom?: string | null;
  phylum?: string | null;
  className?: string | null;
  orderName?: string | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
}): string[] {
  const keys = [
    match.kingdom,
    match.phylum,
    match.className,
    match.orderName,
    match.family,
    match.genus,
    match.species,
  ]
    .map(normalizeKey)
    .filter((value) => value.length > 0);
  return keys;
}

export async function getCoarseCeilingForAncestry(
  ancestry: string[],
): Promise<TaxonRank> {
  const clean = ancestry.map(normalizeKey).filter((value) => value.length > 0);
  if (clean.length === 0) return DEFAULT_COARSE_CEILING;

  const byKey = new Map<string, TaxonRank>();
  for (const row of STATIC_POLICY_ROWS) {
    if (!clean.includes(row.taxon_key)) continue;
    const rank = normalizeRank(row.coarse_ceiling_rank);
    if (rank) byKey.set(row.taxon_key, rank);
  }

  // Walk the ancestry from finest (species) back to coarsest (kingdom) so
  // that the most specific matching exception wins.
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    const key = clean[i];
    if (!key) continue;
    const hit = byKey.get(key);
    if (hit) return hit;
  }
  return DEFAULT_COARSE_CEILING;
}

export async function listPrecisionPolicyEntries(
): Promise<PrecisionPolicyEntry[]> {
  return [...STATIC_POLICY_ROWS].sort((a, b) => a.taxon_key.localeCompare(b.taxon_key)).flatMap((row) => {
    const rank = normalizeRank(row.coarse_ceiling_rank);
    if (!rank) return [];
    return [{ taxonKey: row.taxon_key, coarseCeilingRank: rank, notes: row.notes }];
  });
}

/**
 * True if the proposed rank is at or coarser than the ceiling —
 * i.e. community support alone may officially accept this observation
 * at the proposed rank. If the proposal is finer than the ceiling
 * (e.g. species proposal under a genus ceiling), authority-backed
 * review is required to officially accept.
 */
export function isProposalWithinCommunityCeiling(
  proposedRank: TaxonRank,
  ceilingRank: TaxonRank,
): boolean {
  return rankOrder(proposedRank) <= rankOrder(ceilingRank);
}
