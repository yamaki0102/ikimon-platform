import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { logAiCost, type AiCostLayer } from "./aiCostLogger.js";
import { estimateAiCostUsd } from "./aiModelPricing.js";
import {
  getAiModelRoleChain,
  type AiModelProvider,
  type AiModelRef,
  type AiModelRoleChainName,
} from "./aiModels.js";

export type AiRouterPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

export type AiRouterGenerateRequest = {
  chainName: AiModelRoleChainName;
  parts?: AiRouterPart[];
  text?: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  responseJsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  retriesPerModel?: number;
  retryDelayMs?: number;
  cost?: {
    layer: AiCostLayer;
    endpoint: string;
    userId?: string | null;
    visitId?: string | null;
    occurrenceId?: string | null;
    agentRunId?: string | null;
    metadata?: Record<string, unknown>;
  };
};

export type AiRouterGenerateResult = {
  provider: AiModelProvider;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

function requestParts(request: AiRouterGenerateRequest): AiRouterPart[] {
  if (request.parts?.length) return request.parts;
  return [{ text: request.text ?? "" }];
}

function hasInlineData(parts: AiRouterPart[]): boolean {
  return parts.some((part) => Boolean(part.inlineData));
}

function textFromParts(parts: AiRouterPart[]): string {
  return parts.map((part) => part.text ?? "").filter(Boolean).join("\n\n");
}

function responseFormatForOpenAi(request: AiRouterGenerateRequest): Record<string, unknown> | undefined {
  return request.responseMimeType === "application/json" ? { type: "json_object" } : undefined;
}

function isRetriable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota|timeout|network/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateCostOrZero(model: string, inputTokens: number, outputTokens: number): number {
  try {
    return estimateAiCostUsd({ model, inputTokens, outputTokens });
  } catch {
    return 0;
  }
}

async function logCost(
  request: AiRouterGenerateRequest,
  result: AiRouterGenerateResult,
  latencyMs: number,
  fallbackIndex: number,
  chain: AiModelRef[],
): Promise<void> {
  if (!request.cost) return;
  await logAiCost({
    layer: request.cost.layer,
    endpoint: request.cost.endpoint,
    provider: result.provider === "openai-compatible" ? "openai" : result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    userId: request.cost.userId ?? null,
    visitId: request.cost.visitId ?? null,
    occurrenceId: request.cost.occurrenceId ?? null,
    agentRunId: request.cost.agentRunId ?? null,
    latencyMs,
    metadata: {
      ...(request.cost.metadata ?? {}),
      aiModelChain: request.chainName,
      aiModelProvider: result.provider,
      aiModelFallbackIndex: fallbackIndex,
      aiModelFallbackUsed: fallbackIndex > 0,
      aiModelChainLength: chain.length,
      aiModelChainModels: chain.map((ref) => `${ref.provider}:${ref.model}`),
    },
  }).catch(() => undefined);
}

async function callGemini(ref: AiModelRef, request: AiRouterGenerateRequest): Promise<AiRouterGenerateResult> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
  return callGoogleGenAi(ai, ref, request, "gemini");
}

async function callVertex(ref: AiModelRef, request: AiRouterGenerateRequest): Promise<AiRouterGenerateResult> {
  const cfg = loadConfig();
  if (!cfg.vertexAi) throw new Error("VERTEX_AI_PROJECT is not set");
  const ai = new GoogleGenAI({
    vertexai: true,
    project: cfg.vertexAi.project,
    location: cfg.vertexAi.location,
  });
  return callGoogleGenAi(ai, ref, request, "vertex");
}

