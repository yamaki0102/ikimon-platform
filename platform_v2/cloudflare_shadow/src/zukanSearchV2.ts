import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { jstYearFromMs, parseLibraryV2SearchToken } from "./zukanLibraryV2";
import { isTestTaxonLabel } from "./zukanSearchPromptAndSuggest";
import {
  PLACE_SEARCH_SELECT,
  RECORD_THUMB_SQL,
  SEARCH_ICON_CALENDAR,
  ZUKAN_SEARCH_CSS,
  displayRecordName,
  formatShortDate,
  mapPlaceSearchRow,
  renderSearchBar,
  renderSearchEmptyIcon,
  renderSearchHead,
  renderSearchRow,
  thumbUrlOf,
  type PlaceSearchInfo,
} from "./zukanSearchUi";

export type SearchV2Lang = "ja" | "en" | "es" | "pt-br";
export type SearchV2Type = "all" | "places" | "events" | "records";
type SessionLike = { userId: string; displayName?: string | null; banned?: boolean } | null;
type Db = Env["OBS_DB"];
type YearMonth = { year: number; month: number };

export type SearchV2Parsed = {
  raw: string;
  textTokens: string[];
  seasonLabels: string[];
  temporal: Array<(obs: YearMonth | null) => boolean>;
};

export type SearchV2Suggestion = { kind: "species" | "place" | "event"; label: string; href: string; meta: string };

const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const ICON_LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19 13 11"/></svg>';
const ICON_SEARCH_SMALL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';

export const ZUKAN_SEARCH_V2_CSS = `
.zs2-sug,.zs2-sug:visited{display:flex;align-items:center;gap:14px;min-height:56px;padding:8px 4px;border-bottom:1px solid #dde2dc;color:#17211B;text-decoration:none;background:none;border-left:0;border-right:0;border-top:0;width:100%;font:inherit;text-align:left;cursor:pointer}
.zs2-sug svg{width:22px;height:22px;color:#143F2E}
.zs2-sug .zs2-ico{flex:none;display:grid;place-items:center;width:28px}
.zs2-sug .zs-body strong{font-size:1rem}
.zs2-sug .zs-body small{margin-top:0}
.zs2-box{display:grid;gap:0}
.zs2-recent-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.zs2-recent-head h2{margin:8px 0 0}
.zs2-clear{min-height:44px;padding:0 4px;border:0;background:none;color:#55615A;font:inherit;font-size:.9375rem;cursor:pointer;white-space:nowrap}
.zs2-note{margin:0;padding:10px 14px;border-radius:14px;background:#F7F7F3;color:#55615A;font-size:.9375rem}
.zs2-first{display:grid;gap:8px;justify-items:center;margin-top:8px;padding:16px;border-radius:16px;background:#F7F7F3;text-align:center}
.zs2-first p{margin:0;color:#55615A}
.zs2-first a,.zs2-first a:visited{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:999px;background:#143F2E;color:#fff;font-weight:700;text-decoration:none;white-space:nowrap}
[hidden]{display:none!important}
`;

const likeEscape = (token: string): string => token.replace(/[\\%_]/g, (ch) => `\\${ch}`);

