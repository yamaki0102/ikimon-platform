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
  visit_source_payload_text?: string | null;
  occurrence_source_payload_text?: string | null;
  evidence_source_payload_text?: string | null;
  asset_source_payload_text?: string | null;
  locality_note?: string | null;
  note?: string | null;
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

const OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL =
  "(^|[^a-z0-9])(e2e|dummy|sample|smoke|contentless|excluded|field[-_]?guide|guide|field[-_]?scan|fieldscan|scanner|scan|legacy)([^a-z0-9]|$)";

const OWNER_HISTORY_PLACEHOLDER_PHOTO_PATTERN_SQL =
  "(^|/)assets/(img/((pwa-)?icon-192(-[^/.]+)?)[.]png|brand/(app-icon-192(-maskable)?|ikimon-mark-192)[.]png)";

const OWNER_HISTORY_EXCLUDED_MARKER_PATTERN =
  /(^|[^a-z0-9])(e2e|dummy|sample|smoke|contentless|excluded|field[-_]?guide|guide|field[-_]?scan|fieldscan|scanner|scan|legacy)([^a-z0-9]|$)/i;

const OWNER_HISTORY_PLACEHOLDER_PHOTO_PATTERN =
  /(^|\/)assets\/(img\/((pwa-)?icon-192(-[^/.]+)?)\.png|brand\/(app-icon-192(-maskable)?|ikimon-mark-192)\.png)/i;

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

function hasExcludedOwnerHistoryMarker(row: MapOwnObservationRow): boolean {
  return [
    row.source_kind,
    row.session_mode,
    row.visit_mode,
    row.visit_source_payload_text,
    row.occurrence_source_payload_text,
    row.evidence_source_payload_text,
    row.asset_source_payload_text,
    row.locality_note,
    row.note,
  ].some((value) => OWNER_HISTORY_EXCLUDED_MARKER_PATTERN.test(String(value ?? "")));
}

function isUsableOwnerHistoryPhotoUrl(photoUrl: string): boolean {
  return !OWNER_HISTORY_PLACEHOLDER_PHOTO_PATTERN.test(photoUrl);
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
    "v.point_latitude is not null",
    "v.point_longitude is not null",
    "v.source_kind = 'v2_observation'",
    "coalesce(v.session_mode, '') = 'standard'",
    "coalesce(v.visit_mode, 'manual') = 'manual'",
    "coalesce(v.source_payload->>'expectedVisibility', v.source_payload->>'expected_visibility', o.source_payload->>'expectedVisibility', o.source_payload->>'expected_visibility', '') <> 'excluded'",
    `coalesce(v.source_payload::text, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'`,
    `coalesce(o.source_payload::text, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'`,
    `coalesce(v.note, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'`,
    `coalesce(v.locality_note, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'`,
    "photo.public_url is not null",
  ];
  if (options.bbox) {
    const [minLng, minLat, maxLng, maxLat] = options.bbox;
    params.push(minLng, minLat, maxLng, maxLat);
    whereClauses.push(
      `v.point_longitude between $${params.length - 3} and $${params.length - 1}`,
    );
    whereClauses.push(
      `v.point_latitude between $${params.length - 2} and $${params.length}`,
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
        v.source_payload::text as visit_source_payload_text,
        o.source_payload::text as occurrence_source_payload_text,
        v.locality_note,
        v.note,
        null as place_latitude,
        null as place_longitude,
        photo.public_url as photo_url,
        photo.evidence_source_payload_text,
        photo.asset_source_payload_text
      from occurrences o
      join visits v on v.visit_id = o.visit_id
      left join lateral (
        select recommended_taxon_name
        from observation_ai_assessments a
        where a.occurrence_id = o.occurrence_id
        order by generated_at desc
        limit 1
      ) ai on true
      left join lateral (
        select
          coalesce(ab.public_url, ab.storage_path) as public_url,
          ea.source_payload::text as evidence_source_payload_text,
          ab.source_payload::text as asset_source_payload_text
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
        where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
          and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
          and coalesce(ea.source_payload::text, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'
          and coalesce(ab.source_payload::text, '') !~* '${OWNER_HISTORY_EXCLUDED_MARKER_PATTERN_SQL}'
          and coalesce(ab.public_url, ab.storage_path, '') !~* '${OWNER_HISTORY_PLACEHOLDER_PHOTO_PATTERN_SQL}'
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
      const lat = pointLat;
      const lng = pointLng;
      if (lat === null || lng === null) return null;
      const photoUrl = normalizeAssetUrl(row.photo_url);
      if (!photoUrl) return null;
      if (!isUsableOwnerHistoryPhotoUrl(photoUrl)) return null;
      if (classifyRecordSource(row) !== "manual") return null;
      if (hasExcludedOwnerHistoryMarker(row)) return null;
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
        photoUrl,
        source: "visit_point",
        recordSource: "manual",
      };
    })
    .filter((row): row is MapOwnObservation => row !== null);
}
