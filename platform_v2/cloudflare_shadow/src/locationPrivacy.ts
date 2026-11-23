export type LocationShareMode = "public_place" | "grid" | "hidden";

export type NearbyPublicPlace = {
  placeId: string;
  name: string;
  distanceM: number;
};

export type PublicLocationView = {
  mode: "public_place" | "grid_1km" | "grid_10km" | "delayed" | "hidden";
  publicLabel: string;
  ownerNotice: string;
  publicCell: string | null;
  gridMeters: number | null;
  placeId: string | null;
  publicDate: string;
  exactLocationExposed: false;
};

export function normalizeLocationShareMode(value: unknown): LocationShareMode {
  if (value === "public_place" || value === "hidden" || value === "grid") return value;
  return "grid";
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isNightOrEarlyMorningJst(observedAtIso: string): boolean {
  const ms = Date.parse(observedAtIso);
  if (!Number.isFinite(ms)) return false;
  const jstDate = new Date(ms + 9 * 60 * 60 * 1000);
  const hour = jstDate.getUTCHours();
  return hour >= 21 || hour < 6;
}

export function isNearDynamicHomeArea(
  lat: number,
  lng: number,
  ownerNightPoints: Array<{ lat: number; lng: number }>,
  radiusM = 300
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || ownerNightPoints.length < 2) return false;
  let nearbyNightCount = 0;
  for (const pt of ownerNightPoints) {
    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
    if (haversineMeters(lat, lng, pt.lat, pt.lng) <= radiusM) {
      nearbyNightCount += 1;
      if (nearbyNightCount >= 2) return true;
    }
  }
  return false;
}

export function formatPublicDateOnly(observedAtIso: string): string {
  const ms = Date.parse(observedAtIso);
  if (!Number.isFinite(ms)) return String(observedAtIso ?? "").slice(0, 10);
  return new Date(ms).toISOString().slice(0, 10);
}

export function isLocationDelayed24Hours(
  observedAtIso: string,
  nowMs: number,
  isPublicEventOrFixedPoint = false
): boolean {
  if (isPublicEventOrFixedPoint) return false;
  const ms = Date.parse(observedAtIso);
  if (!Number.isFinite(ms)) return false;
  return nowMs - ms < 24 * 60 * 60 * 1000;
}

export function formatGridCell(lat: number, lng: number, precision: 0.01 | 0.1): string {
  const factor = precision === 0.1 ? 10 : 100;
  const rLat = (Math.round(lat * factor) / factor).toFixed(precision === 0.1 ? 1 : 2);
  const rLng = (Math.round(lng * factor) / factor).toFixed(precision === 0.1 ? 1 : 2);
  return `cell:${rLat},${rLng}`;
}

export function computePublicLocationView(input: {
  lat: number | null;
  lng: number | null;
  observedAt: string;
  nowMs?: number;
  locationShareMode?: LocationShareMode;
  nearbyPublicPlace?: NearbyPublicPlace | null;
  isChildOrRareSpecies?: boolean;
  isPublicEventOrFixedPoint?: boolean;
  distinctAuthorsIn1kmCell?: number;
  ownerNightPoints?: Array<{ lat: number; lng: number }>;
}): PublicLocationView {
  const nowMs = input.nowMs ?? Date.now();
  const mode = input.locationShareMode ?? "grid";
  const publicDate = formatPublicDateOnly(input.observedAt);

  if (mode === "hidden" || input.lat === null || input.lng === null || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return {
      mode: "hidden",
      publicLabel: "位置は非公開です",
      ownerNotice: "位置を出さない設定です。",
      publicCell: null,
      gridMeters: null,
      placeId: null,
      publicDate,
      exactLocationExposed: false
    };
  }

  if (isNearDynamicHomeArea(input.lat, input.lng, input.ownerNightPoints ?? [], 300)) {
    return {
      mode: "hidden",
      publicLabel: "位置は非公開です",
      ownerNotice: "家のまわりなので位置を伏せました。",
      publicCell: null,
      gridMeters: null,
      placeId: null,
      publicDate,
      exactLocationExposed: false
    };
  }

  if (isLocationDelayed24Hours(input.observedAt, nowMs, Boolean(input.isPublicEventOrFixedPoint))) {
    return {
      mode: "delayed",
      publicLabel: "24時間経過後に位置を公開します",
      ownerNotice: "安全のため記録から24時間後に公開されます。",
      publicCell: null,
      gridMeters: null,
      placeId: null,
      publicDate,
      exactLocationExposed: false
    };
  }

  if (input.isChildOrRareSpecies) {
    return {
      mode: "grid_10km",
      publicLabel: "広い範囲でぼかしています（約10km）",
      ownerNotice: "子ども・希少種のため約10kmマス目で表示されます。",
      publicCell: formatGridCell(input.lat, input.lng, 0.1),
      gridMeters: 10000,
      placeId: null,
      publicDate,
      exactLocationExposed: false
    };
  }

  if ((mode === "public_place" || input.isPublicEventOrFixedPoint) && input.nearbyPublicPlace) {
    return {
      mode: "public_place",
      publicLabel: `${input.nearbyPublicPlace.name}で`,
      ownerNotice: `近くの公の場所（${input.nearbyPublicPlace.name}）に寄せて表示されます。`,
      publicCell: formatGridCell(input.lat, input.lng, 0.01),
      gridMeters: 1000,
      placeId: input.nearbyPublicPlace.placeId,
      publicDate,
      exactLocationExposed: false
    };
  }

  const authors = input.distinctAuthorsIn1kmCell ?? 1;
  if (authors < 3) {
    return {
      mode: "grid_10km",
      publicLabel: "広い範囲でぼかしています（約10km）",
      ownerNotice: "周辺の記録者が3人未満のため約10kmマス目にまとめて表示されます。",
      publicCell: formatGridCell(input.lat, input.lng, 0.1),
      gridMeters: 10000,
      placeId: null,
      publicDate,
      exactLocationExposed: false
    };
  }

  return {
    mode: "grid_1km",
    publicLabel: "位置をぼかしています（約1km）",
    ownerNotice: "約1kmのマス目で表示されます。",
    publicCell: formatGridCell(input.lat, input.lng, 0.01),
    gridMeters: 1000,
    placeId: null,
    publicDate,
    exactLocationExposed: false
  };
}

/**
 * Strips EXIF/GPS (APP1 0xFFE1) and IPTC (APP13 0xFFED) metadata segments from JPEG binaries.
 */
export function stripJpegExifAndGpsMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }

  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      chunks.push(bytes.slice(offset));
      break;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.slice(offset));
      break;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(bytes.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.length) {
      chunks.push(bytes.slice(offset));
      break;
    }
    const segLen = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (segLen < 2 || offset + 2 + segLen > bytes.length) {
      chunks.push(bytes.slice(offset));
      break;
    }
    const shouldStrip = marker === 0xe1 || marker === 0xed;
    if (!shouldStrip) {
      chunks.push(bytes.slice(offset, offset + 2 + segLen));
    }
    offset += 2 + segLen;
  }

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
