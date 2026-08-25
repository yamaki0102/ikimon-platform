import { loadConfig } from "../config.js";
import { AiProviderInvocationError } from "./aiExecutionBoundary.js";
import { logAiCost } from "./aiCostLogger.js";
import {
  CURATOR_DEEPSEEK_MODEL,
  CURATOR_DEFAULT_MODEL,
  estimateAiCostUsd,
  pricingForModel,
} from "./aiModelPricing.js";
import { executeMeteredAiOperation } from "./aiUsageRuntime.js";
import { generateGoogleContent } from "./providers/googleGenAiOperations.js";

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

function responseText(response: unknown): string {
  const value = response as { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return value.text ?? value.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}
function parseJsonObject<T>(rawText: string): T {
  try { return JSON.parse(rawText) as T } catch {
    const matched = rawText.match(/\{[\s\S]*\}/u);
    if (!matched) throw new Error("curator_model_json_parse_failed");
    return JSON.parse(matched[0]) as T;
  }
}
function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  return Math.ceil(estimateAiCostUsd({ model, inputTokens, outputTokens }) * 1_000_000);
}

async function logLegacy(request: CuratorJsonRequest, result: CuratorModelResult<unknown>, metadata: Record<string, unknown> = {}): Promise<void> {
  await logAiCost({
    layer: "warm",
    endpoint: `curator_${request.curatorName}`,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    agentRunId: request.runId ?? null,
    metadata,
  }).catch(() => undefined);
}

async function runGemini<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = request.model ?? CURATOR_DEFAULT_MODEL;
  pricingForModel(model);
  const value = await executeMeteredAiOperation({
    provider: "gemini",
    modelId: model,
    canonicalInput: {
      curatorName: request.curatorName,
      systemPrompt: request.systemPrompt,
      userText: request.userText,
      responseJsonSchema: request.responseJsonSchema,
      maxOutputTokens: request.maxOutputTokens,
    },
    metadata: {
      feature: `curator_${request.curatorName}`,
      operationVersion: "curator-json/v2",
      invocationId: request.runId ?? undefined,
      extractionRunId: request.runId ?? null,
      promptVersion: `curator:${request.curatorName}:v2`,
      pricingVersion: `pricing:${model}`,
      budgetProjection: {
        requestUsdMicros: Math.max(1, costMicros(model, Math.ceil((request.systemPrompt.length + request.userText.length) / 4), request.maxOutputTokens ?? 8_192)),
        retryCount: 0,
        fallbackDepth: 0,
        providerFailureCount: 0,
      },
    },
    invoke: async () => {
      const result = await generateGoogleContent({
        client: { apiKey: cfg.geminiApiKey },
        request: {
          model,
          contents: [{ role: "user", parts: [{ text: request.userText }] }],
          config: {
            systemInstruction: request.systemPrompt,
            temperature: 0,
            maxOutputTokens: request.maxOutputTokens ?? 8_192,
            responseMimeType: "application/json",
            responseJsonSchema: request.responseJsonSchema,
          },
        },
      });
      const micros = costMicros(model, result.telemetry.inputTokens, result.telemetry.outputTokens);
      return {
        value: {
          response: result.response,
          telemetry: { ...result.telemetry, costUsdMicros: micros },
        },
        telemetry: { ...result.telemetry, costUsdMicros: micros },
      };
    },
  });
  const rawText = responseText(value.response);
  const output: CuratorModelResult<T> = {
    provider: "gemini",
    model,
    parsed: parseJsonObject<T>(rawText),
    rawText,
    inputTokens: value.telemetry.inputTokens,
    outputTokens: value.telemetry.outputTokens,
    costUsd: value.telemetry.costUsdMicros / 1_000_000,
  };
  await logLegacy(request, output);
  return output;
}

