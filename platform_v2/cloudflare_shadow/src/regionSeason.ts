import { CHEV_ICON, SEO_DEFAULT_ORIGIN, headBar, shell, tr } from "./invasiveMapV1";
import { PLACE_AREA_SQL, PUBLIC_RECORD_FROM_SQL, isHigherRankName } from "./regionCounts";
import { regionPath, regionPathNoLang } from "./regionSlugs";
import { EXTRA_CSS } from "./regionSurfaceV1";
import { isWeakTaxonLabel } from "./taxonNameResolver";

type Lang = "ja" | "en" | "es" | "pt-br";
type Stmt = { bind(...v: unknown[]): Stmt; all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null>; run?(): Promise<unknown> };
export type SeasonDb = { prepare(sql: string): Stmt; batch?(statements: Stmt[]): Promise<unknown> };
export type PhotoLoader = (ids: readonly string[]) => Promise<Map<string, string>>;
export type BlockedCheck = (observationId: string) => Promise<boolean>;

export const REGION_SEASON_FLAG = "REGION_SEASON_ENABLED";
export const PEAK_BACKFILL_LIMIT = 200;
export const SEASON_SHELF_MAX = 3;

const MEMBER_SQL = `m.membership_state = 'confirmed' AND m.public_precision = 'place' AND m.removed_at IS NULL`;
const BOX_PLACE = `SELECT b.place_id FROM place_boundaries b JOIN places bp ON bp.place_id = b.place_id AND bp.public_profile_status = 'published' AND bp.superseded_by_place_id IS NULL
    WHERE b.is_primary = 1 AND b.valid_to IS NULL AND b.superseded_by_boundary_id IS NULL
      AND o.exact_lat BETWEEN b.bbox_south AND b.bbox_north AND o.exact_lng BETWEEN b.bbox_west AND b.bbox_east
    ORDER BY b.area_ha IS NULL, b.area_ha, b.place_id LIMIT 1`;
const PLACE_OF_RECORD = `COALESCE((SELECT m.place_id FROM record_place_memberships m WHERE m.record_id = r.observation_id AND ${MEMBER_SQL} LIMIT 1), (${BOX_PLACE}))`;
const SAFE_SQL = `AND NOT EXISTS (SELECT 1 FROM civic_observation_contexts c WHERE c.visit_id = r.observation_id
    AND (c.risk_lane <> 'normal' OR c.audience_scope <> 'public' OR c.public_precision NOT IN ('municipality', 'mesh')))`;
const SAFE_PUBLIC_FROM = `${PUBLIC_RECORD_FROM_SQL} ${SAFE_SQL}`;
const MONTH_OF = `CAST(substr(r.observed_at, 6, 2) AS INTEGER)`;
const seasonOf = (mo: number): number => (mo >= 3 && mo <= 5 ? 0 : mo >= 6 && mo <= 8 ? 1 : mo >= 9 && mo <= 11 ? 2 : 3);

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

async function safeAll<T>(run: () => Promise<{ results?: T[] }>): Promise<T[]> {
  try { return (await run()).results ?? []; } catch { return []; }
}

export function pickPeakMonths(monthCounts: ReadonlyMap<number, number>): number[] {
  const months = [...monthCounts.entries()].filter(([mo, n]) => mo >= 1 && mo <= 12 && n > 0);
  if (new Set(months.map(([mo]) => seasonOf(mo))).size < 2) return [];
  return months.filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([mo]) => mo).sort((a, b) => a - b);
}

