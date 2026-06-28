import { randomUUID } from "node:crypto";

export function buildPlaceId(input: {
  siteId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  municipality?: string | null;
  prefecture?: string | null;
}): string {
  const siteId = (input.siteId ?? "").trim();
  if (siteId !== "") {
    return `site:${siteId}`;
  }

  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return `geo:${input.latitude.toFixed(3)}:${input.longitude.toFixed(3)}`;
  }

  const municipality = (input.municipality ?? "").trim();
  const prefecture = (input.prefecture ?? "").trim();
  if (municipality !== "" || prefecture !== "") {
    return `locality:${prefecture}:${municipality}`;
  }

  return "place:unknown";
}

export function buildPlaceName(input: {
  siteName?: string | null;
  municipality?: string | null;
  prefecture?: string | null;
}): string {
  const siteName = (input.siteName ?? "").trim();
  if (siteName !== "") {
    return siteName;
  }

  const municipality = (input.municipality ?? "").trim();
  const prefecture = (input.prefecture ?? "").trim();
  if (municipality !== "" || prefecture !== "") {
    return [municipality, prefecture].filter(Boolean).join(" / ");
  }

  return "Platform Place";
}

export function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

export function makeOccurrenceId(visitId: string, subjectIndex = 0): string {
  return `occ:${visitId}:${subjectIndex}`;
}

export function makeAssetId(): string {
  return randomUUID();
}
