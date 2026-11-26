import { isLocationDelayed24Hours } from "./locationPrivacy.js";
import type { AiNoteCountFact } from "./recordAiNote.js";

export type BandQuery = (sql: string, values: unknown[]) => Promise<Array<Record<string, unknown>>>;
export type BandPublicRow = { observation_id: string; public_cell: string; observed_at: string; public_area_label?: string | null; taxon_label?: string | null };
export type BandDeps = {
  query: BandQuery;
  publicRows: () => Promise<BandPublicRow[]>;
  nowMs: number;
  safeAreaLabel?: (value: unknown) => string | null;
};
export type BandViewer = { userId: string | null };
export type RecordCountBand =
  | { kind: "public_place_season"; count: number; text: string; href: string; scope: "public" }
  | { kind: "owner_place_nth"; count: number; text: string; href: null; scope: "owner" }
  | { kind: "owner_first_place_type"; count: null; text: string; href: null; scope: "owner" };
export type PlaceSeasonList = { count: number; anchorId: string; seasonLabel: string; placeLabel: string; items: Array<{ visitId: string; observedAt: string; displayName: string | null; href: string }> };

export const BAND_MIN_PUBLIC_COUNT = 3;
const PLACE_TYPE_LABELS: Record<string, string> = { water_edge: "水辺", wetland: "湿地", coast: "海岸", woodland: "林の中", grassland_urban_edge: "草地と市街地の境界", urban: "市街地" };
const SEASON_LABELS: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const FALLBACK_PLACE_LABEL = "このあたり（およそ半径3km）";

