export type JisMeshCodes = {
  mesh1km: string | null;
  mesh250m: string | null;
};

const MIN_LAT = 0;
const MAX_LAT_EXCLUSIVE = 200 / 3;
const MIN_LNG = 100;
const MAX_LNG_EXCLUSIVE = 180;

function inJisMeshRange(lat: number, lng: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= MIN_LAT
    && lat < MAX_LAT_EXCLUSIVE
    && lng >= MIN_LNG
    && lng < MAX_LNG_EXCLUSIVE;
}

function quadrantCode(latIndex: number, lngIndex: number): string {
  return String(latIndex * 2 + lngIndex + 1);
}

export function encodeJisMesh1km(lat: number, lng: number): string | null {
  if (!inJisMeshRange(lat, lng)) return null;

  const latMinutes = lat * 60;
  const lngDegrees = Math.floor(lng);
  const lngMinutesWithinDegree = (lng - lngDegrees) * 60;

  const firstLat = Math.floor(latMinutes / 40);
  const firstLng = lngDegrees - 100;
  const latMinutesAfterFirst = latMinutes - firstLat * 40;

  const secondLat = Math.floor(latMinutesAfterFirst / 5);
  const secondLng = Math.floor(lngMinutesWithinDegree / 7.5);
  const latMinutesAfterSecond = latMinutesAfterFirst - secondLat * 5;
  const lngMinutesAfterSecond = lngMinutesWithinDegree - secondLng * 7.5;

  const thirdLat = Math.floor(latMinutesAfterSecond / 0.5);
  const thirdLng = Math.floor(lngMinutesAfterSecond / 0.75);

  return [
    String(firstLat).padStart(2, "0"),
    String(firstLng).padStart(2, "0"),
    String(secondLat),
    String(secondLng),
    String(thirdLat),
    String(thirdLng),
  ].join("");
}

export function encodeJisMesh250m(lat: number, lng: number): string | null {
  const mesh1km = encodeJisMesh1km(lat, lng);
  if (!mesh1km) return null;

  const latMinutes = lat * 60;
  const lngDegrees = Math.floor(lng);
  const lngMinutesWithinDegree = (lng - lngDegrees) * 60;

  const firstLat = Math.floor(latMinutes / 40);
  const latMinutesAfterFirst = latMinutes - firstLat * 40;
  const secondLat = Math.floor(latMinutesAfterFirst / 5);
  const secondLng = Math.floor(lngMinutesWithinDegree / 7.5);
  const latMinutesAfterSecond = latMinutesAfterFirst - secondLat * 5;
  const lngMinutesAfterSecond = lngMinutesWithinDegree - secondLng * 7.5;
  const thirdLat = Math.floor(latMinutesAfterSecond / 0.5);
  const thirdLng = Math.floor(lngMinutesAfterSecond / 0.75);

  const latMinutesAfterThird = latMinutesAfterSecond - thirdLat * 0.5;
  const lngMinutesAfterThird = lngMinutesAfterSecond - thirdLng * 0.75;

  const halfLat = Math.min(1, Math.max(0, Math.floor(latMinutesAfterThird / 0.25)));
  const halfLng = Math.min(1, Math.max(0, Math.floor(lngMinutesAfterThird / 0.375)));
  const halfCode = quadrantCode(halfLat, halfLng);

  const latMinutesAfterHalf = latMinutesAfterThird - halfLat * 0.25;
  const lngMinutesAfterHalf = lngMinutesAfterThird - halfLng * 0.375;

  const quarterLat = Math.min(1, Math.max(0, Math.floor(latMinutesAfterHalf / 0.125)));
  const quarterLng = Math.min(1, Math.max(0, Math.floor(lngMinutesAfterHalf / 0.1875)));
  const quarterCode = quadrantCode(quarterLat, quarterLng);

  return `${mesh1km}${halfCode}${quarterCode}`;
}

export function encodeJisMeshCodes(lat: number, lng: number): JisMeshCodes {
  return {
    mesh1km: encodeJisMesh1km(lat, lng),
    mesh250m: encodeJisMesh250m(lat, lng),
  };
}
