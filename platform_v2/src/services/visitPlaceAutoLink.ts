import type { PoolClient } from "pg";
import { buildPlaceId, buildPlaceName } from "./writeSupport.js";

export type VisitPlaceAutoLinkResult = {
  placeId: string | null;
  source: "existing" | "revisit_context" | "nearby_same_user" | "nearby_public" | "created_geo" | "already_linked" | "unresolved";
};

type VisitPlaceRow = {
  visit_id: string;
  place_id: string | null;
  user_id: string | null;
  observed_at: string;
  point_latitude: number | null;
  point_longitude: number | null;
  coordinate_uncertainty_m: string | number | null;
  observed_country: string | null;
  observed_prefecture: string | null;
  observed_municipality: string | null;
  locality_note: string | null;
  source_payload: Record<string, unknown> | null;
  context_revisit_of_visit_id: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validLatLng(lat: number | null, lng: number | null): lat is number {
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function findPlaceByHint(client: PoolClient, hint: string): Promise<string | null> {
  if (!hint) return null;
  const withoutSitePrefix = hint.startsWith("site:") ? hint.slice(5) : hint;
  const result = await client.query<{ place_id: string }>(
    `select place_id
       from places
      where place_id = $1
         or legacy_place_key = $1
         or legacy_site_id = $1
         or place_id = $2
         or legacy_site_id = $2
      order by visit_count desc nulls last, updated_at desc
      limit 1`,
    [hint, withoutSitePrefix],
  );
  return result.rows[0]?.place_id ?? null;
}

async function findRevisitPlace(client: PoolClient, visit: VisitPlaceRow): Promise<string | null> {
  const payload = visit.source_payload && typeof visit.source_payload === "object" ? visit.source_payload : {};
  const revisitVisitId = clean(visit.context_revisit_of_visit_id)
    || clean(payload.revisit_of_visit_id)
    || clean(payload.revisitObservationId)
    || clean(payload.revisit_observation_id);
  if (!revisitVisitId) return null;
  const result = await client.query<{ place_id: string }>(
    `select place_id
       from visits
      where (visit_id = $1 or legacy_observation_id = $1)
        and place_id is not null
      limit 1`,
    [revisitVisitId],
  );
  return result.rows[0]?.place_id ?? null;
}

async function findNearbyPlace(
  client: PoolClient,
  visit: VisitPlaceRow,
  scope: "same_user" | "public",
): Promise<string | null> {
  const lat = numberOrNull(visit.point_latitude);
  const lng = numberOrNull(visit.point_longitude);
  if (!validLatLng(lat, lng)) return null;
  const uncertainty = numberOrNull(visit.coordinate_uncertainty_m);
  if (uncertainty !== null && uncertainty > 250) return null;
  const thresholdM = scope === "same_user" ? 120 : 35;
  const params: unknown[] = [lat, lng, thresholdM];
  const ownerClause = scope === "same_user" && visit.user_id
    ? `and exists (
         select 1 from visits owner_visits
          where owner_visits.place_id = p.place_id
            and owner_visits.user_id = $4
       )`
    : "";
  if (scope === "same_user" && visit.user_id) params.push(visit.user_id);
  if (scope === "same_user" && !visit.user_id) return null;
  const result = await client.query<{ place_id: string }>(
    `with ranked as (
       select p.place_id,
              (
                111320 * sqrt(
                  power(p.center_latitude - $1, 2) +
                  power((p.center_longitude - $2) * cos(radians($1)), 2)
                )
              ) as distance_m,
              p.visit_count
         from places p
        where p.center_latitude is not null
          and p.center_longitude is not null
          ${ownerClause}
     )
     select place_id
       from ranked
      where distance_m <= $3
      order by distance_m asc, visit_count desc nulls last
      limit 1`,
    params,
  );
  return result.rows[0]?.place_id ?? null;
}

async function createGeoPlace(client: PoolClient, visit: VisitPlaceRow): Promise<string | null> {
  const lat = numberOrNull(visit.point_latitude);
  const lng = numberOrNull(visit.point_longitude);
  if (!validLatLng(lat, lng)) return null;
  const placeId = buildPlaceId({
    latitude: lat,
    longitude: lng,
    municipality: visit.observed_municipality,
    prefecture: visit.observed_prefecture,
  });
  await client.query(
    `insert into places (
       place_id, legacy_place_key, legacy_site_id, canonical_name, locality_label,
       source_kind, country_code, prefecture, municipality, center_latitude, center_longitude, metadata, created_at, updated_at
     ) values (
       $1, $1, null, $2, $3,
       'auto_place_link', $4, $5, $6, $7, $8, $9::jsonb, now(), now()
     )
     on conflict (place_id) do update set
       locality_label = coalesce(places.locality_label, excluded.locality_label),
       prefecture = coalesce(places.prefecture, excluded.prefecture),
       municipality = coalesce(places.municipality, excluded.municipality),
       center_latitude = coalesce(places.center_latitude, excluded.center_latitude),
       center_longitude = coalesce(places.center_longitude, excluded.center_longitude),
       metadata = places.metadata || excluded.metadata,
       updated_at = now()`,
    [
      placeId,
      buildPlaceName({
        siteName: visit.locality_note,
        municipality: visit.observed_municipality,
        prefecture: visit.observed_prefecture,
      }),
      visit.locality_note,
      visit.observed_country ?? "JP",
      visit.observed_prefecture,
      visit.observed_municipality,
      lat,
      lng,
      JSON.stringify({
        source: "visit_place_auto_link",
        source_visit_id: visit.visit_id,
      }),
    ],
  );
  return placeId;
}

async function applyVisitPlaceLink(
  client: PoolClient,
  visit: VisitPlaceRow,
  placeId: string,
  source: VisitPlaceAutoLinkResult["source"],
): Promise<void> {
  await client.query(
    `update visits
        set place_id = $2,
            source_payload = coalesce(source_payload, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where visit_id = $1
        and place_id is null`,
    [
      visit.visit_id,
      placeId,
      JSON.stringify({
        auto_place_link: {
          place_id: placeId,
          source,
          linked_at: new Date().toISOString(),
        },
      }),
    ],
  );
}

export async function ensureVisitPlaceLink(
  client: PoolClient,
  visitId: string,
): Promise<VisitPlaceAutoLinkResult> {
  const result = await client.query<VisitPlaceRow>(
    `select v.visit_id,
            v.place_id,
            v.user_id,
            v.observed_at::text as observed_at,
            v.point_latitude,
            v.point_longitude,
            v.coordinate_uncertainty_m::text as coordinate_uncertainty_m,
            v.observed_country,
            v.observed_prefecture,
            v.observed_municipality,
            v.locality_note,
            v.source_payload,
            coc.revisit_of_visit_id as context_revisit_of_visit_id
       from visits v
       left join civic_observation_contexts coc on coc.visit_id = v.visit_id
      where v.visit_id = $1
      limit 1
      for update of v`,
    [visitId],
  );
  const visit = result.rows[0];
  if (!visit) return { placeId: null, source: "unresolved" };
  if (visit.place_id) return { placeId: visit.place_id, source: "already_linked" };

  const payload = visit.source_payload && typeof visit.source_payload === "object" ? visit.source_payload : {};
  const hints = [
    clean(payload.place_id_hint),
    clean(payload.target_place_id),
    clean(payload.place_id),
    clean(payload.site_id),
  ].filter(Boolean);
  for (const hint of hints) {
    const placeId = await findPlaceByHint(client, hint);
    if (placeId) {
      await applyVisitPlaceLink(client, visit, placeId, "existing");
      return { placeId, source: "existing" };
    }
  }

  const revisitPlaceId = await findRevisitPlace(client, visit);
  if (revisitPlaceId) {
    await applyVisitPlaceLink(client, visit, revisitPlaceId, "revisit_context");
    return { placeId: revisitPlaceId, source: "revisit_context" };
  }

  const sameUserNearby = await findNearbyPlace(client, visit, "same_user");
  if (sameUserNearby) {
    await applyVisitPlaceLink(client, visit, sameUserNearby, "nearby_same_user");
    return { placeId: sameUserNearby, source: "nearby_same_user" };
  }

  const publicNearby = await findNearbyPlace(client, visit, "public");
  if (publicNearby) {
    await applyVisitPlaceLink(client, visit, publicNearby, "nearby_public");
    return { placeId: publicNearby, source: "nearby_public" };
  }

  const created = await createGeoPlace(client, visit);
  if (created) {
    await applyVisitPlaceLink(client, visit, created, "created_geo");
    return { placeId: created, source: "created_geo" };
  }

  return { placeId: null, source: "unresolved" };
}
