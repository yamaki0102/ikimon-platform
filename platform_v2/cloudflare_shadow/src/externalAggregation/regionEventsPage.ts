import { SEO_DEFAULT_ORIGIN, headBar, shell, tr } from "../invasiveMapV1";
import { EXTRA_CSS } from "../regionSurfaceV1";
import { regionPath, regionPathNoLang } from "../regionSlugs";
import { eventTiming } from "../zukanEventUi";
import { EXT_SHELF_CSS, type ExtEventCard } from "./regionShelf";

type Lang = "ja" | "en" | "es" | "pt-br";
type Db = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null> } } };

export const EVENT_LIST_PAGE_SIZE = 30;

export const EVENT_CATEGORY_CHIPS: { key: string; ja: string; en: string; values: string[] }[] = [
  { key: "かんきょう", ja: "自然・かんきょう", en: "Nature", values: ["かんきょう"] },
  { key: "こそだて", ja: "こそだて", en: "Parenting", values: ["こそだて"] },
  { key: "講座", ja: "講座", en: "Courses", values: ["講座・教室", "講座"] },
  { key: "スポーツ", ja: "スポーツ", en: "Sports", values: ["スポーツ"] },
  { key: "おんがく", ja: "おんがく", en: "Music", values: ["おんがく"] },
  { key: "けんこう", ja: "けんこう", en: "Health", values: ["けんこう"] },
  { key: "イベント", ja: "もよおし", en: "Festivals", values: ["イベント"] },
];

export type RegionEventListItem = ExtEventCard;
export type RegionEventList = {
  items: ExtEventCard[];
  total: number;
  page: number;
  pages: number;
  cat: string | null;
  ward: string | null;
  wards: { code: string; name: string }[];
  sources: string[];
  fetched: string;
};

const JST_MS = 9 * 3600 * 1000;
const jstDay = (now: Date): string => new Date(now.getTime() + JST_MS).toISOString().slice(0, 10);
const dayOf = (iso: string): string => iso.slice(0, 10);

const SRC_COND = `r.gone_at IS NULL AND s.terms_status<>'blocked' AND r.url LIKE 'http%' AND trim(s.name)<>''`;
const SOURCED = `EXISTS (SELECT 1 FROM ext_item_sources i JOIN ext_source_records r ON r.record_id=i.record_id JOIN ext_sources s ON s.source_id=r.source_id
  WHERE i.item_kind='event' AND i.item_id=e.event_id AND ${SRC_COND})`;
const REP = `SELECT r.record_id FROM ext_item_sources i JOIN ext_source_records r ON r.record_id=i.record_id JOIN ext_sources s ON s.source_id=r.source_id
  WHERE i.item_kind='event' AND i.item_id=e.event_id AND ${SRC_COND}
  ORDER BY CASE i.role WHEN 'official' THEN 0 ELSE 1 END, r.record_id LIMIT 1`;
const CAT_EXPR = `e.category`;

type Row = {
  event_id: string; title: string; starts_at: string; ends_at: string | null; all_day: number;
  place_name: string | null; ward_name: string | null; organizer_name: string | null;
  url: string; source_name: string; fetched_at: string;
};

const emptyList = (page = 1, cat: string | null = null, ward: string | null = null): RegionEventList =>
  ({ items: [], total: 0, page, pages: 1, cat, ward, wards: [], sources: [], fetched: "" });

