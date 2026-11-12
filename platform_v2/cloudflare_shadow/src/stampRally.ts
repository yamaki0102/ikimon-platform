import { authenticate, canonicalJson, readBoundedBody, sha256Text, validInstant } from "./zukanHpSiteReceiver";

export interface StampD1Statement {
  bind(...values: unknown[]): StampD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}
export interface StampD1Database {
  prepare(query: string): StampD1Statement;
}
export interface StampRallyEnv {
  CORE_DB: StampD1Database;
  NOCOSIL_INTEGRATION_HMAC_SECRET?: string;
  ENVIRONMENT: string;
  ZUKAN_STAMP_RALLY_ENABLED?: string;
}

export const STAMP_RALLY_ORGANIZER_PATH = "/api/v1/integrations/nocosil/stamp-rallies";
export const STAMP_RALLY_SCHEMA = "nocosil.stamp-rally-handoff/v1";
export const STAMP_RALLY_RESULT_SCHEMA = "zukan.stamp-rally-result/v1";
export const STAMP_RALLY_CONSENT_VERSION = "2026-11-12.1";
export const STAMP_RALLY_RETENTION_DAYS = 90;
export const STAMP_DEVICE_COOKIE = "zukan_stamp_device";

const SESSION_COOKIE = "ikimon_v2_session";
const MUNICIPAL_INBOX_ROLE = "MunicipalInbox";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const MAX_SPOTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

type Obj = Record<string, unknown>;
type RallyRow = {
  rally_id: string; scope_digest: string; source_rally_id: string; title: string; starts_at: string | null; ends_at: string | null;
  state: "open" | "closed"; prize_mode: "none" | "offline"; prize_instructions: string | null; expected_participants: number | null;
  logo_url: string | null; theme_primary: string | null; theme_background: string | null; last_operation_id: string;
  request_digest: string; closed_at: string | null; created_at: string; updated_at: string;
};
type SpotRow = {
  spot_id: string; rally_id: string; spot_key: string; position: number; name: string; code: string; spot_kind: "qr" | "area";
  area_center_lat: number | null; area_center_lng: number | null; radius_m: number | null; state: "active" | "removed";
};
type SpotInput = { spotKey: string; name: string; spotKind: "qr" | "area"; lat: number | null; lng: number | null; radiusM: number | null };

const RALLY_COLUMNS = "rally_id,scope_digest,source_rally_id,title,starts_at,ends_at,state,prize_mode,prize_instructions,expected_participants,logo_url,theme_primary,theme_background,last_operation_id,request_digest,closed_at,created_at,updated_at";
const SPOT_COLUMNS = "spot_id,rally_id,spot_key,position,name,code,spot_kind,area_center_lat,area_center_lng,radius_m,state";

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const keysOnly = (v: Obj, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
const hashPattern = /^[a-f0-9]{64}$/;
const operationIdPattern = /^[A-Za-z0-9_-]{1,180}$/;
const sourceRallyIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const spotKeyPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const rallyIdPattern = /^sr_[a-f0-9]{32}$/;
const spotCodePattern = /^[A-Za-z0-9_-]{22}$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const controlChars = /[\u0000-\u001f\u007f]/;

const isEnabled = (env: StampRallyEnv) => env.ZUKAN_STAMP_RALLY_ENABLED === "true";
const originFor = (env: StampRallyEnv): string | null =>
  env.ENVIRONMENT === "staging" ? "https://staging.zukan.earth" : env.ENVIRONMENT === "production" ? "https://zukan.earth" : null;
const secureAttr = (env: StampRallyEnv) => env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging" ? " Secure;" : "";

export const isStampRallyPath = (pathname: string): boolean =>
  pathname === STAMP_RALLY_ORGANIZER_PATH || pathname.startsWith("/stamp/");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff",
  } });
}
const apiError = (code: string, status: number) => json({ schema: STAMP_RALLY_RESULT_SCHEMA, error: code }, status);

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const rallyIdFor = async (env: StampRallyEnv, scopeDigest: string, sourceRallyId: string) =>
  `sr_${(await sha256Text(JSON.stringify(["nocosil-stamp-rally", env.ENVIRONMENT, scopeDigest, sourceRallyId]))).slice(0, 32)}`;
const spotIdFor = async (rallyId: string, spotKey: string) => `sp_${(await sha256Text(JSON.stringify([rallyId, spotKey]))).slice(0, 32)}`;
const deviceIdFor = (raw: string) => sha256Text(`zukan-stamp-device|${raw}`);

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

