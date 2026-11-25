import type { Env } from "./core/env";
import { escapeHtml, finiteNumberOrNull, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type PlacePinRow = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
};

function parseOptionalNumber(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === "") {
    return null;
  }
  return finiteNumberOrNull(raw);
}

async function queryFilteredPins(url: URL, db: Env["OBS_DB"]) {
  const minLat = parseOptionalNumber(url, "minLat");
  const maxLat = parseOptionalNumber(url, "maxLat");
  const minLng = parseOptionalNumber(url, "minLng");
  const maxLng = parseOptionalNumber(url, "maxLng");
  const hasBounds = minLat !== null && maxLat !== null && minLng !== null && maxLng !== null;

  const rows = hasBounds
    ? (
        await db
          .prepare(
            `SELECT place_id, name, lat, lng
               FROM places
              WHERE visibility = 'public'
                AND lat BETWEEN ? AND ?
                AND lng BETWEEN ? AND ?
              ORDER BY name ASC
              LIMIT 100`
          )
          .bind(minLat, maxLat, minLng, maxLng)
          .all<PlacePinRow>()
      ).results
    : (
        await db
          .prepare(
            `SELECT place_id, name, lat, lng
               FROM places
              WHERE visibility = 'public'
                AND lat IS NOT NULL
                AND lng IS NOT NULL
              ORDER BY name ASC
              LIMIT 100`
          )
          .all<PlacePinRow>()
      ).results;

  return rows.map((row) => ({
    placeId: row.place_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    thumbUrl: `/api/v1/places/${encodeURIComponent(row.place_id)}/thumb`,
  }));
}

export async function handleMapFilteredPinsApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const pins = await queryFilteredPins(url, db);
  return json({ ok: true, pins });
}

export async function handleMapFiltersRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const filter = url.searchParams.get("filter") ?? "all";
  const geoDenied = url.searchParams.get("geo") === "denied";
  const pins = await queryFilteredPins(url, db);

  const filterChips = [
    { key: "all", label: "すべて" },
    { key: "photo", label: "写真あり" },
    { key: "spring", label: "春" },
    { key: "summer", label: "夏" },
    { key: "autumn", label: "秋" },
    { key: "winter", label: "冬" },
  ]
    .map((c) => {
      const active = c.key === filter;
      return `<a class="zt-map-chip${active ? " is-active" : ""}" href="/${lang}/map/filters?filter=${c.key}${geoDenied ? "&amp;geo=denied" : ""}"${active ? ' aria-current="true"' : ""}>${c.label}</a>`;
    })
    .join("");

  const pinItems = pins
    .map(
      (pin) => `<a class="zt-map-photo-pin" href="/${lang}/places/${encodeURIComponent(pin.placeId)}">
        <span class="zt-map-pin-thumb" aria-hidden="true"></span>
        <span class="zt-map-pin-name">${escapeHtml(pin.name)}</span>
      </a>`
    )
    .join("");

  const body = `<style>
    .zt-map-filters-wrap{position:relative;display:grid;gap:12px;padding:12px 0 84px}
    .zt-map-chip-bar{display:flex;flex-wrap:wrap;gap:8px}
    .zt-map-chip,.zt-map-chip:visited{min-height:36px;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-size:13px;font-weight:700;display:inline-flex;align-items:center}
    .zt-map-chip.is-active,.zt-map-chip.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-map-geo-banner{padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);display:grid;gap:6px}
    .zt-map-stage{position:relative;min-height:360px;border:1px solid var(--line);border-radius:14px;background:#eef4ef;padding:14px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:10px}
    .zt-map-photo-pin,.zt-map-photo-pin:visited{display:inline-flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:999px;border:2px solid #fff;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);color:var(--ink);text-decoration:none;font-size:13px;font-weight:700}
    .zt-map-pin-thumb{width:28px;height:28px;border-radius:50%;background:var(--green);flex:none}
    .zt-map-controls{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;align-items:center}
    .zt-map-feedback-btn,.zt-map-feedback-btn:visited{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .zt-map-locate-btn{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--green);font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  </style>
  <section class="zt-map-filters-wrap" data-map-view="g4-g6" data-map-filter="${escapeHtml(filter)}"${geoDenied ? ' data-map-geo-denied="1"' : ""}>
    <nav class="zt-map-chip-bar" aria-label="マップ絞り込み">${filterChips}</nav>
    ${
      geoDenied
        ? `<div class="zt-map-geo-banner" role="status">
            <strong>位置情報がオフになっています</strong>
            <span>現在地が使えないため、公開されている観察場所を表示しています。</span>
          </div>`
        : ""
    }
    <div class="zt-map-stage">
      ${pinItems || `<p>表示できる場所がありません。</p>`}
      <div class="zt-map-controls">
        <a class="zt-map-feedback-btn" href="/${lang}/otayori?from=%2F${lang}%2Fmap%2Ffilters" aria-label="改善のご要望">？</a>
        <button class="zt-map-locate-btn" type="button" aria-label="現在地へ移動">◎</button>
      </div>
    </div>
  </section>`;

  const html = renderZukanCommonShell({
    title: "マップ絞り込み | ikimon",
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