export async function runPlacePeakMonthsBackfill(
  env: { PLACE_CATEGORY_BACKFILL?: string; OBS_DB: SeasonDb },
): Promise<{ scanned: number; assigned: number }> {
  const result = { scanned: 0, assigned: 0 };
  if (env.PLACE_CATEGORY_BACKFILL !== "on") return result;
  try {
    const rows = (await env.OBS_DB.prepare(
      `WITH rec AS (SELECT ${PLACE_OF_RECORD} AS place_id ${SAFE_PUBLIC_FROM}),
       pm AS (SELECT place_id, COUNT(*) AS n FROM rec WHERE place_id IS NOT NULL GROUP BY place_id)
       SELECT pm.place_id AS place_id FROM pm
         LEFT JOIN place_peak_months s ON s.place_id = pm.place_id AND s.month = 0 AND s.source = 'records'
        WHERE s.place_id IS NULL OR s.evidence_count < pm.n
        ORDER BY pm.place_id LIMIT ?1`,
    ).bind(PEAK_BACKFILL_LIMIT).all<{ place_id: string }>()).results ?? [];
    if (rows.length === 0) return result;
    const ids = rows.map((r) => r.place_id);
    const counts = (await env.OBS_DB.prepare(
      `SELECT place_id, mo, COUNT(*) AS n FROM (SELECT ${PLACE_OF_RECORD} AS place_id, ${MONTH_OF} AS mo ${SAFE_PUBLIC_FROM})
        WHERE place_id IN (SELECT value FROM json_each(?1)) GROUP BY place_id, mo`,
    ).bind(JSON.stringify(ids)).all<{ place_id: string; mo: number; n: number }>()).results ?? [];
    const byPlace = new Map<string, Map<number, number>>();
    for (const c of counts) {
      const m = byPlace.get(c.place_id) ?? new Map<number, number>();
      m.set(Number(c.mo), Number(c.n) || 0);
      byPlace.set(c.place_id, m);
    }
    const statements: Stmt[] = [];
    for (const id of ids) {
      result.scanned += 1;
      const m = byPlace.get(id) ?? new Map<number, number>();
      const total = [...m.values()].reduce((s, n) => s + n, 0);
      const peaks = pickPeakMonths(m);
      if (peaks.length > 0) result.assigned += 1;
      statements.push(env.OBS_DB.prepare(
        `DELETE FROM place_peak_months WHERE place_id = ?1 AND source = 'records' AND month BETWEEN 1 AND 12 AND month NOT IN (SELECT value FROM json_each(?2))`,
      ).bind(id, JSON.stringify(peaks)));
      for (const mo of peaks) {
        statements.push(env.OBS_DB.prepare(
          `INSERT INTO place_peak_months (place_id, month, source, evidence_count) VALUES (?1, ?2, 'records', ?3)
           ON CONFLICT(place_id, month) DO UPDATE SET evidence_count = excluded.evidence_count WHERE place_peak_months.source = 'records'`,
        ).bind(id, mo, m.get(mo) ?? 0));
      }
      statements.push(env.OBS_DB.prepare(
        `INSERT INTO place_peak_months (place_id, month, source, evidence_count) VALUES (?1, 0, 'records', ?2)
         ON CONFLICT(place_id, month) DO UPDATE SET evidence_count = excluded.evidence_count WHERE place_peak_months.source = 'records'`,
      ).bind(id, total));
    }
    if (env.OBS_DB.batch) await env.OBS_DB.batch(statements);
    else for (const s of statements) await s.run?.();
  } catch (error) {
    console.error("[place-peak-months-backfill] failed", error);
  }
  return result;
}

const speciesName = (label: string | null): string | null => {
  if (isWeakTaxonLabel(label)) return null;
  const n = String(label).normalize("NFKC").trim();
  return n && !isHigherRankName(n) ? n : null;
};

const ymd = (iso: string): { y: number; m: number; d: number } | null => {
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return x ? { y: Number(x[1]), m: Number(x[2]), d: Number(x[3]) } : null;
};
const dateText = (iso: string, lang: Lang): string => {
  const p = ymd(iso);
  if (!p) return "";
  return lang === "ja" ? `${p.m}月${p.d}日` : `${p.m}/${p.d}`;
};

export type SeasonCard = { placeId: string; name: string; observationId: string; photoUrl: string; label: string | null; observedAt: string; records: number; kind: "peak" | "month" };
export type RegionSeasonData = { month: number; cards: SeasonCard[]; monthCounts: number[] };

export async function loadMonthCounts(db: SeasonDb, area: string): Promise<number[]> {
  const rows = await safeAll(() => db.prepare(
    `SELECT ${MONTH_OF} AS mo, COUNT(*) AS n ${SAFE_PUBLIC_FROM} AND r.public_area_label = ?1 GROUP BY mo`,
  ).bind(area).all<{ mo: number; n: number }>());
  const out = new Array<number>(12).fill(0);
  for (const r of rows) if (r.mo >= 1 && r.mo <= 12) out[r.mo - 1] = Number(r.n) || 0;
  return out;
}

