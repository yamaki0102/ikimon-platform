export const INVASIVE_TAXON_GROUP = "invasive";
export const INVASIVE_LEGAL_NOTE = "持ち帰らない・動かさない";
export const INVASIVE_LEARN_PATH = "/ja/learn/invasive-species";

export type InvasiveCategory = "iaspecified" | "conditional" | "priority" | "prevention";
export type InvasiveClassification = { category: InvasiveCategory; label: string; learnSlug: string };
export type InvasiveItemInfo = { category: InvasiveCategory; label: string; legalNote: string; learnHref: string };

const CATEGORY_LABELS: Readonly<Record<InvasiveCategory, string>> = {
  iaspecified: "特定外来生物",
  conditional: "条件付特定外来生物",
  priority: "重点対策外来種",
  prevention: "生態系被害防止外来種",
};

const CONDITIONAL_NAMES: ReadonlySet<string> = new Set(["アメリカザリガニ", "ミシシッピアカミミガメ"]);

const ALIASES: Readonly<Record<string, string>> = {
  "アカミミガメ": "ミシシッピアカミミガメ",
  "ブラックバス": "オオクチバス",
};

const SEED_ROWS: ReadonlyArray<readonly [string, "iaspecified" | "priority" | "prevention", string]> = [
  ["アライグマ", "iaspecified", "procyon-lotor"],
  ["ヌートリア", "iaspecified", "myocastor-coypus"],
  ["ガビチョウ", "iaspecified", "garrulax-canorus"],
  ["ソウシチョウ", "iaspecified", "leiothrix-lutea"],
  ["カミツキガメ", "iaspecified", "chelydra-serpentina"],
  ["ウシガエル", "iaspecified", "lithobates-catesbeianus"],
  ["アメリカザリガニ", "iaspecified", "procambarus-clarkii"],
  ["ミシシッピアカミミガメ", "iaspecified", "trachemys-scripta-elegans"],
  ["オオクチバス", "iaspecified", "micropterus-salmoides"],
  ["カダヤシ", "iaspecified", "gambusia-affinis"],
  ["ヒアリ", "iaspecified", "solenopsis-invicta"],
  ["アルゼンチンアリ", "iaspecified", "linepithema-humile"],
  ["セアカゴケグモ", "iaspecified", "latrodectus-hasseltii"],
  ["オオキンケイギク", "iaspecified", "coreopsis-lanceolata"],
  ["ナガエツルノゲイトウ", "iaspecified", "alternanthera-philoxeroides"],
  ["ボタンウキクサ", "iaspecified", "pistia-stratiotes"],
  ["セイヨウオオマルハナバチ", "iaspecified", "bombus-terrestris"],
  ["セイヨウタンポポ", "priority", "taraxacum-officinale"],
  ["セイタカアワダチソウ", "priority", "solidago-canadensis"],
  ["アレチウリ", "priority", "sicyos-angulatus"],
  ["ハルジオン", "priority", "erigeron-philadelphicus"],
  ["ヒメジョオン", "priority", "erigeron-annuus"],
  ["オオハンゴンソウ", "iaspecified", "rudbeckia-laciniata"],
  ["ホテイアオイ", "priority", "eichhornia-crassipes"],
  ["ノハカタカラクサ", "priority", "tradescantia-fluminensis"],
  ["ハクビシン", "prevention", "paguma-larvata"],
];

const BY_NAME: ReadonlyMap<string, InvasiveClassification> = new Map(
  SEED_ROWS.map(([name, seedCategory, learnSlug]) => {
    const category: InvasiveCategory = CONDITIONAL_NAMES.has(name) ? "conditional" : seedCategory;
    return [name, { category, label: CATEGORY_LABELS[category], learnSlug }] as const;
  }),
);

export const INVASIVE_SEED_ROWS = SEED_ROWS;

export function classifyInvasive(label: string | null | undefined): InvasiveClassification | null {
  if (typeof label !== "string") return null;
  const name = label.normalize("NFKC").trim();
  if (!name) return null;
  const hit = BY_NAME.get(Object.hasOwn(ALIASES, name) ? ALIASES[name]! : name);
  return hit ? { ...hit } : null;
}

export function invasiveItemInfo(label: string | null | undefined): InvasiveItemInfo | null {
  const hit = classifyInvasive(label);
  if (!hit) return null;
  return {
    category: hit.category,
    label: hit.label,
    legalNote: INVASIVE_LEGAL_NOTE,
    learnHref: `${INVASIVE_LEARN_PATH}/${hit.learnSlug}`,
  };
}

export function filterInvasiveRows<T extends { taxon_label: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((row) => classifyInvasive(row.taxon_label) !== null);
}

export function decorateInvasiveItem<T extends object>(item: T, label: string | null | undefined): T | (T & { invasive: InvasiveItemInfo }) {
  const info = invasiveItemInfo(label);
  return info ? { ...item, invasive: info } : item;
}

export function invasiveCellExtras(group: readonly unknown[], active: boolean): { invasiveCount?: number } {
  return active ? { invasiveCount: group.length } : {};
}

const MAP_HTML_PATH = /^(?:\/(?:ja|en|es|pt-br))?\/map\/?$/u;

export function isMapHtmlPath(pathname: string): boolean {
  return MAP_HTML_PATH.test(pathname);
}

export function injectMapInvasiveMarker(html: string, enabled: boolean): string {
  if (!enabled) return html;
  const index = html.search(/<body(?=[\s>])/u);
  if (index < 0) return html;
  return `${html.slice(0, index)}<body data-map-invasive="1"${html.slice(index + 5)}`;
}
