import type { Env } from "./core/env";

function publicMediaUrl(key: string, width: 360 | 680 = 360): string {
  const cleanKey = key.replace(/^\/+/, "");
  if (
    cleanKey.startsWith("derived/") &&
    cleanKey.endsWith("/display.webp") &&
    !cleanKey.includes("..") &&
    !cleanKey.includes("\\") &&
    !cleanKey.includes("//") &&
    !cleanKey.includes("%")
  ) {
    return `/derived-transform/w${width}/${cleanKey}`;
  }
  return `/${cleanKey}`;
}

function topImageSrcsetAttr(photoUrl: string): string {
  if (!photoUrl.startsWith("/derived-transform/w360/")) return "";
  const w680 = photoUrl.replace("/derived-transform/w360/", "/derived-transform/w680/");
  return ` srcset="${escapeHtml(photoUrl)} 360w, ${escapeHtml(w680)} 680w" sizes="(max-width: 600px) 260px, 340px"`;
}

function coarsePlaceOrMunicipalityLabel(raw: string | null | undefined): string {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return "";
  const stripped = cleaned
    .replace(/\s*\d+\s*丁目.*$/u, "")
    .replace(/\s*\d+\s*番(?:地)?.*$/u, "")
    .replace(/\s*\d+\s*[-−ー]\s*\d+.*$/u, "")
    .trim();
  return stripped || cleaned;
}

function coarseMunicipalityFromPublicCell(publicCell: string | null | undefined): string {
  const cleaned = String(publicCell ?? "").replace(/^cell:/, "").trim();
  const [latStr, lngStr] = cleaned.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const boxes: Array<{ label: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
    { label: "浜松市", minLat: 34.65, maxLat: 35.15, minLng: 137.55, maxLng: 137.95 },
    { label: "静岡市", minLat: 34.9, maxLat: 35.4, minLng: 138.2, maxLng: 138.55 },
    { label: "四日市市", minLat: 34.9, maxLat: 35.06, minLng: 136.45, maxLng: 136.7 },
    { label: "名古屋市", minLat: 35.03, maxLat: 35.26, minLng: 136.79, maxLng: 137.06 },
    { label: "東京都区部", minLat: 35.55, maxLat: 35.82, minLng: 139.56, maxLng: 139.92 },
    { label: "横浜市", minLat: 35.34, maxLat: 35.59, minLng: 139.46, maxLng: 139.74 },
    { label: "京都市", minLat: 34.88, maxLat: 35.18, minLng: 135.63, maxLng: 135.86 },
    { label: "大阪市", minLat: 34.58, maxLat: 34.77, minLng: 135.37, maxLng: 135.6 },
    { label: "静岡県", minLat: 34.58, maxLat: 35.65, minLng: 137.47, maxLng: 139.18 },
    { label: "三重県", minLat: 33.7, maxLat: 35.26, minLng: 135.85, maxLng: 136.98 },
    { label: "愛知県", minLat: 34.57, maxLat: 35.42, minLng: 136.67, maxLng: 137.84 },
    { label: "東京都", minLat: 35.5, maxLat: 35.9, minLng: 138.94, maxLng: 139.92 },
    { label: "神奈川県", minLat: 35.12, maxLat: 35.67, minLng: 138.91, maxLng: 139.8 }
  ];
  for (const box of boxes) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) {
      return box.label;
    }
  }
  return "";
}

async function resolveObservationPlaceLinks(
  env: Env,
  observationIds: string[]
): Promise<Map<string, { placeId?: string; placeName: string }>> {
  const map = new Map<string, { placeId?: string; placeName: string }>();
  if (observationIds.length === 0) return map;
  const placeholders = observationIds.map(() => "?").join(", ");
  try {
    const res = await env.OBS_DB.prepare(
      `SELECT c.visit_id, p.place_id, p.canonical_name
       FROM civic_observation_contexts c
       JOIN places p ON p.place_id = c.field_id
       WHERE c.visit_id IN (${placeholders})
         AND p.public_profile_status = 'published'`
    ).bind(...observationIds).all<{ visit_id: string; place_id: string; canonical_name: string }>();
    for (const row of res.results ?? []) {
      if (row.visit_id && row.place_id && row.canonical_name) {
        map.set(row.visit_id, { placeId: row.place_id, placeName: row.canonical_name });
      }
    }
  } catch {
    // Ignore when civic_observation_contexts or places schema is absent in minimal fixtures
  }
  try {
    const rmRes = await env.OBS_DB.prepare(
      `SELECT observation_id, public_area_label
       FROM readmodel_public_observations
       WHERE observation_id IN (${placeholders})
         AND public_area_label IS NOT NULL`
    ).bind(...observationIds).all<{ observation_id: string; public_area_label: string }>();
    for (const row of rmRes.results ?? []) {
      if (!map.has(row.observation_id) && row.public_area_label) {
        const label = coarsePlaceOrMunicipalityLabel(row.public_area_label);
        if (label) map.set(row.observation_id, { placeName: label });
      }
    }
  } catch {
    // Ignore when readmodel_public_observations is absent in minimal fixtures
  }
  return map;
}