async function loadRally(env: StampRallyEnv, rallyId: string): Promise<RallyRow | null> {
  return env.CORE_DB.prepare(`SELECT ${RALLY_COLUMNS} FROM stamp_rallies WHERE rally_id=?`).bind(rallyId).first<RallyRow>();
}
async function loadSpots(env: StampRallyEnv, rallyId: string): Promise<SpotRow[]> {
  return (await env.CORE_DB.prepare(`SELECT ${SPOT_COLUMNS} FROM stamp_rally_spots WHERE rally_id=? ORDER BY position, spot_key`).bind(rallyId).all<SpotRow>()).results;
}
async function count(env: StampRallyEnv, sql: string, ...values: unknown[]): Promise<number> {
  const row = await env.CORE_DB.prepare(sql).bind(...values).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function rallyResult(env: StampRallyEnv, rally: RallyRow, origin: string): Promise<Obj> {
  const spots = await loadSpots(env, rally.rally_id);
  const perSpot = (await env.CORE_DB.prepare(
    "SELECT sp.spot_key AS spot_key, COUNT(st.device_id) AS n FROM stamp_rally_spots sp LEFT JOIN stamp_rally_stamps st ON st.spot_id=sp.spot_id WHERE sp.rally_id=? GROUP BY sp.spot_id ORDER BY sp.position, sp.spot_key",
  ).bind(rally.rally_id).all<{ spot_key: string; n: number }>()).results;
  return {
    schema: STAMP_RALLY_RESULT_SCHEMA, rallyId: rally.rally_id, scopeDigest: rally.scope_digest, sourceRallyId: rally.source_rally_id,
    state: rally.state, title: rally.title, startsAt: rally.starts_at, endsAt: rally.ends_at, prizeMode: rally.prize_mode,
    expectedParticipants: rally.expected_participants, lastOperationId: rally.last_operation_id, updatedAt: rally.updated_at,
    spots: spots.map(spot => ({ spotKey: spot.spot_key, name: spot.name, spotKind: spot.spot_kind, state: spot.state, stampUrl: spot.state === "active" ? `${origin}/stamp/${spot.code}` : null })),
    counts: {
      participants: await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_devices WHERE rally_id=?", rally.rally_id),
      completions: await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_devices WHERE rally_id=? AND completed_at IS NOT NULL", rally.rally_id),
      stamps: await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_stamps WHERE rally_id=?", rally.rally_id),
      perSpot: perSpot.map(row => ({ spotKey: row.spot_key, stamps: Number(row.n) })),
      linkedParticipants: await count(env, "SELECT COUNT(*) AS n FROM stamp_account_links WHERE rally_id=? AND revoked_at IS NULL", rally.rally_id),
      notifyOptIns: await count(env, "SELECT COUNT(*) AS n FROM stamp_account_links WHERE rally_id=? AND revoked_at IS NULL AND notify_opt_in=1", rally.rally_id),
    },
  };
}

function optionalInstant(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return validInstant(value) ? new Date(Date.parse(value)).toISOString() : undefined;
}
function plainText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max && !controlChars.test(text.replace(/[\r\n]/g, "")) ? text : null;
}
function parseSpots(value: unknown): SpotInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SPOTS) return null;
  const seen = new Set<string>();
  const spots: SpotInput[] = [];
  for (const item of value) {
    if (!isObj(item) || !keysOnly(item, ["spotKey", "name", "spotKind", "areaCenter", "radiusM"])) return null;
    if (typeof item.spotKey !== "string" || !spotKeyPattern.test(item.spotKey) || seen.has(item.spotKey)) return null;
    const name = plainText(item.name, 1, 60);
    const spotKind = item.spotKind === undefined ? "qr" : item.spotKind;
    if (!name || (spotKind !== "qr" && spotKind !== "area")) return null;
    seen.add(item.spotKey);
    if (spotKind === "qr") {
      if (item.areaCenter !== undefined && item.areaCenter !== null) return null;
      if (item.radiusM !== undefined && item.radiusM !== null) return null;
      spots.push({ spotKey: item.spotKey, name, spotKind, lat: null, lng: null, radiusM: null });
      continue;
    }
    const center = item.areaCenter;
    if (!isObj(center) || !keysOnly(center, ["lat", "lng"]) || typeof center.lat !== "number" || typeof center.lng !== "number"
      || !Number.isFinite(center.lat) || !Number.isFinite(center.lng) || Math.abs(center.lat) > 90 || Math.abs(center.lng) > 180) return null;
    if (typeof item.radiusM !== "number" || !Number.isInteger(item.radiusM) || item.radiusM < 10 || item.radiusM > 5000) return null;
    spots.push({ spotKey: item.spotKey, name, spotKind, lat: center.lat, lng: center.lng, radiusM: item.radiusM });
  }
  return spots;
}
function parseTheme(value: unknown): { logoUrl: string | null; primary: string | null; background: string | null } | null {
  if (value === undefined || value === null) return { logoUrl: null, primary: null, background: null };
  if (!isObj(value) || !keysOnly(value, ["logoUrl", "primaryColor", "backgroundColor"])) return null;
  let logoUrl: string | null = null;
  if (value.logoUrl !== undefined && value.logoUrl !== null) {
    if (typeof value.logoUrl !== "string" || value.logoUrl.length > 300 || /[\s"'<>\\]/.test(value.logoUrl)) return null;
    try { const parsed = new URL(value.logoUrl); if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null; } catch { return null; }
    logoUrl = value.logoUrl;
  }
  const color = (v: unknown): string | null | undefined => v === undefined || v === null ? null : typeof v === "string" && colorPattern.test(v) ? v.toLowerCase() : undefined;
  const primary = color(value.primaryColor); const background = color(value.backgroundColor);
  if (primary === undefined || background === undefined) return null;
  return { logoUrl, primary, background };
}

async function syncSpots(env: StampRallyEnv, rallyId: string, spots: SpotInput[], nowIso: string): Promise<void> {
  for (const [index, spot] of spots.entries()) {
    await env.CORE_DB.prepare(
      `INSERT INTO stamp_rally_spots (spot_id,rally_id,spot_key,position,name,code,spot_kind,area_center_lat,area_center_lng,radius_m,state,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'active',?)
       ON CONFLICT(rally_id,spot_key) DO UPDATE SET position=excluded.position,name=excluded.name,spot_kind=excluded.spot_kind,area_center_lat=excluded.area_center_lat,area_center_lng=excluded.area_center_lng,radius_m=excluded.radius_m,state='active'`,
    ).bind(await spotIdFor(rallyId, spot.spotKey), rallyId, spot.spotKey, index + 1, spot.name, randomCode(), spot.spotKind, spot.lat, spot.lng, spot.radiusM, nowIso).run();
  }
  const keep = spots.map(spot => spot.spotKey);
  await env.CORE_DB.prepare(`UPDATE stamp_rally_spots SET state='removed' WHERE rally_id=? AND state='active' AND spot_key NOT IN (${keep.map(() => "?").join(",")})`)
    .bind(rallyId, ...keep).run();
}

async function handleOrganizer(request: Request, env: StampRallyEnv, now: number): Promise<Response> {
  if (request.method !== "POST") return apiError("method_not_allowed", 405);
  const origin = originFor(env);
  if (!origin || !env.NOCOSIL_INTEGRATION_HMAC_SECRET) return apiError("integration_unavailable", 503);
  const raw = await readBoundedBody(request);
  if (raw === null) return apiError("body_too_large", 413);
  if (!await authenticate(request, raw, env.NOCOSIL_INTEGRATION_HMAC_SECRET, now)) return apiError("invalid_signature", 401);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { return apiError("invalid_json", 400); }
  if (!isObj(body)) return apiError("invalid_payload", 400);
  if (body.schema !== STAMP_RALLY_SCHEMA || body.environment !== env.ENVIRONMENT || body.audience !== origin) return apiError("invalid_audience", 400);
  const action = body.action;
  if (action !== "upsert" && action !== "close" && action !== "status") return apiError("invalid_payload", 400);
  const common = ["schema", "action", "environment", "audience", "scopeDigest", "sourceRallyId", "rallyId"];
  const allowed = action === "status" ? common
    : action === "close" ? [...common, "operationId", "expectedOperationId", "issuedAt"]
      : [...common, "operationId", "expectedOperationId", "issuedAt", "title", "startsAt", "endsAt", "prizeMode", "prizeInstructions", "expectedParticipants", "theme", "spots"];
  if (!keysOnly(body, allowed)) return apiError("invalid_payload", 400);
  if (typeof body.scopeDigest !== "string" || !hashPattern.test(body.scopeDigest) || typeof body.sourceRallyId !== "string" || !sourceRallyIdPattern.test(body.sourceRallyId)) return apiError("invalid_payload", 400);
  const rallyId = await rallyIdFor(env, body.scopeDigest, body.sourceRallyId);
  if (body.rallyId !== rallyId) return apiError("invalid_rally_id", 400);

  try {
    if (action === "status") {
      const row = await loadRally(env, rallyId);
      if (!row) return apiError("not_found", 404);
      if (row.scope_digest !== body.scopeDigest || row.source_rally_id !== body.sourceRallyId) return apiError("binding_conflict", 409);
      return json(await rallyResult(env, row, origin));
    }
    if (typeof body.operationId !== "string" || !operationIdPattern.test(body.operationId)
      || !(body.expectedOperationId === null || (typeof body.expectedOperationId === "string" && operationIdPattern.test(body.expectedOperationId)))
      || !validInstant(body.issuedAt)) return apiError("invalid_operation", 400);

    let fields: { title: string; startsAt: string | null; endsAt: string | null; prizeMode: "none" | "offline"; prizeInstructions: string | null; expectedParticipants: number | null;
      theme: NonNullable<ReturnType<typeof parseTheme>>; spots: SpotInput[] } | null = null;
    if (action === "upsert") {
      const title = plainText(body.title, 1, 80);
      const startsAt = optionalInstant(body.startsAt); const endsAt = optionalInstant(body.endsAt);
      const theme = parseTheme(body.theme); const spots = parseSpots(body.spots);
      const prizeMode = body.prizeMode;
      if (!title || startsAt === undefined || endsAt === undefined || !theme || !spots || (prizeMode !== "none" && prizeMode !== "offline")) return apiError("invalid_rally", 400);
      if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) return apiError("invalid_rally", 400);
      let prizeInstructions: string | null = null;
      if (prizeMode === "offline") {
        prizeInstructions = plainText(body.prizeInstructions, 1, 1000);
        if (!prizeInstructions) return apiError("invalid_rally", 400);
      } else if (body.prizeInstructions !== undefined && body.prizeInstructions !== null) return apiError("invalid_rally", 400);
      const expected = body.expectedParticipants;
      if (expected !== undefined && expected !== null && (typeof expected !== "number" || !Number.isInteger(expected) || expected < 1 || expected > 1_000_000)) return apiError("invalid_rally", 400);
      fields = { title, startsAt, endsAt, prizeMode, prizeInstructions, expectedParticipants: typeof expected === "number" ? expected : null, theme, spots };
    }

    const digest = await sha256Text(canonicalJson(body));
    const nowIso = new Date(now).toISOString();
    const before = await loadRally(env, rallyId);
    if (before && (before.scope_digest !== body.scopeDigest || before.source_rally_id !== body.sourceRallyId)) return apiError("binding_conflict", 409);
    const replay = async (row: RallyRow): Promise<Response> => {
      if (row.request_digest !== digest) return apiError("operation_conflict", 409);
      if (fields) await syncSpots(env, rallyId, fields.spots, nowIso);
      return json(await rallyResult(env, row, origin));
    };
    if (before && before.last_operation_id === body.operationId) return replay(before);
    if ((before?.last_operation_id ?? null) !== body.expectedOperationId) return apiError("stale_operation", 409);
    if (!before && action === "close") return apiError("not_found", 404);
    if (before?.state === "closed" && action === "upsert") return apiError("rally_closed", 409);

    let claimed = false;
    if (action === "upsert" && fields) {
      if (!before) {
        const inserted = await env.CORE_DB.prepare(
          `INSERT INTO stamp_rallies (${RALLY_COLUMNS}) VALUES (?,?,?,?,?,?,'open',?,?,?,?,?,?,?,?,NULL,?,?) ON CONFLICT(rally_id) DO NOTHING`,
        ).bind(rallyId, body.scopeDigest, body.sourceRallyId, fields.title, fields.startsAt, fields.endsAt, fields.prizeMode, fields.prizeInstructions, fields.expectedParticipants,
          fields.theme.logoUrl, fields.theme.primary, fields.theme.background, body.operationId, digest, nowIso, nowIso).run();
        if (inserted.success === false) return apiError("storage_unavailable", 503);
        claimed = (inserted.meta?.changes ?? 0) >= 1;
      } else {
        const changed = await env.CORE_DB.prepare(
          "UPDATE stamp_rallies SET title=?,starts_at=?,ends_at=?,prize_mode=?,prize_instructions=?,expected_participants=?,logo_url=?,theme_primary=?,theme_background=?,last_operation_id=?,request_digest=?,updated_at=? WHERE rally_id=? AND last_operation_id=? AND state='open'",
        ).bind(fields.title, fields.startsAt, fields.endsAt, fields.prizeMode, fields.prizeInstructions, fields.expectedParticipants, fields.theme.logoUrl, fields.theme.primary,
          fields.theme.background, body.operationId, digest, nowIso, rallyId, before.last_operation_id).run();
        if (changed.success === false) return apiError("storage_unavailable", 503);
        claimed = (changed.meta?.changes ?? 0) >= 1;
      }
    } else {
      const changed = await env.CORE_DB.prepare(
        "UPDATE stamp_rallies SET state='closed',closed_at=COALESCE(closed_at,?),last_operation_id=?,request_digest=?,updated_at=? WHERE rally_id=? AND last_operation_id=?",
      ).bind(nowIso, body.operationId, digest, nowIso, rallyId, before!.last_operation_id).run();
      if (changed.success === false) return apiError("storage_unavailable", 503);
      claimed = (changed.meta?.changes ?? 0) >= 1;
    }
    if (!claimed) {
      const winner = await loadRally(env, rallyId);
      if (winner && winner.last_operation_id === body.operationId) return replay(winner);
      return apiError("stale_operation", 409);
    }
    if (fields) await syncSpots(env, rallyId, fields.spots, nowIso);
    const after = await loadRally(env, rallyId);
    if (!after || after.last_operation_id !== body.operationId || after.request_digest !== digest) return apiError("readback_failed", 503);
    return json(await rallyResult(env, after, origin));
  } catch { return apiError("storage_unavailable", 503); }
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function readableOn(color: string): string {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.45 ? "#1d1d1f" : "#ffffff";
}
function jst(iso: string): string {
  return `${new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ")}（日本時間）`;
}

type Theme = { primary: string | null; background: string | null; logoUrl: string | null };
const themeOf = (rally: RallyRow | null): Theme => ({
  primary: rally?.theme_primary && colorPattern.test(rally.theme_primary) ? rally.theme_primary : null,
  background: rally?.theme_background && colorPattern.test(rally.theme_background) ? rally.theme_background : null,
  logoUrl: rally?.logo_url ?? null,
});

function pageResponse(status: number, title: string, main: string, theme: Theme, extraHeaders: Record<string, string> = {}, headOnly = false): Response {
  const primary = theme.primary ?? "#1f6f4a"; const background = theme.background ?? "#f7f5ee";
  let logoOrigin = "";
  if (theme.logoUrl) { try { logoOrigin = ` ${new URL(theme.logoUrl).origin}`; } catch { logoOrigin = ""; } }
  const css = `:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Hiragino Sans',sans-serif;line-height:1.7;color:#1d1d1f;background:${background}}main{max-width:480px;margin:0 auto;padding:20px 16px 48px}h1{font-size:1.35rem;line-height:1.4;margin:.4em 0}h2{font-size:1.1rem;margin:1.6em 0 .4em}p{margin:.7em 0}.card{background:#fff;border-radius:12px;padding:16px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.12)}.logo{max-width:160px;max-height:64px;display:block;margin:0 0 8px}.btn{display:block;width:100%;min-height:52px;border:0;border-radius:10px;background:${primary};color:${readableOn(primary)};font-size:1.1rem;font-weight:700;cursor:pointer;padding:12px}.btn.sub{background:#fff;color:#1d1d1f;border:1px solid #888;font-size:1rem;font-weight:400}.spots{list-style:none;margin:0;padding:0}.spots li{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #e4e0d4}.mark{width:28px;height:28px;border-radius:50%;border:2px solid ${primary};display:inline-flex;align-items:center;justify-content:center;flex:none;font-weight:700}.mark.on{background:${primary};color:${readableOn(primary)}}.note{font-size:.9rem;color:#555}.done{border:2px solid ${primary}}label{display:block;margin:.6em 0}`;
  const logo = theme.logoUrl ? `<img class="logo" src="${escapeHtml(theme.logoUrl)}" alt="">` : "";
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><main>${logo}${main}</main></body></html>`;
  return new Response(headOnly ? null : html, { status, headers: {
    "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:${logoOrigin}; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    ...extraHeaders,
  } });
}
const messagePage = (status: number, heading: string, text: string, theme: Theme = themeOf(null), headOnly = false) =>
  pageResponse(status, heading, `<h1>${escapeHtml(heading)}</h1><p>${escapeHtml(text)}</p>`, theme, {}, headOnly);

function windowState(rally: RallyRow, now: number): "open" | "closed" | "not_started" | "ended" {
  if (rally.state === "closed") return "closed";
  if (rally.starts_at && now < Date.parse(rally.starts_at)) return "not_started";
  if (rally.ends_at && now > Date.parse(rally.ends_at)) return "ended";
  return "open";
}
const windowMessage = (state: "closed" | "not_started" | "ended") =>
  state === "not_started" ? "このスタンプラリーはまだ始まっていません。開始後にもう一度お試しください。" : "このスタンプラリーは終了しました。ご参加ありがとうございました。";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

async function readLoggedInUserId(request: Request, env: StampRallyEnv, now: number): Promise<string | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const row = await env.CORE_DB.prepare("SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>? AND banned=0 AND role_name<>?")
      .bind(await sha256Text(token), new Date(now).toISOString(), MUNICIPAL_INBOX_ROLE).first<{ user_id: string }>();
    return row?.user_id ?? null;
  } catch { return null; }
}

async function stampedSpotIds(env: StampRallyEnv, rallyId: string, deviceId: string): Promise<Set<string>> {
  const rows = (await env.CORE_DB.prepare("SELECT spot_id FROM stamp_rally_stamps WHERE rally_id=? AND device_id=?").bind(rallyId, deviceId).all<{ spot_id: string }>()).results;
  return new Set(rows.map(row => row.spot_id));
}

async function handleSpotPage(request: Request, env: StampRallyEnv, code: string, now: number): Promise<Response> {
  const head = request.method === "HEAD";
  const spot = await env.CORE_DB.prepare(`SELECT ${SPOT_COLUMNS} FROM stamp_rally_spots WHERE code=?`).bind(code).first<SpotRow>();
  if (!spot) return messagePage(404, "QRコードが見つかりません", "このQRコードは使えません。会場の案内をご確認ください。", themeOf(null), head);
  const rally = await loadRally(env, spot.rally_id);
  if (!rally) return messagePage(404, "QRコードが見つかりません", "このQRコードは使えません。会場の案内をご確認ください。", themeOf(null), head);
  const theme = themeOf(rally);
  if (spot.state === "removed") return messagePage(410, rally.title, "このスタンプ地点は取りやめになりました。", theme, head);
  const spots = (await loadSpots(env, rally.rally_id)).filter(s => s.state === "active");
  const raw = cookieValue(request, STAMP_DEVICE_COOKIE);
  const deviceId = raw && spotCodePattern.test(raw) ? await deviceIdFor(raw) : null;
  const stamped = deviceId ? await stampedSpotIds(env, rally.rally_id, deviceId) : new Set<string>();
  const progress = spots.filter(s => stamped.has(s.spot_id)).length;
  const board = `/stamp/r/${rally.rally_id}`;
  const state = windowState(rally, now);
  let action: string;
  if (state !== "open") action = `<p>${escapeHtml(windowMessage(state))}</p><p><a href="${board}">スタンプ台紙を見る</a></p>`;
  else if (spot.spot_kind === "area") action = `<p>この地点は位置情報でのチェックインです。まだ準備中のため、スタンプは押せません。</p>`;
  else if (stamped.has(spot.spot_id)) action = `<p>この地点のスタンプはもう押してあります。</p><p><a href="${board}">スタンプ台紙を見る</a></p>`;
  else action = `<form method="post" action="/stamp/${escapeHtml(code)}"><button class="btn" type="submit">スタンプを押す</button></form><p class="note">この端末にスタンプを記録します。名前や連絡先の入力は不要です。</p>`;
  return pageResponse(200, rally.title, `<p class="note">${escapeHtml(rally.title)}</p><h1>${escapeHtml(spot.name)}</h1><div class="card">${action}</div><p class="note">スタンプ ${progress} / ${spots.length}</p>`, theme, {}, head);
}

async function handleSpotStamp(request: Request, env: StampRallyEnv, code: string, now: number): Promise<Response> {
  if (!sameOrigin(request)) return messagePage(403, "送信できませんでした", "このページからもう一度お試しください。");
  const spot = await env.CORE_DB.prepare(`SELECT ${SPOT_COLUMNS} FROM stamp_rally_spots WHERE code=?`).bind(code).first<SpotRow>();
  const rally = spot ? await loadRally(env, spot.rally_id) : null;
  if (!spot || !rally) return messagePage(404, "QRコードが見つかりません", "このQRコードは使えません。会場の案内をご確認ください。");
  const theme = themeOf(rally);
  if (spot.state === "removed") return messagePage(410, rally.title, "このスタンプ地点は取りやめになりました。", theme);
  const state = windowState(rally, now);
  if (state !== "open") return messagePage(403, rally.title, windowMessage(state), theme);
  if (spot.spot_kind !== "qr") return messagePage(400, rally.title, "この地点は位置情報でのチェックインです。QRコードのスタンプは押せません。", theme);
  const existing = cookieValue(request, STAMP_DEVICE_COOKIE);
  const raw = existing && spotCodePattern.test(existing) ? existing : randomCode();
  const deviceId = await deviceIdFor(raw);
  const nowIso = new Date(now).toISOString();
  try {
    await env.CORE_DB.prepare("INSERT OR IGNORE INTO stamp_rally_devices (rally_id,device_id,created_at) VALUES (?,?,?)").bind(rally.rally_id, deviceId, nowIso).run();
    await env.CORE_DB.prepare("INSERT OR IGNORE INTO stamp_rally_stamps (rally_id,spot_id,device_id,stamped_at) VALUES (?,?,?,?)").bind(rally.rally_id, spot.spot_id, deviceId, nowIso).run();
    const total = await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_spots WHERE rally_id=? AND state='active'", rally.rally_id);
    const done = await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_stamps st JOIN stamp_rally_spots sp ON sp.spot_id=st.spot_id WHERE st.rally_id=? AND st.device_id=? AND sp.state='active'", rally.rally_id, deviceId);
    if (total > 0 && done >= total) {
      await env.CORE_DB.prepare("UPDATE stamp_rally_devices SET completed_at=? WHERE rally_id=? AND device_id=? AND completed_at IS NULL").bind(nowIso, rally.rally_id, deviceId).run();
    }
  } catch { return messagePage(503, "スタンプを押せませんでした", "しばらくしてからもう一度お試しください。", theme); }
  return new Response(null, { status: 303, headers: {
    location: `/stamp/r/${rally.rally_id}`, "cache-control": "no-store",
    "set-cookie": `${STAMP_DEVICE_COOKIE}=${raw}; Path=/stamp; HttpOnly;${secureAttr(env)} SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
  } });
}