export async function loadRegionSeason(db: SeasonDb, area: string, now: Date, photoLoader: PhotoLoader, blocked: BlockedCheck): Promise<RegionSeasonData> {
  const month = new Date(now.getTime() + 9 * 3600000).getUTCMonth() + 1;
  const monthCounts = await loadMonthCounts(db, area);
  const out: RegionSeasonData = { month, cards: [], monthCounts };
  type Rec = { id: string; label: string | null; at: string; place_id: string };
  const peaks = (await safeAll(() => db.prepare(
    `SELECT pm.place_id AS place_id, p.canonical_name AS name, pm.evidence_count AS n
       FROM place_peak_months pm JOIN places p ON p.place_id = pm.place_id
      WHERE pm.month = ?2 AND pm.place_id IN (SELECT place_id FROM places WHERE ${PLACE_AREA_SQL})
      ORDER BY pm.evidence_count DESC, pm.place_id LIMIT 12`,
  ).bind(area, month).all<{ place_id: string; name: string; n: number }>())).map((p) => ({ ...p, kind: "peak" as const }));
  const peakRecs = peaks.length === 0 ? [] : await safeAll(() => db.prepare(
    `SELECT r.observation_id AS id, r.taxon_label AS label, r.observed_at AS at, ${PLACE_OF_RECORD} AS place_id ${SAFE_PUBLIC_FROM}
       AND ${PLACE_OF_RECORD} IN (SELECT value FROM json_each(?1)) ORDER BY r.observed_at DESC LIMIT 800`,
  ).bind(JSON.stringify(peaks.map((p) => p.place_id))).all<Rec>());
  const byPlace = new Map<string, Rec[]>();
  for (const r of peakRecs) byPlace.set(r.place_id, [...(byPlace.get(r.place_id) ?? []), r]);
  const monthRecs = await safeAll(() => db.prepare(
    `SELECT id, label, at, place_id FROM (SELECT r.observation_id AS id, r.taxon_label AS label, r.observed_at AS at, ${PLACE_OF_RECORD} AS place_id ${SAFE_PUBLIC_FROM} AND ${MONTH_OF} = ?2)
      WHERE place_id IN (SELECT place_id FROM places WHERE ${PLACE_AREA_SQL}) ORDER BY at DESC LIMIT 800`,
  ).bind(area, month).all<Rec>());
  const monthByPlace = new Map<string, Rec[]>();
  for (const r of monthRecs) monthByPlace.set(r.place_id, [...(monthByPlace.get(r.place_id) ?? []), r]);
  const peakIds = new Set(peaks.map((p) => p.place_id));
  const nameRows = monthByPlace.size === 0 ? [] : await safeAll(() => db.prepare(
    `SELECT place_id, canonical_name AS name FROM places WHERE public_profile_status = 'published' AND superseded_by_place_id IS NULL AND place_id IN (SELECT value FROM json_each(?1))`,
  ).bind(JSON.stringify([...monthByPlace.keys()].filter((id) => !peakIds.has(id)))).all<{ place_id: string; name: string }>());
  const fallback = nameRows
    .map((p) => ({ place_id: p.place_id, name: p.name, n: monthByPlace.get(p.place_id)!.length, kind: "month" as const }))
    .sort((x, y) => y.n - x.n || (monthByPlace.get(y.place_id)![0]!.at > monthByPlace.get(x.place_id)![0]!.at ? 1 : -1) || (x.place_id < y.place_id ? -1 : 1))
    .slice(0, 12);
  const candidates = [...peaks, ...fallback];
  if (candidates.length === 0) return out;
  const recsOf = (p: { place_id: string; kind: "peak" | "month" }) => ((p.kind === "peak" ? byPlace : monthByPlace).get(p.place_id) ?? []).slice(0, 6);
  const wanted = [...new Set(candidates.flatMap((p) => recsOf(p).map((r) => r.id)))];
  const photos = wanted.length ? await photoLoader(wanted).catch(() => new Map<string, string>()) : new Map<string, string>();
  const used = new Set<string>();
  for (const p of candidates) {
    if (out.cards.length >= SEASON_SHELF_MAX) break;
    for (const r of recsOf(p)) {
      const url = photos.get(r.id);
      if (!url || used.has(url)) continue;
      if (await blocked(r.id).catch(() => true)) continue;
      used.add(url);
      out.cards.push({ placeId: p.place_id, name: p.name, observationId: r.id, photoUrl: url, label: speciesName(r.label), observedAt: r.at, records: Number(p.n) || 0, kind: p.kind });
      break;
    }
  }
  return out;
}

