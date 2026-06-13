export const GSI_STANDARD_TILE_BASE_URL = "https://cyberjapandata.gsi.go.jp/xyz/std";

const WEB_MERCATOR_MAX_LAT = 85.05112878;
const DEFAULT_TILE_SIZE = 256;
const DEFAULT_TILE_COLS = 4;
const DEFAULT_TILE_ROWS = 3;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 16;
const DEFAULT_PADDING_PX = 144;

export type GuideProgramStaticMapSpot = {
  /**
   * Public display coordinates only. Do not pass raw private observation
   * coordinates into this public static map layout.
   */
  displayLat: number;
  displayLng: number;
};

export type GuideProgramStaticMapTile = {
  zoom: number;
  x: number;
  y: number;
  url: string;
};

export type GuideProgramStaticMapPin<TSpot extends GuideProgramStaticMapSpot> = {
  spot: TSpot;
  xPct: number;
  yPct: number;
};

export type GuideProgramStaticMapLayout<TSpot extends GuideProgramStaticMapSpot> = {
  zoom: number;
  centerLat: number;
  centerLng: number;
  tileCols: number;
  tileRows: number;
  tileOriginX: number;
  tileOriginY: number;
  tiles: GuideProgramStaticMapTile[];
  pins: Array<GuideProgramStaticMapPin<TSpot>>;
};

type WorldPixel = {
  x: number;
  y: number;
};

type BuildOptions = {
  tileCols?: number;
  tileRows?: number;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  paddingPx?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteGuideProgramStaticMapSpots<TSpot extends GuideProgramStaticMapSpot>(spots: readonly TSpot[]): TSpot[] {
  return spots.filter((spot) => Number.isFinite(spot.displayLat) && Number.isFinite(spot.displayLng));
}

export function guideProgramWorldPixel(lat: number, lng: number, zoom: number, tileSize = DEFAULT_TILE_SIZE): WorldPixel {
  const clippedLat = clamp(lat, -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT);
  const clippedLng = clamp(lng, -180, 180);
  const sinLat = Math.sin(clippedLat * Math.PI / 180);
  const mapSize = tileSize * (2 ** zoom);
  return {
    x: ((clippedLng + 180) / 360) * mapSize,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * mapSize,
  };
}

export function guideProgramLngLatFromWorldPixel(pixel: WorldPixel, zoom: number, tileSize = DEFAULT_TILE_SIZE): {
  lat: number;
  lng: number;
} {
  const mapSize = tileSize * (2 ** zoom);
  const lng = (pixel.x / mapSize) * 360 - 180;
  const mercatorY = Math.PI - (2 * Math.PI * pixel.y) / mapSize;
  const lat = Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI;
  return { lat, lng };
}

function chooseStaticMapZoom<TSpot extends GuideProgramStaticMapSpot>(
  spots: readonly TSpot[],
  options: Required<Pick<BuildOptions, "tileCols" | "tileRows" | "tileSize" | "minZoom" | "maxZoom" | "paddingPx">>,
): number {
  if (spots.length <= 1) return options.maxZoom;
  const gridWidth = options.tileCols * options.tileSize;
  const gridHeight = options.tileRows * options.tileSize;
  const usableWidth = Math.max(options.tileSize, gridWidth - options.paddingPx * 2);
  const usableHeight = Math.max(options.tileSize, gridHeight - options.paddingPx * 2);

  for (let zoom = options.maxZoom; zoom >= options.minZoom; zoom -= 1) {
    const pixels = spots.map((spot) => guideProgramWorldPixel(spot.displayLat, spot.displayLng, zoom, options.tileSize));
    const xs = pixels.map((pixel) => pixel.x);
    const ys = pixels.map((pixel) => pixel.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width <= usableWidth && height <= usableHeight) return zoom;
  }
  return options.minZoom;
}

function clampTileOrigin(tileOrigin: number, zoom: number, tileSpan: number): number {
  const maxTile = (2 ** zoom) - 1;
  return clamp(tileOrigin, 0, Math.max(0, maxTile - tileSpan + 1));
}

export function buildGuideProgramStaticMapLayout<TSpot extends GuideProgramStaticMapSpot>(
  spots: readonly TSpot[],
  options: BuildOptions = {},
): GuideProgramStaticMapLayout<TSpot> | null {
  const validSpots = finiteGuideProgramStaticMapSpots(spots);
  if (!validSpots.length) return null;

  const resolved = {
    tileCols: options.tileCols ?? DEFAULT_TILE_COLS,
    tileRows: options.tileRows ?? DEFAULT_TILE_ROWS,
    tileSize: options.tileSize ?? DEFAULT_TILE_SIZE,
    minZoom: options.minZoom ?? DEFAULT_MIN_ZOOM,
    maxZoom: options.maxZoom ?? DEFAULT_MAX_ZOOM,
    paddingPx: options.paddingPx ?? DEFAULT_PADDING_PX,
  };
  const zoom = chooseStaticMapZoom(validSpots, resolved);
  const pixels = validSpots.map((spot) => guideProgramWorldPixel(spot.displayLat, spot.displayLng, zoom, resolved.tileSize));
  const xs = pixels.map((pixel) => pixel.x);
  const ys = pixels.map((pixel) => pixel.y);
  const centerPixel = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  const tileOriginX = clampTileOrigin(
    Math.round(centerPixel.x / resolved.tileSize - resolved.tileCols / 2),
    zoom,
    resolved.tileCols,
  );
  const tileOriginY = clampTileOrigin(
    Math.round(centerPixel.y / resolved.tileSize - resolved.tileRows / 2),
    zoom,
    resolved.tileRows,
  );
  const mapLeft = tileOriginX * resolved.tileSize;
  const mapTop = tileOriginY * resolved.tileSize;
  const mapWidth = resolved.tileCols * resolved.tileSize;
  const mapHeight = resolved.tileRows * resolved.tileSize;
  const tiles: GuideProgramStaticMapTile[] = [];
  const maxTile = (2 ** zoom) - 1;

  for (let row = 0; row < resolved.tileRows; row += 1) {
    for (let col = 0; col < resolved.tileCols; col += 1) {
      const x = clamp(tileOriginX + col, 0, maxTile);
      const y = clamp(tileOriginY + row, 0, maxTile);
      tiles.push({
        zoom,
        x,
        y,
        url: `${GSI_STANDARD_TILE_BASE_URL}/${zoom}/${x}/${y}.png`,
      });
    }
  }

  const centerLngLat = guideProgramLngLatFromWorldPixel(centerPixel, zoom, resolved.tileSize);
  return {
    zoom,
    centerLat: centerLngLat.lat,
    centerLng: centerLngLat.lng,
    tileCols: resolved.tileCols,
    tileRows: resolved.tileRows,
    tileOriginX,
    tileOriginY,
    tiles,
    pins: validSpots.map((spot, index) => {
      const pixel = pixels[index]!;
      return {
        spot,
        xPct: clamp(((pixel.x - mapLeft) / mapWidth) * 100, 0, 100),
        yPct: clamp(((pixel.y - mapTop) / mapHeight) * 100, 0, 100),
      };
    }),
  };
}
