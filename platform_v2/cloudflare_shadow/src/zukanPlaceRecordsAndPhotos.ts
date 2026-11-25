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
         o.vernacular_name,
         o.observed_at,
         a.asset_id
       FROM observations o
       LEFT JOIN asset_ledger a
         ON a.observation_id = o.observation_id
        AND a.exif_scrub_state = 'scrubbed'
       WHERE o.place_id = ?
         AND o.visibility = 'public'
       ORDER BY o.observed_at DESC
       LIMIT ?`
    )
    .bind(placeId, safeLimit)
    .all<{
      observation_id: string;
      vernacular_name: string | null;
      observed_at: string | null;
      asset_id: string | null;
    }>();

  const records: PlaceRecordItem[] = [];
  const photos: PlacePhotoItem[] = [];
  const seenObs = new Set<string>();

  for (const row of rows.results ?? []) {
    const taxonName = (row.vernacular_name ?? "").trim() || "観察記録";
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

  const tabsHtml = `<nav class="zt-place-tabs" aria-label="${isEn ? "Place views" : "場所の表示切り替え"}">
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}">${isEn ? "Overview" : "概要"}</a>
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}/records`)}"${
      options.tab === "records" ? ' aria-current="page"' : ""
    }>${isEn ? "Records" : "記録一覧"} (${options.records.length})</a>
    <a class="zt-place-tab" href="${escapeHtml(`${prefix}/places/${encodedPlace}/photos`)}"${
      options.tab === "photos" ? ' aria-current="page"' : ""
    }>${isEn ? "Photos" : "写真一覧"} (${options.photos.length})</a>
  </nav>`;

  const mainContent =
    options.tab === "photos"
      ? options.photos.length > 0
        ? `<div class="zt-lib-grid" data-place-tab="photos">
            ${options.photos
              .map(
                (p) =>
                  `<a class="zt-lib-thumb" href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(p.observationId)}`)}">
                    <img src="${escapeHtml(`/thumb/400/${encodeURIComponent(p.assetId)}`)}" alt="${escapeHtml(p.taxonName)}" loading="lazy">
                  </a>`
              )
              .join("")}
          </div>`
        : `<p data-place-tab="photos">${isEn ? "No public photos at this place yet." : "この場所の公開写真はまだありません。"}</p>`
      : options.records.length > 0
        ? `<ul class="zt-place-record-list" data-place-tab="records">
            ${options.records
              .map(
                (r) =>
                  `<li class="zt-place-record-card">
                    <a href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(r.observationId)}`)}">
                      <strong>${escapeHtml(r.taxonName)}</strong>
                      <span>${escapeHtml(r.observedAt ?? "—")}</span>
                    </a>
                  </li>`
              )
              .join("")}
          </ul>`
        : `<p data-place-tab="records">${isEn ? "No public records at this place yet." : "この場所の公開記録はまだありません。"}</p>`;

  const bodyHtml = `<section class="zt-place-desktop" data-place-view="e2-e4-e5">
    <style>
      .zt-place-desktop{display:grid;gap:16px;min-width:0}
      .zt-place-tabs{display:flex;flex-wrap:wrap;gap:8px}
      .zt-place-tab,.zt-place-tab:visited{min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid #dce3dd;background:#fff;color:#17251b;text-decoration:none;font-weight:700;display:inline-flex;align-items:center}
      .zt-place-tab[aria-current="page"],.zt-place-tab[aria-current="page"]:visited{background:#245c3a;border-color:#245c3a;color:#fff}
      .zt-place-record-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}
      .zt-place-record-card a,.zt-place-record-card a:visited{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:12px 14px;border:1px solid #dce3dd;border-radius:12px;background:#fff;color:#17251b;text-decoration:none}
      @media (min-width:960px){
        .zt-place-desktop-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:20px;align-items:start}
      }
      @media (prefers-reduced-motion:reduce){.zt-place-desktop,.zt-place-desktop *{transition:none!important;animation:none!important}}
    </style>
    <div class="zt-place-desktop-grid">
      <aside class="zt-hub-card">
        <h1>${escapeHtml(options.placeName)}</h1>
        <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?placeId=${encodedPlace}`)}">${
          isEn ? "Record here" : "この場所で記録する"
        }</a>
      </aside>
      <div style="display:grid;gap:14px;min-width:0">
        ${tabsHtml}
        ${mainContent}
      </div>
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
