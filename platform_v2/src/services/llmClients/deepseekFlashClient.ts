// DeepSeek V4 Flash thin client for Relationship Score narrative generation.
// 既存 profileNoteDigest.ts のパターンを踏襲しつつ、汎用呼び出しに切り出す。

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
};

export type DeepSeekChatResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  rawJson: unknown;
};

type RawApiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

export class DeepSeekClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "DeepSeekClientError";
  }
}

function safeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
}

export async function callDeepSeekFlash(
  apiKey: string,
  request: DeepSeekChatRequest,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<DeepSeekChatResponse> {
  if (!apiKey) {
    throw new DeepSeekClientError("missing_api_key", "DEEPSEEK_API_KEY is required");
  }
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
    if (request.responseFormat === "json_object") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new DeepSeekClientError(
        "http_error",
        `DeepSeek call failed with status ${response.status}`,
        response.status
      );
    }

    const raw = (await response.json()) as RawApiResponse;
    const content = raw?.choices?.[0]?.message?.content;
    if (!content) {
      throw new DeepSeekClientError("empty_response", "DeepSeek returned no content");
    }
    return {
      content,
      inputTokens: safeInteger(raw.usage?.prompt_tokens),
      outputTokens: safeInteger(raw.usage?.completion_tokens),
      rawJson: raw,
    };
  } catch (error) {
    if (error instanceof DeepSeekClientError) {
      throw error;
    }
    if ((error as { name?: string })?.name === "AbortError") {
      throw new DeepSeekClientError("timeout", `DeepSeek call timed out after ${timeoutMs}ms`);
    }
    throw new DeepSeekClientError(
      "network_error",
      `DeepSeek call failed: ${(error as Error)?.message ?? "unknown"}`
    );
  } finally {
    clearTimeout(timer);
  }
}
