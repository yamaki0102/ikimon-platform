import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { displayRecordName, PLACE_SEARCH_SELECT, RECORD_THUMB_SQL, SEARCH_ICON_CALENDAR, ZUKAN_SEARCH_CSS, formatShortDate, highlightMatch, mapPlaceSearchRow, renderSearchBar, renderSearchEmptyIcon, renderSearchHead, renderSearchRow, thumbUrlOf, type PlaceSearchInfo } from "./zukanSearchUi";

export type SearchResultType = "all" | "places" | "events" | "records";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type PlaceSearchRow = {
  place_id: string;
  name: string;
  locality_label?: string | null;
  record_count?: number | null;
  thumb_asset_id?: string | null;
};

type EventSearchRow = {
  session_id: string;
  title: string;
  started_at: string;
};

type RecordSearchRow = {
  observation_id: string;
  taxon_label: string | null;
  observed_at: string;
  public_area_label?: string | null;
  asset_id?: string | null;
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
      ? (async () => {
          const filter = `WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL AND (? = '' OR p.canonical_name LIKE ?) ORDER BY p.canonical_name ASC LIMIT 30`;
          try {
            return (await db.prepare(`${PLACE_SEARCH_SELECT} ${filter}`).bind(trimmed, like).all<PlaceSearchRow>()).results;
          } catch {
            return (
              await db
                .prepare(`SELECT p.place_id AS place_id, p.canonical_name AS name FROM places p ${filter}`)
                .bind(trimmed, like)
                .all<PlaceSearchRow>()
                .then((r) => r.results)
                .catch(() => [] as PlaceSearchRow[])
            );
          }
        })()
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
            `SELECT o.observation_id AS observation_id, o.taxon_label AS taxon_label, o.observed_at AS observed_at, o.public_area_label AS public_area_label,
                    ${RECORD_THUMB_SQL} AS asset_id
               FROM observations o
              WHERE o.visibility = 'public'
                AND COALESCE(o.emergency_hidden, 0) = 0
                AND (? = '' OR o.taxon_label LIKE ?)
              ORDER BY o.observed_at DESC
              LIMIT 30`
          )
          .bind(trimmed, like)
          .all<RecordSearchRow>()
          .then((r) => r.results)
          .catch(() =>
            db
              .prepare(
                `SELECT observation_id, taxon_label, observed_at
                   FROM observations
                  WHERE visibility = 'public' AND (? = '' OR taxon_label LIKE ?)
                  ORDER BY observed_at DESC
                  LIMIT 30`
              )
              .bind(trimmed, like)
              .all<RecordSearchRow>()
              .then((r) => r.results)
              .catch(() => [] as RecordSearchRow[])
          )
      : Promise.resolve([] as RecordSearchRow[]),
  ]);

  return {
    query: trimmed,
    type,
    places: places.map((p) => mapPlaceSearchRow(p)),
    events: events.map((e) => ({ sessionId: e.session_id, title: e.title, startedAt: e.started_at })),
    records: records.map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: (r.taxon_label ?? "").trim(),
      observedAt: r.observed_at,
      areaLabel: r.public_area_label ?? null,
      assetId: r.asset_id ?? null,
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
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const q = data.query;

  const tabs: Array<{ key: SearchResultType; label: string }> = [
    { key: "all", label: isEn ? "All" : "すべて" },
    { key: "places", label: isEn ? "Places" : "場所" },
    { key: "events", label: isEn ? "Events" : "イベント" },
    { key: "records", label: isEn ? "Records" : "記録" },
  ];
  const tabLinks = tabs
    .map((tab) => {
      const active = tab.key === type;
      return `<a class="zs-chip${active ? " is-active" : ""}" href="${prefix}/search/results?q=${encodedQ}&amp;type=${tab.key}"${active ? ' aria-current="page"' : ""}>${tab.label}</a>`;
    })
    .join("");

  const placeRows = data.places
    .map((p) =>
      renderSearchRow({
        href: `${prefix}/places/${encodeURIComponent(p.placeId)}`,
        title: p.name,
        titleHtml: highlightMatch(p.name, q),
        meta: [p.locality ?? "", p.recordCount !== null && p.recordCount > 0 ? (isEn ? `${p.recordCount} records` : `記録 ${p.recordCount}件`) : ""].filter(Boolean).join(" ・ "),
        badge: isEn ? "Place" : "場所",
        thumbUrl: thumbUrlOf(p.thumbAssetId),
      })
    )
    .join("");
  const eventRows = data.events
    .map((e) =>
      renderSearchRow({
        href: `${prefix}/events/${encodeURIComponent(e.sessionId)}/preview`,
        title: e.title,
        titleHtml: highlightMatch(e.title, q),
        meta: formatShortDate(e.startedAt, isEn),
        badge: isEn ? "Event" : "イベント",
      })
    )
    .join("");
  const recordRows = data.records
    .map((r) =>
      renderSearchRow({
        href: `${prefix}/observations/${encodeURIComponent(r.observationId)}`,
        title: displayRecordName(r.taxonDisplayName, isEn) || (isEn ? "Unnamed record" : "名前なしの記録"),
        titleHtml: r.taxonDisplayName ? highlightMatch(displayRecordName(r.taxonDisplayName, isEn), q) : escapeHtml(isEn ? "Unnamed record" : "名前なしの記録"),
        meta: [formatShortDate(r.observedAt, isEn), r.areaLabel ?? ""].filter(Boolean).join(" ・ "),
        badge: isEn ? "Record" : "記録",
        thumbUrl: thumbUrlOf(r.assetId),
      })
    )
    .join("");
  const section = (label: string, count: number, rows: string) =>
    rows
      ? `${type === "all" ? `<h2 class="zs-h2">${label}</h2>` : ""}<ul class="zs-list">${rows}</ul><p class="zs-count">${isEn ? `${label} ${count}` : `${label} ${count}件`}</p>`
      : "";
  const hasAny = Boolean(placeRows || eventRows || recordRows);

  const body = `<style>${ZUKAN_SEARCH_CSS}</style>
  <section class="zs" data-search-view="h3-h6" data-search-type="${type}">
    ${renderSearchHead(isEn ? "Explore" : "探す", `${prefix}/search/explore`, isEn ? "Back" : "戻る")}
    ${renderSearchBar({
      action: `${prefix}/search/results`,
      q,
      placeholder: isEn ? "Search species, places, or events" : "生きもの・場所・イベントを探す",
      label: isEn ? "Search" : "検索キーワード",
      micLabel: isEn ? "Voice search" : "音声で探す",
      hidden: { type },
    })}
    <nav class="zs-chips zs-tabs" aria-label="${isEn ? "Result type" : "検索種別"}">${tabLinks}</nav>
    ${section(isEn ? "Places" : "場所", data.places.length, placeRows)}
    ${section(isEn ? "Events" : "イベント", data.events.length, eventRows)}
    ${section(isEn ? "Records" : "記録", data.records.length, recordRows)}
    ${
      hasAny
        ? ""
        : `<div class="zs-empty zt-search-empty">${renderSearchEmptyIcon()}<h2>${q ? (isEn ? `No results for "${escapeHtml(q)}"` : `「${escapeHtml(q)}」は見つかりませんでした`) : isEn ? "Nothing found" : "該当する結果が見つかりませんでした"}</h2><p>${isEn ? "Try different words." : "言葉を変えると、見つかるかもしれません。"}</p></div>
    <a class="zs-btn" href="${prefix}/search/seasons">${SEARCH_ICON_CALENDAR}${isEn ? "Search by season" : "時期で探す"}</a>`
    }
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
