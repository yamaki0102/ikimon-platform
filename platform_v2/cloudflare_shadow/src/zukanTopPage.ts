import type { Env } from "./core/env";
import { renderOtayoriFloatingButton } from "./otayori";
import { OWNER_AREA_LABEL_NO_LOCATION, loadOwnerAreaLabels } from "./ownerAreaLabel";
import { renderZukanErrorState, renderZukanSheet, renderZukanShellDocument } from "./zukanShell";
import { dayBoundsFromGroupKey, decodePageCursor, encodePageCursor, likePatternFromQuery, loadMoreScript } from "./ownerRecordPaging";
import { ZUKAN_LIBRARY_CSS, renderLibraryEmpty, renderLibraryGroups, renderLibraryMore, renderYearPairCard } from "./zukanLibraryBlocks";
import { GUEST_TOP_V2_CSS, renderGuestTopV2Main } from "./zukanGuestTopV2";

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

const MUNICIPALITY_BOXES: Array<{ ja: string; en: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { ja: "浜松市", en: "Hamamatsu", minLat: 34.65, maxLat: 35.15, minLng: 137.55, maxLng: 137.95 },
  { ja: "静岡市", en: "Shizuoka", minLat: 34.9, maxLat: 35.4, minLng: 138.2, maxLng: 138.55 },
  { ja: "四日市市", en: "Yokkaichi", minLat: 34.9, maxLat: 35.06, minLng: 136.45, maxLng: 136.7 },
  { ja: "名古屋市", en: "Nagoya", minLat: 35.03, maxLat: 35.26, minLng: 136.79, maxLng: 137.06 },
  { ja: "東京都区部", en: "Tokyo", minLat: 35.55, maxLat: 35.82, minLng: 139.56, maxLng: 139.92 },
  { ja: "横浜市", en: "Yokohama", minLat: 35.34, maxLat: 35.59, minLng: 139.46, maxLng: 139.74 },
  { ja: "京都市", en: "Kyoto", minLat: 34.88, maxLat: 35.18, minLng: 135.63, maxLng: 135.86 },
  { ja: "大阪市", en: "Osaka", minLat: 34.58, maxLat: 34.77, minLng: 135.37, maxLng: 135.6 },
  { ja: "静岡県", en: "Shizuoka", minLat: 34.58, maxLat: 35.65, minLng: 137.47, maxLng: 139.18 },
  { ja: "三重県", en: "Mie", minLat: 33.7, maxLat: 35.26, minLng: 135.85, maxLng: 136.98 },
  { ja: "愛知県", en: "Aichi", minLat: 34.57, maxLat: 35.42, minLng: 136.67, maxLng: 137.84 },
  { ja: "東京都", en: "Tokyo", minLat: 35.5, maxLat: 35.9, minLng: 138.94, maxLng: 139.92 },
  { ja: "神奈川県", en: "Kanagawa", minLat: 35.12, maxLat: 35.67, minLng: 138.91, maxLng: 139.8 }
];

function localizePlaceLabel(label: string, lang: ZukanTopLang): string {
  if (lang !== "en") return label;
  const match = MUNICIPALITY_BOXES.find((b) => b.ja === label);
  return match ? match.en : label;
}

