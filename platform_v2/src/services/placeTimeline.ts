import { isCanonicalOrLegacyPublicHost } from "./zukanPublicHost.js";

export const PLACE_TIMELINE_VERSION = 1 as const;

export type PlaceTimelineState = "empty" | "single_period" | "timeline";
export type PlaceTimelineRecordingSuggestion = "first_record" | "revisit" | "none";
export type PlaceTimelineVerificationState = "verified" | "reviewed" | "candidate" | "unverified";

export type PlaceTimelineInputRecord = Readonly<{
  recordId: string;
  observedAt: string;
  publicEligible: boolean;
  displayLabel?: string | null;
  publicMediaUrl?: string | null;
  sourceLabel?: string | null;
  verificationState?: string | null;
}>;

export type PlaceTimelineItem = Readonly<{
  recordId: string;
  observedAt: string;
  observedDate: string;
  displayLabel: string | null;
  publicMediaUrl: string | null;
  sourceLabel: string | null;
  verificationState: PlaceTimelineVerificationState;
}>;

export type PlaceTimelinePeriod = Readonly<{
  periodKey: string;
  observedDate: string;
  items: readonly PlaceTimelineItem[];
}>;

export type PlaceTimelineExcludedCounts = Readonly<{
  notPublicEligible: number;
  invalidRecordId: number;
  invalidObservedAt: number;
  futureObservedAt: number;
  duplicateRecordId: number;
}>;

export type PlaceTimelineResult = Readonly<{
  version: typeof PLACE_TIMELINE_VERSION;
  state: PlaceTimelineState;
  summaryKey: "no_public_records" | "one_observation_period" | "multiple_observation_periods";
  changeAssessment: "not_assessed";
  recordCount: number;
  distinctPeriodCount: number;
  periods: readonly PlaceTimelinePeriod[];
  oldestObservedAt: string | null;
  latestObservedAt: string | null;
  recordingSuggestion: PlaceTimelineRecordingSuggestion;
  excluded: PlaceTimelineExcludedCounts;
}>;

export type PlaceTimelineBuildOptions = Readonly<{
  now?: Date;
  recentWindowDays?: number;
  futureToleranceDays?: number;
}>;

type ParsedObservedAt = Readonly<{
  canonicalObservedAt: string;
  observedDate: string;
  epochMs: number;
}>;

type NormalizedTimelineCandidate = PlaceTimelineItem & Readonly<{
  epochMs: number;
}>;

const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,179}$/u;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/u;
const STRICT_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/u;
const DAY_MS = 86_400_000;
const DEFAULT_RECENT_WINDOW_DAYS = 180;
const DEFAULT_FUTURE_TOLERANCE_DAYS = 1;
const MAX_OPTION_DAYS = 36_500;

function assertValidDateOption(value: Date | undefined): Date {
  const resolved = value ?? new Date();
  if (!(resolved instanceof Date) || !Number.isFinite(resolved.getTime())) {
    throw new RangeError("place_timeline_invalid_now");
  }
  return new Date(resolved.getTime());
}

function assertDayOption(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 0 || resolved > MAX_OPTION_DAYS) {
    throw new RangeError(`place_timeline_invalid_${name}`);
  }
  return resolved;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validTime(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour <= 23
    && minute >= 0 && minute <= 59
    && second >= 0 && second <= 59;
}

function validOffset(offset: string): boolean {
  if (offset === "Z") return true;
  const match = /^([+-])(\d{2}):(\d{2})$/u.exec(offset);
  if (!match) return false;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return hours >= 0
    && hours <= 14
    && minutes >= 0
    && minutes <= 59
    && (hours < 14 || minutes === 0);
}

