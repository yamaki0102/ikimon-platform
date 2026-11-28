export type RegionSlugLevel = "country" | "pref" | "city" | "ward";

export type RegionSlugEntry = {
  slug: string;
  level: RegionSlugLevel;
  code: string;
  parent_slug: string | null;
  name_ja: string;
  valid_from: string;
  valid_to: string | null;
  successors?: string[];
};

const SINCE = "1970-01-01";

const prefs: Array<[string, string, string]> = [
  ["01", "hokkaido", "北海道"], ["02", "aomori", "青森県"], ["03", "iwate", "岩手県"], ["04", "miyagi", "宮城県"], ["05", "akita", "秋田県"],
  ["06", "yamagata", "山形県"], ["07", "fukushima", "福島県"], ["08", "ibaraki", "茨城県"], ["09", "tochigi", "栃木県"], ["10", "gunma", "群馬県"],
  ["11", "saitama", "埼玉県"], ["12", "chiba", "千葉県"], ["13", "tokyo", "東京都"], ["14", "kanagawa", "神奈川県"], ["15", "niigata", "新潟県"],
  ["16", "toyama", "富山県"], ["17", "ishikawa", "石川県"], ["18", "fukui", "福井県"], ["19", "yamanashi", "山梨県"], ["20", "nagano", "長野県"],
  ["21", "gifu", "岐阜県"], ["22", "shizuoka", "静岡県"], ["23", "aichi", "愛知県"], ["24", "mie", "三重県"], ["25", "shiga", "滋賀県"],
  ["26", "kyoto", "京都府"], ["27", "osaka", "大阪府"], ["28", "hyogo", "兵庫県"], ["29", "nara", "奈良県"], ["30", "wakayama", "和歌山県"],
  ["31", "tottori", "鳥取県"], ["32", "shimane", "島根県"], ["33", "okayama", "岡山県"], ["34", "hiroshima", "広島県"], ["35", "yamaguchi", "山口県"],
  ["36", "tokushima", "徳島県"], ["37", "kagawa", "香川県"], ["38", "ehime", "愛媛県"], ["39", "kochi", "高知県"], ["40", "fukuoka", "福岡県"],
  ["41", "saga", "佐賀県"], ["42", "nagasaki", "長崎県"], ["43", "kumamoto", "熊本県"], ["44", "oita", "大分県"], ["45", "miyazaki", "宮崎県"],
  ["46", "kagoshima", "鹿児島県"], ["47", "okinawa", "沖縄県"],
];

const shizuokaCities: Array<[string, string, string]> = [
  ["22100", "shizuoka", "静岡市"], ["22130", "hamamatsu", "浜松市"], ["22203", "numazu", "沼津市"], ["22205", "atami", "熱海市"],
  ["22206", "mishima", "三島市"], ["22207", "fujinomiya", "富士宮市"], ["22208", "ito", "伊東市"], ["22209", "shimada", "島田市"],
  ["22210", "fuji", "富士市"], ["22211", "iwata", "磐田市"], ["22212", "yaizu", "焼津市"], ["22213", "kakegawa", "掛川市"],
  ["22214", "fujieda", "藤枝市"], ["22215", "gotemba", "御殿場市"], ["22216", "fukuroi", "袋井市"], ["22219", "shimoda", "下田市"],
  ["22220", "susono", "裾野市"], ["22221", "kosai", "湖西市"], ["22222", "izu", "伊豆市"], ["22223", "omaezaki", "御前崎市"],
  ["22224", "kikugawa", "菊川市"], ["22225", "izunokuni", "伊豆の国市"], ["22226", "makinohara", "牧之原市"], ["22301", "higashiizu", "東伊豆町"],
  ["22302", "kawazu", "河津町"], ["22304", "minamiizu", "南伊豆町"], ["22305", "matsuzaki", "松崎町"], ["22306", "nishiizu", "西伊豆町"],
  ["22325", "kannami", "函南町"], ["22341", "shimizu-cho", "清水町"], ["22342", "nagaizumi", "長泉町"], ["22344", "oyama", "小山町"],
  ["22424", "yoshida", "吉田町"], ["22429", "kawanehon", "川根本町"], ["22461", "mori", "森町"],
];

const HAMA_NEW = "2024-01-01";
const HAMA_OLD_TO = "2023-12-31";
const hc = "shizuoka/hamamatsu/chuo";
const hh = "shizuoka/hamamatsu/hamana";

export const REGION_SLUG_ENTRIES: RegionSlugEntry[] = [
  { slug: "jp", level: "country", code: "JP", parent_slug: null, name_ja: "日本", valid_from: SINCE, valid_to: null },
  ...prefs.map(([code, slug, name_ja]): RegionSlugEntry => ({ slug, level: "pref", code, parent_slug: "jp", name_ja, valid_from: SINCE, valid_to: null })),
  ...shizuokaCities.map(([code, slug, name_ja]): RegionSlugEntry => ({ slug, level: "city", code, parent_slug: "shizuoka", name_ja, valid_from: SINCE, valid_to: null })),
  { slug: "aoi", level: "ward", code: "22101", parent_slug: "shizuoka/shizuoka", name_ja: "葵区", valid_from: SINCE, valid_to: null },
  { slug: "suruga", level: "ward", code: "22102", parent_slug: "shizuoka/shizuoka", name_ja: "駿河区", valid_from: SINCE, valid_to: null },
  { slug: "shimizu", level: "ward", code: "22103", parent_slug: "shizuoka/shizuoka", name_ja: "清水区", valid_from: SINCE, valid_to: null },
  { slug: "chuo", level: "ward", code: "22138", parent_slug: "shizuoka/hamamatsu", name_ja: "中央区", valid_from: HAMA_NEW, valid_to: null },
  { slug: "hamana", level: "ward", code: "22139", parent_slug: "shizuoka/hamamatsu", name_ja: "浜名区", valid_from: HAMA_NEW, valid_to: null },
  { slug: "tenryu", level: "ward", code: "22137", parent_slug: "shizuoka/hamamatsu", name_ja: "天竜区", valid_from: SINCE, valid_to: HAMA_OLD_TO },
  { slug: "tenryu", level: "ward", code: "22140", parent_slug: "shizuoka/hamamatsu", name_ja: "天竜区", valid_from: HAMA_NEW, valid_to: null },
  { slug: "naka", level: "ward", code: "22131", parent_slug: "shizuoka/hamamatsu", name_ja: "中区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hc] },
  { slug: "higashi", level: "ward", code: "22132", parent_slug: "shizuoka/hamamatsu", name_ja: "東区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hc] },
  { slug: "nishi", level: "ward", code: "22133", parent_slug: "shizuoka/hamamatsu", name_ja: "西区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hc] },
  { slug: "minami", level: "ward", code: "22134", parent_slug: "shizuoka/hamamatsu", name_ja: "南区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hc] },
  { slug: "kita", level: "ward", code: "22135", parent_slug: "shizuoka/hamamatsu", name_ja: "北区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hc, hh] },
  { slug: "hamakita", level: "ward", code: "22136", parent_slug: "shizuoka/hamamatsu", name_ja: "浜北区", valid_from: SINCE, valid_to: HAMA_OLD_TO, successors: [hh] },
];
