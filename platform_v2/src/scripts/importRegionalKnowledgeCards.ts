/**
 * CSV / JSON / GeoJSON の地域資料を regional_knowledge_cards に upsert する。
 *
 * 使い方:
 *   npx tsx src/scripts/importRegionalKnowledgeCards.ts --file=cards.csv --dry-run
 *   npx tsx src/scripts/importRegionalKnowledgeCards.ts --file=cards.json --region-scope=JP-22-Hamamatsu
 *   npx tsx src/scripts/importRegionalKnowledgeCards.ts --dir=data/regional_cards
 *
 * 推奨フィールド:
 *   card_id, region_scope, place_hint, place_keys, historical_place_names,
 *   latitude, longitude, bbox_json, geometry_confidence, category,
 *   title, summary, source_url, source_label, license,
 *   valid_from, valid_to, temporal_scope, source_issued_at, source_accessed_at,
 *   tags, observation_hooks, sensitivity_level
 *
 * 自治体データ向けの別名:
 *   名称/name/title, 概要/説明/summary/description, 出典URL/url/source_url,
 *   緯度/lat/latitude, 経度/lng/lon/longitude, 分類/category, タグ/tags,
 *   旧地名/旧市町村, 時代/年代, 位置精度, 行政コード,
 *   観察フック/見るポイント/次に見ること
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { getPool } from "../db.js";

const CATEGORY_VALUES = new Set([
  "history",
  "cultural_asset",
  "landform",
  "water",
  "agriculture",
  "industry",
  "disaster_memory",
  "ecology",
  "policy",
  "local_life",
] as const);

const SENSITIVITY_VALUES = new Set(["public", "coarse", "restricted"] as const);
const TEMPORAL_SCOPE_VALUES = new Set(["current", "historical", "mixed", "legendary", "unspecified"] as const);
const GEOMETRY_CONFIDENCE_VALUES = new Set(["exact", "approximate", "historical_map", "text_only", "unknown"] as const);

type RegionalKnowledgeCategory = typeof CATEGORY_VALUES extends Set<infer T> ? T : never;
type SensitivityLevel = typeof SENSITIVITY_VALUES extends Set<infer T> ? T : never;
type TemporalScope = typeof TEMPORAL_SCOPE_VALUES extends Set<infer T> ? T : never;
type GeometryConfidence = typeof GEOMETRY_CONFIDENCE_VALUES extends Set<infer T> ? T : never;

type RawRecord = Record<string, unknown>;

type ImportableCard = {
  cardId: string;
  regionScope: string;
  locale: string;
  sourceType: string;
  placeHint: string;
  placeKeys: Record<string, unknown>;
  historicalPlaceNames: string[];
  latitude: number | null;
  longitude: number | null;
  bboxJson: Record<string, unknown>;
  geometryConfidence: GeometryConfidence;
  category: RegionalKnowledgeCategory;
  title: string;
  summary: string;
  retrievalText: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceFingerprint: string;
  license: string;
  validFrom: string | null;
  validTo: string | null;
  temporalScope: TemporalScope;
  sourceIssuedAt: string | null;
  sourceAccessedAt: string;
  tags: string[];
  observationHooks: string[];
  sensitivityLevel: SensitivityLevel;
  reviewStatus: string;
  qualityScore: number;
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
    const direct = compact(record[key]);
    if (direct) return direct;
    const foundKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (foundKey) {
      const value = compact(record[foundKey]);
      if (value) return value;
    }
  }
  return "";
}

function parseNumber(value: unknown): number | null {
  const raw = compact(value).replace(/[，,]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(compact).filter(Boolean).slice(0, 24);
  }
  const raw = compact(value);
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(compact).filter(Boolean).slice(0, 24);
    } catch {
      // fall through
    }
  }
  return raw.split(/[;,、，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 24);
}

function parseBbox(record: RawRecord): Record<string, unknown> {
  const raw = firstString(record, ["bbox_json", "bbox", "bounding_box"]);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return { west: parsed[0], south: parsed[1], east: parsed[2], north: parsed[3] };
      }
    } catch {
      return {};
    }
  }
  const north = parseNumber(record["north"] ?? record["max_lat"] ?? record["北端"]);
  const south = parseNumber(record["south"] ?? record["min_lat"] ?? record["南端"]);
  const east = parseNumber(record["east"] ?? record["max_lng"] ?? record["max_lon"] ?? record["東端"]);
  const west = parseNumber(record["west"] ?? record["min_lng"] ?? record["min_lon"] ?? record["西端"]);
  return [north, south, east, west].every((value) => value !== null)
    ? { north, south, east, west }
    : {};
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  const raw = compact(value);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseDateish(value: unknown): string | null {
  const raw = compact(value);
  if (!raw) return null;
  const normalized = raw.replace(/[年月.\/]/g, "-").replace(/日/g, "").replace(/--+/g, "-");
  const matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!matched) return /^\d{4}$/.test(raw) ? `${raw}-01-01` : null;
  const [, y, m, d] = matched;
  return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

function normalizeTemporalScope(raw: string): TemporalScope {
  if (TEMPORAL_SCOPE_VALUES.has(raw as TemporalScope)) return raw as TemporalScope;
  if (/旧|古|史|昔|絵図|江戸|明治|大正|昭和|histor/.test(raw)) return "historical";
  if (/伝説|民話|legend/.test(raw)) return "legendary";
  if (/現|current|最新/.test(raw)) return "current";
  return "unspecified";
}

function normalizeGeometryConfidence(raw: string, lat: number | null, lng: number | null): GeometryConfidence {
  if (GEOMETRY_CONFIDENCE_VALUES.has(raw as GeometryConfidence)) return raw as GeometryConfidence;
  if (/絵図|古地図|historical/.test(raw)) return "historical_map";
  if (/概略|推定|approx/.test(raw)) return "approximate";
  if (lat !== null && lng !== null) return "exact";
  return "text_only";
}

function inferCategory(raw: string): RegionalKnowledgeCategory {
  const normalized = raw.toLowerCase();
  if (CATEGORY_VALUES.has(normalized as RegionalKnowledgeCategory)) return normalized as RegionalKnowledgeCategory;
  if (/文化財|史跡|城|寺|神社|cultural/.test(raw)) return "cultural_asset";
  if (/歴史|市史|町史|古文書|history/.test(raw)) return "history";
  if (/川|湖|池|海|水|water/.test(raw)) return "water";
  if (/地形|台地|低地|扇状地|landform/.test(raw)) return "landform";
  if (/農|田|畑|茶|みかん|agri/.test(raw)) return "agriculture";
  if (/産業|工場|鉄道|街道|industry|交通/.test(raw)) return "industry";
  if (/災害|津波|洪水|地震|disaster/.test(raw)) return "disaster_memory";
  if (/環境|自然|生物|ecology|緑地/.test(raw)) return "ecology";
  if (/計画|条例|政策|policy/.test(raw)) return "policy";
  return "local_life";
}

function inferSourceLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return "地域資料";
  }
}

function stableCardId(record: RawRecord, seed: string): string {
  const explicit = firstString(record, ["card_id", "id", "ID", "識別子"]);
  if (explicit) return explicit.replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 120);
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 16);
  return `regional-${hash}`;
}

function stableFingerprint(seed: string): string {
  return createHash("sha1").update(seed).digest("hex");
}

function inferSourceType(sourceUrl: string, sourceLabel: string): string {
  if (/adeac\.jp/.test(sourceUrl)) return "official_archive";
  if (/opendata|data/.test(sourceUrl) || /オープンデータ/.test(sourceLabel)) return "municipal_open_data";
  if (/city\.hamamatsu|pref\.shizuoka/.test(sourceUrl) && /計画|plan|pdf/i.test(sourceUrl + sourceLabel)) return "official_plan";
  return "other";
}

function normalizeRecord(record: RawRecord, defaults: {
  regionScope: string;
  category: string;
  sourceLabel: string;
  license: string;
  importedFrom: string;
}): { card: ImportableCard | null; reason?: string } {
  const title = firstString(record, ["title", "name", "名称", "資料名", "文化財名称"]);
  const summary = firstString(record, ["summary", "description", "概要", "説明", "解説", "内容"]);
  const sourceUrl = firstString(record, ["source_url", "url", "URL", "出典URL", "source", "リンク"]);
  if (!title) return { card: null, reason: "missing_title" };
  if (!summary) return { card: null, reason: "missing_summary" };
  if (!sourceUrl) return { card: null, reason: "missing_source_url" };

  const regionScope = firstString(record, ["region_scope", "region", "自治体コード", "地域コード"]) || defaults.regionScope;
  const rawCategory = firstString(record, ["category", "分類", "種別", "type"]) || defaults.category;
  const sourceLabel = firstString(record, ["source_label", "出典", "出典名", "source_name"]) || defaults.sourceLabel || inferSourceLabel(sourceUrl);
  const license = firstString(record, ["license", "ライセンス", "利用条件"]) || defaults.license;
  const locale = firstString(record, ["locale", "言語", "language"]) || "ja-JP";
  const sourceType = firstString(record, ["source_type", "sourceType", "出典種別"]) || inferSourceType(sourceUrl, sourceLabel);
  const lat = parseNumber(record["latitude"] ?? record["lat"] ?? record["緯度"]);
  const lng = parseNumber(record["longitude"] ?? record["lng"] ?? record["lon"] ?? record["経度"]);
  const placeHint = firstString(record, ["place_hint", "place", "所在地", "場所", "市区町村", "address"]) || title;
  const placeKeys = parseObject(record["place_keys"] ?? record["行政コード"] ?? record["地域キー"]);
  const historicalPlaceNames = parseTags(record["historical_place_names"] ?? record["old_place_names"] ?? record["旧地名"] ?? record["旧市町村"]);
  const validFrom = parseDateish(firstString(record, ["valid_from", "公開日", "更新日", "date"]));
  const validTo = parseDateish(firstString(record, ["valid_to", "終了日", "廃止日"]));
  const sourceIssuedAt = parseDateish(firstString(record, ["source_issued_at", "資料発行日", "発行日"]));
  const sourceAccessedAt = parseDateish(firstString(record, ["source_accessed_at", "取得日", "アクセス日"])) ?? new Date().toISOString().slice(0, 10);
  const temporalScope = normalizeTemporalScope(firstString(record, ["temporal_scope", "時代範囲", "時代", "年代", "period"]));
  const geometryConfidence = normalizeGeometryConfidence(firstString(record, ["geometry_confidence", "位置精度", "座標精度"]), lat, lng);
  const sensitivityRaw = firstString(record, ["sensitivity_level", "sensitivity", "公開範囲"]);
  const sensitivityLevel = SENSITIVITY_VALUES.has(sensitivityRaw as SensitivityLevel)
    ? sensitivityRaw as SensitivityLevel
    : "public";
  const seed = [regionScope, title, sourceUrl, placeHint].join("|");
  const tags = parseTags(record["tags"] ?? record["タグ"] ?? record["keywords"] ?? record["キーワード"]);
  const observationHooks = parseTags(record["observation_hooks"] ?? record["観察フック"] ?? record["見るポイント"] ?? record["次に見ること"] ?? record["観察語彙"]);
  const retrievalText = firstString(record, ["retrieval_text", "検索本文", "検索用テキスト"]) ||
    [title, summary, placeHint, ...historicalPlaceNames, ...tags, ...observationHooks].filter(Boolean).join(" / ");

  return {
    card: {
      cardId: stableCardId(record, seed),
      regionScope,
      locale,
      sourceType,
      placeHint,
      placeKeys,
      historicalPlaceNames,
      latitude: lat,
      longitude: lng,
      bboxJson: parseBbox(record),
      geometryConfidence,
      category: inferCategory(rawCategory),
      title: title.slice(0, 160),
      summary: summary.slice(0, 600),
      retrievalText: retrievalText.slice(0, 2000),
      sourceUrl,
      sourceLabel,
      sourceFingerprint: firstString(record, ["source_fingerprint", "sourceFingerprint", "出典指紋"]) || stableFingerprint([sourceUrl, title, sourceLabel].join("|")),
      license,
      validFrom,
      validTo,
      temporalScope,
      sourceIssuedAt,
      sourceAccessedAt,
      tags,
      observationHooks,
      sensitivityLevel,
      reviewStatus: firstString(record, ["review_status", "レビュー状態"]) || "approved",
      qualityScore: Math.max(0, Math.min(1, parseNumber(record["quality_score"] ?? record["品質スコア"]) ?? 0.5)),
      metadata: {
        importedFrom: defaults.importedFrom,
        originalCategory: rawCategory || null,
      },
    },
  };
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
    if (ch === "\"") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function recordsFromJson(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw.filter((item): item is RawRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj["cards"])) return recordsFromJson(obj["cards"]);
  if (Array.isArray(obj["data"])) return recordsFromJson(obj["data"]);
  if (obj["type"] === "FeatureCollection" && Array.isArray(obj["features"])) {
    return obj["features"].map((feature, index) => {
      const f = feature as { properties?: RawRecord; geometry?: { type?: string; coordinates?: unknown } };
      const props = f.properties ?? {};
      const coords = f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
      return {
        ...props,
        longitude: coords ? coords[0] : props["longitude"],
        latitude: coords ? coords[1] : props["latitude"],
        card_id: props["card_id"] ?? props["id"] ?? `feature-${index + 1}`,
      };
    });
  }
  return [obj as RawRecord];
}

function readRecords(filePath: string): RawRecord[] {
  const body = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const ext = extname(filePath).toLowerCase();
  if (ext === ".csv") return parseCsv(body);
  return recordsFromJson(JSON.parse(body) as unknown);
}

async function upsertCard(card: ImportableCard): Promise<void> {
  await getPool().query(
    `insert into regional_knowledge_cards (
       card_id, region_scope, locale, source_type, place_hint, place_keys, historical_place_names,
       latitude, longitude, bbox_json, geometry_confidence,
       category, title, summary, retrieval_text, source_url, source_label, source_fingerprint, license,
       valid_from, valid_to, temporal_scope, source_issued_at, source_accessed_at,
       tags, observation_hooks, sensitivity_level, review_status, quality_score, metadata
     ) values (
       $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb,
       $8, $9, $10::jsonb, $11,
       $12, $13, $14, $15, $16, $17, $18, $19,
       $20::date, $21::date, $22, $23::date, $24::date,
       $25::jsonb, $26::jsonb, $27, $28, $29, $30::jsonb
     )
     on conflict (card_id) do update set
       region_scope = excluded.region_scope,
       locale = excluded.locale,
       source_type = excluded.source_type,
       place_hint = excluded.place_hint,
       place_keys = regional_knowledge_cards.place_keys || excluded.place_keys,
       historical_place_names = excluded.historical_place_names,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       bbox_json = excluded.bbox_json,
       geometry_confidence = excluded.geometry_confidence,
       category = excluded.category,
       title = excluded.title,
       summary = excluded.summary,
       retrieval_text = excluded.retrieval_text,
       source_url = excluded.source_url,
       source_label = excluded.source_label,
       source_fingerprint = excluded.source_fingerprint,
       license = excluded.license,
       valid_from = excluded.valid_from,
       valid_to = excluded.valid_to,
       temporal_scope = excluded.temporal_scope,
       source_issued_at = excluded.source_issued_at,
       source_accessed_at = excluded.source_accessed_at,
       tags = excluded.tags,
       observation_hooks = excluded.observation_hooks,
       sensitivity_level = excluded.sensitivity_level,
       review_status = excluded.review_status,
       quality_score = excluded.quality_score,
       metadata = regional_knowledge_cards.metadata || excluded.metadata,
       updated_at = now()`,
    [
      card.cardId,
      card.regionScope,
      card.locale,
      card.sourceType,
      card.placeHint,
      JSON.stringify(card.placeKeys),
      JSON.stringify(card.historicalPlaceNames),
      card.latitude,
      card.longitude,
      JSON.stringify(card.bboxJson),
      card.geometryConfidence,
      card.category,
      card.title,
      card.summary,
      card.retrievalText,
      card.sourceUrl,
      card.sourceLabel,
      card.sourceFingerprint,
      card.license,
      card.validFrom,
      card.validTo,
      card.temporalScope,
      card.sourceIssuedAt,
      card.sourceAccessedAt,
      JSON.stringify(card.tags),
      JSON.stringify(card.observationHooks),
      card.sensitivityLevel,
      card.reviewStatus,
      card.qualityScore,
      JSON.stringify(card.metadata),
    ],
  );
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dryRun = Boolean(args["dry-run"]);
  const limit = typeof args["limit"] === "string" ? Math.max(1, Number.parseInt(args["limit"], 10)) : Infinity;
  const defaults = {
    regionScope: typeof args["region-scope"] === "string" ? args["region-scope"] : "JP",
    category: typeof args["category"] === "string" ? args["category"] : "local_life",
    sourceLabel: typeof args["source-label"] === "string" ? args["source-label"] : "",
    license: typeof args["license"] === "string" ? args["license"] : "出典先の利用規定に従う",
  };
  const files = typeof args["file"] === "string"
    ? [resolve(process.cwd(), args["file"])]
    : typeof args["dir"] === "string"
      ? readdirSync(resolve(process.cwd(), args["dir"]))
          .filter((name) => [".csv", ".json", ".geojson"].includes(extname(name).toLowerCase()))
          .map((name) => join(resolve(process.cwd(), args["dir"] as string), name))
      : [];
  if (files.length === 0) {
    throw new Error("Pass --file=<csv|json|geojson> or --dir=<directory>");
  }

  let scanned = 0;
  let imported = 0;
  const skipped: Record<string, number> = {};
  for (const file of files) {
    const records = readRecords(file);
    for (const record of records) {
      if (scanned >= limit) break;
      scanned += 1;
      const normalized = normalizeRecord(record, { ...defaults, importedFrom: basename(file) });
      if (!normalized.card) {
        skipped[normalized.reason ?? "unknown"] = (skipped[normalized.reason ?? "unknown"] ?? 0) + 1;
        continue;
      }
      if (!dryRun) {
        await upsertCard(normalized.card);
      }
      imported += 1;
    }
  }

  console.log(JSON.stringify({ dryRun, scanned, imported, skipped, files }, null, 2));
  if (!dryRun) {
    await getPool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
