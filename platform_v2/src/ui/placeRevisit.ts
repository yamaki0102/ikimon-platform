import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { HomePlace } from "../services/readModels.js";

export function daysSinceIso(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
}

export function formatShortDate(value: string | null | undefined, locale = "ja-JP"): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function pickPlaceFocus(place: Pick<HomePlace, "nextLookFor" | "revisitReason" | "latestDisplayName">): string | null {
  const candidates = [place.nextLookFor, place.revisitReason, place.latestDisplayName];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function inferQuickCaptureState(place: Pick<HomePlace, "absenceSemantics">): string {
  if (place.absenceSemantics === "protocol_note_only" || place.absenceSemantics === "casual_note_only") {
    return "no_detection_note";
  }
  if (place.absenceSemantics === "needs_followup") {
    return "unknown";
  }
  return "present";
}

export function buildPlaceRecordHref(
  basePath: string,
  lang: SiteLang,
  viewerUserId: string | null | undefined,
  place: Pick<
    HomePlace,
    | "placeName"
    | "municipality"
    | "latitude"
    | "longitude"
    | "lastRecordMode"
    | "lastSurveyResult"
    | "revisitReason"
    | "nextLookFor"
    | "latestDisplayName"
    | "absenceSemantics"
  >,
): string {
  const params = new URLSearchParams();
  if (viewerUserId) {
    params.set("userId", viewerUserId);
  }
  params.set("localityNote", place.placeName);
  if (place.municipality) {
    params.set("municipality", place.municipality);
  }
  if (typeof place.latitude === "number" && Number.isFinite(place.latitude)) {
    params.set("latitude", String(place.latitude));
  }
  if (typeof place.longitude === "number" && Number.isFinite(place.longitude)) {
    params.set("longitude", String(place.longitude));
  }

  const focus = pickPlaceFocus(place);
  const mode = place.lastRecordMode === "survey" ? "survey" : "quick";
  params.set("recordMode", mode);

  if (mode === "survey") {
    if (focus) {
      params.set("targetTaxaScope", focus);
    }
    if (place.revisitReason) {
      params.set("revisitReason", place.revisitReason);
    } else if (focus) {
      params.set("revisitReason", focus);
    }
    if (place.lastSurveyResult === "no_detection_note") {
      params.set("surveyResult", "no_detection_note");
    }
  } else {
    params.set("quickCaptureState", inferQuickCaptureState(place));
    if (focus) {
      params.set("nextLookFor", focus);
    }
  }

  return appendLangToHref(withBasePath(basePath, `/record?${params.toString()}`), lang);
}
