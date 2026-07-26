import type {
  PlaceAtlasIdentificationStatus,
  PlaceAtlasMediaKind,
  PlaceAtlasProfile,
} from "./placeAtlasContract.js";
import {
  buildPlaceTimeline,
  type PlaceTimelineExcludedCounts,
  type PlaceTimelineRecordingSuggestion,
  type PlaceTimelineState,
  type PlaceTimelineVerificationState,
} from "./placeTimeline.js";

export const PLACE_ATLAS_TIMELINE_PROJECTION_VERSION = 1 as const;

export type PlaceAtlasTimelineProjectionState = PlaceTimelineState | "suppressed";
export type PlaceAtlasTimelineSourceKind = "public_record";

export type PlaceAtlasTimelineProjectionItem = Readonly<{
  recordId: string;
  observedAt: string;
  observedDate: string;
  displayLabel: string | null;
  publicMediaUrl: string | null;
  sourceKind: PlaceAtlasTimelineSourceKind;
  verificationState: PlaceTimelineVerificationState;
  identificationStatus: PlaceAtlasIdentificationStatus;
  href: string | null;
  mediaKind: PlaceAtlasMediaKind;
}>;

export type PlaceAtlasTimelineProjectionPeriod = Readonly<{
  periodKey: string;
  observedDate: string;
  items: readonly PlaceAtlasTimelineProjectionItem[];
}>;

export type PlaceAtlasTimelineProjection = Readonly<{
  version: typeof PLACE_ATLAS_TIMELINE_PROJECTION_VERSION;
  state: PlaceAtlasTimelineProjectionState;
  summaryKey:
    | "timeline_suppressed"
    | "no_public_records"
    | "one_observation_period"
    | "multiple_observation_periods";
  changeAssessment: "not_assessed";
  recordCount: number;
  totalRecordCount: number | null;
  sampled: boolean;
  distinctPeriodCount: number;
  periods: readonly PlaceAtlasTimelineProjectionPeriod[];
  oldestObservedAt: string | null;
  latestObservedAt: string | null;
  recordingSuggestion: PlaceTimelineRecordingSuggestion;
  publicationStatus: PlaceAtlasProfile["publication"]["status"];
  excluded: PlaceTimelineExcludedCounts;
}>;

export type BuildPlaceAtlasTimelineOptions = Readonly<{
  now?: Date;
  recentWindowDays?: number;
  futureToleranceDays?: number;
}>;

const EMPTY_EXCLUDED: PlaceTimelineExcludedCounts = {
  notPublicEligible: 0,
  invalidRecordId: 0,
  invalidObservedAt: 0,
  futureObservedAt: 0,
  duplicateRecordId: 0,
};
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/u;

function safeRelativeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || !href.startsWith("/") || href.startsWith("//") || CONTROL_CHAR_PATTERN.test(href)) return null;
  const path = href.split(/[?#]/u, 1)[0] ?? "";
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (/(?:^|\/)\.\.(?:\/|$)/u.test(decodedPath)) return null;
  return href;
}

function verificationState(status: PlaceAtlasIdentificationStatus): PlaceTimelineVerificationState {
  if (status === "confirmed") return "verified";
  if (status === "ai_candidate") return "candidate";
  return "unverified";
}

function safeTotalRecordCount(profile: PlaceAtlasProfile): number | null {
  const value = profile.summary.recordCount;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function resolvedNow(profile: PlaceAtlasProfile, value: Date | undefined): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  const generatedMs = Date.parse(profile.provenance.generatedAt);
  return Number.isFinite(generatedMs) ? new Date(generatedMs) : new Date(0);
}

function suppressedTimeline(profile: PlaceAtlasProfile): boolean {
  return profile.publication.status === "suppressed"
    || profile.publication.suppressedSections.includes("recent_records");
}

export function buildPlaceAtlasTimelineProjection(
  profile: PlaceAtlasProfile,
  options: BuildPlaceAtlasTimelineOptions = {},
): PlaceAtlasTimelineProjection {
  if (suppressedTimeline(profile)) {
    return {
      version: PLACE_ATLAS_TIMELINE_PROJECTION_VERSION,
      state: "suppressed",
      summaryKey: "timeline_suppressed",
      changeAssessment: "not_assessed",
      recordCount: 0,
      totalRecordCount: null,
      sampled: false,
      distinctPeriodCount: 0,
      periods: [],
      oldestObservedAt: null,
      latestObservedAt: null,
      recordingSuggestion: "none",
      publicationStatus: profile.publication.status,
      excluded: { ...EMPTY_EXCLUDED },
    };
  }

  const sourceRecords = profile.recentRecords.map((record) => ({
    recordId: record.recordId,
    observedAt: record.observedAt ?? "",
    publicEligible: true,
    displayLabel: record.displayName,
    publicMediaUrl: record.mediaUrl,
    verificationState: verificationState(record.identificationStatus),
  }));
  const timeline = buildPlaceTimeline(sourceRecords, {
    now: resolvedNow(profile, options.now),
    ...(options.recentWindowDays === undefined ? {} : { recentWindowDays: options.recentWindowDays }),
    ...(options.futureToleranceDays === undefined ? {} : { futureToleranceDays: options.futureToleranceDays }),
  });
  const recordById = new Map(profile.recentRecords.map((record) => [record.recordId, record] as const));
  const periods = timeline.periods.map((period) => ({
    periodKey: period.periodKey,
    observedDate: period.observedDate,
    items: period.items.map((item) => {
      const source = recordById.get(item.recordId);
      return {
        recordId: item.recordId,
        observedAt: item.observedAt,
        observedDate: item.observedDate,
        displayLabel: item.displayLabel,
        publicMediaUrl: item.publicMediaUrl,
        sourceKind: "public_record" as const,
        verificationState: item.verificationState,
        identificationStatus: source?.identificationStatus ?? "unknown",
        href: safeRelativeHref(source?.href),
        mediaKind: source?.mediaKind ?? "record",
      };
    }),
  }));
  const totalRecordCount = safeTotalRecordCount(profile);

  return {
    version: PLACE_ATLAS_TIMELINE_PROJECTION_VERSION,
    state: timeline.state,
    summaryKey: timeline.summaryKey,
    changeAssessment: "not_assessed",
    recordCount: timeline.recordCount,
    totalRecordCount,
    sampled: totalRecordCount !== null && totalRecordCount > timeline.recordCount,
    distinctPeriodCount: timeline.distinctPeriodCount,
    periods,
    oldestObservedAt: timeline.oldestObservedAt,
    latestObservedAt: timeline.latestObservedAt,
    recordingSuggestion: timeline.recordingSuggestion,
    publicationStatus: profile.publication.status,
    excluded: timeline.excluded,
  };
}
