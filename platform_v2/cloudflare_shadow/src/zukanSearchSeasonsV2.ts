import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SEARCH_V2_CSS, parseSearchV2Query, placeRowMeta, type SearchV2Lang } from "./zukanSearchV2";
import { RECORD_THUMB_SQL, SEARCH_ICON_CALENDAR, ZUKAN_SEARCH_CSS, renderSearchEmptyIcon, renderSearchHead, renderSearchRow, thumbUrlOf } from "./zukanSearchUi";

type Db = Env["OBS_DB"];
type YearMonth = { year: number; month: number };
type SessionLike = { userId: string; displayName?: string | null; banned?: boolean } | null;
type SeasonRow = { place_id: string; name: string; locality_label: string | null; observed_at: string; asset_id: string | null; observation_id: string; event_title: string | null };

const SEASON_WORDS_JA = ["去年の秋", "春", "夏", "冬"];
const SEASON_PARAM_WORD: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const PHOTO_CAP = 30;
const PHOTO_CSS = `.zs-ph{margin:18px 0}.zs-ph-h{font-size:15px;margin:0 0 8px;color:#17211B}.zs-ph-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.zs-ph-strip a{display:block;aspect-ratio:1/1;overflow:hidden;border-radius:8px;background:#e8f0ea}.zs-ph-strip img{display:block;width:100%;height:100%;object-fit:cover}`;
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymOf(iso: string): YearMonth | null {
  const time = Date.parse(iso);
  if (Number.isFinite(time)) {
    const d = new Date(time + 9 * 3600 * 1000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

const ymKey = (ym: YearMonth): string => `${ym.year}-${String(ym.month).padStart(2, "0")}`;
const monthLabel = (ym: YearMonth, isEn: boolean): string => (isEn ? `${EN_MONTHS[ym.month - 1]} ${ym.year}` : `${ym.year}年${ym.month}月`);

async function loadSeasonRows(db: Db): Promise<SeasonRow[]> {
  return db
    .prepare(
      `SELECT p.place_id AS place_id, p.canonical_name AS name, p.locality_label AS locality_label, o.observed_at AS observed_at, ${RECORD_THUMB_SQL} AS asset_id, o.observation_id AS observation_id,
              (SELECT s.title FROM observation_event_sessions s WHERE substr(o.observed_at,1,10) BETWEEN substr(s.started_at,1,10) AND substr(COALESCE(s.ended_at, s.started_at),1,10) AND s.field_id = p.place_id AND s.event_code IS NOT NULL AND trim(s.event_code) <> '' AND s.title <> '' ORDER BY s.started_at DESC LIMIT 1) AS event_title
         FROM observations o
         JOIN record_place_memberships m ON m.record_id = o.observation_id
         JOIN places p ON p.place_id = m.place_id
        WHERE m.membership_state = 'confirmed' AND m.public_precision = 'place' AND m.removed_at IS NULL
          AND o.visibility = 'public' AND COALESCE(o.emergency_hidden, 0) = 0
          AND p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL
        ORDER BY o.observed_at DESC LIMIT 1500`,
    )
    .all<SeasonRow>()
    .then((r) => r.results)
    .catch(() => [] as SeasonRow[]);
}

export async function handleSearchSeasonsV2Route(url: URL, lang: SearchV2Lang, session: SessionLike, db: Db, nowMs = Date.now()): Promise<Response> {
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const q = (url.searchParams.get("q") ?? SEASON_PARAM_WORD[url.searchParams.get("season") ?? ""] ?? "").normalize("NFKC").trim().slice(0, 40);
  const ymParam = url.searchParams.get("ym") ?? "";
  const rows = await loadSeasonRows(db);
  const dated: Array<{ r: SeasonRow; ym: YearMonth }> = [];
  for (const r of rows) {
    const ym = ymOf(r.observed_at);
    if (ym) dated.push({ r, ym });
  }

  const monthMap = new Map<string, YearMonth>();
  for (const x of dated) monthMap.set(ymKey(x.ym), x.ym);
  const months = [...monthMap.values()].sort((a, b) => b.year - a.year || b.month - a.month).slice(0, 8);

  const parsed = parseSearchV2Query(q, nowMs);
  const ymMatch = ymParam.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  let filter: (ym: YearMonth) => boolean;
  let activeMonth = "";
  let activeWord = "";
  if (ymMatch) {
    activeMonth = ymParam;
    const y = Number(ymMatch[1]);
    const m = Number(ymMatch[2]);
    filter = (ym) => ym.year === y && ym.month === m;
  } else if (parsed.temporal.length > 0) {
    activeWord = q;
    filter = (ym) => parsed.temporal.every((fn) => fn(ym));
  } else {
    const latest = months[0];
    activeMonth = latest ? ymKey(latest) : "";
    filter = (ym) => !!latest && ym.year === latest.year && ym.month === latest.month;
  }

  const groups = new Map<string, { name: string; locality: string | null; count: number; assetId: string | null }>();
  for (const x of dated) {
    if (!filter(x.ym)) continue;
    const g = groups.get(x.r.place_id);
    if (g) {
      g.count += 1;
      g.assetId = g.assetId ?? x.r.asset_id;
    } else groups.set(x.r.place_id, { name: x.r.name, locality: x.r.locality_label, count: 1, assetId: x.r.asset_id });
  }
  const list = [...groups.entries()].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, "ja")).slice(0, 30);
  const used = new Set<string>();
  const dayGroups = new Map<string, { day: string; title: string | null; items: Array<{ id: string; asset: string }> }>();
  let photoCount = 0;
  for (const x of dated) {
    if (photoCount >= PHOTO_CAP) break;
    if (!filter(x.ym) || !x.r.asset_id || used.has(x.r.asset_id)) continue;
    const day = x.r.observed_at.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    const key = `${day}|${x.r.event_title ?? ""}`;
    let g = dayGroups.get(key);
    if (!g) dayGroups.set(key, (g = { day, title: x.r.event_title, items: [] }));
    if (g.items.length >= 3) continue;
    g.items.push({ id: x.r.observation_id, asset: x.r.asset_id });
    used.add(x.r.asset_id);
    photoCount += 1;
  }
  const dayLabel = (day: string): string => {
    const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return day;
    const wd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
    return isEn ? `${EN_MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : `${Number(m[2])}月${Number(m[3])}日（${"日月火水木金土"[wd]}）`;
  };
  const photosHtml = [...dayGroups.values()]
    .map((g) => `<div class="zs-ph" data-search-v2-day="${escapeHtml(g.day)}"><h3 class="zs-ph-h">${escapeHtml(dayLabel(g.day))}${g.title ? ` ・ ${escapeHtml(g.title)}` : ""}</h3><div class="zs-ph-strip">${g.items.map((i) => `<a href="${prefix}/observations/${encodeURIComponent(i.id)}"><img src="${thumbUrlOf(i.asset)}" alt="" loading="lazy" decoding="async"></a>`).join("")}</div></div>`)
    .join("");
  const rowsHtml = list
    .map(([placeId, g]) => {
      const once = g.assetId && !used.has(g.assetId) ? g.assetId : null;
      if (once) used.add(once);
      return renderSearchRow({
        href: `${prefix}/places/${encodeURIComponent(placeId)}`,
        title: g.name,
        meta: placeRowMeta(g.locality, g.count, isEn),
        badge: isEn ? "Place" : "場所",
        thumbUrl: thumbUrlOf(once),
      });
    })
    .join("");
  const total = list.reduce((n, [, g]) => n + g.count, 0);

  const chip = (href: string, label: string, active: boolean) => `<a class="zs-chip${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`;
  const monthChips = months.map((ym) => chip(`${prefix}/search/seasons?ym=${ymKey(ym)}`, monthLabel(ym, isEn), ymKey(ym) === activeMonth)).join("");
  const wordChips = (isEn ? [] : SEASON_WORDS_JA).map((w) => chip(`${prefix}/search/seasons?q=${encodeURIComponent(w)}`, w, w === activeWord)).join("");

  const emptyHtml = `<div class="zs-empty zt-search-empty" data-search-v2="season-empty">${renderSearchEmptyIcon()}<h2>${isEn ? "No records for this period" : "この時期の記録はまだありません"}</h2><p>${isEn ? "Try another month." : "ほかの月を選んでみてください。"}</p><a class="zs-btn" href="${prefix}/search/explore">${SEARCH_ICON_CALENDAR}${isEn ? "Back to search" : "探すに戻る"}</a></div>`;

  const body = `<style>${ZUKAN_SEARCH_CSS}${ZUKAN_SEARCH_V2_CSS}${PHOTO_CSS}</style>
  <section class="zs" data-search-v2="seasons">
    ${renderSearchHead(isEn ? "Search by season" : "時期で探す", `${prefix}/search/explore`, isEn ? "Back" : "戻る")}
    ${monthChips ? `<nav class="zs-chips" aria-label="${isEn ? "Month" : "月"}">${monthChips}</nav>` : ""}
    ${wordChips ? `<nav class="zs-chips" aria-label="${isEn ? "Season" : "季節"}">${wordChips}</nav>` : ""}
    ${photosHtml ? `<div data-search-v2-group="photos">${photosHtml}</div>` : ""}
    ${rowsHtml ? `<div data-search-v2-group="places"><h2 class="zs-h2">${isEn ? "Places" : "場所"}</h2><ul class="zs-list">${rowsHtml}</ul><p class="zs-count">${isEn ? `${list.length} places, ${total} records` : `場所 ${list.length}件・記録 ${total}件`}</p></div>` : emptyHtml}
  </section>`;

  const html = renderZukanCommonShell({
    title: isEn ? "Search by season" : "時期で探す",
    lang,
    activeNav: "none",
    authenticated: Boolean(session && !session.banned),
    displayName: session?.displayName ?? null,
    bodyHtml: body,
    pathname: `${prefix}/search/seasons`,
  });
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
