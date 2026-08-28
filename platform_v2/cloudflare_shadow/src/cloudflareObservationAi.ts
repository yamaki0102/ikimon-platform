export const OBSERVATION_VISION_MODEL = "gemini-3.5-flash-lite";
export const OBSERVATION_AI_PROMPT_VERSION = "observation-candidate-tuned-minimal/v1";
export const OBSERVATION_AI_RULE_VERSION = "record-observation-gemini-batch/v3";
export const OBSERVATION_AI_SPECIES_HIGH_MIN_CONFIDENCE = 0.8;

export type ObservationAiSubjectLocator = {
  rect?: { x: number; y: number; width: number; height: number };
};

export type ObservationAiSubjectCandidate = {
  candidateKey: string | null;
  vernacularName: string | null;
  scientificName: string | null;
  rank: "species" | "genus" | "family" | "order" | "class" | "lifeform" | "unknown";
  confidence: number;
  visualEvidence: string[];
  needsMoreEvidence: string[];
  assetIndex?: number;
  sourceModel?: string;
  subjectLocator: ObservationAiSubjectLocator;
};

export type ObservationAiCandidate = ObservationAiSubjectCandidate & {
  nonBiological: boolean;
  coexistingSubjects: ObservationAiSubjectCandidate[];
};

const allowedRanks = new Set<ObservationAiCandidate["rank"]>([
  "species",
  "genus",
  "family",
  "order",
  "class",
  "lifeform",
  "unknown",
]);

const speciesSpecificEvidenceMarker = /(?:species-specific\s+decisive\s+evidence|species-specific|種固有の決定形質|種の決定形質)/iu;
const speciesEvidenceUncertaintyMarker = /(?:not\s+(?:clear|visible|enough|supported)|insufficient|unclear|不明|不足|確認できない|確認不能|足りない)/iu;
const speciesDowngradeEvidence = "種固有の決定形質が画像で明確に確認できる追加証拠";

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
};

const cleanList = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values.map((item) => cleanText(item, 160)).filter((item): item is string => Boolean(item)).slice(0, 4);
};

const boundedUnit = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
};

const cleanSubjectLocator = (value: unknown): ObservationAiSubjectLocator => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const locator = value as Record<string, unknown>;
  const rawRect = locator.rect;
  if (!rawRect || typeof rawRect !== "object" || Array.isArray(rawRect)) return {};
  const rect = rawRect as Record<string, unknown>;
  const x = boundedUnit(rect.x);
  const y = boundedUnit(rect.y);
  const width = boundedUnit(rect.width);
  const height = boundedUnit(rect.height);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) return {};
  if (x + width > 1.001 || y + height > 1.001) return {};
  return { rect: { x, y, width, height } };
};

const cleanSubjectCandidate = (value: unknown): ObservationAiSubjectCandidate | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  const vernacularName = cleanText(parsed.vernacularName ?? parsed.vernacular_name, 120);
  const scientificName = cleanText(parsed.scientificName ?? parsed.scientific_name, 180);
  if (!vernacularName && !scientificName) return null;
  const rawRank = cleanText(parsed.rank, 24)?.toLowerCase() as ObservationAiCandidate["rank"] | undefined;
  const confidence = Number(parsed.confidence);
  return {
    candidateKey: cleanText(parsed.candidateKey ?? parsed.candidate_key, 80),
    vernacularName,
    scientificName,
    rank: rawRank && allowedRanks.has(rawRank) ? rawRank : "unknown",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    visualEvidence: cleanList(parsed.visualEvidence ?? parsed.visual_evidence),
    needsMoreEvidence: cleanList(parsed.needsMoreEvidence ?? parsed.needs_more_evidence),
    assetIndex: Number.isInteger(Number(parsed.assetIndex ?? parsed.asset_index)) ? Math.max(0, Number(parsed.assetIndex ?? parsed.asset_index)) : 0,
    sourceModel: cleanText(parsed.sourceModel ?? parsed.source_model, 120) ?? undefined,
    subjectLocator: cleanSubjectLocator(parsed.subjectLocator ?? parsed.subject_locator),
  };
};

const genusFromScientificName = (value: string | null): string | null => {
  if (!value) return null;
  const [genus, species] = value.trim().split(/\s+/u);
  return genus && species && /^[A-Z][A-Za-z-]{2,}$/u.test(genus) ? genus : null;
};

export function observationAiSpeciesHighSafe(candidate: ObservationAiSubjectCandidate): boolean {
  return candidate.rank === "species"
    && candidate.confidence >= OBSERVATION_AI_SPECIES_HIGH_MIN_CONFIDENCE
    && candidate.needsMoreEvidence.length === 0
    && candidate.visualEvidence.some((item) => speciesSpecificEvidenceMarker.test(item))
    && !candidate.visualEvidence.some((item) => speciesEvidenceUncertaintyMarker.test(item));
}

const applySubjectSafetyGate = (candidate: ObservationAiSubjectCandidate): ObservationAiSubjectCandidate => {
  if (candidate.rank !== "species" || observationAiSpeciesHighSafe(candidate)) return candidate;
  const genus = genusFromScientificName(candidate.scientificName);
  return {
    ...candidate,
    vernacularName: candidate.vernacularName,
    scientificName: genus ?? candidate.scientificName,
    rank: genus ? "genus" : "unknown",
    confidence: Math.min(candidate.confidence, OBSERVATION_AI_SPECIES_HIGH_MIN_CONFIDENCE - 0.01),
    needsMoreEvidence: [...new Set([...candidate.needsMoreEvidence, speciesDowngradeEvidence])].slice(0, 4),
  };
};

