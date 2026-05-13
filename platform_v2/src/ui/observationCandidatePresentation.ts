export type CandidateRegionForPresentation = {
  rect: unknown;
  confidenceScore: number | null;
};

export type AiCandidateForPresentation = {
  suggestedOccurrenceId: string | null;
  candidateStatus: string;
  confidence: number | null;
  regions: CandidateRegionForPresentation[];
};

export const AI_CANDIDATE_REGION_CONFIDENCE_MIN = 0.45;
export const AI_CANDIDATE_MEDIUM_CONFIDENCE_MIN = 0.5;
export const AI_CANDIDATE_STRONG_CONFIDENCE_MIN = 0.72;

export type AiCandidateTrustLevel = "strong" | "medium" | "reference";

export function candidateHasVisibleRegion(candidate: AiCandidateForPresentation): boolean {
  return candidate.regions.some((region) => {
    if (!region.rect) return false;
    return (region.confidenceScore ?? 1) >= AI_CANDIDATE_REGION_CONFIDENCE_MIN;
  });
}

export function isOpenCandidate(candidate: AiCandidateForPresentation): boolean {
  if (candidate.suggestedOccurrenceId) return false;
  return candidate.candidateStatus === "proposed" || candidate.candidateStatus === "matched";
}

export function classifyAiCandidateTrustLevel(candidate: AiCandidateForPresentation): AiCandidateTrustLevel {
  if ((candidate.confidence ?? 0) >= AI_CANDIDATE_STRONG_CONFIDENCE_MIN || candidateHasVisibleRegion(candidate)) {
    return "strong";
  }
  if ((candidate.confidence ?? 0) >= AI_CANDIDATE_MEDIUM_CONFIDENCE_MIN) {
    return "medium";
  }
  return "reference";
}

export function isProminentAiCandidate(candidate: AiCandidateForPresentation): boolean {
  if (!isOpenCandidate(candidate)) return false;
  return classifyAiCandidateTrustLevel(candidate) === "strong";
}

function candidatePresentationScore(candidate: AiCandidateForPresentation): number {
  const confidence = candidate.confidence ?? 0.5;
  return confidence + (candidateHasVisibleRegion(candidate) ? 0.2 : 0);
}

export function rankProminentAiCandidates<T extends AiCandidateForPresentation>(
  candidates: T[],
  limit = 4,
): T[] {
  return candidates
    .filter(isProminentAiCandidate)
    .sort((left, right) => candidatePresentationScore(right) - candidatePresentationScore(left))
    .slice(0, limit);
}

export function countProminentAiCandidates(candidates: AiCandidateForPresentation[]): number {
  return candidates.filter(isProminentAiCandidate).length;
}
