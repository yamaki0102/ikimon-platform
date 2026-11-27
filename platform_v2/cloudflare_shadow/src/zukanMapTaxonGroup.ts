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
  if (/(?:植物|草|木|花|サクラ|桜|ソメイヨシノ|ウメ|ツバキ|ツツジ|アジサイ|タンポポ|ヤツデ|ススキ|ドングリ|イチョウ|カエデ|モミジ|ケヤキ|クスノキ|シダ|コケ|スミレ|カタバミ|シロツメクサ|ヒガンバナ|コスモス|アサガオ|ヒマワリ|オオバコ|ヨモギ|ドクダミ|ツユクサ|キンケイギク|ツルノゲイトウ|ホテイアオイ|plant)/iu.test(text)) {
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
