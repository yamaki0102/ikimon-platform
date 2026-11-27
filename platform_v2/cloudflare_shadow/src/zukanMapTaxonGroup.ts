import { isWeakTaxonLabel } from "./taxonNameResolver";

export const MAP_TAXON_GROUP_FILTERS = new Set([
  "bird",
  "insect",
  "plant",
  "amphibian_reptile",
  "mammal",
  "fungi",
  "other",
]);

export function parseMapTaxonGroupFilter(raw: string | null): string | null {
  const normalized = (raw ?? "").trim().toLowerCase();
  return MAP_TAXON_GROUP_FILTERS.has(normalized) ? normalized : null;
}

export function inferTaxonGroupForLabel(label: string | null, storedGroup?: string | null): string {
  const stored = (storedGroup ?? "").trim().toLowerCase();
  if (stored && stored !== "other" && MAP_TAXON_GROUP_FILTERS.has(stored)) {
    return stored;
  }
  if (isWeakTaxonLabel(label)) return "other";
  const text = label ?? "";
  if (/(?:鳥|bird|aves|スズメ|ヒヨドリ|メジロ|カワセミ|カラス|ツバメ|ハト|シジュウカラ|ムクドリ|ツグミ|ウグイス|モズ|コゲラ|サギ|カモ|トビ|ウミネコ|カモメ|ガビチョウ|ソウシチョウ|ヤンバルクイナ)/iu.test(text)) {
    return "bird";
  }
  if (/(?:昆虫|虫|蝶|蜂|チョウ|アゲハ|トンボ|ヤンマ|バッタ|セミ|カブト|クワガタ|カマキリ|ハチ|アリ|テントウ|ホタル|コオロギ|キリギリス|カメムシ|コガネムシ|ダンゴムシ|insect)/iu.test(text)) {
    return "insect";
  }
  if (/(?:植物|草|木|花|サクラ|ザクラ|桜|ギク|ゴケ|カズラ|ノイバラ|ソメイヨシノ|ウメ|ツバキ|ツツジ|アジサイ|タンポポ|ヤツデ|ススキ|ドングリ|イチョウ|カエデ|モミジ|ケヤキ|クスノキ|シダ|コケ|スミレ|カタバミ|シロツメクサ|ヒガンバナ|コスモス|アサガオ|ヒマワリ|オオバコ|ヨモギ|ドクダミ|ツユクサ|キンケイギク|ツルノゲイトウ|ホテイアオイ|plant)/iu.test(text)) {
    return "plant";
  }
  if (/(?:菌|キノコ|きのこ|カビ|fung)/iu.test(text)) {
    return "fungi";
  }
  if (/(?:蛙|カエル|蛇|ヘビ|トカゲ|ヤモリ|イモリ|カメ|亀|爬虫|両生|amphibian|reptile)/iu.test(text)) {
    return "amphibian_reptile";
  }
  if (/(?:獣|哺乳|mammal|タヌキ|キツネ|リス|イノシシ|シカ|ウサギ|コウモリ|ハクビシン|アライグマ|ヌートリア)/iu.test(text)) {
    return "mammal";
  }
  return "other";
}

type GroupDb = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }> } } };

export async function resolveTaxonGroups(db: GroupDb, names: readonly string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(names.filter((n) => n && !isWeakTaxonLabel(n)))];
  const stored = new Map<string, Map<string, number>>();
  const add = (name: unknown, group: unknown, n: unknown): void => {
    const g = String(group ?? "").trim().toLowerCase();
    if (typeof name !== "string" || !g || g === "other" || g === "generic" || !MAP_TAXON_GROUP_FILTERS.has(g)) return;
    const m = stored.get(name) ?? new Map<string, number>();
    m.set(g, (m.get(g) ?? 0) + (Number(n) || 1));
    stored.set(name, m);
  };
  for (let i = 0; i < uniq.length; i += 80) {
    const chunk = uniq.slice(i, i + 80);
    const ph = chunk.map((_, k) => `?${k + 1}`).join(",");
    try {
      const r = await db.prepare(`SELECT display_name AS name, taxon_group AS grp, COUNT(*) AS n FROM public_map_snapshot_records_v1 WHERE display_name IN (${ph}) GROUP BY display_name, taxon_group`).bind(...chunk).all<{ name: string; grp: string; n: number }>();
      for (const row of r.results ?? []) add(row.name, row.grp, row.n);
    } catch { /* table absent */ }
    try {
      const r = await db.prepare(`SELECT canonical_name AS name, taxon_group AS grp FROM species_reader_layers WHERE canonical_name IN (${ph})`).bind(...chunk).all<{ name: string; grp: string }>();
      for (const row of r.results ?? []) add(row.name, row.grp, 1);
    } catch { /* table absent */ }
  }
  const out = new Map<string, string>();
  for (const name of uniq) {
    const m = stored.get(name);
    const best = m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : null;
    out.set(name, inferTaxonGroupForLabel(name, best));
  }
  return out;
}
