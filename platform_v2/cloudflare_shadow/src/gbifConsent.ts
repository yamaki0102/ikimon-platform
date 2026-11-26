import { isMissingSchema, randomUuid, type GbifDb } from "./gbifDb.js";

export const GBIF_NOTICE_VERSION = "gbif-notice/1";
export const GBIF_DATA_LICENSE_URI = "https://creativecommons.org/licenses/by/4.0/";
export const GBIF_MEDIA_LICENSE_URI = "https://creativecommons.org/licenses/by-nc/4.0/";

export const GBIF_NOTICE_JA = {
  data: "確認された生きものの記録を、世界の生物多様性データベース（GBIF）で共有します。共有するのは、名前・撮影日・ぼかした場所・フィールドネームです。場所は画面に出ているぼかしと同じ広さで、正確な位置は出しません。条件は CC BY 4.0（出典を示せば誰でも使える）です。人が確認した生きものだけが対象で、確認から14日たってから載ります。共有をやめると次の更新から外れますが、すでに取り込まれた分は取り戻せません。",
  media: "選んだ写真・動画も共有します。条件は CC BY-NC 4.0（出典を示せば営利目的以外で使える）です。オフのままの写真は共有せず、記録ページへのリンクだけが載ります。",
} as const;

export type GbifConsentScope = "data" | "media";
export type GbifConsentState = { on: boolean; consentId: string | null; decidedAt: string | null; attributionAlias: string | null };

const RECORD_RUNTIME = "cloudflare_d1";
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,180}$/u;
const REQUEST_PATTERN = /^[A-Za-z0-9:_-]{8,120}$/u;

export function validateAttributionAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const alias = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (alias.length < 1 || alias.length > 40) return null;
  if (/[\u0000-\u001f\u007f<>@]/u.test(alias) || /https?:|www\.|\.(com|jp|net|org)\b/iu.test(alias)) return null;
  return alias;
}

export async function readConsentHeads(db: GbifDb, recordId: string): Promise<{ data: GbifConsentState; media: Map<string, GbifConsentState> }> {
  const rows = await db.query(
    `SELECT c.consent_id, c.scope, c.asset_id, c.decision, c.attribution_alias, c.decided_at
       FROM gbif_consent_events c
      WHERE c.record_runtime = ? AND c.record_id = ?
        AND NOT EXISTS (SELECT 1 FROM gbif_consent_events n WHERE n.supersedes_id = c.consent_id)`,
    [RECORD_RUNTIME, recordId],
  );
  const off: GbifConsentState = { on: false, consentId: null, decidedAt: null, attributionAlias: null };
  const out = { data: off, media: new Map<string, GbifConsentState>() };
  for (const row of rows) {
    const state: GbifConsentState = {
      on: row.decision === "on", consentId: String(row.consent_id), decidedAt: String(row.decided_at),
      attributionAlias: row.attribution_alias == null ? null : String(row.attribution_alias),
    };
    if (row.scope === "data") out.data = state;
    else out.media.set(String(row.asset_id), state);
  }
  return out;
}

export type ConsentSession = { userId: string; banned?: boolean } | null;
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function handleGbifConsentRoute(deps: { db: GbifDb }, readSession: () => Promise<ConsentSession>, request: Request, pathname: string): Promise<Response | null> {
  const match = /^\/api\/v1\/records\/([^/]+)\/gbif-consent$/.exec(pathname);
  if (!match) return null;
  if (request.method !== "GET" && request.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405);
  let recordId: string;
  try { recordId = decodeURIComponent(match[1]!); } catch { return respond({ ok: false, error: "record_id_invalid" }, 400); }
  if (!ID_PATTERN.test(recordId)) return respond({ ok: false, error: "record_id_invalid" }, 400);
  if (request.method === "POST" && request.headers.get("origin") !== new URL(request.url).origin) return respond({ ok: false, error: "same_origin_required" }, 403);
  const session = await readSession().catch(() => null);
  if (!session || session.banned) return respond({ ok: false, error: "session_required" }, 401);
  try {
    const record = (await deps.db.query("SELECT owner_user_id FROM observations WHERE observation_id = ? AND emergency_hidden = 0 LIMIT 1", [recordId]))[0];
    if (!record || String(record.owner_user_id) !== session.userId || session.userId.startsWith("guest")) return respond({ ok: false, error: "owner_required" }, 403);
    if (request.method === "GET") return respond(await consentView(deps.db, recordId));
    return await applyConsent(deps.db, recordId, session.userId, request);
  } catch (error) {
    if (isMissingSchema(error)) return respond({ ok: false, error: "schema_unavailable" }, 503);
    throw error;
  }
}

