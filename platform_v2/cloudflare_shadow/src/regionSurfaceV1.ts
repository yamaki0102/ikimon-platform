import { CHEV_ICON, SEO_DEFAULT_ORIGIN, cellHalfStep, headBar, parseCell, plural, shareScript, shell, tr } from "./invasiveMapV1";
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
  cells?: RegionCell[];
};
export type RegionCell = { cell: string; count: number };

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
const GROUP_LABELS_EN: Readonly<Record<string, string>> = {
  plant: "Plants",
  bird: "Birds",
  insect: "Insects",
  amphibian_reptile: "Amphibians and reptiles",
  mammal: "Mammals",
  fungi: "Fungi",
  other: "Other",
};
const groupLabel = (g: string, lang: Lang): string => (lang === "ja" ? GROUP_LABELS[g] ?? "その他" : GROUP_LABELS_EN[g] ?? "Other");
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

const PLACE_KIND_LABELS_EN: Readonly<Record<string, string>> = {
  park: "Park",
  shrine: "Shrine",
  temple: "Temple",
  river: "River",
  forest: "Forest",
  garden: "Garden",
  school: "School",
  facility: "Facility",
};

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const PREFECTURE_PREFIX = /^(?:北海道|東京都|京都府|大阪府|[^\s都道府県]{2,3}県)(?=.)/;
const WARD_SUFFIX = /^(.{1,6}市).{1,6}区$/;

export function regionKeyFromLabel(value: unknown): string | null {
  let v = String(value ?? "").normalize("NFKC").replace(/\s+/g, "");
  if (!v) return null;
  v = v.replace(PREFECTURE_PREFIX, "");
  v = v.replace(WARD_SUFFIX, "$1");
  return v || null;
}

const PLACE_AREA_SQL = `public_profile_status = 'published' AND superseded_by_place_id IS NULL AND (
  municipality = ?1 OR prefecture = ?1 OR locality_label = ?1
  OR (locality_label LIKE '%' || ?1 AND length(locality_label) <= length(?1) + 4)
  OR (locality_label LIKE '%' || ?1 || '%区' AND length(locality_label) <= length(?1) + 8)
  OR CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.municipality') END = ?1)`;

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
  const cellRows = await safeAll(() => db.prepare(
    `SELECT r.public_cell AS cell, COUNT(*) AS n
       FROM readmodel_public_observations r
       JOIN observations o ON o.observation_id = r.observation_id
      WHERE r.public_area_label = ?1 AND r.public_cell IS NOT NULL AND o.visibility = 'public' AND o.emergency_hidden = 0
      GROUP BY r.public_cell ORDER BY n DESC LIMIT 40`,
  ).bind(area).all<{ cell: string; n: number }>());
  return {
    area,
    cells: cellRows.map((c) => ({ cell: String(c.cell), count: Number(c.n) })),
    recordTotal: rows.length,
    species,
    places: placeRows.map((p) => ({ id: p.place_id, name: p.canonical_name, locality: p.locality_label, kind: p.place_kind })),
    placeTotal: Number(placeCount?.n ?? 0),
    events: eventRows.map((e) => ({ id: e.session_id, title: e.title, startedAt: e.started_at })),
    eventTotal: Number(eventCount?.n ?? 0),
  };
}

export async function loadPlaceRegionArea(db: Db, placeId: string, normalize: (v: string) => string | null): Promise<string | null> {
  try {
    const row = await db.prepare("SELECT municipality, locality_label, metadata_json FROM places WHERE place_id = ?1 AND public_profile_status = 'published' AND superseded_by_place_id IS NULL LIMIT 1").bind(placeId).first<{ municipality: string | null; locality_label?: string | null; metadata_json?: string | null }>();
    if (!row) return null;
    let metaMunicipality: unknown = null;
    try { metaMunicipality = row.metadata_json ? (JSON.parse(row.metadata_json) as { municipality?: unknown }).municipality : null; } catch { metaMunicipality = null; }
    for (const candidate of [row.municipality, metaMunicipality, row.locality_label]) {
      const area = regionKeyFromLabel(candidate);
      if (area && normalize(area) === area) return area;
    }
    return null;
  } catch { return null; }
}

