import type { SiteLang } from "../i18n.js";
import type { PublicLocationSummary } from "./publicLocation.js";

const UNKNOWN_VALUES = new Set([
  "",
  "unknown",
  "unknown place",
  "municipality unknown",
  "unknown observer",
  "unresolved",
  "awaiting id",
]);

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  if (UNKNOWN_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function isJapaneseText(value: string | null | undefined): boolean {
  return /[ぁ-んァ-ン一-龯]/.test(value ?? "");
}

export function isLikelyScientificName(value: string | null | undefined): boolean {
  const trimmed = clean(value);
  if (!trimmed || isJapaneseText(trimmed)) return false;
  return /^[A-Z][a-z-]+(?:\s+(?:[a-z][a-z-]+|x|×|subsp\.?|var\.?|f\.?)){0,4}$/.test(trimmed);
}

export type TaxonDisplayName = {
  primaryLabel: string;
  qualifier: "ai" | "scientific" | null;
  isAwaitingId: boolean;
};

export function formatTaxonDisplayName(
  input: {
    vernacularName?: string | null;
    scientificName?: string | null;
    displayName?: string | null;
    aiCandidateName?: string | null;
    fallback?: string | null;
  },
  lang: SiteLang,
): TaxonDisplayName {
  const awaiting = lang === "ja" ? "同定待ち" : "Awaiting ID";
  const vernacular = clean(input.vernacularName);
  const scientific = clean(input.scientificName);
  const display = clean(input.displayName);
  const aiCandidate = clean(input.aiCandidateName);
  const fallback = clean(input.fallback);

  if (lang === "ja") {
    if (vernacular) return { primaryLabel: vernacular, qualifier: null, isAwaitingId: false };
    if (display && isJapaneseText(display)) return { primaryLabel: display, qualifier: null, isAwaitingId: false };
    if (aiCandidate && isJapaneseText(aiCandidate)) return { primaryLabel: aiCandidate, qualifier: "ai", isAwaitingId: false };
    if (scientific) return { primaryLabel: scientific, qualifier: "scientific", isAwaitingId: false };
    if (display) return { primaryLabel: display, qualifier: isLikelyScientificName(display) ? "scientific" : null, isAwaitingId: false };
    if (aiCandidate) return { primaryLabel: aiCandidate, qualifier: "ai", isAwaitingId: false };
    if (fallback) return { primaryLabel: fallback, qualifier: null, isAwaitingId: false };
    return { primaryLabel: awaiting, qualifier: null, isAwaitingId: true };
  }

  const label = display ?? vernacular ?? scientific ?? aiCandidate ?? fallback ?? awaiting;
  return {
    primaryLabel: label,
    qualifier: !display && aiCandidate ? "ai" : isLikelyScientificName(label) && !vernacular ? "scientific" : null,
    isAwaitingId: label === awaiting,
  };
}

export function formatPlaceDisplay(
  input: {
    placeName?: string | null;
    municipality?: string | null;
    prefecture?: string | null;
    publicLocation?: PublicLocationSummary | null;
  },
  lang: SiteLang,
  mode: "owner" | "public",
): string {
  const blurred = lang === "ja" ? "位置をぼかしています" : "Location generalized";
  const placeName = clean(input.placeName);
  const municipality = clean(input.municipality);
  const prefecture = clean(input.prefecture);
  const publicLabel = clean(input.publicLocation?.label);

  if (mode === "owner") {
    const parts = [placeName, municipality].filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join(" · ");
    return prefecture ?? publicLabel ?? blurred;
  }

  return publicLabel ?? municipality ?? prefecture ?? blurred;
}

export function formatActorDisplay(value: string | null | undefined, lang: SiteLang): string {
  const actor = clean(value);
  if (lang !== "ja") return actor ?? "Observer";
  if (!actor) return "観察者";
  const lower = actor.toLowerCase();
  if (lower === "guest") return "ゲスト";
  if (lower === "community") return "みんなの同定";
  return actor;
}

export function formatIdentificationCount(count: number, lang: SiteLang): string {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (lang === "ja") return `同定 ${safeCount} 件`;
  return `${safeCount} ids`;
}
