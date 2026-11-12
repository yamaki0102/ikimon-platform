import type { Env, D1Value } from "./env";

export function assertSameOriginRequest(request: Request, requireOrigin = false): Response | null {
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }

  const origin = request.headers.get("origin")?.trim();
  if (!origin) {
    return requireOrigin
      ? json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" })
      : null;
  }

  const url = new URL(request.url);
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  if (parsedOrigin.protocol !== url.protocol || parsedOrigin.host !== url.host) {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  return null;
}

export function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function clampInteger(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : min;
}

export function formatPublicObservationDate(value: string | null | undefined): string {
  if (!value) return "日時不明";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) }
  });
}

export function html(body: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(body.replace(/<head([^>]*)>/i, '<head$1><meta name="format-detection" content="telephone=no">'), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(headers ?? {}) }
  });
}

export function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `missing_${field}`);
  }
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stringValue(value: D1Value | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

export function stringOrNullFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function numberOrNullFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }
  return value;
}

export function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function finiteNumberOrNull(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function integerOrNull(value: unknown): number | null {
  const numberValue = finiteNumberOrNull(value);
  return numberValue == null ? null : Math.trunc(numberValue);
}

export function integerOrZero(value: unknown): number {
  return integerOrNull(value) ?? 0;
}

export function normalizeOptionalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "upload.jpg";
}

export function base64ToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export function textToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

export function arrayBufferToText(value: ArrayBuffer): string {
  return new TextDecoder().decode(value);
}

export function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return base64ToArrayBuffer(padded);
}

export function base64UrlEncodeText(value: string): string {
  return arrayBufferToBase64Url(textToArrayBuffer(value));
}

export function constantTimeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let index = 0; index < max; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return diff === 0;
}

export function concatBytes(...parts: Array<ArrayBuffer | Uint8Array>): ArrayBuffer {
  const chunks = parts.map((part) => part instanceof Uint8Array ? part : new Uint8Array(part));
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

export function arrayBufferToHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret: string, value: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return arrayBufferToHex(await crypto.subtle.sign("HMAC", key, value));
}

export function sanitizeIdPart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || crypto.randomUUID();
}

export async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  return headerValue.split(";").map((part) => part.trim()).filter(Boolean).reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export function headerFirst(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

export function redirect303(location: string, headers?: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location,
      ...(headers ?? {})
    }
  });
}

export function secureCookieAttribute(env: Env): string {
  return env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging" ? " Secure;" : "";
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
