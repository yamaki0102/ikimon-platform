import { createHash, randomUUID } from "node:crypto";
import { loadConfig } from "../config.js";
import { AiProviderInvocationError, type AiProviderTelemetry } from "./aiExecutionBoundary.js";
import { type AiCostLayer, logAiCost } from "./aiCostLogger.js";
import { estimateAiCostUsd } from "./aiModelPricing.js";
import { executeMeteredAiOperation } from "./aiUsageRuntime.js";
import {
  getAiModelRoleChain,
  type AiModelProvider,
  type AiModelRef,
  type AiModelRoleChainName,
} from "./aiModels.js";
import {
  ThinkingLevel,
  generateGoogleContent,
  type GoogleGenerateResponse,
} from "./providers/googleGenAiOperations.js";

export type AiRouterPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};
export type AiRouterGenerateRequest = {
  chainName: AiModelRoleChainName;
  parts?: AiRouterPart[];
  text?: string;
  systemInstruction?: string;
  thinkingConfig?: { thinkingLevel?: "minimal" | "low" | "medium" | "high" };
  responseMimeType?: "application/json" | "text/plain";
  responseJsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  retriesPerModel?: number;
  retryDelayMs?: number;
  cost?: {
    layer: AiCostLayer;
    endpoint: string;
    tenantId?: string;
    project?: string;
    workspaceId?: string | null;
    operationVersion?: string;
    sourceDigest?: string;
    policyVersion?: string;
    promptVersion?: string;
    targetTime?: string | null;
    providerAccountId?: string | null;
    pricingVersion?: string;
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
  thoughtsTokens?: number;
  costUsd: number;
  providerRequestId: string | null;
  rawUsageJson: string;
};

type ProviderResult = AiRouterGenerateResult & { telemetry: AiProviderTelemetry };

function requestParts(request: AiRouterGenerateRequest): AiRouterPart[] {
  if (request.parts?.length) return request.parts;
  return [{ text: request.text ?? "" }];
}
function hasInlineData(parts: AiRouterPart[]): boolean { return parts.some((part) => Boolean(part.inlineData)) }
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
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)) }
function estimateCostOrZero(model: string, inputTokens: number, outputTokens: number): number {
  try { return estimateAiCostUsd({ model, inputTokens, outputTokens }) } catch { return 0 }
}
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex") }
function stableInput(request: AiRouterGenerateRequest): unknown {
  return {
    chainName: request.chainName,
    parts: requestParts(request).map((part) => part.inlineData
      ? { inlineData: { mimeType: part.inlineData.mimeType, sha256: sha256(part.inlineData.data) } }
      : { text: part.text ?? "" }),
    systemInstruction: request.systemInstruction,
    thinkingConfig: request.thinkingConfig,
    responseMimeType: request.responseMimeType,
    responseJsonSchema: request.responseJsonSchema,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
  };
}
function projectedCostMicros(ref: AiModelRef, request: AiRouterGenerateRequest): number {
  const serialized = JSON.stringify(stableInput(request));
  const inputTokens = Math.max(1, Math.ceil(serialized.length / 4));
  const outputTokens = Math.max(1, request.maxOutputTokens ?? 8_192);
  return Math.max(1, Math.ceil(estimateCostOrZero(ref.model, inputTokens, outputTokens) * 1_000_000));
}
function googleThinkingConfig(request: AiRouterGenerateRequest): { thinkingLevel?: ThinkingLevel } | undefined {
  const level = request.thinkingConfig?.thinkingLevel;
  if (!level) return undefined;
  if (level === "minimal") return { thinkingLevel: ThinkingLevel.MINIMAL };
  if (level === "low") return { thinkingLevel: ThinkingLevel.LOW };
  if (level === "medium") return { thinkingLevel: ThinkingLevel.MEDIUM };
  if (level === "high") return { thinkingLevel: ThinkingLevel.HIGH };
  return undefined;
}
export function googleResponseText(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const parts = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "").filter(Boolean).join("") ?? "";
  return parts || response.text || "";
}

async function logLegacyCost(
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
      aiModelChainModels: chain.map((item) => `${item.provider}:${item.model}`),
      aiModelThoughtsTokens: result.thoughtsTokens ?? 0,
      aiProviderRequestId: result.providerRequestId,
    },
  }).catch(() => undefined);
}

