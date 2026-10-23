import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  normalizeObservationDataRights,
  type ObservationDataRightsInput,
} from "./observationDataRights.js";

const LATITUDE_METERS_PER_DEGREE = 110_000;
// The small buffer keeps rounded cell centers at least 10 km apart in meters.
const GRID_METERS = 10_100;
const LATITUDE_ROW_COUNT = Math.floor(180 / (GRID_METERS / LATITUDE_METERS_PER_DEGREE));
const LATITUDE_STEP = 180 / LATITUDE_ROW_COUNT;

export type NocosilExportObservationInput = {
  id: string;
  taxon: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  /** Caller asserts this is a metadata-stripped rendition URL, never the original upload URL. */
  photoUrlIsSanitizedRendition?: boolean;
  sensitive: boolean;
  rights: ObservationDataRightsInput;
  /** Optional source labels and metadata are intentionally not projected. */
  locationLabel?: string | null;
  photoMetadata?: Record<string, unknown>;
};

export type NocosilExportPayloadInput = {
  site: { id: string; [key: string]: unknown };
  period: { start: string; end: string };
  selectedObservations: NocosilExportObservationInput[];
  /** Set only after the caller verifies the authenticated site owner. */
  locationPolicy?: { allowExactCoordinatesForOwner?: boolean };
};

export type NocosilExportLocation =
  | { precision: "unavailable" }
  | { precision: "exact" | "grid_10km"; latitude: number; longitude: number };

export type NocosilExportObservation = {
  id: string;
  taxon: string;
  date: string;
  location: NocosilExportLocation;
  photoUrl: string | null;
  observerConsent: true;
};

export type NocosilExportPayload = {
  schemaVersion: "nocosil_observation_export_v1";
  site: { id: string };
  period: { start: string; end: string };
  observations: NocosilExportObservation[];
  provenanceDigest: string;
};

function safePhotoUrl(value: string | null): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    const ipLiteral = host.replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isIP(ipLiteral)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function gridLocation(latitude: number, longitude: number): NocosilExportLocation {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { precision: "unavailable" };
  }

  const row = Math.min(LATITUDE_ROW_COUNT - 1, Math.max(0, Math.floor((latitude + 90) / LATITUDE_STEP)));
  const south = -90 + row * LATITUDE_STEP;
  const north = Math.min(90, south + LATITUDE_STEP);
  const centerLatitude = (south + north) / 2;
  const maxAbsoluteLatitude = Math.max(Math.abs(south), Math.abs(north));
  const minimumParallelCircumference = 40_075_017 * Math.cos(maxAbsoluteLatitude * Math.PI / 180);
  const longitudeBins = Math.max(1, Math.floor(minimumParallelCircumference / GRID_METERS));
  const longitudeStep = 360 / longitudeBins;
  const normalized = normalizeLongitude(longitude);
  const column = Math.min(longitudeBins - 1, Math.floor((normalized + 180) / longitudeStep));
  const centerLongitude = normalizeLongitude(-180 + (column + 0.5) * longitudeStep);

  return {
    precision: "grid_10km",
    latitude: Number(centerLatitude.toFixed(5)),
    longitude: Number(centerLongitude.toFixed(5)),
  };
}

function projectLocation(
  observation: NocosilExportObservationInput,
  allowExactCoordinatesForOwner: boolean,
): NocosilExportLocation {
  const { latitude, longitude } = observation;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude === null || longitude === null
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { precision: "unavailable" };
  }
  if (observation.sensitive && allowExactCoordinatesForOwner) {
    return { precision: "exact", latitude, longitude };
  }
  return gridLocation(latitude, longitude);
}

function digestPayload(payload: Omit<NocosilExportPayload, "provenanceDigest">): string {
  const digest = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function buildNocosilExportPayload(input: NocosilExportPayloadInput): NocosilExportPayload {
  const allowExactCoordinatesForOwner = input.locationPolicy?.allowExactCoordinatesForOwner === true;
  const observations = input.selectedObservations
    .filter((observation) => {
      const rights = normalizeObservationDataRights({
        ...observation.rights,
        visitId: observation.id,
      });
      return rights.externalExportAllowed
        && rights.consentSource === "user_selected"
        && rights.withdrawalStatus === "active";
    })
    .map((observation): NocosilExportObservation => ({
      id: observation.id,
      taxon: observation.taxon,
      date: observation.date,
      location: projectLocation(observation, allowExactCoordinatesForOwner),
      photoUrl: observation.photoUrlIsSanitizedRendition === true
        ? safePhotoUrl(observation.photoUrl)
        : null,
      observerConsent: true,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const payload = {
    schemaVersion: "nocosil_observation_export_v1" as const,
    site: { id: input.site.id },
    period: { start: input.period.start, end: input.period.end },
    observations,
  };
  return { ...payload, provenanceDigest: digestPayload(payload) };
}
