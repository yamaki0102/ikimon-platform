const EARTH_RADIUS_M = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;

export type PublicLocalityScope = "municipality" | "prefecture" | "blurred";
export type PublicLocationDisplayMode = "area";

export type PublicCellKeyParts = {
  gridM: number;
  cellX: number;
  cellY: number;
};

export type PublicLocationSummary = {
  label: string;
  scope: PublicLocalityScope;
  cellId: string | null;
  gridM: number | null;
  radiusM: number | null;
  centroidLat: number | null;
  centroidLng: number | null;
  displayMode: PublicLocationDisplayMode;
};

export type PublicCellGeometry = {
  ring: [number, number][];
  centroidLat: number;
  centroidLng: number;
  bounds: [number, number, number, number];
};

type PublicLocalityInput = {
  municipality?: string | null;
  prefecture?: string | null;
};

function normalizeLocalityValue(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed !== "" ? trimmed : null;
}

function clampMercatorLatitude(lat: number): number {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
}

function mercatorXFromLng(lng: number): number {
  return EARTH_RADIUS_M * (lng * Math.PI / 180);
}

function mercatorYFromLat(lat: number): number {
  const clamped = clampMercatorLatitude(lat);
  return EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI / 360)));
}

function lngFromMercatorX(x: number): number {
  return (x / EARTH_RADIUS_M) * 180 / Math.PI;
}

function latFromMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) * 180 / Math.PI;
}

export function pickPublicGridMeters(zoom?: number): number {
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return 3000;
  if (zoom >= 13) return 1000;
  if (zoom >= 10) return 3000;
  return 10000;
}

export function maxZoomForGrid(gridM: number): number {
  if (!Number.isFinite(gridM) || gridM <= 1000) return 13.2;
  if (gridM <= 3000) return 11.8;
  return 10.1;
}

export function resolvePublicLocalityLabel(input: PublicLocalityInput): {
  label: string;
  scope: PublicLocalityScope;
} {
  const municipality = normalizeLocalityValue(input.municipality);
  if (municipality) return { label: municipality, scope: "municipality" };
  const prefecture = normalizeLocalityValue(input.prefecture);
  if (prefecture) return { label: prefecture, scope: "prefecture" };
  return { label: "位置をぼかしています", scope: "blurred" };
}

export function summarizePublicLocalitySet(inputs: PublicLocalityInput[]): {
  label: string;
  scope: PublicLocalityScope;
} {
  const municipalities = new Set<string>();
  const prefectures = new Set<string>();

  for (const input of inputs) {
    const municipality = normalizeLocalityValue(input.municipality);
    const prefecture = normalizeLocalityValue(input.prefecture);
    if (municipality) municipalities.add(municipality);
    if (prefecture) prefectures.add(prefecture);
  }

  if (municipalities.size === 1) {
    return { label: Array.from(municipalities)[0]!, scope: "municipality" };
  }
  if (municipalities.size > 1 && prefectures.size === 1) {
    return { label: Array.from(prefectures)[0]!, scope: "prefecture" };
  }
  if (municipalities.size === 0 && prefectures.size === 1) {
    return { label: Array.from(prefectures)[0]!, scope: "prefecture" };
  }
  return { label: "位置をぼかしています", scope: "blurred" };
}

export function buildPublicCellKeyParts(lat: number, lng: number, gridM: number): PublicCellKeyParts {
  const x = mercatorXFromLng(lng);
  const y = mercatorYFromLat(lat);
  return {
    gridM,
    cellX: Math.floor(x / gridM),
    cellY: Math.floor(y / gridM),
  };
}

export function formatPublicCellId(parts: PublicCellKeyParts): string {
  return `${parts.gridM}:${parts.cellX}:${parts.cellY}`;
}

export function buildPublicCellId(lat: number, lng: number, gridM: number): string {
  return formatPublicCellId(buildPublicCellKeyParts(lat, lng, gridM));
}

export function parsePublicCellId(cellId: string): PublicCellKeyParts | null {
  const match = /^(\d+):(-?\d+):(-?\d+)$/.exec(String(cellId).trim());
  if (!match) return null;
  const gridM = Number(match[1]);
  const cellX = Number(match[2]);
  const cellY = Number(match[3]);
  if (!Number.isFinite(gridM) || !Number.isFinite(cellX) || !Number.isFinite(cellY)) return null;
  return { gridM, cellX, cellY };
}

export function radiusForGrid(gridM: number): number {
  return Math.round((Math.sqrt(2) * gridM) / 2);
}

export function buildPublicCellGeometry(parts: PublicCellKeyParts): PublicCellGeometry {
  const minX = parts.cellX * parts.gridM;
  const minY = parts.cellY * parts.gridM;
  const maxX = minX + parts.gridM;
  const maxY = minY + parts.gridM;
  const ring: [number, number][] = [
    [lngFromMercatorX(minX), latFromMercatorY(minY)],
    [lngFromMercatorX(maxX), latFromMercatorY(minY)],
    [lngFromMercatorX(maxX), latFromMercatorY(maxY)],
    [lngFromMercatorX(minX), latFromMercatorY(maxY)],
    [lngFromMercatorX(minX), latFromMercatorY(minY)],
  ];
  return {
    ring,
    centroidLng: lngFromMercatorX(minX + parts.gridM / 2),
    centroidLat: latFromMercatorY(minY + parts.gridM / 2),
    bounds: [
      lngFromMercatorX(minX),
      latFromMercatorY(minY),
      lngFromMercatorX(maxX),
      latFromMercatorY(maxY),
    ],
  };
}

export function buildPublicLocationSummary(input: PublicLocalityInput & {
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number;
  gridM?: number;
}): PublicLocationSummary {
  const locality = resolvePublicLocalityLabel(input);
  const latitude = typeof input.latitude === "number" && Number.isFinite(input.latitude) ? input.latitude : null;
  const longitude = typeof input.longitude === "number" && Number.isFinite(input.longitude) ? input.longitude : null;

  if (latitude === null || longitude === null) {
    return {
      label: locality.label,
      scope: locality.scope,
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    };
  }

  const gridM = input.gridM ?? pickPublicGridMeters(input.zoom);
  const cellParts = buildPublicCellKeyParts(latitude, longitude, gridM);
  const geometry = buildPublicCellGeometry(cellParts);

  return {
    label: locality.label,
    scope: locality.scope,
    cellId: formatPublicCellId(cellParts),
    gridM,
    radiusM: radiusForGrid(gridM),
    centroidLat: geometry.centroidLat,
    centroidLng: geometry.centroidLng,
    displayMode: "area",
  };
}

export function buildPublicMapCellHref(baseMapHref: string, location: PublicLocationSummary | null | undefined): string {
  if (!location?.cellId) return baseMapHref;
  const canCenter =
    typeof location.centroidLat === "number" &&
    Number.isFinite(location.centroidLat) &&
    typeof location.centroidLng === "number" &&
    Number.isFinite(location.centroidLng);

  const relative = new URL(baseMapHref, "https://ikimon.local");
  relative.searchParams.set("cell", location.cellId);
  if (canCenter) {
    relative.searchParams.set("lat", location.centroidLat!.toFixed(4));
    relative.searchParams.set("lng", location.centroidLng!.toFixed(4));
  }
  if (typeof location.gridM === "number" && Number.isFinite(location.gridM)) {
    relative.searchParams.set("z", maxZoomForGrid(location.gridM).toFixed(1));
  }
  return `${relative.pathname}${relative.search}${relative.hash}`;
}
