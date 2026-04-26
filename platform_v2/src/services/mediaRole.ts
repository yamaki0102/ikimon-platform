export const MEDIA_ROLE_VALUES = [
  "primary_subject",
  "context",
  "sound_motion",
  "secondary_candidate",
] as const;

export type MediaRole = (typeof MEDIA_ROLE_VALUES)[number];

const MEDIA_ROLE_SET = new Set<string>(MEDIA_ROLE_VALUES);

export function normalizeMediaRole(value: unknown): MediaRole {
  const raw = typeof value === "string" ? value.trim() : "";
  return MEDIA_ROLE_SET.has(raw) ? (raw as MediaRole) : "primary_subject";
}
