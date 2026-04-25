/**
 * Minimal geohash encoder — no runtime deps.
 * Only encodes (lat, lng) → base32 string. Precision 7 ≈ 152m × 152m.
 */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let isLng = true;
  let bit = 4;
  let charIdx = 0;
  let result = "";

  while (result.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        charIdx = (charIdx << 1) | 1;
        minLng = mid;
      } else {
        charIdx = charIdx << 1;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        charIdx = (charIdx << 1) | 1;
        minLat = mid;
      } else {
        charIdx = charIdx << 1;
        maxLat = mid;
      }
    }
    isLng = !isLng;
    if (bit === 0) {
      result += BASE32[charIdx];
      charIdx = 0;
      bit = 4;
    } else {
      bit -= 1;
    }
  }
  return result;
}
