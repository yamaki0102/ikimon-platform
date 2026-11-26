import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader } from "./zukanSubpageUi";

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
      `SELECT o.observed_at
       FROM record_place_memberships m
       JOIN observations o
         ON o.observation_id = m.record_id
       WHERE m.place_id = ?
         AND m.membership_state = 'confirmed'
         AND m.public_precision = 'place'
         AND m.removed_at IS NULL
         AND o.visibility = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0`
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
  const placeHref = `${prefix}/places/${encodedPlace}`;
  if (tab === "about") {
    let recordFact: string[] | null = null;
    try {
      const recRows = await db
        .prepare(
          `SELECT o.observed_at
           FROM record_place_memberships m
           JOIN observations o ON o.observation_id = m.record_id
           WHERE m.place_id = ?
             AND m.membership_state = 'confirmed'
             AND m.public_precision = 'place'
             AND m.removed_at IS NULL
             AND o.visibility = 'public'
             AND COALESCE(o.emergency_hidden, 0) = 0`
        )
        .bind(place.place_id)
        .all<{ observed_at: string | null }>();
      const list = recRows.results ?? [];
      const years = list.map((r) => Number(String(r.observed_at ?? "").slice(0, 4))).filter((y) => y >= 1900 && y < 3000);
      if (list.length > 0) {
        const since = years.length > 0 ? Math.min(...years) : null;
        recordFact = [
          isEn ? "Records" : "記録",
          isEn ? `${list.length}${since ? ` (since ${since})` : ""}` : `${list.length}件${since ? `（${since}年から）` : ""}`,
        ];
      }
    } catch {
      recordFact = null;
    }
    const facts = [
      place.locality_label ? [isEn ? "Area" : "所在地", place.locality_label] : null,
      recordFact,
    ].filter((row): row is string[] => row !== null);
    bodyHtml = `<section class="zt-sp" data-place-about="e6">
      <style>${ZUKAN_SUBPAGE_CSS}</style>
      ${renderSubpageHeader({ title: isEn ? "About this place" : "場所について", backHref: placeHref, backLabel: isEn ? "Back to the place" : "場所に戻る" })}
      <h2 class="zt-sp-title">${escapeHtml(place.canonical_name)}</h2>
      <p class="zt-sp-text">${escapeHtml(place.public_summary ?? (isEn ? "A local nature observation area." : "地域の自然観察の場です。"))}</p>
      ${facts.length > 0 ? `<dl class="zt-sp-facts">${facts.map(([k, v]) => `<div><dt>${escapeHtml(k!)}</dt><dd>${escapeHtml(v!)}</dd></div>`).join("")}</dl>` : ""}
      <a class="zt-sp-secondary" href="${escapeHtml(`${prefix}/places/${encodedPlace}/propose`)}">${isEn ? "Suggest an edit" : "編集を提案する"}</a>
      <a class="zt-sp-secondary" href="${escapeHtml(`${prefix}/places/${encodedPlace}/seasons`)}">${isEn ? "Seasonal records" : "季節の記録を見る"}</a>
      <a class="zt-sp-primary" href="${escapeHtml(`${prefix}/record?placeId=${encodedPlace}`)}">${isEn ? "Record here" : "この場所で記録する"}</a>
    </section>`;
  } else {
    const rows = await db
      .prepare(
        `SELECT o.observed_at
         FROM record_place_memberships m
         JOIN observations o
           ON o.observation_id = m.record_id
         WHERE m.place_id = ?
           AND m.membership_state = 'confirmed'
           AND m.public_precision = 'place'
           AND m.removed_at IS NULL
           AND o.visibility = 'public'
           AND COALESCE(o.emergency_hidden, 0) = 0`
      )
      .bind(place.place_id)
      .all<{ observed_at: string | null }>();
    const summary = aggregatePlaceSeasons(rows.results ?? []);
    const seasonShort: Record<SeasonKey, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

    bodyHtml = `<section class="zt-sp" data-place-seasons="e7">
      <style>${ZUKAN_SUBPAGE_CSS}
        .zt-sp-season{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #dde2dc}
        .zt-sp-season p{margin:0;font-size:1.0625rem;line-height:1.6}
      </style>
      ${renderSubpageHeader({ title: isEn ? "Seasonal records" : "季節の記録", backHref: placeHref, backLabel: isEn ? "Back to the place" : "場所に戻る" })}
      <p class="zt-sp-lead">${escapeHtml(place.canonical_name)} ・ ${
        isEn ? `${summary.lastYear} vs ${summary.thisYear}` : `${summary.lastYear}年と${summary.thisYear}年を見比べる`
      }</p>
      <div>
        ${summary.seasons
          .map(
            (s) => `<div class="zt-sp-season">
              <span class="zt-sp-badge">${escapeHtml(isEn ? s.key.slice(0, 3).toUpperCase() : seasonShort[s.key])}</span>
              <p>${escapeHtml(isEn ? s.labelEn : s.labelJa)}<br>${summary.thisYear}${isEn ? ": " : "年 "}${s.thisYearCount}${isEn ? "" : "件"} ・ ${summary.lastYear}${isEn ? ": " : "年 "}${s.lastYearCount}${isEn ? "" : "件"}</p>
            </div>`
          )
          .join("")}
      </div>
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
