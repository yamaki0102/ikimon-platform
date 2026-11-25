import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type SuggestionItem = {
  kind: "species" | "place";
  label: string;
  id?: string;
};

async function queryPublicSuggestions(q: string, db: Env["OBS_DB"]): Promise<SuggestionItem[]> {
  const trimmed = q.trim().slice(0, 80);
  const like = `%${trimmed}%`;

  const speciesRows = (
    trimmed
      ? await db
          .prepare(
            `SELECT DISTINCT TRIM(taxon_label) AS label
               FROM observations
              WHERE visibility = 'public'
                AND taxon_label IS NOT NULL
                AND TRIM(taxon_label) <> ''
                AND taxon_label LIKE ?
              ORDER BY created_at DESC
              LIMIT 6`
          )
          .bind(like)
          .all<{ label: string }>()
      : await db
          .prepare(
            `SELECT DISTINCT TRIM(taxon_label) AS label
               FROM observations
              WHERE visibility = 'public'
                AND taxon_label IS NOT NULL
                AND TRIM(taxon_label) <> ''
              ORDER BY created_at DESC
              LIMIT 6`
          )
          .all<{ label: string }>()
  ).results;

  const placeRows = (
    trimmed
      ? await db
          .prepare(
            `SELECT place_id, canonical_name AS name
               FROM places
              WHERE public_profile_status = 'published' AND superseded_by_place_id IS NULL
                AND canonical_name LIKE ?
              LIMIT 6`
          )
          .bind(like)
          .all<{ place_id: string; name: string }>()
      : await db
          .prepare(
            `SELECT place_id, canonical_name AS name
               FROM places
              WHERE public_profile_status = 'published' AND superseded_by_place_id IS NULL
              LIMIT 6`
          )
          .all<{ place_id: string; name: string }>()
  ).results;

  return [
    ...speciesRows.map((r) => ({ kind: "species" as const, label: r.label })),
    ...placeRows.map((r) => ({ kind: "place" as const, label: r.name, id: r.place_id })),
  ];
}

export async function handleSearchSuggestApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const q = url.searchParams.get("q") ?? "";
  const suggestions = await queryPublicSuggestions(q, db);
  return json({ ok: true, suggestions }, 200, { "cache-control": "no-store" });
}

export async function handleSearchExploreRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim();
  const suggestions = await queryPublicSuggestions(q, db);
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const suggestHtml = suggestions.length > 0
    ? suggestions
        .map((item) => {
          const href =
            item.kind === "place" && item.id
              ? `${prefix}/places/${encodeURIComponent(item.id)}`
              : `${prefix}/search/results?q=${encodeURIComponent(item.label)}`;
          return `<a class="zt-hub-dest" href="${escapeHtml(href)}"><strong>${escapeHtml(item.label)}</strong><span>${
            item.kind === "place" ? (isEn ? "Place" : "場所") : (isEn ? "Species" : "生きもの")
          }</span></a>`;
        })
        .join("")
    : `<p>${isEn ? "No matching suggestions." : "一致する候補はまだありません。"}</p>`;

  const bodyHtml = `<style>
    .zs-bar{display:flex;gap:8px;align-items:center}
    .zs-bar input{flex:1;min-height:44px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;font:inherit}
    .zs-mic{min-height:44px;min-width:44px;border-radius:999px;border:1px solid var(--green);background:#fff;color:var(--green);font:inherit;font-weight:700;cursor:pointer}
  </style>
  <section class="zt-hub-card" data-search-view="h1-h2">
    <h1>${isEn ? "Explore" : "探す"}</h1>
    <form class="zs-bar" method="get" action="${escapeHtml(`${prefix}/search/results`)}">
      <input id="zs-input" type="search" name="q" value="${escapeHtml(q)}" placeholder="${isEn ? "Search species, places, or events" : "生きもの・場所・イベントを探す"}" aria-label="${isEn ? "Search" : "検索"}">
      <button type="button" class="zs-mic" data-search-mic-btn="1" id="zs-mic-btn" aria-label="${isEn ? "Voice search" : "音声で探す"}">🎙</button>
      <button type="submit" class="zt-btn-capture">${isEn ? "Search" : "探す"}</button>
    </form>
    <h2>${q ? (isEn ? "Suggestions" : "候補") : (isEn ? "Recent species & places" : "最近の種・場所")}</h2>
    <div id="zukan-search-suggestions" class="zt-hub-grid">${suggestHtml}</div>
  </section>`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Explore" : "探す",
    activeNav: "library",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/search/explore`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
