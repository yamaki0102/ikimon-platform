/** Public-data interchange only: never grants identity, role or publication authority. */
export const PUBLIC_PROGRAM_SCHEMA = "ikimon.public-program/v1" as const;
export const PUBLIC_PROGRAM_MAX_BYTES = 24_576;
export const programProfiles = ["event", "observation_event", "stamp_rally"] as const;
export type ProgramProfile = (typeof programProfiles)[number];
export interface PublicProgram {
  readonly schema: typeof PUBLIC_PROGRAM_SCHEMA;
  readonly requestId: string;
  readonly profile: ProgramProfile;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly placeLabel: string;
  readonly description: string;
  readonly conditions: string;
  readonly stations: readonly { readonly id: string; readonly name: string }[];
}
export class ProgramInputError extends Error {
  constructor(readonly field: string) { super(`invalid_program_${field}`); }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max) throw new ProgramInputError(field);
  const result = value.trim();
  if (required && !result) throw new ProgramInputError(field);
  return result;
}
function instant(value: unknown, field: string, required: boolean): string {
  const result = text(value, field, 30, required);
  if (!result) return result;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(result) ||
    !Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) throw new ProgramInputError(field);
  return result;
}
export function parsePublicProgram(value: unknown, forPublication = true): PublicProgram {
  if (!object(value) || new TextEncoder().encode(JSON.stringify(value)).length > PUBLIC_PROGRAM_MAX_BYTES) throw new ProgramInputError("size");
  const keys = ["schema", "requestId", "profile", "title", "startsAt", "endsAt", "timezone", "placeLabel", "description", "conditions", "stations"];
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) throw new ProgramInputError("fields");
  if (value.schema !== PUBLIC_PROGRAM_SCHEMA) throw new ProgramInputError("schema");
  const requestId = text(value.requestId, "requestId", 36, true);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(requestId)) throw new ProgramInputError("requestId");
  if (!(programProfiles as readonly unknown[]).includes(value.profile)) throw new ProgramInputError("profile");
  const timezone = text(value.timezone, "timezone", 80, true);
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0); } catch { throw new ProgramInputError("timezone"); }
  const startsAt = instant(value.startsAt, "startsAt", forPublication);
  const endsAt = instant(value.endsAt, "endsAt", forPublication && value.profile === "stamp_rally");
  if (endsAt && (!startsAt || endsAt <= startsAt)) throw new ProgramInputError("endsAt");
  if (!Array.isArray(value.stations) || value.stations.length > 40) throw new ProgramInputError("stations");
  const ids = new Set<string>();
  const stations = value.stations.map((entry: unknown) => {
    if (!object(entry) || Object.keys(entry).some(key => !["id", "name"].includes(key))) throw new ProgramInputError("stations");
    const id = text(entry.id, "station_id", 40, true);
    if (!/^[a-zA-Z0-9_-]{1,40}$/u.test(id) || ids.has(id)) throw new ProgramInputError("station_id");
    ids.add(id);
    return { id, name: text(entry.name, "station_name", 80, forPublication) };
  });
  if (value.profile !== "stamp_rally" && stations.length) throw new ProgramInputError("stations");
  if (forPublication && value.profile === "stamp_rally" && !stations.length) throw new ProgramInputError("stations");
  return { schema: PUBLIC_PROGRAM_SCHEMA, requestId, profile: value.profile as ProgramProfile,
    title: text(value.title, "title", 80, true), startsAt, endsAt, timezone,
    placeLabel: text(value.placeLabel, "placeLabel", 160, forPublication),
    description: text(value.description, "description", 2000), conditions: text(value.conditions, "conditions", 1000), stations };
}
export function emptyProgram(profile: ProgramProfile = "event"): PublicProgram {
  return { schema: PUBLIC_PROGRAM_SCHEMA, requestId: crypto.randomUUID(), profile, title: "", startsAt: "", endsAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", placeLabel: "", description: "", conditions: "", stations: [] };
}
export async function programDigest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