export function applyObservationAiCandidateSafetyGate(candidate: ObservationAiCandidate): ObservationAiCandidate {
  return {
    ...applySubjectSafetyGate(candidate),
    coexistingSubjects: candidate.coexistingSubjects.map(applySubjectSafetyGate),
  };
}

const fallbackSubjectKey = (candidate: ObservationAiSubjectCandidate): string => {
  const name = (candidate.scientificName ?? candidate.vernacularName ?? "unknown")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/gu, "-")
    .slice(0, 80);
  const rect = candidate.subjectLocator.rect;
  const locator = rect ? `${rect.x.toFixed(4)}:${rect.y.toFixed(4)}:${rect.width.toFixed(4)}:${rect.height.toFixed(4)}` : "full";
  return `subject:${name}:${locator}`;
};

export function observationAiSubjects(candidate: ObservationAiCandidate): Array<{
  subjectKey: string;
  candidate: ObservationAiSubjectCandidate;
  primary: boolean;
}> {
  const source: Array<{ subjectKey: string; candidate: ObservationAiSubjectCandidate; primary: boolean }> = [];
  if (!candidate.nonBiological && (candidate.vernacularName || candidate.scientificName)) {
    source.push({ subjectKey: "primary", candidate, primary: true });
  }
  for (const child of candidate.coexistingSubjects) {
    source.push({ subjectKey: child.candidateKey ?? fallbackSubjectKey(child), candidate: child, primary: false });
  }
  const occurrences = new Map<string, number>();
  return source.map((subject) => {
    const count = (occurrences.get(subject.subjectKey) ?? 0) + 1;
    occurrences.set(subject.subjectKey, count);
    return count === 1 ? subject : { ...subject, subjectKey: `${subject.subjectKey}#${count}` };
  });
}

export const OBSERVATION_AI_CANDIDATE_SAFETY_INSTRUCTION = [
  "AI output is a candidate for human review, not a confirmed identification.",
  "Never auto-promote it to a confirmed identification and never change accepted identification, consensus, or verification status using AI alone.",
  "Allow species + high only when image-visible species-specific decisive evidence is clear and no decisive missing evidence remains; otherwise conservatively downgrade to genus, family, order, class, lifeform, or unknown.",
  "Do not use taxon-specific hardcoded rules.",
].join(" ");

export function observationAiQuestion(): string {
  return [
    "Use all photos in this citizen-science post to identify the main visible organism conservatively. Give a common and scientific name only at the rank supported by visible evidence; stay at genus or family when species evidence is insufficient.",
    "List concise visible traits supporting the candidate and the decisive missing evidence that an additional photo could resolve. Consider cultivated plants.",
    "Detect each separate organism or plant that is visibly supported. Keep alternative names for the same subject out of coexistingSubjects.",
    OBSERVATION_AI_CANDIDATE_SAFETY_INSTRUCTION,
    "When species + high is allowed, visualEvidence must include the phrase 'species-specific decisive evidence:' followed by the visible diagnostic trait. If that evidence is not clear, do not use species + high.",
    "Return JSON only, using exactly these keys: vernacularName, scientificName, rank, confidence, visualEvidence, needsMoreEvidence, nonBiological, subjectLocator, coexistingSubjects.",
    "Use a Japanese common name for vernacularName when known. rank is one of species, genus, family, order, class, lifeform, unknown. confidence is 0 to 1. visualEvidence and needsMoreEvidence are arrays. nonBiological is true only when no organism is visible.",
    "subjectLocator is {rect:{x,y,width,height}} with normalized 0 to 1 coordinates. coexistingSubjects is an array of at most 6 separate visible subjects using candidateKey, vernacularName, scientificName, rank, confidence, visualEvidence, needsMoreEvidence, subjectLocator.",
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

  const primary = cleanSubjectCandidate(parsed);
  const vernacularName = primary?.vernacularName ?? null;
  const scientificName = primary?.scientificName ?? null;
  const coexistingRaw = parsed.coexistingSubjects ?? parsed.coexisting_subjects ?? parsed.coexisting_taxa;
  const coexistingSubjects = (Array.isArray(coexistingRaw) ? coexistingRaw : [])
    .map(cleanSubjectCandidate)
    .filter((item): item is ObservationAiSubjectCandidate => item !== null)
    .slice(0, 6);
  const candidate: ObservationAiCandidate = applyObservationAiCandidateSafetyGate({
    candidateKey: primary?.candidateKey ?? null,
    vernacularName,
    scientificName,
    rank: primary?.rank ?? "unknown",
    confidence: primary?.confidence ?? 0,
    visualEvidence: primary?.visualEvidence ?? [],
    needsMoreEvidence: primary?.needsMoreEvidence ?? [],
    subjectLocator: primary?.subjectLocator ?? {},
    nonBiological: parsed.nonBiological === true && !vernacularName && !scientificName,
    coexistingSubjects,
  });
  if (!candidate.nonBiological && !candidate.vernacularName && !candidate.scientificName && coexistingSubjects.length === 0) {
    throw new Error("ai_candidate_name_missing");
  }
  return candidate;
}
