import { __test__ as placeAtlas } from "./placeAtlasContract.js";

export interface PlaceYearState {
  place: string | null;
  year: number | null;
  map: boolean;
  record: string | null;
}

const PLACE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,159}$/u;
const RECORD_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/u;

export function isValidPlaceYearPlace(value: string): boolean {
  if (PLACE_RE.test(value)) return true;
  if (value.startsWith("cell:") && value.length <= 133) {
    return placeAtlas.isValidPublicCellId(value.slice(5)) || placeAtlas.isValidPublicCellId(value);
  }
  return false;
}

export function parsePlaceYearYear(value: string | null | undefined, currentYear = new Date().getUTCFullYear()): number | null {
  if (!value || !/^\d{4}$/u.test(value)) return null;
  const year = Number(value);
  return year >= 1900 && year <= currentYear ? year : null;
}

export function parsePlaceYearState(url: URL, currentYear = new Date().getUTCFullYear()): PlaceYearState {
  const place = url.searchParams.get("place");
  const record = url.searchParams.get("record");
  return {
    place: place && isValidPlaceYearPlace(place) ? place : null,
    year: parsePlaceYearYear(url.searchParams.get("year"), currentYear),
    map: url.searchParams.get("map") === "1",
    record: record && RECORD_RE.test(record) ? record : null,
  };
}

export function buildPlaceYearHref(base: string, state: Partial<PlaceYearState>, lang: string): string {
  const params: string[] = [];
  if (state.place && isValidPlaceYearPlace(state.place)) params.push(`place=${encodeURIComponent(state.place)}`);
  if (state.year != null && parsePlaceYearYear(String(state.year))) params.push(`year=${state.year}`);
  if (state.map) params.push("map=1");
  if (state.record && RECORD_RE.test(state.record)) params.push(`record=${encodeURIComponent(state.record)}`);
  return `${base.replace(/\/+$/u, "")}/${lang}/${params.length ? `?${params.join("&")}` : ""}`;
}
