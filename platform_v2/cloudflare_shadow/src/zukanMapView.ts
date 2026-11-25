import type { Env } from "./core/env";
import { escapeHtml, finiteNumberOrNull, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type PlacePinRow = {
  place_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

function parseOptionalCoordParam(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === "") return null;
  return finiteNumberOrNull(raw);
}

async function queryPublicPlacesInBounds(url: URL, db: Env["OBS_DB"]) {
  const minLat = parseOptionalCoordParam(url, "minLat");
  const maxLat = parseOptionalCoordParam(url, "maxLat");
  const minLng = parseOptionalCoordParam(url, "minLng");
  const maxLng = parseOptionalCoordParam(url, "maxLng");

  const base = `SELECT p.place_id AS place_id,
            p.canonical_name AS name,
            (b.bbox_south + b.bbox_north) / 2.0 AS lat,
            (b.bbox_west + b.bbox_east) / 2.0 AS lng
       FROM places p
       JOIN place_boundaries b
         ON b.boundary_id = (
              SELECT b2.boundary_id
                FROM place_boundaries b2
               WHERE b2.place_id = p.place_id
                 AND b2.valid_to IS NULL
                 AND b2.superseded_by_boundary_id IS NULL
                 AND b2.bbox_south IS NOT NULL AND b2.bbox_north IS NOT NULL
                 AND b2.bbox_west IS NOT NULL AND b2.bbox_east IS NOT NULL
               ORDER BY b2.is_primary DESC, b2.boundary_version DESC
               LIMIT 1)
      WHERE p.public_profile_status = 'published'
        AND p.superseded_by_place_id IS NULL`;
  let rows: PlacePinRow[] = [];
  try {
    rows =
      minLat !== null && maxLat !== null && minLng !== null && maxLng !== null
        ? (
            await db
              .prepare(
                `${base}
                  AND (b.bbox_south + b.bbox_north) / 2.0 BETWEEN ? AND ?
                  AND (b.bbox_west + b.bbox_east) / 2.0 BETWEEN ? AND ?
                LIMIT 100`
              )
              .bind(minLat, maxLat, minLng, maxLng)
              .all<PlacePinRow>()
          ).results ?? []
        : (await db.prepare(`${base} LIMIT 100`).all<PlacePinRow>()).results ?? [];
  } catch (error) {
    console.error("map places query failed", error);
    rows = [];
  }

  return rows.map((row) => ({
    placeId: row.place_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
  }));
}

export async function handleMapPlacesBoundsApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const places = await queryPublicPlacesInBounds(url, db);
  return json({ ok: true, places }, 200, { "cache-control": "no-store" });
}

export async function handleMapExploreRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const places = await queryPublicPlacesInBounds(url, db);
  const selectedId = url.searchParams.get("placeId") ?? places[0]?.placeId ?? null;
  const selected = places.find((p) => p.placeId === selectedId) ?? places[0] ?? null;

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const pinsListHtml = places
    .map(
      (p) => `<button type="button" class="zm-pin-btn" data-place-id="${escapeHtml(p.placeId)}" data-place-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>`
    )
    .join("");

  const selectedHtml = selected
    ? `<section class="zt-hub-card" id="zukan-map-selected-card" data-selected-place="${escapeHtml(selected.placeId)}">
        <h2 id="zm-sel-title">${escapeHtml(selected.name)}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <a id="zm-sel-link" class="zt-btn-outline" href="${escapeHtml(`${prefix}/places/${encodeURIComponent(selected.placeId)}`)}">${isEn ? "Open place" : "この場所を見る"}</a>
          <a id="zm-sel-capture" class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?placeId=${encodeURIComponent(selected.placeId)}`)}">${isEn ? "Capture here" : "ここで撮る"}</a>
        </div>
      </section>`
    : `<section class="zt-hub-card" id="zukan-map-selected-card"><p>${isEn ? "Select a place pin on the map." : "地図上の場所を選ぶと詳細が出ます。"}</p></section>`;

  const bodyHtml = `<style>
    .zm-wrap{display:grid;gap:16px}
    .zm-canvas{min-height:320px;border-radius:14px;border:1px solid var(--line);background:var(--surface);padding:14px;display:grid;gap:10px;align-content:start}
    .zm-pins{display:flex;flex-wrap:wrap;gap:8px}
    .zm-pin-btn{min-height:44px;padding:6px 12px;border-radius:999px;border:1px solid var(--green);background:#fff;color:var(--green);font:inherit;font-weight:700;cursor:pointer}
    @media(min-width:960px){.zm-wrap{grid-template-columns:1.6fr 1fr;align-items:start}.zm-canvas{min-height:480px}}
  </style>
  <div class="zm-wrap" data-map-view="g1-g3">
    <div id="zukan-maplibre-canvas" class="zm-canvas" data-maplibre-ready="1">
      <p style="margin:0;color:var(--muted);font-size:14px;">${isEn ? "MapLibre public places" : "マップ（公開場所）"}</p>
      <div class="zm-pins">${pinsListHtml}</div>
    </div>
    ${selectedHtml}
  </div>
  <script>
    (() => {
      const prefix = ${JSON.stringify(prefix)};
      document.querySelectorAll(".zm-pin-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-place-id");
          const name = btn.getAttribute("data-place-name");
          if (!id || !name) return;
          const title = document.getElementById("zm-sel-title");
          const link = document.getElementById("zm-sel-link");
          const cap = document.getElementById("zm-sel-capture");
          if (title) title.textContent = name;
          if (link) link.setAttribute("href", prefix + "/places/" + encodeURIComponent(id));
          if (cap) cap.setAttribute("href", prefix + "/record?placeId=" + encodeURIComponent(id));
        });
      });
    })();
  </script>`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Map" : "マップ",
    activeNav: "places",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/map/explore`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
