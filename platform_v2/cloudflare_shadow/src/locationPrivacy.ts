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

export function stripPngLocationMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a
  ) {
    return bytes;
  }
  const stripTypes = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);
  const chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const len = ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
    const totalChunk = 12 + len;
    if (offset + totalChunk > bytes.length) {
      chunks.push(bytes.slice(offset));
      break;
    }
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    if (!stripTypes.has(type)) {
      chunks.push(bytes.slice(offset, offset + totalChunk));
    }
    offset += totalChunk;
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

export function stripWebpLocationMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 12 ||
    String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!) !== "RIFF" ||
    String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) !== "WEBP"
  ) {
    return bytes;
  }
  const chunks: Uint8Array[] = [bytes.slice(0, 12)];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
    const size = (bytes[offset + 4]! | (bytes[offset + 5]! << 8) | (bytes[offset + 6]! << 16) | (bytes[offset + 7]! << 24)) >>> 0;
    const padded = size + (size % 2);
    const totalChunk = 8 + padded;
    if (offset + totalChunk > bytes.length) {
      chunks.push(bytes.slice(offset));
      break;
    }
    if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      chunks.push(bytes.slice(offset, offset + totalChunk));
    }
    offset += totalChunk;
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  const riffSize = Math.max(4, total - 8);
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >>> 8) & 0xff;
  out[6] = (riffSize >>> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  return out;
}

export function stripIsoBmffLocationMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 16) return bytes;
  const out = new Uint8Array(bytes);
  const markers = ["\u00a9xyz", "Exif", "GPS ", "udta"];
  for (const m of markers) {
    const b0 = m.charCodeAt(0) & 0xff;
    const b1 = m.charCodeAt(1) & 0xff;
    const b2 = m.charCodeAt(2) & 0xff;
    const b3 = m.charCodeAt(3) & 0xff;
    for (let i = 4; i + 8 < out.length; i += 1) {
      if (out[i] === b0 && out[i + 1] === b1 && out[i + 2] === b2 && out[i + 3] === b3) {
        const boxSize = ((out[i - 4]! << 24) | (out[i - 3]! << 16) | (out[i - 2]! << 8) | out[i - 1]!) >>> 0;
        if (boxSize >= 8 && i - 4 + boxSize <= out.length && boxSize <= 65536) {
          out[i] = 0x66; out[i + 1] = 0x72; out[i + 2] = 0x65; out[i + 3] = 0x65; // 'free'
          out.fill(0, i + 4, i - 4 + boxSize);
        }
      }
    }
  }
  return out;
}

export function stripMediaLocationMetadata(bytes: Uint8Array, mime: string): Uint8Array {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/jpeg" || m === "image/jpg") return stripJpegExifAndGpsMetadata(bytes);
  if (m === "image/png") return stripPngLocationMetadata(bytes);
  if (m === "image/webp") return stripWebpLocationMetadata(bytes);
  if (m === "image/heic" || m === "image/heif" || m === "video/mp4" || m === "video/quicktime") {
    return stripIsoBmffLocationMetadata(bytes);
  }
  return bytes;
}
