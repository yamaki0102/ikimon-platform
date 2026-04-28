import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { logAiCost } from "./aiCostLogger.js";
import { CURATOR_DEEPSEEK_MODEL, CURATOR_DEFAULT_MODEL, estimateAiCostUsd, pricingForModel } from "./aiModelPricing.js";

export type CuratorModelProvider = "gemini" | "deepseek";

export type CuratorModelResult<T> = {
  provider: CuratorModelProvider;
  model: string;
  parsed: T;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type CuratorJsonRequest = {
  provider?: CuratorModelProvider;
  model?: string;
  curatorName: string;
  runId?: string | null;
  systemPrompt: string;
  userText: string;
  responseJsonSchema: unknown;
  maxOutputTokens?: number;
};

function rawTextFromGeminiResponse(response: unknown): string {
  const obj = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return obj.text ?? obj.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

function parseJsonObject<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const matched = rawText.match(/\{[\s\S]*\}/);
    if (!matched) throw new Error("curator_model_json_parse_failed");
    return JSON.parse(matched[0]) as T;
  }
}

async function runGemini<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = request.model ?? CURATOR_DEFAULT_MODEL;
  pricingForModel(model);
  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: request.userText }] }],
    config: {
      systemInstruction: request.systemPrompt,
      temperature: 0,
      maxOutputTokens: request.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      responseJsonSchema: request.responseJsonSchema,
    },
  });
  const rawText = rawTextFromGeminiResponse(response);
  const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
  const inputTokens = Number(usage?.promptTokenCount ?? 0);
  const outputTokens = Number(usage?.candidatesTokenCount ?? 0);
  const costUsd = estimateAiCostUsd({ model, inputTokens, outputTokens });
  await logAiCost({
    layer: "warm",
    endpoint: `curator_${request.curatorName}`,
    provider: "gemini",
    model,
    inputTokens,
    outputTokens,
    costUsd,
    agentRunId: request.runId ?? null,
    latencyMs: Date.now() - startedAt,
  }).catch(() => undefined);

  return {
    provider: "gemini",
    model,
    parsed: parseJsonObject<T>(rawText),
    rawText,
    inputTokens,
    outputTokens,
    costUsd,
  };
}

async function runDeepSeek<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  const cfg = loadConfig();
  if (!cfg.deepseekApiKey) throw new Error("DEEPSEEK_API_KEY is not set");
  const model = request.model ?? CURATOR_DEEPSEEK_MODEL;
  pricingForModel(model);
  const startedAt = Date.now();
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.deepseekApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userText },
      ],
      temperature: 0,
      max_tokens: request.maxOutputTokens ?? 8192,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`deepseek_curator_failed:${response.status}:${body.slice(0, 160)}`);
  }
  const body = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
    };
  };
  const rawText = body.choices?.[0]?.message?.content ?? "{}";
  const inputTokens = Number(body.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(body.usage?.completion_tokens ?? 0);
  const cacheHitInputTokens = Number(body.usage?.prompt_cache_hit_tokens ?? 0);
  const cacheMissInputTokens = Number(body.usage?.prompt_cache_miss_tokens ?? 0);
  const costUsd = estimateAiCostUsd({
    model,
    inputTokens,
    outputTokens,
    cacheHitInputTokens,
    cacheMissInputTokens,
  });
  await logAiCost({
    layer: "warm",
    endpoint: `curator_${request.curatorName}`,
    provider: "deepseek",
    model,
    inputTokens,
    outputTokens,
    costUsd,
    agentRunId: request.runId ?? null,
    latencyMs: Date.now() - startedAt,
    metadata: { cacheHitInputTokens, cacheMissInputTokens },
  }).catch(() => undefined);

  return {
    provider: "deepseek",
    model,
    parsed: parseJsonObject<T>(rawText),
    rawText,
    inputTokens,
    outputTokens,
    costUsd,
  };
}

export async function generateCuratorJson<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  const provider = request.provider ?? "gemini";
  if (provider === "deepseek") return runDeepSeek<T>(request);
  return runGemini<T>(request);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateCuratorJsonWithRetry<T>(
  request: CuratorJsonRequest,
  attempts = 3,
): Promise<CuratorModelResult<T>> {
  let lastError: unknown;
  const safeAttempts = Math.max(1, Math.floor(attempts));
  for (let attempt = 1; attempt <= safeAttempts; attempt += 1) {
    try {
      return await generateCuratorJson<T>(request);
    } catch (error) {
      lastError = error;
      if (attempt < safeAttempts) {
        await sleep(250 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function postCuratorReceiver(input: {
  payload: Record<string, unknown>;
  receiverUrl: string;
  receiverSecret: string;
}): Promise<{ status: number; bodyText: string; prUrl: string | null }> {
  const response = await fetch(input.receiverUrl, {
    method: "POST",
    headers: {
      "x-curator-secret": input.receiverSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify(input.payload),
  });
  const bodyText = await response.text();
  let prUrl: string | null = null;
  try {
    const parsed = JSON.parse(bodyText) as { pr_url?: string };
    prUrl = parsed.pr_url ?? null;
  } catch {
    prUrl = null;
  }
  if (!response.ok) {
    throw new Error(`curator_receiver_failed:${response.status}:${bodyText.slice(0, 300)}`);
  }
  return { status: response.status, bodyText, prUrl };
}