async function consentView(db: GbifDb, recordId: string) {
  const heads = await readConsentHeads(db, recordId);
  const assets = await db.query(
    "SELECT asset_id FROM asset_ledger WHERE observation_id = ? AND processing_state = 'uploaded' ORDER BY created_at, asset_id LIMIT 60",
    [recordId],
  );
  return {
    ok: true,
    recordId,
    noticeVersion: GBIF_NOTICE_VERSION,
    notice: GBIF_NOTICE_JA,
    data: { on: heads.data.on, licenseUri: GBIF_DATA_LICENSE_URI, attributionAlias: heads.data.attributionAlias, decidedAt: heads.data.decidedAt },
    media: assets.map((row) => {
      const state = heads.media.get(String(row.asset_id));
      return { assetId: String(row.asset_id), on: Boolean(state?.on), licenseUri: GBIF_MEDIA_LICENSE_URI, decidedAt: state?.decidedAt ?? null };
    }),
  };
}

async function applyConsent(db: GbifDb, recordId: string, userId: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return respond({ ok: false, error: "body_invalid" }, 400);
  const scope = body.scope === "media" ? "media" : body.scope === "data" ? "data" : null;
  const decision = body.decision === "on" ? "on" : body.decision === "off" ? "off" : null;
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!scope || !decision || !REQUEST_PATTERN.test(requestId)) return respond({ ok: false, error: "consent_input_invalid" }, 400);
  if (body.noticeVersion !== GBIF_NOTICE_VERSION) return respond({ ok: false, error: "notice_changed", noticeVersion: GBIF_NOTICE_VERSION }, 409);

  let assetId = "";
  if (scope === "media") {
    assetId = typeof body.assetId === "string" ? body.assetId : "";
    if (!ID_PATTERN.test(assetId)) return respond({ ok: false, error: "asset_id_invalid" }, 400);
    const asset = (await db.query("SELECT asset_id FROM asset_ledger WHERE asset_id = ? AND observation_id = ? LIMIT 1", [assetId, recordId]))[0];
    if (!asset) return respond({ ok: false, error: "asset_not_in_record" }, 404);
  }
  let alias: string | null = null;
  if (scope === "data" && decision === "on") {
    alias = validateAttributionAlias(body.attributionAlias);
    if (!alias) return respond({ ok: false, error: "attribution_alias_invalid" }, 400);
  }

  const replay = (await db.query(
    "SELECT consent_id, scope, asset_id, decision FROM gbif_consent_events WHERE record_runtime = ? AND record_id = ? AND request_id = ? LIMIT 1",
    [RECORD_RUNTIME, recordId, requestId],
  ))[0];
  if (replay) {
    if (replay.scope === scope && String(replay.asset_id) === assetId && replay.decision === decision) return respond({ ok: true, changed: false, replay: true, consentId: String(replay.consent_id) });
    return respond({ ok: false, error: "request_id_reused" }, 409);
  }

  const heads = await readConsentHeads(db, recordId);
  const head = scope === "data" ? heads.data : heads.media.get(assetId) ?? { on: false, consentId: null, decidedAt: null, attributionAlias: null };
  if (head.on === (decision === "on") && (decision === "off" || head.attributionAlias === alias)) return respond({ ok: true, changed: false, consentId: head.consentId });

  const consentId = randomUuid();
  const licenseUri = scope === "data" ? GBIF_DATA_LICENSE_URI : GBIF_MEDIA_LICENSE_URI;
  try {
    await db.run(
      `INSERT INTO gbif_consent_events (consent_id, record_runtime, record_id, scope, asset_id, decision, license_uri, attribution_alias, notice_version, actor_id, request_id, supersedes_id, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [consentId, RECORD_RUNTIME, recordId, scope, assetId, decision, licenseUri, alias, GBIF_NOTICE_VERSION, userId, requestId, head.consentId, new Date().toISOString()],
    );
  } catch (error) {
    if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) return respond({ ok: false, error: "concurrent_update" }, 409);
    throw error;
  }
  return respond({ ok: true, changed: true, consentId, decision, scope, assetId: assetId || null });
}
