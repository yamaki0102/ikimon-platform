import type { PublicLocationSummary } from "./publicLocation.js";

export type PublicAreaFieldRef = {
  fieldId?: string | null;
  name?: string | null;
  source?: string | null;
  adminLevel?: string | null;
  isConfirmed?: boolean | null;
};

const PUBLIC_AREA_PRIORITY = [
  "osm_park",
  "park",
  "school",
  "nature_symbiosis_site",
  "symbiosis",
  "tsunag",
  "protected_area",
  "protected",
  "oecm",
] as const;

const PUBLIC_AREA_PRIORITY_INDEX = new Map<string, number>(
  PUBLIC_AREA_PRIORITY.map((key, index) => [key, index]),
);

function normalizeKind(ref: PublicAreaFieldRef): string {
  return String(ref.adminLevel || ref.source || "").trim().toLowerCase();
}

function stripLocationPrefix(name: string, prefixes: string[]): string {
  let current = name.trim();
  for (const prefix of prefixes) {
    const normalized = prefix.trim();
    if (!normalized || current === normalized) continue;
    if (current.startsWith(`${normalized} `)) current = current.slice(normalized.length).trim();
    if (current.startsWith(`${normalized}　`)) current = current.slice(normalized.length).trim();
    if (current.startsWith(`${normalized}・`)) current = current.slice(normalized.length + 1).trim();
  }
  return current;
}

export function publicRegisteredAreaLine(input: {
  fieldRefs?: PublicAreaFieldRef[] | null;
  municipality?: string | null;
  publicLocation?: PublicLocationSummary | null;
}): string | null {
  const candidates = publicRegisteredAreaCandidates(input);
  const locationLabel = String(input.publicLocation?.label || input.municipality || "").trim();
  if (!locationLabel) return null;

  const confirmed = candidates.find((candidate) => candidate.isConfirmed);
  if (confirmed) return `${locationLabel} · ${confirmed.displayName}`;

  const topPriority = candidates[0]?.priority;
  const topAreaNames = candidates
    .filter((candidate) => candidate.priority === topPriority)
    .map((candidate) => candidate.displayName)
    .filter((areaName, index, all) => all.indexOf(areaName) === index);

  if (topAreaNames.length >= 2) {
    return `${locationLabel} · ${topAreaNames.slice(0, 2).join(" / ")} 付近`;
  }
  if (topAreaNames.length === 1) return `${locationLabel} · ${topAreaNames[0]}`;

  return null;
}

export function publicRegisteredAreaCandidates(input: {
  fieldRefs?: PublicAreaFieldRef[] | null;
  municipality?: string | null;
  publicLocation?: PublicLocationSummary | null;
}): Array<{
  fieldId: string;
  name: string;
  displayName: string;
  priority: number;
  isConfirmed: boolean;
}> {
  const refs = Array.isArray(input.fieldRefs) ? input.fieldRefs : [];
  const locationLabel = String(input.publicLocation?.label || input.municipality || "").trim();
  const candidates = refs
    .map((ref) => {
      const kind = normalizeKind(ref);
      const priority = PUBLIC_AREA_PRIORITY_INDEX.get(kind);
      const name = String(ref.name ?? "").trim();
      const fieldId = String(ref.fieldId ?? "").trim();
      if (priority == null || !name || !fieldId) return null;
      const displayName = stripLocationPrefix(name, [
        locationLabel,
        input.municipality ?? "",
        input.publicLocation?.label ?? "",
      ]);
      if (!displayName || displayName === locationLabel) return null;
      return { fieldId, name, displayName, priority, isConfirmed: ref.isConfirmed === true };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "ja"));

  const seenNames = new Set<string>();
  const deduped: typeof candidates = [];
  for (const candidate of candidates) {
    const existingIndex = deduped.findIndex((item) => item.displayName === candidate.displayName);
    if (existingIndex >= 0) {
      if (candidate.isConfirmed && !deduped[existingIndex]?.isConfirmed) {
        deduped[existingIndex] = candidate;
      }
      continue;
    }
    seenNames.add(candidate.displayName);
    deduped.push(candidate);
  }
  return deduped;
}
