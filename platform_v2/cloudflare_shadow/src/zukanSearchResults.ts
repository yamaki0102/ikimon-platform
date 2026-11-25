import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

export type SearchResultType = "all" | "places" | "events" | "records";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type PlaceSearchRow = {
  place_id: string;
  name: string;
};

type EventSearchRow = {
  session_id: string;
  title: string;
  started_at: string;
};

type RecordSearchRow = {
  observation_id: string;
  taxon_display_name: string;
  observed_at: string;
};

function normalizeType(raw: string | null): SearchResultType {
  if (raw === "places" || raw === "events" || raw === "records") {
    return raw;
  }
  return "all";
}

async function querySearchResults(query: string, type: SearchResultType, db: Env["OBS_DB"]) {
  const trimmed = query.trim();
  const like = `%${trimmed}%`;

  const [places, events, records] = await Promise.all([
    type === "all" || type === "places"
      ? db
          .prepare(
            `SELECT place_id, name
               FROM places
              WHERE visibility = 'public'
                AND (? = '' OR name LIKE ?)
              ORDER BY name ASC
              LIMIT 30`
          )
          .bind(trimmed, like)
          .all<PlaceSearchRow>()
          .then((r) => r.results)
          .catch(() => [] as PlaceSearchRow[])
      : Promise.resolve([] as PlaceSearchRow[]),
    type === "all" || type === "events"
      ? db
          .prepare(
            `SELECT session_id, title, started_at
               FROM observation_event_sessions
              WHERE (? = '' OR title LIKE ?)
              ORDER BY started_at DESC
              LIMIT 30`
          )
          .bind(trimmed, like)
          .all<EventSearchRow>()
          .then((r) => r.results)
          .catch(() => [] as EventSearchRow[])
      : Promise.resolve([] as EventSearchRow[]),
    type === "all" || type === "records"
      ? db
          .prepare(
            `SELECT observation_id, taxon_display_name, observed_at
               FROM observations
              WHERE visibility = 'public'
                AND (? = '' OR taxon_display_name LIKE ?)
              ORDER BY observed_at DESC
              LIMIT 30`
          )
          .bind(trimmed, like)
          .all<RecordSearchRow>()
          .then((r) => r.results)
          .catch(() => [] as RecordSearchRow[])
      : Promise.resolve([] as RecordSearchRow[]),
  ]);

  return {
    query: trimmed,
    type,
    places: places.map((p) => ({ placeId: p.place_id, name: p.name })),
    events: events.map((e) => ({ sessionId: e.session_id, title: e.title, startedAt: e.started_at })),
    records: records.map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: r.taxon_display_name,
      observedAt: r.observed_at,
    })),
  };
}

export async function handleSearchResultsApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const query = url.searchParams.get("q") ?? "";
  const type = normalizeType(url.searchParams.get("type"));
  const results = await querySearchResults(query, type, db);
  return json({ ok: true, ...results });
}

export async function handleSearchResultsRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const query = url.searchParams.get("q") ?? "";
  const type = normalizeType(url.searchParams.get("type"));
  const data = await querySearchResults(query, type, db);
  const encodedQ = encodeURIComponent(data.query);

  const tabs: Array<{ key: SearchResultType; label: string }> = [
    { key: "all", label: "すべて" },
    { key: "places", label: "場所" },
    { key: "events", label: "イベント" },
    { key: "records", label: "記録" },
  ];

  const tabLinks = tabs
    .map((t) => {
      const active = t.key === type;
      return `<a class="zt-search-tab${active ? " is-active" : ""}" href="/${lang}/search/results?q=${encodedQ}&amp;type=${t.key}"${active ? ' aria-current="page"' : ""}>${t.label}</a>`;
    })
    .join("");

  const placeCards = data.places
    .map(
      (p) => `<a class="zt-search-card" href="/${lang}/places/${encodeURIComponent(p.placeId)}">
        <div class="zt-search-meta">
          <span class="zt-search-badge">場所</span>
        </div>
        <strong class="zt-search-title">${escapeHtml(p.name)}</strong>
      </a>`
    )
    .join("");

  const eventCards = data.events
    .map(
      (e) => `<a class="zt-search-card" href="/${lang}/events/${encodeURIComponent(e.sessionId)}/details">
        <div class="zt-search-meta">
          <span class="zt-search-badge">イベント</span>
          <span class="zt-search-date">${escapeHtml(e.startedAt.slice(0, 10))}</span>
        </div>
        <strong class="zt-search-title">${escapeHtml(e.title)}</strong>
      </a>`
    )
    .join("");

  const recordCards = data.records
    .map(
      (r) => `<a class="zt-search-card" href="/${lang}/records/${encodeURIComponent(r.observationId)}">
        <div class="zt-search-meta">
          <span class="zt-search-badge">記録</span>
          <span class="zt-search-date">${escapeHtml(r.observedAt.slice(0, 10))}</span>
        </div>
        <strong class="zt-search-title">${escapeHtml(r.taxonDisplayName)}</strong>
      </a>`
    )
    .join("");

  const body = `<style>
    .zt-search-results{display:grid;gap:14px;padding:16px 0}
    .zt-search-form{display:flex;gap:8px;align-items:center}
    .zt-search-input{flex:1;min-width:0;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;font-size:16px;background:#fff;color:var(--ink)}
    .zt-search-submit{min-height:44px;padding:0 16px;border-radius:12px;border:none;background:var(--green);color:#fff;font-weight:700;cursor:pointer}
    .zt-search-tabs{display:flex;flex-wrap:wrap;gap:8px}
    .zt-search-tab,.zt-search-tab:visited{min-height:36px;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-size:14px;font-weight:700;display:inline-flex;align-items:center}
    .zt-search-tab.is-active,.zt-search-tab.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-search-list{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
    .zt-search-card,.zt-search-card:visited{display:grid;gap:6px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none;min-width:0}
    .zt-search-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12px;color:var(--muted)}
    .zt-search-badge{padding:2px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--green);font-weight:700;white-space:nowrap}
    .zt-search-date{white-space:nowrap}
    .zt-search-title{font-size:16px;line-height:1.4;overflow-wrap:anywhere;word-break:break-word}
  </style>
  <section class="zt-search-results" data-search-view="h3-h6" data-search-type="${type}">
    <form class="zt-search-form" action="/${lang}/search/results" method="get">
      <input class="zt-search-input" type="search" name="q" value="${escapeHtml(data.query)}" placeholder="生きもの・場所・イベントを探す" aria-label="検索キーワード" />
      <input type="hidden" name="type" value="${type}" />
      <button class="zt-search-submit" type="submit">探す</button>
    </form>
    <nav class="zt-search-tabs" aria-label="検索種別">${tabLinks}</nav>
    ${placeCards ? `<div class="zt-search-section"><h2>場所</h2><div class="zt-search-list">${placeCards}</div></div>` : ""}
    ${eventCards ? `<div class="zt-search-section"><h2>イベント</h2><div class="zt-search-list">${eventCards}</div></div>` : ""}
    ${recordCards ? `<div class="zt-search-section"><h2>記録</h2><div class="zt-search-list">${recordCards}</div></div>` : ""}
    ${!placeCards && !eventCards && !recordCards ? `<p class="zt-search-empty">該当する結果が見つかりませんでした。</p>` : ""}
  </section>`;

  const html = renderZukanCommonShell({
    title: "検索結果 | ikimon",
    lang,
    activeNav: "places",
    authenticated: Boolean(session?.userId),
    displayName: session?.displayName ?? null,
    bodyHtml: body,
  });
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