export async function loadRegionEventList(
  db: Db,
  area: string,
  now: Date = new Date(),
  opts: { page?: number | null; cat?: string | null; ward?: string | null } = {},
): Promise<RegionEventList> {
  const catChip = EVENT_CATEGORY_CHIPS.find((c) => c.key === opts.cat) ?? null;
  const wardIn = (opts.ward ?? "").trim();
  const page0 = Math.max(1, Math.floor(Number(opts.page)) || 1);
  try {
    const city = await db.prepare("SELECT code FROM admin_units WHERE level='city' AND name_ja=?1 ORDER BY code LIMIT 1").bind(area).first<{ code: string }>();
    if (!city) return emptyList(page0, catChip?.key ?? null);
    const day = jstDay(now);
    const wardRows = (await db.prepare(
      `SELECT DISTINCT w.code AS code, w.name_ja AS name FROM ext_events e
       JOIN ext_places p ON p.place_id=e.place_id
       JOIN admin_units w ON w.code=p.admin_unit_id AND w.level='ward' AND w.valid_to IS NULL AND w.parent_code=?1
       WHERE e.city_unit_id=?1 AND e.status='active' AND e.starts_at>=?2 AND ${SOURCED}
       ORDER BY w.code`,
    ).bind(city.code, day).all<{ code: string; name: string }>()).results ?? [];
    const ward = wardRows.find((w) => w.code === wardIn)?.code ?? null;
    const binds: unknown[] = [city.code, day];
    let cond = `e.city_unit_id=?1 AND e.status='active' AND e.starts_at>=?2`;
    if (catChip) {
      cond += ` AND ${CAT_EXPR} IN (${catChip.values.map((v) => { binds.push(v); return `?${binds.length}`; }).join(",")})`;
    }
    if (ward) { binds.push(ward); cond += ` AND p.admin_unit_id=?${binds.length}`; }
    const from = `FROM ext_events e
       LEFT JOIN ext_places p ON p.place_id=e.place_id
       LEFT JOIN admin_units w ON w.code=p.admin_unit_id AND w.level='ward'
       LEFT JOIN ext_orgs o ON o.org_id=e.org_id
       JOIN ext_source_records rr ON rr.record_id=(${REP})
       JOIN ext_sources ss ON ss.source_id=rr.source_id
       WHERE ${cond}`;
    const totalRow = await db.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...binds).first<{ n: number }>();
    const total = Number(totalRow?.n ?? 0);
    const pages = Math.max(1, Math.ceil(total / EVENT_LIST_PAGE_SIZE));
    const page = Math.min(page0, pages);
    if (total <= 0) return { ...emptyList(page, catChip?.key ?? null, ward), wards: wardRows };
    const rows = (await db.prepare(
      `SELECT e.event_id, e.title, e.starts_at, e.ends_at, e.all_day, p.name AS place_name, w.name_ja AS ward_name, o.display_name AS organizer_name,
              rr.url AS url, ss.name AS source_name, rr.last_seen_at AS fetched_at
       ${from}
       ORDER BY e.starts_at ASC, e.event_id ASC LIMIT ${EVENT_LIST_PAGE_SIZE} OFFSET ${(page - 1) * EVENT_LIST_PAGE_SIZE}`,
    ).bind(...binds).all<Row>()).results ?? [];
    const items: ExtEventCard[] = rows.map((r) => ({
      event_id: r.event_id,
      title: r.title,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      all_day: Boolean(r.all_day),
      venue_name: r.place_name ? (r.ward_name ? `${r.place_name}（${r.ward_name}）` : r.place_name) : null,
      organizer_name: r.organizer_name?.trim() || null,
      url: r.url,
      source_name: r.source_name,
      fetched_at: r.fetched_at,
    }));
    const sources = [...new Set(items.map((c) => c.source_name.trim()))];
    const fetched = items.map((c) => dayOf(c.fetched_at)).filter(Boolean).sort().pop() ?? "";
    return { items, total, page, pages, cat: catChip?.key ?? null, ward, wards: wardRows, sources, fetched };
  } catch {
    return emptyList(page0, catChip?.key ?? null);
  }
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const EVENTS_CSS = `
.re-day{margin:24px 0 0;padding:0 0 6px;font-size:16px;font-weight:800;color:var(--ink);border-bottom:2px solid var(--line)}
.re-pager{display:flex;justify-content:space-between;gap:12px;margin:20px 0 0}
.re-pager a,.re-pager span{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--line);font-size:15px;font-weight:700;white-space:nowrap;text-decoration:none;color:var(--ink);background:#fff}
.re-pager span{visibility:hidden}
.re-chips{margin-top:12px}
`;

