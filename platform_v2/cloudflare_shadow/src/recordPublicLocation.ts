import { haversineMeters, isLocationDelayed24Hours } from "./locationPrivacy.js";

export type LocationProtection = "none" | "coarse" | "withhold";
export type WithheldReason = "hidden" | "delayed" | "unparseable" | "protected_withhold";

export type PublicLocationDisclosure =
  | {
      status: "point";
      cell: string;
      gridDeg: 0.01 | 0.1;
      gridMeters: 1000 | 10000;
      centerLat: number;
      centerLng: number;
      radiusM: number;
      radiusLabelJa: string;
      coarsenedByProtection: boolean;
    }
  | { status: "withheld"; reason: WithheldReason };

const RADIUS_TIERS_M = [100, 250, 500, 800, 1500, 3000, 5000, 8000, 12000, 20000, 50000, 100000] as const;

export function cellGridDeg(publicCell: string): 0.01 | 0.1 | null {
  const raw = publicCell.replace(/^cell:/, "");
  const [latRaw, lngRaw] = raw.split(",");
  if (latRaw === undefined || lngRaw === undefined || !Number.isFinite(Number(latRaw)) || !Number.isFinite(Number(lngRaw))) return null;
  return /^-?\d+\.\d$/.test(latRaw.trim()) ? 0.1 : 0.01;
}

export function publicRadiusM(centerLat: number, centerLng: number, gridDeg: number): number {
  const half = gridDeg / 2;
  const farthest = Math.max(
    haversineMeters(centerLat, centerLng, centerLat + half, centerLng + half),
    haversineMeters(centerLat, centerLng, centerLat + half, centerLng - half),
    haversineMeters(centerLat, centerLng, centerLat - half, centerLng + half),
    haversineMeters(centerLat, centerLng, centerLat - half, centerLng - half),
  );
  return RADIUS_TIERS_M.find((tier) => tier >= farthest) ?? RADIUS_TIERS_M[RADIUS_TIERS_M.length - 1]!;
}

export function radiusLabelJa(radiusM: number): string {
  const km = radiusM / 1000;
  return `およそ半径${Number.isInteger(km) ? km : Number(km.toFixed(1))}km`;
}

export function disclosePublicLocation(input: {
  publicCell: string | null | undefined;
  observedAt: string;
  nowMs: number;
  protection?: LocationProtection;
}): PublicLocationDisclosure {
  const protection = input.protection ?? "none";
  const cell = (input.publicCell ?? "").trim();
  if (!cell || cell === "hidden") return { status: "withheld", reason: "hidden" };
  if (isLocationDelayed24Hours(input.observedAt, input.nowMs)) return { status: "withheld", reason: "delayed" };
  const grid = cellGridDeg(cell);
  const [latRaw, lngRaw] = cell.replace(/^cell:/, "").split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!grid || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { status: "withheld", reason: "unparseable" };
  if (protection === "withhold") return { status: "withheld", reason: "protected_withhold" };
  let gridDeg: 0.01 | 0.1 = grid;
  let centerLat = lat;
  let centerLng = lng;
  let coarsened = false;
  if (protection === "coarse" && grid === 0.01) {
    gridDeg = 0.1;
    centerLat = Math.round(lat * 10) / 10;
    centerLng = Math.round(lng * 10) / 10;
    coarsened = true;
  }
  const radiusM = publicRadiusM(centerLat, centerLng, gridDeg);
  return {
    status: "point",
    cell: `cell:${centerLat.toFixed(gridDeg === 0.1 ? 1 : 2)},${centerLng.toFixed(gridDeg === 0.1 ? 1 : 2)}`,
    gridDeg,
    gridMeters: gridDeg === 0.1 ? 10000 : 1000,
    centerLat: Number(centerLat.toFixed(gridDeg === 0.1 ? 1 : 2)),
    centerLng: Number(centerLng.toFixed(gridDeg === 0.1 ? 1 : 2)),
    radiusM,
    radiusLabelJa: radiusLabelJa(radiusM),
    coarsenedByProtection: coarsened,
  };
}

export function publicDateJst(observedAt: string): string | null {
  const text = (observedAt ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
