import { CHEV_ICON, SHARE_SCRIPT, headBar, shell } from "./invasiveMapV1";
import { classifyInvasive } from "./mapInvasive";
import { isWeakTaxonLabel } from "./taxonNameResolver";
import { inferTaxonGroupForLabel } from "./zukanMapTaxonGroup";

export const REGION_SURFACE_V1_FLAG = "REGION_SURFACE_V1_ENABLED";

type Lang = "ja" | "en" | "es" | "pt-br";

export type RegionSpecies = { name: string; group: string; records: number; lastObservationId: string; photoUrl: string | null; invasiveSlug: string | null };
export type RegionPlace = { id: string; name: string; locality: string | null; kind: string };
export type RegionEvent = { id: string; title: string; startedAt: string };
export type RegionSurfaceData = {
  area: string;
  recordTotal: number;
  species: RegionSpecies[];
  places: RegionPlace[];
  placeTotal: number;
  events: RegionEvent[];
  eventTotal: number;
};

type Db = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null> } } };

export const GROUP_LABELS: Readonly<Record<string, string>> = {
  plant: "植物",
  bird: "鳥",
  insect: "虫",
  amphibian_reptile: "両生類・は虫類",
  mammal: "哺乳類",
  fungi: "きのこ・菌類",
  other: "その他",
};
const GROUP_ORDER = ["plant", "bird", "insect", "amphibian_reptile", "mammal", "fungi", "other"];

const PLACE_KIND_LABELS: Readonly<Record<string, string>> = {
  park: "公園",
  shrine: "神社",
  temple: "寺",
  river: "川",
  forest: "森",
  garden: "庭園",
  school: "学校",
  facility: "施設",
};

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const PLACE_AREA_SQL = "public_profile_status = 'published' AND superseded_by_place_id IS NULL AND (municipality = ?1 OR prefecture = ?1)";

async function safeAll<T>(run: () => Promise<{ results?: T[] }>): Promise<T[]> {
  try { return (await run()).results ?? []; } catch { return []; }
}

export async function loadRegionSurfaceData(
  db: Db,
  area: string,
  photoLoader: (ids: readonly string[]) => Promise<Map<string, string>>,
): Promise<RegionSurfaceData> {
  const rows = await safeAll(() => db.prepare(
    `SELECT r.observation_id, r.taxon_label, r.observed_at
       FROM readmodel_public_observations r
       JOIN observations o ON o.observation_id = r.observation_id
      WHERE r.public_area_label = ?1
        AND o.visibility = 'public'
        AND o.emergency_hidden = 0
        AND NOT EXISTS (
          SELECT 1 FROM observation_data_rights rights
           WHERE rights.visit_id = o.observation_id
             AND rights.withdrawal_status IS NOT NULL
             AND rights.withdrawal_status <> 'active'
        )
      ORDER BY r.observed_at DESC
      LIMIT 3000`,
  ).bind(area).all<{ observation_id: string; taxon_label: string | null; observed_at: string }>());
  const byName = new Map<string, { ids: string[]; records: number }>();
  for (const r of rows) {
    if (isWeakTaxonLabel(r.taxon_label)) continue;
    const name = String(r.taxon_label).normalize("NFKC").trim();
    const g = byName.get(name) ?? { ids: [], records: 0 };
    g.records += 1;
    if (g.ids.length < 4) g.ids.push(r.observation_id);
    byName.set(name, g);
  }
  const ranked = [...byName.entries()].sort((a, b) => b[1].records - a[1].records || a[0].localeCompare(b[0], "ja"));
  const photoIds = ranked.slice(0, 80).flatMap(([, g]) => g.ids);
  const photos = photoIds.length ? await photoLoader(photoIds).catch(() => new Map<string, string>()) : new Map<string, string>();
  const species: RegionSpecies[] = ranked.map(([name, g]) => {
    const pid = g.ids.find((id) => photos.has(id));
    return {
      name,
      group: inferTaxonGroupForLabel(name),
      records: g.records,
      lastObservationId: g.ids[0]!,
      photoUrl: pid ? photos.get(pid)! : null,
      invasiveSlug: classifyInvasive(name)?.learnSlug ?? null,
    };
  });
  const placeRows = await safeAll(() => db.prepare(
    `SELECT place_id, canonical_name, locality_label, place_kind FROM places WHERE ${PLACE_AREA_SQL} ORDER BY canonical_name LIMIT 5`,
  ).bind(area).all<{ place_id: string; canonical_name: string; locality_label: string | null; place_kind: string }>());
  const placeCount = await db.prepare(`SELECT COUNT(*) AS n FROM places WHERE ${PLACE_AREA_SQL}`).bind(area).first<{ n: number }>().catch(() => null);
  const eventScope = `FROM observation_event_sessions WHERE event_code IS NOT NULL AND trim(event_code) <> '' AND title IS NOT NULL AND trim(title) <> '' AND field_id IN (SELECT place_id FROM places WHERE ${PLACE_AREA_SQL})`;
  const eventRows = await safeAll(() => db.prepare(
    `SELECT session_id, title, started_at ${eventScope} ORDER BY started_at DESC LIMIT 5`,
  ).bind(area).all<{ session_id: string; title: string; started_at: string }>());
  const eventCount = await db.prepare(`SELECT COUNT(*) AS n ${eventScope}`).bind(area).first<{ n: number }>().catch(() => null);
  return {
    area,
    recordTotal: rows.length,
    species,
    places: placeRows.map((p) => ({ id: p.place_id, name: p.canonical_name, locality: p.locality_label, kind: p.place_kind })),
    placeTotal: Number(placeCount?.n ?? 0),
    events: eventRows.map((e) => ({ id: e.session_id, title: e.title, startedAt: e.started_at })),
    eventTotal: Number(eventCount?.n ?? 0),
  };
}