async function callGoogleGenAi(
  ai: GoogleGenAI,
  ref: AiModelRef,
  request: AiRouterGenerateRequest,
  provider: "gemini" | "vertex",
): Promise<AiRouterGenerateResult> {
  const response = await ai.models.generateContent({
    model: ref.model,
    contents: [{ role: "user", parts: requestParts(request) }],
    config: {
      systemInstruction: request.systemInstruction,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseMimeType: request.responseMimeType === "text/plain" ? undefined : request.responseMimeType,
      responseJsonSchema: request.responseJsonSchema,
    },
  });
  const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
  const inputTokens = Number(usage?.promptTokenCount ?? 0);
  const outputTokens = Number(usage?.candidatesTokenCount ?? 0);
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    provider,
    model: ref.model,
    text,
    inputTokens,
    outputTokens,
    costUsd: estimateCostOrZero(ref.model, inputTokens, outputTokens),
  };
}

function openAiContentFromParts(parts: AiRouterPart[]): string | Array<Record<string, unknown>> {
  if (!hasInlineData(parts)) return textFromParts(parts);
  return parts.map((part) => {
    if (part.text) return { type: "text", text: part.text };
    const inline = part.inlineData;
    if (!inline?.mimeType.startsWith("image/")) {
      throw new Error(`openai_compatible_unsupported_inline_data:${inline?.mimeType ?? "unknown"}`);
    }
    return {
      type: "image_url",
      image_url: { url: `data:${inline.mimeType};base64,${inline.data}` },
    };
  });
}

async function callOpenAiCompatible(
  ref: AiModelRef,
  request: AiRouterGenerateRequest,
  apiKey: string,
  endpoint: string,
): Promise<AiRouterGenerateResult> {
  if (!apiKey) throw new Error(`${ref.provider}_API_KEY is not set`);
  const messages: Array<Record<string, unknown>> = [];
  if (request.systemInstruction) {
    messages.push({ role: "system", content: request.systemInstruction });
  }
  messages.push({ role: "user", content: openAiContentFromParts(requestParts(request)) });
  const body: Record<string, unknown> = {
    model: ref.model,
    messages,
    temperature: request.temperature ?? 0,
    max_tokens: request.maxOutputTokens ?? 8192,
  };
  const responseFormat = responseFormatForOpenAi(request);
  if (responseFormat) body.response_format = responseFormat;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`${ref.provider}_llm_failed:${response.status}:${bodyText.slice(0, 160)}`);
  }
  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const inputTokens = Number(json.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(json.usage?.completion_tokens ?? 0);
  return {
    provider: ref.provider,
    model: ref.model,
    text,
    inputTokens,
    outputTokens,
    costUsd: estimateCostOrZero(ref.model, inputTokens, outputTokens),
  };
}

async function callProvider(ref: AiModelRef, request: AiRouterGenerateRequest): Promise<AiRouterGenerateResult> {
  if (ref.provider === "gemini") return callGemini(ref, request);
  if (ref.provider === "vertex") return callVertex(ref, request);
  const cfg = loadConfig();
  if (ref.provider === "deepseek") {
    if (hasInlineData(requestParts(request))) throw new Error("deepseek_inline_data_unsupported");
    return callOpenAiCompatible(ref, request, cfg.deepseekApiKey ?? "", "https://api.deepseek.com/chat/completions");
  }
  return callOpenAiCompatible(
    ref,
    request,
    process.env.OPENAI_COMPATIBLE_API_KEY?.trim() ?? "",
    process.env.OPENAI_COMPATIBLE_CHAT_COMPLETIONS_URL?.trim() ?? "https://api.openai.com/v1/chat/completions",
  );
}

export async function generateAiTextWithRoleChain(request: AiRouterGenerateRequest): Promise<AiRouterGenerateResult> {
  const chain = getAiModelRoleChain(request.chainName);
  const retries = Math.max(1, Math.floor(request.retriesPerModel ?? 1));
  const retryDelayMs = Math.max(0, Math.floor(request.retryDelayMs ?? 250));
  let lastError: unknown;

  for (const [fallbackIndex, ref] of chain.entries()) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const started = Date.now();
      try {
        const result = await callProvider(ref, request);
        if (!result.text.trim()) throw new Error(`${ref.provider}_empty_response:${ref.model}`);
        await logCost(request, result, Date.now() - started, fallbackIndex, chain);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < retries && isRetriable(error)) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
