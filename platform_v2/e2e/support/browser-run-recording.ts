/** Pure decoding/minimization helpers for the existing Browser Run diagnostic lane. */
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Network targets belong to the finalized recording, not session acquisition. */
export function recordingTargetIds(payload: unknown, expectedSessionId: string): string[] | null {
  if (!record(payload) || payload.success !== true || !record(payload.result)) return null;
  const result = payload.result;
  if (!expectedSessionId || result.sessionId !== expectedSessionId || !record(result.events)) return null;
  const entries = Object.entries(result.events);
  if (entries.length === 0 || entries.some(([id, events]) => !/^[A-Za-z0-9_-]{1,199}$/u.test(id) || !Array.isArray(events))) return null;
  return entries.map(([id]) => id);
}

function numberOrUnknown(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : -1;
}

function protocol(value: unknown): string {
  return typeof value === "string" && /^HTTP\/(?:1\.[01]|2(?:\.0)?|3(?:\.0)?)$/iu.test(value) ? value : "";
}

function mimeType(value: unknown): string {
  if (typeof value !== "string") return "application/octet-stream";
  const base = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  // Metadata-only export: no arbitrary provider strings, MIME parameters or bodies.
  const allowed = ["application/json", "application/javascript", "application/octet-stream", "text/html", "text/plain", "text/css", "image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  return allowed.includes(base) ? base : "application/octet-stream";
}

function originOnly(value: unknown): string {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return "about:blank";
    // Paths can contain reset tokens or private IDs too. Full URLs stay in native Inspect.
    return url.origin + "/[redacted-path]";
  } catch {
    return "about:blank";
  }
}

/**
 * Keep a HAR 1.2-shaped diagnostic summary, not a replayable authenticated request.
 * Allowlisting drops header/cookie/query/form values, bodies, comments and extension fields.
 * Regex redaction misses HAR's {name, value} headers and short credentials.
 */
export function minimizeRecordingHar(payload: unknown): Record<string, unknown> | null {
  if (!record(payload) || payload.success === false || !record(payload.log)
    || payload.log.version !== "1.2" || !Array.isArray(payload.log.entries)) return null;
  const entries: Record<string, unknown>[] = [];
  for (const item of payload.log.entries) {
    if (!record(item) || !record(item.request) || !record(item.response) || !record(item.timings)) return null;
    const request = item.request;
    const response = item.response;
    if (typeof response.status !== "number" || !Number.isInteger(response.status) || response.status < 0 || response.status > 599) return null;
    const timestamp = typeof item.startedDateTime === "string" ? Date.parse(item.startedDateTime) : NaN;
    if (!Number.isFinite(timestamp)) return null;
    const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"];
    const method = typeof request.method === "string" && methods.includes(request.method) ? request.method : "OTHER";
    const content = record(response.content) ? response.content : {};
    const sourceTimings = item.timings;
    const timings = Object.fromEntries(["blocked", "dns", "connect", "send", "wait", "receive", "ssl"].map((key) => [key, numberOrUnknown(sourceTimings[key])]));
    entries.push({
      startedDateTime: new Date(timestamp).toISOString(),
      time: numberOrUnknown(item.time),
      request: {
        method, url: originOnly(request.url), httpVersion: protocol(request.httpVersion),
        headers: [], queryString: [], cookies: [],
        headersSize: numberOrUnknown(request.headersSize), bodySize: numberOrUnknown(request.bodySize),
      },
      response: {
        status: response.status, statusText: "", httpVersion: protocol(response.httpVersion),
        headers: [], cookies: [], redirectURL: "",
        headersSize: numberOrUnknown(response.headersSize), bodySize: numberOrUnknown(response.bodySize),
        content: { size: numberOrUnknown(content.size), mimeType: mimeType(content.mimeType) },
      },
      cache: {}, timings,
    });
  }
  return { log: { version: "1.2", creator: { name: "ZUKAN Browser Run metadata-only", version: "1" }, entries } };
}