export const regionSurfaceHasContent = (d: RegionSurfaceData): boolean => d.species.length > 0 || d.placeTotal > 0 || d.eventTotal > 0;

const dateLabel = (iso: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[1])}月${Number(m[2])}日` : "";
};

const PIN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;
const FLAG_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>`;

const EXTRA_CSS = `
.rs-stats{display:flex;gap:24px;margin:16px 0 0;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);flex-wrap:wrap}
.rs-stat b{display:block;font-size:22px;font-weight:800;color:var(--ink)}
.rs-stat span{display:block;font-size:14px;color:var(--muted);white-space:nowrap}
.rs-cta{margin-top:16px}
.rs-cta .iv-btn{margin-top:0;width:100%;max-width:420px}
.rs-all{display:inline-flex;align-items:center;min-height:44px;color:var(--green);font-weight:700;font-size:14.5px;text-decoration:none;white-space:nowrap}
.rs-shelf-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:28px 0 4px}
.rs-shelf-h h2{margin:0;font-size:18px;font-weight:800;display:flex;align-items:baseline;gap:8px}
.rs-shelf-h h2 small{font-size:14px;font-weight:600;color:var(--muted);white-space:nowrap}
.rs-callout{display:flex;align-items:center;gap:12px;min-height:56px;margin-top:12px;padding:10px 14px;border-radius:14px;background:#FAF3E3;border:1px solid #E0CD9E;color:#8A4B00;text-decoration:none}
.rs-callout .rs-ct{flex:1;min-width:0;font-weight:800;font-size:15.5px}
.rs-callout .rs-cs{display:block;font-weight:600;font-size:14px}
.rs-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #EDF0EC;text-decoration:none;color:inherit;min-height:56px}
.rs-row .rs-b{flex:1;min-width:0}
.rs-row .rs-n{display:block;font-size:16.5px;font-weight:800;color:var(--ink)}
.rs-row .rs-m{display:block;margin-top:2px;font-size:14px;color:var(--muted)}
.rs-row svg{flex:none;color:var(--control)}
.rs-chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}
.rs-chip{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap}
.rs-chip[aria-current="true"]{background:var(--green);color:#fff;border-color:var(--green)}
.rs-foot{margin:28px 0 0;padding:16px;border-radius:16px;background:var(--surface);font-size:14.5px;line-height:1.75;color:var(--muted)}
@media(min-width:1024px){.iv-col.rs-col{max-width:880px}}
`;

