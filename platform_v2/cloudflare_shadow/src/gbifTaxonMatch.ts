import { chunkOf, marks, randomUuid, sha256Text, type GbifDb } from "./gbifDb.js";

export const GBIF_CHECKLIST_KEY = "gbif-backbone";

export type RawGbifMatch = {
  usageKey?: number | string | null;
  acceptedUsageKey?: number | string | null;
  canonicalName?: string | null;
  scientificName?: string | null;
  rank?: string | null;
  status?: string | null;
  synonym?: boolean | null;
  matchType?: string | null;
  kingdom?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
};

export interface TaxonMatcher {
  match(input: { name: string; rank: string | null }): Promise<RawGbifMatch | null>;
}

export type TaxonLineage = { kingdom?: string; phylum?: string; class?: string; order?: string; family?: string; genus?: string; species?: string };
export type AcceptedTaxonMatch = {
  usageKey: string | null;
  name: string;
  rank: string;
  lineage: TaxonLineage;
};
export type TaxonMatchDecision =
  | { decision: "accepted"; holdReason: null; taxon: AcceptedTaxonMatch }
  | { decision: "hold"; holdReason: string; taxon: null };

export const nameKeyOf = (value: string | null | undefined): string =>
  (value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

export const rankKeyOf = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase().replace(/[\s-]+/gu, "_");

const clean = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export function decideTaxonMatch(submittedRank: string | null, raw: RawGbifMatch | null): TaxonMatchDecision {
  const hold = (reason: string): TaxonMatchDecision => ({ decision: "hold", holdReason: reason, taxon: null });
  if (!raw) return hold("no_response");
  const matchType = String(raw.matchType ?? "NONE").toUpperCase();
  if (matchType !== "EXACT") return hold(matchType === "NONE" ? "no_match" : `match_${matchType.toLowerCase()}`);
  if (raw.synonym === true || (raw.status && String(raw.status).toUpperCase() !== "ACCEPTED")) return hold("synonym_needs_review");
  const rank = rankKeyOf(raw.rank);
  const name = clean(raw.canonicalName);
  if (!rank || !name) return hold("rank_or_name_missing");
  const wanted = rankKeyOf(submittedRank);
  if (wanted && wanted !== rank) return hold("rank_differs_from_submitted");
  const lineage: TaxonLineage = {};
  for (const key of ["kingdom", "phylum", "class", "order", "family", "genus", "species"] as const) {
    const value = clean(raw[key]);
    if (value) lineage[key] = value;
  }
  if (!lineage.kingdom) return hold("lineage_missing");
  return { decision: "accepted", holdReason: null, taxon: { usageKey: raw.usageKey == null ? null : String(raw.usageKey), name, rank, lineage } };
}

type StoredMatchRow = {
  name_key: string; submitted_rank: string; match_version: number; usage_key: string | null; accepted_name: string | null; accepted_rank: string | null;
  kingdom: string | null; phylum: string | null; class_name: string | null; order_name: string | null; family: string | null; genus: string | null; species: string | null;
  decision: string; hold_reason: string | null;
};

export const matchLookupKey = (name: string | null | undefined, rank: string | null | undefined) => `${nameKeyOf(name)}\u0000${rankKeyOf(rank)}`;

export async function loadLatestMatches(db: GbifDb, pairs: Array<{ name: string; rank: string | null }>): Promise<Map<string, { decision: "accepted" | "hold"; taxon: AcceptedTaxonMatch | null; version: number }>> {
  const out = new Map<string, { decision: "accepted" | "hold"; taxon: AcceptedTaxonMatch | null; version: number }>();
  const names = [...new Set(pairs.map((pair) => nameKeyOf(pair.name)).filter(Boolean))];
  for (const part of chunkOf(names, 80)) {
    const rows = (await db.query(
      `SELECT m.name_key, m.submitted_rank, m.match_version, m.usage_key, m.accepted_name, m.accepted_rank, m.kingdom, m.phylum, m.class_name,
              m.order_name, m.family, m.genus, m.species, m.decision, m.hold_reason
         FROM gbif_taxon_matches m
        WHERE m.checklist_key = ? AND m.name_key IN (${marks(part.length)})
          AND m.match_version = (SELECT MAX(x.match_version) FROM gbif_taxon_matches x
                                  WHERE x.name_key = m.name_key AND x.submitted_rank = m.submitted_rank AND x.checklist_key = m.checklist_key)`,
      [GBIF_CHECKLIST_KEY, ...part],
    )) as unknown as StoredMatchRow[];
    for (const row of rows) {
      const lineage: TaxonLineage = {};
      const set = (key: keyof TaxonLineage, value: string | null) => { if (value) lineage[key] = value; };
      set("kingdom", row.kingdom); set("phylum", row.phylum); set("class", row.class_name); set("order", row.order_name);
      set("family", row.family); set("genus", row.genus); set("species", row.species);
      out.set(`${row.name_key}\u0000${row.submitted_rank}`, {
        decision: row.decision === "accepted" ? "accepted" : "hold",
        version: Number(row.match_version),
        taxon: row.decision === "accepted" && row.accepted_name && row.accepted_rank ? { usageKey: row.usage_key, name: row.accepted_name, rank: row.accepted_rank, lineage } : null,
      });
    }
  }
  return out;
}

export async function storeTaxonMatch(db: GbifDb, input: { name: string; rank: string | null; raw: RawGbifMatch | null; matchedAtIso?: string }): Promise<{ stored: boolean; version: number; decision: TaxonMatchDecision }> {
  const nameKey = nameKeyOf(input.name);
  const rankKey = rankKeyOf(input.rank);
  if (!nameKey) throw new Error("taxon_name_required");
  const decision = decideTaxonMatch(input.rank, input.raw);
  const digest = await sha256Text(JSON.stringify({ decision: decision.decision, holdReason: decision.holdReason, taxon: decision.taxon, raw: input.raw }));
  const latest = (await db.query(
    "SELECT match_version, response_digest FROM gbif_taxon_matches WHERE name_key = ? AND submitted_rank = ? AND checklist_key = ? ORDER BY match_version DESC LIMIT 1",
    [nameKey, rankKey, GBIF_CHECKLIST_KEY],
  ))[0];
  if (latest && String(latest.response_digest) === digest) return { stored: false, version: Number(latest.match_version), decision };
  const version = latest ? Number(latest.match_version) + 1 : 1;
  const taxon = decision.taxon;
  await db.run(
    `INSERT INTO gbif_taxon_matches (match_id, name_key, submitted_name, submitted_rank, checklist_key, match_version, usage_key, accepted_key, accepted_name, accepted_rank,
       kingdom, phylum, class_name, order_name, family, genus, species, match_type, decision, hold_reason, response_digest, matched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUuid(), nameKey, input.name.slice(0, 200), rankKey, GBIF_CHECKLIST_KEY, version, taxon?.usageKey ?? null,
      input.raw?.acceptedUsageKey == null ? null : String(input.raw.acceptedUsageKey), taxon?.name ?? null, taxon?.rank ?? null,
      taxon?.lineage.kingdom ?? null, taxon?.lineage.phylum ?? null, taxon?.lineage.class ?? null, taxon?.lineage.order ?? null,
      taxon?.lineage.family ?? null, taxon?.lineage.genus ?? null, taxon?.lineage.species ?? null,
      String(input.raw?.matchType ?? "NONE").toUpperCase(), decision.decision, decision.holdReason, digest, input.matchedAtIso ?? new Date().toISOString(),
    ],
  );
  return { stored: true, version, decision };
}

export async function refreshTaxonMatches(db: GbifDb, matcher: TaxonMatcher, pairs: Array<{ name: string; rank: string | null }>, options: { maxLookups?: number; matchedAtIso?: string } = {}): Promise<{ looked: number; stored: number; skipped: number }> {
  const unique = new Map<string, { name: string; rank: string | null }>();
  for (const pair of pairs) if (nameKeyOf(pair.name)) unique.set(matchLookupKey(pair.name, pair.rank), pair);
  const max = options.maxLookups ?? 50;
  let looked = 0;
  let stored = 0;
  let skipped = 0;
  for (const pair of unique.values()) {
    if (looked >= max) { skipped += 1; continue; }
    looked += 1;
    const raw = await matcher.match({ name: pair.name, rank: pair.rank }).catch(() => null);
    if (raw === null) { skipped += 1; continue; }
    const result = await storeTaxonMatch(db, { name: pair.name, rank: pair.rank, raw, matchedAtIso: options.matchedAtIso });
    if (result.stored) stored += 1;
  }
  return { looked, stored, skipped };
}

export function createGbifHttpMatcher(fetchImpl: typeof fetch = fetch): TaxonMatcher {
  return {
    async match({ name, rank }) {
      const url = new URL("https://api.gbif.org/v1/species/match");
      url.searchParams.set("name", name);
      url.searchParams.set("strict", "true");
      if (rank) url.searchParams.set("rank", rank.toUpperCase().replace(/[\s-]+/gu, "_"));
      const response = await fetchImpl(url.toString(), { method: "GET", headers: { accept: "application/json" } });
      if (!response.ok) return null;
      return (await response.json()) as RawGbifMatch;
    },
  };
}
