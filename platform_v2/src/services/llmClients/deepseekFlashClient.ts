// DeepSeek thin client with the shared AI execution/metering boundary.

import { AiProviderInvocationError } from "../aiExecutionBoundary.js";
import { estimateAiCostUsd } from "../aiModelPricing.js";
import { executeMeteredAiOperation } from "../aiUsageRuntime.js";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekChatRequest = {
  model: string;
  messages: DeepSeekMessage[];
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  usage?: {
    tenantId?: string;
    project?: string;
    workspaceId?: string | null;
    feature?: string;
    operationVersion?: string;
    invocationId?: string;
    sourceDigest?: string;
    policyVersion?: string;
    promptVersion?: string;
    pricingVersion?: string;
  };
};

export type DeepSeekChatResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  rawJson: unknown;
  providerRequestId: string | null;
};

type RawApiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
};

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

export class DeepSeekClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DeepSeekClientError";
  }
}

function safeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  return 0;
}

function projectedCostUsdMicros(request: DeepSeekChatRequest): number {
  const inputTokens = Math.max(1, Math.ceil(JSON.stringify(request.messages).length / 4));
  const outputTokens = Math.max(1, request.maxTokens ?? 600);
  try {
    return Math.max(1, Math.ceil(estimateAiCostUsd({
      model: request.model,
      inputTokens,
      outputTokens,
    }) * 1_000_000));
  } catch {
    return 500_000;
  }
}

function actualCostUsdMicros(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitInputTokens: number;
  cacheMissInputTokens: number;
}): number {
  try {
    return Math.max(0, Math.ceil(estimateAiCostUsd(input) * 1_000_000));
  } catch {
    return 500_000;
  }
}

async function rawDeepSeekCall(
  apiKey: string,
  request: DeepSeekChatRequest,
  endpoint: string,
): Promise<{
  response: DeepSeekChatResponse;
  telemetry: {
    providerRequestId: string | null;
    rawUsageJson: string;
    inputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
    costUsdMicros: number;
    retryCount: number;
    fallbackDepth: number;
    providerFailureCount: number;
  };
}> {
  if (!apiKey) throw new DeepSeekClientError("missing_api_key", "DEEPSEEK_API_KEY is required");
  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 600,
      temperature: request.temperature ?? 0.4,
    };
    if (request.responseFormat === "json_object") body.response_format = { type: "json_object" };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        throw new DeepSeekClientError("timeout", `DeepSeek call timed out after ${timeoutMs}ms`);
      }
      throw new DeepSeekClientError(
        "network_error",
        `DeepSeek call failed: ${(error as Error)?.message ?? "unknown"}`,
      );
    }

    const providerRequestId = response.headers.get("x-request-id");
    if (!response.ok) {
      throw new DeepSeekClientError(
        "http_error",
        `DeepSeek call failed with status ${response.status}`,
        response.status,
      );
    }

    const raw = await response.json() as RawApiResponse;
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new DeepSeekClientError("empty_response", "DeepSeek returned no content");
    const inputTokens = safeInteger(raw.usage?.prompt_tokens);
    const outputTokens = safeInteger(raw.usage?.completion_tokens);
    const cacheHitInputTokens = safeInteger(raw.usage?.prompt_cache_hit_tokens);
    const cacheMissInputTokens = safeInteger(raw.usage?.prompt_cache_miss_tokens);
    const result: DeepSeekChatResponse = {
      content,
      inputTokens,
      outputTokens,
      rawJson: raw,
      providerRequestId,
    };
    return {
      response: result,
      telemetry: {
        providerRequestId,
        rawUsageJson: JSON.stringify(raw.usage ?? {}),
        inputTokens,
        cachedInputTokens: cacheHitInputTokens,
        cacheWriteTokens: 0,
        outputTokens,
        costUsdMicros: actualCostUsdMicros({
          model: request.model,
          inputTokens,
          outputTokens,
          cacheHitInputTokens,
          cacheMissInputTokens,
        }),
        retryCount: 0,
        fallbackDepth: 0,
        providerFailureCount: 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callDeepSeekFlash(
  apiKey: string,
  request: DeepSeekChatRequest,
  endpoint: string = DEFAULT_ENDPOINT,
): Promise<DeepSeekChatResponse> {
  try {
    return await executeMeteredAiOperation({
      provider: "deepseek",
      modelId: request.model,
      canonicalInput: {
        messages: request.messages,
        responseFormat: request.responseFormat,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      },
      metadata: {
        tenantId: request.usage?.tenantId,
        project: request.usage?.project,
        workspaceId: request.usage?.workspaceId,
        feature: request.usage?.feature ?? "deepseek_flash",
        operationVersion: request.usage?.operationVersion ?? "deepseek-flash/v2",
        invocationId: request.usage?.invocationId,
        sourceDigest: request.usage?.sourceDigest,
        policyVersion: request.usage?.policyVersion,
        promptVersion: request.usage?.promptVersion ?? "deepseek-flash/v2",
        pricingVersion: request.usage?.pricingVersion ?? `pricing:${request.model}`,
        budgetProjection: {
          requestUsdMicros: projectedCostUsdMicros(request),
          retryCount: 0,
          fallbackDepth: 0,
          providerFailureCount: 0,
        },
      },
      invoke: async () => {
        try {
          const result = await rawDeepSeekCall(apiKey, request, endpoint);
          return { value: result.response, telemetry: result.telemetry };
        } catch (error) {
          const clientError = error instanceof DeepSeekClientError
            ? error
            : new DeepSeekClientError("unknown", error instanceof Error ? error.message : String(error));
          const outcome = clientError.code === "timeout"
            ? "timeout"
            : clientError.status === 429
              ? "refused"
              : "error";
          throw new AiProviderInvocationError(clientError.message, outcome, {
            rawUsageJson: "{}",
            providerFailureCount: 1,
          }, { cause: clientError });
        }
      },
    });
  } catch (error) {
    if (error instanceof AiProviderInvocationError && error.cause instanceof DeepSeekClientError) {
      throw error.cause;
    }
    throw error;
  }
}