const regionBase = (lang: Lang, area: string): string => `${lang === "ja" ? "/ja" : `/${lang}`}/regions/${encodeURIComponent(area)}`;

const thumb = (url: string | null): string => url
  ? `<img class="iv-thumb" src="${esc(url)}" alt="" loading="lazy" width="56" height="56">`
  : `<span class="iv-thumb-ph" aria-hidden="true"></span>`;

function dedupePhotos(species: readonly RegionSpecies[], seen: Set<string>): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const s of species) {
    if (s.photoUrl && !seen.has(s.photoUrl)) { seen.add(s.photoUrl); out.set(s.name, s.photoUrl); } else out.set(s.name, null);
  }
  return out;
}

function speciesRow(s: RegionSpecies, photo: string | null, prefix: string): string {
  const href = s.invasiveSlug ? `${prefix}/invasive/${encodeURIComponent(s.invasiveSlug)}` : `${prefix}/observations/${encodeURIComponent(s.lastObservationId)}`;
  return `<a class="rs-row" data-region-species="${esc(s.name)}" href="${esc(href)}">${thumb(photo)}<span class="rs-b"><span class="rs-n">${esc(s.name)}</span><span class="rs-m">${esc(GROUP_LABELS[s.group] ?? "その他")} ・ 記録 <span class="iv-nb">${s.records}件</span></span></span>${CHEV_ICON}</a>`;
}

const invasiveCallout = (base: string, count: number): string =>
  `<a class="rs-callout" data-region-invasive="1" href="${esc(`${base}/invasive`)}">${FLAG_ICON}<span class="rs-ct">外来種の印で見る<span class="rs-cs">この地域で見つかっている種 ${count}種</span></span>${CHEV_ICON}</a>`;

export function renderRegionSurfacePage(options: {
  data: RegionSurfaceData;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  invasiveAvailable?: boolean;
}): string {
  const { data } = options;
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const base = regionBase(options.lang, data.area);
  const stats: string[] = [];
  if (data.recordTotal > 0) stats.push(`<div class="rs-stat"><b>${data.recordTotal}</b><span>この地域の記録</span></div>`);
  if (data.species.length > 0) stats.push(`<div class="rs-stat"><b>${data.species.length}</b><span>記録された種</span></div>`);
  if (data.placeTotal > 0) stats.push(`<div class="rs-stat"><b>${data.placeTotal}</b><span>この地域の場所</span></div>`);
  if (data.eventTotal > 0) stats.push(`<div class="rs-stat"><b>${data.eventTotal}</b><span>行事</span></div>`);
  const shelves: string[] = [];
  if (data.species.length > 0) {
    const top = data.species.slice(0, 5);
    const photos = dedupePhotos(top, new Set<string>());
    const invasiveCount = data.species.filter((s) => s.invasiveSlug).length;
    shelves.push(`<section data-region-shelf="bio"><div class="rs-shelf-h"><h2>生物<small>記録されている種 ${data.species.length}</small></h2><a class="rs-all" href="${esc(`${base}/species`)}">すべて見る</a></div>
    ${top.map((s) => speciesRow(s, photos.get(s.name) ?? null, prefix)).join("")}
    ${options.invasiveAvailable && invasiveCount > 0 ? invasiveCallout(base, invasiveCount) : ""}</section>`);
  }
  if (data.placeTotal > 0) {
    const rows = data.places.map((p) => {
      const meta = [PLACE_KIND_LABELS[p.kind], p.locality].filter(Boolean).join(" ・ ");
      return `<a class="rs-row" data-region-place="${esc(p.id)}" href="${esc(`${prefix}/places/${encodeURIComponent(p.id)}`)}"><span class="rs-b"><span class="rs-n">${esc(p.name)}</span>${meta ? `<span class="rs-m">${esc(meta)}</span>` : ""}</span>${CHEV_ICON}</a>`;
    }).join("");
    shelves.push(`<section data-region-shelf="places"><div class="rs-shelf-h"><h2>場所<small>${data.placeTotal}か所</small></h2></div>${rows}</section>`);
  }
  if (data.eventTotal > 0) {
    const rows = data.events.map((e) => `<a class="rs-row" data-region-event="${esc(e.id)}" href="${esc(`${prefix}/events/${encodeURIComponent(e.id)}/preview`)}"><span class="rs-b"><span class="rs-n">${esc(e.title)}</span><span class="rs-m">${esc(dateLabel(e.startedAt))}</span></span>${CHEV_ICON}</a>`).join("");
    shelves.push(`<section data-region-shelf="events"><div class="rs-shelf-h"><h2>行事<small>${data.eventTotal}件</small></h2></div>${rows}</section>`);
  }
  const body = `<div class="iv-col rs-col" data-region-surface="${esc(data.area)}">
    ${headBar(`${prefix}/map`)}
    <div class="iv-crumb">${PIN_ICON}<span>${esc(data.area)}</span></div>
    <h1 class="iv-title">${esc(data.area)}</h1>
    ${stats.length ? `<div class="rs-stats">${stats.join("")}</div>` : ""}
    <div class="rs-cta"><a class="iv-btn" href="${esc(`${prefix}/record`)}">この地域で記録する</a></div>
    ${shelves.join("")}
    <p class="rs-foot" data-region-guide="1">この地域の面には、記録や場所から集まったものだけを並べています。店、会社・団体、人の棚は、中身が集まってから出します。</p>
  </div>`;
  return shell({
    title: data.area,
    extraCss: EXTRA_CSS,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: base,
    body,
    cspNonce: options.cspNonce,
    script: SHARE_SCRIPT,
  });
}

