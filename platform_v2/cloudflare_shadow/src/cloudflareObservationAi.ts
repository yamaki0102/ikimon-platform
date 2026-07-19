export const OBSERVATION_VISION_MODEL = "@cf/moondream/moondream3.1-9B-A2B";

export type ObservationAiCandidate = {
  vernacularName: string | null;
  scientificName: string | null;
  rank: "species" | "genus" | "family" | "order" | "class" | "unknown";
  confidence: number;
  visualEvidence: string[];
  needsMoreEvidence: string[];
  nonBiological: boolean;
};

const allowedRanks = new Set<ObservationAiCandidate["rank"]>([
  "species",
  "genus",
  "family",
  "order",
  "class",
  "unknown",
]);

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
};

const cleanList = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values.map((item) => cleanText(item, 160)).filter((item): item is string => Boolean(item)).slice(0, 4);
};

export function observationAiQuestion(): string {
  return [
    "What is the main organism in this citizen-science image? Give the most likely common and scientific name, but stay at genus or family when the visible evidence is insufficient for a species identification.",
    "List the visible traits supporting the candidate and what additional photo would help. This is a candidate for human review, not a confirmed identification. Consider cultivated plants.",
    "Return JSON only, using exactly these keys: vernacularName, scientificName, rank, confidence, visualEvidence, needsMoreEvidence, nonBiological.",
    "Use a Japanese common name for vernacularName when known. rank is one of species, genus, family, order, class, unknown. confidence is 0 to 1. visualEvidence and needsMoreEvidence are arrays. nonBiological is true only when no organism is visible.",
  ].join("\n");
}

export function parseObservationAiCandidate(answer: unknown): ObservationAiCandidate {
  if (typeof answer !== "string") throw new Error("ai_answer_missing");
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ai_answer_not_json");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("ai_answer_invalid_json");
  }

  const rawRank = cleanText(parsed.rank, 24)?.toLowerCase() as ObservationAiCandidate["rank"] | undefined;
  const confidence = Number(parsed.confidence);
  const vernacularName = cleanText(parsed.vernacularName, 120);
  const scientificName = cleanText(parsed.scientificName, 180);
  const candidate: ObservationAiCandidate = {
    vernacularName,
    scientificName,
    rank: rawRank && allowedRanks.has(rawRank) ? rawRank : "unknown",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    visualEvidence: cleanList(parsed.visualEvidence),
    needsMoreEvidence: cleanList(parsed.needsMoreEvidence),
    nonBiological: parsed.nonBiological === true && !vernacularName && !scientificName,
  };
  if (!candidate.nonBiological && !candidate.vernacularName && !candidate.scientificName) {
    throw new Error("ai_candidate_name_missing");
  }
  return candidate;
}
