import { inferCoordinateLocality, normalizeCountryCode } from "./coordinateLocality.js";

export type NormalizedObservationLocality = {
  prefecture: string | null;
  municipality: string | null;
};

type LocalityInput = {
  prefecture?: string | null;
  municipality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function hasUsableObservationCoordinates(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  return typeof latitude === "number"
    && typeof longitude === "number"
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && !(latitude === 0 && longitude === 0);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

function key(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―ー−]/g, "-")
    .replace(/\s+/g, " ");
}

function normalizePrefecture(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const k = key(raw);
  if (k === "shizuoka" || k === "shizuoka prefecture" || raw === "静岡") return "静岡県";
  if (k === "okinawa" || k === "okinawa prefecture" || raw === "沖縄") return "沖縄県";
  if (raw === "静岡県") return raw;
  if (raw === "沖縄県") return raw;
  return raw;
}

function normalizeMunicipality(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const k = key(raw);
  if (k === "hamamatsu" || k === "hamamatsu city" || k === "hamamatsu-shi" || raw === "浜松") {
    return "浜松市";
  }
  if (k === "shizuoka city" || k === "shizuoka-shi" || raw === "静岡") {
    return "静岡市";
  }
  if (k === "shizuoka" || k === "shizuoka prefecture" || raw === "静岡県") {
    return null;
  }
  if (k === "okinawa" || k === "okinawa prefecture" || raw === "沖縄県") {
    return null;
  }
  if (k === "naha" || k === "naha city" || k === "naha-shi" || raw === "那覇") {
    return "那覇市";
  }
  if (k === "okinawa city" || k === "okinawa-shi" || raw === "沖縄") {
    return "沖縄市";
  }
  return raw;
}

function prefectureFromMunicipalityLikeValue(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const k = key(raw);
  if (
    k === "hamamatsu" ||
    k === "hamamatsu city" ||
    k === "hamamatsu-shi" ||
    raw === "浜松" ||
    raw.startsWith("浜松市")
  ) {
    return "静岡県";
  }
  if (
    k === "shizuoka city" ||
    k === "shizuoka-shi" ||
    raw === "静岡" ||
    raw.startsWith("静岡市")
  ) {
    return "静岡県";
  }
  if (k === "shizuoka" || k === "shizuoka prefecture" || raw === "静岡県") {
    return "静岡県";
  }
  if (
    k === "naha" ||
    k === "naha city" ||
    k === "naha-shi" ||
    raw === "那覇" ||
    raw.startsWith("那覇市") ||
    k === "okinawa city" ||
    k === "okinawa-shi" ||
    raw.startsWith("沖縄市")
  ) {
    return "沖縄県";
  }
  if (k === "okinawa" || k === "okinawa prefecture" || raw === "沖縄県") {
    return "沖縄県";
  }
  return null;
}

function inferByCoordinate(input: LocalityInput): NormalizedObservationLocality | null {
  const inferred = inferCoordinateLocality(input.latitude, input.longitude);
  if (inferred?.countryCode === "JP") {
    return { prefecture: inferred.prefecture, municipality: null };
  }
  return null;
}

export function normalizeObservationLocality(input: LocalityInput): NormalizedObservationLocality {
  const inferred = inferByCoordinate(input);
  const municipalityPrefecture = prefectureFromMunicipalityLikeValue(input.municipality);
  const prefecture = municipalityPrefecture
    ?? normalizePrefecture(input.prefecture)
    ?? inferred?.prefecture
    ?? null;
  const municipality = normalizeMunicipality(input.municipality)
    ?? inferred?.municipality
    ?? null;

  return {
    prefecture,
    municipality,
  };
}

export function normalizeObservationCountry(
  country: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
): string {
  const explicit = normalizeCountryCode(country);
  if (explicit) return explicit;
  const inferred = inferCoordinateLocality(latitude, longitude)?.countryCode;
  return inferred ?? "JP";
}