export function parseBandCell(value: string): { lat: number; lng: number } | null {
  if (!value || value === "hidden") return null;
  const [latRaw, lngRaw] = value.replace(/^cell:/, "").split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  return latRaw !== undefined && lngRaw !== undefined && latRaw.trim() !== "" && lngRaw.trim() !== "" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function observedMonth(observedAt: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(observedAt);
  if (m) {
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const ms = Date.parse(observedAt);
  return Number.isFinite(ms) ? new Date(ms).getUTCMonth() + 1 : null;
}

export function seasonOf(observedAt: string, lat: number): { key: string; label: string } | null {
  const month = observedMonth(observedAt);
  if (month === null) return null;
  if (Math.abs(lat) < 23.5) return { key: `m${month}`, label: `${month}月` };
  const north = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
  const flip: Record<string, string> = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" };
  const key = lat >= 0 ? north : flip[north]!;
  return { key, label: SEASON_LABELS[key]! };
}

export function placeSeasonKeyOf(row: Pick<BandPublicRow, "public_cell" | "observed_at">): { cell: string; season: { key: string; label: string } } | null {
  const cell = parseBandCell(row.public_cell);
  if (!cell) return null;
  const season = seasonOf(row.observed_at, cell.lat);
  return season ? { cell: row.public_cell, season } : null;
}

export function filterPlaceSeasonRows<T extends BandPublicRow>(rows: T[], anchor: Pick<BandPublicRow, "public_cell" | "observed_at">, nowMs: number): T[] {
  const key = placeSeasonKeyOf(anchor);
  if (!key) return [];
  return rows.filter((row) => {
    if (row.public_cell !== key.cell) return false;
    if (isLocationDelayed24Hours(row.observed_at, nowMs)) return false;
    return placeSeasonKeyOf(row)?.season.key === key.season.key;
  });
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
const missingSchema = (error: unknown) => error instanceof Error && /no such table|no such column/i.test(error.message);

export async function eligiblePublicIds(query: BandQuery, ids: string[]): Promise<Set<string>> {
  const eligible = new Set<string>();
  for (const part of chunk([...new Set(ids)], 80)) {
    const marks = part.map(() => "?").join(",");
    const base = `SELECT o.observation_id AS id FROM observations o
      WHERE o.observation_id IN (${marks}) AND o.visibility = 'public' AND o.emergency_hidden = 0 AND o.public_cell <> 'hidden'
        AND NOT EXISTS (SELECT 1 FROM observation_data_rights r WHERE r.visit_id = o.observation_id AND r.withdrawal_status IS NOT NULL AND r.withdrawal_status <> 'active')`;
    const civic = ` AND NOT EXISTS (SELECT 1 FROM civic_observation_contexts c WHERE c.visit_id = o.observation_id
        AND (COALESCE(c.risk_lane, 'normal') <> 'normal' OR COALESCE(c.audience_scope, 'private') <> 'public' OR COALESCE(c.public_precision, 'municipality') NOT IN ('municipality', 'mesh')))`;
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await query(base + civic, part);
    } catch (error) {
      if (!missingSchema(error) || !/civic_observation_contexts/i.test(String((error as Error).message))) throw error;
      rows = await query(base, part);
    }
    for (const row of rows) eligible.add(String(row.id));
  }
  return eligible;
}

type Resolved = { anchor: BandPublicRow; rows: BandPublicRow[]; seasonLabel: string; placeLabel: string };

async function resolvePlaceSeason(deps: BandDeps, recordId: string): Promise<Resolved | null> {
  const all = await deps.publicRows();
  const anchor = all.find((row) => row.observation_id === recordId);
  if (!anchor) return null;
  const key = placeSeasonKeyOf(anchor);
  if (!key) return null;
  const candidates = filterPlaceSeasonRows(all, anchor, deps.nowMs);
  const ok = await eligiblePublicIds(deps.query, candidates.map((row) => row.observation_id));
  const seen = new Set<string>();
  const rows = candidates.filter((row) => {
    if (!ok.has(row.observation_id) || seen.has(row.observation_id)) return false;
    seen.add(row.observation_id);
    return true;
  });
  if (!seen.has(recordId)) return null;
  const labelOf = deps.safeAreaLabel ?? ((v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null));
  const placeLabel = rows.map((row) => labelOf(row.public_area_label)).find((v): v is string => Boolean(v)) ?? FALLBACK_PLACE_LABEL;
  return { anchor, rows, seasonLabel: key.season.label, placeLabel };
}

export const AI_NOTE_PLACE_SEASON_COUNT_ID = "count:place-season";

export async function readPlaceSeasonCountFacts(deps: BandDeps, recordId: string): Promise<AiNoteCountFact[]> {
  try {
    const resolved = await resolvePlaceSeason(deps, recordId);
    if (!resolved || resolved.rows.length < BAND_MIN_PUBLIC_COUNT) return [];
    return [{ id: AI_NOTE_PLACE_SEASON_COUNT_ID, label: "この場所とこの季節の確認済み記録", count: resolved.rows.length }];
  } catch {
    return [];
  }
}

export const placeSeasonHref = (recordId: string) => `/api/v1/records/${encodeURIComponent(recordId)}/place-season`;

export async function readPlaceSeasonList(deps: BandDeps, recordId: string): Promise<PlaceSeasonList | null> {
  const resolved = await resolvePlaceSeason(deps, recordId);
  if (!resolved || resolved.rows.length < BAND_MIN_PUBLIC_COUNT) return null;
  const sorted = [...resolved.rows].sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.observation_id.localeCompare(b.observation_id));
  return {
    count: sorted.length,
    anchorId: recordId,
    seasonLabel: resolved.seasonLabel,
    placeLabel: resolved.placeLabel,
    items: sorted.map((row) => ({ visitId: row.observation_id, observedAt: row.observed_at.slice(0, 10), displayName: row.taxon_label ?? null, href: `/observations/${encodeURIComponent(row.observation_id)}` })),
  };
}

type OwnerRecord = { id: string; observedAt: string; cell: string; placeType: string | null };

async function ownerRecords(query: BandQuery, ownerId: string): Promise<OwnerRecord[]> {
  const rows = await query(
    `SELECT o.observation_id AS id, o.observed_at AS observed_at, o.public_cell AS cell,
            (SELECT er.structured_json FROM observation_environment_records er WHERE er.occurrence_id = o.observation_id ORDER BY er.created_at DESC LIMIT 1) AS env
       FROM observations o
      WHERE o.owner_user_id = ? AND o.emergency_hidden = 0
        AND NOT EXISTS (SELECT 1 FROM observation_data_rights r WHERE r.visit_id = o.observation_id AND r.withdrawal_status IS NOT NULL AND r.withdrawal_status <> 'active')
      ORDER BY o.observed_at ASC, o.observation_id ASC
      LIMIT 5000`,
    [ownerId],
  ).catch((error) => {
    if (!missingSchema(error)) throw error;
    return query(
      `SELECT o.observation_id AS id, o.observed_at AS observed_at, o.public_cell AS cell, NULL AS env FROM observations o
        WHERE o.owner_user_id = ? AND o.emergency_hidden = 0 ORDER BY o.observed_at ASC, o.observation_id ASC LIMIT 5000`,
      [ownerId],
    );
  });
  return rows.map((row) => {
    let placeType: string | null = null;
    try {
      const parsed = typeof row.env === "string" ? JSON.parse(row.env) : null;
      const value = parsed && typeof parsed.place_type === "string" ? parsed.place_type : null;
      placeType = value && value !== "unknown" ? value : null;
    } catch {
      placeType = null;
    }
    return { id: String(row.id), observedAt: String(row.observed_at), cell: String(row.cell ?? ""), placeType };
  });
}

export async function computeRecordCountBand(deps: BandDeps, recordId: string, viewer: BandViewer): Promise<RecordCountBand | null> {
  const resolved = await resolvePlaceSeason(deps, recordId);
  if (resolved && resolved.rows.length >= BAND_MIN_PUBLIC_COUNT) {
    const count = resolved.rows.length;
    const newest = [...resolved.rows].sort((a, b) => b.observed_at.localeCompare(a.observed_at) || b.observation_id.localeCompare(a.observation_id))[0]!;
    const unit = `${resolved.placeLabel}の${resolved.seasonLabel}の記録`;
    const ownerOfAnchor = viewer.userId ? await ownsRecord(deps.query, viewer.userId, recordId) : false;
    const text = ownerOfAnchor && newest.observation_id === recordId ? `この記録で、${unit}が${count}件になりました` : `${unit}は、いま${count}件あります`;
    return { kind: "public_place_season", count, text, href: placeSeasonHref(recordId), scope: "public" };
  }
  if (!viewer.userId || !(await ownsRecord(deps.query, viewer.userId, recordId))) return null;
  const mine = await ownerRecords(deps.query, viewer.userId);
  const self = mine.find((row) => row.id === recordId);
  if (!self) return null;
  const order = (a: OwnerRecord, b: OwnerRecord) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id);
  if (self.cell && self.cell !== "hidden") {
    const here = mine.filter((row) => row.cell === self.cell).sort(order);
    if (here.length >= 2) {
      const nth = here.findIndex((row) => row.id === recordId) + 1;
      const latest = here[here.length - 1]!.id === recordId;
      return { kind: "owner_place_nth", count: nth, text: latest ? `あなたのこの場所の記録は、これで${nth}件目です` : `あなたのこの場所の${nth}件目の記録です`, href: null, scope: "owner" };
    }
  }
  if (self.placeType && PLACE_TYPE_LABELS[self.placeType]) {
    const earlier = mine.filter((row) => row.id !== recordId && row.placeType === self.placeType && order(row, self) < 0);
    if (earlier.length === 0) {
      return { kind: "owner_first_place_type", count: null, text: `あなたの記録では、初めての${PLACE_TYPE_LABELS[self.placeType]}です`, href: null, scope: "owner" };
    }
  }
  return null;
}