function coarseMunicipalityFromPublicCell(publicCell: string | null | undefined, lang: ZukanTopLang = "ja"): string {
  const cleaned = String(publicCell ?? "").replace(/^cell:/, "").trim();
  const [latStr, lngStr] = cleaned.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  for (const box of MUNICIPALITY_BOXES) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) {
      return lang === "en" ? box.en : box.ja;
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
  const usedPairKeys = new Set<string>();
  const usedPlaces = new Set<string>();
  const usedDates = new Set<string>();

  for (let i = 0; i < ordered.length && picked.length < limit; i += 1) {
    const item = ordered[i]!;
    const pairKey = `${item.placeName}__${item.dateLabel}`;
    if (!usedPairKeys.has(pairKey) && !usedPlaces.has(item.placeName) && !usedDates.has(item.dateLabel)) {
      picked.push(item);
      usedPairKeys.add(pairKey);
      usedPlaces.add(item.placeName);
      usedDates.add(item.dateLabel);
    }
  }
  for (let i = 0; i < ordered.length && picked.length < limit; i += 1) {
    const item = ordered[i]!;
    const pairKey = `${item.placeName}__${item.dateLabel}`;
    if (!usedPairKeys.has(pairKey)) {
      picked.push(item);
      usedPairKeys.add(pairKey);
    }
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
  recordCount?: number | null;
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
  placeId?: string | null;
  placeName: string;
  areaLabel?: string | null;
  noLocation?: boolean;
  published: boolean;
  photos: TopLibraryPhoto[];
};

export type TopOneYearPair = {
  kind: "year_ago" | "place_now";
  placeName: string;
  placeId?: string | null;
  recordCount?: number;
  lastObservedAt?: string;
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
  libraryNextCursor?: string | null;
  oneYearPair: TopOneYearPair | null;
  libraryLoadError?: boolean;
  placesLoadError?: boolean;
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

export const ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS zukan_observation_publications (
  user_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  place_id TEXT,
  legacy_group_key TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, observation_id)
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

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthDay(iso: string, lang: ZukanTopLang = "ja"): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  if (lang === "en") {
    return `${MONTHS_EN[d.getUTCMonth()] ?? ""} ${d.getUTCDate()}`;
  }
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

export async function loadOwnerHeroPhotos(env: Env, limit = 5, lang: ZukanTopLang = "ja"): Promise<TopHeroPhoto[]> {
  const prefix = `/${lang === "ja" ? "ja" : lang}`;
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
      const rawExplicit = linked?.placeName || coarsePlaceOrMunicipalityLabel(r.public_area_label);
      const explicitLabel = rawExplicit ? localizePlaceLabel(rawExplicit, lang) : "";
      const cellLabel = explicitLabel ? "" : coarseMunicipalityFromPublicCell(r.public_cell, lang);
      const placeName = explicitLabel || cellLabel || (lang === "en" ? "Local nature" : "身近な自然");
      const placeHref = linked?.placeId
        ? `${prefix}/places/${encodeURIComponent(linked.placeId)}`
        : `${prefix}/observations/${encodeURIComponent(r.observation_id)}`;
      return {
        observationId: r.observation_id,
        photoUrl: publicMediaUrl(r.derivative_key!, 360),
        placeName,
        placeHref,
        dateLabel: formatMonthDay(r.observed_at, lang),
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

export async function loadPublicPlacesStrip(env: Env, limit = 6, lang: ZukanTopLang = "ja"): Promise<TopPlaceCard[]> {
  return (await loadPublicPlacesStripWithStatus(env, limit, lang)).cards;
}

async function loadPublicPlacesStripWithStatus(
  env: Env,
  limit = 6,
  lang: ZukanTopLang = "ja"
): Promise<{ cards: TopPlaceCard[]; loadError: boolean }> {
  const prefix = `/${lang === "ja" ? "ja" : lang}`;
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
    const cards: TopPlaceCard[] = (res.results ?? []).map((row) => ({
      placeId: row.place_id,
      name: localizePlaceLabel(row.canonical_name, lang),
      photoUrl: null,
      href: `${prefix}/places/${encodeURIComponent(row.place_id)}`,
      recordCount: null
    }));
    if (cards.length === 0) return { cards, loadError: false };
    try {
      const ids = cards.map((c) => c.placeId);
      const ph = ids.map((_, i) => `?${i + 1}`).join(", ");
      const rich = await env.OBS_DB.prepare(
        `SELECT p.place_id AS place_id,
                (SELECT COUNT(*) FROM civic_observation_contexts c
                   JOIN observations o ON o.observation_id = c.visit_id
                  WHERE c.field_id = p.place_id
                    AND COALESCE(o.visibility, 'public') = 'public'
                    AND COALESCE(o.emergency_hidden, 0) = 0) AS record_count,
                (SELECT ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY}
                   FROM observations o
                   JOIN civic_observation_contexts c ON c.visit_id = o.observation_id
                  WHERE c.field_id = p.place_id
                    AND COALESCE(o.visibility, 'public') = 'public'
                    AND COALESCE(o.emergency_hidden, 0) = 0
                    AND ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY} IS NOT NULL
                  ORDER BY o.observed_at DESC
                  LIMIT 1) AS derivative_key
           FROM places p
          WHERE p.place_id IN (${ph})`
      ).bind(...ids).all<{ place_id: string; record_count: number | null; derivative_key: string | null }>();
      const byId = new Map((rich.results ?? []).map((r) => [r.place_id, r]));
      for (const card of cards) {
        const r = byId.get(card.placeId);
        if (!r) continue;
        card.recordCount = typeof r.record_count === "number" ? r.record_count : null;
        card.photoUrl = r.derivative_key ? publicMediaUrl(r.derivative_key, 360) : null;
      }
    } catch {
      // Place photos and counts are best-effort; the list still renders without them.
    }
    return { cards, loadError: false };
  } catch {
    return { cards: [], loadError: true };
  }
}

export async function loadRecentPublicRecords(env: Env, limit = 6, lang: ZukanTopLang = "ja"): Promise<TopPublicRecordThumb[]> {
  const prefix = `/${lang === "ja" ? "ja" : lang}`;
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
      const rawExplicit = linked?.placeName || coarsePlaceOrMunicipalityLabel(r.public_area_label);
      const explicitLabel = rawExplicit ? localizePlaceLabel(rawExplicit, lang) : "";
      const cellLabel = explicitLabel ? "" : coarseMunicipalityFromPublicCell(r.public_cell, lang);
      const placeName = explicitLabel || cellLabel || (lang === "en" ? "Local nature" : "身近な自然");
      return {
        observationId: r.observation_id,
        title: placeName,
        placeName,
        photoUrl: publicMediaUrl(r.derivative_key!, 360),
        dateLabel: formatMonthDay(r.observed_at, lang),
        href: linked?.placeId ? `${prefix}/places/${encodeURIComponent(linked.placeId)}` : `${prefix}/observations/${encodeURIComponent(r.observation_id)}`,
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
  nowIso = new Date().toISOString(),
  lang: ZukanTopLang = "ja"
): Promise<{
  heading: string;
  tier: "upcoming" | "past_scenery" | "recent_records" | "owner_photos";
  upcomingEvents: TopEventItem[];
  pastEventCards: TopEventItem[];
}> {
  const prefix = `/${lang === "ja" ? "ja" : lang}`;
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
        dateLabel: formatMonthDay(e.started_at, lang),
        organizerLabel: lang === "en" ? "Local guide" : "地域の案内",
        href: `${prefix}/community/events`
      }));
    if (upcoming.length > 0) {
      return {
        heading: lang === "en" ? "Nearby events" : "近くのイベント",
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
      heading: lang === "en" ? "Recent records" : "最近の記録",
      tier: "recent_records",
      upcomingEvents: [],
      pastEventCards: []
    };
  }

  return {
    heading: heroPhotos.length > 0 ? (lang === "en" ? "Places" : "場所") : (lang === "en" ? "Recent records" : "最近の記録"),
    tier: "owner_photos",
    upcomingEvents: [],
    pastEventCards: []
  };
}

export const USER_LIBRARY_PAGE_SIZE = 60;

export type UserLibraryPageOptions = { limit?: number; before?: string | null; day?: string | null };

type UserLibraryRow = {
  observation_id: string;
  observed_at: string;
  taxon_label: string | null;
  public_area_label: string | null;
  has_loc: number | null;
  derivative_key: string | null;
};

function buildUserLibraryQuery(
  userId: string,
  like: string | null,
  limit: number,
  options: UserLibraryPageOptions,
  withPlaceSearch: boolean,
  withLocCols = true
): { sql: string; params: Array<string | number> } {
  const params: Array<string | number> = [];
  const p = (value: string | number): string => {
    params.push(value);
    return `?${params.length}`;
  };
  const where = [`o.owner_user_id = ${p(userId)}`];
  if (like) {
    const l = p(like);
    const parts = [
      `o.taxon_label LIKE ${l} ESCAPE '\\'`,
      `o.public_area_label LIKE ${l} ESCAPE '\\'`,
      `o.note LIKE ${l} ESCAPE '\\'`,
      `o.observed_at LIKE ${l} ESCAPE '\\'`
    ];
    if (withPlaceSearch) {
      parts.push(
        `EXISTS (SELECT 1 FROM civic_observation_contexts c JOIN places pl ON pl.place_id = c.field_id WHERE c.visit_id = o.observation_id AND pl.public_profile_status = 'published' AND pl.canonical_name LIKE ${l} ESCAPE '\\')`,
        `EXISTS (SELECT 1 FROM readmodel_public_observations r WHERE r.observation_id = o.observation_id AND r.public_area_label LIKE ${l} ESCAPE '\\')`
      );
    }
    where.push(`(${parts.join(" OR ")})`);
  }
  const cursor = decodePageCursor(options.before);
  if (cursor) {
    const at = p(cursor.observedAt);
    where.push(`(o.observed_at < ${at} OR (o.observed_at = ${at} AND o.observation_id < ${p(cursor.id)}))`);
  }
  const bounds = options.day ? dayBoundsFromGroupKey(options.day) : null;
  if (bounds) where.push(`o.observed_at >= ${p(bounds.from)} AND o.observed_at < ${p(bounds.to)}`);
  const locExpr = withLocCols ? "CASE WHEN o.exact_lat IS NOT NULL AND o.exact_lng IS NOT NULL THEN 1 ELSE 0 END AS has_loc" : "0 AS has_loc";
  const sql = `SELECT o.observation_id, o.observed_at, o.taxon_label, o.public_area_label,
              ${locExpr},
              ${ASSET_LEDGER_PUBLIC_PHOTO_SUBQUERY} AS derivative_key
       FROM observations o
       WHERE ${where.join(" AND ")}
       ORDER BY o.observed_at DESC, o.observation_id DESC
       LIMIT ${p(limit + 1)}`;
  return { sql, params };
}

type UserLibraryResult = { groups: TopLibraryGroup[]; oneYearPair: TopOneYearPair | null; yearPairs: TopOneYearPair[]; nextCursor: string | null; loadError?: boolean };

export async function loadUserLibraryData(
  env: Env,
  userId: string,
  searchQuery = "",
  options: UserLibraryPageOptions = {}
): Promise<UserLibraryResult> {
  let result = await loadUserLibraryPage(env, userId, searchQuery, options);
  if (result.loadError) return result;
  for (let guard = 0; guard < 4 && result.groups.length === 0 && result.nextCursor; guard += 1) {
    result = await loadUserLibraryPage(env, userId, searchQuery, { ...options, before: result.nextCursor });
    if (result.loadError) return result;
  }
  return result;
}

async function loadUserLibraryPage(
  env: Env,
  userId: string,
  searchQuery: string,
  options: UserLibraryPageOptions
): Promise<UserLibraryResult> {
  try {
    const limit = options.limit ?? (options.day ? 500 : USER_LIBRARY_PAGE_SIZE);
    const like = likePatternFromQuery(searchQuery);
    let found: { results?: UserLibraryRow[] };
    try {
      const q = buildUserLibraryQuery(userId, like, limit, options, true, true);
      found = await env.OBS_DB.prepare(q.sql).bind(...q.params).all<UserLibraryRow>();
    } catch (error) {
      if (!(error instanceof Error) || !/no such (table|column)/i.test(error.message)) throw error;
      if (like && /exact_l/i.test(error.message)) {
        const q = buildUserLibraryQuery(userId, like, limit, options, true, false);
        found = await env.OBS_DB.prepare(q.sql).bind(...q.params).all<UserLibraryRow>();
      } else {
        const q = buildUserLibraryQuery(userId, like, limit, options, false, false);
        found = await env.OBS_DB.prepare(q.sql).bind(...q.params).all<UserLibraryRow>();
      }
    }
    const fetched = found.results ?? [];
    const filtered = fetched.slice(0, limit);
    const lastRow = filtered[filtered.length - 1];
    const nextCursor = fetched.length > limit && lastRow ? encodePageCursor(lastRow.observed_at, lastRow.observation_id) : null;

    await env.CORE_DB.prepare(ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL).run();
    await env.CORE_DB.prepare(ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL).run();
    const [pubRes, obsPubRes, placeLinks] = await Promise.all([
      env.CORE_DB.prepare(
        "SELECT group_key, published FROM zukan_book_publications WHERE user_id = ?1"
      ).bind(userId).all<{ group_key: string; published: number }>(),
      env.CORE_DB.prepare(
        "SELECT observation_id, published FROM zukan_observation_publications WHERE user_id = ?1"
      ).bind(userId).all<{ observation_id: string; published: number }>().catch(() => ({ results: [] as Array<{ observation_id: string; published: number }> })),
      resolveObservationPlaceLinks(env, filtered.map((r) => r.observation_id)),
    ]);
    const ownerLabels = await loadOwnerAreaLabels(env, filtered.filter((r) => !(r.public_area_label ?? "").trim()).map((r) => r.observation_id));
    const publishedMap = new Map<string, boolean>();
    for (const p of pubRes.results ?? []) {
      publishedMap.set(p.group_key, p.published === 1);
    }
    const obsPublishedMap = new Map<string, boolean>();
    for (const op of obsPubRes.results ?? []) {
      obsPublishedMap.set(op.observation_id, op.published === 1);
    }

    const groupMap = new Map<string, TopLibraryGroup>();
    const byPlace = new Map<string, Array<{ observationId: string; photoUrl: string; observedAt: string }>>();
    const placeIdByName = new Map<string, string>();

    for (const r of filtered) {
      const dateDay = r.observed_at.slice(0, 10);
      const placeLink = placeLinks.get(r.observation_id);
      const placeId = placeLink?.placeId ?? null;
      const storedName = (r.public_area_label ?? "").trim();
      const keyName = storedName || "身近な場所";
      const areaLabel = storedName || ownerLabels.get(r.observation_id) || null;
      const noLocation = !areaLabel && !r.has_loc;
      const placeName = areaLabel ?? "身近な場所";
      const legacyKey = `${dateDay}__${keyName}`;
      const groupKey = placeId ? `${dateDay}__${placeId}` : legacyKey;
      const obsPublished = obsPublishedMap.get(r.observation_id);
      const isPublished = obsPublished !== undefined
        ? obsPublished
        : (publishedMap.get(groupKey) === true || publishedMap.get(legacyKey) === true);
      const existing: TopLibraryGroup = groupMap.get(groupKey) ?? {
        groupKey,
        headerLabel: formatMonthDayWeekdayJa(r.observed_at),
        placeId,
        placeName,
        areaLabel: null,
        noLocation: true,
        published: false,
        photos: []
      };
      if (isPublished) existing.published = true;
      if (areaLabel && !existing.areaLabel) {
        existing.areaLabel = areaLabel;
        existing.placeName = areaLabel;
      }
      if (!noLocation) existing.noLocation = false;
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
        if (placeId) placeIdByName.set(placeName, placeId);
      }
    }

    const yearPairs: TopOneYearPair[] = [];
    for (const [placeName, list] of byPlace.entries()) {
      if (list.length >= 2) {
        const newest = list[0]!;
        const yearAgo = list.find((item) => {
          const diffDays = Math.abs(Date.parse(newest.observedAt) - Date.parse(item.observedAt)) / (1000 * 60 * 60 * 24);
          return diffDays >= 300 && diffDays <= 430;
        });
        if (yearAgo) {
          yearPairs.push({
            kind: "year_ago",
            placeName,
            placeId: placeIdByName.get(placeName) ?? null,
            recordCount: list.length,
            lastObservedAt: newest.observedAt,
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
          });
        }
      }
    }
    let oneYearPair: TopOneYearPair | null = yearPairs[0] ?? null;

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

    const groups = [...groupMap.values()].filter((g) => g.photos.some((p) => Boolean(p.photoUrl)));
    for (const g of groups) {
      g.photos = g.photos.filter((p) => Boolean(p.photoUrl));
      g.headerLabel = g.areaLabel ? `${g.headerLabel}・${g.areaLabel}` : g.noLocation ? `${g.headerLabel}・${OWNER_AREA_LABEL_NO_LOCATION}` : g.headerLabel;
    }
    return { groups, oneYearPair, yearPairs, nextCursor };
  } catch {
    return { groups: [], oneYearPair: null, yearPairs: [], nextCursor: null, loadError: true };
  }
}

