import type { Env } from "./env";
import { escapeHtml, html, parseCookies, randomToken, sha256Hex, textToArrayBuffer } from "./http";
import { PRODUCTION_PUBLIC_ORIGIN, STAGING_PUBLIC_ORIGIN } from "../../../src/services/trustedPublicOrigin";
import { MUNICIPAL_INBOX_ROLE } from "../biosecurity";

export interface SessionSnapshot {
  tokenHash: string;
  userId: string;
  displayName: string;
  roleName: string;
  rankLabel: string | null;
  banned: boolean;
  expiresAt: string;
}

export type FieldManagerRole = "owner" | "steward" | "viewer_exact";

export const PUBLIC_MAP_PLACEHOLDER_PHOTO_WIDTH = 320;

export const PUBLIC_MAP_PLACEHOLDER_PHOTO_HEIGHT = 240;

export const PUBLIC_MAP_PLACEHOLDER_PHOTO_MAX_BYTES = 12_000;

export function presentablePublicPhotoSql(alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  return `AND NOT (
        COALESCE(${prefix}width, 0) = ${PUBLIC_MAP_PLACEHOLDER_PHOTO_WIDTH}
        AND COALESCE(${prefix}height, 0) = ${PUBLIC_MAP_PLACEHOLDER_PHOTO_HEIGHT}
        AND COALESCE(${prefix}bytes, 0) > 0
        AND ${prefix}bytes <= ${PUBLIC_MAP_PLACEHOLDER_PHOTO_MAX_BYTES}
      )
      AND NOT (
        COALESCE(${prefix}width, 0) = 1
        AND COALESCE(${prefix}height, 0) = 1
      )`;
}

export interface PublicDetailAssetRow {
  asset_id: string;
  object_key: string;
  mime: string;
  bytes: number;
  duration_ms: number | null;
  public_derivative_key: string | null;
  sha256: string | null;
  public_derivative_sha256: string | null;
  public_derivative_metadata_json: string | null;
}

export const SESSION_COOKIE_NAME = "ikimon_v2_session";

const PUBLIC_LANG_PREFIX_PATTERN = /^\/(?:ja|en|es|pt-br)(?=\/|$)/;

export function stripPublicLangPrefix(pathname: string): string {
  const stripped = pathname.replace(PUBLIC_LANG_PREFIX_PATTERN, "");
  return stripped === "" ? "/" : stripped;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function asPlainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function jsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function jsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function roundPublicEventCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isD1UniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unique constraint|constraint failed/i.test(message);
}

export function isMunicipalWalkMapAdminRole(session: SessionSnapshot): boolean {
  const roleText = `${session.roleName ?? ""} ${session.rankLabel ?? ""}`.toLowerCase();
  return /\b(admin|administrator|analyst|owner|manager)\b/.test(roleText)
    || /管理|運営|分析|責任者/.test(roleText);
}

export function isSafeFieldId(fieldId: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(fieldId);
}

export function isFieldManagerRole(value: unknown): value is FieldManagerRole {
  return value === "owner" || value === "steward" || value === "viewer_exact";
}

export async function getFieldManagerRoleFromD1(userId: string | null | undefined, fieldId: string, env: Env): Promise<FieldManagerRole | null> {
  if (!userId || !isSafeFieldId(fieldId)) return null;
  const row = await env.OBS_DB.prepare(
    `SELECT role FROM field_managers
      WHERE user_id = ? AND field_id = ?
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      ORDER BY CASE role
        WHEN 'owner' THEN 0
        WHEN 'steward' THEN 1
        WHEN 'viewer_exact' THEN 2
        ELSE 3 END
      LIMIT 1`
  ).bind(userId, fieldId).first<{ role: string }>();
  return row && isFieldManagerRole(row.role) ? row.role : null;
}

export function createHtmlCspNonce(): string {
  return randomToken().slice(0, 32);
}

