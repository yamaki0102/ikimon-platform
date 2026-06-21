import { getPool } from "../db.js";
import { formatTaxonDisplayName } from "./localizedDisplay.js";
import { VALID_OBSERVATION_PHOTO_ASSET_SQL } from "./observationQualityGate.js";

export type MapOwnObservationSource = "visit_point" | "place_center";
export type MapOwnObservationRecordSource = "manual" | "scan" | "guide" | "legacy" | "other";

export type MapOwnObservation = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  observedAt: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  source: MapOwnObservationSource;
  recordSource: MapOwnObservationRecordSource;
};

export type MapOwnObservationList = {
  signedIn: boolean;
  items: MapOwnObservation[];
};

type MapOwnObservationRow = {
  user_id: string;
  occurrence_id: string;
  visit_id: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  display_name: string;
  ai_candidate_name: string | null;
  observed_at: string;
  point_latitude: number | string | null;
  point_longitude: number | string | null;
  place_latitude: number | string | null;
  place_longitude: number | string | null;
  photo_url: string | null;
  source_kind: string | null;
  session_mode: string | null;
  visit_mode: string | null;
};

type MapOwnObservationQueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: MapOwnObservationRow[] }>;
};

function normalizeAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

function finiteNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampLimit(value: number | undefined): number {
  return Math.min(Math.max(value ?? 24, 1), 100);
}

function classifyRecordSource(row: Pick<MapOwnObservationRow, "source_kind" | "session_mode" | "visit_mode">): MapOwnObservationRecordSource {
  const sourceKind = String(row.source_kind ?? "").toLowerCase();
  const sessionMode = String(row.session_mode ?? "").toLowerCase();
  const visitMode = String(row.visit_mode ?? "").toLowerCase();
  if (sourceKind.includes("legacy")) return "legacy";
  if (sessionMode === "fieldscan" || visitMode === "track" || sourceKind.includes("track")) return "scan";
  if (sessionMode.includes("guide") || visitMode.includes("guide") || sourceKind.includes("guide")) return "guide";
  if (sourceKind === "v2_observation" && sessionMode === "standard" && visitMode !== "track") return "manual";
  return "other";
}

export async function listMapOwnObservations(
  userId: string,
  options: {
    bbox?: [number, number, number, number];
    limit?: number;
    db?: MapOwnObservationQueryClient;
  } = {},
): Promise<MapOwnObservation[]> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) return [];

  let queryClient = options.db;
  try {
    queryClient ??= getPool() as unknown as MapOwnObservationQueryClient;
  } catch {
    return [];
  }

  const params: unknown[] = [trimmedUserId];
  const whereClauses = [
    "v.user_id = $1",
    "coalesce(v.point_latitude, p.center_latitude) is not null",
    "coalesce(v.point_longitude, p.center_longitude) is not null",
  ];
  if (options.bbox) {
    const [minLng, minLat, maxLng, maxLat] = options.bbox;
    params.push(minLng, minLat, maxLng, maxLat);
    whereClauses.push(
      `coalesce(v.point_longitude, p.center_longitude) between $${params.length - 3} and $${params.length - 1}`,
    );
    whereClauses.push(
      `coalesce(v.point_latitude, p.center_latitude) between $${params.length - 2} and $${params.length}`,
    );
  }

  const limit = clampLimit(options.limit);
  const result = await queryClient.query(
    `
      select
        v.user_id,
        o.occurrence_id,
        o.visit_id,
        o.scientific_name,
        o.vernacular_name,
        coalesce(
          nullif(o.vernacular_name, ''),
          nullif(o.scientific_name, ''),
          nullif(ai.recommended_taxon_name, ''),
          '同定待ち'
        ) as display_name,
        ai.recommended_taxon_name as ai_candidate_name,
        v.observed_at::text,
        v.point_latitude,
        v.point_longitude,
        v.source_kind,
        v.session_mode,
        v.visit_mode,
        p.center_latitude as place_latitude,
        p.center_longitude as place_longitude,
        photo.public_url as photo_url
      from occurrences o
      join visits v on v.visit_id = o.visit_id
      left join places p on p.place_id = v.place_id
      left join lateral (
        select recommended_taxon_name
        from observation_ai_assessments a
        where a.occurrence_id = o.occurrence_id
        order by generated_at desc
        limit 1
      ) ai on true
      left join lateral (
        select coalesce(ab.public_url, ab.storage_path) as public_url
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
        where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
          and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
        order by case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
          ea.created_at asc
        limit 1
      ) photo on true
      where ${whereClauses.join(" and ")}
      order by (photo.public_url is not null) desc, v.observed_at desc
      limit ${limit}
    `,
    params,
  );

  return result.rows
    .filter((row) => row.user_id === trimmedUserId)
    .map((row): MapOwnObservation | null => {
      const pointLat = finiteNumber(row.point_latitude);
      const pointLng = finiteNumber(row.point_longitude);
      const placeLat = finiteNumber(row.place_latitude);
      const placeLng = finiteNumber(row.place_longitude);
      const lat = pointLat ?? placeLat;
      const lng = pointLng ?? placeLng;
      if (lat === null || lng === null) return null;
      const display = formatTaxonDisplayName({
        vernacularName: row.vernacular_name,
        scientificName: row.scientific_name,
        displayName: row.display_name,
        aiCandidateName: row.ai_candidate_name,
      }, "ja");
      return {
        occurrenceId: row.occurrence_id,
        visitId: row.visit_id,
        displayName: display.primaryLabel,
        observedAt: row.observed_at,
        lat,
        lng,
        photoUrl: normalizeAssetUrl(row.photo_url),
        source: pointLat !== null && pointLng !== null ? "visit_point" : "place_center",
        recordSource: classifyRecordSource(row),
      };
    })
    .filter((row): row is MapOwnObservation => row !== null);
}
