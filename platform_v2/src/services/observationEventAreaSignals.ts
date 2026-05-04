import { haversineMeters } from "./observationEventAreaGeometry.js";
import type { ObservationField } from "./observationFieldRegistry.js";

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type AreaLocalSignalPark = {
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  source: "osm_park" | "field_osm_park";
};

export type AreaLocalSignalRoad = {
  name: string;
  kind: string;
  distanceM: number;
};

export interface AreaLocalSignals {
  parks: AreaLocalSignalPark[];
  footwayCount: number;
  majorRoads: AreaLocalSignalRoad[];
  greenHints: string[];
  warnings: string[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAJOR_ROADS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);
const FOOTWAYS = new Set(["footway", "path", "pedestrian", "steps", "living_street", "cycleway"]);
const GREEN_LANDUSE = new Set(["grass", "meadow", "forest", "recreation_ground", "village_green"]);
const GREEN_NATURAL = new Set(["wood", "tree_row", "scrub", "grassland", "wetland", "water"]);
const GREEN_LEISURE = new Set(["park", "garden", "nature_reserve", "playground"]);

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function elementCenter(element: OverpassElement): { lat: number; lng: number } | null {
  const lat = element.center?.lat ?? element.lat;
  const lng = element.center?.lon ?? element.lon;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

function elementName(element: OverpassElement, fallback: string): string {
  const tags = element.tags ?? {};
  return tags.name || tags["name:ja"] || fallback;
}

function parkFromField(field: ObservationField, lat: number, lng: number): AreaLocalSignalPark | null {
  const layer = field.adminLevel ?? field.source;
  if (layer !== "osm_park" && field.source !== "osm_park") return null;
  if (!Number.isFinite(field.lat) || !Number.isFinite(field.lng)) return null;
  return {
    name: field.name,
    lat: field.lat,
    lng: field.lng,
    distanceM: Math.round(haversineMeters(lat, lng, field.lat, field.lng)),
    source: "field_osm_park",
  };
}

export function summarizeAreaLocalSignals(input: {
  center: { lat: number; lng: number };
  elements?: OverpassElement[];
  nearbyFields?: ObservationField[];
}): AreaLocalSignals {
  const { lat, lng } = input.center;
  const parks: AreaLocalSignalPark[] = [];
  const majorRoads: AreaLocalSignalRoad[] = [];
  const greenHints: string[] = [];
  let footwayCount = 0;

  for (const field of input.nearbyFields ?? []) {
    const park = parkFromField(field, lat, lng);
    if (park) parks.push(park);
  }

  for (const element of input.elements ?? []) {
    const tags = element.tags ?? {};
    const center = elementCenter(element);
    const distanceM = center ? Math.round(haversineMeters(lat, lng, center.lat, center.lng)) : null;
    const leisure = tags.leisure;
    const highway = tags.highway;
    const landuse = tags.landuse;
    const natural = tags.natural;

    if (leisure && GREEN_LEISURE.has(leisure) && center && distanceM !== null) {
      parks.push({
        name: elementName(element, "OSMの公園・緑地"),
        lat: center.lat,
        lng: center.lng,
        distanceM,
        source: "osm_park",
      });
      greenHints.push(leisure === "park" ? "公園" : "緑地");
    }

    if (highway && FOOTWAYS.has(highway)) footwayCount += 1;

    if (highway && MAJOR_ROADS.has(highway) && center && distanceM !== null) {
      majorRoads.push({
        name: elementName(element, "太い道路"),
        kind: highway,
        distanceM,
      });
    }

    if (landuse && GREEN_LANDUSE.has(landuse)) greenHints.push(landuse);
    if (natural && GREEN_NATURAL.has(natural)) greenHints.push(natural);
  }

  const warnings: string[] = [];
  if (majorRoads.length > 0) warnings.push("太い道路の横断が必要なら範囲を分けてください。");

  parks.sort((a, b) => a.distanceM - b.distanceM);
  majorRoads.sort((a, b) => a.distanceM - b.distanceM);

  return {
    parks: parks.slice(0, 5),
    footwayCount,
    majorRoads: majorRoads.slice(0, 5),
    greenHints: uniq(greenHints).slice(0, 8),
    warnings,
  };
}

function buildOverpassQuery(lat: number, lng: number): string {
  return `
[out:json][timeout:6];
(
  way(around:500,${lat},${lng})["leisure"~"^(park|garden|nature_reserve|playground)$"];
  relation(around:500,${lat},${lng})["leisure"~"^(park|garden|nature_reserve|playground)$"];
  way(around:350,${lat},${lng})["highway"~"^(footway|path|pedestrian|steps|living_street|cycleway)$"];
  way(around:350,${lat},${lng})["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"];
  way(around:350,${lat},${lng})["natural"];
  way(around:350,${lat},${lng})["landuse"~"^(grass|meadow|forest|recreation_ground|village_green)$"];
);
out tags center 80;
`;
}

async function fetchOverpassAreaSignals(lat: number, lng: number, signal: AbortSignal): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(buildOverpassQuery(lat, lng)),
    signal,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as { elements?: OverpassElement[] };
  return json.elements ?? [];
}

export async function getAreaLocalSignals(input: {
  center: { lat: number; lng: number };
  nearbyFields?: ObservationField[];
}): Promise<AreaLocalSignals> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 6500);
  try {
    const elements = await fetchOverpassAreaSignals(input.center.lat, input.center.lng, ac.signal).catch(() => []);
    return summarizeAreaLocalSignals({ center: input.center, elements, nearbyFields: input.nearbyFields });
  } finally {
    clearTimeout(timeout);
  }
}

export const __test__ = {
  buildOverpassQuery,
  summarizeAreaLocalSignals,
};
