import type { Env } from "./core/env";

function publicMediaUrl(key: string): string {
  return `/media/${key.replace(/^\/+/, "")}`;
}

export type ZukanTopLang = "ja" | "en" | "es" | "pt-br";

export type TopHeroPhoto = {
  observationId: string;
  photoUrl: string;
  placeName: string;
  placeHref: string;
  dateLabel: string;
};

export type TopEventItem = {
  sessionId: string;
  title: string;
  dateLabel: string;
  organizerLabel: string;
  href: string;
  photoUrl?: string | null;
};

export type TopPlaceCard = {
  placeId: string;
  name: string;
  photoUrl: string | null;
  href: string;
};

export type TopPublicRecordThumb = {
  observationId: string;
  title: string;
  photoUrl: string | null;
  dateLabel: string;
  href: string;
};

export type TopLibraryPhoto = {
  observationId: string;
  photoUrl: string | null;
  title: string;
  observedAt: string;
};

export type TopLibraryGroup = {
  groupKey: string;
  headerLabel: string;
  placeName: string;
  published: boolean;
  photos: TopLibraryPhoto[];
};

export type TopOneYearPair = {
  kind: "year_ago" | "place_now";
  placeName: string;
  photos: Array<{
    observationId: string;
    photoUrl: string;
    monthLabel: string;
    href: string;
  }>;
};

export type ZukanTopPageData = {
  heroPhotos: TopHeroPhoto[];
  eventSectionHeading: string;
  eventFallbackTier: "upcoming" | "past_scenery" | "recent_records" | "owner_photos";
  upcomingEvents: TopEventItem[];
  pastEventCards: TopEventItem[];
  recentPublicRecords: TopPublicRecordThumb[];
  placesStrip: TopPlaceCard[];
  libraryGroups: TopLibraryGroup[];
  oneYearPair: TopOneYearPair | null;
};

export const ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS zukan_book_publications (
  group_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  observation_ids_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
)
`.trim();

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMonthDayJa(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function formatMonthDayWeekdayJa(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()] ?? "";
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${w}）`;
}

