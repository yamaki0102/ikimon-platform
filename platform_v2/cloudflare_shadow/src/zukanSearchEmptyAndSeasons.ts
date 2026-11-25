import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

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
      `SELECT observation_id, COALESCE(taxon_label, '') AS taxon_display_name, observed_at
         FROM observations
        WHERE visibility = 'public'
        ORDER BY observed_at DESC
        LIMIT 200`
    )
    .all<SeasonalRecordRow>()
    .then((r) => r.results)
    .catch(() => [] as SeasonalRecordRow[]);

  const trimmed = query.trim().toLowerCase();
  return rows
    .filter((r) => monthMatchesSeason(r.observed_at, season))
    .filter((r) => !trimmed || r.taxon_display_name.toLowerCase().includes(trimmed))
    .slice(0, 30)
    .map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: r.taxon_display_name,
      observedAt: r.observed_at,
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

  const seasons: Array<{ key: SeasonKey; label: string; months: string }> = [
    { key: "spring", label: "春", months: "3〜5月" },
    { key: "summer", label: "夏", months: "6〜8月" },
    { key: "autumn", label: "秋", months: "9〜11月" },
    { key: "winter", label: "冬", months: "12〜2月" },
  ];

  const seasonTabs = seasons
    .map((s) => {
      const active = s.key === season;
      return `<a class="zt-season-tab${active ? " is-active" : ""}" href="/${lang}/search/seasons?season=${s.key}"${active ? ' aria-current="page"' : ""}>
        <strong>${s.label}</strong>
        <span>${s.months}</span>
      </a>`;
    })
    .join("");

  const cards = records
    .map(
      (r) => `<a class="zt-season-card" href="/${lang}/records/${encodeURIComponent(r.observationId)}">
        <strong>${escapeHtml(r.taxonDisplayName)}</strong>
        <span>${escapeHtml(r.observedAt.slice(0, 10))}</span>
      </a>`
    )
    .join("");

  const emptyGuide =
    records.length === 0
      ? `<div class="zt-empty-guide" data-search-empty-guide="1">
          <h2>見つかりませんでした</h2>
          <p>${query.trim() ? `「${escapeHtml(query.trim())}」に合う公開記録はまだありません。` : "この季節の公開記録はまだありません。"}</p>
          <div class="zt-empty-actions">
            <a class="zt-btn-outline" href="/${lang}/search/explore">検索トップへ戻る</a>
            <a class="zt-btn-outline" href="/${lang}/map/explore">マップから探す</a>
          </div>
        </div>`
      : "";

  const body = `<style>
    .zt-search-seasons{display:grid;gap:14px;padding:16px 0}
    .zt-season-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .zt-season-tab,.zt-season-tab:visited{display:grid;gap:2px;padding:10px 8px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none;text-align:center}
    .zt-season-tab.is-active,.zt-season-tab.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-season-tab span{font-size:12px;opacity:.85}
    .zt-season-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
    .zt-season-card,.zt-season-card:visited{display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none}
    .zt-season-card span{font-size:13px;color:var(--muted)}
    .zt-empty-guide{padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:10px}
    .zt-empty-actions{display:flex;flex-wrap:wrap;gap:8px}
  </style>
  <section class="zt-search-seasons" data-search-view="h7-h8" data-season="${season}">
    <h1>時期で探す</h1>
    <nav class="zt-season-tabs" aria-label="季節">${seasonTabs}</nav>
    ${cards ? `<div class="zt-season-grid">${cards}</div>` : emptyGuide}
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
