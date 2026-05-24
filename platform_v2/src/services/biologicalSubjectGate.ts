import { normalizeTaxonDisplayLabel } from "./localizedDisplay.js";

export type BiologicalSubjectCandidateInput = {
  vernacularName?: string | null;
  scientificName?: string | null;
};

export type BiologicalSubjectCandidate = {
  vernacularName: string | null;
  scientificName: string | null;
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeBiologicalSubjectCandidate(
  input: BiologicalSubjectCandidateInput,
): BiologicalSubjectCandidate | null {
  const vernacularName = normalizeTaxonDisplayLabel(input.vernacularName);
  const scientificName = normalizeTaxonDisplayLabel(cleanText(input.scientificName));
  if (!vernacularName && !scientificName) return null;
  return {
    vernacularName,
    scientificName,
  };
}

