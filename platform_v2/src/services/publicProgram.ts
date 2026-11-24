/** Public-data interchange only: never grants identity, role or publication authority. */
export const PUBLIC_PROGRAM_SCHEMA = "ikimon.public-program/v1" as const;
export const PUBLIC_PROGRAM_SCHEMA_V2 = "ikimon.public-program/v2" as const;
export const PUBLIC_PROGRAM_MAX_BYTES = 24_576;
export const programProfiles = ["event", "observation_event", "stamp_rally"] as const;
export type ProgramProfile = (typeof programProfiles)[number];
export interface PublicProgramPublicPage {
  readonly audience: string;
  readonly capacity: number | null;
  readonly belongings: string;
  readonly rain_rule: string;
  readonly contact: string;
  readonly hazards: string;
  readonly organizer_name: string;
  readonly meeting_point: string;
}
export interface PublicProgram {
  readonly schema: typeof PUBLIC_PROGRAM_SCHEMA | typeof PUBLIC_PROGRAM_SCHEMA_V2;
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
  readonly public_page?: PublicProgramPublicPage;
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
function optionalText(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return "";
  return text(value, field, max, false);
}
function parsePublicPage(value: unknown): PublicProgramPublicPage {
  if (value === undefined || value === null) {
    return {
      audience: "",
      capacity: null,
      belongings: "",
      rain_rule: "",
      contact: "",
      hazards: "",
      organizer_name: "",
      meeting_point: "",
    };
  }
  if (!object(value)) throw new ProgramInputError("public_page");
  const allowedKeys = ["audience", "capacity", "belongings", "rain_rule", "contact", "hazards", "organizer_name", "meeting_point"];
  if (Object.keys(value).some(key => !allowedKeys.includes(key))) throw new ProgramInputError("public_page");
  let capacity: number | null = null;
  if (value.capacity !== undefined && value.capacity !== null) {
    if (typeof value.capacity !== "number" || !Number.isInteger(value.capacity) || value.capacity < 1 || value.capacity > 10000) {
      throw new ProgramInputError("capacity");
    }
    capacity = value.capacity;
  }
  return {
    audience: optionalText(value.audience, "audience", 120),
    capacity,
    belongings: optionalText(value.belongings, "belongings", 400),
    rain_rule: optionalText(value.rain_rule, "rain_rule", 240),
    contact: optionalText(value.contact, "contact", 240),
    hazards: optionalText(value.hazards, "hazards", 400),
    organizer_name: optionalText(value.organizer_name, "organizer_name", 120),
    meeting_point: optionalText(value.meeting_point, "meeting_point", 240),
  };
}
export function parsePublicProgram(value: unknown, forPublication = true): PublicProgram {
  if (!object(value) || new TextEncoder().encode(JSON.stringify(value)).length > PUBLIC_PROGRAM_MAX_BYTES) throw new ProgramInputError("size");
  const isV2 = value.schema === PUBLIC_PROGRAM_SCHEMA_V2;
  if (value.schema !== PUBLIC_PROGRAM_SCHEMA && !isV2) throw new ProgramInputError("schema");
  const requiredKeys = ["schema", "requestId", "profile", "title", "startsAt", "endsAt", "timezone", "placeLabel", "description", "conditions", "stations"];
  const allowedKeys = isV2 ? [...requiredKeys, "public_page"] : requiredKeys;
  if (Object.keys(value).some(key => !allowedKeys.includes(key)) || requiredKeys.some(key => !Object.hasOwn(value, key))) throw new ProgramInputError("fields");
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
  const base: PublicProgram = { schema: isV2 ? PUBLIC_PROGRAM_SCHEMA_V2 : PUBLIC_PROGRAM_SCHEMA, requestId, profile: value.profile as ProgramProfile,
    title: text(value.title, "title", 80, true), startsAt, endsAt, timezone,
    placeLabel: text(value.placeLabel, "placeLabel", 160, forPublication),
    description: text(value.description, "description", 2000), conditions: text(value.conditions, "conditions", 1000), stations };
  return isV2 ? { ...base, public_page: parsePublicPage(value.public_page) } : base;
}
export function emptyProgram(profile: ProgramProfile = "event"): PublicProgram {
  return { schema: PUBLIC_PROGRAM_SCHEMA, requestId: crypto.randomUUID(), profile, title: "", startsAt: "", endsAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", placeLabel: "", description: "", conditions: "", stations: [] };
}
export async function programDigest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
