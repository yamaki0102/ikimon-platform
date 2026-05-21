export type InferredCoordinateLocality = {
  countryCode: string;
  countryLabelJa: string;
  prefecture: string | null;
};

type Bbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type PrefectureBox = Bbox & {
  prefecture: string;
};

type CountryBox = Bbox & {
  code: string;
  labelJa: string;
};

const JP_PREFECTURE_BOXES: PrefectureBox[] = [
  { prefecture: "北海道", minLat: 41.2, maxLat: 45.6, minLng: 139.3, maxLng: 145.9 },
  { prefecture: "青森県", minLat: 40.2, maxLat: 41.6, minLng: 139.5, maxLng: 141.7 },
  { prefecture: "岩手県", minLat: 38.7, maxLat: 40.5, minLng: 140.6, maxLng: 142.1 },
  { prefecture: "宮城県", minLat: 37.8, maxLat: 38.9, minLng: 140.3, maxLng: 141.7 },
  { prefecture: "秋田県", minLat: 38.8, maxLat: 40.6, minLng: 139.7, maxLng: 140.9 },
  { prefecture: "山形県", minLat: 37.7, maxLat: 39.2, minLng: 139.5, maxLng: 140.7 },
  { prefecture: "福島県", minLat: 36.8, maxLat: 38.0, minLng: 139.1, maxLng: 141.1 },
  { prefecture: "茨城県", minLat: 35.7, maxLat: 37.0, minLng: 139.6, maxLng: 140.9 },
  { prefecture: "栃木県", minLat: 36.2, maxLat: 37.2, minLng: 139.3, maxLng: 140.3 },
  { prefecture: "群馬県", minLat: 35.9, maxLat: 37.1, minLng: 138.4, maxLng: 139.7 },
  { prefecture: "埼玉県", minLat: 35.7, maxLat: 36.3, minLng: 138.7, maxLng: 139.9 },
  { prefecture: "千葉県", minLat: 34.8, maxLat: 36.2, minLng: 139.7, maxLng: 140.9 },
  { prefecture: "東京都", minLat: 35.45, maxLat: 35.9, minLng: 138.9, maxLng: 140.0 },
  { prefecture: "神奈川県", minLat: 35.1, maxLat: 35.7, minLng: 138.9, maxLng: 139.85 },
  { prefecture: "新潟県", minLat: 36.7, maxLat: 38.6, minLng: 137.6, maxLng: 139.9 },
  { prefecture: "富山県", minLat: 36.25, maxLat: 37.0, minLng: 136.75, maxLng: 137.8 },
  { prefecture: "石川県", minLat: 36.0, maxLat: 37.9, minLng: 136.2, maxLng: 137.4 },
  { prefecture: "福井県", minLat: 35.3, maxLat: 36.3, minLng: 135.4, maxLng: 136.9 },
  { prefecture: "山梨県", minLat: 35.15, maxLat: 36.0, minLng: 138.2, maxLng: 139.2 },
  { prefecture: "長野県", minLat: 35.2, maxLat: 37.05, minLng: 137.3, maxLng: 138.8 },
  { prefecture: "岐阜県", minLat: 35.1, maxLat: 36.5, minLng: 136.25, maxLng: 137.65 },
  { prefecture: "静岡県", minLat: 34.55, maxLat: 35.4, minLng: 137.45, maxLng: 139.2 },
  { prefecture: "愛知県", minLat: 34.55, maxLat: 35.45, minLng: 136.65, maxLng: 137.85 },
  { prefecture: "三重県", minLat: 33.7, maxLat: 35.3, minLng: 135.85, maxLng: 136.98 },
  { prefecture: "滋賀県", minLat: 34.75, maxLat: 35.75, minLng: 135.75, maxLng: 136.45 },
  { prefecture: "京都府", minLat: 34.7, maxLat: 35.8, minLng: 135.0, maxLng: 136.05 },
  { prefecture: "大阪府", minLat: 34.25, maxLat: 35.05, minLng: 135.05, maxLng: 135.75 },
  { prefecture: "兵庫県", minLat: 34.15, maxLat: 35.75, minLng: 134.25, maxLng: 135.55 },
  { prefecture: "奈良県", minLat: 33.85, maxLat: 34.85, minLng: 135.55, maxLng: 136.25 },
  { prefecture: "和歌山県", minLat: 33.4, maxLat: 34.4, minLng: 135.0, maxLng: 136.05 },
  { prefecture: "鳥取県", minLat: 35.05, maxLat: 35.65, minLng: 133.1, maxLng: 134.55 },
  { prefecture: "島根県", minLat: 34.3, maxLat: 36.4, minLng: 131.65, maxLng: 133.4 },
  { prefecture: "岡山県", minLat: 34.25, maxLat: 35.4, minLng: 133.25, maxLng: 134.4 },
  { prefecture: "広島県", minLat: 34.0, maxLat: 35.1, minLng: 132.0, maxLng: 133.5 },
  { prefecture: "山口県", minLat: 33.7, maxLat: 34.8, minLng: 130.75, maxLng: 132.5 },
  { prefecture: "徳島県", minLat: 33.5, maxLat: 34.35, minLng: 133.55, maxLng: 134.85 },
  { prefecture: "香川県", minLat: 34.0, maxLat: 34.65, minLng: 133.45, maxLng: 134.45 },
  { prefecture: "愛媛県", minLat: 32.8, maxLat: 34.35, minLng: 132.0, maxLng: 133.7 },
  { prefecture: "高知県", minLat: 32.7, maxLat: 33.95, minLng: 132.45, maxLng: 134.35 },
  { prefecture: "福岡県", minLat: 33.0, maxLat: 34.3, minLng: 130.0, maxLng: 131.3 },
  { prefecture: "佐賀県", minLat: 32.9, maxLat: 33.65, minLng: 129.75, maxLng: 130.55 },
  { prefecture: "長崎県", minLat: 31.95, maxLat: 34.75, minLng: 128.1, maxLng: 130.4 },
  { prefecture: "熊本県", minLat: 32.0, maxLat: 33.3, minLng: 130.25, maxLng: 131.35 },
  { prefecture: "大分県", minLat: 32.7, maxLat: 33.75, minLng: 130.8, maxLng: 132.1 },
  { prefecture: "宮崎県", minLat: 31.35, maxLat: 32.9, minLng: 130.65, maxLng: 132.0 },
  { prefecture: "鹿児島県", minLat: 27.0, maxLat: 32.3, minLng: 128.3, maxLng: 131.3 },
  { prefecture: "沖縄県", minLat: 24.0, maxLat: 27.2, minLng: 122.9, maxLng: 131.4 },
];