async function callGoogle(
  ref: AiModelRef,
  request: AiRouterGenerateRequest,
  provider: "gemini" | "vertex",
): Promise<ProviderResult> {
  const cfg = loadConfig();
  const client = provider === "gemini"
    ? { apiKey: cfg.geminiApiKey ?? "" }
    : { vertexai: true, project: cfg.vertexAi?.project ?? "", location: cfg.vertexAi?.location ?? "" };
  if (provider === "gemini" && !cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  if (provider === "vertex" && !cfg.vertexAi) throw new Error("VERTEX_AI_PROJECT is not set");
  const { response, telemetry } = await generateGoogleContent({
    client,
    request: {
      model: ref.model,
      contents: [{ role: "user", parts: requestParts(request) }],
      config: {
        systemInstruction: request.systemInstruction,
        thinkingConfig: googleThinkingConfig(request),
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        responseMimeType: request.responseMimeType === "text/plain" ? undefined : request.responseMimeType,
        responseJsonSchema: request.responseJsonSchema,
      },
    },
  });
  const typed = response as GoogleGenerateResponse & { usageMetadata?: { thoughtsTokenCount?: number } };
  const thoughtsTokens = Number(typed.usageMetadata?.thoughtsTokenCount ?? 0);
  const costUsd = estimateCostOrZero(ref.model, telemetry.inputTokens, telemetry.outputTokens);
  return {
    provider,
    model: ref.model,
    text: googleResponseText(response),
    inputTokens: telemetry.inputTokens,
    outputTokens: telemetry.outputTokens,
    thoughtsTokens,
    costUsd,
    providerRequestId: telemetry.providerRequestId,
    rawUsageJson: telemetry.rawUsageJson,
    telemetry: { ...telemetry, costUsdMicros: Math.ceil(costUsd * 1_000_000) },
  };
}
function openAiContentFromParts(parts: AiRouterPart[]): string | Array<Record<string, unknown>> {
  if (!hasInlineData(parts)) return textFromParts(parts);
  return parts.map((part) => {
    if (part.text) return { type: "text", text: part.text };
    const inline = part.inlineData;
    if (!inline?.mimeType.startsWith("image/")) throw new Error(`openai_compatible_unsupported_inline_data:${inline?.mimeType ?? "unknown"}`);
    return { type: "image_url", image_url: { url: `data:${inline.mimeType};base64,${inline.data}` } };
  });
}
async function callOpenAiCompatible(
  ref: AiModelRef,
  request: AiRouterGenerateRequest,
  apiKey: string,
  endpoint: string,
): Promise<ProviderResult> {
  if (!apiKey) throw new Error(`${ref.provider}_API_KEY is not set`);
  const messages: Array<Record<string, unknown>> = [];
  if (request.systemInstruction) messages.push({ role: "system", content: request.systemInstruction });
  messages.push({ role: "user", content: openAiContentFromParts(requestParts(request)) });
  const body: Record<string, unknown> = {
    model: ref.model, messages, temperature: request.temperature ?? 0,
    max_tokens: request.maxOutputTokens ?? 8_192,
  };
  const responseFormat = responseFormatForOpenAi(request);
  if (responseFormat) body.response_format = responseFormat;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new AiProviderInvocationError(error instanceof Error ? error.message : String(error), "error", {
      rawUsageJson: "{}", providerFailureCount: 1,
    }, { cause: error });
  }
  const providerRequestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const outcome = response.status === 429 ? "refused" : /408|504/u.test(String(response.status)) ? "timeout" : "error";
    throw new AiProviderInvocationError(`${ref.provider}_llm_failed:${response.status}:${responseText.slice(0, 160)}`, outcome, {
      providerRequestId, rawUsageJson: "{}", providerFailureCount: 1,
    });
  }
  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const rawUsageJson = JSON.stringify(json.usage ?? {});
  const inputTokens = Number(json.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(json.usage?.completion_tokens ?? 0);
  const costUsd = estimateCostOrZero(ref.model, inputTokens, outputTokens);
  const telemetry: AiProviderTelemetry = {
    providerRequestId, rawUsageJson, inputTokens, cachedInputTokens: 0, cacheWriteTokens: 0,
    outputTokens, costUsdMicros: Math.ceil(costUsd * 1_000_000), retryCount: 0,
    fallbackDepth: 0, providerFailureCount: 0,
  };
  return {
    provider: ref.provider, model: ref.model,
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens, outputTokens, costUsd, providerRequestId, rawUsageJson, telemetry,
  };
}
async function callProvider(ref: AiModelRef, request: AiRouterGenerateRequest): Promise<ProviderResult> {
  if (ref.provider === "gemini") return callGoogle(ref, request, "gemini");
  if (ref.provider === "vertex") return callGoogle(ref, request, "vertex");
  const cfg = loadConfig();
  if (ref.provider === "deepseek") {
    if (hasInlineData(requestParts(request))) throw new Error("deepseek_inline_data_unsupported");
    return callOpenAiCompatible(ref, request, cfg.deepseekApiKey ?? "", "https://api.deepseek.com/chat/completions");
  }
  return callOpenAiCompatible(
    ref, request,
    process.env.OPENAI_COMPATIBLE_API_KEY?.trim() ?? "",
    process.env.OPENAI_COMPATIBLE_CHAT_COMPLETIONS_URL?.trim() ?? "https://api.openai.com/v1/chat/completions",
  );
}

