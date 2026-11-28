import { tr } from "../invasiveMapV1";
import { eventTiming } from "../zukanEventUi";

type Lang = "ja" | "en" | "es" | "pt-br";
type Db = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null> } } };

export type ExtEventCard = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  venue_name: string | null;
  organizer_name: string | null;
  url: string;
  source_name: string;
  fetched_at: string;
};
export const EXTERNAL_SHELVES_FLAG = "EXTERNAL_SHELVES_ENABLED";
export type RegionExternalEvents = { items: ExtEventCard[]; total: number };

const JST_MS = 9 * 3600 * 1000;
const jstDay = (now: Date): string => new Date(now.getTime() + JST_MS).toISOString().slice(0, 10);

const SRC_COND = `r.gone_at IS NULL AND s.terms_status<>'blocked' AND r.url LIKE 'http%' AND trim(s.name)<>''`;
const SOURCED = `EXISTS (SELECT 1 FROM ext_item_sources i JOIN ext_source_records r ON r.record_id=i.record_id JOIN ext_sources s ON s.source_id=r.source_id
  WHERE i.item_kind='event' AND i.item_id=e.event_id AND ${SRC_COND})`;
const WHERE = `e.city_unit_id=?1 AND e.status='active' AND e.starts_at>=?2 AND ${SOURCED}`;
const REP = `SELECT r.record_id FROM ext_item_sources i JOIN ext_source_records r ON r.record_id=i.record_id JOIN ext_sources s ON s.source_id=r.source_id
  WHERE i.item_kind='event' AND i.item_id=e.event_id AND ${SRC_COND}
  ORDER BY CASE i.role WHEN 'official' THEN 0 ELSE 1 END, r.record_id LIMIT 1`;

type Row = {
  event_id: string; title: string; starts_at: string; ends_at: string | null; all_day: number;
  place_name: string | null; ward_name: string | null; organizer_name: string | null;
  url: string; source_name: string; fetched_at: string;
};

export async function loadRegionExternalEvents(db: Db, area: string, now: Date = new Date(), limit = 5): Promise<RegionExternalEvents> {
  const empty: RegionExternalEvents = { items: [], total: 0 };
  try {
    const city = await db.prepare("SELECT code FROM admin_units WHERE level='city' AND name_ja=?1 ORDER BY code LIMIT 1").bind(area).first<{ code: string }>();
    if (!city) return empty;
    const day = jstDay(now);
    const totalRow = await db.prepare(`SELECT COUNT(*) AS n FROM ext_events e WHERE ${WHERE}`).bind(city.code, day).first<{ n: number }>();
    const total = Number(totalRow?.n ?? 0);
    if (total <= 0) return empty;
    const rows = (await db.prepare(
      `SELECT e.event_id, e.title, e.starts_at, e.ends_at, e.all_day, p.name AS place_name, w.name_ja AS ward_name, o.display_name AS organizer_name,
              rr.url AS url, ss.name AS source_name, rr.last_seen_at AS fetched_at
       FROM ext_events e
       LEFT JOIN ext_places p ON p.place_id=e.place_id
       LEFT JOIN admin_units w ON w.code=p.admin_unit_id AND w.level='ward'
       LEFT JOIN ext_orgs o ON o.org_id=e.org_id
       JOIN ext_source_records rr ON rr.record_id=(${REP})
       JOIN ext_sources ss ON ss.source_id=rr.source_id
       WHERE ${WHERE}
       ORDER BY e.starts_at ASC, e.event_id ASC LIMIT ?3`,
    ).bind(city.code, day, Math.max(1, limit)).all<Row>()).results ?? [];
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
    return { items, total: Math.max(total, items.length) };
  } catch {
    return empty;
  }
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const EXT_SHELF_CSS = `
.rs-ext-sub{margin:0 0 4px;font-size:14px;line-height:1.65;color:var(--muted)}
.rs-row .rs-ext-t{display:block;min-height:44px;padding:10px 0;font-size:16.5px;font-weight:800;color:var(--ink);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.rs-ext-src{margin:10px 0 0;font-size:13.5px;line-height:1.65;color:var(--muted)}
`;

const dayOf = (iso: string): string => iso.slice(0, 10);

export function renderRegionExternalShelf(lang: Lang, data: RegionExternalEvents | null | undefined, allHref?: string): string {
  const cards = (data?.items ?? []).filter((c) => /^https?:\/\//i.test(c.url) && c.source_name.trim() !== "");
  if (cards.length === 0) return "";
  const rows = cards.map((c) => {
    const timing = eventTiming({ startedAt: c.starts_at, endedAt: c.ends_at && dayOf(c.ends_at) === dayOf(c.starts_at) ? c.ends_at : null }, lang);
    const when = c.all_day ? timing.dateLabel : timing.whenLabel;
    const meta = [c.venue_name, c.organizer_name ? tr(lang, `主催：${c.organizer_name}`, `Organizer: ${c.organizer_name}`) : null].filter(Boolean).join(lang === "ja" ? " ・ " : " · ");
    return `<div class="rs-row" data-region-ext-event="${esc(c.event_id)}"><span class="rs-b"><span class="rs-m">${esc(when)}</span><a class="rs-ext-t" href="${esc(c.url)}" target="_blank" rel="noopener nofollow">${esc(c.title)}</a>${meta ? `<span class="rs-m">${esc(meta)}</span>` : ""}</span></div>`;
  }).join("");
  const names = [...new Set(cards.map((c) => c.source_name.trim()))];
  const fetched = cards.map((c) => dayOf(c.fetched_at)).filter(Boolean).sort().pop() ?? "";
  const rest = (data?.total ?? 0) - cards.length;
  const total = Math.max(data?.total ?? 0, cards.length);
  const all = rest > 0 && allHref ? `<a class="rs-all" data-region-ext-all="1" href="${esc(allHref)}">${tr(lang, `すべて見る（${total}件）`, `See all (${total})`)}</a>` : "";
  const more = rest > 0 && !allHref ? `<p class="rs-ext-src">${tr(lang, `ほか ${rest}件`, `${rest} more`)}</p>` : "";
  const src = `<p class="rs-ext-src" data-region-ext-source="1">${tr(lang, `出典：${names.map(esc).join("、")}${fetched ? `／取得日 ${esc(fetched)}` : ""}`, `Source: ${names.map(esc).join(", ")}${fetched ? ` / Retrieved ${esc(fetched)}` : ""}`)}</p>`;
  return `<section data-region-shelf="ext-events"><div class="rs-shelf-h"><h2>${tr(lang, "まちの行事", "Events in town")}</h2>${all}</div><p class="rs-ext-sub">${tr(lang, "市や施設が公開している行事です。申込みは元のページへ。", "Events published by the city and venues. Apply on the original page.")}</p>${rows}${more}${src}</section>`;
}
