import type { Pool } from "pg";
import { getPool } from "../db.js";
import type { TaxonRank } from "./taxonRank.js";
import { normalizeRank, rankOrder } from "./taxonRank.js";

/**
 * Per-taxon coarse ceiling rank for community-support acceptance.
 *
 * The DEFAULT ceiling for any taxon not listed in `taxon_precision_policy`
 * is `genus` (§3.1 of docs/policy/identification_granularity_policy.md).
 *
 * Exceptions are stored in the DB table. When given a taxon ancestry chain
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
  pool: Pool = getPool(),
): Promise<TaxonRank> {
  const clean = ancestry.map(normalizeKey).filter((value) => value.length > 0);
  if (clean.length === 0) return DEFAULT_COARSE_CEILING;

  const result = await pool.query<PolicyRow>(
    `select taxon_key, coarse_ceiling_rank, notes
       from taxon_precision_policy
      where taxon_key = ANY($1::text[])`,
    [clean],
  );
  if (result.rows.length === 0) return DEFAULT_COARSE_CEILING;

  const byKey = new Map<string, TaxonRank>();
  for (const row of result.rows) {
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
  pool: Pool = getPool(),
): Promise<PrecisionPolicyEntry[]> {
  const result = await pool.query<PolicyRow>(
    `select taxon_key, coarse_ceiling_rank, notes
       from taxon_precision_policy
      order by taxon_key`,
  );
  return result.rows.flatMap((row) => {
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
