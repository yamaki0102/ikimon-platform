const WEAK_TAXON_LABELS = new Set([
  "unidentified",
  "unknown",
  "unresolved",
  "awaiting id",
  "同定待ち",
  "名前待ち",
  "未同定",
  "不明",
]);

export const NEUTRAL_TAXON_FALLBACK_JA = "自然の記録";

export function isWeakTaxonLabel(label: string | null | undefined): boolean {
  const text = (label ?? "").trim().toLowerCase();
  return !text || WEAK_TAXON_LABELS.has(text);
}

export interface UnifiedTaxonNameInput {
  readmodelTaxonLabel?: string | null;
  observationTaxonLabel?: string | null;
  proposedName?: string | null;
  vernacularName?: string | null;
  scientificName?: string | null;
  aiCandidateLabel?: string | null;
  fallbackLabel?: string;
}

export interface UnifiedTaxonNameResult {
  effectiveTaxonLabel: string | null;
  displayName: string;
  isAwaitingId: boolean;
}

/**
 * Single source of truth for resolving an observation's display taxon name across
 * the Map API, Observation Detail Page, and Records List.
 * Never emits "名前待ち" as a user-facing fallback.
 */
export function resolveUnifiedTaxonName(input: UnifiedTaxonNameInput): UnifiedTaxonNameResult {
  const confirmedCandidates = [
    input.readmodelTaxonLabel,
    input.observationTaxonLabel,
    input.proposedName,
    input.vernacularName,
    input.scientificName,
  ];
  let effectiveTaxonLabel: string | null = null;
  for (const candidate of confirmedCandidates) {
    if (!isWeakTaxonLabel(candidate)) {
      effectiveTaxonLabel = candidate!.trim();
      break;
    }
  }
  const isAwaitingId = isWeakTaxonLabel(effectiveTaxonLabel);
  const aiLabel = !isWeakTaxonLabel(input.aiCandidateLabel) ? input.aiCandidateLabel!.trim() : null;
  const fallback = !isWeakTaxonLabel(input.fallbackLabel)
    ? input.fallbackLabel!.trim()
    : NEUTRAL_TAXON_FALLBACK_JA;
  const displayName = !isAwaitingId
    ? effectiveTaxonLabel!
    : aiLabel ?? fallback;
  return {
    effectiveTaxonLabel,
    displayName,
    isAwaitingId,
  };
}

export function publicTaxonDisplayName(
  label: string | null | undefined,
  aiCandidateLabel?: string | null,
  fallbackLabel = NEUTRAL_TAXON_FALLBACK_JA
): string {
  return resolveUnifiedTaxonName({
    readmodelTaxonLabel: label,
    aiCandidateLabel,
    fallbackLabel,
  }).displayName;
}