function parseObservedAt(value: unknown): ParsedObservedAt | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const match = STRICT_DATE_TIME_PATTERN.exec(normalized);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validCalendarDate(year, month, day)) return null;

  const observedDate = `${match[1]}-${match[2]}-${match[3]}`;
  if (!match[4]) {
    const canonicalObservedAt = `${observedDate}T00:00:00.000Z`;
    return {
      canonicalObservedAt,
      observedDate,
      epochMs: Date.parse(canonicalObservedAt),
    };
  }

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = String(match[8] ?? "");
  if (!validTime(hour, minute, second) || !validOffset(offset)) return null;

  const epochMs = Date.parse(normalized);
  if (!Number.isFinite(epochMs)) return null;
  return {
    canonicalObservedAt: new Date(epochMs).toISOString(),
    observedDate,
    epochMs,
  };
}

function normalizeRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return RECORD_ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength || CONTROL_CHAR_PATTERN.test(normalized)) return null;
  return normalized;
}

function allowedPublicMediaPath(value: string): boolean {
  if (!value || value.includes("\\") || CONTROL_CHAR_PATTERN.test(value)) return false;
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (/(?:^|\/)\.\.(?:\/|$)/u.test(decodedPath)) return false;
  return ["/derived/", "/derived-transform/", "/thumb/", "/uploads/", "/data/uploads/"]
    .some((prefix) => decodedPath.startsWith(prefix));
}

function normalizePublicMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 2048 || CONTROL_CHAR_PATTERN.test(normalized) || normalized.includes("\\")) {
    return null;
  }

  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) return null;
    const path = normalized.split(/[?#]/u, 1)[0] ?? "";
    return allowedPublicMediaPath(path) ? normalized : null;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && isCanonicalOrLegacyPublicHost(parsed.hostname)
      && allowedPublicMediaPath(parsed.pathname)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeVerificationState(value: unknown): PlaceTimelineVerificationState {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "verified" || normalized === "source_verified" || normalized === "administrator_verified") {
    return "verified";
  }
  if (normalized === "reviewed" || normalized === "human_reviewed") return "reviewed";
  if (normalized === "candidate" || normalized === "ai_candidate") return "candidate";
  return "unverified";
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function verificationRank(value: PlaceTimelineVerificationState): number {
  if (value === "verified") return 3;
  if (value === "reviewed") return 2;
  if (value === "candidate") return 1;
  return 0;
}

function compareDuplicatePreference(a: NormalizedTimelineCandidate, b: NormalizedTimelineCandidate): number {
  if (a.epochMs !== b.epochMs) return b.epochMs - a.epochMs;
  const verificationDelta = verificationRank(b.verificationState) - verificationRank(a.verificationState);
  if (verificationDelta !== 0) return verificationDelta;
  const mediaDelta = Number(Boolean(b.publicMediaUrl)) - Number(Boolean(a.publicMediaUrl));
  if (mediaDelta !== 0) return mediaDelta;
  const sourceDelta = compareCodeUnits(String(a.sourceLabel ?? ""), String(b.sourceLabel ?? ""));
  if (sourceDelta !== 0) return sourceDelta;
  return compareCodeUnits(String(a.displayLabel ?? ""), String(b.displayLabel ?? ""));
}

function compareTimelineItems(a: NormalizedTimelineCandidate, b: NormalizedTimelineCandidate): number {
  if (a.epochMs !== b.epochMs) return a.epochMs - b.epochMs;
  return compareCodeUnits(a.recordId, b.recordId);
}

export function buildPlaceTimeline(
  records: readonly PlaceTimelineInputRecord[],
  options: PlaceTimelineBuildOptions = {},
): PlaceTimelineResult {
  const now = assertValidDateOption(options.now);
  const recentWindowDays = assertDayOption(options.recentWindowDays, DEFAULT_RECENT_WINDOW_DAYS, "recent_window_days");
  const futureToleranceDays = assertDayOption(
    options.futureToleranceDays,
    DEFAULT_FUTURE_TOLERANCE_DAYS,
    "future_tolerance_days",
  );
  const futureCutoffMs = now.getTime() + futureToleranceDays * DAY_MS;

  const excluded = {
    notPublicEligible: 0,
    invalidRecordId: 0,
    invalidObservedAt: 0,
    futureObservedAt: 0,
    duplicateRecordId: 0,
  };
  const candidates: NormalizedTimelineCandidate[] = [];

  for (const record of records) {
    if (!record || record.publicEligible !== true) {
      excluded.notPublicEligible += 1;
      continue;
    }
    const recordId = normalizeRecordId(record.recordId);
    if (!recordId) {
      excluded.invalidRecordId += 1;
      continue;
    }
    const observed = parseObservedAt(record.observedAt);
    if (!observed) {
      excluded.invalidObservedAt += 1;
      continue;
    }
    if (observed.epochMs > futureCutoffMs) {
      excluded.futureObservedAt += 1;
      continue;
    }
    candidates.push({
      recordId,
      observedAt: observed.canonicalObservedAt,
      observedDate: observed.observedDate,
      displayLabel: normalizeOptionalText(record.displayLabel, 240),
      publicMediaUrl: normalizePublicMediaUrl(record.publicMediaUrl),
      sourceLabel: normalizeOptionalText(record.sourceLabel, 240),
      verificationState: normalizeVerificationState(record.verificationState),
      epochMs: observed.epochMs,
    });
  }

  candidates.sort((a, b) => {
    const idDelta = compareCodeUnits(a.recordId, b.recordId);
    return idDelta !== 0 ? idDelta : compareDuplicatePreference(a, b);
  });

  const selected: NormalizedTimelineCandidate[] = [];
  for (let index = 0; index < candidates.length;) {
    const current = candidates[index]!;
    let nextIndex = index + 1;
    while (nextIndex < candidates.length && candidates[nextIndex]!.recordId === current.recordId) {
      nextIndex += 1;
    }
    selected.push(current);
    excluded.duplicateRecordId += nextIndex - index - 1;
    index = nextIndex;
  }
  selected.sort(compareTimelineItems);

  const periodMap = new Map<string, PlaceTimelineItem[]>();
  for (const item of selected) {
    const outputItem: PlaceTimelineItem = {
      recordId: item.recordId,
      observedAt: item.observedAt,
      observedDate: item.observedDate,
      displayLabel: item.displayLabel,
      publicMediaUrl: item.publicMediaUrl,
      sourceLabel: item.sourceLabel,
      verificationState: item.verificationState,
    };
    const period = periodMap.get(item.observedDate) ?? [];
    period.push(outputItem);
    periodMap.set(item.observedDate, period);
  }

  const periods: PlaceTimelinePeriod[] = [...periodMap.entries()]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([periodKey, items]) => ({
      periodKey,
      observedDate: periodKey,
      items,
    }));
  const distinctPeriodCount = periods.length;
  const state: PlaceTimelineState = distinctPeriodCount === 0
    ? "empty"
    : distinctPeriodCount === 1
      ? "single_period"
      : "timeline";
  const summaryKey = state === "empty"
    ? "no_public_records"
    : state === "single_period"
      ? "one_observation_period"
      : "multiple_observation_periods";

  const oldestObservedAt = selected[0]?.observedAt ?? null;
  const latestItem = selected.at(-1) ?? null;
  const latestObservedAt = latestItem?.observedAt ?? null;
  let recordingSuggestion: PlaceTimelineRecordingSuggestion = "none";
  if (!latestItem) {
    recordingSuggestion = "first_record";
  } else if (now.getTime() - latestItem.epochMs > recentWindowDays * DAY_MS) {
    recordingSuggestion = "revisit";
  }

  return {
    version: PLACE_TIMELINE_VERSION,
    state,
    summaryKey,
    changeAssessment: "not_assessed",
    recordCount: selected.length,
    distinctPeriodCount,
    periods,
    oldestObservedAt,
    latestObservedAt,
    recordingSuggestion,
    excluded,
  };
}
