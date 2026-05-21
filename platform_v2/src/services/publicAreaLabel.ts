import type { PublicLocationSummary } from "./publicLocation.js";

export type PublicAreaFieldRef = {
  fieldId?: string | null;
  name?: string | null;
  source?: string | null;
  adminLevel?: string | null;
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
  const refs = Array.isArray(input.fieldRefs) ? input.fieldRefs : [];
  const candidates = refs
    .map((ref) => {
      const kind = normalizeKind(ref);
      const priority = PUBLIC_AREA_PRIORITY_INDEX.get(kind);
      const name = String(ref.name ?? "").trim();
      if (priority == null || !name) return null;
      return { name, priority };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "ja"));

  const locationLabel = String(input.publicLocation?.label || input.municipality || "").trim();
  if (!locationLabel) return null;

  for (const candidate of candidates) {
    const areaName = stripLocationPrefix(candidate.name, [
      locationLabel,
      input.municipality ?? "",
      input.publicLocation?.label ?? "",
    ]);
    if (!areaName || areaName === locationLabel) continue;
    return `${locationLabel} · ${areaName}`;
  }

  return null;
}
