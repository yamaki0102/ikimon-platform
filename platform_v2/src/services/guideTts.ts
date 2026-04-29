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
  guideMode?: "walk" | "vehicle";
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
      : "検出種なし。種名を無理に補わない。";
  const modeInstruction = opts.guideMode === "vehicle"
    ? "車・自転車などの移動中モード。個体の種同定より、植生帯、土地被覆、農地、水路、街路樹、草刈り、林縁、道路際の状態を短く読む。看板・ロゴ・車名・店舗名を生きものとして扱わない。"
    : "徒歩モード。種名だけでなく、植生・土地被覆・管理痕跡・水辺・林縁も観察価値として語る。看板・ロゴ・車名・店舗名を生きものとして扱わない。";

  const systemPrompt = `あなたはライブガイドのナレーターです。
観察者のフィールド体験を邪魔しないよう、短く自然な語り口で2〜3文のガイドを${langNames[opts.lang]}で生成してください。

ルール:
- scene summary が「秒前」「分前」「earlier」「before」など過去の地点を示す場合、必ずその時制を保つ。「ここ」「今」「目の前」と言い換えない
- 移動中に割り込む音声ではなく、ユーザーがカードを開いた時の読み上げとして落ち着いて話す
- 断定を避け「〜が好む環境です」「〜が見られる可能性があります」のように語る
- 種名がない場合も失敗扱いしない。衛星画像より細かい植生・土地利用・管理状態の記録として価値を返す
- 看板・ロゴ・車名・店舗名を生物名として解説しない。例: 車のスズキ看板は魚のスズキではない
- 海外旅行者にもわかる平易な表現を使う
- 文字数は100〜200字程度
- Gemini 3.1 Flash TTS は表現タグに対応するが、この画面ではタグを出力しない。必要な抑揚は文章で自然に作る
- 場所: 緯度${opts.lat.toFixed(4)} 経度${opts.lng.toFixed(4)}
- 仮説ラベル: ${opts.siteBriefLabel ?? "不明"}
- モード: ${modeInstruction}
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
