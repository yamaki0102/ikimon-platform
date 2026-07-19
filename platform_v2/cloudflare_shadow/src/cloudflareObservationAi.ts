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

const cleanList = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => cleanText(item, 160)).filter((item): item is string => Boolean(item)).slice(0, 4)
  : [];

export function observationAiQuestion(): string {
  return [
    "あなたは市民科学の画像判定支援AIです。画像の主な生物を、断定せず候補として判定してください。",
    "種まで判断できない場合は、属・科など画像から妥当な粗い分類に留めてください。園芸植物も考慮してください。",
    "返答は説明文やMarkdownを付けず、次のキーを持つJSONオブジェクト1個だけにしてください。",
    '{"vernacularName":"日本語名またはnull","scientificName":"学名またはnull","rank":"species|genus|family|order|class|unknown","confidence":0.0,"visualEvidence":["画像で見える根拠"],"needsMoreEvidence":["次に撮るとよい部位"],"nonBiological":false}',
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
  const candidate: ObservationAiCandidate = {
    vernacularName: cleanText(parsed.vernacularName, 120),
    scientificName: cleanText(parsed.scientificName, 180),
    rank: rawRank && allowedRanks.has(rawRank) ? rawRank : "unknown",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    visualEvidence: cleanList(parsed.visualEvidence),
    needsMoreEvidence: cleanList(parsed.needsMoreEvidence),
    nonBiological: parsed.nonBiological === true,
  };
  if (!candidate.nonBiological && !candidate.vernacularName && !candidate.scientificName) {
    throw new Error("ai_candidate_name_missing");
  }
  return candidate;
}