export const REGION_SEASON_CSS = `
.sn-h{margin:28px 0 4px}
.sn-sub{margin:2px 0 0;font-size:14px;color:var(--muted)}
.sn-card{display:block;margin-top:12px;border-radius:16px;background:#fff;border:1px solid var(--line);overflow:hidden;color:var(--ink);text-decoration:none}
.sn-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--surface)}
.sn-card .sn-b{padding:14px 16px 16px}
.sn-nm{font-size:18px;font-weight:800}
.sn-w{margin-top:4px;font-size:15px;font-weight:800;color:var(--green)}
.sn-m{margin-top:6px;font-size:13.5px;font-weight:600;color:var(--muted)}
.sn-months{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:12px}
@media(min-width:1024px){.sn-months{grid-template-columns:repeat(12,1fr)}}
.sn-mo{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap}
.sn-mo[aria-current="true"]{background:var(--green);color:#fff;border-color:var(--green)}
.sn-mo[aria-disabled="true"]{color:#A9B2AB;background:var(--surface)}
.sn-go{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;margin-top:12px;padding:10px 16px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:800;font-size:16px}
.sn-go span{font-size:14px;color:var(--muted);font-weight:700;white-space:nowrap}
.sn-pair{display:grid;grid-template-columns:1fr 1fr;gap:0}
.sn-pair figure{position:relative;margin:0}
.sn-pair figcaption{position:absolute;left:10px;bottom:10px;padding:4px 10px;border-radius:8px;background:rgba(20,40,32,.82);color:#fff;font-size:13px;font-weight:800;white-space:nowrap}
.sn-pair img{aspect-ratio:1/1}
.sn-row{display:flex;align-items:center;gap:14px;min-height:56px;margin-top:10px;padding:12px 14px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none}
.sn-row img,.sn-row .sn-ph{flex:none;width:56px;height:56px;border-radius:12px;object-fit:cover;background:var(--surface)}
.sn-row .sn-t{font-size:16px;font-weight:800}
.sn-row .sn-d{margin-top:2px;font-size:14px;color:var(--muted);font-weight:600}
`;

