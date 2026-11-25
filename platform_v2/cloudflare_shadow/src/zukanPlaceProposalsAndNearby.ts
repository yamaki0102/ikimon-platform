import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ALLOWED_PROPOSAL_FIELDS = new Set(["public_summary", "locality_label", "canonical_name"]);

export type PlaceEditProposal = {
  proposalId: string;
  placeId: string;
  proposerUserId: string;
  field: "public_summary" | "locality_label" | "canonical_name";
  proposedValue: string;
  reason: string;
  status: "pending";
  createdAt: string;
};

export type NearbyPlaceItem = {
  placeId: string;
  name: string;
  localityLabel: string | null;
  distanceKm?: number;
};

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

type EnvLike = {
  OBS_DB: ObsDbLike;
  ASSET_BUCKET?: {
    get(key: string): Promise<{ body: ReadableStream | null } | null>;
    put(key: string, value: string, options?: unknown): Promise<unknown>;
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

function proposalKey(placeId: string): string {
  return `place-proposals/${encodeURIComponent(placeId)}.json`;
}

export async function loadNearbyPlacesForPlace(
  placeId: string,
  db: ObsDbLike
): Promise<{ placeName: string; places: NearbyPlaceItem[] } | null> {
  const target = await db
    .prepare("SELECT place_id, canonical_name, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_profile_status: string }>();

  if (!target || target.public_profile_status === "private") {
    return null;
  }

  const bbox = await db
    .prepare(
      `SELECT bbox_west, bbox_east, bbox_south, bbox_north
       FROM place_boundaries
       WHERE place_id = ? AND is_primary = 1 AND valid_to IS NULL AND superseded_by_boundary_id IS NULL`
    )
    .bind(placeId)
    .first<{ bbox_west: number | null; bbox_east: number | null; bbox_south: number | null; bbox_north: number | null }>();

  const hasCenter =
    bbox &&
    bbox.bbox_west !== null &&
    bbox.bbox_east !== null &&
    bbox.bbox_south !== null &&
    bbox.bbox_north !== null;
  const centerLat = hasCenter ? (bbox.bbox_south! + bbox.bbox_north!) / 2 : null;
  const centerLng = hasCenter ? (bbox.bbox_west! + bbox.bbox_east!) / 2 : null;

  const others = await db
    .prepare(
      `SELECT
         p.place_id,
         p.canonical_name,
         p.locality_label,
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
       WHERE p.place_id != ?
         AND p.superseded_by_place_id IS NULL
         AND p.public_profile_status != 'private'
       LIMIT 30`
    )
    .bind(placeId)
    .all<{
      place_id: string;
      canonical_name: string;
      locality_label: string | null;
      bbox_west: number | null;
      bbox_east: number | null;
      bbox_south: number | null;
      bbox_north: number | null;
    }>();

  const places: NearbyPlaceItem[] = (others.results ?? []).map((row) => {
    let distanceKm: number | undefined;
    if (
      centerLat !== null &&
      centerLng !== null &&
      row.bbox_west !== null &&
      row.bbox_east !== null &&
      row.bbox_south !== null &&
      row.bbox_north !== null
    ) {
      const lat = (row.bbox_south + row.bbox_north) / 2;
      const lng = (row.bbox_west + row.bbox_east) / 2;
      distanceKm = Math.round(haversineKm(centerLat, centerLng, lat, lng) * 10) / 10;
    }
    return {
      placeId: row.place_id,
      name: row.canonical_name,
      localityLabel: row.locality_label,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
    };
  });

  if (centerLat !== null && centerLng !== null) {
    places.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
  }

  return { placeName: target.canonical_name, places: places.slice(0, 12) };
}

export async function handlePlaceNearbyApi(placeId: string, db: ObsDbLike): Promise<Response> {
  const result = await loadNearbyPlacesForPlace(placeId, db);
  if (!result) {
    return jsonResponse({ ok: false, error: "place_not_found" }, 404);
  }
  return jsonResponse({ ok: true, placeId, places: result.places }, 200);
}

export async function handleCreatePlaceProposal(
  placeId: string,
  request: Request,
  session: { userId: string; banned?: boolean } | null,
  env: EnvLike
): Promise<Response> {
  if (!session || session.banned) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const place = await env.OBS_DB
    .prepare("SELECT place_id, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return jsonResponse({ ok: false, error: "place_not_found" }, 404);
  }

  const payload = await request.json().catch(() => null) as {
    field?: unknown;
    proposedValue?: unknown;
    reason?: unknown;
  } | null;

  const field =
    typeof payload?.field === "string" && ALLOWED_PROPOSAL_FIELDS.has(payload.field)
      ? (payload.field as "public_summary" | "locality_label" | "canonical_name")
      : null;
  const proposedValue = typeof payload?.proposedValue === "string" ? payload.proposedValue.trim().slice(0, 500) : "";
  const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 160) : "";

  if (!field || !proposedValue) {
    return jsonResponse({ ok: false, error: "invalid_proposal_payload" }, 400);
  }

  const proposal: PlaceEditProposal = {
    proposalId: `prop_${crypto.randomUUID()}`,
    placeId,
    proposerUserId: session.userId,
    field,
    proposedValue,
    reason,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (env.ASSET_BUCKET) {
    const existingObj = await env.ASSET_BUCKET.get(proposalKey(placeId)).catch(() => null);
    const existing = existingObj?.body
      ? ((await new Response(existingObj.body).json().catch(() => [])) as PlaceEditProposal[])
      : [];
    const list = Array.isArray(existing) ? [...existing, proposal] : [proposal];
    await env.ASSET_BUCKET.put(proposalKey(placeId), JSON.stringify(list), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return jsonResponse({ ok: true, proposal }, 201);
}

export async function handlePlaceProposeOrNearbyRoute(
  placeId: string,
  tab: "propose" | "nearby",
  lang: "ja" | "en" | "es" | "pt-br",
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  db: ObsDbLike
): Promise<Response> {
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const encodedPlace = encodeURIComponent(placeId);
  const authenticated = Boolean(session && !session.banned);

  if (tab === "nearby") {
    const data = await loadNearbyPlacesForPlace(placeId, db);
    if (!data) return new Response("Not found", { status: 404 });
    const bodyHtml = `<section class="zt-hub-card" data-place-nearby="e10">
      <h1>${escapeHtml(data.placeName)} — ${isEn ? "Nearby places" : "近くの場所"}</h1>
      ${
        data.places.length > 0
          ? `<ul style="margin:0;padding:0;list-style:none;display:grid;gap:8px">
              ${data.places
                .map(
                  (p) =>
                    `<li class="zt-hub-dest"><a href="${escapeHtml(`${prefix}/places/${encodeURIComponent(p.placeId)}`)}">
                      <strong>${escapeHtml(p.name)}</strong>
                      <span>${escapeHtml(p.localityLabel ?? "")}${p.distanceKm !== undefined ? ` (${p.distanceKm} km)` : ""}</span>
                    </a></li>`
                )
                .join("")}
            </ul>`
          : `<p>${isEn ? "No nearby places found." : "近くの場所が見つかりませんでした。"}</p>`
      }
    </section>`;

    return new Response(
      renderZukanCommonShell({
        lang,
        title: `${data.placeName} — ${isEn ? "Nearby places" : "近くの場所"}`,
        activeNav: "places",
        authenticated,
        displayName: session?.displayName ?? null,
        bodyHtml,
        pathname: `${prefix}/places/${encodedPlace}/nearby`,
      }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const place = await db
    .prepare("SELECT place_id, canonical_name, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return new Response("Not found", { status: 404 });
  }

  const bodyHtml = `<section class="zt-hub-card" data-place-propose="e9">
    <h1>${escapeHtml(place.canonical_name)} — ${isEn ? "Suggest an edit" : "場所情報の編集提案"}</h1>
    ${
      authenticated
        ? `<form id="place-propose-form" style="display:grid;gap:10px">
            <label style="display:grid;gap:4px"><span>${isEn ? "Field" : "項目"}</span>
              <select name="field" style="min-height:44px;padding:8px">
                <option value="public_summary">${isEn ? "Description" : "場所の紹介文"}</option>
                <option value="locality_label">${isEn ? "Area" : "地域名"}</option>
                <option value="canonical_name">${isEn ? "Place name" : "場所の名前"}</option>
              </select>
            </label>
            <label style="display:grid;gap:4px"><span>${isEn ? "Suggested text" : "提案する内容"}</span>
              <textarea name="proposedValue" rows="3" maxlength="500" style="padding:8px"></textarea>
            </label>
            <label style="display:grid;gap:4px"><span>${isEn ? "Reason (optional)" : "理由（任意）"}</span>
              <input type="text" name="reason" maxlength="160" style="min-height:44px;padding:8px">
            </label>
            <button type="submit" class="zt-btn-capture">${isEn ? "Submit suggestion" : "編集を提案する"}</button>
          </form>`
        : `<p><a class="zt-btn-outline" href="${escapeHtml(`${prefix}/login`)}">${
            isEn ? "Sign in to suggest an edit" : "ログインして編集を提案する"
          }</a></p>`
    }
  </section>`;

  return new Response(
    renderZukanCommonShell({
      lang,
      title: `${place.canonical_name} — ${isEn ? "Suggest an edit" : "編集提案"}`,
      activeNav: "places",
      authenticated,
      displayName: session?.displayName ?? null,
      bodyHtml,
      pathname: `${prefix}/places/${encodedPlace}/propose`,
    }),
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