async function handleBoard(request: Request, env: StampRallyEnv, rallyId: string, now: number): Promise<Response> {
  const head = request.method === "HEAD";
  const rally = await loadRally(env, rallyId);
  if (!rally) return messagePage(404, "スタンプ台紙が見つかりません", "このアドレスは使えません。会場の案内をご確認ください。", themeOf(null), head);
  const theme = themeOf(rally);
  const spots = (await loadSpots(env, rallyId)).filter(s => s.state === "active");
  const raw = cookieValue(request, STAMP_DEVICE_COOKIE);
  const deviceId = raw && spotCodePattern.test(raw) ? await deviceIdFor(raw) : null;
  const stamped = deviceId ? await stampedSpotIds(env, rallyId, deviceId) : new Set<string>();
  const device = deviceId ? await env.CORE_DB.prepare("SELECT completed_at FROM stamp_rally_devices WHERE rally_id=? AND device_id=?").bind(rallyId, deviceId).first<{ completed_at: string | null }>() : null;
  const progress = spots.filter(s => stamped.has(s.spot_id)).length;
  const items = spots.map(s => `<li><span class="mark${stamped.has(s.spot_id) ? " on" : ""}">${stamped.has(s.spot_id) ? "✓" : ""}</span><span>${escapeHtml(s.name)}</span></li>`).join("");
  let main = `<p class="note">${escapeHtml(rally.title)}</p><h1>スタンプ台紙</h1>`;
  if (device?.completed_at) {
    main += `<div class="card done"><h2>コンプリート！</h2><p>すべてのスタンプがそろいました。</p><p class="note">達成：${escapeHtml(jst(device.completed_at))}</p>`;
    if (rally.prize_mode === "offline" && rally.prize_instructions) main += `<h2>受け取り方法</h2><p>${escapeHtml(rally.prize_instructions).replace(/\r?\n/g, "<br>")}</p>`;
    main += `</div>`;
  } else main += `<p>スタンプ ${progress} / ${spots.length}</p>`;
  main += `<div class="card"><ul class="spots">${items}</ul></div>`;
  const state = windowState(rally, now);
  if (state !== "open") main += `<p class="note">${escapeHtml(windowMessage(state))}</p>`;

  const userId = progress > 0 && deviceId ? await readLoggedInUserId(request, env, now) : null;
  if (userId && deviceId) {
    const link = await env.CORE_DB.prepare("SELECT user_id,notify_opt_in,revoked_at FROM stamp_account_links WHERE rally_id=? AND device_id=?").bind(rallyId, deviceId).first<{ user_id: string; notify_opt_in: number; revoked_at: string | null }>();
    if (link && !link.revoked_at && link.user_id === userId) {
      main += `<div class="card"><h2>アカウントとのひも付け</h2><p>この参加記録は、ログイン中のアカウントにひも付いています。${link.notify_opt_in ? "主催者からのお知らせの受け取りに同意しています。" : "お知らせは受け取らない設定です。"}</p>`
        + `<form method="post" action="${board}/unlink"><input type="hidden" name="mode" value="revoke"><button class="btn sub" type="submit">ひも付けとお知らせの同意をやめる</button></form>`
        + `<form method="post" action="${board}/unlink"><input type="hidden" name="mode" value="delete"><button class="btn sub" type="submit">この同意の記録を削除する</button></form></div>`;
    } else if (!link || link.revoked_at || link.user_id === userId) {
      main += `<div class="card"><h2>アカウントにひも付ける（任意）</h2><p>ログイン中のアカウントに、この端末のスタンプ記録をひも付けます。主催者に、あなたの名前・メールアドレス・アカウントは渡りません（人数のみ）。いつでもやめられます。</p>`
        + `<form method="post" action="${board}/link"><label><input type="checkbox" name="consent" value="1" required> 記録をアカウントにひも付けることに同意します</label>`
        + `<label><input type="checkbox" name="notify" value="1"> 主催者からのお知らせ（ZUKAN経由・宛先は主催者に渡りません）を受け取る</label>`
        + `<button class="btn" type="submit">同意してひも付ける</button></form></div>`;
    }
  }
  return pageResponse(200, "スタンプ台紙", main, theme, {}, head);
}
const board = (rallyId: string) => `/stamp/r/${rallyId}`;