export function renderSeasonShelf(L: Lang, base: string, prefix: string, data: RegionSeasonData | null | undefined, area: string): string {
  if (!data) return "";
  const shelf = data.cards.length === 0 ? "" : `<section data-region-shelf="season"><div class="rs-shelf-h sn-h"><h2>${tr(L, "いまの季節の場所", "Places in season")}</h2></div><p class="sn-sub">${tr(L, `${data.month}月・${area}`, `${data.month}/${area}`)}</p>${data.cards.map((c) => {
    const line = c.label ? tr(L, `${c.label}の記録`, `Record of ${c.label}`) : tr(L, "生きものの記録", "A wildlife record");
    return `<a class="sn-card" data-region-season-place="${esc(c.placeId)}" href="${esc(`${prefix}/places/${encodeURIComponent(c.placeId)}`)}"><img src="${esc(c.photoUrl)}" alt="" loading="lazy" width="640" height="360"><div class="sn-b"><div class="sn-nm">${esc(c.name)}</div><div class="sn-w">${esc(line)}</div><div class="sn-m">${c.kind === "month" ? tr(L, `${data.month}月に記録あり（${ymd(c.observedAt)?.y ?? ""}年）`, `Recorded in month ${data.month} (${ymd(c.observedAt)?.y ?? ""})`) : tr(L, `この季節の記録 ${c.records}件・最新 ${dateText(c.observedAt, L)}`, `${c.records} records this season · latest ${dateText(c.observedAt, L)}`)}</div></div></a>`;
  }).join("")}</section>`;
  const chips = data.monthCounts.map((n, i) => {
    const mo = i + 1;
    const cur = mo === data.month ? ` aria-current="true"` : "";
    const label = tr(L, `${mo}月`, String(mo));
    return n > 0
      ? `<a class="sn-mo" data-region-calendar-month="${mo}"${cur} href="${esc(`${base}/calendar/${mo}`)}">${label}</a>`
      : `<span class="sn-mo" data-region-calendar-month="${mo}" aria-disabled="true"${cur}>${label}</span>`;
  }).join("");
  const here = data.monthCounts[data.month - 1] ?? 0;
  const go = here > 0 ? `<a class="sn-go" data-region-calendar-current="1" href="${esc(`${base}/calendar/${data.month}`)}">${tr(L, `${esc(area)}の${data.month}月`, `${esc(area)} · month ${data.month}`)}<span>${tr(L, `記録 ${here}件`, `${here} records`)}${CHEV_ICON}</span></a>` : "";
  const cal = data.monthCounts.some((n) => n > 0)
    ? `<section data-region-shelf="calendar"><div class="rs-shelf-h sn-h"><h2>${tr(L, "観察暦", "Observation calendar")}</h2></div><p class="sn-sub">${tr(L, "月ごとに、場所と見つけたものが並びます", "Places and finds, month by month")}</p><div class="sn-months">${chips}</div>${go}</section>`
    : "";
  return shelf + cal;
}

export type CalendarRecord = { id: string; label: string | null; at: string; placeId: string | null };
export type CalendarPair = { placeId: string; name: string; thisYear: { id: string; url: string; at: string }; before: { id: string; url: string; at: string }; label: string | null };
export type CalendarFind = { id: string; placeName: string | null; label: string; at: string; url: string | null };
export type RegionCalendarData = { area: string; month: number; year: number; monthCounts: number[]; pairs: CalendarPair[]; finds: CalendarFind[]; nearest: number[] };