export function parseGroupFilter(raw: string | null): string | null {
  const v = (raw ?? "").trim();
  return GROUP_ORDER.includes(v) ? v : null;
}

export function renderRegionSpeciesListPage(options: {
  data: RegionSurfaceData;
  group: string | null;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  invasiveAvailable?: boolean;
}): string {
  const { data } = options;
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const base = regionBase(options.lang, data.area);
  const present = GROUP_ORDER.filter((g) => data.species.some((s) => s.group === g));
  const group = options.group && present.includes(options.group) ? options.group : null;
  const shown = group ? data.species.filter((s) => s.group === group) : data.species;
  const photos = dedupePhotos(shown, new Set<string>());
  const chips = present.length > 1
    ? `<nav class="rs-chips" aria-label="分類" data-region-chips="1"><a class="rs-chip" href="${esc(`${base}/species`)}"${group === null ? ' aria-current="true"' : ""}>すべて</a>${present.map((g) => `<a class="rs-chip" href="${esc(`${base}/species?group=${g}`)}"${group === g ? ' aria-current="true"' : ""}>${esc(GROUP_LABELS[g])}</a>`).join("")}</nav>`
    : "";
  const invasiveCount = data.species.filter((s) => s.invasiveSlug).length;
  const callout = options.invasiveAvailable && invasiveCount > 0 ? invasiveCallout(base, invasiveCount) : "";
  const list = shown.length
    ? `<p class="iv-note">記録が多い順に並べています。</p><div data-region-species-list="1">${shown.map((s) => speciesRow(s, photos.get(s.name) ?? null, prefix)).join("")}</div>`
    : `<p class="rs-foot" data-region-empty="1">この地域では、名前の確認が済んだ生きものの記録が、まだ集まっていません。</p><div class="rs-cta"><a class="iv-btn" href="${esc(`${prefix}/record`)}">この地域で記録する</a></div>`;
  const body = `<div class="iv-col rs-col" data-region-species-page="${esc(data.area)}">
    ${headBar(base)}
    <div class="iv-crumb">${PIN_ICON}<span>${esc(data.area)}</span></div>
    <h1 class="iv-title">生物</h1>
    ${data.species.length ? `<p class="iv-desc">この地域で記録されている種 ${data.species.length}種</p>` : ""}
    ${chips}
    ${callout}
    ${list}
  </div>`;
  return shell({
    title: `${data.area}の生物`,
    extraCss: EXTRA_CSS,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: `${base}/species`,
    body,
    cspNonce: options.cspNonce,
    script: SHARE_SCRIPT,
  });
}
