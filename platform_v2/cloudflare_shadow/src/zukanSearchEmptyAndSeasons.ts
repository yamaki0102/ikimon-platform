import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { RECORD_THUMB_SQL, SEARCH_ICON_CALENDAR, ZUKAN_SEARCH_CSS, formatShortDate, highlightMatch, renderSearchBar, renderSearchEmptyIcon, renderSearchHead, renderSearchRow, thumbUrlOf } from "./zukanSearchUi";

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type SeasonalRecordRow = {
  observation_id: string;
  taxon_display_name: string;
  observed_at: string;
  public_area_label?: string | null;
  asset_id?: string | null;
};

function normalizeSeason(raw: string | null): SeasonKey {
  if (raw === "spring" || raw === "summer" || raw === "autumn" || raw === "winter") {
    return raw;
  }
  return "spring";
}

function monthMatchesSeason(observedAt: string, season: SeasonKey): boolean {
  const month = Number(observedAt.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (season === "spring") return month >= 3 && month <= 5;
  if (season === "summer") return month >= 6 && month <= 8;
  if (season === "autumn") return month >= 9 && month <= 11;
  return month === 12 || month === 1 || month === 2;
}

async function querySeasonalRecords(season: SeasonKey, query: string, db: Env["OBS_DB"]) {
  const rows = await db
    .prepare(
      `SELECT o.observation_id AS observation_id, COALESCE(o.taxon_label, '') AS taxon_display_name, o.observed_at AS observed_at,
              o.public_area_label AS public_area_label, ${RECORD_THUMB_SQL} AS asset_id
         FROM observations o
        WHERE o.visibility = 'public' AND COALESCE(o.emergency_hidden, 0) = 0
        ORDER BY o.observed_at DESC
        LIMIT 200`
    )
    .all<SeasonalRecordRow>()
    .then((r) => r.results)
    .catch(() =>
      db
        .prepare(
          `SELECT observation_id, COALESCE(taxon_label, '') AS taxon_display_name, observed_at
             FROM observations
            WHERE visibility = 'public'
            ORDER BY observed_at DESC
            LIMIT 200`
        )
        .all<SeasonalRecordRow>()
        .then((r) => r.results)
        .catch(() => [] as SeasonalRecordRow[])
    );

  const trimmed = query.trim().toLowerCase();
  return rows
    .filter((r) => monthMatchesSeason(r.observed_at, season))
    .filter((r) => !trimmed || r.taxon_display_name.toLowerCase().includes(trimmed))
    .slice(0, 30)
    .map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: r.taxon_display_name,
      observedAt: r.observed_at,
      areaLabel: r.public_area_label ?? null,
      assetId: r.asset_id ?? null,
    }));
}

export async function handleSearchSeasonsApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const season = normalizeSeason(url.searchParams.get("season"));
  const query = url.searchParams.get("q") ?? "";
  const records = await querySeasonalRecords(season, query, db);
  return json({ ok: true, season, records });
}

export async function handleSearchSeasonsRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const season = normalizeSeason(url.searchParams.get("season"));
  const query = url.searchParams.get("q") ?? "";
  const records = await querySeasonalRecords(season, query, db);

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const seasons: Array<{ key: SeasonKey; label: string; months: string }> = isEn
    ? [
        { key: "spring", label: "Spring", months: "Mar–May" },
        { key: "summer", label: "Summer", months: "Jun–Aug" },
        { key: "autumn", label: "Autumn", months: "Sep–Nov" },
        { key: "winter", label: "Winter", months: "Dec–Feb" },
      ]
    : [
        { key: "spring", label: "春", months: "3〜5月" },
        { key: "summer", label: "夏", months: "6〜8月" },
        { key: "autumn", label: "秋", months: "9〜11月" },
        { key: "winter", label: "冬", months: "12〜2月" },
      ];

  const seasonTabs = seasons
    .map((s) => {
      const active = s.key === season;
      return `<a class="zs-season${active ? " is-active" : ""}" href="${prefix}/search/seasons?season=${s.key}"${active ? ' aria-current="page"' : ""}>
        <strong>${s.label}</strong>
        <span>${s.months}</span>
      </a>`;
    })
    .join("");

  const rowsHtml = records
    .map((r) =>
      renderSearchRow({
        href: `${prefix}/observations/${encodeURIComponent(r.observationId)}`,
        title: r.taxonDisplayName || (isEn ? "Unnamed record" : "名前なしの記録"),
        titleHtml: r.taxonDisplayName ? highlightMatch(r.taxonDisplayName, query) : escapeHtml(isEn ? "Unnamed record" : "名前なしの記録"),
        meta: [formatShortDate(r.observedAt, isEn), r.areaLabel ?? ""].filter(Boolean).join(" ・ "),
        badge: isEn ? "Record" : "記録",
        thumbUrl: thumbUrlOf(r.assetId),
      })
    )
    .join("");

  const emptyGuide =
    records.length === 0
      ? `<div class="zs-empty" data-search-empty-guide="1">${renderSearchEmptyIcon()}
          <h2>${isEn ? "Nothing found" : "見つかりませんでした"}</h2>
          <p>${query.trim() ? (isEn ? `No public records match "${escapeHtml(query.trim())}".` : `「${escapeHtml(query.trim())}」に合う公開記録はまだありません。`) : isEn ? "No public records for this season yet." : "この季節の公開記録はまだありません。"}</p>
        </div>
        <a class="zs-btn" href="${prefix}/search/explore">${isEn ? "Back to search" : "検索トップへ戻る"}</a>
        <a class="zs-btn" href="${prefix}/map/explore">${isEn ? "Find on the map" : "マップから探す"}</a>`
      : "";

  const body = `<style>${ZUKAN_SEARCH_CSS}</style>
  <section class="zs" data-search-view="h7-h8" data-season="${season}">
    ${renderSearchHead(isEn ? "Search by season" : "時期で探す", `${prefix}/search/explore`, isEn ? "Back" : "戻る")}
    <nav class="zs-seasons" aria-label="${isEn ? "Season" : "季節"}">${seasonTabs}</nav>
    ${rowsHtml ? `<ul class="zs-list">${rowsHtml}</ul>` : emptyGuide}
  </section>`;

  const html = renderZukanCommonShell({
    title: "時期で探す | ikimon",
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
