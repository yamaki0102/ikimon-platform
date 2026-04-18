import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";

export type TaxonInsight = {
  scientificName: string;
  vernacularName: string;
  etymology: string;
  ecologyNote: string;
  lookAlikeNote: string;
  rarityNote: string;
  generatedAt: string;
  source: "cache" | "fresh" | "empty";
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/taxon_insight.md");
const CACHE_TTL_DAYS = 30;
let PROMPT_CACHE: string | null = null;

function loadPromptTemplate(): string {
  if (PROMPT_CACHE !== null) return PROMPT_CACHE;
  PROMPT_CACHE = readFileSync(PROMPT_PATH, "utf-8");
  return PROMPT_CACHE;
}

function render(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`\${${k}}`).join(v);
  return out;
}

function empty(scientificName: string, vernacularName: string): TaxonInsight {
  return {
    scientificName,
    vernacularName,
    etymology: "",
    ecologyNote: "",
    lookAlikeNote: "",
    rarityNote: "",
    generatedAt: new Date().toISOString(),
    source: "empty",
  };
}

function parseResponse(text: string): {
  etymology: string;
  ecologyNote: string;
  lookAlikeNote: string;
  rarityNote: string;
} | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const d = JSON.parse(m[0]) as Record<string, unknown>;
    return {
      etymology: typeof d.etymology === "string" ? d.etymology : "",
      ecologyNote: typeof d.ecology_note === "string" ? d.ecology_note : "",
      lookAlikeNote: typeof d.look_alike_note === "string" ? d.look_alike_note : "",
      rarityNote: typeof d.rarity_note === "string" ? d.rarity_note : "",
    };
  } catch {
    return null;
  }
}

export async function getTaxonInsight(opts: {
  scientificName: string;
  vernacularName?: string;
  lat?: number;
  lng?: number;
  season?: string;
  lang?: "ja" | "en";
}): Promise<TaxonInsight> {
  const lang = opts.lang ?? "ja";
  const sn = opts.scientificName.trim();
  const vn = (opts.vernacularName ?? "").trim();
  if (!sn && !vn) return empty(sn, vn);

  const pool = getPool();
  const cacheKey = sn || vn;

  // 1. キャッシュ参照
  const cached = await pool.query<{
    scientific_name: string;
    vernacular_name: string;
    etymology: string;
    ecology_note: string;
    look_alike_note: string;
    rarity_note: string;
    generated_at: string;
  }>(
    `SELECT scientific_name, vernacular_name, etymology, ecology_note, look_alike_note, rarity_note,
            generated_at::text
       FROM taxon_insights_cache
      WHERE scientific_name = $1 AND lang = $2
        AND generated_at > now() - ($3::text || ' days')::interval
      LIMIT 1`,
    [cacheKey, lang, String(CACHE_TTL_DAYS)],
  );
  if (cached.rows.length > 0) {
    const r = cached.rows[0]!;
    return {
      scientificName: r.scientific_name,
      vernacularName: r.vernacular_name,
      etymology: r.etymology,
      ecologyNote: r.ecology_note,
      lookAlikeNote: r.look_alike_note,
      rarityNote: r.rarity_note,
      generatedAt: r.generated_at,
      source: "cache",
    };
  }

  // 2. Gemini 生成
  const config = loadConfig();
  if (!config.geminiApiKey) return empty(sn, vn);

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const prompt = render(loadPromptTemplate(), {
    scientificName: sn || "不明",
    vernacularName: vn || "不明",
    lat: opts.lat != null ? opts.lat.toFixed(4) : "不明",
    lng: opts.lng != null ? opts.lng.toFixed(4) : "不明",
    season: opts.season ?? "不明",
  });

  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  for (const model of MODELS) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) break;
    }
  }
  if (!response) return empty(sn, vn);

  const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = parseResponse(raw);
  if (!parsed) return empty(sn, vn);

  const ins: TaxonInsight = {
    scientificName: sn,
    vernacularName: vn,
    etymology: parsed.etymology,
    ecologyNote: parsed.ecologyNote,
    lookAlikeNote: parsed.lookAlikeNote,
    rarityNote: parsed.rarityNote,
    generatedAt: new Date().toISOString(),
    source: "fresh",
  };

  // 3. キャッシュ保存
  await pool
    .query(
      `INSERT INTO taxon_insights_cache
         (scientific_name, vernacular_name, lang, etymology, ecology_note, look_alike_note, rarity_note, model_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (scientific_name, lang) DO UPDATE SET
         vernacular_name = EXCLUDED.vernacular_name,
         etymology = EXCLUDED.etymology,
         ecology_note = EXCLUDED.ecology_note,
         look_alike_note = EXCLUDED.look_alike_note,
         rarity_note = EXCLUDED.rarity_note,
         generated_at = now(),
         model_used = EXCLUDED.model_used`,
      [cacheKey, vn, lang, ins.etymology, ins.ecologyNote, ins.lookAlikeNote, ins.rarityNote, "gemini-3.1-flash-lite-preview"],
    )
    .catch(() => undefined);

  return ins;
}