export async function loadUserLibraryGroup(env: Env, userId: string, groupKey: string): Promise<TopLibraryGroup | null> {
  if (!dayBoundsFromGroupKey(groupKey)) return null;
  const data = await loadUserLibraryData(env, userId, "", { day: groupKey });
  return data.groups.find((g) => g.groupKey === groupKey) ?? null;
}

export async function loadZukanTopPageData(
  env: Env,
  userId: string | null,
  searchQuery = "",
  lang: ZukanTopLang = "ja",
  libraryOptions: UserLibraryPageOptions = {}
): Promise<ZukanTopPageData> {
  const [heroPhotos, placesResult, recentPublicRecords, library] = await Promise.all([
    loadOwnerHeroPhotos(env, 5, lang),
    loadPublicPlacesStripWithStatus(env, 6, lang),
    loadRecentPublicRecords(env, 6, lang),
    userId ? loadUserLibraryData(env, userId, searchQuery, libraryOptions) : Promise.resolve({ groups: [], oneYearPair: null, yearPairs: [] as TopOneYearPair[], nextCursor: null as string | null, loadError: false })
  ]);

  const eventSection = await loadEventSectionWithFallback(env, heroPhotos, recentPublicRecords, new Date().toISOString(), lang);

  return {
    heroPhotos,
    eventSectionHeading: eventSection.heading,
    eventFallbackTier: eventSection.tier,
    upcomingEvents: eventSection.upcomingEvents,
    pastEventCards: eventSection.pastEventCards,
    recentPublicRecords,
    placesStrip: placesResult.cards,
    libraryGroups: library.groups,
    libraryNextCursor: library.nextCursor,
    oneYearPair: library.oneYearPair,
    ...(library.loadError ? { libraryLoadError: true } : {}),
    ...(placesResult.loadError ? { placesLoadError: true } : {})
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
    guestTopV2?: boolean;
  }
): string {
  const isEn = options.lang === "en";
  const prefix = `/${options.lang === "ja" ? "ja" : options.lang}`;
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  const homeLabel = options.authenticated ? (isEn ? "Library" : "ライブラリ") : (isEn ? "Home" : "ホーム");
  const labelSep = isEn ? " · " : "・";
  const heroHtml = data.heroPhotos.length > 0
    ? `<section class="zt-hero" aria-label="${isEn ? "Photos" : "写真"}">
        <div class="zt-hero-strip">${data.heroPhotos.map((p, idx) => `<a class="zt-hero-card" href="${escapeHtml(p.placeHref)}">
          <img src="${escapeHtml(p.photoUrl)}"${topImageSrcsetAttr(p.photoUrl)} alt="${escapeHtml(`${p.placeName} ${p.dateLabel}`)}" loading="${idx === 0 ? "eager" : "lazy"}"${idx === 0 ? ' fetchpriority="high"' : ""}>
          <span class="zt-hero-label">${escapeHtml(`${p.placeName}${labelSep}${p.dateLabel}`)}</span>
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
      <span class="zt-thumb-label">${escapeHtml(`${ev.title}${labelSep}${ev.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.recentPublicRecords.some((rec) => Boolean(rec.photoUrl))) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.recentPublicRecords.filter((rec) => Boolean(rec.photoUrl)).map((rec) => `<a class="zt-thumb-card" href="${escapeHtml(rec.href)}">
      <img src="${escapeHtml(rec.photoUrl!)}" alt="${escapeHtml(rec.title)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${rec.title}${labelSep}${rec.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  } else if (data.heroPhotos.length > 0) {
    eventBlockBody = `<div class="zt-thumb-grid">${data.heroPhotos.map((p) => `<a class="zt-thumb-card" href="${escapeHtml(p.placeHref)}">
      <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.placeName)}" loading="lazy">
      <span class="zt-thumb-label">${escapeHtml(`${p.placeName}${labelSep}${p.dateLabel}`)}</span>
    </a>`).join("")}</div>`;
  }

  const placeRows = data.placesLoadError
    ? `<section class="zk-places" aria-labelledby="zt-places-heading">
        <div class="zk-sec-head"><h2 id="zt-places-heading">${isEn ? "Public place ZUKANs" : "公開されている場所の図鑑"}</h2></div>
        ${renderZukanErrorState({
          title: isEn ? "Could not load" : "読み込めませんでした",
          message: isEn ? "Could not load public places. Please try again." : "公開されている場所の読み込みに失敗しました。もう一度お試しください。",
          retryHref: `${prefix}/`,
          retryLabel: isEn ? "Try again" : "もう一度"
        })}
      </section>`
    : data.placesStrip.length > 0
      ? `<section class="zk-places" aria-labelledby="zt-places-heading">
          <div class="zk-sec-head"><h2 id="zt-places-heading">${isEn ? "Public place ZUKANs" : "公開されている場所の図鑑"}</h2></div>
          <ul class="zk-place-list">${data.placesStrip.map((pl) => `<li><a class="zk-place-row" href="${escapeHtml(pl.href)}">
            ${pl.photoUrl ? `<img src="${escapeHtml(pl.photoUrl)}" alt="" loading="lazy" width="76" height="76">` : `<span class="zk-place-ph" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#143F2E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>`}
            <span class="zk-place-text"><strong>${escapeHtml(pl.name)}</strong>${typeof pl.recordCount === "number" && pl.recordCount > 0 ? `<span>${isEn ? `${pl.recordCount} records` : `記録 ${pl.recordCount}件`}</span>` : ""}</span>
            <span class="zk-chev" aria-hidden="true">›</span>
          </a></li>`).join("")}</ul>
        </section>`
      : "";

  const loggedOutMain = `
    <section class="zk-hero" data-zk-hero="designed" aria-labelledby="zk-hero-title">
      <svg class="zk-hero-art" aria-hidden="true" focusable="false" viewBox="0 0 400 340" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="zk-sun" cx="78%" cy="16%" r="40%"><stop offset="0" stop-color="#fff3c4" stop-opacity=".75"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient></defs><rect width="400" height="340" fill="#1d5a3f"/><rect width="400" height="340" fill="url(#zk-sun)"/><g fill="#2f7a4e"><circle cx="40" cy="40" r="90"/><circle cx="170" cy="10" r="80"/><circle cx="300" cy="60" r="70"/><circle cx="395" cy="20" r="70"/></g><g fill="#3f9160" opacity=".85"><circle cx="90" cy="90" r="55"/><circle cx="230" cy="70" r="60"/><circle cx="350" cy="120" r="48"/></g><g fill="#7fbf7a" opacity=".55"><circle cx="130" cy="40" r="26"/><circle cx="270" cy="30" r="22"/><circle cx="60" cy="120" r="18"/><circle cx="330" cy="70" r="16"/></g><path d="M0 300 C90 270 170 285 260 262 C320 248 370 255 400 240 V340 H0Z" fill="#143F2E" opacity=".85"/></svg>
      <div class="zk-hero-copy">
        <h1 id="zk-hero-title">${isEn ? "Shoot it, and the town's today becomes your ZUKAN." : "撮ると、まちの今が図鑑になる。"}</h1>
        <p>${isEn ? "Festivals, morning markets, riverside nature, local work. Your photos pile up by place and date." : "祭り、朝市、川辺の自然、まちの仕事。撮った写真が場所と日付でたまります。"}</p>
      </div>
    </section>
    <div class="zk-cta">
      <a class="zk-btn-primary" href="${prefix}/register">${isEn ? "Sign up (free)" : "新規登録（無料）"}</a>
      <a class="zk-btn-secondary" href="${prefix}/login">${isEn ? "Sign in" : "ログイン"}</a>
      <p class="zk-cta-note">${isEn ? "Photos are visible only to you at first. You choose which places to make public." : "写真は最初、自分だけに見えます。公開する場所は自分で選べます。"}</p>
    </div>
    ${placeRows}
    <nav class="zk-more-links" aria-label="${isEn ? "Explore" : "見てみる"}">
      <a href="${prefix}/community/events">${isEn ? "Nearby events" : "近くのイベントを見る"}</a>
      <a href="${prefix}/map">${isEn ? "Find places on the map" : "地図で場所を探す"}</a>
      <a href="${prefix}/welcome">${isEn ? "New here? A quick tour" : "はじめての方へ（使い方）"}</a>
    </nav>
  `;

  const guestTopV2 = options.guestTopV2 === true && !options.authenticated;
  const guestTopV2Main = guestTopV2 ? renderGuestTopV2Main({ prefix, places: data.placesStrip, lang: options.lang === "ja" ? "ja" : "en" }) : "";

  const oneYearHtml = data.oneYearPair ? renderYearPairCard(data.oneYearPair, isEn, prefix) : "";

  const libraryBodyHtml = data.libraryLoadError
    ? renderZukanErrorState({
        title: isEn ? "Could not load" : "読み込めませんでした",
        message: isEn ? "Failed to load your library. Please try again." : "通信に失敗しました。場所や電波を確かめて、もう一度お試しください。",
        retryHref: `${prefix}/`,
        retryLabel: isEn ? "Try again" : "もう一度"
      })
    : data.libraryGroups.length > 0
      ? renderLibraryGroups(data.libraryGroups, { prefix, isEn, mode: "top" })
        + (data.libraryNextCursor ? `${renderLibraryMore({ href: `${prefix}/library?before=${encodeURIComponent(data.libraryNextCursor)}`, isEn })}${loadMoreScript({ list: ".zk-groups", more: "[data-library-more]", loading: isEn ? "Loading..." : "読み込み中…" })}` : "")
      : renderLibraryEmpty({ prefix, isEn });

  const publishSheetHtml = renderZukanSheet({
    id: "zt-publish-dialog",
    titleId: "zt-popover-title",
    title: isEn ? "Add to ZUKAN" : "図鑑に載せる",
    formId: "zt-publish-form",
    className: "zt-popover",
    bodyHtml: '<div class="zt-popover-thumbs" id="zt-popover-thumbs"></div>',
    actionsHtml: `<div class="zt-popover-actions">
      <button type="submit" class="zt-btn-primary" id="zt-publish-submit">${isEn ? "Add" : "載せる"}</button>
      <button type="button" class="zt-btn-text" id="zt-publish-cancel">${isEn ? "Cancel" : "やめる"}</button>
    </div>`
  });

  const loggedInMain = `
    <h1 class="zt-sr-only">${isEn ? "ZUKAN library" : "ZUKAN ライブラリ"}</h1>
    ${oneYearHtml}
    ${libraryBodyHtml}
    ${publishSheetHtml}
  `;

  const popTitleJs = isEn ? `"Add " + currentPlaceName + " to ZUKAN"` : `currentPlaceName + "の図鑑に載せる"`;
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
            currentPlaceName = openBtn.getAttribute("data-place-name") || "${isEn ? "Places" : "場所"}";
            titleEl.textContent = ${popTitleJs};
            const group = openBtn.closest("[data-group-key]");
            const links = group ? [...group.querySelectorAll("[data-obs-id]")] : [];
            thumbsEl.innerHTML = links.map((a) => {
              const id = a.getAttribute("data-obs-id") || "";
              const img = a.querySelector("img");
              const src = img ? img.getAttribute("src") || "" : "";
              return '<label class="zt-pop-item"><input type="checkbox" name="obsId" value="' + id.replace(/"/g, "&quot;") + '" checked>' + (src ? '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">' : '<span>${isEn ? "Record" : "記録"}</span>') + '</label>';
            }).join("");
            if (typeof dialog.showModal === "function") dialog.showModal();
            else dialog.setAttribute("open", "");
            return;
          }
          const unpubBtn = ev.target.closest("[data-zukan-unpublish]");
          if (unpubBtn) {
            const key = unpubBtn.getAttribute("data-zukan-unpublish") || "";
            const grp = unpubBtn.closest("[data-group-key]");
            const ids = grp ? [...grp.querySelectorAll("[data-obs-id]")].map((el) => el.getAttribute("data-obs-id") || "").filter(Boolean) : [];
            const res = await fetch("/api/v1/zukan-top/unpublish", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ groupKey: key, observationIds: ids })
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
          const openBtn = document.querySelector('[data-zukan-open-popover="' + CSS.escape(currentGroupKey) + '"]');
          const placeId = openBtn ? (openBtn.getAttribute("data-place-id") || null) : null;
          const res = await fetch("/api/v1/zukan-top/publish", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ groupKey: currentGroupKey, placeId, placeName: currentPlaceName, observationIds: ids })
          });
          if (res.ok) location.reload();
        });
      })();
    </script>`
    : "";

  return renderZukanShellDocument({
    lang: options.lang,
    activeNav: "library",
    authenticated: options.authenticated,
    displayName: options.displayName,
    searchAction: options.authenticated ? `${prefix}/` : undefined,
    searchQuery: options.searchQuery,
    pathname: `${prefix}/`,
    homeHref: `${prefix}/`,
    cspNonce: options.cspNonce,
    extraCss: `${ZUKAN_LIBRARY_CSS}${TOP_PAGE_CSS}${guestTopV2 ? GUEST_TOP_V2_CSS : ""}`,
    bodyHtml: options.authenticated ? loggedInMain : guestTopV2 ? guestTopV2Main : loggedOutMain,
    afterShellHtml: `${publishScript}${renderOtayoriFloatingButton({ lang: options.lang, pathname: `${prefix}/` })}`,
    landing: !options.authenticated,
    showSearch: options.authenticated,
    showFeedbackFoot: options.authenticated,
  });
}

const TOP_PAGE_CSS = `
    [hidden]{display:none!important}
    .zt-landing{padding-bottom:24px}
    .zt-landing .zt-main{padding-top:8px;gap:24px}
    .zk-hero{position:relative;display:flex;align-items:flex-end;min-height:min(86vw,340px);margin:0 -20px;overflow:hidden;background:var(--green);color:#fff}
    .zk-hero-art{position:absolute;inset:0;width:100%;height:100%;display:block}
    .zk-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,18,12,.05) 18%,rgba(8,18,12,.72) 100%)}
    .zk-hero-copy{position:relative;z-index:1;padding:0 20px 20px;display:grid;gap:8px}
    .zk-hero-copy h1{margin:0;color:#fff;font-size:30px;line-height:1.35;font-weight:700}
    .zk-hero-copy p{margin:0;color:#fff;font-size:16px;line-height:1.7}
    .zk-cta{display:grid;gap:14px}
    .zk-btn-primary,.zk-btn-primary:visited{min-height:56px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:var(--green);color:#fff;font-size:18px;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(20,63,46,.2)}
    .zk-btn-secondary,.zk-btn-secondary:visited{min-height:56px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#fff;color:var(--green);border:2px solid var(--green);font-size:18px;font-weight:700;text-decoration:none}
    .zk-cta-note{margin:0;text-align:center;color:var(--muted);font-size:15px;line-height:1.7}
    .zk-places{display:grid}
    .zk-place-list{list-style:none;margin:0;padding:0;display:grid}
    .zk-place-list li{border-bottom:1px solid var(--line)}
    .zk-place-row,.zk-place-row:visited{display:grid;grid-template-columns:76px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 0;color:var(--ink);text-decoration:none;min-height:76px}
    .zk-place-row img,.zk-place-ph{width:76px;height:76px;border-radius:16px;object-fit:cover;background:var(--surface-2);display:block}
    .zk-place-ph{display:grid;place-items:center;background:#e3efe6}
    .zk-place-text{display:grid;gap:2px;min-width:0}
    .zk-place-text strong{font-size:19px;line-height:1.4;font-weight:700;overflow-wrap:anywhere}
    .zk-place-text span{font-size:15px;color:var(--muted)}
    .zk-chev{color:var(--control);font-size:28px;line-height:1}
    .zk-more-links{display:flex;flex-wrap:wrap;gap:4px 24px}
    .zk-more-links a,.zk-more-links a:visited{min-height:44px;display:inline-flex;align-items:center;color:var(--link);font-weight:700;font-size:15px;text-decoration:underline}
    @media(min-width:720px){
      .zk-hero{margin:0;border-radius:24px;min-height:360px}
      .zk-hero-copy{padding:0 36px 32px;max-width:640px}
      .zk-hero-copy h1{font-size:38px}
      .zk-cta{grid-template-columns:1fr 1fr;max-width:640px}
      .zk-cta-note{grid-column:1/-1;text-align:left}
    }
    .zt-place-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
    .zt-place-card,.zt-place-card:visited{display:grid;gap:6px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:700}
    .zt-place-card img,.zt-place-fallback{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:var(--surface-2);display:block}
    .zt-thumb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
    .zt-thumb-card,.zt-thumb-card:visited{display:grid;gap:6px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:700}
    .zt-thumb-card img,.zt-thumb-placeholder{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:var(--surface-2);display:block}
    .zt-event-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
    .zt-event-row,.zt-event-row:visited{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;min-height:56px;padding:10px 14px;background:var(--surface);border-radius:14px;text-decoration:none;color:var(--ink)}
    .zt-event-date{font-weight:700;color:var(--green);font-size:14px}
    .zt-event-main{display:grid;gap:2px}
    .zt-event-main span{font-size:14px;color:var(--muted)}
    .zt-btn-primary,.zt-btn-primary:visited{min-height:48px;padding:10px 22px;border-radius:999px;background:var(--green);color:#fff;font-weight:700;text-decoration:none;border:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px}
    .zt-popover{border:1px solid var(--line);border-radius:20px;padding:20px;max-width:420px;width:92vw}
    .zt-popover h2{margin:0;font-size:18px}
    .zt-popover-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .zt-pop-item{display:grid;gap:4px;justify-items:center}
    .zt-pop-item img{width:64px;height:64px;object-fit:cover;border-radius:10px}
    .zt-popover-actions{display:flex;gap:10px;align-items:center}
    .zt-btn-text{min-height:44px;padding:0 12px;border:0;background:transparent;color:var(--muted);font-weight:700;cursor:pointer;font-size:14px}
`;
