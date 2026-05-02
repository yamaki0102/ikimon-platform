/**
 * ADEAC text-list から regional_knowledge_cards の候補CSVを作る。
 *
 * 本文を丸ごと複製しない。リンク題名と出典URLを候補化し、人間レビュー後に
 * import:regional-knowledge で draft/review/approved に進める。
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type DraftCard = {
  card_id: string;
  region_scope: string;
  locale: string;
  source_type: string;
  place_hint: string;
  category: string;
  title: string;
  summary: string;
  retrieval_text: string;
  source_url: string;
  source_label: string;
  license: string;
  tags: string[];
  observation_hooks: string[];
  review_status: "draft";
  quality_score: number;
};

type AdeacTextListItem = {
  title: string;
  url: string;
  summary: string;
};

const DEFAULT_URL = "https://adeac.jp/hamamatsu-city/text-list";
const SOURCE_LABEL = "浜松市文化遺産デジタルアーカイブ テキスト一覧";

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(seed: string): string {
  return `hamamatsu-adeac-${createHash("sha1").update(seed).digest("hex").slice(0, 14)}`;
}

function inferCategory(text: string): string {
  if (/川|湖|水|浜名湖|天竜川|馬込川|佐鳴湖|港|海岸|遠州灘/.test(text)) return "water";
  if (/台地|丘|坂|山|谷|砂丘|砂地|地形|里山|森|林/.test(text)) return "landform";
  if (/田|畑|農|茶|みかん|稲|用水/.test(text)) return "agriculture";
  if (/鉄道|バス|街道|道|駅|産業|工場|商業/.test(text)) return "industry";
  if (/城|文化財|史跡|寺|神社|絵図|古文書/.test(text)) return "cultural_asset";
  if (/環境|自然|生物|緑|動植物/.test(text)) return "ecology";
  if (/災害|津波|洪水|地震/.test(text)) return "disaster_memory";
  if (/史|昔|文化誌|町史|市史|民俗|伝説/.test(text)) return "history";
  return "local_life";
}

function inferTags(text: string): string[] {
  const candidates = [
    "浜松市", "浜名湖", "天竜川", "馬込川", "佐鳴湖", "東海道", "姫街道", "奥山線",
    "城下町", "浜松城", "台地", "水辺", "農地", "里山", "砂丘", "旧道", "公園管理",
    "祭礼", "産業", "文化誌", "地名", "古地図", "暮らし",
  ];
  return candidates.filter((tag) => text.includes(tag)).slice(0, 12);
}

function inferHooks(text: string): string[] {
  const rules: Array<[RegExp, string[]]> = [
    [/川|水路|用水|低地/, ["水路沿いを見る", "湿った土を見る", "橋の下を見る", "水が集まる場所を見る"]],
    [/湖|浜名湖|佐鳴湖|湖岸/, ["湖岸の植物を見る", "水鳥の休む場所を見る", "岸辺の草丈を見る", "水際の虫を見る"]],
    [/海岸|砂丘|砂地|砂浜|遠州灘|潮風/, ["砂地の草を見る", "潮風が当たる場所を見る", "乾いた土を見る", "風で倒れた草を見る"]],
    [/台地|丘|坂|高台/, ["坂の上と下を比べる", "日当たりを見る", "乾いた土を見る", "雨水が集まる場所を見る"]],
    [/農|田|畑|茶|みかん|稲/, ["畑の縁を見る", "用水路を見る", "農道の草刈り跡を見る", "作物の周りの虫を見る"]],
    [/森|里山|林|谷|山/, ["林縁を見る", "落ち葉の厚さを見る", "木陰の湿り気を見る", "斜面の日当たりを見る"]],
    [/街道|道|鉄道|バス|駅/, ["旧道沿いを見る", "踏まれた草を見る", "舗装の隙間を見る", "街路樹の根元を見る"]],
    [/祭|行事|暮らし|民俗/, ["人が集まる場所を見る", "管理された植栽を見る", "草刈り跡を見る", "道端の踏まれ方を見る"]],
    [/公園|緑地|自然|生物/, ["草丈を見る", "草刈り跡を見る", "日当たりを見る", "花から実まで比べる"]],
  ];
  const hooks: string[] = [];
  for (const [pattern, values] of rules) {
    if (!pattern.test(text)) continue;
    for (const hook of values) {
      if (!hooks.includes(hook)) hooks.push(hook);
      if (hooks.length >= 8) return hooks;
    }
  }
  return hooks.length > 0 ? hooks : ["同じ場所を再訪する", "周りの環境も撮る", "道端の管理を見る", "季節の変化を見る"];
}

function extractTextListItems(html: string, baseUrl: string): AdeacTextListItem[] {
  const items: AdeacTextListItem[] = [];
  const rowRe = /<a\b[^>]*id=["'](textlist_rpt_title_lbn_\d+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)<a\b[^>]*id=["']textlist_rpt_update_lbn_\d+["'][^>]*>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const id = row[1] ?? "";
    const title = stripTags(row[2] ?? "");
    const summary = stripTags(row[3] ?? "");
    if (!id || !title) continue;
    items.push({
      title: title.slice(0, 160),
      summary: summary || `${title} の本文フルテキスト。`,
      url: `${baseUrl}#${id}`,
    });
  }
  if (items.length > 0) return items;

  const links: AdeacTextListItem[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = decodeHtml(match[1] ?? "").trim();
    const title = stripTags(match[2] ?? "");
    if (!href || !title || title.length < 2) continue;
    const url = new URL(href, baseUrl).toString();
    if (!url.startsWith("https://adeac.jp/hamamatsu-city/")) continue;
    if (/\/top\/?$|\/text-list\/?$|\/terms-of-use\/?$|\/guide\/?$|\/sitemap\/?$/.test(new URL(url).pathname)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title: title.slice(0, 160), summary: `${title} へのリンク。`, url });
  }
  return links;
}

function toCard(link: AdeacTextListItem, regionScope: string): DraftCard {
  const haystack = `${link.title} ${link.summary}`;
  const category = inferCategory(haystack);
  const tags = inferTags(haystack);
  const observationHooks = inferHooks(haystack);
  const summary = `${link.summary} ADEAC の候補カードとして取り込み、本文の事実確認と観察地点への接続は人間レビュー後に approved へ進めます。`;
  return {
    card_id: stableId([regionScope, link.title, link.url].join("|")),
    region_scope: regionScope,
    locale: "ja-JP",
    source_type: "official_archive",
    place_hint: tags.find((tag) => tag !== "浜松市") ?? "浜松市",
    category,
    title: link.title,
    summary: summary.slice(0, 600),
    retrieval_text: [link.title, summary, ...tags, ...observationHooks].join(" / ").slice(0, 2000),
    source_url: link.url,
    source_label: SOURCE_LABEL,
    license: "出典先の利用規定に従う",
    tags,
    observation_hooks: observationHooks,
    review_status: "draft",
    quality_score: 0.45,
  };
}

function csvCell(value: unknown): string {
  const raw = Array.isArray(value) ? value.join("、") : String(value ?? "");
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

function cardsToCsv(cards: DraftCard[]): string {
  const headers = [
    "card_id", "region_scope", "locale", "source_type", "place_hint", "category", "title", "summary",
    "retrieval_text", "source_url", "source_label", "license", "tags", "observation_hooks",
    "review_status", "quality_score",
  ] as const;
  const lines = [headers.join(",")];
  for (const card of cards) {
    lines.push(headers.map((header) => csvCell(card[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const url = typeof args["url"] === "string" ? args["url"] : DEFAULT_URL;
  const out = typeof args["out"] === "string"
    ? resolve(process.cwd(), args["out"])
    : resolve(process.cwd(), "data", "regional_knowledge", "hamamatsu_adeac_text_list_candidates.csv");
  const regionScope = typeof args["region-scope"] === "string" ? args["region-scope"] : "JP-22-Hamamatsu";
  const limit = typeof args["limit"] === "string" ? Math.max(1, Number.parseInt(args["limit"], 10)) : Infinity;
  const response = await fetch(url, { headers: { "user-agent": "ikimon.life regional knowledge candidate scraper" } });
  if (!response.ok) throw new Error(`fetch_failed:${response.status}`);
  const html = await response.text();
  const cards = extractTextListItems(html, url).slice(0, limit).map((link) => toCard(link, regionScope));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, cardsToCsv(cards), "utf-8");
  console.log(JSON.stringify({ out, fetchedFrom: url, candidates: cards.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
