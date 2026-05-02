import { GoogleGenAI, Modality } from "@google/genai";
import { loadConfig } from "../config.js";
import type { TtsLang } from "./guideTts.js";

const DEFAULT_LIVE_MODEL = "gemini-live-2.5-flash-preview";

export type GuideLiveTokenResult = {
  token: string;
  model: string;
  expiresAt: string;
  newSessionExpiresAt: string;
};

export async function createGuideLiveToken(opts: {
  model?: string;
  lang?: TtsLang;
} = {}): Promise<GuideLiveTokenResult> {
  const config = loadConfig();
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = opts.model?.trim() || DEFAULT_LIVE_MODEL;
  const now = Date.now();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
  const newSessionExpiresAt = new Date(now + 90 * 1000).toISOString();
  const lang = opts.lang ?? "ja";

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey,
    httpOptions: { apiVersion: "v1alpha" },
  });

  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime: newSessionExpiresAt,
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: [
            "You are a low-latency field guide helper for ikimon.life.",
            "Return only brief observation hints. Do not narrate aloud or claim delayed results are current.",
            `Preferred language: ${lang}.`,
          ].join(" "),
        },
      },
      lockAdditionalFields: ["responseModalities", "systemInstruction"],
    },
  });

  if (!token.name) throw new Error("Gemini Live token response contained no token");

  return {
    token: token.name,
    model,
    expiresAt,
    newSessionExpiresAt,
  };
}