export function applyCspNonceToHtmlScripts(html: string, cspNonce: string): string {
  const nonceAttribute = ` nonce="${escapeHtml(cspNonce)}"`;
  return html
    .replace(/<script\b([^>]*?)\snonce=(?:"[^"]*"|'[^']*'|[^\s>]+)([^>]*)>/g, `<script$1${nonceAttribute}$2>`)
    .replace(/<script\b(?![^>]*\bnonce=)/g, `<script${nonceAttribute}`);
}

export function browserSecurityHeaders(cspNonce: string, isProduction: boolean): Record<string, string> {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${cspNonce}' https://cdn.jsdelivr.net https://unpkg.com https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com https://demotiles.maplibre.org https://tiles.openfreemap.org",
    `connect-src 'self' ${PRODUCTION_PUBLIC_ORIGIN} ${STAGING_PUBLIC_ORIGIN} https://ikimon.life https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://cloudflareinsights.com https://tile.openstreetmap.org https://nominatim.openstreetmap.org https://overpass-api.de https://demotiles.maplibre.org https://tiles.openfreemap.org https://cyberjapandata.gsi.go.jp https://server.arcgisonline.com https://upload.videodelivery.net https://upload.cloudflarestream.com`,
    "frame-src 'self' https://iframe.videodelivery.net",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
  return {
    "content-security-policy": contentSecurityPolicy,
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-permitted-cross-domain-policies": "none",
    "origin-agent-cluster": "?1",
    "permissions-policy": "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
    ...(isProduction ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {})
  };
}

export function publicLangFromPath(pathname: string): "ja" | "en" | "es" | "pt-br" | null {
  const match = pathname.match(/^\/(ja|en|es|pt-br)(?:\/|$)/);
  return match ? match[1] as "ja" | "en" | "es" | "pt-br" : null;
}

export function langQueryToUrlSegment(value: string | null): "ja" | "en" | "es" | "pt-br" | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized === "ja" || normalized === "en" || normalized === "es") return normalized;
  if (normalized === "pt-BR" || normalized.toLowerCase() === "pt-br" || normalized === "pt") return "pt-br";
  return null;
}

export function isSafePublicDerivedImageKey(key: string): boolean {
  if (!key.startsWith("derived/") || !key.endsWith("/display.webp")) return false;
  if (key.includes("..") || key.includes("\\") || key.includes("//") || key.includes("%")) return false;
  return !/[\u0000-\u001f\u007f]/.test(key);
}

export function publicAreaApproxPolygon(lat: number, lng: number, radiusM: number | null, areaHa: number | null): [number, number][] {
  const radiusFromArea = Number.isFinite(areaHa) && (areaHa ?? 0) > 0
    ? Math.sqrt((areaHa as number) * 10000 / Math.PI)
    : null;
  const radius = Math.max(60, Math.min(900, radiusM ?? radiusFromArea ?? 160));
  const latDelta = radius / 111_320;
  const lngDelta = radius / (111_320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return [
    [lng - lngDelta, lat - latDelta],
    [lng + lngDelta, lat - latDelta],
    [lng + lngDelta, lat + latDelta],
    [lng - lngDelta, lat + latDelta],
    [lng - lngDelta, lat - latDelta]
  ];
}

export function safeRedirectPath(value: unknown, fallback = "/record"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\u0000")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://ikimon.local");
    if (parsed.origin !== "https://ikimon.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export async function readCompatibleSession(request: Request, env: Env, touch = true): Promise<SessionSnapshot | null> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const session = await env.CORE_DB.prepare(
    `SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at
     FROM auth_sessions
     WHERE token_hash = ? AND expires_at > ? AND role_name <> ?`
  ).bind(tokenHash, new Date().toISOString(), MUNICIPAL_INBOX_ROLE).first<{
    token_hash: string;
    user_id: string;
    display_name: string;
    role_name: string;
    rank_label: string | null;
    banned: number;
    expires_at: string;
  }>();
  if (!session) return null;
  if (touch) await env.CORE_DB.prepare(
    "UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return {
    tokenHash: session.token_hash,
    userId: session.user_id,
    displayName: session.display_name,
    roleName: session.role_name,
    rankLabel: session.rank_label,
    banned: Boolean(session.banned),
    expiresAt: session.expires_at
  };
}

export function readSessionTokenFromCookie(headerValue: string | null): string | null {
  const token = parseCookies(headerValue)[SESSION_COOKIE_NAME];
  return token && token.trim() ? token.trim() : null;
}
