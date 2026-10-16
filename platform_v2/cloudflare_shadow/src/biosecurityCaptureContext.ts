/** Actual capture time can be unknown or local-only. Never replace it with upload time. */
export type BiosecurityTime = {
  source: "unknown" | "photo_exif" | "user";
  localDateTime: string | null;
  offsetMinutes: number | null;
  precision: "unknown" | "date" | "minute" | "second";
  photoIndex: number | null;
  instant: string | null;
};
export type BiosecurityCaptureMetadata = {
  version: 1;
  time: BiosecurityTime;
  originalTime: BiosecurityTime | null;
  location: { source: "unknown" | "photo_exif" | "device" | "user"; photoIndex: number | null };
  conflicts: { time: boolean; location: boolean };
  /** Server-owned revision; capture parsing never accepts a client-supplied edit. */
  edit?: { version: number; key: string; digest: string; writeToken: string };
};
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("capture_metadata_invalid");
  return value as ObjectValue;
};
const unknownTime = (source: "unknown" | "user" = "unknown"): BiosecurityTime => ({ source, localDateTime: null, offsetMinutes: null, precision: "unknown", photoIndex: null, instant: null });

function photoIndex(value: unknown, count: number): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= count) throw new Error("capture_photo_source_invalid");
  return value as number;
}

function localDate(value: unknown, precision: BiosecurityTime["precision"]): { text: string; utc: number } {
  if (typeof value !== "string" || value.length > 19) throw new Error("observed_at_invalid");
  const patterns = { date: /^(\d{4})-(\d{2})-(\d{2})$/, minute: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/, second: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/ };
  if (precision === "unknown") throw new Error("observed_at_invalid");
  const parts = patterns[precision].exec(value);
  if (!parts) throw new Error("observed_at_invalid");
  const [year, month, day, hour, minute, second] = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4] ?? 0), Number(parts[5] ?? 0), Number(parts[6] ?? 0)];
  const date = new Date(0); date.setUTCFullYear(year!, month! - 1, day!); date.setUTCHours(hour!, minute!, second!, 0);
  if (year! < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) throw new Error("observed_at_invalid");
  return { text: value, utc: date.getTime() };
}

function timeValue(value: unknown, count: number, now: number): BiosecurityTime {
  const row = object(value);
  if (typeof row.source !== "string" || !["unknown", "photo_exif", "user"].includes(row.source)) throw new Error("capture_time_source_invalid");
  const source = row.source as BiosecurityTime["source"];
  if (row.localDateTime === null || row.localDateTime === undefined || row.localDateTime === "") {
    if (source === "photo_exif" || (row.precision !== undefined && row.precision !== "unknown") || row.offsetMinutes != null || row.photoIndex != null) throw new Error("capture_time_source_invalid");
    return unknownTime(source);
  }
  if (source === "unknown") throw new Error("capture_time_source_invalid");
  const precision = row.precision as BiosecurityTime["precision"];
  if (!["date", "minute", "second"].includes(precision)) throw new Error("observed_at_invalid");
  const local = localDate(row.localDateTime, precision);
  const offset = row.offsetMinutes === undefined || row.offsetMinutes === null ? null : row.offsetMinutes;
  if (offset !== null && (!Number.isInteger(offset) || Math.abs(offset as number) > 840)) throw new Error("capture_time_offset_invalid");
  const index = photoIndex(row.photoIndex, count);
  if (source !== "photo_exif" && index !== null) throw new Error("capture_photo_source_invalid");
  const instant = offset === null || precision === "date" ? null : new Date(local.utc - (offset as number) * 60_000).toISOString();
  if ((instant ? Date.parse(instant) : local.utc - 840 * 60_000) > now + 86_400_000) throw new Error("observed_at_invalid");
  return { source, localDateTime: local.text, offsetMinutes: offset as number | null, precision, photoIndex: index, instant };
}

function legacyTime(rawDate: string, count: number, now: number): BiosecurityTime {
  if (!rawDate) return unknownTime();
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(rawDate);
  if (!match) throw new Error("observed_at_invalid");
  const zone = match[3]!;
  const hours = zone === "Z" ? 0 : Number(zone.slice(1, 3)), minutes = zone === "Z" ? 0 : Number(zone.slice(4));
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw new Error("capture_time_offset_invalid");
  const offset = (hours * 60 + minutes) * (zone.startsWith("-") ? -1 : 1);
  const time = timeValue({ source: "user", localDateTime: match[1], offsetMinutes: offset, precision: "second", photoIndex: null }, count, now);
  // RFC 3339 -00:00 explicitly means the local offset is unknown, not UTC.
  if (zone === "-00:00") return { ...time, offsetMinutes: null, instant: null };
  // Older clients may include milliseconds. Preserve their instant; do not synthesize them.
  time.instant = new Date(Date.parse(time.instant!) + Number((match[2] ?? "").padEnd(3, "0"))).toISOString();
  return time;
}

export function parseBiosecurityCaptureMetadata(raw: string, rawDate: string, count: number, hasLocation: boolean, now = Date.now()): BiosecurityCaptureMetadata {
  if (!raw) return { version: 1, time: legacyTime(rawDate, count, now), originalTime: null, location: { source: hasLocation ? "user" : "unknown", photoIndex: null }, conflicts: { time: false, location: false } };
  if (raw.length > 4096) throw new Error("capture_metadata_invalid");
  let row: ObjectValue;
  try { row = object(JSON.parse(raw)); } catch { throw new Error("capture_metadata_invalid"); }
  if (row.version !== 1) throw new Error("capture_metadata_version_invalid");
  const time = timeValue(row.time, count, now);
  if (rawDate && (time.instant === null || Date.parse(rawDate) !== Date.parse(time.instant))) throw new Error("capture_time_mismatch");
  const location = object(row.location);
  if (typeof location.source !== "string" || !["unknown", "photo_exif", "device", "user"].includes(location.source)) throw new Error("capture_location_source_invalid");
  const index = photoIndex(location.photoIndex, count);
  if ((location.source === "unknown") !== !hasLocation || (location.source !== "photo_exif" && index !== null)) throw new Error("capture_location_source_invalid");
  const conflicts = object(row.conflicts);
  if (typeof conflicts.time !== "boolean" || typeof conflicts.location !== "boolean") throw new Error("capture_photo_conflict_invalid");
  const originalTime = row.originalTime == null ? null : timeValue(row.originalTime, count, now);
  if (originalTime && !["unknown", "photo_exif"].includes(originalTime.source)) throw new Error("capture_photo_source_invalid");
  return { version: 1, time, originalTime, location: { source: location.source as BiosecurityCaptureMetadata["location"]["source"], photoIndex: index }, conflicts: { time: conflicts.time, location: conflicts.location } };
}

/** Only used for already stored pre-photo-assist records. No current-time fallback. */
export function legacyBiosecurityCaptureMetadata(observedAt: string | null, hasLocation: boolean): BiosecurityCaptureMetadata {
  return parseBiosecurityCaptureMetadata("", observedAt ?? "", 6, hasLocation);
}