async function ownsRecord(query: BandQuery, userId: string, recordId: string): Promise<boolean> {
  const rows = await query("SELECT 1 AS ok FROM observations WHERE observation_id = ? AND owner_user_id = ? LIMIT 1", [recordId, userId]);
  return rows.length > 0;
}

export type BandSessionReader = () => Promise<{ userId: string; banned?: boolean } | null>;

const NO_STORE = { "cache-control": "private, no-store", "content-type": "application/json; charset=utf-8" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: NO_STORE });

const escapeBandHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export function renderPlaceSeasonListHtml(list: PlaceSeasonList): string {
  const title = `${list.placeLabel}の${list.seasonLabel}の記録`;
  const items = list.items.map((item) => `<li><a href="/ja${escapeBandHtml(item.href)}"><span>${escapeBandHtml(item.observedAt)}</span><strong>${escapeBandHtml(item.displayName ?? "")}</strong></a></li>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeBandHtml(title)} | ZUKAN</title><style>body{margin:0;background:#fff;color:#17211B;font:16px/1.65 "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}main{max-width:640px;margin:0 auto;padding:20px}a{color:#0055AD;text-decoration:none}h1{margin:18px 0 4px;font-size:21px;line-height:1.4}p{margin:0 0 12px;color:#55615A;font-size:14px}ul{margin:0;padding:0;list-style:none}li{border-bottom:1px solid #EDF0EA}li a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;color:#17211B}li strong{font-weight:600}</style></head><body><main data-place-season-list><a href="/ja/observations/${encodeURIComponent(list.anchorId)}">← 記録にもどる</a><h1>${escapeBandHtml(title)}</h1><p>${list.count}件</p><ul>${items}</ul></main></body></html>`;
}

export async function handleRecordCountBandRoute(deps: BandDeps, readSession: BandSessionReader, pathname: string, renderHtml?: (list: PlaceSeasonList) => Response): Promise<Response | null> {
  const match = /^\/api\/v1\/records\/([^/]+)\/(count-band|place-season)$/.exec(pathname);
  if (!match) return null;
  const recordId = decodeURIComponent(match[1]!);
  if (recordId.length > 160) return respond({ ok: false, error: "not_found" }, 404);
  if (match[2] === "place-season") {
    const list = await readPlaceSeasonList(deps, recordId);
    if (list && renderHtml) return renderHtml(list);
    return list ? respond({ ok: true, ...list }) : respond({ ok: false, error: "not_found" }, 404);
  }
  const session = await readSession().catch(() => null);
  const band = await computeRecordCountBand(deps, recordId, { userId: session && !session.banned ? session.userId : null });
  return respond({ ok: true, band });
}
