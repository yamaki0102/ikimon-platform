import { createHash } from "node:crypto";
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
};

export type DetectedFeature = {
  type: "species" | "vegetation" | "landform" | "structure" | "sound";
  name: string;
  confidence?: number;
  note?: string;
};

export type SceneResult = {
  summary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  isNew: boolean;
  sceneHash: string;
};

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

  const season = opts.context.season ?? guessSeason();
  const prompt = `あなたは野外生物多様性AIアシスタントです。
この映像フレーム${opts.audioBase64 ? "と音声" : ""}を分析して、以下のJSON形式で回答してください。

場所: 緯度${opts.context.lat.toFixed(4)} 経度${opts.context.lng.toFixed(4)}
季節: ${season}
仮説ラベル: ${opts.context.siteBriefLabel ?? "不明"}

{
  "summary": "シーンの簡潔な説明（日本語100字以内）",
  "detectedSpecies": ["種名1", "種名2"],
  "detectedFeatures": [
    { "type": "species|vegetation|landform|structure|sound", "name": "名前", "confidence": 0.0-1.0, "note": "補足" }
  ]
}

species: 可能性のある生物（断定しない）
vegetation: 植生・植物群落
landform: 地形・地物
structure: 建物・人工物
sound: 聞こえる音（音声ある場合）

JSONのみ回答してください。`;

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts }],
  });

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: { summary?: string; detectedSpecies?: string[]; detectedFeatures?: DetectedFeature[] } = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = {};
  }

  const summary = parsed.summary ?? rawText.slice(0, 100);
  const detectedSpecies = Array.isArray(parsed.detectedSpecies) ? parsed.detectedSpecies : [];
  const detectedFeatures = Array.isArray(parsed.detectedFeatures) ? parsed.detectedFeatures : [];

  const sceneHash = createHash("sha256")
    .update(detectedSpecies.sort().join(",") + detectedFeatures.map((f) => f.name).sort().join(","))
    .digest("hex")
    .slice(0, 16);

  const isNew = checkDedup(opts.context.sessionId, sceneHash);

  return { summary, detectedSpecies, detectedFeatures, isNew, sceneHash };
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

function guessSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}
