import { createHmac } from "node:crypto";

/** Provisional receiver contract: POST /api/exports on nocosil.com. The HMAC input is
 * `${unixSeconds}.${exportId}.${exactUtf8Body}`; receiver must verify this exact form.
 */
export type NocosilExportInput = {
  exportId: string;
  /** Serialized once by the caller; transmitted and signed byte-for-byte as UTF-8. */
  body: string;
  secret: string;
  /** Optional path/endpoint for receiver contract changes; origin must remain allowlisted. */
  endpoint?: string;
};

export type NocosilExportDependencies = {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
};

export type NocosilExportResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status?: number; attempts: number; error: "http_error" | "redirect_rejected" | "timeout" | "network_error" };

const DEFAULT_ENDPOINT = "https://nocosil.com/api/exports";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 250;
const RETRY_CAP_MS = 4_000;

function validateEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid NOCOSIL export endpoint");
  }
  if (url.protocol !== "https:" || url.hostname !== "nocosil.com" || url.username || url.password || url.port) {
    throw new Error("NOCOSIL export endpoint must use HTTPS on nocosil.com");
  }
  return url;
}

function signature(secret: string, timestamp: string, exportId: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${exportId}.${body}`, "utf8")
    .digest("hex");
}

function isTimeout(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === "AbortError");
}

/** Sends an already rights-screened export package. Caller owns the feature-off gate. */
export async function sendNocosilExport(
  input: NocosilExportInput,
  dependencies: NocosilExportDependencies = {},
): Promise<NocosilExportResult> {
  if (!input.exportId.trim() || input.exportId.length > 200 || /[\r\n]/u.test(input.exportId)) {
    throw new Error("NOCOSIL export ID must be a non-empty single-line value of at most 200 characters");
  }
  if (!input.secret) throw new Error("NOCOSIL export signing secret is required");
  const endpoint = validateEndpoint(input.endpoint ?? DEFAULT_ENDPOINT).toString();
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const requestedTimeout = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestedAttempts = dependencies.maxAttempts ?? MAX_ATTEMPTS;
  const timeoutMs = Number.isFinite(requestedTimeout) ? Math.max(1, Math.floor(requestedTimeout)) : DEFAULT_TIMEOUT_MS;
  const maxAttempts = Number.isFinite(requestedAttempts)
    ? Math.min(MAX_ATTEMPTS, Math.max(1, Math.floor(requestedAttempts)))
    : MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timestamp = String(Math.floor(now() / 1000));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Idempotency-Key": input.exportId,
          "X-Nocosil-Timestamp": timestamp,
          "X-Nocosil-Signature": `sha256=${signature(input.secret, timestamp, input.exportId, input.body)}`,
        },
        body: input.body,
      });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, status: response.status, attempts: attempt, error: "redirect_rejected" };
      }
      if (response.ok) return { ok: true, status: response.status, attempts: attempt };
      if (!(response.status === 429 || response.status >= 500)) {
        return { ok: false, status: response.status, attempts: attempt, error: "http_error" };
      }
      if (attempt === maxAttempts) return { ok: false, status: response.status, attempts: attempt, error: "http_error" };
    } catch (error) {
      if (isTimeout(error, controller.signal)) return { ok: false, attempts: attempt, error: "timeout" };
      if (attempt === maxAttempts) return { ok: false, attempts: attempt, error: "network_error" };
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(RETRY_BASE_MS * (2 ** (attempt - 1)), RETRY_CAP_MS));
  }
  // maxAttempts is clamped to >=1, so this is unreachable.
  return { ok: false, attempts: maxAttempts, error: "network_error" };
}