function ymOf(iso: string | null | undefined): YearMonth | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isFinite(time)) {
    const d = new Date(time + 9 * 3600 * 1000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function parseSearchV2Query(rawQuery: string, nowMs = Date.now()): SearchV2Parsed {
  const normalized = rawQuery.normalize("NFKC").trim().slice(0, 120);
  const year = jstYearFromMs(nowMs);
  const out: SearchV2Parsed = { raw: normalized, textTokens: [], seasonLabels: [], temporal: [] };
  for (const token of normalized.split(/\s+/u).filter(Boolean)) {
    const spec = parseLibraryV2SearchToken(token, year);
    if (spec.temporalMatch) {
      out.temporal.push(spec.temporalMatch);
      out.seasonLabels.push(token);
    } else {
      out.textTokens.push(token);
    }
  }
  return out;
}

const matchesTemporal = (parsed: SearchV2Parsed, iso: string | null | undefined): boolean => {
  if (parsed.temporal.length === 0) return true;
  const ym = ymOf(iso);
  return parsed.temporal.every((fn) => fn(ym));
};

function textClause(columns: string[], tokens: string[]): { sql: string; binds: string[] } {
  if (tokens.length === 0) return { sql: "1 = 1", binds: [] };
  const binds: string[] = [];
  const parts = tokens.map((token) => {
    const like = `%${likeEscape(token)}%`;
    for (const _ of columns) binds.push(like);
    return `(${columns.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(" OR ")})`;
  });
  return { sql: parts.join(" AND "), binds };
}

function highlightTokens(text: string, tokens: string[]): string {
  const needles = [...new Set(tokens.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return escapeHtml(text);
  const lower = text.toLowerCase();
  const lowered = needles.map((n) => n.toLowerCase());
  let out = "";
  let i = 0;
  while (i < text.length) {
    const hit = lowered.find((n) => lower.startsWith(n, i));
    if (hit) {
      out += `<mark>${escapeHtml(text.slice(i, i + hit.length))}</mark>`;
      i += hit.length;
    } else {
      let next = i + 1;
      while (next < text.length && !lowered.some((n) => lower.startsWith(n, next))) next += 1;
      out += escapeHtml(text.slice(i, next));
      i = next;
    }
  }
  return out;
}

export type SearchV2Results = {
  parsed: SearchV2Parsed;
  places: PlaceSearchInfo[];
  events: Array<{ sessionId: string; title: string; startedAt: string }>;
  records: Array<{ observationId: string; label: string; observedAt: string; areaLabel: string | null; assetId: string | null }>;
};

type PlaceRaw = Parameters<typeof mapPlaceSearchRow>[0];

export async function querySearchV2Results(rawQuery: string, type: SearchV2Type, db: Db, nowMs = Date.now()): Promise<SearchV2Results> {
  const parsed = parseSearchV2Query(rawQuery, nowMs);
  const hasText = parsed.textTokens.length > 0;
  const hasTemporal = parsed.temporal.length > 0;
  const empty: SearchV2Results = { parsed, places: [], events: [], records: [] };
  if (!hasText && !hasTemporal) return empty;
  const fetchLimit = hasTemporal ? 400 : 30;
  const recordFetchLimit = hasTemporal ? 400 : 200;

  const [places, events, records] = await Promise.all([
    (type === "all" || type === "places") && hasText && !hasTemporal
      ? (async () => {
          const c = textClause(["p.canonical_name"], parsed.textTokens);
          const where = `WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL AND ${c.sql} ORDER BY p.canonical_name ASC LIMIT 30`;
          try {
            return (await db.prepare(`${PLACE_SEARCH_SELECT} ${where}`).bind(...c.binds).all<PlaceRaw>()).results.map(mapPlaceSearchRow);
          } catch {
            return (await db.prepare(`SELECT p.place_id AS place_id, p.canonical_name AS name FROM places p ${where}`).bind(...c.binds).all<PlaceRaw>().then((r) => r.results.map(mapPlaceSearchRow)).catch(() => [] as PlaceSearchInfo[]));
          }
        })()
      : Promise.resolve([] as PlaceSearchInfo[]),
    type === "all" || type === "events"
      ? (async () => {
          const c = textClause(["title"], parsed.textTokens);
          const rows = await db
            .prepare(`SELECT session_id, title, started_at FROM observation_event_sessions WHERE ${c.sql} ORDER BY started_at DESC LIMIT ${fetchLimit}`)
            .bind(...c.binds)
            .all<{ session_id: string; title: string; started_at: string }>()
            .then((r) => r.results)
            .catch(() => []);
          return rows.filter((r) => matchesTemporal(parsed, r.started_at)).slice(0, 30).map((r) => ({ sessionId: r.session_id, title: r.title, startedAt: r.started_at }));
        })()
      : Promise.resolve([] as SearchV2Results["events"]),
    type === "all" || type === "records"
      ? (async () => {
          type Raw = { observation_id: string; taxon_label: string | null; observed_at: string; public_area_label?: string | null; asset_id?: string | null };
          const full = textClause(["o.taxon_label", "o.public_area_label"], parsed.textTokens);
          const rows: Raw[] = await db
            .prepare(
              `SELECT o.observation_id AS observation_id, o.taxon_label AS taxon_label, o.observed_at AS observed_at, o.public_area_label AS public_area_label, ${RECORD_THUMB_SQL} AS asset_id
                 FROM observations o
                WHERE o.visibility = 'public' AND COALESCE(o.emergency_hidden, 0) = 0 AND ${full.sql}
                ORDER BY o.observed_at DESC LIMIT ${recordFetchLimit}`,
            )
            .bind(...full.binds)
            .all<Raw>()
            .then((r) => r.results)
            .catch(async () => {
              const min = textClause(["taxon_label"], parsed.textTokens);
              return db
                .prepare(`SELECT observation_id, taxon_label, observed_at FROM observations WHERE visibility = 'public' AND ${min.sql} ORDER BY observed_at DESC LIMIT ${recordFetchLimit}`)
                .bind(...min.binds)
                .all<Raw>()
                .then((r) => r.results)
                .catch(() => [] as Raw[]);
            });
          return rows
            .filter((r) => matchesTemporal(parsed, r.observed_at))
            .slice(0, 150)
            .map((r) => ({ observationId: r.observation_id, label: (r.taxon_label ?? "").trim(), observedAt: r.observed_at, areaLabel: r.public_area_label ?? null, assetId: r.asset_id ?? null }));
        })()
      : Promise.resolve([] as SearchV2Results["records"]),
  ]);
  return { parsed, places, events, records };
}

export const placeRowMeta = (locality: string | null | undefined, count: number | null | undefined, isEn: boolean): string =>
  [locality ?? "", count && count > 0 ? (isEn ? `${count} records` : `記録 ${count}件`) : ""].filter(Boolean).join(" ・ ");

const prefixOf = (lang: SearchV2Lang): string => (lang === "ja" ? "/ja" : `/${lang}`);

export async function loadSearchV2Suggestions(rawQuery: string, db: Db, lang: SearchV2Lang): Promise<{ suggestions: SearchV2Suggestion[]; seasonLabels: string[] }> {
  const isEn = lang === "en";
  const prefix = prefixOf(lang);
  const parsed = parseSearchV2Query(rawQuery);
  const text = parsed.textTokens.join(" ");
  if (!text) return { suggestions: [], seasonLabels: parsed.seasonLabels };
  const c = textClause(["taxon_label"], parsed.textTokens);
  const cp = textClause(["p.canonical_name"], parsed.textTokens);
  const ce = textClause(["title"], parsed.textTokens);
  const [species, places, events] = await Promise.all([
    db
      .prepare(`SELECT TRIM(taxon_label) AS label FROM observations WHERE visibility = 'public' AND taxon_label IS NOT NULL AND TRIM(taxon_label) <> '' AND ${c.sql} GROUP BY TRIM(taxon_label) ORDER BY MAX(created_at) DESC LIMIT 12`)
      .bind(...c.binds)
      .all<{ label: string }>()
      .then((r) => r.results)
      .catch(() => [] as Array<{ label: string }>),
    (async () => {
      const where = `WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL AND ${cp.sql} ORDER BY p.canonical_name ASC LIMIT 4`;
      try {
        return (await db.prepare(`${PLACE_SEARCH_SELECT} ${where}`).bind(...cp.binds).all<PlaceRaw>()).results.map(mapPlaceSearchRow);
      } catch {
        return (await db.prepare(`SELECT p.place_id AS place_id, p.canonical_name AS name FROM places p ${where}`).bind(...cp.binds).all<PlaceRaw>().then((r) => r.results.map(mapPlaceSearchRow)).catch(() => [] as PlaceSearchInfo[]));
      }
    })(),
    db
      .prepare(`SELECT session_id, title, started_at FROM observation_event_sessions WHERE ${ce.sql} ORDER BY started_at DESC LIMIT 3`)
      .bind(...ce.binds)
      .all<{ session_id: string; title: string; started_at: string }>()
      .then((r) => r.results)
      .catch(() => [] as Array<{ session_id: string; title: string; started_at: string }>),
  ]);
  const suggestions: SearchV2Suggestion[] = [
    ...places.map((p) => ({
      kind: "place" as const,
      label: p.name,
      href: `${prefix}/places/${encodeURIComponent(p.placeId)}`,
      meta: [isEn ? "Place" : "場所", p.recordCount && p.recordCount > 0 ? (isEn ? `${p.recordCount} records` : `記録 ${p.recordCount}件`) : ""].filter(Boolean).join(" ・ "),
    })),
    ...species
      .filter((s) => !isTestTaxonLabel(s.label))
      .slice(0, 5)
      .map((s) => ({ kind: "species" as const, label: s.label, href: `${prefix}/search/results?q=${encodeURIComponent(s.label)}`, meta: isEn ? "Species" : "生きもの" })),
    ...events.map((e) => ({
      kind: "event" as const,
      label: e.title,
      href: `${prefix}/events/${encodeURIComponent(e.session_id)}/preview`,
      meta: [isEn ? "Event" : "イベント", formatShortDate(e.started_at, isEn)].filter(Boolean).join(" ・ "),
    })),
  ];
  return { suggestions, seasonLabels: parsed.seasonLabels };
}

export async function handleSearchSuggestV2Api(url: URL, db: Db): Promise<Response> {
  const langParam = url.searchParams.get("lang");
  const lang: SearchV2Lang = langParam === "en" ? "en" : "ja";
  const data = await loadSearchV2Suggestions(url.searchParams.get("q") ?? "", db, lang);
  return json({ ok: true, ...data }, 200, { "cache-control": "no-store" });
}

function suggestionRowHtml(s: SearchV2Suggestion, tokens: string[]): string {
  const icon = s.kind === "place" ? ICON_PIN : s.kind === "event" ? SEARCH_ICON_CALENDAR : ICON_LEAF;
  return `<li><a class="zs2-sug" href="${escapeHtml(s.href)}" data-zs2-q="${s.kind === "species" ? escapeHtml(s.label) : ""}"><span class="zs2-ico">${icon}</span><span class="zs-body"><strong>${highlightTokens(s.label, tokens)}</strong><small>${escapeHtml(s.meta)}</small></span></a></li>`;
}

function searchAllRowHtml(prefix: string, q: string, isEn: boolean): string {
  return `<li><a class="zs2-sug" href="${escapeHtml(`${prefix}/search/results?q=${encodeURIComponent(q)}`)}" data-zs2-q="${escapeHtml(q)}"><span class="zs2-ico">${ICON_SEARCH_SMALL}</span><span class="zs-body"><strong>${isEn ? `Search "${escapeHtml(q)}"` : `「${escapeHtml(q)}」で探す`}</strong></span></a></li>`;
}

const SEASON_EXAMPLES_JA = ["去年の秋", "春", "夏", "冬"];

async function loadPopularPlaces(db: Db): Promise<PlaceSearchInfo[]> {
  const where = `WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL ORDER BY record_count DESC, p.canonical_name ASC LIMIT 5`;
  try {
    return (await db.prepare(`${PLACE_SEARCH_SELECT} ${where}`).all<PlaceRaw>()).results.map(mapPlaceSearchRow);
  } catch {
    return (await db.prepare(`SELECT p.place_id AS place_id, p.canonical_name AS name FROM places p WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL ORDER BY p.canonical_name ASC LIMIT 5`).all<PlaceRaw>().then((r) => r.results.map(mapPlaceSearchRow)).catch(() => [] as PlaceSearchInfo[]));
  }
}

async function loadRecentSpecies(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT TRIM(taxon_label) AS label, MAX(observed_at) AS last_at FROM observations
        WHERE owner_user_id = ? AND taxon_label IS NOT NULL AND TRIM(taxon_label) <> ''
        GROUP BY TRIM(taxon_label) ORDER BY last_at DESC LIMIT 12`,
    )
    .bind(userId)
    .all<{ label: string }>()
    .then((r) => r.results)
    .catch(() => [] as Array<{ label: string }>);
  return rows.map((r) => r.label).filter((l) => !isTestTaxonLabel(l)).slice(0, 6);
}

const LIVE_SCRIPT = (prefix: string, isEn: boolean, lang: string): string => `<script>(function(){
var input=document.getElementById('zs-input'),live=document.getElementById('zs2-live'),idle=document.getElementById('zs2-idle');
if(!input||!live||!idle)return;
var P=${JSON.stringify(prefix)},EN=${isEn ? "true" : "false"},LANG=${JSON.stringify(lang)},KEY='zukan-recent-searches',timer=0,seq=0;
var ICONS={place:${JSON.stringify(ICON_PIN)},event:${JSON.stringify(SEARCH_ICON_CALENDAR)},species:${JSON.stringify(ICON_LEAF)},all:${JSON.stringify(ICON_SEARCH_SMALL)}};
function load(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(function(x){return typeof x==='string'&&x;}).slice(0,6):[];}catch(e){return[];}}
function save(q){q=(q||'').trim();if(!q)return;try{var l=load().filter(function(x){return x!==q;});l.unshift(q);localStorage.setItem(KEY,JSON.stringify(l.slice(0,6)));}catch(e){}}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function row(kind,href,title,meta,q){var li=el('li'),a=el('a','zs2-sug');a.href=href;if(q)a.setAttribute('data-zs2-q',q);var ic=el('span','zs2-ico');ic.innerHTML=ICONS[kind];var b=el('span','zs-body');b.appendChild(el('strong',null,title));if(meta)b.appendChild(el('small',null,meta));a.appendChild(ic);a.appendChild(b);li.appendChild(a);return li;}
function show(items,q){live.textContent='';var ul=el('ul','zs-list');items.forEach(function(s){ul.appendChild(row(s.kind,s.href,s.label,s.meta,s.kind==='species'?s.label:''));});ul.appendChild(row('all',P+'/search/results?q='+encodeURIComponent(q),EN?'Search "'+q+'"':'\\u300c'+q+'\\u300d\\u3067\\u63a2\\u3059','',q));live.appendChild(ul);}
function update(){var q=input.value.trim();if(!q){live.hidden=true;idle.hidden=false;return;}idle.hidden=true;live.hidden=false;var my=++seq;fetch('/api/v1/search/suggest-v2?q='+encodeURIComponent(q)+'&lang='+LANG,{headers:{accept:'application/json'}}).then(function(r){return r.json();}).then(function(d){if(my!==seq)return;show((d&&d.suggestions)||[],q);}).catch(function(){if(my!==seq)return;show([],q);});}
input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(update,140);});
if(input.form)input.form.addEventListener('submit',function(){save(input.value);});
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('[data-zs2-q]'):null;if(a)save(a.getAttribute('data-zs2-q'));});
var wrap=document.getElementById('zs2-recent'),list=document.getElementById('zs2-recent-list'),clr=document.getElementById('zs2-recent-clear');
if(wrap&&list){var items=load();if(items.length){items.forEach(function(q){var a=el('a','zs-chip',q);a.href=P+'/search/results?q='+encodeURIComponent(q);list.appendChild(a);});wrap.hidden=false;}
if(clr)clr.addEventListener('click',function(){try{localStorage.removeItem(KEY);}catch(e){}wrap.hidden=true;});}
})();</script>`;

export async function handleSearchExploreV2Route(
  url: URL,
  lang: SearchV2Lang,
  session: SessionLike,
  db: Db,
): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const isEn = lang === "en";
  const prefix = prefixOf(lang);
  const authenticated = Boolean(session && !session.banned);
  const parsed = parseSearchV2Query(q);

  const [suggest, popular, recentSpecies] = await Promise.all([
    q ? loadSearchV2Suggestions(q, db, lang) : Promise.resolve({ suggestions: [] as SearchV2Suggestion[], seasonLabels: [] as string[] }),
    q ? Promise.resolve([] as PlaceSearchInfo[]) : loadPopularPlaces(db).then((r) => r.filter((p) => (p.recordCount ?? 0) > 0)),
    q || !authenticated || !session ? Promise.resolve([] as string[]) : loadRecentSpecies(db, session.userId),
  ]);

  const speciesChipHtml = (label: string) =>
    `<a class="zs-chip" data-zs2-q="${escapeHtml(label)}" href="${escapeHtml(`${prefix}/search/results?q=${encodeURIComponent(label)}`)}">${escapeHtml(label)}</a>`;
  const seasonChips = (isEn ? [] : SEASON_EXAMPLES_JA).map((s) => `<a class="zs-chip" data-zs2-q="${escapeHtml(s)}" href="${escapeHtml(`${prefix}/search/seasons?q=${encodeURIComponent(s)}`)}">${escapeHtml(s)}</a>`).join("");

  const liveInner = q
    ? `<ul class="zs-list">${suggest.suggestions.map((s) => suggestionRowHtml(s, parsed.textTokens)).join("")}${searchAllRowHtml(prefix, q, isEn)}</ul>`
    : "";

  const popularHtml = popular
    .map((p) =>
      renderSearchRow({
        href: `${prefix}/places/${encodeURIComponent(p.placeId)}`,
        title: p.name,
        meta: placeRowMeta(p.locality, p.recordCount, isEn),
        badge: isEn ? "Place" : "場所",
        thumbUrl: thumbUrlOf(p.thumbAssetId),
      }),
    )
    .join("");

  const body = `<style>${ZUKAN_SEARCH_CSS}${ZUKAN_SEARCH_V2_CSS}</style>
  <section class="zs" data-search-v2="explore">
    ${renderSearchHead(isEn ? "Explore" : "探す", `${prefix}/library`, isEn ? "Back" : "戻る")}
    ${renderSearchBar({
      action: `${prefix}/search/results`,
      q,
      placeholder: isEn ? "Search species, places, events" : "祭り・川・去年の秋で探す",
      label: isEn ? "Search" : "検索キーワード",
      micLabel: isEn ? "Voice search" : "音声で探す",
    })}
    <div id="zs2-live" class="zs2-box" data-search-v2-live="1"${q ? "" : " hidden"} aria-live="polite">${liveInner}</div>
    <div id="zs2-idle" style="display:grid;gap:16px"${q ? " hidden" : ""}>
      <div id="zs2-recent" hidden><div class="zs2-recent-head"><h2 class="zs-h2">${isEn ? "Recent searches" : "最近探した言葉"}</h2><button type="button" class="zs2-clear" id="zs2-recent-clear">${isEn ? "Clear" : "消す"}</button></div><div class="zs-chips" id="zs2-recent-list"></div></div>
      ${recentSpecies.length ? `<div data-search-v2="recent-species"><h2 class="zs-h2">${isEn ? "Your recent finds" : "最近記録した生きもの"}</h2><div class="zs-chips">${recentSpecies.map(speciesChipHtml).join("")}</div></div>` : ""}
      ${seasonChips ? `<div data-search-v2="season-words"><h2 class="zs-h2">${isEn ? "By season" : "時期のことばで探す"}</h2><div class="zs-chips">${seasonChips}</div></div>` : ""}
      ${popularHtml ? `<div><h2 class="zs-h2">${isEn ? "Places with most records" : "記録の多い場所"}</h2><ul class="zs-list">${popularHtml}</ul></div>` : ""}
      <a class="zs-btn" href="${escapeHtml(`${prefix}/search/seasons`)}">${SEARCH_ICON_CALENDAR}${isEn ? "Search by season" : "時期で探す"}</a>
    </div>
  </section>
  ${LIVE_SCRIPT(prefix, isEn, lang)}`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Explore" : "探す",
    activeNav: "none",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml: body,
    pathname: `${prefix}/search/explore`,
  });
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}

function normalizeType(raw: string | null): SearchV2Type {
  return raw === "places" || raw === "events" || raw === "records" ? raw : "all";
}

export async function handleSearchResultsV2Route(
  url: URL,
  lang: SearchV2Lang,
  session: SessionLike,
  db: Db,
): Promise<Response> {
  const rawQ = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const type = normalizeType(url.searchParams.get("type"));
  const isEn = lang === "en";
  const prefix = prefixOf(lang);
  const data = await querySearchV2Results(rawQ, type, db);
  const { parsed } = data;
  const q = parsed.raw;
  const encodedQ = encodeURIComponent(q);

  const tabs: Array<{ key: SearchV2Type; label: string }> = [
    { key: "all", label: isEn ? "All" : "すべて" },
    { key: "places", label: isEn ? "Places" : "場所" },
    { key: "events", label: isEn ? "Events" : "イベント" },
    { key: "records", label: isEn ? "Records" : "記録" },
  ];
  const tabLinks = tabs
    .map((t) => `<a class="zs-chip${t.key === type ? " is-active" : ""}" href="${prefix}/search/results?q=${encodedQ}&amp;type=${t.key}"${t.key === type ? ' aria-current="page"' : ""}>${t.label}</a>`)
    .join("");

  const usedAssets = new Set<string>();
  const thumbOnce = (assetId: string | null): string | null => {
    if (!assetId || usedAssets.has(assetId)) return null;
    usedAssets.add(assetId);
    return thumbUrlOf(assetId);
  };
  const tokens = parsed.textTokens;
  const placeRows = data.places
    .map((p) =>
      renderSearchRow({
        href: `${prefix}/places/${encodeURIComponent(p.placeId)}`,
        title: p.name,
        titleHtml: highlightTokens(p.name, tokens),
        meta: placeRowMeta(p.locality, p.recordCount, isEn),
        badge: isEn ? "Place" : "場所",
        thumbUrl: thumbOnce(p.thumbAssetId),
      }),
    )
    .join("");
  const eventRows = data.events
    .map((e) =>
      renderSearchRow({
        href: `${prefix}/events/${encodeURIComponent(e.sessionId)}/preview`,
        title: e.title,
        titleHtml: highlightTokens(e.title, tokens),
        meta: formatShortDate(e.startedAt, isEn),
        badge: isEn ? "Event" : "イベント",
      }),
    )
    .join("");
  const isUnnamed = (label: string): boolean => !label || /^unidentified$/i.test(label) || label === "未同定";
  const RECORD_CAP = 10;
  const dayOf = (iso: string): string => iso.slice(0, 10);
  const named = data.records.filter((r) => !isUnnamed(r.label));
  const unnamed = data.records.filter((r) => isUnnamed(r.label));
  const groups = new Map<string, { area: string | null; observedAt: string; ids: string[]; assetId: string | null }>();
  for (const r of unnamed) {
    const key = `${r.areaLabel ?? ""}|${dayOf(r.observedAt)}`;
    const g = groups.get(key);
    if (g) {
      g.ids.push(r.observationId);
      g.assetId = g.assetId ?? r.assetId;
    } else groups.set(key, { area: r.areaLabel, observedAt: r.observedAt, ids: [r.observationId], assetId: r.assetId });
  }
  const recordsHref = `${prefix}/records?view=public&amp;q=${encodedQ}`;
  const namedSorted = [...named.filter((r) => r.assetId), ...named.filter((r) => !r.assetId)];
  type RecItem = { html: string };
  const groupList = [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
  const groupSlots = Math.min(groupList.length, 2);
  const items: RecItem[] = namedSorted.slice(0, RECORD_CAP - groupSlots).map((r) => ({
    html: renderSearchRow({
      href: `${prefix}/observations/${encodeURIComponent(r.observationId)}`,
      title: r.label,
      titleHtml: highlightTokens(displayRecordName(r.label, isEn), tokens),
      meta: [formatShortDate(r.observedAt, isEn), r.areaLabel ?? ""].filter(Boolean).join(" ・ "),
      badge: isEn ? "Record" : "記録",
      thumbUrl: thumbOnce(r.assetId),
    }),
  }));
  for (const g of groupList.slice(0, groupSlots)) {
    const many = g.ids.length > 1;
    const title = many ? (isEn ? `${g.ids.length} unidentified records` : `名前が未確定の記録 ${g.ids.length}件`) : isEn ? "Unidentified" : "未同定";
    items.push({
      html: renderSearchRow({
        href: many ? recordsHref : `${prefix}/observations/${encodeURIComponent(g.ids[0] ?? "")}`,
        title,
        meta: [formatShortDate(g.observedAt, isEn), g.area ?? ""].filter(Boolean).join(" ・ "),
        badge: isEn ? "Record" : "記録",
        thumbUrl: thumbOnce(g.assetId),
      }),
    });
  }
  const recordRows = items.slice(0, RECORD_CAP).map((i) => i.html).join("");
  const recordMore = named.length + groupList.length > RECORD_CAP || data.records.length >= 150 ? `<p class="zs-count"><a href="${recordsHref}">${isEn ? "See more" : "もっと見る"}</a></p>` : "";
  const section = (key: string, label: string, count: number, rows: string) =>
    rows
      ? `<div data-search-v2-group="${key}">${type === "all" ? `<h2 class="zs-h2">${label}</h2>` : ""}<ul class="zs-list">${rows}</ul>${key === "records" ? recordMore : ""}<p class="zs-count">${isEn ? `${label} ${count}` : `${label} ${count}件`}</p></div>`
      : "";
  const hasAny = Boolean(placeRows || eventRows || recordRows);

  const seasonNote = parsed.seasonLabels.length
    ? `<p class="zs2-note" data-search-v2="season-note">${isEn ? `Filtering by time: ${escapeHtml(parsed.seasonLabels.join(" "))}` : `「${escapeHtml(parsed.seasonLabels.join(" "))}」の時期で絞り込んでいます`}</p>`
    : "";
  const chipExample = (s: string) => `<a class="zs-chip" data-zs2-q="${escapeHtml(s)}" href="${escapeHtml(`${prefix}/search/results?q=${encodeURIComponent(s)}`)}">${escapeHtml(s)}</a>`;
  const emptyHtml = `<div class="zs-empty zt-search-empty" data-search-v2="empty">${renderSearchEmptyIcon()}<h2>${q ? (isEn ? `No results for "${escapeHtml(q)}"` : `「${escapeHtml(q)}」は見つかりませんでした`) : isEn ? "Type a word to search" : "探したい言葉を入れてください"}</h2><p>${isEn ? "Try different words, or pick one below." : "言葉を変えるか、時期で探してみてください。"}</p></div>
    <div class="zs-chips" style="justify-content:center">${(isEn ? ["river"] : ["川", "朝市", "去年の秋"]).map(chipExample).join("")}</div>
    <a class="zs-btn" href="${prefix}/search/seasons">${SEARCH_ICON_CALENDAR}${isEn ? "Search by season" : "時期で探す"}</a>
    <div class="zs2-first" data-search-v2="first-step"><p>${isEn ? "Not recorded yet? Start with one photo." : "まだ記録がないのかもしれません。まず1枚、撮ってみましょう。"}</p><a href="${prefix}/record">${isEn ? "Take a photo" : "撮ってみる"}</a></div>`;

  const body = `<style>${ZUKAN_SEARCH_CSS}${ZUKAN_SEARCH_V2_CSS}</style>
  <section class="zs" data-search-v2="results" data-search-type="${type}">
    ${renderSearchHead(isEn ? "Explore" : "探す", `${prefix}/search/explore`, isEn ? "Back" : "戻る")}
    ${renderSearchBar({
      action: `${prefix}/search/results`,
      q,
      placeholder: isEn ? "Search species, places, events" : "祭り・川・去年の秋で探す",
      label: isEn ? "Search" : "検索キーワード",
      micLabel: isEn ? "Voice search" : "音声で探す",
      hidden: { type },
    })}
    <nav class="zs-chips zs-tabs" aria-label="${isEn ? "Result type" : "検索種別"}">${tabLinks}</nav>
    ${seasonNote}
    ${section("places", isEn ? "Places" : "場所", data.places.length, placeRows)}
    ${section("events", isEn ? "Events" : "イベント", data.events.length, eventRows)}
    ${section("records", isEn ? "Records" : "記録", data.records.length, recordRows)}
    ${hasAny ? "" : emptyHtml}
  </section>
  <script>(function(){var KEY='zukan-recent-searches',i=document.getElementById('zs-input');if(!i||!i.form)return;i.form.addEventListener('submit',function(){var q=(i.value||'').trim();if(!q)return;try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(v))v=[];v=v.filter(function(x){return x!==q;});v.unshift(q);localStorage.setItem(KEY,JSON.stringify(v.slice(0,6)));}catch(e){}});try{var cur=${JSON.stringify(q)};if(cur){var v=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(v))v=[];v=v.filter(function(x){return x!==cur;});v.unshift(cur);localStorage.setItem(KEY,JSON.stringify(v.slice(0,6)));}}catch(e){}})();</script>`;

  const html = renderZukanCommonShell({
    title: isEn ? "Search results" : "検索結果",
    lang,
    activeNav: "none",
    authenticated: Boolean(session && !session.banned),
    displayName: session?.displayName ?? null,
    bodyHtml: body,
    pathname: `${prefix}/search/results`,
  });
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
