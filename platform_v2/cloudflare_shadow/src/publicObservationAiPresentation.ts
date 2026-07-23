import type { ObservationFirstAiCandidateInsight } from "./observationFirstRecordDetailHtml";

const genericCandidate = /^(?:鳥|鳥類|小鳥|動物|生きもの|生物|植物|写っているもの|unknown|unidentified|unclassified)$/iu;
const privateLocation = /(?:\b(?:lat|lng|latitude|longitude|coordinate|geohash|h3)\b|[-+]?\d{1,2}\.\d{4,}\s*[,/]\s*[-+]?\d{2,3}\.\d{4,})/iu;

function safeText(value: unknown, maxLength = 220): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/gu, " ").trim();
  if (!text || text.length > maxLength || privateLocation.test(text)) return null;
  return text;
}

function safeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const text = safeText(item);
    return text ? [text] : [];
  }))].slice(0, 3);
}

export function publicObservationAiCandidateInsights(
  sourcePayloadJson: string | null | undefined,
): ObservationFirstAiCandidateInsight[] {
  if (!sourcePayloadJson) return [];
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(sourcePayloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    payload = parsed as Record<string, unknown>;
  } catch {
    return [];
  }
  if (!Array.isArray(payload.topCandidates)) return [];
  const seen = new Set<string>();
  return payload.topCandidates.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const candidate = value as Record<string, unknown>;
    const name = safeText(candidate.name) ?? safeText(candidate.scientificName);
    if (!name || genericCandidate.test(name)) return [];
    const key = name.toLocaleLowerCase("ja-JP");
    if (seen.has(key)) return [];
    const supportingFeatures = safeTextList(candidate.supportingFeatures);
    const missingFeatures = safeTextList(candidate.missingFeatures);
    const contradictions = safeTextList(candidate.contradictions);
    if (supportingFeatures.length + missingFeatures.length + contradictions.length === 0) return [];
    seen.add(key);
    return [{
      name,
      scientificName: safeText(candidate.scientificName),
      supportingFeatures,
      missingFeatures,
      contradictions,
    }];
  }).slice(0, 3);
}
