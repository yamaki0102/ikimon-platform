import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import type { TtsLang } from "./guideTts.js";

export type SceneContext = {
  lat: number;
  lng: number;
  lang: TtsLang;
  sessionId: string;
  userId?: string | null;
  siteBriefLabel?: string | null;
  siteBriefSignals?: Record<string, unknown> | null;
  season?: string | null;
  /** EXIF 撮影日時 ISO 8601。画像アップロード時に EXIF から抽出した値を渡す。 */
  capturedAt?: string | null;
  /** EXIF 方位角（0-360、北=0）。 */
  azimuth?: number | null;
};

export type DetectedFeature = {
  type: "species" | "vegetation" | "landform" | "structure" | "sound";
  name: string;
  confidence?: number;
  note?: string;
};

export type PrimarySubject = {
  name: string;
  rank: "species" | "genus" | "family" | "lifeform" | "unknown";
  confidence: number;
};

export type SceneResult = {
  summary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  primarySubject?: PrimarySubject;
  environmentContext?: string;
  seasonalNote?: string;
  coexistingTaxa?: string[];
  isNew: boolean;
  sceneHash: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/guide_scene.md");
let CACHED_PROMPT_TEMPLATE: string | null = null;

function loadPromptTemplate(): string {
  if (CACHED_PROMPT_TEMPLATE !== null) return CACHED_PROMPT_TEMPLATE;
  try {
    CACHED_PROMPT_TEMPLATE = readFileSync(PROMPT_PATH, "utf-8");
  } catch (err) {
    // プロンプトファイルがないと Gemini 呼び出しが無意味な応答になるので明示的に失敗。
    throw new Error(`guide_scene.md not found at ${PROMPT_PATH}: ${(err as Error).message}`);
  }
  return CACHED_PROMPT_TEMPLATE;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadPromptTemplate();
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`\${${key}}`).join(value);
  }
  return out;
}

export type GuideRecordInput = {
  sessionId: string;
  userId?: string | null;
  occurrenceId?: string | null;
  lat: number;
  lng: number;
  sceneHash: string;
  sceneSummary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  ttsScript?: string | null;
  lang: TtsLang;
};

// In-process dedup store: sessionId → Map<sceneHash, lastSeenMs>
const dedupStore = new Map<string, Map<string, number>>();
const DEDUP_COOLDOWN_MS = 30_000;

function checkDedup(sessionId: string, sceneHash: string): boolean {
  let sessionMap = dedupStore.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map();
    dedupStore.set(sessionId, sessionMap);
  }
  const lastSeen = sessionMap.get(sceneHash) ?? 0;
  const now = Date.now();
  if (now - lastSeen < DEDUP_COOLDOWN_MS) return false;
  sessionMap.set(sceneHash, now);
  return true;
}

function getClient(): GoogleGenAI {
  const config = loadConfig();
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

/**
 * Analyse a scene from a video frame (+ optional audio) using Gemini.
 * Returns structured scene data and whether this is a new scene (dedup check).
 */
export async function analyzeScene(opts: {
  frameBase64: string;
  audioBase64?: string | null;
  frameMimeType?: string;
  context: SceneContext;
}): Promise<SceneResult> {
  const ai = getClient();

  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: opts.frameMimeType ?? "image/jpeg",
        data: opts.frameBase64,
      },
    },
  ];

  if (opts.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/pcm",
        data: opts.audioBase64,
      },
    });
  }

  const season = opts.context.season ?? guessSeason(opts.context.capturedAt);
  const prompt = renderPrompt({
    lat: opts.context.lat.toFixed(5),
    lng: opts.context.lng.toFixed(5),
    capturedAt: opts.context.capturedAt ?? "不明",
    azimuth: opts.context.azimuth != null ? `${opts.context.azimuth.toFixed(0)}°` : "不明",
    season,
    siteBriefLabel: opts.context.siteBriefLabel ?? "不明",
  });

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts }],
  });

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: {
    summary?: string;
    detectedSpecies?: string[];
    detectedFeatures?: DetectedFeature[];
    primarySubject?: PrimarySubject;
    environmentContext?: string;
    seasonalNote?: string;
    coexistingTaxa?: string[];
  } = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = {};
  }

  const summary = parsed.summary ?? rawText.slice(0, 120);
  const detectedSpecies = Array.isArray(parsed.detectedSpecies) ? parsed.detectedSpecies : [];
  const detectedFeatures = Array.isArray(parsed.detectedFeatures) ? parsed.detectedFeatures : [];
  const primarySubject = parsed.primarySubject && typeof parsed.primarySubject.name === "string" ? parsed.primarySubject : undefined;
  const environmentContext = typeof parsed.environmentContext === "string" ? parsed.environmentContext : undefined;
  const seasonalNote = typeof parsed.seasonalNote === "string" ? parsed.seasonalNote : undefined;
  const coexistingTaxa = Array.isArray(parsed.coexistingTaxa) ? parsed.coexistingTaxa : undefined;

  const sceneHash = createHash("sha256")
    .update(detectedSpecies.sort().join(",") + detectedFeatures.map((f) => f.name).sort().join(","))
    .digest("hex")
    .slice(0, 16);

  const isNew = checkDedup(opts.context.sessionId, sceneHash);

  return {
    summary,
    detectedSpecies,
    detectedFeatures,
    primarySubject,
    environmentContext,
    seasonalNote,
    coexistingTaxa,
    isNew,
    sceneHash,
  };
}

/** Persist a guide record to the database. Returns the guide_record_id. */
export async function saveGuideRecord(input: GuideRecordInput): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ guide_record_id: string }>(
      `insert into guide_records
         (session_id, user_id, occurrence_id, lat, lng, scene_hash, scene_summary,
          detected_species, detected_features, tts_script, lang)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       returning guide_record_id`,
      [
        input.sessionId,
        input.userId ?? null,
        input.occurrenceId ?? null,
        input.lat,
        input.lng,
        input.sceneHash,
        input.sceneSummary,
        JSON.stringify(input.detectedSpecies),
        JSON.stringify(input.detectedFeatures),
        input.ttsScript ?? null,
        input.lang,
      ],
    );
    return result.rows[0]?.guide_record_id ?? "";
  } finally {
    client.release();
  }
}

function guessSeason(capturedAt?: string | null): string {
  const d = capturedAt ? new Date(capturedAt) : new Date();
  const month = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}