export async function generateAiTextWithRoleChain(request: AiRouterGenerateRequest): Promise<AiRouterGenerateResult> {
  const chain = getAiModelRoleChain(request.chainName);
  const retries = Math.max(1, Math.floor(request.retriesPerModel ?? 1));
  const retryDelayMs = Math.max(0, Math.floor(request.retryDelayMs ?? 250));
  const invocationId = randomUUID();
  const canonicalInput = stableInput(request);
  let lastError: unknown;

  for (const [fallbackIndex, ref] of chain.entries()) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const started = Date.now();
      try {
        const result = await executeMeteredAiOperation({
          provider: ref.provider,
          modelId: ref.model,
          canonicalInput,
          metadata: {
            tenantId: request.cost?.tenantId,
            project: request.cost?.project,
            workspaceId: request.cost?.workspaceId,
            feature: request.cost?.endpoint ?? request.chainName,
            operationVersion: request.cost?.operationVersion ?? "ai-model-router/v2",
            invocationId,
            sourceDigest: request.cost?.sourceDigest,
            policyVersion: request.cost?.policyVersion,
            promptVersion: request.cost?.promptVersion ?? request.chainName,
            targetTime: request.cost?.targetTime,
            providerAccountId: request.cost?.providerAccountId,
            pricingVersion: request.cost?.pricingVersion ?? `pricing:${ref.model}`,
            budgetProjection: {
              requestUsdMicros: projectedCostMicros(ref, request),
              retryCount: attempt - 1,
              fallbackDepth: fallbackIndex,
              providerFailureCount: 0,
            },
          },
          invoke: async () => {
            try {
              const providerResult = await callProvider(ref, request);
              if (!providerResult.text.trim()) throw new Error(`${ref.provider}_empty_response:${ref.model}`);
              return {
                value: providerResult,
                telemetry: {
                  ...providerResult.telemetry,
                  retryCount: attempt - 1,
                  fallbackDepth: fallbackIndex,
                },
              };
            } catch (error) {
              if (error instanceof AiProviderInvocationError) {
                throw new AiProviderInvocationError(error.message, error.outcome, {
                  ...error.telemetry,
                  retryCount: attempt - 1,
                  fallbackDepth: fallbackIndex,
                  providerFailureCount: Math.max(1, error.telemetry?.providerFailureCount ?? 1),
                }, { cause: error });
              }
              throw new AiProviderInvocationError(error instanceof Error ? error.message : String(error), "error", {
                rawUsageJson: "{}", retryCount: attempt - 1,
                fallbackDepth: fallbackIndex, providerFailureCount: 1,
              }, { cause: error });
            }
          },
        });
        await logLegacyCost(request, result, Date.now() - started, fallbackIndex, chain);
        const { telemetry: _telemetry, ...publicResult } = result;
        return publicResult;
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
