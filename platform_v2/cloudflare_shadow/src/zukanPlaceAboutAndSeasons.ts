import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

export type PlaceSeasonBucket = {
  key: SeasonKey;
  labelJa: string;
  labelEn: string;
  thisYearCount: number;
  lastYearCount: number;
};

export type PlaceSeasonalSummary = {
  thisYear: number;
  lastYear: number;
  seasons: PlaceSeasonBucket[];
};

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

function seasonForMonth(month1To12: number): SeasonKey {
  if (month1To12 >= 3 && month1To12 <= 5) return "spring";
  if (month1To12 >= 6 && month1To12 <= 8) return "summer";
  if (month1To12 >= 9 && month1To12 <= 11) return "autumn";
  return "winter";
}

export function aggregatePlaceSeasons(
  rows: Array<{ observed_at: string | null }>,
  thisYear = new Date().getUTCFullYear()
): PlaceSeasonalSummary {
  const lastYear = thisYear - 1;
  const buckets: Record<SeasonKey, PlaceSeasonBucket> = {
    spring: { key: "spring", labelJa: "春（3〜5月）", labelEn: "Spring (Mar–May)", thisYearCount: 0, lastYearCount: 0 },
    summer: { key: "summer", labelJa: "夏（6〜8月）", labelEn: "Summer (Jun–Aug)", thisYearCount: 0, lastYearCount: 0 },
    autumn: { key: "autumn", labelJa: "秋（9〜11月）", labelEn: "Autumn (Sep–Nov)", thisYearCount: 0, lastYearCount: 0 },
    winter: { key: "winter", labelJa: "冬（12〜2月）", labelEn: "Winter (Dec–Feb)", thisYearCount: 0, lastYearCount: 0 },
  };

  for (const row of rows) {
    if (!row.observed_at) continue;
    const d = new Date(row.observed_at);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = seasonForMonth(m);
    if (y === thisYear) buckets[key].thisYearCount += 1;
    else if (y === lastYear) buckets[key].lastYearCount += 1;
  }

  return {
    thisYear,
    lastYear,
    seasons: [buckets.spring, buckets.summer, buckets.autumn, buckets.winter],
  };
}

export async function handlePlaceSeasonsApi(
  placeId: string,
  db: ObsDbLike,
  thisYear = new Date().getUTCFullYear()
): Promise<Response> {
  const place = await db
    .prepare("SELECT place_id, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return jsonResponse({ ok: false, error: "place_not_found" }, 404);
  }

  const rows = await db
    .prepare(
      `SELECT observed_at
       FROM observations
       WHERE place_id = ?
         AND visibility = 'public'`
    )
    .bind(placeId)
    .all<{ observed_at: string | null }>();

  const summary = aggregatePlaceSeasons(rows.results ?? [], thisYear);
  return jsonResponse({ ok: true, placeId, ...summary }, 200);
}

export async function handlePlaceAboutOrSeasonsRoute(
  placeId: string,
  tab: "about" | "seasons",
  lang: "ja" | "en" | "es" | "pt-br",
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  db: ObsDbLike
): Promise<Response> {
  const place = await db
    .prepare(
      `SELECT place_id, canonical_name, locality_label, place_kind, public_summary, public_profile_status
       FROM places
       WHERE place_id = ?`
    )
    .bind(placeId)
    .first<{
      place_id: string;
      canonical_name: string;
      locality_label: string | null;
      place_kind: string;
      public_summary: string | null;
      public_profile_status: string;
    }>();

  if (!place || place.public_profile_status === "private") {
    return new Response("Not found", { status: 404 });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const encodedPlace = encodeURIComponent(place.place_id);
  const authenticated = Boolean(session && !session.banned);

  let bodyHtml = "";
  if (tab === "about") {
    bodyHtml = `<section class="zt-hub-card" data-place-about="e6">
      <style>
        .zt-place-meta{display:grid;gap:8px;margin:0}
        .zt-place-meta dt{font-size:13px;color:#485a4e;font-weight:700}
        .zt-place-meta dd{margin:0;font-size:15px;font-weight:700}
      </style>
      <h1>${escapeHtml(place.canonical_name)} — ${isEn ? "About" : "この場所について"}</h1>
      <p>${escapeHtml(place.public_summary ?? (isEn ? "A local nature observation area." : "地域の自然観察の場です。"))}</p>
      <dl class="zt-place-meta">
        <div><dt>${isEn ? "Area" : "地域"}</dt><dd>${escapeHtml(place.locality_label ?? "—")}</dd></div>
        <div><dt>${isEn ? "Type" : "種別"}</dt><dd>${escapeHtml(place.place_kind)}</dd></div>
      </dl>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/places/${encodedPlace}/seasons`)}">${
          isEn ? "Seasonal records" : "季節ごとの記録を見る"
        }</a>
        <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?placeId=${encodedPlace}`)}">${
          isEn ? "Record here" : "この場所で記録する"
        }</a>
      </div>
    </section>`;
  } else {
    const rows = await db
      .prepare(
        `SELECT observed_at
         FROM observations
         WHERE place_id = ?
           AND visibility = 'public'`
      )
      .bind(place.place_id)
      .all<{ observed_at: string | null }>();
    const summary = aggregatePlaceSeasons(rows.results ?? []);

    bodyHtml = `<section class="zt-hub-card" data-place-seasons="e7">
      <style>
        .zt-season-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
        .zt-season-card{padding:12px;border:1px solid #dce3dd;border-radius:10px;background:#fff;display:grid;gap:6px}
        .zt-season-card strong{font-size:15px;color:#245c3a}
        @media (prefers-reduced-motion:reduce){.zt-season-grid,.zt-season-grid *{transition:none!important;animation:none!important}}
      </style>
      <h1>${escapeHtml(place.canonical_name)} — ${isEn ? "Seasonal Records" : "季節ごとの記録"}</h1>
      <p>${
        isEn
          ? `Comparing ${summary.lastYear} and ${summary.thisYear}`
          : `${summary.lastYear}年と${summary.thisYear}年の記録を見比べる`
      }</p>
      <div class="zt-season-grid">
        ${summary.seasons
          .map(
            (s) => `<div class="zt-season-card">
              <strong>${escapeHtml(isEn ? s.labelEn : s.labelJa)}</strong>
              <span>${summary.thisYear}${isEn ? "" : "年"}: ${s.thisYearCount}${isEn ? "" : "件"}</span>
              <span>${summary.lastYear}${isEn ? "" : "年"}: ${s.lastYearCount}${isEn ? "" : "件"}</span>
            </div>`
          )
          .join("")}
      </div>
      <p><a class="zt-btn-outline" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}">${
        isEn ? "Back to place" : "場所ページに戻る"
      }</a></p>
    </section>`;
  }

  const pageHtml = renderZukanCommonShell({
    lang,
    title: `${place.canonical_name} — ${tab === "about" ? (isEn ? "About" : "この場所について") : isEn ? "Seasons" : "季節ごとの記録"}`,
    activeNav: "places",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/places/${encodedPlace}/${tab}`,
  });

  return new Response(pageHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": authenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