async function handleLink(request: Request, env: StampRallyEnv, rallyId: string, now: number): Promise<Response> {
  if (!sameOrigin(request)) return messagePage(403, "送信できませんでした", "このページからもう一度お試しください。");
  const rally = await loadRally(env, rallyId);
  if (!rally) return messagePage(404, "スタンプ台紙が見つかりません", "このアドレスは使えません。");
  const theme = themeOf(rally);
  const raw = cookieValue(request, STAMP_DEVICE_COOKIE);
  if (!raw || !spotCodePattern.test(raw)) return messagePage(400, "ひも付けできませんでした", "この端末のスタンプ記録が見つかりません。", theme);
  const userId = await readLoggedInUserId(request, env, now);
  if (!userId) return messagePage(401, "ログインが必要です", "ひも付けにはZUKANへのログインが必要です。", theme);
  let form: FormData;
  try { form = await request.formData(); } catch { return messagePage(400, "送信できませんでした", "もう一度お試しください。", theme); }
  if (form.get("consent") !== "1") return messagePage(400, "同意が必要です", "ひも付けるには同意にチェックを入れてください。", theme);
  const deviceId = await deviceIdFor(raw);
  const stampCount = await count(env, "SELECT COUNT(*) AS n FROM stamp_rally_stamps WHERE rally_id=? AND device_id=?", rallyId, deviceId);
  if (stampCount < 1) return messagePage(400, "ひも付けできませんでした", "この端末のスタンプ記録が見つかりません。", theme);
  const existing = await env.CORE_DB.prepare("SELECT user_id,revoked_at FROM stamp_account_links WHERE rally_id=? AND device_id=?").bind(rallyId, deviceId).first<{ user_id: string; revoked_at: string | null }>();
  if (existing && !existing.revoked_at && existing.user_id !== userId) return messagePage(409, "ひも付けできませんでした", "この端末の記録はほかのアカウントにひも付いています。", theme);
  const notify = form.get("notify") === "1" ? 1 : 0;
  try {
    await env.CORE_DB.prepare(
      "INSERT INTO stamp_account_links (rally_id,device_id,user_id,consent_at,consent_version,notify_opt_in,revoked_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(rally_id,device_id) DO UPDATE SET user_id=excluded.user_id,consent_at=excluded.consent_at,consent_version=excluded.consent_version,notify_opt_in=excluded.notify_opt_in,revoked_at=NULL",
    ).bind(rallyId, deviceId, userId, new Date(now).toISOString(), STAMP_RALLY_CONSENT_VERSION, notify).run();
  } catch { return messagePage(503, "ひも付けできませんでした", "しばらくしてからもう一度お試しください。", theme); }
  return new Response(null, { status: 303, headers: { location: board(rallyId), "cache-control": "no-store" } });
}

