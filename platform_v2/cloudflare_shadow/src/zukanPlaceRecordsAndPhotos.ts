import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type PlaceRecordItem = {
  observationId: string;
  taxonName: string;
  observedAt: string | null;
  photoAssetId: string | null;
};

export type PlacePhotoItem = {
  observationId: string;
  assetId: string;
  taxonName: string;
};

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

export async function loadPlacePublicRecordsAndPhotos(
  db: ObsDbLike,
  placeId: string,
  limit = 40
): Promise<{ records: PlaceRecordItem[]; photos: PlacePhotoItem[] }> {
  const safeLimit = Math.max(1, Math.min(80, Math.trunc(limit)));
  const rows = await db
    .prepare(
      `SELECT
         o.observation_id,
         o.taxon_label,
         o.observed_at,
         a.asset_id
       FROM record_place_memberships m
       JOIN observations o
         ON o.observation_id = m.record_id
       LEFT JOIN asset_ledger a
         ON a.observation_id = o.observation_id
        AND a.exif_scrub_state = 'scrubbed'
WHERE m.place_id = ?
         AND m.membership_state = 'confirmed'
         AND m.public_precision = 'place'
         AND m.removed_at IS NULL
         AND o.visibility = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
       ORDER BY o.observed_at DESC
       LIMIT ?`
    )
    .bind(placeId, safeLimit)
    .all<{
      observation_id: string;
      taxon_label: string | null;
      observed_at: string | null;
      asset_id: string | null;
    }>();

  const records: PlaceRecordItem[] = [];
  const photos: PlacePhotoItem[] = [];
  const seenObs = new Set<string>();

  for (const row of rows.results ?? []) {
    const taxonName = (row.taxon_label ?? "").trim() || "観察記録";
    if (!seenObs.has(row.observation_id)) {
      seenObs.add(row.observation_id);
      records.push({
        observationId: row.observation_id,
        taxonName,
        observedAt: row.observed_at,
        photoAssetId: row.asset_id,
      });
    }
    if (row.asset_id) {
      photos.push({
        observationId: row.observation_id,
        assetId: row.asset_id,
        taxonName,
      });
    }
  }

  return { records, photos };
}

