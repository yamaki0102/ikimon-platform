import type { Env } from "./core/env";
import { json, readJson } from "./core/http";
import { containsDiscoveryPersonalInformation } from "./eventDiscoveryPrivacy";

export const NOCOSIL_OUTCOME_USAGE_PATH = "/api/v1/integrations/nocosil/outcome-usages";

export const NOCOSIL_OUTCOME_USAGES_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS nocosil_outcome_usages (
  usage_id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  place_id TEXT NOT NULL DEFAULT '',
  event_title TEXT NOT NULL,
  usage_line TEXT NOT NULL,
  occurred_date TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export type NocosilOutcomeUsageRow = {
  usage_id: string;
  outcome_id: string;
  record_id: string;
  place_id: string;
  event_title: string;
  usage_line: string;
  occurred_date: string;
  created_at: number;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatOutcomeUsageLine(input: { eventTitle: string; customLine?: string; occurredDate: string }): string {
  const raw = (input.customLine?.trim() || `${input.eventTitle.trim()}で使われました`).replace(/[\r\n]+/g, " ").slice(0, 100);
  const datePart = input.occurredDate ? `（${input.occurredDate.slice(0, 10)}）` : "";
  return `${raw}${datePart}`;
}

export async function listNocosilOutcomeUsagesForRecord(env: Env, recordId: string): Promise<NocosilOutcomeUsageRow[]> {
  try {
    await env.CORE_DB.prepare(NOCOSIL_OUTAGES_SAFE_SQL).run();
    const res = await env.CORE_DB.prepare(
      `SELECT usage_id, outcome_id, record_id, place_id, event_title, usage_line, occurred_date, created_at
       FROM nocosil_outcome_usages
       WHERE record_id = ?1
       ORDER BY created_at DESC
       LIMIT 10`
    ).bind(recordId).all<NocosilOutcomeUsageRow>();
    return res.results ?? [];
  } catch {
    return [];
  }
}

const NOCOSIL_OUTAGES_SAFE_SQL = NOCOSIL_OUTCOME_USAGES_CREATE_SQL;

export async function listNocosilOutcomeUsagesForPlace(env: Env, placeId: string): Promise<NocosilOutcomeUsageRow[]> {
  try {
    await env.CORE_DB.prepare(NOCOSIL_OUTCOME_USAGES_CREATE_SQL).run();
    const res = await env.CORE_DB.prepare(
      `SELECT usage_id, outcome_id, record_id, place_id, event_title, usage_line, occurred_date, created_at
       FROM nocosil_outcome_usages
       WHERE place_id = ?1
       ORDER BY created_at DESC
       LIMIT 10`
    ).bind(placeId).all<NocosilOutcomeUsageRow>();
    return res.results ?? [];
  } catch {
    return [];
  }
}

export function renderNocosilOutcomeUsageHtml(usages: NocosilOutcomeUsageRow[]): string {
  if (!usages || usages.length === 0) return "";
  return `<section class="of-usage" data-nocosil-outcome-usage aria-label="この記録の活用">
    <h2 style="margin:0 0 6px;font-size:1rem">この記録が使われた行事</h2>
    <ul style="margin:0;padding-left:18px;display:grid;gap:4px">
      ${usages.map((u) => `<li>${escapeHtml(u.usage_line)}</li>`).join("")}
    </ul>
  </section>`;
}

export async function handleNocosilOutcomeUsageApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname !== NOCOSIL_OUTCOME_USAGE_PATH) return null;
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, { "cache-control": "no-store" });

  const secret = env.NOCOSIL_INTEGRATION_HMAC_SECRET?.trim();
  if (!secret) return json({ ok: false, error: "integration_not_configured" }, 503, { "cache-control": "no-store" });

  const rawText = await request.text();
  const sigHeader = (request.headers.get("x-nocosil-signature") ?? "").replace(/^sha256=/i, "").trim();
  const expectedSig = await computeHmacHex(secret, rawText);
  if (!sigHeader || !constantTimeEqual(sigHeader, expectedSig)) {
    return json({ ok: false, error: "invalid_signature" }, 401, { "cache-control": "no-store" });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, { "cache-control": "no-store" });
  }

  if (body.nocosilPublicApproved !== true || body.zukanPublicApproved !== true) {
    return json({ ok: true, stored: false, reason: "public_consent_not_granted" }, 200, { "cache-control": "no-store" });
  }

  const outcomeId = typeof body.outcomeId === "string" ? body.outcomeId.trim() : "";
  const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const eventTitle = typeof body.eventTitle === "string" ? body.eventTitle.trim() : "";
  const occurredDate = typeof body.occurredDate === "string" ? body.occurredDate.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const customLine = typeof body.usageLine === "string" ? body.usageLine.trim() : "";

  if (!outcomeId || !recordId || !eventTitle) {
    return json({ ok: false, error: "missing_required_fields" }, 400, { "cache-control": "no-store" });
  }

  const usageLine = formatOutcomeUsageLine({ eventTitle, customLine, occurredDate });
  if (containsDiscoveryPersonalInformation(usageLine) || containsDiscoveryPersonalInformation(eventTitle)) {
    return json({ ok: false, error: "personal_info_not_allowed" }, 400, { "cache-control": "no-store" });
  }

  await env.CORE_DB.prepare(NOCOSIL_OUTCOME_USAGES_CREATE_SQL).run();
  const usageId = `${outcomeId}:${recordId}`;
  await env.CORE_DB.prepare(
    `INSERT INTO nocosil_outcome_usages (
      usage_id, outcome_id, record_id, place_id, event_title, usage_line, occurred_date, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(usage_id) DO UPDATE SET
      place_id = excluded.place_id,
      event_title = excluded.event_title,
      usage_line = excluded.usage_line,
      occurred_date = excluded.occurred_date`
  ).bind(usageId, outcomeId, recordId, placeId, eventTitle, usageLine, occurredDate, Date.now()).run();

  return json({ ok: true, stored: true, usageId, usageLine }, 200, { "cache-control": "no-store" });
}