async function handleUnlink(request: Request, env: StampRallyEnv, rallyId: string, now: number): Promise<Response> {
  if (!sameOrigin(request)) return messagePage(403, "送信できませんでした", "このページからもう一度お試しください。");
  const raw = cookieValue(request, STAMP_DEVICE_COOKIE);
  if (!raw || !spotCodePattern.test(raw)) return messagePage(400, "操作できませんでした", "この端末のスタンプ記録が見つかりません。");
  const userId = await readLoggedInUserId(request, env, now);
  if (!userId) return messagePage(401, "ログインが必要です", "この操作にはZUKANへのログインが必要です。");
  let form: FormData;
  try { form = await request.formData(); } catch { return messagePage(400, "送信できませんでした", "もう一度お試しください。"); }
  const mode = form.get("mode");
  if (mode !== "revoke" && mode !== "delete") return messagePage(400, "送信できませんでした", "もう一度お試しください。");
  const deviceId = await deviceIdFor(raw);
  try {
    if (mode === "revoke") await env.CORE_DB.prepare("UPDATE stamp_account_links SET revoked_at=?,notify_opt_in=0 WHERE rally_id=? AND device_id=? AND user_id=? AND revoked_at IS NULL").bind(new Date(now).toISOString(), rallyId, deviceId, userId).run();
    else await env.CORE_DB.prepare("DELETE FROM stamp_account_links WHERE rally_id=? AND device_id=? AND user_id=?").bind(rallyId, deviceId, userId).run();
  } catch { return messagePage(503, "操作できませんでした", "しばらくしてからもう一度お試しください。"); }
  return new Response(null, { status: 303, headers: { location: board(rallyId), "cache-control": "no-store" } });
}

