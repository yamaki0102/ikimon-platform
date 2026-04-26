export const MEDIA_ROLE_VALUES = [
  "primary_subject",
  "context",
  "sound_motion",
  "secondary_candidate",
] as const;

export type MediaRole = (typeof MEDIA_ROLE_VALUES)[number];

const MEDIA_ROLE_SET = new Set<string>(MEDIA_ROLE_VALUES);
const AI_MEDIA_ROLE_CONFIDENCE_MIN = 0.5;

export type MediaRoleSuggestionSource = "ai_region" | "ai_candidate" | "heuristic";

export type MediaRoleSuggestion = {
  suggestedMediaRole: MediaRole | null;
  suggestedMediaRoleConfidence: number | null;
  suggestedMediaRoleSource: MediaRoleSuggestionSource | null;
  suggestedMediaRoleReason: string | null;
};

export type MediaRoleSuggestionInput = {
  mediaType: "image" | "video";
  primaryRegionConfidence?: number | null;
  secondaryCandidateConfidence?: number | null;
  totalMediaCount?: number | null;
};

export function normalizeMediaRole(value: unknown): MediaRole {
  const raw = typeof value === "string" ? value.trim() : "";
  return MEDIA_ROLE_SET.has(raw) ? (raw as MediaRole) : "primary_subject";
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function deriveMediaRoleSuggestion(input: MediaRoleSuggestionInput): MediaRoleSuggestion {
  if (input.mediaType === "video") {
    return {
      suggestedMediaRole: "sound_motion",
      suggestedMediaRoleConfidence: null,
      suggestedMediaRoleSource: "heuristic",
      suggestedMediaRoleReason: "動画は鳴き声・動き・行動の証拠として扱います。",
    };
  }

  const primaryConfidence = normalizeConfidence(input.primaryRegionConfidence);
  if (primaryConfidence !== null && primaryConfidence >= AI_MEDIA_ROLE_CONFIDENCE_MIN) {
    return {
      suggestedMediaRole: "primary_subject",
      suggestedMediaRoleConfidence: primaryConfidence,
      suggestedMediaRoleSource: "ai_region",
      suggestedMediaRoleReason: "AI が主対象の位置をこの写真上で検出しています。",
    };
  }

  const secondaryConfidence = normalizeConfidence(input.secondaryCandidateConfidence);
  if (secondaryConfidence !== null && secondaryConfidence >= AI_MEDIA_ROLE_CONFIDENCE_MIN) {
    return {
      suggestedMediaRole: "secondary_candidate",
      suggestedMediaRoleConfidence: secondaryConfidence,
      suggestedMediaRoleSource: "ai_candidate",
      suggestedMediaRoleReason: "AI が別対象候補と対応する位置をこの写真上で検出しています。",
    };
  }

  if ((input.totalMediaCount ?? 0) >= 2) {
    return {
      suggestedMediaRole: "context",
      suggestedMediaRoleConfidence: null,
      suggestedMediaRoleSource: "heuristic",
      suggestedMediaRoleReason: "複数メディアの補助写真として、場所や周囲の文脈に使えます。",
    };
  }

  return {
    suggestedMediaRole: null,
    suggestedMediaRoleConfidence: null,
    suggestedMediaRoleSource: null,
    suggestedMediaRoleReason: null,
  };
}
