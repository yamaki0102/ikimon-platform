import { readFileSync } from "node:fs";

export type InvasiveSpeciesCategory = "iaspecified" | "priority" | "industrial" | "prevention" | "native" | string;

export type InvasiveSpeciesAction =
  | "report_only"
  | "observe_and_report"
  | "do_not_handle"
  | "observe_only"
  | string;

type SeedRecord = {
  scientific_name: string;
  vernacular_name: string;
  rank: string;
  mhlw_category: InvasiveSpeciesCategory;
  recommended_action: InvasiveSpeciesAction;
  action_basis: string;
  legal_warning: string;
  regional_caveat: string;
  source_url: string;
};

export type InvasiveSpeciesCatalogItem = {
  slug: string;
  scientificName: string;
  vernacularName: string;
  rank: string;
  category: InvasiveSpeciesCategory;
  categoryLabel: string;
  recommendedAction: InvasiveSpeciesAction;
  actionLabel: string;
  actionBasis: string;
  legalWarning: string;
  regionalCaveat: string;
  sourceUrl: string;
  groupLabel: string;
};

const seedUrl = new URL("../../db/seeds/invasive_species_seed.ja.json", import.meta.url);

export const INVASIVE_SPECIES_LIST_PATH = "/learn/invasive-species";

export const INVASIVE_SPECIES_OFFICIAL_SOURCES = [
  {
    label: "環境省 特定外来生物等一覧",
    href: "https://www.env.go.jp/nature/intro/2outline/list.html",
  },
  {
    label: "環境省 生態系被害防止外来種リスト",
    href: "https://www.env.go.jp/nature/intro/2outline/iaslist.html",
  },
  {
    label: "環境省 外来生物法の説明",
    href: "https://www.env.go.jp/nature/intro/1law/outline.html",
  },
] as const;

const FEATURED_NAMES = new Set([
  "オオキンケイギク",
  "ナガエツルノゲイトウ",
  "ヒアリ",
  "ヌートリア",
]);

function slugFromScientificName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryLabel(category: InvasiveSpeciesCategory): string {
  switch (category) {
    case "iaspecified":
      return "特定外来生物";
    case "priority":
      return "重点対策外来種";
    case "industrial":
      return "産業管理外来種";
    case "prevention":
      return "生態系被害防止外来種";
    case "native":
      return "在来扱い";
    default:
      return "外来種";
  }
}

function actionLabel(action: InvasiveSpeciesAction): string {
  switch (action) {
    case "do_not_handle":
      return "触らない";
    case "report_only":
      return "見つけたら相談・通報";
    case "observe_and_report":
      return "観察して情報提供";
    case "observe_only":
      return "観察記録を残す";
    default:
      return "自治体や管理者に確認";
  }
}

function groupLabel(record: SeedRecord): string {
  const text = `${record.action_basis} ${record.vernacular_name} ${record.scientific_name}`;
  if (/哺乳類/u.test(text)) return "哺乳類";
  if (/鳥類/u.test(text)) return "鳥類";
  if (/爬虫類/u.test(text)) return "爬虫類";
  if (/両生類/u.test(text)) return "両生類";
  if (/魚類/u.test(text)) return "魚類";
  if (/甲殻類/u.test(text)) return "甲殻類";
  if (/クモ/u.test(text)) return "クモ類";
  if (/昆虫/u.test(text)) return "昆虫";
  if (/浮葉|水田|水路|水草/u.test(text)) return "水草・水辺の植物";
  if (/植物/u.test(text)) return "植物";
  return "その他";
}

function toCatalogItem(record: SeedRecord): InvasiveSpeciesCatalogItem {
  return {
    slug: slugFromScientificName(record.scientific_name),
    scientificName: record.scientific_name,
    vernacularName: record.vernacular_name,
    rank: record.rank,
    category: record.mhlw_category,
    categoryLabel: categoryLabel(record.mhlw_category),
    recommendedAction: record.recommended_action,
    actionLabel: actionLabel(record.recommended_action),
    actionBasis: record.action_basis,
    legalWarning: record.legal_warning,
    regionalCaveat: record.regional_caveat,
    sourceUrl: record.source_url,
    groupLabel: groupLabel(record),
  };
}

function loadCatalog(): InvasiveSpeciesCatalogItem[] {
  const raw = readFileSync(seedUrl, "utf8");
  const parsed = JSON.parse(raw) as SeedRecord[];
  return parsed
    .map(toCatalogItem)
    .sort((left, right) =>
      left.groupLabel.localeCompare(right.groupLabel, "ja") ||
      left.vernacularName.localeCompare(right.vernacularName, "ja"),
    );
}

const catalog = loadCatalog();
const bySlug = new Map(catalog.map((item) => [item.slug, item]));
const byName = new Map(catalog.map((item) => [item.vernacularName, item]));

export function listInvasiveSpecies(): InvasiveSpeciesCatalogItem[] {
  return [...catalog];
}

export function findInvasiveSpeciesBySlug(slug: string): InvasiveSpeciesCatalogItem | null {
  return bySlug.get(slug) ?? null;
}

export function findInvasiveSpeciesByName(name: string): InvasiveSpeciesCatalogItem | null {
  return byName.get(name) ?? null;
}

export function invasiveSpeciesDetailPath(item: Pick<InvasiveSpeciesCatalogItem, "slug">): string {
  return `${INVASIVE_SPECIES_LIST_PATH}/${encodeURIComponent(item.slug)}`;
}

export function listFeaturedInvasiveSpecies(): InvasiveSpeciesCatalogItem[] {
  return listInvasiveSpecies().filter((item) => FEATURED_NAMES.has(item.vernacularName));
}