export async function loadRegionCalendar(db: SeasonDb, area: string, month: number, now: Date, photoLoader: PhotoLoader, blocked: BlockedCheck): Promise<RegionCalendarData> {
  const year = new Date(now.getTime() + 9 * 3600000).getUTCFullYear();
  const monthCounts = await loadMonthCounts(db, area);
  const out: RegionCalendarData = { area, month, year, monthCounts, pairs: [], finds: [], nearest: [] };
  if ((monthCounts[month - 1] ?? 0) === 0) {
    out.nearest = monthCounts.map((n, i) => ({ mo: i + 1, n })).filter((x) => x.n > 0)
      .sort((a, b) => Math.min(Math.abs(a.mo - month), 12 - Math.abs(a.mo - month)) - Math.min(Math.abs(b.mo - month), 12 - Math.abs(b.mo - month)) || a.mo - b.mo)
      .slice(0, 2).map((x) => x.mo);
    return out;
  }
  const rows = await safeAll(() => db.prepare(
    `SELECT r.observation_id AS id, r.taxon_label AS label, r.observed_at AS at, ${PLACE_OF_RECORD} AS place_id ${SAFE_PUBLIC_FROM}
       AND r.public_area_label = ?1 AND ${MONTH_OF} = ?2 ORDER BY r.observed_at DESC LIMIT 1500`,
  ).bind(area, month).all<{ id: string; label: string | null; at: string; place_id: string | null }>());
  const seenIds = new Set<string>();
  const recs: CalendarRecord[] = [];
  for (const r of rows) if (!seenIds.has(r.id)) { seenIds.add(r.id); recs.push({ id: r.id, label: r.label, at: r.at, placeId: r.place_id }); }
  const placeIds = [...new Set(recs.map((r) => r.placeId).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (placeIds.length) {
    for (const p of await safeAll(() => db.prepare(
      `SELECT place_id, canonical_name FROM places WHERE public_profile_status = 'published' AND superseded_by_place_id IS NULL AND place_id IN (SELECT value FROM json_each(?1))`,
    ).bind(JSON.stringify(placeIds)).all<{ place_id: string; canonical_name: string }>())) names.set(p.place_id, p.canonical_name);
  }
  const groups = new Map<string, { now: CalendarRecord[]; before: CalendarRecord[] }>();
  for (const r of recs) {
    if (!r.placeId || !names.has(r.placeId)) continue;
    const g = groups.get(r.placeId) ?? { now: [], before: [] };
    ((ymd(r.at)?.y ?? 0) >= year ? g.now : g.before).push(r);
    groups.set(r.placeId, g);
  }
  const candidates = [...groups.entries()].filter(([, g]) => g.now.length > 0 && g.before.length > 0).slice(0, 12);
  const photoIds = [
    ...candidates.flatMap(([, g]) => [...g.now.slice(0, 3), ...g.before.slice(0, 3)].map((r) => r.id)),
    ...recs.slice(0, 40).map((r) => r.id),
  ];
  const photos = photoIds.length ? await photoLoader([...new Set(photoIds)]).catch(() => new Map<string, string>()) : new Map<string, string>();
  const used = new Set<string>();
  const usedRecords = new Set<string>();
  const firstUsable = async (list: CalendarRecord[]): Promise<{ r: CalendarRecord; url: string } | null> => {
    for (const r of list.slice(0, 3)) {
      const url = photos.get(r.id);
      if (!url || used.has(url)) continue;
      if (await blocked(r.id).catch(() => true)) continue;
      return { r, url };
    }
    return null;
  };
  for (const [placeId, g] of candidates) {
    const a = await firstUsable(g.now);
    if (!a) continue;
    used.add(a.url);
    const b = await firstUsable(g.before);
    if (!b) { used.delete(a.url); continue; }
    used.add(b.url);
    usedRecords.add(a.r.id);
    usedRecords.add(b.r.id);
    out.pairs.push({ placeId, name: names.get(placeId)!, thisYear: { id: a.r.id, url: a.url, at: a.r.at }, before: { id: b.r.id, url: b.url, at: b.r.at }, label: speciesName(a.r.label) ?? speciesName(b.r.label) });
  }
  const seenFind = new Set<string>();
  for (const r of recs) {
    if (out.finds.length >= 30) break;
    if (usedRecords.has(r.id)) continue;
    const label = speciesName(r.label);
    if (!label) continue;
    const key = `${r.placeId ?? ""}|${label}`;
    if (seenFind.has(key)) continue;
    if (await blocked(r.id).catch(() => true)) continue;
    seenFind.add(key);
    const url = photos.get(r.id);
    const showUrl = url && !used.has(url) ? url : null;
    if (showUrl) used.add(showUrl);
    out.finds.push({ id: r.id, placeName: r.placeId ? names.get(r.placeId) ?? null : null, label, at: r.at, url: showUrl });
  }
  return out;
}

export function renderRegionCalendarPage(options: {
  data: RegionCalendarData;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  origin?: string;
}): string {
  const { data } = options;
  const L = options.lang;
  const prefix = `/${L}`;
  const base = regionPath(L, data.area);
  const mo = data.month;
  const self = `${base}/calendar/${mo}`;
  const head = tr(L, `${data.area}の${mo}月`, `${data.area}, month ${mo}`);
  const pairs = data.pairs.map((p) => {
    const yb = ymd(p.before.at)?.y ?? data.year - 1;
    const beforeLabel = yb === data.year - 1 ? tr(L, `去年・${mo}月`, `Last year · ${mo}`) : tr(L, `${yb}年・${mo}月`, `${yb} · ${mo}`);
    return `<a class="sn-card" data-region-calendar-pair="${esc(p.placeId)}" href="${esc(`${prefix}/places/${encodeURIComponent(p.placeId)}`)}"><div class="sn-pair"><figure><img src="${esc(p.thisYear.url)}" alt="" loading="lazy" width="320" height="320"><figcaption>${tr(L, `今年・${mo}月`, `This year · ${mo}`)}</figcaption></figure><figure><img src="${esc(p.before.url)}" alt="" loading="lazy" width="320" height="320"><figcaption>${esc(beforeLabel)}</figcaption></figure></div><div class="sn-b"><div class="sn-nm">${esc(p.name)}</div><div class="sn-m">${tr(L, `同じ場所の、今年と${yb === data.year - 1 ? "去年" : `${yb}年`}の${mo}月。${dateText(p.thisYear.at, L)}と${dateText(p.before.at, L)}の記録`, `The same place in ${mo}: ${dateText(p.thisYear.at, L)} and ${dateText(p.before.at, L)}`)}</div></div></a>`;
  }).join("");
  const finds = data.finds.map((f) => `<a class="sn-row" data-region-calendar-find="${esc(f.id)}" href="${esc(`${prefix}/observations/${encodeURIComponent(f.id)}`)}">${f.url ? `<img src="${esc(f.url)}" alt="" loading="lazy" width="56" height="56">` : `<span class="sn-ph" aria-hidden="true"></span>`}<span><div class="sn-t">${esc(f.label)}</div><div class="sn-d">${esc([f.placeName, dateText(f.at, L)].filter(Boolean).join("・"))}</div></span></a>`).join("");
  const empty = data.pairs.length === 0 && data.finds.length === 0;
  const others = data.monthCounts.map((n, i) => ({ m: i + 1, n })).filter((x) => x.n > 0 && x.m !== mo);
  const nearestList = (data.nearest.length ? others.filter((x) => data.nearest.includes(x.m)) : others.slice(0, 3));
  const otherRows = nearestList.map((x) => `<a class="sn-go" data-region-calendar-other="${x.m}" href="${esc(`${base}/calendar/${x.m}`)}">${tr(L, `${esc(data.area)}の${x.m}月`, `${esc(data.area)} · month ${x.m}`)}<span>${tr(L, `記録 ${x.n}件`, `${x.n} records`)}${CHEV_ICON}</span></a>`).join("");
  const nearHint = data.nearest.length ? `<p class="rs-foot" data-region-calendar-empty="1">${tr(L, `${mo}月の記録はまだありません。記録のある近い月を見る`, `No records in month ${mo} yet. Nearby months with records:`)}</p>` : "";
  const body = `<div class="iv-col rs-col" data-region-calendar-page="${esc(data.area)}" data-region-calendar-month-page="${mo}">
    ${headBar(base, L)}
    <h1 class="iv-title">${esc(head)}</h1>
    <p class="iv-desc">${tr(L, "この月に見つかった、場所と発見の組です", "Places and finds from this month")}</p>
    <a class="rs-all" data-region-calendar-back="1" href="${esc(base)}">${tr(L, `${esc(data.area)}のページへ戻る`, `Back to ${esc(data.area)}`)}</a>
    ${nearHint}${pairs}
    ${finds ? `<div class="rs-shelf-h sn-h"><h2>${tr(L, "今月の発見", "Finds this month")}</h2></div>${finds}` : ""}
    ${empty && !data.nearest.length ? `<p class="rs-foot" data-region-calendar-empty="1">${tr(L, "この月の記録はまだありません", "No records this month yet.")}</p>` : ""}
    ${otherRows ? `<div class="rs-shelf-h sn-h"><h2>${tr(L, "ほかの月", "Other months")}</h2></div>${otherRows}` : ""}
  </div>`;
  const title = tr(L, `${data.area}の観察暦 ${mo}月`, `${data.area} observation calendar, month ${mo}`);
  return shell({
    seo: {
      title: `${title} | ZUKAN`,
      description: tr(L, `${data.area}の${mo}月に見つかった、場所と発見。ZUKANの公開記録から集めています。`, `Places and finds in ${data.area} for month ${mo}, gathered from public records on ZUKAN.`),
      origin: options.origin ?? SEO_DEFAULT_ORIGIN,
      suffix: `${regionPathNoLang(data.area)}/calendar/${mo}`,
      image: data.pairs[0]?.thisYear.url ?? data.finds.find((f) => f.url)?.url ?? null,
    },
    title,
    extraCss: EXTRA_CSS + REGION_SEASON_CSS,
    lang: L,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: self,
    body,
    cspNonce: options.cspNonce,
  });
}