const COUNTRY_BOXES: CountryBox[] = [
  { code: "JP", labelJa: "日本", minLat: 24.0, maxLat: 45.7, minLng: 122.9, maxLng: 146.1 },
  { code: "KR", labelJa: "韓国", minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 131.9 },
  { code: "TW", labelJa: "台湾", minLat: 21.8, maxLat: 25.4, minLng: 119.3, maxLng: 122.1 },
  { code: "CN", labelJa: "中国", minLat: 18.0, maxLat: 53.6, minLng: 73.0, maxLng: 135.2 },
  { code: "TH", labelJa: "タイ", minLat: 5.5, maxLat: 20.8, minLng: 97.0, maxLng: 106.0 },
  { code: "VN", labelJa: "ベトナム", minLat: 8.0, maxLat: 23.6, minLng: 102.0, maxLng: 110.0 },
  { code: "PH", labelJa: "フィリピン", minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 },
  { code: "ID", labelJa: "インドネシア", minLat: -11.5, maxLat: 6.5, minLng: 94.0, maxLng: 142.5 },
  { code: "MY", labelJa: "マレーシア", minLat: 0.8, maxLat: 7.5, minLng: 99.5, maxLng: 119.5 },
  { code: "SG", labelJa: "シンガポール", minLat: 1.1, maxLat: 1.6, minLng: 103.5, maxLng: 104.1 },
  { code: "IN", labelJa: "インド", minLat: 6.5, maxLat: 35.7, minLng: 68.0, maxLng: 97.5 },
  { code: "AU", labelJa: "オーストラリア", minLat: -44.0, maxLat: -10.0, minLng: 112.0, maxLng: 154.0 },
  { code: "NZ", labelJa: "ニュージーランド", minLat: -48.0, maxLat: -34.0, minLng: 166.0, maxLng: 179.9 },
  { code: "US", labelJa: "アメリカ合衆国", minLat: 24.0, maxLat: 49.5, minLng: -125.0, maxLng: -66.0 },
  { code: "US", labelJa: "アメリカ合衆国", minLat: 18.8, maxLat: 22.4, minLng: -161.0, maxLng: -154.5 },
  { code: "US", labelJa: "アメリカ合衆国", minLat: 51.0, maxLat: 72.0, minLng: -170.0, maxLng: -129.0 },
  { code: "CA", labelJa: "カナダ", minLat: 41.5, maxLat: 83.5, minLng: -141.0, maxLng: -52.0 },
  { code: "MX", labelJa: "メキシコ", minLat: 14.0, maxLat: 33.5, minLng: -118.5, maxLng: -86.0 },
  { code: "BR", labelJa: "ブラジル", minLat: -34.0, maxLat: 5.5, minLng: -74.0, maxLng: -34.0 },
  { code: "GB", labelJa: "イギリス", minLat: 49.5, maxLat: 60.9, minLng: -8.7, maxLng: 2.0 },
  { code: "IE", labelJa: "アイルランド", minLat: 51.3, maxLat: 55.5, minLng: -10.7, maxLng: -5.3 },
  { code: "FR", labelJa: "フランス", minLat: 41.0, maxLat: 51.5, minLng: -5.5, maxLng: 9.8 },
  { code: "ES", labelJa: "スペイン", minLat: 35.8, maxLat: 43.9, minLng: -9.5, maxLng: 4.5 },
  { code: "PT", labelJa: "ポルトガル", minLat: 36.8, maxLat: 42.3, minLng: -9.7, maxLng: -6.0 },
  { code: "DE", labelJa: "ドイツ", minLat: 47.2, maxLat: 55.1, minLng: 5.8, maxLng: 15.1 },
  { code: "IT", labelJa: "イタリア", minLat: 35.0, maxLat: 47.2, minLng: 6.0, maxLng: 19.0 },
  { code: "NL", labelJa: "オランダ", minLat: 50.7, maxLat: 53.7, minLng: 3.2, maxLng: 7.3 },
  { code: "CH", labelJa: "スイス", minLat: 45.7, maxLat: 47.9, minLng: 5.8, maxLng: 10.6 },
  { code: "SE", labelJa: "スウェーデン", minLat: 55.0, maxLat: 69.2, minLng: 10.5, maxLng: 24.5 },
  { code: "NO", labelJa: "ノルウェー", minLat: 57.5, maxLat: 71.5, minLng: 4.0, maxLng: 31.5 },
  { code: "ZA", labelJa: "南アフリカ", minLat: -35.0, maxLat: -22.0, minLng: 16.0, maxLng: 33.5 },
];

