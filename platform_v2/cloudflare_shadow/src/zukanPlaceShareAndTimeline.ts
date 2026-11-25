import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type FixedPointTimelineFrame = {
  observationId: string;
  assetId: string;
  observedAt: string | null;
  thumbUrl: string;
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

export async function loadPlaceFixedPointFrames(
  placeId: string,
  db: ObsDbLike
): Promise<{ placeName: string; frames: FixedPointTimelineFrame[] } | null> {
  const place = await db
    .prepare("SELECT place_id, canonical_name, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return null;
  }

  const rows = await db
    .prepare(
      `SELECT
         o.observation_id,
         a.asset_id,
         o.observed_at
       FROM record_place_memberships m
       JOIN observations o
         ON o.observation_id = m.record_id
       JOIN asset_ledger a
         ON a.observation_id = o.observation_id
        AND a.exif_scrub_state = 'scrubbed'
WHERE m.place_id = ?
         AND m.membership_state = 'confirmed'
         AND m.public_precision = 'place'
         AND m.removed_at IS NULL
         AND o.visibility = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
       ORDER BY o.observed_at ASC
       LIMIT 60`
    )
    .bind(placeId)
    .all<{ observation_id: string; asset_id: string; observed_at: string | null }>();

  const frames: FixedPointTimelineFrame[] = (rows.results ?? []).map((row) => ({
    observationId: row.observation_id,
    assetId: row.asset_id,
    observedAt: row.observed_at,
    thumbUrl: `/thumb/400/${encodeURIComponent(row.asset_id)}`,
  }));

  return { placeName: place.canonical_name, frames };
}

export async function handlePlaceFixedPointTimelineApi(placeId: string, db: ObsDbLike): Promise<Response> {
  const data = await loadPlaceFixedPointFrames(placeId, db);
  if (!data) {
    return jsonResponse({ ok: false, error: "place_not_found" }, 404);
  }
  return jsonResponse({ ok: true, placeId, frames: data.frames }, 200);
}

export async function handlePlaceTimelinePageRoute(
  placeId: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  db: ObsDbLike
): Promise<Response> {
  const data = await loadPlaceFixedPointFrames(placeId, db);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const encodedPlace = encodeURIComponent(placeId);
  const authenticated = Boolean(session && !session.banned);
  const firstFrame = data.frames[0] ?? null;

  const bodyHtml = `<section class="zt-hub-card" data-place-share-timeline="e12-e13-e1b">
    <style>
      .zt-timeline-grid{display:grid;gap:16px;min-width:0}
      .zt-timeline-stage{display:grid;gap:10px;padding:12px;border:1px solid #dce3dd;border-radius:12px;background:#fff}
      .zt-timeline-stage img{width:100%;max-height:360px;object-fit:cover;border-radius:8px;background:#f6f7f6}
      .zt-timeline-slider{width:100%;min-height:44px;accent-color:#245c3a}
      .zt-place-actions{display:flex;flex-wrap:wrap;gap:10px}
      @media (min-width:960px){
        .zt-timeline-grid{grid-template-columns:minmax(0,1fr) 320px;align-items:start}
      }
      @media (prefers-reduced-motion:reduce){.zt-timeline-grid,.zt-timeline-grid *{transition:none!important;animation:none!important}}
    </style>
    <h1>${escapeHtml(data.placeName)} — ${isEn ? "Timeline & Share" : "定点の時のうつりかわり・共有"}</h1>
    <div class="zt-timeline-grid">
      <div class="zt-timeline-stage">
        ${
          firstFrame
            ? `<img id="place-timeline-img" src="${escapeHtml(firstFrame.thumbUrl)}" alt="${escapeHtml(data.placeName)}">
               <p id="place-timeline-date">${escapeHtml(firstFrame.observedAt ?? "—")}</p>
               <input id="place-timeline-slider" class="zt-timeline-slider" type="range" min="0" max="${Math.max(
                 0,
                 data.frames.length - 1
               )}" value="0" aria-label="${isEn ? "Scrub timeline" : "時間をなぞる"}">`
            : `<p>${isEn ? "No fixed-point photos yet." : "定点写真はまだありません。"}</p>`
        }
      </div>
      <aside class="zt-timeline-stage">
        <div class="zt-place-actions" data-place-share-sheet="e12">
          <button type="button" id="place-share-copy-btn" class="zt-btn-outline">${
            isEn ? "Copy share link" : "この場所のURLをコピー"
          }</button>
        </div>
        <div class="zt-place-actions" data-place-event-entry="e1b">
          <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/community/events/new?placeId=${encodedPlace}`)}">${
            isEn ? "Host an observation event here" : "この場所で観察会を開く"
          }</a>
        </div>
      </aside>
    </div>
  </section>`;

  const pageHtml = renderZukanCommonShell({
    lang,
    title: `${data.placeName} — ${isEn ? "Timeline & Share" : "定点と共有"}`,
    activeNav: "places",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/places/${encodedPlace}/timeline`,
  });

  return new Response(pageHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": authenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
