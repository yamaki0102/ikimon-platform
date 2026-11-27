import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { PLACE_SEARCH_SELECT, ZUKAN_SEARCH_CSS, highlightMatch, mapPlaceSearchRow, renderSearchBar, renderSearchHead, renderSearchRow, thumbUrlOf, type PlaceSearchInfo } from "./zukanSearchUi";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type SuggestionItem = {
  kind: "species" | "place";
  label: string;
  id?: string;
  place?: PlaceSearchInfo;
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
              LIMIT 18`
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
              LIMIT 18`
          )
          .all<{ label: string }>()
  ).results;

  const placeWhere = `WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL`;
  const placeBound = trimmed ? [like] : [];
  const placeFilter = trimmed ? " AND p.canonical_name LIKE ?" : "";
  let placeRows: PlaceSearchInfo[] = [];
  try {
    placeRows = (
      await db
        .prepare(`${PLACE_SEARCH_SELECT} ${placeWhere}${placeFilter} ORDER BY p.canonical_name ASC LIMIT 6`)
        .bind(...placeBound)
        .all<Parameters<typeof mapPlaceSearchRow>[0]>()
    ).results.map(mapPlaceSearchRow);
  } catch {
    placeRows = (
      await db
        .prepare(`SELECT p.place_id AS place_id, p.canonical_name AS name FROM places p ${placeWhere}${placeFilter} LIMIT 6`)
        .bind(...placeBound)
        .all<{ place_id: string; name: string }>()
    ).results.map(mapPlaceSearchRow);
  }

  return [
    ...speciesRows.filter((r) => !isTestTaxonLabel(r.label)).slice(0, 6).map((r) => ({ kind: "species" as const, label: r.label })),
    ...placeRows.map((r) => ({ kind: "place" as const, label: r.name, id: r.placeId, place: r })),
  ];
}

export function isTestTaxonLabel(label: string): boolean {
  return /\b(?:smoke|fallback|cutover|synthetic|sandbox|canary|e2e|dummy|prod[\s_-]*rally|PR\d+)\b|^(?:test|unidentified)$|テスト|試験/i.test(label.trim());
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
  db: Env["OBS_DB"],
  regionsHref: string | null = null
): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim();
  const suggestions = await queryPublicSuggestions(q, db);
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const speciesItems = suggestions.filter((s) => s.kind === "species");
  const placeItems = suggestions.filter((s) => s.kind === "place" && s.place);
  const placeRowsHtml = placeItems
    .map((s) => {
      const info = s.place!;
      const meta = [info.locality ?? "", info.recordCount !== null && info.recordCount > 0 ? (isEn ? `${info.recordCount} records` : `記録 ${info.recordCount}件`) : ""].filter(Boolean).join(" ・ ");
      return renderSearchRow({
        href: `${prefix}/places/${encodeURIComponent(info.placeId)}`,
        title: info.name,
        titleHtml: highlightMatch(info.name, q),
        meta,
        badge: isEn ? "Place" : "場所",
        thumbUrl: thumbUrlOf(info.thumbAssetId),
      });
    })
    .join("");
  const speciesChips = speciesItems
    .map((s) => `<a class="zs-chip" href="${escapeHtml(`${prefix}/search/results?q=${encodeURIComponent(s.label)}`)}">${highlightMatch(s.label, q)}</a>`)
    .join("");
  const nothing = speciesItems.length === 0 && placeItems.length === 0;

  const bodyHtml = `<style>${ZUKAN_SEARCH_CSS}</style>
  <section class="zs" data-search-view="h1-h2">
    ${renderSearchHead(isEn ? "Explore" : "探す", `${prefix}/library`, isEn ? "Back" : "戻る")}
    ${renderSearchBar({
      action: `${prefix}/search/results`,
      q,
      placeholder: isEn ? "Search species, places, or events" : "祭り・川・去年の秋で探す",
      label: isEn ? "Search" : "検索",
      micLabel: isEn ? "Voice search" : "音声で探す",
    })}
    <div id="zukan-search-suggestions" style="display:grid;gap:16px">
      ${
        nothing
          ? `<p class="zs-count">${isEn ? "No matching suggestions." : "一致する候補はまだありません。"}</p>`
          : `${speciesChips ? `<h2 class="zs-h2">${q ? (isEn ? "Species" : "生きもの") : (isEn ? "Recently found" : "最近見つかった生きもの")}</h2><div class="zs-chips">${speciesChips}</div>` : ""}
      ${placeRowsHtml ? `<h2 class="zs-h2">${q ? (isEn ? "Places" : "場所") : (isEn ? "Popular places" : "よく見られている場所")}</h2><ul class="zs-list">${placeRowsHtml}</ul>` : ""}`
      }
    </div>
    <a class="zs-btn" href="${escapeHtml(`${prefix}/search/seasons`)}">${isEn ? "Search by season" : "時期で探す"}</a>
    ${regionsHref ? `<a class="zs-chip" data-search-regions-link="1" style="justify-self:start;min-height:44px" href="${escapeHtml(regionsHref)}">${isEn ? "Explore by region" : "地域から探す"}</a>` : ""}
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