const COUNTRY_NAME_TO_CODE = new Map<string, string>([
  ["jp", "JP"], ["jpn", "JP"], ["japan", "JP"], ["日本", "JP"],
  ["kr", "KR"], ["kor", "KR"], ["korea", "KR"], ["south korea", "KR"], ["韓国", "KR"],
  ["tw", "TW"], ["twn", "TW"], ["taiwan", "TW"], ["台湾", "TW"],
  ["cn", "CN"], ["chn", "CN"], ["china", "CN"], ["中国", "CN"],
  ["us", "US"], ["usa", "US"], ["united states", "US"], ["united states of america", "US"], ["アメリカ", "US"], ["アメリカ合衆国", "US"],
  ["gb", "GB"], ["uk", "GB"], ["united kingdom", "GB"], ["イギリス", "GB"], ["英国", "GB"],
  ["fr", "FR"], ["france", "FR"], ["フランス", "FR"],
  ["au", "AU"], ["aus", "AU"], ["australia", "AU"], ["オーストラリア", "AU"],
  ["nz", "NZ"], ["new zealand", "NZ"], ["ニュージーランド", "NZ"],
]);

function isFiniteLatLng(lat: number | null | undefined, lng: number | null | undefined): lat is number {
  return typeof lat === "number" && Number.isFinite(lat)
    && typeof lng === "number" && Number.isFinite(lng)
    && !(lat === 0 && lng === 0);
}

function contains(box: Bbox, lat: number, lng: number): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

function area(box: Bbox): number {
  return (box.maxLat - box.minLat) * (box.maxLng - box.minLng);
}

export function normalizeCountryCode(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return COUNTRY_NAME_TO_CODE.get(raw.toLowerCase()) ?? COUNTRY_NAME_TO_CODE.get(raw) ?? null;
}

export function countryLabelJaFromCode(code: string | null | undefined): string | null {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return null;
  const box = COUNTRY_BOXES.find((item) => item.code === normalized);
  if (box) return box.labelJa;
  return normalized;
}

export function inferCoordinateLocality(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): InferredCoordinateLocality | null {
  if (!isFiniteLatLng(latitude, longitude)) return null;
  const lat = latitude;
  const lng = longitude as number;
  const prefecture = JP_PREFECTURE_BOXES
    .filter((box) => contains(box, lat, lng))
    .sort((left, right) => area(left) - area(right))[0]?.prefecture ?? null;
  if (prefecture) {
    return { countryCode: "JP", countryLabelJa: "日本", prefecture };
  }
  const country = COUNTRY_BOXES
    .filter((box) => contains(box, lat, lng))
    .sort((left, right) => area(left) - area(right))[0];
  if (!country) {
    return { countryCode: "ZZ", countryLabelJa: "海外", prefecture: null };
  }
  return {
    countryCode: country.code,
    countryLabelJa: country.labelJa,
    prefecture: null,
  };
}
