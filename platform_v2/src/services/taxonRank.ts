/**
 * Taxonomic rank ordering and comparison.
 *
 * Lower `order` value = coarser rank (kingdom).
 * Higher `order` value = finer rank (subspecies).
 *
 * Unknown ranks are normalized to `species` (finest near-equivalent) so that
 * an authority cannot silently approve something whose rank we can't interpret.
 *
 * See docs/policy/identification_granularity_policy.md §2 for the canonical
 * definition. This module must stay in sync with that document.
 */

export type TaxonRank =
  | "kingdom"
  | "phylum"
  | "class"
  | "order"
  | "family"
  | "subfamily"
  | "tribe"
  | "genus"
  | "subgenus"
  | "species_group"
  | "species"
  | "subspecies";

const RANK_ORDER: Record<TaxonRank, number> = {
  kingdom: 10,
  phylum: 20,
  class: 30,
  order: 40,
  family: 50,
  subfamily: 55,
  tribe: 60,
  genus: 70,
  subgenus: 75,
  species_group: 80,
  species: 90,
  subspecies: 95,
};

const RANK_ALIASES: Record<string, TaxonRank> = {
  "sp.": "species",
  "ssp.": "subspecies",
  "subsp.": "subspecies",
  "species_complex": "species_group",
  "species-group": "species_group",
  "sectio": "species_group",
  "section": "species_group",
};

function cleanRankString(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function normalizeRank(raw: string | null | undefined): TaxonRank | null {
  const cleaned = cleanRankString(raw);
  if (!cleaned) return null;
  if (cleaned in RANK_ORDER) return cleaned as TaxonRank;
  const alias = RANK_ALIASES[cleaned];
  return alias ?? null;
}

export function rankOrder(rank: TaxonRank): number {
  return RANK_ORDER[rank];
}

export function rankFromUnknown(raw: string | null | undefined): TaxonRank {
  return normalizeRank(raw) ?? "species";
}

/**
 * Returns true when `proposed` is the same rank as `scope`, or finer (deeper
 * in the hierarchy). This is the condition under which an authority whose
 * scope is `scope` may approve an identification proposed at `proposed`.
 *
 * Examples:
 *   isRankAtOrFinerThan("species", "genus")    === true  (species finer than genus)
 *   isRankAtOrFinerThan("genus", "genus")      === true
 *   isRankAtOrFinerThan("family", "genus")     === false (family coarser than genus)
 */
export function isRankAtOrFinerThan(proposed: TaxonRank, scope: TaxonRank): boolean {
  return rankOrder(proposed) >= rankOrder(scope);
}
