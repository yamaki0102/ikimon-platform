// Relationship Score v0.1 narrative generation
// LLM (DeepSeek V4 Flash) 主導で、ContentClaimsValidator が hard 違反だけ捕まえる。
// 失敗時は仕様書 §10.1 の固定テンプレ文へフォールバック。

import type { SiteLang } from "../i18n.js";
import {
  callDeepSeekFlash,
  DeepSeekClientError,
  type DeepSeekChatRequest,
  type DeepSeekMessage,
} from "./llmClients/deepseekFlashClient.js";
import {
  validateNarrative,
  fallbackNextActionText,
  CONTENT_CLAIMS_STYLE_GUIDE_VERSION,
  type ValidationResult,
} from "./contentClaimsValidator.js";
import type { RelationshipScoreResult, RelationshipAxis } from "./relationshipScore.js";

export const NARRATIVE_MODEL_DEFAULT = "deepseek-chat";

export type NarrativeContext = {
  industry?: string; // 'manufacturing' | 'real_estate' | 'agriculture' | 'tourism' | 'municipality' | 'education' | ...
  lang: SiteLang;
  placeName?: string;
};

export type NarrativeBundle = {
  nextActionText: string;
  summaryCard: string;
  seasonalNote: string;
  fallbackUsed: boolean;
  validation: ValidationResult;
  styleGuideVersion: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type NarrativeGenerator = (request: DeepSeekChatRequest) => Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
}>;

export type GenerateNarrativeOptions = {
  apiKey?: string;
  model?: string;
  generator?: NarrativeGenerator; // テスト用注入可
  maxRetries?: number;
};

function buildPrompt(
  score: RelationshipScoreResult,
  context: NarrativeContext
): DeepSeekMessage[] {
  const { lang, industry, placeName } = context;
  const axisFocus = score.nextActionAxis;
  const axisScores = Object.entries(score.axes).map(
    ([k, v]) => `${k}: ${v.score}/20`
  ).join(", ");

  const systemContent = [
    "You are a careful narrative writer for Ikimon Relationship Score, a B2B companion indicator that observes how people relate to a natural site (not an environmental certification).",
    "Output JSON only with keys: nextActionText, summaryCard, seasonalNote.",
    "Forbidden: claiming TNFD compliance, NRI certification, biodiversity improvement, medical effects, official certification, ranking superiority, saving species from extinction.",
    "Avoid: locking in specific species names or place names as templates. Use abstract types (e.g. 'invasive species' rather than 'Aromia bungii').",
    "Tone: humble, observational, focused on the next single concrete step. 100-200 chars per field.",
    `Output language: ${lang}.`,
  ].join(" ");

  const userContent = JSON.stringify({
    instruction: "Generate the three short narrative fields for this site report.",
    axisFocus,
    axisScores,
    totalScore: score.totalScore,
    climate: score.climate,
    hemisphere: score.hemisphere,
    seasonCoverageCap: score.seasonCoverageCap,
    industry: industry ?? "general",
    placeName: placeName ?? null,
    examples: {
      stewardship_ja: "小さな手入れの積み重ねが、次の観察計画につながっています。",
      engagement_en: "The same route is being recorded across seasons, making seasonal differences visible.",
      learning_es: "Los comentarios de identificación regresan y conectan con la próxima observación.",
    },
  });

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}

type ParsedNarrative = {
  nextActionText: string;
  summaryCard: string;
  seasonalNote: string;
};

function parseNarrativeJson(raw: string): ParsedNarrative | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ParsedNarrative>;
    if (!parsed) return null;
    const next = String(parsed.nextActionText ?? "").trim();
    const summary = String(parsed.summaryCard ?? "").trim();
    const seasonal = String(parsed.seasonalNote ?? "").trim();
    if (!next && !summary && !seasonal) return null;
    return { nextActionText: next, summaryCard: summary, seasonalNote: seasonal };
  } catch {
    return null;
  }
}

function fallbackBundle(
  axis: RelationshipAxis,
  context: NarrativeContext,
  validation: ValidationResult,
  meta: { inputTokens: number; outputTokens: number; model: string }
): NarrativeBundle {
  return {
    nextActionText: fallbackNextActionText(axis, context.lang),
    summaryCard: "",
    seasonalNote: "",
    fallbackUsed: true,
    validation,
    styleGuideVersion: CONTENT_CLAIMS_STYLE_GUIDE_VERSION,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    model: meta.model,
  };
}

export async function generateNarrative(
  score: RelationshipScoreResult,
  context: NarrativeContext,
  options: GenerateNarrativeOptions = {}
): Promise<NarrativeBundle> {
  const model = options.model ?? NARRATIVE_MODEL_DEFAULT;
  const maxRetries = options.maxRetries ?? 1;
  const generator: NarrativeGenerator =
    options.generator ??
    (async (request) => {
      if (!options.apiKey) {
        throw new DeepSeekClientError("missing_api_key", "DEEPSEEK_API_KEY is required");
      }
      const result = await callDeepSeekFlash(options.apiKey, request);
      return {
        content: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    });

  const baseMessages = buildPrompt(score, context);
  let totalInput = 0;
  let totalOutput = 0;

  let attempt = 0;
  let lastValidation: ValidationResult = {
    ok: true,
    hardViolations: [],
    softWarnings: [],
    styleGuideVersion: CONTENT_CLAIMS_STYLE_GUIDE_VERSION,
  };
  let messages = baseMessages;

  while (attempt <= maxRetries) {
    let llmResult: { content: string; inputTokens: number; outputTokens: number };
    try {
      llmResult = await generator({
        model,
        messages,
        responseFormat: "json_object",
        maxTokens: 600,
        temperature: 0.4,
      });
    } catch (error) {
      console.warn("[relationshipScoreNarrative] LLM call failed", error);
      return fallbackBundle(score.nextActionAxis, context, lastValidation, {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        model,
      });
    }
    totalInput += llmResult.inputTokens;
    totalOutput += llmResult.outputTokens;

    const parsed = parseNarrativeJson(llmResult.content);
    if (!parsed) {
      attempt += 1;
      continue;
    }

    const combinedText = `${parsed.nextActionText}\n${parsed.summaryCard}\n${parsed.seasonalNote}`;
    const validation = validateNarrative(combinedText, context.lang);
    lastValidation = validation;

    if (validation.ok) {
      return {
        nextActionText: parsed.nextActionText || fallbackNextActionText(score.nextActionAxis, context.lang),
        summaryCard: parsed.summaryCard,
        seasonalNote: parsed.seasonalNote,
        fallbackUsed: false,
        validation,
        styleGuideVersion: CONTENT_CLAIMS_STYLE_GUIDE_VERSION,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        model,
      };
    }

    if (attempt >= maxRetries) {
      break;
    }
    attempt += 1;
    // 違反内容を含めて再生成依頼
    const violationSummary = validation.hardViolations
      .map((v) => `- "${v.matchedTerm}" (${v.reason})`)
      .join("\n");
    messages = [
      ...baseMessages,
      {
        role: "user",
        content: `Your previous output contained forbidden terms:\n${violationSummary}\nRewrite without these terms. Output JSON only.`,
      },
    ];
  }

  return fallbackBundle(score.nextActionAxis, context, lastValidation, {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    model,
  });
}
