import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";

export type TtsLang = "ja" | "en" | "es" | "pt-BR" | "ko" | "zh";

// Voice names that work well for each language (from the 30-voice roster).
const VOICE_MAP: Record<TtsLang, string> = {
  ja: "Kore",
  en: "Aoede",
  es: "Charon",
  "pt-BR": "Fenrir",
  ko: "Leda",
  zh: "Orus",
};

function getClient(): GoogleGenAI {
  const config = loadConfig();
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

/**
 * Generate a TTS audio clip using gemini-3.1-flash-tts-preview.
 * Returns raw base64-encoded PCM (24 kHz, 16-bit mono).
 */
export async function generateTts(
  text: string,
  lang: TtsLang = "ja",
  voiceOverride?: string,
): Promise<string> {
  const ai = getClient();
  const voiceName = voiceOverride ?? VOICE_MAP[lang] ?? "Kore";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("TTS response contained no audio data");
  }
  return part.inlineData.data;
}

/**
 * Build a Live Guide TTS script for a given scene and category.
 * category: "biodiversity" | "land_history" | "buildings" | "people_history"
 */
export async function buildGuideScript(opts: {
  category: "biodiversity" | "land_history" | "buildings" | "people_history";
  sceneSummary: string;
  lang: TtsLang;
  lat: number;
  lng: number;
  siteBriefLabel?: string;
  detectedSpecies?: string[];
}): Promise<string> {
  const ai = getClient();

  const categoryInstructions: Record<string, string> = {
    biodiversity: "生物多様性・種の生態・行動・季節との関係",
    land_history: "土地の歴史・地名由来・過去の土地利用・昔の人の暮らし",
    buildings: "建物・文化財・神社仏閣・建築様式・宗教的意味",
    people_history: "旧街道・偉人・歴史的出来事（海外旅行者にも平易に）",
  };

  const langNames: Record<TtsLang, string> = {
    ja: "日本語",
    en: "English",
    es: "Español",
    "pt-BR": "Português (Brasil)",
    ko: "한국어",
    zh: "中文",
  };

  const speciesHint =
    opts.detectedSpecies && opts.detectedSpecies.length > 0
      ? `検出種: ${opts.detectedSpecies.join("、")}`
      : "";

  const systemPrompt = `あなたはライブガイドのナレーターです。
観察者が今いる場所の「${categoryInstructions[opts.category]}」について、自然な語り口で2〜3文のガイドを${langNames[opts.lang]}で生成してください。

ルール:
- 断定を避け「〜が好む環境です」「〜が見られる可能性があります」のように語る
- 海外旅行者にもわかる平易な表現を使う
- 文字数は100〜200字程度
- voice tags ([ゆっくり] [静かに] 等) は使わない
- 場所: 緯度${opts.lat.toFixed(4)} 経度${opts.lng.toFixed(4)}
- 仮説ラベル: ${opts.siteBriefLabel ?? "不明"}
- ${speciesHint}
- シーン概要: ${opts.sceneSummary}`;

  // Primary: 3.1-flash-lite-preview、Fallback: 2.5-flash-lite (503 / quota 時)
  const TEXT_MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let lastErr: unknown = null;
  for (const model of TEXT_MODELS) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw err;
    }
  }
  if (!response) throw lastErr ?? new Error("gemini_all_models_failed");

  return response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}