async function runDeepSeek<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  const cfg = loadConfig();
  if (!cfg.deepseekApiKey) throw new Error("DEEPSEEK_API_KEY is not set");
  const model = request.model ?? CURATOR_DEEPSEEK_MODEL;
  pricingForModel(model);
  const result = await executeMeteredAiOperation({
    provider: "deepseek",
    modelId: model,
    canonicalInput: {
      curatorName: request.curatorName,
      systemPrompt: request.systemPrompt,
      userText: request.userText,
      maxOutputTokens: request.maxOutputTokens,
    },
    metadata: {
      feature: `curator_${request.curatorName}`,
      operationVersion: "curator-json/v2",
      invocationId: request.runId ?? undefined,
      extractionRunId: request.runId ?? null,
      promptVersion: `curator:${request.curatorName}:v2`,
      pricingVersion: `pricing:${model}`,
      budgetProjection: {
        requestUsdMicros: Math.max(1, costMicros(model, Math.ceil((request.systemPrompt.length + request.userText.length) / 4), request.maxOutputTokens ?? 8_192)),
        retryCount: 0,
        fallbackDepth: 0,
        providerFailureCount: 0,
      },
    },
    invoke: async () => {
      let response: Response;
      try {
        response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${cfg.deepseekApiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userText },
            ],
            temperature: 0,
            max_tokens: request.maxOutputTokens ?? 8_192,
            response_format: { type: "json_object" },
          }),
        });
      } catch (error) {
        throw new AiProviderInvocationError(error instanceof Error ? error.message : String(error), "error", {
          rawUsageJson: "{}", providerFailureCount: 1,
        }, { cause: error });
      }
      const providerRequestId = response.headers.get("x-request-id");
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AiProviderInvocationError(`deepseek_curator_failed:${response.status}:${body.slice(0, 160)}`, response.status === 429 ? "refused" : "error", {
          providerRequestId, rawUsageJson: "{}", providerFailureCount: 1,
        });
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
      const inputTokens = Number(body.usage?.prompt_tokens ?? 0);
      const outputTokens = Number(body.usage?.completion_tokens ?? 0);
      const cacheHitInputTokens = Number(body.usage?.prompt_cache_hit_tokens ?? 0);
      const cacheMissInputTokens = Number(body.usage?.prompt_cache_miss_tokens ?? 0);
      const micros = Math.ceil(estimateAiCostUsd({
        model, inputTokens, outputTokens,
        cacheHitInputTokens, cacheMissInputTokens,
      }) * 1_000_000);
      const telemetry = {
        providerRequestId,
        rawUsageJson: JSON.stringify(body.usage ?? {}),
        inputTokens,
        cachedInputTokens: cacheHitInputTokens,
        cacheWriteTokens: 0,
        outputTokens,
        costUsdMicros: micros,
        retryCount: 0,
        fallbackDepth: 0,
        providerFailureCount: 0,
      };
      return { value: { body, telemetry }, telemetry };
    },
  });
  const rawText = result.body.choices?.[0]?.message?.content ?? "{}";
  const output: CuratorModelResult<T> = {
    provider: "deepseek",
    model,
    parsed: parseJsonObject<T>(rawText),
    rawText,
    inputTokens: result.telemetry.inputTokens,
    outputTokens: result.telemetry.outputTokens,
    costUsd: result.telemetry.costUsdMicros / 1_000_000,
  };
  await logLegacy(request, output, { cachedInputTokens: result.telemetry.cachedInputTokens });
  return output;
}

export async function generateCuratorJson<T>(request: CuratorJsonRequest): Promise<CuratorModelResult<T>> {
  return (request.provider ?? "gemini") === "deepseek" ? runDeepSeek<T>(request) : runGemini<T>(request);
}
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)) }
export async function generateCuratorJsonWithRetry<T>(request: CuratorJsonRequest, attempts = 3): Promise<CuratorModelResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, Math.floor(attempts)); attempt += 1) {
    try { return await generateCuratorJson<T>(request) } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(250 * attempt);
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
    headers: { "x-curator-secret": input.receiverSecret, "content-type": "application/json" },
    body: JSON.stringify(input.payload),
  });
  const bodyText = await response.text();
  let prUrl: string | null = null;
  try { prUrl = (JSON.parse(bodyText) as { pr_url?: string }).pr_url ?? null } catch { prUrl = null }
  if (!response.ok) throw new Error(`curator_receiver_failed:${response.status}:${bodyText.slice(0, 300)}`);
  return { status: response.status, bodyText, prUrl };
}
