import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";
import { AiProviderInvocationError, type AiProviderTelemetry } from "../aiExecutionBoundary.js";

export { Modality, ThinkingLevel };
export type GoogleClientOptions = ConstructorParameters<typeof GoogleGenAI>[0];
export type GoogleGenerateRequest = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
export type GoogleGenerateResponse = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;

const DEFAULT_UNRECONCILED_GOOGLE_COST_USD_MICROS = 500_000;

function telemetry(response: GoogleGenerateResponse): AiProviderTelemetry {
  const usage = (response as {
    responseId?: string;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      cachedContentTokenCount?: number;
      totalTokenCount?: number;
    };
  }).usageMetadata;
  const inputTokens = Number(usage?.promptTokenCount ?? 0);
  const outputTokens = Number(usage?.candidatesTokenCount ?? 0) + Number(usage?.thoughtsTokenCount ?? 0);
  return {
    providerRequestId: (response as { responseId?: string }).responseId ?? null,
    rawUsageJson: JSON.stringify(usage ?? {}),
    inputTokens,
    cachedInputTokens: Number(usage?.cachedContentTokenCount ?? 0),
    cacheWriteTokens: 0,
    outputTokens,
    // Router and Curator replace this reservation with token-priced cost.
    // Audio and other non-token-priced calls retain it until invoice reconciliation.
    costUsdMicros: DEFAULT_UNRECONCILED_GOOGLE_COST_USD_MICROS,
    retryCount: 0,
    fallbackDepth: 0,
    providerFailureCount: 0,
  };
}

export async function generateGoogleContent(input: {
  client: GoogleClientOptions;
  request: GoogleGenerateRequest;
}): Promise<{ response: GoogleGenerateResponse; telemetry: AiProviderTelemetry }> {
  try {
    const response = await new GoogleGenAI(input.client).models.generateContent(input.request);
    return { response, telemetry: telemetry(response) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const outcome = /timeout|timed out/i.test(message) ? "timeout" : "error";
    throw new AiProviderInvocationError(message, outcome, {
      rawUsageJson: "{}",
      providerFailureCount: 1,
    }, { cause: error });
  }
}

export async function createGoogleAuthToken(input: {
  client: GoogleClientOptions;
  request: Parameters<GoogleGenAI["authTokens"]["create"]>[0];
}): Promise<{ token: Awaited<ReturnType<GoogleGenAI["authTokens"]["create"]>>; telemetry: AiProviderTelemetry }> {
  try {
    const token = await new GoogleGenAI(input.client).authTokens.create(input.request);
    return {
      token,
      telemetry: {
        providerRequestId: null,
        rawUsageJson: "{}",
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        costUsdMicros: 0,
        retryCount: 0,
        fallbackDepth: 0,
        providerFailureCount: 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AiProviderInvocationError(message, "error", {
      rawUsageJson: "{}",
      providerFailureCount: 1,
    }, { cause: error });
  }
}