export function renderRegionEventsPage(options: {
  list: RegionEventList;
  area: string;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  origin?: string;
}): string {
  const { list, area } = options;
  const L = options.lang;
  const base = regionPath(L, area);
  const self = `${base}/events`;
  const q = (o: { cat?: string | null; ward?: string | null; page?: number }): string => {
    const p: string[] = [];
    if (o.cat) p.push(`cat=${encodeURIComponent(o.cat)}`);
    if (o.ward) p.push(`ward=${encodeURIComponent(o.ward)}`);
    if (o.page && o.page > 1) p.push(`page=${o.page}`);
    return p.length ? `${self}?${p.join("&")}` : self;
  };
  const sep = L === "ja" ? " ・ " : " · ";
  const chip = (href: string, label: string, on: boolean): string => `<a class="rs-chip" href="${esc(href)}"${on ? ' aria-current="true"' : ""}>${esc(label)}</a>`;
  const catChips = `<nav class="rs-chips re-chips" aria-label="${tr(L, "種類", "Type")}" data-region-events-cats="1">${chip(q({ ward: list.ward }), tr(L, "すべて", "All"), list.cat === null)}${EVENT_CATEGORY_CHIPS.map((c) => chip(q({ cat: c.key, ward: list.ward }), L === "ja" ? c.ja : c.en, list.cat === c.key)).join("")}</nav>`;
  const wardChips = list.wards.length > 0
    ? `<nav class="rs-chips re-chips" aria-label="${tr(L, "区", "Ward")}" data-region-events-wards="1">${chip(q({ cat: list.cat }), tr(L, "全域", "All wards"), list.ward === null)}${list.wards.map((w) => chip(q({ cat: list.cat, ward: w.code }), w.name, list.ward === w.code)).join("")}</nav>`
    : "";
  let heading = "";
  const rows = list.items.filter((c) => /^https?:\/\//i.test(c.url) && c.source_name.trim() !== "").map((c) => {
    const timing = eventTiming({ startedAt: c.starts_at, endedAt: c.ends_at && dayOf(c.ends_at) === dayOf(c.starts_at) ? c.ends_at : null }, L);
    let head = "";
    if (timing.dateLabel !== heading) { heading = timing.dateLabel; head = `<h2 class="re-day">${esc(heading)}</h2>`; }
    const time = c.all_day ? tr(L, "終日", "All day") : timing.timeLabel;
    const meta = [c.venue_name, c.organizer_name ? tr(L, `主催：${c.organizer_name}`, `Organizer: ${c.organizer_name}`) : null].filter(Boolean).join(sep);
    return `${head}<div class="rs-row" data-region-ext-event="${esc(c.event_id)}"><span class="rs-b">${time ? `<span class="rs-m">${esc(time)}</span>` : ""}<a class="rs-ext-t" href="${esc(c.url)}" target="_blank" rel="noopener nofollow">${esc(c.title)}</a>${meta ? `<span class="rs-m">${esc(meta)}</span>` : ""}</span></div>`;
  }).join("");
  const pager = list.pages > 1
    ? `<nav class="re-pager" data-region-events-pager="1" aria-label="${tr(L, "ページ", "Pages")}">${list.page > 1 ? `<a rel="prev" href="${esc(q({ cat: list.cat, ward: list.ward, page: list.page - 1 }))}">${tr(L, "前へ", "Previous")}</a>` : "<span aria-hidden=\"true\">.</span>"}${list.page < list.pages ? `<a rel="next" href="${esc(q({ cat: list.cat, ward: list.ward, page: list.page + 1 }))}">${tr(L, "次へ", "Next")}</a>` : ""}</nav>`
    : "";
  const src = list.sources.length
    ? `<p class="rs-ext-src" data-region-ext-source="1">${tr(L, `出典：${list.sources.map(esc).join("、")}${list.fetched ? `／取得日 ${esc(list.fetched)}` : ""}`, `Source: ${list.sources.map(esc).join(", ")}${list.fetched ? ` / Retrieved ${esc(list.fetched)}` : ""}`)}</p>`
    : "";
  const content = rows
    ? `<div data-region-events-list="1">${rows}</div>${pager}${src}`
    : `<p class="rs-foot" data-region-empty="1">${tr(L, "この条件の行事はありません", "No events match this filter.")}</p>`;
  const body = `<div class="iv-col rs-col" data-region-events-page="${esc(area)}">
    ${headBar(base, L)}
    <h1 class="iv-title">${tr(L, `${area}のまちの行事`, `Events in ${area}`)}</h1>
    <p class="iv-desc">${tr(L, `市や施設が公開している行事 ${list.total}件。申込みは元のページへ。`, `${list.total} events published by the city and venues. Apply on the original page.`)}</p>
    <a class="rs-all" data-region-events-back="1" href="${esc(base)}">${tr(L, `${area}のページへ戻る`, `Back to ${area}`)}</a>
    ${catChips}
    ${wardChips}
    ${content}
  </div>`;
  return shell({
    seo: {
      title: tr(L, `${area}のまちの行事 | ZUKAN`, `Events in ${area} | ZUKAN`),
      description: tr(L, `${area}で開かれる行事の一覧。市や施設が公開している情報から集めています。`, `Upcoming events in ${area}, gathered from information published by the city and venues.`),
      origin: options.origin ?? SEO_DEFAULT_ORIGIN,
      suffix: regionPathNoLang(area, "/events"),
      image: null,
    },
    title: tr(L, `${area}のまちの行事`, `Events in ${area}`),
    extraCss: EXTRA_CSS + EXT_SHELF_CSS + EVENTS_CSS,
    lang: L,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: self,
    body,
    cspNonce: options.cspNonce,
  });
}
