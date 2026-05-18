export type LocalTaxonNameMatch = {
  vernacularName: string;
  scientificName: string;
  rank: "species" | "genus" | "family" | "order";
  source: "local_dictionary";
};

const LOCAL_TAXON_DICTIONARY: LocalTaxonNameMatch[] = [
  { vernacularName: "カワラヒワ", scientificName: "Chloris sinica", rank: "species", source: "local_dictionary" },
  { vernacularName: "トウネズミモチ", scientificName: "Ligustrum lucidum", rank: "species", source: "local_dictionary" },
  { vernacularName: "トベラ", scientificName: "Pittosporum tobira", rank: "species", source: "local_dictionary" },
  { vernacularName: "ヒメムカシヨモギ", scientificName: "Erigeron canadensis", rank: "species", source: "local_dictionary" },
  { vernacularName: "イネ科", scientificName: "Poaceae", rank: "family", source: "local_dictionary" },
  { vernacularName: "カラスノエンドウ", scientificName: "Vicia sativa subsp. nigra", rank: "species", source: "local_dictionary" },
];

function normalizeJapaneseTaxonKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/[()（）［］\[\]「」『』]/g, "")
    .trim();
}

const LOCAL_TAXON_BY_JA_NAME = new Map(
  LOCAL_TAXON_DICTIONARY.map((entry) => [normalizeJapaneseTaxonKey(entry.vernacularName), entry]),
);

export function lookupLocalTaxonName(value: string | null | undefined): LocalTaxonNameMatch | null {
  const key = normalizeJapaneseTaxonKey(value);
  if (!key) return null;
  return LOCAL_TAXON_BY_JA_NAME.get(key) ?? null;
}
