import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader, renderSubpageRow } from "./zukanSubpageUi";

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
    const bodyHtml = `<section class="zt-sp" data-place-nearby="e10">
      <style>${ZUKAN_SUBPAGE_CSS}</style>
      ${renderSubpageHeader({ title: isEn ? "Nearby places" : "近くの場所", backHref: `${prefix}/places/${encodedPlace}`, backLabel: isEn ? "Back to the place" : "場所に戻る" })}
      <p class="zt-sp-lead">${escapeHtml(data.placeName)}</p>
      ${
        data.places.length > 0
          ? `<ul class="zt-sp-list">${data.places
              .map((p) =>
                renderSubpageRow({
                  href: `${prefix}/places/${encodeURIComponent(p.placeId)}`,
                  title: p.name,
                  meta: [p.localityLabel ?? "", p.distanceKm !== undefined ? `${p.distanceKm}km` : ""].filter(Boolean).join(" ・ "),
                })
              )
              .join("")}</ul>`
          : `<p class="zt-sp-empty">${isEn ? "No nearby places found." : "近くの場所が見つかりませんでした。"}</p>`
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
    .prepare("SELECT place_id, canonical_name, public_summary, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_summary?: string | null; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return new Response("Not found", { status: 404 });
  }

  const proposeScript = `<script>(()=>{const form=document.getElementById("place-propose-form");if(!form)return;const status=document.getElementById("place-propose-status");const initial={canonical_name:form.elements.canonical_name.value,public_summary:form.elements.public_summary.value};const say=(m)=>{if(status)status.textContent=m;};form.addEventListener("submit",async(e)=>{e.preventDefault();const reason=String(form.elements.reason.value||"");const changed=Object.keys(initial).filter((k)=>String(form.elements[k].value||"").trim()&&form.elements[k].value!==initial[k]);if(!changed.length){say(${JSON.stringify(isEn ? "Change the name or description first." : "名前か説明を直してから送ってください。")});return;}const button=form.querySelector("button[type=submit]");if(button)button.disabled=true;try{for(const field of changed){const res=await fetch(${JSON.stringify(`/api/v1/places/${encodedPlace}/proposals`)},{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({field,proposedValue:form.elements[field].value,reason})});if(!res.ok)throw new Error("failed");}say(${JSON.stringify(isEn ? "Sent. The people who look after this place will review it." : "送りました。この場所を世話している人が確認します。")});}catch{say(${JSON.stringify(isEn ? "Could not send. Please try again." : "送れませんでした。もう一度試してください。")});if(button)button.disabled=false;}});})();</script>`;
  const bodyHtml = `<section class="zt-sp" data-place-propose="e9">
    <style>${ZUKAN_SUBPAGE_CSS}</style>
    ${renderSubpageHeader({ title: isEn ? "Suggest an edit" : "編集を提案する", backHref: `${prefix}/places/${encodedPlace}`, backLabel: isEn ? "Back to the place" : "場所に戻る" })}
    ${
      authenticated
        ? `<p class="zt-sp-lead">${isEn ? "Suggest a fix to this place. It appears on the page after the people who look after it confirm." : "場所の情報を直す提案を送れます。この場所を世話している人が確認してから、ページに反映されます。"}</p>
          <form id="place-propose-form" style="display:grid;gap:20px;min-width:0">
            <label class="zt-sp-field"><span>${isEn ? "Place name" : "場所の名前"}</span>
              <input class="zt-sp-input" type="text" name="canonical_name" maxlength="120" value="${escapeHtml(place.canonical_name)}">
            </label>
            <label class="zt-sp-field"><span>${isEn ? "Description" : "説明"}</span>
              <textarea class="zt-sp-input" name="public_summary" rows="4" maxlength="500">${escapeHtml(place.public_summary ?? "")}</textarea>
            </label>
            <label class="zt-sp-field"><span>${isEn ? "Reason" : "提案の理由"}</span>
              <input class="zt-sp-input" type="text" name="reason" maxlength="160" placeholder="${isEn ? "e.g. add the year it was certified" : "例：認定された年を足したい"}">
            </label>
            <button type="submit" class="zt-sp-primary">${isEn ? "Send suggestion" : "提案を送る"}</button>
            <p class="zt-sp-lead" id="place-propose-status" role="status" aria-live="polite"></p>
          </form>${proposeScript}`
        : `<a class="zt-sp-primary" href="${escapeHtml(`${prefix}/login`)}">${isEn ? "Sign in to suggest an edit" : "ログインして編集を提案する"}</a>`
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