export function renderPlaceRecordsAndPhotosPage(options: {
  placeId: string;
  placeName: string;
  lang: "ja" | "en" | "es" | "pt-br";
  tab: "records" | "photos";
  authenticated: boolean;
  displayName?: string | null;
  records: PlaceRecordItem[];
  photos: PlacePhotoItem[];
}): string {
  const isEn = options.lang === "en";
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const encodedPlace = encodeURIComponent(options.placeId);

  const shortDate = (value: string | null): string => {
    const time = value ? Date.parse(value) : NaN;
    if (!Number.isFinite(time)) return "";
    return new Intl.DateTimeFormat(isEn ? "en" : "ja", { month: isEn ? "short" : "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(time));
  };
  const chevron = '<svg class="zt-pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const tabsHtml = `<nav class="zt-place-tabs" aria-label="${isEn ? "Place views" : "場所の表示切り替え"}">
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}">${isEn ? "Overview" : "概要"}</a>
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}/records`)}"${
      options.tab === "records" ? ' aria-current="page"' : ""
    }>${isEn ? "Records" : "記録一覧"}</a>
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}/photos`)}"${
      options.tab === "photos" ? ' aria-current="page"' : ""
    }>${isEn ? "Photos" : "写真一覧"}</a>
  </nav>`;

  const mainContent =
    options.tab === "photos"
      ? options.photos.length > 0
        ? `<p class="zt-pl-count">${isEn ? `${options.photos.length} photos` : `写真 ${options.photos.length}枚`}</p>
          <div class="zt-pl-grid" data-place-tab="photos">
            ${options.photos
              .map(
                (p) =>
                  `<a class="zt-pl-cell" href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(p.observationId)}`)}">
                    <img src="${escapeHtml(`/thumb/400/${encodeURIComponent(p.assetId)}`)}" alt="${escapeHtml(p.taxonName)}" loading="lazy" decoding="async">
                  </a>`
              )
              .join("")}
          </div>`
        : `<p class="zt-pl-empty" data-place-tab="photos">${isEn ? "No public photos at this place yet." : "この場所の公開写真はまだありません。"}</p>`
      : options.records.length > 0
        ? `<p class="zt-pl-count">${isEn ? `${options.records.length} records · newest first` : `記録 ${options.records.length}件 ・ 新しい順`}</p>
          <ul class="zt-place-record-list" data-place-tab="records">
            ${options.records
              .map(
                (r) =>
                  `<li class="zt-place-record-card">
                    <a href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(r.observationId)}`)}">
                      <span class="zt-pl-thumb">${r.photoAssetId ? `<img src="${escapeHtml(`/thumb/400/${encodeURIComponent(r.photoAssetId)}`)}" alt="" loading="lazy" decoding="async">` : ""}</span>
                      <span class="zt-pl-body"><strong>${escapeHtml(r.taxonName)}</strong><small>${escapeHtml(shortDate(r.observedAt) || "—")}</small></span>
                      ${chevron}
                    </a>
                  </li>`
              )
              .join("")}
          </ul>`
        : `<p class="zt-pl-empty" data-place-tab="records">${isEn ? "No public records at this place yet." : "この場所の公開記録はまだありません。"}</p>`;

  const bodyHtml = `<section class="zt-place-desktop" data-place-view="e2-e4-e5">
    <style>
      .zt-place-desktop{display:grid;gap:12px;min-width:0;max-width:1120px;margin:0 auto}
      .zt-place-desktop svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .zt-pl-head{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;min-height:56px}
      .zt-pl-head h1{margin:0;text-align:center;font-size:1.25rem;line-height:1.4;overflow-wrap:anywhere}
      .zt-pl-back,.zt-pl-back:visited{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:#17251b}
      .zt-place-tabs{display:flex;flex-wrap:wrap;gap:8px}
      .zt-place-tab,.zt-place-tab:visited{min-height:44px;padding:8px 16px;border-radius:999px;border:1px solid #dce3dd;background:#fff;color:#17251b;text-decoration:none;font-weight:700;display:inline-flex;align-items:center}
      .zt-place-tab[aria-current="page"],.zt-place-tab[aria-current="page"]:visited{background:#143F2E;border-color:#143F2E;color:#fff}
      .zt-pl-count{margin:4px 0 0;color:#55615a;font-size:1rem}
      .zt-place-record-list{margin:0;padding:0;list-style:none;display:grid}
      .zt-place-record-card a,.zt-place-record-card a:visited{display:flex;align-items:center;gap:14px;min-height:76px;padding:12px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
      .zt-pl-thumb{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden;background:#eef1ed}.zt-pl-thumb img{display:block;width:100%;height:100%;object-fit:cover}
      .zt-pl-body{flex:1;min-width:0}.zt-pl-body strong{display:block;font-size:1.0625rem;line-height:1.4;overflow-wrap:anywhere}.zt-pl-body small{display:block;margin-top:2px;font-size:.9375rem;color:#55615a}
      .zt-pl-chev{flex:none;width:20px;height:20px;color:#8a948d}
      .zt-pl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.zt-pl-cell{display:block;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#eef1ed}.zt-pl-cell img{display:block;width:100%;height:100%;object-fit:cover}
      .zt-pl-empty{margin:8px 0;padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;text-align:center;color:#55615a}
      .zt-place-side{display:none}
      .zt-place-side .zt-btn-capture,.zt-place-side .zt-btn-capture:visited{background:#143F2E;border-color:#143F2E;color:#fff;border-radius:16px;min-height:52px}
      .zt-place-side .zt-btn-outline{border-radius:16px;min-height:52px}
      @media (min-width:960px){
        .zt-place-desktop-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:32px;align-items:start}
        .zt-place-side{display:grid;gap:12px;border-left:1px solid #dde2dc;padding-left:24px}
        .zt-place-side h2{margin:0;font-size:1.0625rem}
        .zt-pl-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
      @media (prefers-reduced-motion:reduce){.zt-place-desktop,.zt-place-desktop *{transition:none!important;animation:none!important}}
    </style>
    <header class="zt-pl-head">
      <a class="zt-pl-back" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}" aria-label="${isEn ? "Back to the place" : "場所に戻る"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></a>
      <h1>${escapeHtml(options.placeName)}</h1>
      <span></span>
    </header>
    <div class="zt-place-desktop-grid">
      <div style="display:grid;gap:12px;min-width:0;align-content:start">
        ${tabsHtml}
        ${mainContent}
      </div>
      <aside class="zt-place-side">
        <h2>${isEn ? "About this place" : "場所について"}</h2>
        <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?placeId=${encodedPlace}`)}">${
          isEn ? "Record here" : "この場所で記録する"
        }</a>
        <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}">${isEn ? "Open the place page" : "場所のページを開く"}</a>
      </aside>
    </div>
  </section>`;

  return renderZukanCommonShell({
    lang: options.lang,
    title: `${options.placeName} — ${options.tab === "photos" ? (isEn ? "Photos" : "写真一覧") : isEn ? "Records" : "記録一覧"}`,
    activeNav: "places",
    authenticated: options.authenticated,
    displayName: options.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/places/${encodedPlace}/${options.tab}`,
  });
}

export async function handlePlaceRecordsOrPhotosRoute(
  placeId: string,
  tab: "records" | "photos",
  lang: "ja" | "en" | "es" | "pt-br",
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  db: ObsDbLike
): Promise<Response> {
  const place = await db
    .prepare("SELECT place_id, canonical_name, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return new Response("Not found", { status: 404 });
  }

  const { records, photos } = await loadPlacePublicRecordsAndPhotos(db, place.place_id, 40);
  const authenticated = Boolean(session && !session.banned);
  const pageHtml = renderPlaceRecordsAndPhotosPage({
    placeId: place.place_id,
    placeName: place.canonical_name,
    lang,
    tab,
    authenticated,
    displayName: session?.displayName ?? null,
    records,
    photos,
  });

  return new Response(pageHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": authenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
