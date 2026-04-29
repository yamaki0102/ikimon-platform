/**
 * ADEAC / 自治体資料のCSV/JSONから、観察フック候補つき regional_knowledge_cards draft を作る。
 * DBには書かない。人間がレビューして approved に変えた JSON を import:regional-knowledge に渡す。
 *
 * 使い方:
 *   npx tsx src/scripts/draftRegionalKnowledgeHooks.ts --file=source.csv --out=drafts.json
 *   REGIONAL_HOOK_DRAFT_PROVIDER=gemini npx tsx src/scripts/draftRegionalKnowledgeHooks.ts --file=source.json --out=drafts.json
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";

type RawRecord = Record<string, unknown>;

type DraftCard = {
  card_id: string;
  region_scope: string;
  locale: string;
  source_type: string;
  place_hint: string;
  category: string;
  title: string;
  summary: string;
  source_url: string;
  source_label: string;
  license: string;
  tags: string[];
  observation_hooks: string[];
  review_status: "draft";
  quality_score: number;
  metadata: Record<string, unknown>;
};

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function compact(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
}

function firstString(record: RawRecord, keys: string[]): string {
  for (const key of keys) {
    const value = compact(record[key]);
    if (value) return value;
    const found = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (found) {
      const v = compact(record[found]);
      if (v) return v;
    }
  }
  return "";
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).slice(0, 24);
  const raw = compact(value);
  if (!raw) return [];
  return raw.split(/[;,、，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 24);
}

function parseCsv(text: string): RawRecord[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (quoted) {
      if (ch === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === "\"") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  row.push(field);
  rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function recordsFromFile(filePath: string): RawRecord[] {
  const raw = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  if (extname(filePath).toLowerCase() === ".csv") return parseCsv(raw);
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed.filter((item): item is RawRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj["cards"])) return obj["cards"] as RawRecord[];
    if (Array.isArray(obj["data"])) return obj["data"] as RawRecord[];
    return [obj as RawRecord];
  }
  return [];
}

function stableId(seed: string): string {
  return `regional-${createHash("sha1").update(seed).digest("hex").slice(0, 16)}`;
}

function inferCategory(text: string): string {
  if (/川|湖|池|水|湿|港|海岸|遠州灘|浜名湖|天竜川|馬込川|佐鳴湖/.test(text)) return "water";
  if (/台地|丘|坂|山|谷|砂丘|砂地|地形|森|里山|林/.test(text)) return "landform";
  if (/田|畑|農|茶|みかん|稲/.test(text)) return "agriculture";
  if (/鉄道|バス|街道|工場|産業|港/.test(text)) return "industry";
  if (/城|文化財|史跡|社寺|寺|神社/.test(text)) return "cultural_asset";
  if (/環境|自然|生物|緑|湖岸|水辺/.test(text)) return "ecology";
  if (/計画|政策|条例/.test(text)) return "policy";
  if (/史|昔|今昔|古文書|絵図/.test(text)) return "history";
  return "local_life";
}

const LOCAL_HOOK_RULES: Array<{ pattern: RegExp; hooks: string[] }> = [
  { pattern: /川|水路|流れ|低地|デルタ/, hooks: ["水路沿いを見る", "湿った土を見る", "橋の下を見る", "水が集まる場所を見る"] },
  { pattern: /湖|湖岸|浜名湖|佐鳴湖|入り江/, hooks: ["湖岸の植物を見る", "水鳥の休む場所を見る", "岸辺の草丈を見る", "水際の虫を見る"] },
  { pattern: /海岸|砂丘|砂地|砂浜|遠州灘|潮風/, hooks: ["砂地の草を見る", "潮風が当たる場所を見る", "乾いた土を見る", "風で倒れた草を見る"] },
  { pattern: /台地|丘|坂|高台|段差/, hooks: ["坂の上と下を比べる", "日当たりを見る", "乾いた土を見る", "雨水が集まる場所を見る"] },
  { pattern: /農|田|畑|稲|みかん|茶/, hooks: ["畑の縁を見る", "用水路を見る", "農道の草刈り跡を見る", "作物の周りの虫を見る"] },
  { pattern: /森|里山|林|谷|山/, hooks: ["林縁を見る", "落ち葉の厚さを見る", "木陰の湿り気を見る", "斜面の日当たりを見る"] },
  { pattern: /街道|道|鉄道|バス|駅|交通/, hooks: ["旧道沿いを見る", "踏まれた草を見る", "舗装の隙間を見る", "街路樹の根元を見る"] },
  { pattern: /祭|歳事|行事|暮らし|生活/, hooks: ["人が集まる場所を見る", "管理された植栽を見る", "草刈り跡を見る", "道端の踏まれ方を見る"] },
  { pattern: /公園|緑地|花|生物|自然/, hooks: ["草丈を見る", "草刈り跡を見る", "日当たりを見る", "花から実まで比べる"] },
];

function localHooks(title: string, summary: string, tags: string[]): string[] {
  const haystack = [title, summary, ...tags].join(" ");
  const seen = new Set<string>();
  const hooks: string[] = [];
  for (const rule of LOCAL_HOOK_RULES) {
    if (!rule.pattern.test(haystack)) continue;
    for (const hook of rule.hooks) {
      if (seen.has(hook)) continue;
      seen.add(hook);
      hooks.push(hook);
      if (hooks.length >= 8) return hooks;
    }
  }
  return hooks.length > 0 ? hooks : ["同じ場所を再訪する", "周りの環境も撮る", "日当たりを見る", "管理の跡を見る"];
}

function rawTextFromGeminiResponse(response: unknown): string {
  const obj = response as { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return obj.text ?? obj.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function geminiHooks(input: { title: string; summary: string; tags: string[]; category: string }): Promise<string[] | null> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) return null;
  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
  const response = await ai.models.generateContent({
    model: process.env.REGIONAL_HOOK_DRAFT_MODEL?.trim() || cfg.regionalStory.model,
    contents: [{ role: "user", parts: [{ text: JSON.stringify({
      task: "Extract citizen observation hooks from a local history / municipal source card.",
      constraints: [
        "Japanese only",
        "Return concrete things a beginner can look for in the field",
        "Do not add historical facts",
        "No more than 8 hooks",
        "Each hook <= 24 Japanese chars",
      ],
      input,
    }) }] }],
    config: {
      temperature: 0.2,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: { observation_hooks: { type: "array", items: { type: "string" } } },
        required: ["observation_hooks"],
      },
    },
  });
  try {
    const parsed = JSON.parse(rawTextFromGeminiResponse(response)) as { observation_hooks?: unknown };
    return Array.isArray(parsed.observation_hooks)
      ? parsed.observation_hooks.map(compact).filter(Boolean).slice(0, 8)
      : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const file = typeof args["file"] === "string" ? resolve(process.cwd(), args["file"]) : "";
  const out = typeof args["out"] === "string" ? resolve(process.cwd(), args["out"]) : resolve(process.cwd(), "regional_knowledge_hook_drafts.json");
  const regionScope = typeof args["region-scope"] === "string" ? args["region-scope"] : "JP-22-Hamamatsu";
  const provider = (typeof args["provider"] === "string" ? args["provider"] : process.env.REGIONAL_HOOK_DRAFT_PROVIDER ?? "local").toLowerCase();
  if (!file) throw new Error("Pass --file=<csv|json>");

  const records = recordsFromFile(file);
  const drafts: DraftCard[] = [];
  for (const record of records) {
    const title = firstString(record, ["title", "name", "名称", "資料名"]);
    const summary = firstString(record, ["summary", "description", "概要", "説明", "解説", "内容"]) || title;
    const sourceUrl = firstString(record, ["source_url", "url", "URL", "出典URL", "source", "リンク"]);
    if (!title || !sourceUrl) continue;
    const tags = parseTags(record["tags"] ?? record["タグ"] ?? record["keywords"] ?? record["キーワード"]);
    const category = firstString(record, ["category", "分類", "種別", "type"]) || inferCategory([title, summary, ...tags].join(" "));
    const hooks = provider === "gemini"
      ? (await geminiHooks({ title, summary, tags, category }).catch(() => null)) ?? localHooks(title, summary, tags)
      : localHooks(title, summary, tags);
    const placeHint = firstString(record, ["place_hint", "place", "所在地", "場所", "市区町村", "address"]) || title;
    const sourceLabel = firstString(record, ["source_label", "出典", "出典名", "source_name"]) || "地域資料";
    drafts.push({
      card_id: firstString(record, ["card_id", "id", "ID"]) || stableId([regionScope, title, sourceUrl].join("|")),
      region_scope: regionScope,
      locale: firstString(record, ["locale", "言語"]) || "ja-JP",
      source_type: firstString(record, ["source_type", "出典種別"]) || "official_archive",
      place_hint: placeHint,
      category,
      title,
      summary: summary.slice(0, 600),
      source_url: sourceUrl,
      source_label: sourceLabel,
      license: firstString(record, ["license", "ライセンス", "利用条件"]) || "出典先の利用規定に従う",
      tags,
      observation_hooks: hooks,
      review_status: "draft",
      quality_score: 0.55,
      metadata: { draftedBy: provider === "gemini" ? "gemini" : "local_rules", sourceFile: file },
    });
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ cards: drafts }, null, 2), "utf-8");
  console.log(JSON.stringify({ out, drafted: drafts.length, provider }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