function formatYearMonthJa(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 7);
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月`;
}

export async function loadOwnerHeroPhotos(env: Env, limit = 5): Promise<TopHeroPhoto[]> {
  try {
    const ownerUserId = (env as unknown as Record<string, string | undefined>).ZUKAN_OWNER_USER_ID?.trim() || "";
    const rows = await env.OBS_DB.prepare(
      `SELECT o.observation_id, o.observed_at, o.public_area_label, o.taxon_label,
              (SELECT a.public_derivative_key FROM observation_assets a
                WHERE a.observation_id = o.observation_id
                  AND a.public_derivative_key IS NOT NULL
                  AND a.mime LIKE 'image/%'
                LIMIT 1) AS derivative_key
       FROM observations o
       WHERE COALESCE(o.visibility, 'public') = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
         ${ownerUserId ? "AND o.owner_user_id = ?1" : ""}
       ORDER BY o.observed_at DESC
       LIMIT 24`
    ).bind(...(ownerUserId ? [ownerUserId] : [])).all<{
      observation_id: string;
      observed_at: string;
      public_area_label: string | null;
      taxon_label: string | null;
      derivative_key: string | null;
    }>();

    const photos: TopHeroPhoto[] = [];
    for (const r of rows.results ?? []) {
      if (!r.derivative_key) continue;
      photos.push({
        observationId: r.observation_id,
        photoUrl: publicMediaUrl(r.derivative_key),
        placeName: (r.public_area_label ?? "").trim() || "身近な自然",
        placeHref: `/ja/observations/${encodeURIComponent(r.observation_id)}`,
        dateLabel: formatMonthDayJa(r.observed_at)
      });
      if (photos.length >= limit) break;
    }
    return photos;
  } catch {
    return [];
  }
}

export async function loadPublicPlacesStrip(env: Env, limit = 6): Promise<TopPlaceCard[]> {
  try {
    const res = await env.OBS_DB.prepare(
      `SELECT p.place_id, p.canonical_name
       FROM places p
       WHERE p.public_profile_status = 'published'
         AND COALESCE(p.place_visibility, 'public') = 'public'
       ORDER BY p.updated_at DESC
       LIMIT ?1`
    ).bind(limit).all<{ place_id: string; canonical_name: string }>();
    return (res.results ?? []).map((row) => ({
      placeId: row.place_id,
      name: row.canonical_name,
      photoUrl: null,
      href: `/ja/places/${encodeURIComponent(row.place_id)}`
    }));
  } catch {
    return [];
  }
}

export async function loadRecentPublicRecords(env: Env, limit = 6): Promise<TopPublicRecordThumb[]> {
  try {
    const res = await env.OBS_DB.prepare(
      `SELECT o.observation_id, o.observed_at, o.taxon_label, o.public_area_label,
              (SELECT a.public_derivative_key FROM observation_assets a
                WHERE a.observation_id = o.observation_id
                  AND a.public_derivative_key IS NOT NULL
                  AND a.mime LIKE 'image/%'
                LIMIT 1) AS derivative_key
       FROM observations o
       WHERE COALESCE(o.visibility, 'public') = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
       ORDER BY o.observed_at DESC
       LIMIT ?1`
    ).bind(limit).all<{
      observation_id: string;
      observed_at: string;
      taxon_label: string | null;
      public_area_label: string | null;
      derivative_key: string | null;
    }>();
    return (res.results ?? []).map((r) => ({
      observationId: r.observation_id,
      title: (r.taxon_label ?? "").trim() || (r.public_area_label ?? "").trim() || "自然の記録",
      photoUrl: r.derivative_key ? publicMediaUrl(r.derivative_key) : null,
      dateLabel: formatMonthDayJa(r.observed_at),
      href: `/ja/observations/${encodeURIComponent(r.observation_id)}`
    }));
  } catch {
    return [];
  }
}

export async function loadEventSectionWithFallback(
  env: Env,
  heroPhotos: TopHeroPhoto[],
  recentPublicRecords: TopPublicRecordThumb[],
  nowIso = new Date().toISOString()
): Promise<{
  heading: string;
  tier: "upcoming" | "past_scenery" | "recent_records" | "owner_photos";
  upcomingEvents: TopEventItem[];
  pastEventCards: TopEventItem[];
}> {
  try {
    const upcomingRes = await env.OBS_DB.prepare(
      `SELECT session_id, title, started_at, organizer_user_id
       FROM observation_event_sessions
       WHERE ended_at IS NULL AND started_at >= ?1
       ORDER BY started_at ASC
       LIMIT 3`
    ).bind(nowIso).all<{ session_id: string; title: string; started_at: string; organizer_user_id: string }>();

    const upcoming = (upcomingRes.results ?? []).map((e) => ({
      sessionId: e.session_id,
      title: e.title,
      dateLabel: formatMonthDayJa(e.started_at),
      organizerLabel: "地域の案内",
      href: `/ja/events/${encodeURIComponent(e.session_id)}`
    }));
    if (upcoming.length > 0) {
      return {
        heading: "近くのイベント",
        tier: "upcoming",
        upcomingEvents: upcoming,
        pastEventCards: []
      };
    }

    const pastRes = await env.OBS_DB.prepare(
      `SELECT session_id, title, started_at, organizer_user_id
       FROM observation_event_sessions
       WHERE ended_at IS NOT NULL OR started_at < ?1
       ORDER BY started_at DESC
       LIMIT 4`
    ).bind(nowIso).all<{ session_id: string; title: string; started_at: string; organizer_user_id: string }>();

    const past = (pastRes.results ?? []).map((e) => ({
      sessionId: e.session_id,
      title: e.title,
      dateLabel: formatMonthDayJa(e.started_at),
      organizerLabel: "過去の行事",
      href: `/ja/events/${encodeURIComponent(e.session_id)}`
    }));
    if (past.length > 0) {
      return {
        heading: "過去の行事の景色",
        tier: "past_scenery",
        upcomingEvents: [],
        pastEventCards: past
      };
    }
  } catch {
    // Fallback to recent public records or owner photos
  }

  if (recentPublicRecords.length > 0) {
    return {
      heading: "最近の記録",
      tier: "recent_records",
      upcomingEvents: [],
      pastEventCards: []
    };
  }

  return {
    heading: heroPhotos.length > 0 ? "場所" : "最近の記録",
    tier: "owner_photos",
    upcomingEvents: [],
    pastEventCards: []
  };
}

export async function loadUserLibraryData(
  env: Env,
  userId: string,
  searchQuery = ""
): Promise<{ groups: TopLibraryGroup[]; oneYearPair: TopOneYearPair | null }> {
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT o.observation_id, o.observed_at, o.taxon_label, o.public_area_label,
              (SELECT a.public_derivative_key FROM observation_assets a
                WHERE a.observation_id = o.observation_id
                  AND a.public_derivative_key IS NOT NULL
                  AND a.mime LIKE 'image/%'
                LIMIT 1) AS derivative_key
       FROM observations o
       WHERE o.owner_user_id = ?1
       ORDER BY o.observed_at DESC
       LIMIT 60`
    ).bind(userId).all<{
      observation_id: string;
      observed_at: string;
      taxon_label: string | null;
      public_area_label: string | null;
      derivative_key: string | null;
    }>();

    const q = searchQuery.trim().toLowerCase();
    const filtered = (rows.results ?? []).filter((r) => {
      if (!q) return true;
      return (
        (r.taxon_label ?? "").toLowerCase().includes(q) ||
        (r.public_area_label ?? "").toLowerCase().includes(q) ||
        r.observed_at.toLowerCase().includes(q)
      );
    });

    await env.CORE_DB.prepare(ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL).run();
    const pubRes = await env.CORE_DB.prepare(
      "SELECT group_key, published FROM zukan_book_publications WHERE user_id = ?1"
    ).bind(userId).all<{ group_key: string; published: number }>();
    const publishedMap = new Map<string, boolean>();
    for (const p of pubRes.results ?? []) {
      publishedMap.set(p.group_key, p.published === 1);
    }

    const groupMap = new Map<string, TopLibraryGroup>();
    const byPlace = new Map<string, Array<{ observationId: string; photoUrl: string; observedAt: string }>>();

    for (const r of filtered) {
      const dateDay = r.observed_at.slice(0, 10);
      const placeName = (r.public_area_label ?? "").trim() || "身近な場所";
      const groupKey = `${dateDay}__${placeName}`;
      const existing = groupMap.get(groupKey) ?? {
        groupKey,
        headerLabel: `${formatMonthDayWeekdayJa(r.observed_at)}・${placeName}`,
        placeName,
        published: publishedMap.get(groupKey) === true,
        photos: []
      };
      const photoUrl = r.derivative_key ? publicMediaUrl(r.derivative_key) : null;
      existing.photos.push({
        observationId: r.observation_id,
        photoUrl,
        title: (r.taxon_label ?? "").trim() || placeName,
        observedAt: r.observed_at
      });
      groupMap.set(groupKey, existing);

      if (photoUrl) {
        const list = byPlace.get(placeName) ?? [];
        list.push({ observationId: r.observation_id, photoUrl, observedAt: r.observed_at });
        byPlace.set(placeName, list);
      }
    }

    let oneYearPair: TopOneYearPair | null = null;
    for (const [placeName, list] of byPlace.entries()) {
      if (list.length >= 2) {
        const newest = list[0]!;
        const yearAgo = list.find((item) => {
          const diffDays = Math.abs(Date.parse(newest.observedAt) - Date.parse(item.observedAt)) / (1000 * 60 * 60 * 24);
          return diffDays >= 300 && diffDays <= 430;
        });
        if (yearAgo) {
          oneYearPair = {
            kind: "year_ago",
            placeName,
            photos: [
              {
                observationId: yearAgo.observationId,
                photoUrl: yearAgo.photoUrl,
                monthLabel: formatYearMonthJa(yearAgo.observedAt),
                href: `/ja/observations/${encodeURIComponent(yearAgo.observationId)}`
              },
              {
                observationId: newest.observationId,
                photoUrl: newest.photoUrl,
                monthLabel: formatYearMonthJa(newest.observedAt),
                href: `/ja/observations/${encodeURIComponent(newest.observationId)}`
              }
            ]
          };
          break;
        }
      }
    }

    if (!oneYearPair) {
      let bestPlace: { placeName: string; list: Array<{ observationId: string; photoUrl: string; observedAt: string }> } | null = null;
      for (const [placeName, list] of byPlace.entries()) {
        if (!bestPlace || list.length > bestPlace.list.length) {
          bestPlace = { placeName, list };
        }
      }
      if (bestPlace && bestPlace.list[0]) {
        const item = bestPlace.list[0];
        oneYearPair = {
          kind: "place_now",
          placeName: bestPlace.placeName,
          photos: [
            {
              observationId: item.observationId,
              photoUrl: item.photoUrl,
              monthLabel: formatYearMonthJa(item.observedAt),
              href: `/ja/observations/${encodeURIComponent(item.observationId)}`
            }
          ]
        };
      }
    }

    return { groups: [...groupMap.values()], oneYearPair };
  } catch {
    return { groups: [], oneYearPair: null };
  }
}

