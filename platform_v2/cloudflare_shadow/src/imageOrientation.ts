export type DisplayRotation = 0 | 90 | 180 | 270;

export function readJpegExifOrientation(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2) return null;
    if (marker === 0xe1 && offset + 4 + 6 <= bytes.length && String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)) === "Exif") {
      return readTiffOrientation(bytes, offset + 10, Math.min(bytes.length, offset + 2 + length));
    }
    offset += 2 + length;
  }
  return null;
}

function readTiffOrientation(bytes: Uint8Array, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  if (!little && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) return null;
  const u16 = (at: number): number => little ? bytes[at]! | (bytes[at + 1]! << 8) : (bytes[at]! << 8) | bytes[at + 1]!;
  const u32 = (at: number): number => little
    ? (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
    : ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

export function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame && offset + 9 <= bytes.length) {
      return { height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!, width: (bytes[offset + 7]! << 8) | bytes[offset + 8]! };
    }
    offset += 2 + length;
  }
  return null;
}

export function exifOrientationSwapsAxes(orientation: number | null): boolean {
  return orientation !== null && orientation >= 5 && orientation <= 8;
}

export function exifOrientationRotation(orientation: number | null): DisplayRotation {
  if (orientation === 3) return 180;
  if (orientation === 6) return 90;
  if (orientation === 8) return 270;
  return 0;
}

export function normalizeDisplayRotation(value: unknown): DisplayRotation {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  const normalized = ((Math.round(number / 90) * 90) % 360 + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

export function addDisplayRotation(current: unknown, delta: unknown): DisplayRotation {
  return normalizeDisplayRotation(normalizeDisplayRotation(current) + normalizeDisplayRotation(delta));
}

export type DerivativeOrientationPlan = { rotate: DisplayRotation; targetWidth: number; expectLandscape: boolean | null };

export function planDerivativeOrientation(input: {
  rawWidth: number;
  rawHeight: number;
  exifOrientation: number | null;
  displayRotation: unknown;
  maxWidth: number;
}): DerivativeOrientationPlan {
  const rotate = normalizeDisplayRotation(input.displayRotation);
  const swapped = exifOrientationSwapsAxes(input.exifOrientation) !== (rotate === 90 || rotate === 270);
  const finalWidth = swapped ? input.rawHeight : input.rawWidth;
  const finalHeight = swapped ? input.rawWidth : input.rawHeight;
  return {
    rotate,
    targetWidth: finalWidth > 0 ? Math.min(finalWidth, input.maxWidth) : input.maxWidth,
    expectLandscape: finalWidth === finalHeight || finalWidth <= 0 ? null : finalWidth > finalHeight,
  };
}

export function exifCorrectionRotation(input: {
  exifOrientation: number | null;
  displayRotation: unknown;
  expectLandscape: boolean | null;
  derivativeWidth: number;
  derivativeHeight: number;
}): DisplayRotation | null {
  if (input.expectLandscape === null || !exifOrientationSwapsAxes(input.exifOrientation)) return null;
  if (input.derivativeWidth === input.derivativeHeight) return null;
  if ((input.derivativeWidth > input.derivativeHeight) === input.expectLandscape) return null;
  const fix = exifOrientationRotation(input.exifOrientation);
  return fix === 0 ? null : addDisplayRotation(input.displayRotation, fix);
}

export type OrientationBackfillVerdict = "ok" | "regenerate" | "no_exif_orientation";

export function classifyOrientationBackfill(input: {
  exifOrientation: number | null;
  rawWidth: number;
  rawHeight: number;
  derivativeWidth: number;
  derivativeHeight: number;
}): OrientationBackfillVerdict {
  if (!exifOrientationSwapsAxes(input.exifOrientation)) return "no_exif_orientation";
  if (input.rawWidth === input.rawHeight || input.derivativeWidth === input.derivativeHeight) return "ok";
  const expectLandscape = input.rawHeight > input.rawWidth;
  return (input.derivativeWidth > input.derivativeHeight) === expectLandscape ? "ok" : "regenerate";
}