export async function handleStampRally(request: Request, env: StampRallyEnv, now = Date.now()): Promise<Response> {
  const path = new URL(request.url).pathname;
  const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!isEnabled(env)) return notFound();
  if (path === STAMP_RALLY_ORGANIZER_PATH) return handleOrganizer(request, env, now);
  const read = request.method === "GET" || request.method === "HEAD";
  const methodNotAllowed = () => new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD, POST", "cache-control": "no-store" } });
  try {
    const boardMatch = /^\/stamp\/r\/(sr_[a-f0-9]{32})(?:\/(link|unlink))?$/.exec(path);
    if (boardMatch) {
      const rallyId = boardMatch[1]!;
      if (!boardMatch[2]) return read ? await handleBoard(request, env, rallyId, now) : methodNotAllowed();
      if (request.method !== "POST") return methodNotAllowed();
      return boardMatch[2] === "link" ? await handleLink(request, env, rallyId, now) : await handleUnlink(request, env, rallyId, now);
    }
    const areaMatch = /^\/stamp\/([A-Za-z0-9_-]{22})\/area$/.exec(path);
    if (areaMatch) return request.method === "POST" ? json({ error: "area_checkin_not_implemented" }, 501) : methodNotAllowed();
    const spotMatch = /^\/stamp\/([A-Za-z0-9_-]{22})$/.exec(path);
    if (spotMatch) {
      if (read) return await handleSpotPage(request, env, spotMatch[1]!, now);
      return request.method === "POST" ? await handleSpotStamp(request, env, spotMatch[1]!, now) : methodNotAllowed();
    }
  } catch { return messagePage(503, "表示できませんでした", "しばらくしてからもう一度お試しください。"); }
  return notFound();
}