function selectDiverseTopItems<T extends { placeName: string; dateLabel: string; hasNamedPlace: boolean }>(
  candidates: T[],
  limit: number
): T[] {
  const ordered = [...candidates].sort((a, b) => Number(b.hasNamedPlace) - Number(a.hasNamedPlace));
  const picked: T[] = [];
  const usedIndices = new Set<number>();
  const usedPlaces = new Set<string>();
  const usedDates = new Set<string>();

  for (let i = 0; i < ordered.length && picked.length < limit; i += 1) {
    const item = ordered[i]!;
    if (!usedPlaces.has(item.placeName) && !usedDates.has(item.dateLabel)) {
      picked.push(item);
      usedIndices.add(i);
      usedPlaces.add(item.placeName);
      usedDates.add(item.dateLabel);
    }
  }
  for (let i = 0; i < ordered.length && picked.length < limit; i += 1) {
    if (usedIndices.has(i)) continue;
    const item = ordered[i]!;
    if (!usedPlaces.has(item.placeName)) {
      picked.push(item);
      usedIndices.add(i);
      usedPlaces.add(item.placeName);
    }
  }
  for (let i = 0; i < ordered.length && picked.length < limit; i += 1) {
    if (usedIndices.has(i)) continue;
    picked.push(ordered[i]!);
  }
  return picked;
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

const ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY = `(
  SELECT a.public_derivative_key
    FROM asset_ledger a
   WHERE a.observation_id = o.observation_id
     AND a.processing_state = 'uploaded'
     AND a.public_derivative_key IS NOT NULL
     AND a.public_derivative_verified_at IS NOT NULL
     AND COALESCE(a.public_derivative_metadata_json, '') NOT LIKE '%"scannedContainer":"svg+xml"%'
     AND COALESCE(a.public_derivative_metadata_json, '') NOT LIKE '%"contentType":"image/svg%'
     AND a.exif_scrub_state = 'scrubbed'
     AND a.public_ready_at IS NOT NULL
     AND a.mime LIKE 'image/%'
   ORDER BY COALESCE(a.public_ready_at, a.public_derivative_verified_at, a.uploaded_at, '') DESC
   LIMIT 1
)`;

function isSyntheticOrTestEventTitle(title: string, sessionId = ""): boolean {
  const combined = `${title} ${sessionId}`;
  return /\b(?:PR\d+|prod[\s_-]*rally|smoke|canary|e2e|dummy|sandbox)\b|テスト|試験/iu.test(combined);
}

export async function loadOwnerHeroPhotos(env: Env, limit = 5): Promise<TopHeroPhoto[]> {
  const queryPhotos = async (ownerUserId: string): Promise<TopHeroPhoto[]> => {
    const rows = await env.OBS_DB.prepare(
      `SELECT o.observation_id, o.observed_at, o.public_area_label, o.public_cell, o.taxon_label,
              ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY} AS derivative_key
       FROM observations o
       WHERE COALESCE(o.visibility, 'public') = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
         ${ownerUserId ? "AND o.owner_user_id = ?1" : ""}
       ORDER BY CASE WHEN NULLIF(TRIM(COALESCE(o.public_area_label, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
                o.observed_at DESC
       LIMIT 60`
    ).bind(...(ownerUserId ? [ownerUserId] : [])).all<{
      observation_id: string;
      observed_at: string;
      public_area_label: string | null;
      public_cell: string | null;
      taxon_label: string | null;
      derivative_key: string | null;
    }>();

    const rawResults = (rows.results ?? []).filter((r) => Boolean(r.derivative_key)).slice(0, 30);
    const placeLinks = await resolveObservationPlaceLinks(env, rawResults.map((r) => r.observation_id));
    const candidates = rawResults.map((r) => {
      const linked = placeLinks.get(r.observation_id);
      const explicitLabel = linked?.placeName || coarsePlaceOrMunicipalityLabel(r.public_area_label);
      const cellLabel = explicitLabel ? "" : coarseMunicipalityFromPublicCell(r.public_cell);
      const placeName = explicitLabel || cellLabel || "身近な自然";
      const placeHref = linked?.placeId
        ? `/ja/places/${encodeURIComponent(linked.placeId)}`
        : `/ja/observations/${encodeURIComponent(r.observation_id)}`;
      return {
        observationId: r.observation_id,
        photoUrl: publicMediaUrl(r.derivative_key!, 360),
        placeName,
        placeHref,
        dateLabel: formatMonthDayJa(r.observed_at),
        hasNamedPlace: Boolean(explicitLabel || cellLabel)
      };
    });
    return selectDiverseTopItems(candidates, limit).map(({ hasNamedPlace: _unused, ...rest }) => rest);
  };

  try {
    const ownerUserId = (env as unknown as Record<string, string | undefined>).ZUKAN_OWNER_USER_ID?.trim() || "";
    const primary = await queryPhotos(ownerUserId);
    if (primary.length > 0 || !ownerUserId) return primary;
    return await queryPhotos("");
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
         AND p.valid_to IS NULL
         AND p.superseded_by_place_id IS NULL
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
      `SELECT o.observation_id, o.observed_at, o.taxon_label, o.public_area_label, o.public_cell,
              ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY} AS derivative_key
       FROM observations o
       WHERE COALESCE(o.visibility, 'public') = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
       ORDER BY CASE WHEN NULLIF(TRIM(COALESCE(o.public_area_label, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
                o.observed_at DESC
       LIMIT 48`
    ).all<{
      observation_id: string;
      observed_at: string;
      taxon_label: string | null;
      public_area_label: string | null;
      public_cell: string | null;
      derivative_key: string | null;
    }>();
    const rawResults = (res.results ?? []).filter((r) => Boolean(r.derivative_key)).slice(0, 30);
    const placeLinks = await resolveObservationPlaceLinks(env, rawResults.map((r) => r.observation_id));
    const candidates = rawResults.map((r) => {
      const linked = placeLinks.get(r.observation_id);
      const explicitLabel = linked?.placeName || coarsePlaceOrMunicipalityLabel(r.public_area_label);
      const cellLabel = explicitLabel ? "" : coarseMunicipalityFromPublicCell(r.public_cell);
      const placeName = explicitLabel || cellLabel || "身近な自然";
      return {
        observationId: r.observation_id,
        title: placeName,
        placeName,
        photoUrl: publicMediaUrl(r.derivative_key!, 360),
        dateLabel: formatMonthDayJa(r.observed_at),
        href: linked?.placeId ? `/ja/places/${encodeURIComponent(linked.placeId)}` : `/ja/observations/${encodeURIComponent(r.observation_id)}`,
        hasNamedPlace: Boolean(explicitLabel || cellLabel)
      };
    });
    return selectDiverseTopItems(candidates, limit).map(({ hasNamedPlace: _unused, placeName: _pn, ...rest }) => rest);
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

    const upcoming = (upcomingRes.results ?? [])
      .filter((e) => !isSyntheticOrTestEventTitle(e.title, e.session_id))
      .map((e) => ({
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
              ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY} AS derivative_key
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
  const isEn = options.lang === "en";
  const prefix = `/${options.lang === "ja" ? "ja" : options.lang}`;
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  const homeLabel = options.authenticated ? (isEn ? "Library" : "ライブラリ") : (isEn ? "Home" : "ホーム");
  const heroHtml = data.heroPhotos.length > 0
    ? `<section class="zt-hero" aria-label="${isEn ? "Photos" : "写真"}">
        <div class="zt-hero-strip">${data.heroPhotos.map((p, idx) => `<a class="zt-hero-card" href="${escapeHtml(p.placeHref)}">
          <img src="${escapeHtml(p.photoUrl)}"${topImageSrcsetAttr(p.photoUrl)} alt="${escapeHtml(`${p.placeName} ${p.dateLabel}`)}" loading="${idx === 0 ? "eager" : "lazy"}"${idx === 0 ? ' fetchpriority="high"' : ""}>
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
  } else if (data.eventFallbackTier === "past_scenery" && data.pastEventCards.some((ev) => Boolean(ev.photoUrl))) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.pastEventCards.filter((ev) => Boolean(ev.photoUrl)).map((ev) => `<a class="zt-thumb-card" href="${escapeHtml(ev.href)}">
      <img src="${escapeHtml(ev.photoUrl!)}" alt="${escapeHtml(ev.title)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${ev.title}・${ev.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.recentPublicRecords.some((rec) => Boolean(rec.photoUrl))) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.recentPublicRecords.filter((rec) => Boolean(rec.photoUrl)).map((rec) => `<a class="zt-thumb-card" href="${escapeHtml(rec.href)}">
      <img src="${escapeHtml(rec.photoUrl!)}" alt="${escapeHtml(rec.title)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${rec.title}・${rec.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.heroPhotos.length > 0) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.heroPhotos.map((p) => `<a class="zt-thumb-card" href="${escapeHtml(p.placeHref)}">
      <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.placeName)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${p.placeName}・${p.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  }

  const eventFallbackAction = options.authenticated
    ? `<a class="zt-inline-link" href="${prefix}/events/new">${isEn ? "Host an event" : "イベントを開く"}</a>`
    : `<a class="zt-inline-link" href="${prefix}/waitlist">${isEn ? "Join the waitlist" : "ウェイティングリストに登録"}</a>`;

  const placesStripHtml = data.placesStrip.length > 0
    ? `<section class="zt-section" aria-labelledby="zt-places-heading">
        <h2 id="zt-places-heading">${isEn ? "Places" : "場所"}</h2>
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
      <a class="zt-btn-primary" href="${prefix}/waitlist">${isEn ? "Join the waitlist" : "ウェイティングリストに登録"}</a>
      <a class="zt-btn-outline" href="${prefix}/events">${isEn ? "Nearby events" : "近くのイベントを見る"}</a>
    </div>
    <section class="zt-section" aria-labelledby="zt-events-heading">
      <h2 id="zt-events-heading">${escapeHtml(isEn && data.eventSectionHeading === "最近の記録" ? "Recent records" : data.eventSectionHeading)}</h2>
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
    .zt-main{max-width:1120px;margin:0 auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
    .zt-main>*,.zt-shell>*{min-width:0}
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
