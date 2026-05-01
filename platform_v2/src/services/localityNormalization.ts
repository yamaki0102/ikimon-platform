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
  if (raw === "静岡県") return raw;
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
  return raw;
}

function prefectureFromMunicipalityLikeValue(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const k = key(raw);
  if (k === "shizuoka" || k === "shizuoka prefecture" || raw === "静岡県") {
    return "静岡県";
  }
  return null;
}

function inBox(input: LocalityInput, box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): boolean {
  if (!hasUsableObservationCoordinates(input.latitude, input.longitude)) return false;
  const lat = input.latitude as number;
  const lng = input.longitude as number;
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

function inferByCoordinate(input: LocalityInput): NormalizedObservationLocality | null {
  if (inBox(input, { minLat: 34.55, maxLat: 35.32, minLng: 137.45, maxLng: 138.08 })) {
    return { prefecture: "静岡県", municipality: "浜松市" };
  }
  if (inBox(input, { minLat: 34.82, maxLat: 35.36, minLng: 138.15, maxLng: 138.72 })) {
    return { prefecture: "静岡県", municipality: "静岡市" };
  }
  return null;
}

export function normalizeObservationLocality(input: LocalityInput): NormalizedObservationLocality {
  const inferred = inferByCoordinate(input);
  const prefecture = normalizePrefecture(input.prefecture)
    ?? prefectureFromMunicipalityLikeValue(input.municipality)
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