export async function sweepExpiredStampRallies(env: StampRallyEnv, now = Date.now(), limit = 20): Promise<{ rallies: number; stamps: number; devices: number; spots: number }> {
  const totals = { rallies: 0, stamps: 0, devices: 0, spots: 0 };
  if (!isEnabled(env)) return totals;
  const cutoff = new Date(now - STAMP_RALLY_RETENTION_DAYS * DAY_MS).toISOString();
  const due = (await env.CORE_DB.prepare(
    "SELECT rally_id FROM stamp_rallies WHERE MIN(COALESCE(ends_at,closed_at),COALESCE(closed_at,ends_at))<? ORDER BY rally_id LIMIT ?",
  ).bind(cutoff, limit).all<{ rally_id: string }>()).results;
  const changes = (result: { meta?: { changes?: number } }) => Number(result.meta?.changes ?? 0);
  for (const { rally_id } of due) {
    totals.stamps += changes(await env.CORE_DB.prepare("DELETE FROM stamp_rally_stamps WHERE rally_id=?").bind(rally_id).run());
    totals.devices += changes(await env.CORE_DB.prepare("DELETE FROM stamp_rally_devices WHERE rally_id=?").bind(rally_id).run());
    totals.spots += changes(await env.CORE_DB.prepare("DELETE FROM stamp_rally_spots WHERE rally_id=?").bind(rally_id).run());
    totals.rallies += changes(await env.CORE_DB.prepare("DELETE FROM stamp_rallies WHERE rally_id=?").bind(rally_id).run());
  }
  return totals;
}

export async function runStampRallyRetention(env: StampRallyEnv, now = Date.now()): Promise<void> {
  try { await sweepExpiredStampRallies(env, now); } catch { console.warn("stamp_rally_retention_pending"); }
}
