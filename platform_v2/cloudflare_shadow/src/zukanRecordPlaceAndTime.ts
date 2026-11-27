import { normalizePlaceSearchText } from "../../src/services/placeDomain";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ALLOWED_PLACE_KINDS = new Set([
  "park",
  "wetland",
  "forest",
  "river",
  "coast",
  "other_named_area",
]);

type D1PlaceDb = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const ZUKAN_RECORD_PLACE_TIME_STYLES = `
  .zt-place-time-card{display:grid;gap:12px;margin:0 0 12px;padding:16px;border:1px solid var(--line);border-radius:16px;background:#fff;min-width:0}
  .zt-place-time-card h2{margin:0;font-size:17px;font-weight:700}
  .zt-place-search-row{display:flex;flex-wrap:wrap;gap:8px;min-width:0}
  .zt-place-search-row input{flex:1;min-width:160px;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);font:inherit}
  .zt-place-btn{min-height:48px;padding:8px 16px;border-radius:14px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
  .zt-place-btn.is-primary{background:var(--teal);color:#fff}
  .zt-nearby-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
  .zt-nearby-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border:0;border-bottom:1px solid var(--line);background:transparent;min-width:0}
  .zt-nearby-item button{min-height:44px;padding:6px 12px;border-radius:14px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}
  .zt-new-place-box{display:grid;gap:8px;padding-top:8px;border-top:1px dashed var(--line)}
  .zt-datetime-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .zt-datetime-row input{min-height:48px;padding:8px 12px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);font:inherit}
  @media (prefers-reduced-motion:reduce){
    .zt-place-time-card,.zt-place-time-card *{transition:none!important;animation:none!important}
  }
`;

export function renderRecordPlaceAndTimeHtml(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  initialPlaceId: string;
  initialPlaceName?: string | null;
  defaultObservedAtLocal: string;
}): string {
  const isEn = options.lang === "en";
  return `<section class="zt-place-time-card" data-record-place-time="c4-c5-c6">
    <h2>${isEn ? "Place & Date/Time" : "場所と日時"}</h2>
    <input type="hidden" name="placeId" id="record-place-id" value="${escapeHtml(options.initialPlaceId)}">
    <p id="record-selected-place-label" class="zt-voice-status">${
      options.initialPlaceId
        ? `${isEn ? "Selected place" : "選んだ場所"}: ${escapeHtml(options.initialPlaceName || options.initialPlaceId)}`
        : isEn
          ? "No place selected yet."
          : "まだ場所を選んでいません。"
    }</p>
    <div class="zt-place-search-row">
      <input type="search" id="record-place-query" placeholder="${isEn ? "Search park or area" : "公園や場所の名前で探す"}" aria-label="${isEn ? "Search place" : "場所を探す"}">
      <button type="button" id="record-find-nearby-places" class="zt-place-btn">${isEn ? "Nearby places" : "近くの場所を探す"}</button>
    </div>
    <ul id="record-nearby-places-list" class="zt-nearby-list" aria-live="polite"></ul>
    <details class="zt-new-place-box">
      <summary>${isEn ? "Create a new place" : "新しい場所をつくる"}</summary>
      <div class="zt-place-search-row">
        <input type="text" id="record-new-place-name" maxlength="80" placeholder="${isEn ? "Place name (e.g. Back pond)" : "場所の名前（例: 裏庭の池）"}" aria-label="${isEn ? "New place name" : "新しい場所の名前"}">
        <input type="text" id="record-new-place-locality" maxlength="80" placeholder="${isEn ? "Area / City (optional)" : "地域（任意）"}" aria-label="${isEn ? "Locality" : "地域"}">
        <button type="button" id="record-create-place-btn" class="zt-place-btn is-primary">${isEn ? "Save place" : "この場所を登録"}</button>
      </div>
    </details>
    <div class="zt-datetime-row">
      <label class="cf-record-field" style="margin:0;flex:1;min-width:200px">
        <span>${isEn ? "Observed date & time" : "観察した日時"}</span>
        <input type="datetime-local" name="observedAtLocal" id="record-observed-at" value="${escapeHtml(options.defaultObservedAtLocal)}">
      </label>
      <button type="button" id="record-observed-at-now" class="zt-place-btn">${isEn ? "Set to now" : "いまの時刻にする"}</button>
    </div>
  </section>`;
}