export async function loadZukanTopPageData(
  env: Env,
  userId: string | null,
  searchQuery = ""
): Promise<ZukanTopPageData> {
  const [heroPhotos, placesStrip, recentPublicRecords, library] = await Promise.all([
    loadOwnerHeroPhotos(env, 5),
    loadPublicPlacesStrip(env, 6),
    loadRecentPublicRecords(env, 6),
    userId ? loadUserLibraryData(env, userId, searchQuery) : Promise.resolve({ groups: [], oneYearPair: null })
  ]);

  const eventSection = await loadEventSectionWithFallback(env, heroPhotos, recentPublicRecords);

  return {
    heroPhotos,
    eventSectionHeading: eventSection.heading,
    eventFallbackTier: eventSection.tier,
    upcomingEvents: eventSection.upcomingEvents,
    pastEventCards: eventSection.pastEventCards,
    recentPublicRecords,
    placesStrip,
    libraryGroups: library.groups,
    oneYearPair: library.oneYearPair
  };
}

export function renderZukanTopPage(
  data: ZukanTopPageData,
  options: {
    lang: ZukanTopLang;
    authenticated: boolean;
    displayName?: string | null;
    searchQuery?: string;
    cspNonce?: string;
  }
): string {
  const prefix = `/${options.lang === "ja" ? "ja" : options.lang}`;
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  const homeLabel = options.authenticated ? "ライブラリ" : "ホーム";
  const heroHtml = data.heroPhotos.length > 0
    ? `<section class="zt-hero" aria-label="写真">
        <div class="zt-hero-strip">${data.heroPhotos.map((p, idx) => `<a class="zt-hero-card" href="${escapeHtml(p.placeHref)}">
          <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(`${p.placeName} ${p.dateLabel}`)}" loading="${idx === 0 ? "eager" : "lazy"}"${idx === 0 ? ' fetchpriority="high"' : ""}>
          <span class="zt-hero-label">${escapeHtml(`${p.placeName}・${p.dateLabel}`)}</span>
        </a>`).join("")}</div>
      </section>`
    : "";

  let eventBlockBody = "";
  if (data.eventFallbackTier === "upcoming" && data.upcomingEvents.length > 0) {
    eventBlockBody = `<ul class="zt-event-list">${data.upcomingEvents.map((ev) => `<li><a class="zt-event-row" href="${escapeHtml(ev.href)}">
      <span class="zt-event-date">${escapeHtml(ev.dateLabel)}</span>
      <span class="zt-event-main"><strong>${escapeHtml(ev.title)}</strong><span>${escapeHtml(ev.organizerLabel)}</span></span>
      <span aria-hidden="true">›</span>
    </a></li>`).join("")}</ul>`;
  } else if (data.eventFallbackTier === "past_scenery" && data.pastEventCards.length > 0) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.pastEventCards.map((ev) => `<a class="zt-thumb-card" href="${escapeHtml(ev.href)}">
      <div class="zt-thumb-placeholder"><span>${escapeHtml(ev.title)}</span></div>
      <span class="zt-thumb-label">${escapeHtml(`${ev.title}・${ev.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.recentPublicRecords.length > 0) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.recentPublicRecords.map((rec) => `<a class="zt-thumb-card" href="${escapeHtml(rec.href)}">
      ${rec.photoUrl
        ? `<img src="${escapeHtml(rec.photoUrl)}" alt="${escapeHtml(rec.title)}" loading="lazy">`
        : `<div class="zt-thumb-placeholder"><span>${escapeHtml(rec.title)}</span></div>`}
      <span class="zt-thumb-label">${escapeHtml(`${rec.title}・${rec.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.heroPhotos.length > 0) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.heroPhotos.map((p) => `<a class="zt-thumb-card" href="${escapeHtml(p.placeHref)}">
      <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.placeName)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${p.placeName}・${p.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  }

  const eventFallbackAction = options.authenticated
    ? `<a class="zt-inline-link" href="${prefix}/events/new">イベントを開く</a>`
    : `<a class="zt-inline-link" href="${prefix}/waitlist">ウェイティングリストに登録</a>`;

  const placesStripHtml = data.placesStrip.length > 0
    ? `<section class="zt-section" aria-labelledby="zt-places-heading">
        <h2 id="zt-places-heading">場所</h2>
        <div class="zt-place-strip">${data.placesStrip.map((pl) => `<a class="zt-place-card" href="${escapeHtml(pl.href)}">
          ${pl.photoUrl ? `<img src="${escapeHtml(pl.photoUrl)}" alt="${escapeHtml(pl.name)}" loading="lazy">` : `<div class="zt-place-fallback" aria-hidden="true"></div>`}
          <span>${escapeHtml(pl.name)}</span>
        </a>`).join("")}</div>
      </section>`
    : "";

  const loggedOutMain = `
    <h1 class="zt-sr-only">ZUKAN</h1>
    ${heroHtml}
    <div class="zt-cta-row">
      <a class="zt-btn-primary" href="${prefix}/waitlist">ウェイティングリストに登録</a>
      <a class="zt-btn-outline" href="${prefix}/events">近くのイベントを見る</a>
    </div>
    <section class="zt-section" aria-labelledby="zt-events-heading">
      <h2 id="zt-events-heading">${escapeHtml(data.eventSectionHeading)}</h2>
      ${eventBlockBody}
      <div class="zt-section-foot">${eventFallbackAction}</div>
    </section>
    ${placesStripHtml}
  `;

  const oneYearHtml = data.oneYearPair
    ? `<section class="zt-section" aria-labelledby="zt-year-heading">
        <h2 id="zt-year-heading">${data.oneYearPair.kind === "year_ago" ? "1年前のこの場所" : "この場所の今"}</h2>
        <p class="zt-place-sub">${escapeHtml(data.oneYearPair.placeName)}</p>
        <div class="zt-pair-grid">${data.oneYearPair.photos.map((p) => `<a class="zt-pair-card" href="${escapeHtml(p.href)}">
          <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(`${data.oneYearPair!.placeName} ${p.monthLabel}`)}" loading="lazy">
          <span>${escapeHtml(p.monthLabel)}</span>
        </a>`).join("")}</div>
      </section>`
    : "";

  const libraryBodyHtml = data.libraryGroups.length > 0
    ? data.libraryGroups.map((grp) => `<section class="zt-group" data-group-key="${escapeHtml(grp.groupKey)}">
        <div class="zt-group-head">
          <h2>${escapeHtml(grp.headerLabel)}</h2>
          <div class="zt-group-actions">
            ${grp.published
              ? `<button type="button" class="zt-chip-published" data-zukan-unpublish="${escapeHtml(grp.groupKey)}">図鑑に掲載中</button>`
              : `<button type="button" class="zt-btn-outline-sm" data-zukan-open-popover="${escapeHtml(grp.groupKey)}" data-place-name="${escapeHtml(grp.placeName)}">図鑑に載せる</button>`}
          </div>
        </div>
        <div class="zt-lib-grid">${grp.photos.map((ph) => `<a class="zt-lib-thumb" href="${prefix}/observations/${encodeURIComponent(ph.observationId)}" data-obs-id="${escapeHtml(ph.observationId)}">
          ${ph.photoUrl ? `<img src="${escapeHtml(ph.photoUrl)}" alt="${escapeHtml(ph.title)}" loading="lazy">` : `<span class="zt-lib-fallback">${escapeHtml(ph.title)}</span>`}
        </a>`).join("")}</div>
      </section>`).join("")
    : `<section class="zt-section">
        <div class="zt-capture-row">
          <button type="button" class="zt-btn-capture" data-global-record-trigger="photo">撮る</button>
        </div>
        ${data.placesStrip.length > 0 ? `<h2 class="zt-subhead">近くの場所</h2><div class="zt-place-strip">${data.placesStrip.map((pl) => `<a class="zt-place-card" href="${escapeHtml(pl.href)}"><div class="zt-place-fallback" aria-hidden="true"></div><span>${escapeHtml(pl.name)}</span></a>`).join("")}</div>` : ""}
        <h2 class="zt-subhead">${escapeHtml(data.eventSectionHeading)}</h2>
        ${eventBlockBody}
      </section>`;

  const loggedInMain = `
    <h1 class="zt-sr-only">ZUKAN ライブラリ</h1>
    ${oneYearHtml}
    ${libraryBodyHtml}
    <dialog class="zt-popover" id="zt-publish-dialog" aria-labelledby="zt-popover-title">
      <form method="dialog" id="zt-publish-form">
        <h2 id="zt-popover-title">図鑑に載せる</h2>
        <div class="zt-popover-thumbs" id="zt-popover-thumbs"></div>
        <div class="zt-popover-actions">
          <button type="submit" class="zt-btn-primary" id="zt-publish-submit">載せる</button>
          <button type="button" class="zt-btn-text" id="zt-publish-cancel">やめる</button>
        </div>
      </form>
    </dialog>
  `;

  const topBar = options.authenticated
    ? `<header class="zt-topbar">
        <a class="zt-logo" href="${prefix}/">ZUKAN</a>
        <form class="zt-search" action="${prefix}/" method="get">
          <input type="search" name="q" value="${escapeHtml(options.searchQuery ?? "")}" placeholder="祭り・川・去年の秋で探す" aria-label="検索">
        </form>
        <a class="zt-avatar" href="${prefix}/profile" aria-label="自分">${escapeHtml((options.displayName ?? "私").slice(0, 1))}</a>
      </header>`
    : `<header class="zt-topbar">
        <a class="zt-logo" href="${prefix}/">ZUKAN</a>
        <a class="zt-login-btn" href="/auth/login">ログイン</a>
      </header>`;

  const publishScript = options.authenticated
    ? `<script${nonceAttr}>
      (() => {
        const dialog = document.getElementById("zt-publish-dialog");
        const titleEl = document.getElementById("zt-popover-title");
        const thumbsEl = document.getElementById("zt-popover-thumbs");
        const cancelBtn = document.getElementById("zt-publish-cancel");
        const form = document.getElementById("zt-publish-form");
        if (!dialog || !titleEl || !thumbsEl || !cancelBtn || !form) return;
        let currentGroupKey = "";
        let currentPlaceName = "";
        document.addEventListener("click", async (ev) => {
          const openBtn = ev.target.closest("[data-zukan-open-popover]");
          if (openBtn) {
            currentGroupKey = openBtn.getAttribute("data-zukan-open-popover") || "";
            currentPlaceName = openBtn.getAttribute("data-place-name") || "場所";
            titleEl.textContent = currentPlaceName + "の図鑑に載せる";
            const group = openBtn.closest("[data-group-key]");
            const links = group ? [...group.querySelectorAll("[data-obs-id]")] : [];
            thumbsEl.innerHTML = links.map((a) => {
              const id = a.getAttribute("data-obs-id") || "";
              const img = a.querySelector("img");
              const src = img ? img.getAttribute("src") || "" : "";
              return '<label class="zt-pop-item"><input type="checkbox" name="obsId" value="' + id.replace(/"/g, "&quot;") + '" checked>' + (src ? '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">' : '<span>記録</span>') + '</label>';
            }).join("");
            if (typeof dialog.showModal === "function") dialog.showModal();
            else dialog.setAttribute("open", "");
            return;
          }
          const unpubBtn = ev.target.closest("[data-zukan-unpublish]");
          if (unpubBtn) {
            const key = unpubBtn.getAttribute("data-zukan-unpublish") || "";
            const res = await fetch("/api/v1/zukan-top/unpublish", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ groupKey: key })
            });
            if (res.ok) location.reload();
          }
        });
        cancelBtn.addEventListener("click", () => {
          if (typeof dialog.close === "function") dialog.close();
          else dialog.removeAttribute("open");
        });
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const ids = [...thumbsEl.querySelectorAll("input[name='obsId']:checked")].map((i) => i.value);
          if (!ids.length) return;
          const res = await fetch("/api/v1/zukan-top/publish", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ groupKey: currentGroupKey, placeName: currentPlaceName, observationIds: ids })
          });
          if (res.ok) location.reload();
        });
      })();
    </script>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(options.lang === "pt-br" ? "pt-BR" : options.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZUKAN</title>
  <style${nonceAttr}>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--capture:#b94f18;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5}
    .zt-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .zt-shell{min-height:100vh;padding-bottom:76px}
    .zt-topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
    .zt-logo{font-weight:800;font-size:18px;letter-spacing:.04em;color:var(--green);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
    .zt-login-btn,.zt-avatar{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;color:var(--green);font-weight:700;text-decoration:none;border-radius:999px}
    .zt-avatar{background:var(--surface);border:1px solid var(--line)}
    .zt-search{flex:1;max-width:460px}
    .zt-search input{width:100%;min-height:44px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font:inherit;font-size:14px}
    .zt-main{max-width:1120px;margin:0 auto;padding:16px;display:grid;gap:24px}
    .zt-hero-strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);gap:10px;overflow-x:auto}
    .zt-hero-card{position:relative;display:block;border-radius:10px;overflow:hidden;background:var(--surface);aspect-ratio:4/3;text-decoration:none}
    .zt-hero-card img{width:100%;height:100%;object-fit:cover;display:block}
    .zt-hero-label{position:absolute;left:8px;bottom:8px;padding:4px 10px;border-radius:6px;background:rgba(23,37,27,.78);color:#fff;font-size:14px;font-weight:600}
    .zt-cta-row{display:flex;flex-wrap:wrap;gap:10px}
    .zt-btn-primary{min-height:44px;padding:10px 18px;border-radius:8px;background:var(--green);color:#fff;font-weight:700;text-decoration:none;border:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px}
    .zt-btn-outline{min-height:44px;padding:10px 18px;border-radius:8px;background:#fff;color:var(--green);border:1px solid var(--green);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
    .zt-btn-outline-sm{min-height:44px;padding:6px 14px;border-radius:8px;background:#fff;color:var(--green);border:1px solid var(--green);font-weight:700;cursor:pointer;font-size:14px}
    .zt-chip-published{min-height:44px;padding:6px 14px;border-radius:999px;background:#e5f2ea;color:var(--green);border:1px solid #b6d8c2;font-weight:700;cursor:pointer;font-size:14px}
    .zt-btn-capture{min-height:44px;padding:10px 22px;border-radius:999px;background:var(--capture);color:#fff;border:0;font-weight:700;cursor:pointer;font-size:15px}
    .zt-section{background:var(--surface);border-radius:12px;padding:16px;display:grid;gap:12px}
    .zt-section h2,.zt-subhead{margin:0;font-size:18px;font-weight:700}
    .zt-event-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
    .zt-event-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;min-height:44px;padding:10px 12px;background:#fff;border-radius:8px;text-decoration:none;color:var(--ink)}
    .zt-event-date{font-weight:700;color:var(--green);font-size:14px}
    .zt-event-main{display:grid;gap:2px}
    .zt-event-main span{font-size:14px;color:var(--muted)}
    .zt-thumb-grid,.zt-place-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
    .zt-thumb-card,.zt-place-card{display:grid;gap:6px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:600}
    .zt-thumb-card img,.zt-place-card img,.zt-thumb-placeholder,.zt-place-fallback{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#e4ebe6;display:flex;align-items:center;justify-content:center;padding:8px;text-align:center}
    .zt-group{display:grid;gap:10px}
    .zt-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .zt-group-head h2{margin:0;font-size:16px;font-weight:700}
    .zt-lib-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    @media(min-width:900px){.zt-lib-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
    .zt-lib-thumb{display:block;aspect-ratio:1/1;border-radius:6px;overflow:hidden;background:var(--surface);text-decoration:none;color:var(--ink)}
    .zt-lib-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .zt-lib-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:6px;font-size:14px;text-align:center}
    .zt-pair-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .zt-pair-card{display:grid;gap:4px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:700}
    .zt-pair-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}
    .zt-inline-link{color:var(--green);font-weight:700;font-size:14px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
    .zt-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid var(--line);padding:4px 6px}
    .zt-nav-item{min-height:48px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:var(--muted);font-size:14px;font-weight:700;border-radius:8px;border:0;background:transparent;cursor:pointer}
    .zt-nav-item[aria-current="page"]{color:var(--green)}
    .zt-nav-capture{background:var(--capture);color:#fff}
    .zt-sidebar{display:none}
    @media(min-width:960px){
      .zt-shell{display:grid;grid-template-columns:220px 1fr;padding-bottom:0}
      .zt-sidebar{display:flex;flex-direction:column;gap:8px;padding:16px;border-right:1px solid var(--line);background:#fff;position:sticky;top:0;height:100vh}
      .zt-bottom-nav{display:none}
    }
    .zt-popover{border:1px solid var(--line);border-radius:12px;padding:16px;max-width:420px;width:92vw}
    .zt-popover-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .zt-pop-item{display:grid;gap:4px;justify-items:center}
    .zt-pop-item img{width:64px;height:64px;object-fit:cover;border-radius:6px}
    .zt-popover-actions{display:flex;gap:10px;align-items:center}
    .zt-btn-text{min-height:44px;padding:0 12px;border:0;background:transparent;color:var(--muted);font-weight:700;cursor:pointer;font-size:14px}
  </style>
</head>
<body>
  <div class="zt-shell">
    <aside class="zt-sidebar" aria-label="ナビ">
      <a class="zt-btn-capture" href="${prefix}/capture" style="text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center">撮る</a>
      <a class="zt-nav-item" href="${prefix}/" aria-current="page">${homeLabel}</a>
      <a class="zt-nav-item" href="${prefix}/events">イベント</a>
      <a class="zt-nav-item" href="${prefix}/places">場所</a>
      <a class="zt-nav-item" href="${prefix}/profile">自分</a>
    </aside>
    <div>
      ${topBar}
      <main class="zt-main">
        ${options.authenticated ? loggedInMain : loggedOutMain}
      </main>
    </div>
  </div>
  <nav class="zt-bottom-nav" aria-label="メニュー">
    <a class="zt-nav-item" href="${prefix}/" aria-current="page">${homeLabel}</a>
    <a class="zt-nav-item" href="${prefix}/events">イベント</a>
    <a class="zt-nav-item zt-nav-capture" href="${prefix}/capture">撮る</a>
    <a class="zt-nav-item" href="${prefix}/places">場所</a>
    <a class="zt-nav-item" href="${prefix}/profile">自分</a>
  </nav>
  ${publishScript}
</body>
</html>`;
}