export function regionMapCardHtml(cells: readonly RegionCell[], mapHref: string, lang: Lang = "ja"): string {
  const parsed = cells.map((c) => ({ ...c, p: parseCell(c.cell), h: cellHalfStep(c.cell) })).filter((c): c is typeof c & { p: { lat: number; lng: number } } => c.p !== null);
  if (parsed.length === 0) return "";
  const W = 288;
  const H = 200;
  const pad = 28;
  const minLat = Math.min(...parsed.map((c) => c.p.lat - c.h));
  const maxLat = Math.max(...parsed.map((c) => c.p.lat + c.h));
  const minLng = Math.min(...parsed.map((c) => c.p.lng - c.h));
  const maxLng = Math.max(...parsed.map((c) => c.p.lng + c.h));
  const kx = Math.max(Math.cos(((minLat + maxLat) / 2) * Math.PI / 180), 0.1);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY, 12000);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const rects = parsed.map((c) => {
    const w = Math.max(c.h * 2 * kx * scale, 22);
    const h = Math.max(c.h * 2 * scale, 22);
    const cx = offX + (c.p.lng - minLng) * kx * scale;
    const cy = offY + (maxLat - c.p.lat) * scale;
    const x = Math.min(Math.max(cx - w / 2, 3), W - w - 3);
    const y = Math.min(Math.max(cy - h / 2, 3), H - h - 3);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="#143F2E" fill-opacity="${(0.14 + Math.min(c.count, 20) / 20 * 0.4).toFixed(2)}" stroke="#143F2E" stroke-opacity=".55" stroke-width="1.5"/>`;
  }).join("");
  return `<div class="rs-rc" data-region-map="1"><div class="rs-rh">${tr(lang, "この地域の地図", "Map of this area")}</div><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${tr(lang, "この地域の記録がある範囲（大まかな位置）", "Area with records in this region (approximate location)")}" preserveAspectRatio="xMidYMid meet"><rect width="${W}" height="${H}" rx="12" fill="#EDEFE7"/>${rects}</svg><p class="rs-rn">${tr(lang, "記録がある範囲を、大まかに表示しています。", "The area with records is shown roughly.")}</p><a class="rs-all" href="${esc(mapHref)}">${tr(lang, "地図で見る", "View on map")}</a></div>`;
}

export const regionSurfaceHasContent = (d: RegionSurfaceData): boolean => d.species.length > 0 || d.placeTotal > 0 || d.eventTotal > 0;

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (iso: string, lang: Lang = "ja"): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return lang === "ja" ? `${Number(m[1])}月${Number(m[2])}日` : `${EN_MONTHS[Number(m[1]) - 1] ?? ""} ${Number(m[2])}`;
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
.rs-rail{display:none}
@media(min-width:1280px){.iv-col.rs-col.rs-wide{max-width:1120px;display:grid;grid-template-columns:minmax(0,1fr) 320px;column-gap:40px;align-items:start}.rs-wide .rs-main{min-width:0}.rs-wide .rs-rail{display:flex;flex-direction:column;gap:16px;position:sticky;top:16px;padding-top:6px}}
.rs-rc{background:var(--surface);border-radius:16px;padding:18px}
.rs-rh{font-size:16px;font-weight:800;color:var(--ink);margin-bottom:12px}
.rs-rc svg{display:block;border:1px solid var(--line);border-radius:12px}
.rs-rn{margin:10px 0 0;font-size:13.5px;line-height:1.65;color:var(--muted)}
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

function speciesRow(s: RegionSpecies, photo: string | null, prefix: string, lang: Lang): string {
  const href = s.invasiveSlug ? `${prefix}/invasive/${encodeURIComponent(s.invasiveSlug)}` : `${prefix}/observations/${encodeURIComponent(s.lastObservationId)}`;
  return `<a class="rs-row" data-region-species="${esc(s.name)}" href="${esc(href)}">${thumb(photo)}<span class="rs-b"><span class="rs-n">${esc(s.name)}</span><span class="rs-m">${lang === "ja" ? `${esc(groupLabel(s.group, lang))} ・ 記録 <span class="iv-nb">${s.records}件</span>` : `${esc(groupLabel(s.group, lang))} · <span class="iv-nb">${plural(s.records, "record", "records")}</span>`}</span></span>${CHEV_ICON}</a>`;
}

const invasiveCallout = (base: string, count: number, lang: Lang): string =>
  `<a class="rs-callout" data-region-invasive="1" href="${esc(`${base}/invasive`)}">${FLAG_ICON}<span class="rs-ct">${tr(lang, "外来種の印で見る", "View by invasive-species marks")}<span class="rs-cs">${tr(lang, `この地域で見つかっている種 ${count}種`, `Species found in this area: ${count}`)}</span></span>${CHEV_ICON}</a>`;

export function renderRegionSurfacePage(options: {
  data: RegionSurfaceData;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  invasiveAvailable?: boolean;
  origin?: string;
}): string {
  const { data } = options;
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const base = regionBase(options.lang, data.area);
  const stats: string[] = [];
  const L = options.lang;
  if (data.recordTotal > 0) stats.push(`<div class="rs-stat"><b>${data.recordTotal}</b><span>${tr(L, "この地域の記録", "Records in this area")}</span></div>`);
  if (data.species.length > 0) stats.push(`<div class="rs-stat"><b>${data.species.length}</b><span>${tr(L, "記録された種", "Species recorded")}</span></div>`);
  if (data.placeTotal > 0) stats.push(`<div class="rs-stat"><b>${data.placeTotal}</b><span>${tr(L, "この地域の場所", "Places in this area")}</span></div>`);
  if (data.eventTotal > 0) stats.push(`<div class="rs-stat"><b>${data.eventTotal}</b><span>${tr(L, "行事", "Events")}</span></div>`);
  const shelves: string[] = [];
  if (data.species.length > 0) {
    const top = data.species.slice(0, 5);
    const photos = dedupePhotos(top, new Set<string>());
    const invasiveCount = data.species.filter((s) => s.invasiveSlug).length;
    shelves.push(`<section data-region-shelf="bio"><div class="rs-shelf-h"><h2>${tr(L, "生物", "Wildlife")}<small>${tr(L, "記録されている種", "Species recorded")} ${data.species.length}</small></h2><a class="rs-all" href="${esc(`${base}/species`)}">${tr(L, "すべて見る", "See all")}</a></div>
    ${top.map((s) => speciesRow(s, photos.get(s.name) ?? null, prefix, L)).join("")}
    ${options.invasiveAvailable && invasiveCount > 0 ? invasiveCallout(base, invasiveCount, L) : ""}</section>`);
  }
  if (data.placeTotal > 0) {
    const rows = data.places.map((p) => {
      const meta = [(L === "ja" ? PLACE_KIND_LABELS : PLACE_KIND_LABELS_EN)[p.kind], p.locality].filter(Boolean).join(L === "ja" ? " ・ " : " · ");
      return `<a class="rs-row" data-region-place="${esc(p.id)}" href="${esc(`${prefix}/places/${encodeURIComponent(p.id)}`)}"><span class="rs-b"><span class="rs-n">${esc(p.name)}</span>${meta ? `<span class="rs-m">${esc(meta)}</span>` : ""}</span>${CHEV_ICON}</a>`;
    }).join("");
    shelves.push(`<section data-region-shelf="places"><div class="rs-shelf-h"><h2>${tr(L, "場所", "Places")}<small>${tr(L, `${data.placeTotal}か所`, plural(data.placeTotal, "place", "places"))}</small></h2></div>${rows}</section>`);
  }
  if (data.eventTotal > 0) {
    const rows = data.events.map((e) => `<a class="rs-row" data-region-event="${esc(e.id)}" href="${esc(`${prefix}/events/${encodeURIComponent(e.id)}/preview`)}"><span class="rs-b"><span class="rs-n">${esc(e.title)}</span><span class="rs-m">${esc(dateLabel(e.startedAt, L))}</span></span>${CHEV_ICON}</a>`).join("");
    shelves.push(`<section data-region-shelf="events"><div class="rs-shelf-h"><h2>${tr(L, "行事", "Events")}<small>${tr(L, `${data.eventTotal}件`, plural(data.eventTotal, "event", "events"))}</small></h2></div>${rows}</section>`);
  }
  const mapCard = regionMapCardHtml(data.cells ?? [], `${prefix}/map`, L);
  const body = `<div class="iv-col rs-col${mapCard ? " rs-wide" : ""}" data-region-surface="${esc(data.area)}"><div class="rs-main">
    ${headBar(`${prefix}/map`, L)}
    <div class="iv-crumb">${PIN_ICON}<span>${esc(data.area)}</span></div>
    <h1 class="iv-title">${esc(data.area)}</h1>
    ${stats.length ? `<div class="rs-stats">${stats.join("")}</div>` : ""}
    <div class="rs-cta"><a class="iv-btn" href="${esc(`${prefix}/record`)}">${tr(L, "この地域で記録する", "Record in this area")}</a></div>
    ${shelves.join("")}
    <p class="rs-foot" data-region-guide="1">${tr(L, "この地域の面には、記録や場所から集まったものだけを並べています。店、会社・団体、人の棚は、中身が集まってから出します。", "This area page lists only what has been gathered from records and places. Shelves for shops, companies and organizations, and people will appear once there is content for them.")}</p>
  </div>${mapCard ? `<aside class="rs-rail" aria-label="${tr(L, "この地域の地図", "Map of this area")}">${mapCard}</aside>` : ""}</div>`;
  const parts = L === "ja"
    ? [data.species.length > 0 ? `記録された生きもの${data.species.length}種` : "", data.recordTotal > 0 ? `記録${data.recordTotal}件` : "", data.placeTotal > 0 ? `場所${data.placeTotal}か所` : ""].filter(Boolean)
    : [data.species.length > 0 ? plural(data.species.length, "species", "species") : "", data.recordTotal > 0 ? plural(data.recordTotal, "record", "records") : "", data.placeTotal > 0 ? plural(data.placeTotal, "place", "places") : ""].filter(Boolean);
  const description = L === "ja"
    ? `${data.area}の生きものと場所。${parts.join("、")}。ZUKANの公開記録から集めています。`
    : `Wildlife and places in ${data.area}: ${parts.join(", ")}. Gathered from public records on ZUKAN.`;
  return shell({
    seo: { title: tr(L, `${data.area}の生きもの・場所 | ZUKAN`, `Wildlife and places in ${data.area} | ZUKAN`), description, origin: options.origin ?? SEO_DEFAULT_ORIGIN, suffix: `/regions/${encodeURIComponent(data.area)}`, image: data.species.slice(0, 5).find((sp) => sp.photoUrl)?.photoUrl ?? null },
    title: data.area,
    extraCss: EXTRA_CSS,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: base,
    body,
    cspNonce: options.cspNonce,
    script: shareScript(options.lang),
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
  origin?: string;
}): string {
  const { data } = options;
  const L = options.lang;
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const base = regionBase(options.lang, data.area);
  const present = GROUP_ORDER.filter((g) => data.species.some((s) => s.group === g));
  const group = options.group && present.includes(options.group) ? options.group : null;
  const shown = group ? data.species.filter((s) => s.group === group) : data.species;
  const photos = dedupePhotos(shown, new Set<string>());
  const chips = present.length > 1
    ? `<nav class="rs-chips" aria-label="${tr(L, "分類", "Category")}" data-region-chips="1"><a class="rs-chip" href="${esc(`${base}/species`)}"${group === null ? ' aria-current="true"' : ""}>${tr(L, "すべて", "All")}</a>${present.map((g) => `<a class="rs-chip" href="${esc(`${base}/species?group=${g}`)}"${group === g ? ' aria-current="true"' : ""}>${esc(groupLabel(g, L))}</a>`).join("")}</nav>`
    : "";
  const invasiveCount = data.species.filter((s) => s.invasiveSlug).length;
  const callout = options.invasiveAvailable && invasiveCount > 0 ? invasiveCallout(base, invasiveCount, L) : "";
  const list = shown.length
    ? `<p class="iv-note">${tr(L, "記録が多い順に並べています。", "Sorted by number of records.")}</p><div data-region-species-list="1">${shown.map((s) => speciesRow(s, photos.get(s.name) ?? null, prefix, L)).join("")}</div>`
    : `<p class="rs-foot" data-region-empty="1">${tr(L, "この地域では、名前の確認が済んだ生きものの記録が、まだ集まっていません。", "No records of wildlife with confirmed names have been gathered in this area yet.")}</p><div class="rs-cta"><a class="iv-btn" href="${esc(`${prefix}/record`)}">${tr(L, "この地域で記録する", "Record in this area")}</a></div>`;
  const body = `<div class="iv-col rs-col" data-region-species-page="${esc(data.area)}">
    ${headBar(base, L)}
    <div class="iv-crumb">${PIN_ICON}<span>${esc(data.area)}</span></div>
    <h1 class="iv-title">${tr(L, "生物", "Wildlife")}</h1>
    ${data.species.length ? `<p class="iv-desc">${tr(L, `この地域で記録されている種 ${data.species.length}種`, `Species recorded in this area: ${data.species.length}`)}</p>` : ""}
    ${chips}
    ${callout}
    ${list}
  </div>`;
  const description = L === "ja"
    ? `${data.area}で記録されている生きもの${data.species.length}種の一覧。ZUKANの公開記録から。`
    : `${plural(data.species.length, "species", "species")} recorded in ${data.area}. From public records on ZUKAN.`;
  return shell({
    seo: { title: tr(L, `${data.area}の生きもの一覧 | ZUKAN`, `Wildlife in ${data.area} | ZUKAN`), description, origin: options.origin ?? SEO_DEFAULT_ORIGIN, suffix: `/regions/${encodeURIComponent(data.area)}/species`, image: data.species.slice(0, 5).find((sp) => sp.photoUrl)?.photoUrl ?? null },
    title: tr(L, `${data.area}の生物`, `Wildlife in ${data.area}`),
    extraCss: EXTRA_CSS,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: `${base}/species`,
    body,
    cspNonce: options.cspNonce,
    script: shareScript(options.lang),
  });
}