export const ZUKAN_RECORD_PLACE_TIME_SCRIPT = `
  (() => {
    const placeIdInput = document.getElementById("record-place-id");
    const placeLabel = document.getElementById("record-selected-place-label");
    const placeQuery = document.getElementById("record-place-query");
    const nearbyBtn = document.getElementById("record-find-nearby-places");
    const nearbyList = document.getElementById("record-nearby-places-list");
    const newPlaceName = document.getElementById("record-new-place-name");
    const newPlaceLocality = document.getElementById("record-new-place-locality");
    const createPlaceBtn = document.getElementById("record-create-place-btn");
    const observedAtInput = document.getElementById("record-observed-at");
    const observedAtNowBtn = document.getElementById("record-observed-at-now");

    function selectPlace(id, name) {
      if (placeIdInput) placeIdInput.value = id;
      if (placeLabel) placeLabel.textContent = "選んだ場所: " + name;
    }

    if (nearbyBtn && nearbyList) {
      nearbyBtn.addEventListener("click", async () => {
        const latInput = document.querySelector('input[name="latitude"]');
        const lngInput = document.querySelector('input[name="longitude"]');
        const params = new URLSearchParams();
        if (placeQuery && placeQuery.value.trim()) params.set("q", placeQuery.value.trim());
        if (latInput && latInput.value.trim()) params.set("lat", latInput.value.trim());
        if (lngInput && lngInput.value.trim()) params.set("lng", lngInput.value.trim());
        nearbyList.textContent = "";
        const resp = await fetch("/api/v1/record/places/nearby?" + params.toString());
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data || !Array.isArray(data.places) || data.places.length === 0) {
          const li = document.createElement("li");
          li.className = "zt-nearby-item";
          li.textContent = "近くの場所が見つかりませんでした。";
          nearbyList.appendChild(li);
          return;
        }
        for (const p of data.places) {
          const li = document.createElement("li");
          li.className = "zt-nearby-item";
          const span = document.createElement("span");
          span.textContent = p.localityLabel ? p.name + "（" + p.localityLabel + "）" : p.name;
          const pick = document.createElement("button");
          pick.type = "button";
          pick.textContent = "ここを選ぶ";
          pick.addEventListener("click", () => selectPlace(p.placeId, p.name));
          li.appendChild(span);
          li.appendChild(pick);
          nearbyList.appendChild(li);
        }
      });
    }

    if (createPlaceBtn && newPlaceName) {
      createPlaceBtn.addEventListener("click", async () => {
        const name = newPlaceName.value.trim();
        if (!name) return;
        const resp = await fetch("/api/v1/record/places", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            localityLabel: newPlaceLocality ? newPlaceLocality.value.trim() : ""
          })
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && data.place) {
          selectPlace(data.place.placeId, data.place.name);
          newPlaceName.value = "";
          if (newPlaceLocality) newPlaceLocality.value = "";
        }
      });
    }

    if (observedAtNowBtn && observedAtInput) {
      observedAtNowBtn.addEventListener("click", () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        observedAtInput.value =
          now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
          "T" + pad(now.getHours()) + ":" + pad(now.getMinutes());
      });
    }
  })();
`;

export async function handleSearchNearbyRecordPlaces(url: URL, db: D1PlaceDb): Promise<Response> {
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const q = (url.searchParams.get("q") ?? "").trim();

  let lat: number | null = null;
  let lng: number | null = null;
  if (latRaw !== null && latRaw !== "" || lngRaw !== null && lngRaw !== "") {
    lat = Number(latRaw);
    lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return jsonResponse({ ok: false, error: "invalid_coordinates" }, 400);
    }
  }

  const normalized = normalizePlaceSearchText(q);
  const likePattern = normalized ? `%${normalized}%` : "%";
  const rows = await db
    .prepare(
      `SELECT
        p.place_id,
        p.canonical_name,
        p.locality_label,
        p.place_kind,
        b.bbox_west,
        b.bbox_east,
        b.bbox_south,
        b.bbox_north
       FROM places p
       LEFT JOIN place_boundaries b
         ON b.place_id = p.place_id
        AND b.is_primary = 1
        AND b.valid_to IS NULL
        AND b.superseded_by_boundary_id IS NULL
       WHERE p.superseded_by_place_id IS NULL
         AND p.public_profile_status != 'private'
         AND (? = '%' OR p.canonical_name_normalized LIKE ?)
       LIMIT 30`
    )
    .bind(likePattern, likePattern)
    .all<{
      place_id: string;
      canonical_name: string;
      locality_label: string | null;
      place_kind: string;
      bbox_west: number | null;
      bbox_east: number | null;
      bbox_south: number | null;
      bbox_north: number | null;
    }>();

  const list = (rows.results ?? []).map((row) => {
    let distanceKm: number | undefined;
    if (
      lat !== null &&
      lng !== null &&
      row.bbox_west !== null &&
      row.bbox_east !== null &&
      row.bbox_south !== null &&
      row.bbox_north !== null
    ) {
      const centerLat = (row.bbox_south + row.bbox_north) / 2;
      const centerLng = (row.bbox_west + row.bbox_east) / 2;
      distanceKm = Math.round(haversineKm(lat, lng, centerLat, centerLng) * 10) / 10;
    }
    return {
      placeId: row.place_id,
      name: row.canonical_name,
      localityLabel: row.locality_label,
      placeKind: row.place_kind,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
    };
  });

  if (lat !== null && lng !== null) {
    list.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }

  return jsonResponse({ ok: true, places: list.slice(0, 10) }, 200);
}

export async function handleCreateRecordPlace(
  request: Request,
  userId: string,
  db: D1PlaceDb
): Promise<Response> {
  const payload = await request.json().catch(() => null) as {
    name?: unknown;
    localityLabel?: unknown;
    placeKind?: unknown;
  } | null;

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return jsonResponse({ ok: false, error: "invalid_place_name" }, 400);
  }
  const localityLabel =
    typeof payload?.localityLabel === "string" && payload.localityLabel.trim()
      ? payload.localityLabel.trim().slice(0, 80)
      : null;
  const placeKind =
    typeof payload?.placeKind === "string" && ALLOWED_PLACE_KINDS.has(payload.placeKind)
      ? payload.placeKind
      : "other_named_area";

  const placeId = `place_user_${crypto.randomUUID()}`;
  const normalized = normalizePlaceSearchText(name);
  const metadataJson = JSON.stringify({ createdBy: userId });

  await db
    .prepare(
      `INSERT INTO places (
        place_id,
        canonical_name,
        canonical_name_normalized,
        locality_label,
        place_kind,
        verification_status,
        public_profile_status,
        official_status,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, 'unverified', 'private', 'unofficial', ?)`
    )
    .bind(placeId, name, normalized, localityLabel, placeKind, metadataJson)
    .run();

  return jsonResponse(
    {
      ok: true,
      place: {
        placeId,
        name,
        localityLabel,
        placeKind,
      },
    },
    201
  );
}
