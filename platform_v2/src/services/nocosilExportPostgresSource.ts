import type { Pool, PoolClient, QueryResultRow } from "pg";
import { getPool } from "../db.js";
import {
  loadAreaSnapshotVisitIds,
  type AreaSnapshotScopeField,
} from "./areaSnapshotVisitScope.js";
import {
  normalizeObservationDataRights,
  type ObservationDataRightsInput,
} from "./observationDataRights.js";
import type { NocosilExportObservationInput } from "./nocosilExportPayload.js";

export type NocosilExportPostgresQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type NocosilExportSite = {
  id: string;
  /** Internal orchestration hint only; never included in the projected payload. */
  ownerUserId?: string;
};

export type NocosilExportObservationSelection = {
  siteId: string;
  actorUserId: string;
  observationIds: string[];
  period: { start: string; end: string };
};

/**
 * A photo resolver must return only a canonical, verified public derivative.
 * Its default is deliberately null because `evidence_assets.public_url` can
 * point at an original upload and the retained PostgreSQL schema does not
 * prove that a thumbnail is EXIF-scrubbed or face-safe.
 */
export type NocosilExportPhotoResolver = (candidate: {
  thumbnailUrl: string | null;
  publicUrl: string | null;
  assetMetadata: Record<string, unknown>;
  blobMetadata: Record<string, unknown>;
}) => string | null;

type SiteRow = {
  field_id: string;
  source: string;
  owner_user_id: string | null;
  lat: number | string;
  lng: number | string;
  radius_m: number | string;
  polygon: Record<string, unknown> | string | null;
};

type RawObservationRow = QueryResultRow & {
  observation_id: string;
  visit_id: string;
  occurrence_id: string | null;
  taxon_name: string | null;
  observed_at: string;
  latitude: number | string | null;
  longitude: number | string | null;
  record_consent: string | null;
  research_use_consent: string | null;
  enterprise_report_consent: string | null;
  dataset_license: string | null;
  media_license: string | null;
  external_export_allowed: boolean | null;
  area_profile_use_consent: string | null;
  public_aggregation_allowed: boolean | null;
  public_profile_attribution_mode: string | null;
  consent_source: string | null;
  rights_policy_version: string | null;
  withdrawal_status: string | null;
  photo_url: string | null;
  photo_thumbnail_url: string | null;
  photo_metadata: Record<string, unknown> | string | null;
  photo_blob_metadata: Record<string, unknown> | string | null;
};

const OWNER_AUTH_SQL = `
  SELECT field.field_id::text AS field_id,
         field.source,
         field.owner_user_id,
         field.lat,
         field.lng,
         field.radius_m,
         field.polygon
    FROM observation_fields AS field
   WHERE field.field_id = $1::uuid
     AND (
       (field.source = 'user_defined' AND field.owner_user_id = $2)
       OR EXISTS (
         SELECT 1
           FROM field_managers AS manager
          WHERE manager.field_id = field.field_id
            AND manager.user_id = $2
            AND manager.role = 'owner'
            AND (manager.expires_at IS NULL OR manager.expires_at > NOW())
       )
     )
   LIMIT 1`;

/**
 * Loads only records explicitly selected by the already authenticated site
 * owner. Every requested ID is returned when it resolves inside the site and
 * period, even when consent is absent, withdrawn, or otherwise ineligible;
 * the projection layer owns the final consent decision.
 */
const OBSERVATION_SQL = `
  WITH requested_observations AS (
    SELECT DISTINCT unnest($3::text[]) AS observation_id
  ), selected AS (
    SELECT requested.observation_id,
           visit.visit_id,
           visit.observed_at,
           visit.point_latitude,
           visit.point_longitude,
           visit.quality_review_status
      FROM requested_observations AS requested
      LEFT JOIN occurrences AS requested_occurrence
        ON requested_occurrence.occurrence_id = requested.observation_id
      JOIN visits AS visit
        ON visit.visit_id = COALESCE(requested_occurrence.visit_id, requested.observation_id)
     WHERE visit.visit_id = ANY($4::text[])
       AND visit.observed_at >= $5::timestamptz
       AND visit.observed_at < $6::timestamptz
  )
  SELECT selected.observation_id,
         selected.visit_id,
         occurrence.occurrence_id,
         COALESCE(NULLIF(human.proposed_name, ''), NULLIF(occurrence.vernacular_name, ''),
                  NULLIF(occurrence.scientific_name, '')) AS taxon_name,
         selected.observed_at::text AS observed_at,
         selected.point_latitude AS latitude,
         selected.point_longitude AS longitude,
         rights.record_consent,
         rights.research_use_consent,
         rights.enterprise_report_consent,
         rights.dataset_license,
         rights.media_license,
         rights.external_export_allowed,
         rights.area_profile_use_consent,
         rights.public_aggregation_allowed,
         rights.public_profile_attribution_mode,
         rights.consent_source,
         rights.rights_policy_version,
         rights.withdrawal_status,
         photo.public_url AS photo_url,
         photo.thumbnail_url AS photo_thumbnail_url,
         photo.asset_metadata AS photo_metadata,
         photo.blob_metadata AS photo_blob_metadata
    FROM selected
    JOIN visits AS visit ON visit.visit_id = selected.visit_id
    LEFT JOIN LATERAL (
      SELECT candidate.occurrence_id,
             candidate.vernacular_name,
             candidate.scientific_name
        FROM occurrences AS candidate
       WHERE candidate.visit_id = selected.visit_id
         AND (candidate.occurrence_id = selected.observation_id
              OR NOT EXISTS (
                SELECT 1 FROM occurrences AS exact_occurrence
                 WHERE exact_occurrence.occurrence_id = selected.observation_id
              ))
       ORDER BY candidate.created_at DESC, candidate.occurrence_id
       LIMIT 1
    ) AS occurrence ON true
    LEFT JOIN LATERAL (
      SELECT identification.proposed_name
        FROM identifications AS identification
       WHERE occurrence.occurrence_id IS NOT NULL
         AND identification.occurrence_id = occurrence.occurrence_id
         AND COALESCE(identification.is_current, true) = true
         AND identification.actor_kind = 'human'
         AND NULLIF(TRIM(identification.proposed_name), '') IS NOT NULL
       ORDER BY identification.created_at DESC, identification.identification_id
       LIMIT 1
    ) AS human ON true
    LEFT JOIN observation_data_rights AS rights ON rights.visit_id = selected.visit_id
    LEFT JOIN LATERAL (
      SELECT blob.public_url,
             COALESCE(asset.source_payload->>'thumbnail_url',
                      blob.source_payload->>'thumbnail_url') AS thumbnail_url,
             asset.source_payload AS asset_metadata,
             blob.source_payload AS blob_metadata
        FROM evidence_assets AS asset
        JOIN asset_blobs AS blob ON blob.blob_id = asset.blob_id
       WHERE (asset.occurrence_id = occurrence.occurrence_id OR asset.visit_id = selected.visit_id)
         AND asset.asset_role = 'observation_photo'
         AND COALESCE(NULLIF(LOWER(asset.source_payload->>'facePrivacy'), ''), 'unknown') NOT IN ('has_faces', 'unsafe')
         AND COALESCE(LOWER(asset.source_payload->'facePrivacy'->>'hasFace'), 'false') NOT IN ('true', '1', 'yes')
         AND COALESCE(LOWER(blob.source_payload->'facePrivacy'->>'hasFace'), 'false') NOT IN ('true', '1', 'yes')
       ORDER BY CASE WHEN asset.occurrence_id = occurrence.occurrence_id THEN 0 ELSE 1 END,
                asset.created_at ASC
       LIMIT 1
    ) AS photo ON true
   WHERE EXISTS (
     SELECT 1
       FROM observation_fields AS field
      WHERE field.field_id = $1::uuid
        AND (
          (field.source = 'user_defined' AND field.owner_user_id = $2)
          OR EXISTS (
            SELECT 1 FROM field_managers AS manager
             WHERE manager.field_id = field.field_id
               AND manager.user_id = $2
               AND manager.role = 'owner'
               AND (manager.expires_at IS NULL OR manager.expires_at > NOW())
          )
        )
   )
   ORDER BY selected.observation_id`;

type Queryable = NocosilExportPostgresQueryable;

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function numericCoordinate(value: unknown): number | null {
  const coordinate = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(coordinate) ? coordinate : null;
}

function validPeriod(period: { start: string; end: string }): { start: string; end: string } {
  const startMs = Date.parse(period.start);
  const endMs = Date.parse(period.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new Error("nocosil_export_period_invalid");
  }
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

function mapObservation(row: RawObservationRow, photoResolver: NocosilExportPhotoResolver): NocosilExportObservationInput {
  const rightsInput: ObservationDataRightsInput = {
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    recordConsent: row.record_consent as ObservationDataRightsInput["recordConsent"],
    researchUseConsent: row.research_use_consent as ObservationDataRightsInput["researchUseConsent"],
    enterpriseReportConsent: row.enterprise_report_consent as ObservationDataRightsInput["enterpriseReportConsent"],
    datasetLicense: row.dataset_license as ObservationDataRightsInput["datasetLicense"],
    mediaLicense: row.media_license as ObservationDataRightsInput["mediaLicense"],
    externalExportAllowed: row.external_export_allowed ?? false,
    areaProfileUseConsent: row.area_profile_use_consent as ObservationDataRightsInput["areaProfileUseConsent"],
    publicAggregationAllowed: row.public_aggregation_allowed ?? false,
    publicProfileAttributionMode: row.public_profile_attribution_mode as ObservationDataRightsInput["publicProfileAttributionMode"],
    consentSource: row.consent_source as ObservationDataRightsInput["consentSource"],
    rightsPolicyVersion: row.rights_policy_version ?? undefined,
    withdrawalStatus: row.withdrawal_status as ObservationDataRightsInput["withdrawalStatus"],
  };
  const normalizedRights = normalizeObservationDataRights({ ...rightsInput, visitId: row.visit_id, occurrenceId: row.occurrence_id });
  const { sourcePayload: _privateSourcePayload, ...rights } = normalizedRights;
  const photoUrl = photoResolver({
    thumbnailUrl: row.photo_thumbnail_url,
    publicUrl: row.photo_url,
    assetMetadata: parseJsonRecord(row.photo_metadata),
    blobMetadata: parseJsonRecord(row.photo_blob_metadata),
  });
  const observedDate = new Date(row.observed_at);
  return {
    id: row.observation_id,
    taxon: row.taxon_name?.trim() || "Unidentified observation",
    date: Number.isNaN(observedDate.getTime()) ? "" : observedDate.toISOString().slice(0, 10),
    latitude: numericCoordinate(row.latitude),
    longitude: numericCoordinate(row.longitude),
    // Use a single conservative location floor for every record, including
    // taxa missing from or absent in the retained protected-species registry.
    sensitive: true,
    rights,
    photoUrl,
    photoUrlIsSanitizedRendition: photoUrl !== null,
  };
}

export class NocosilExportPostgresSource {
  constructor(
    private readonly queryable: Queryable = getPool(),
    private readonly photoResolver: NocosilExportPhotoResolver = () => null,
  ) {}

  async getSite(siteId: string, actorUserId: string): Promise<NocosilExportSite | null> {
    if (!siteId || !actorUserId) return null;
    const result = await this.queryable.query<SiteRow>(OWNER_AUTH_SQL, [siteId, actorUserId]);
    const row = result.rows[0];
    if (!row) return null;
    const site: NocosilExportSite = { id: row.field_id };
    if (row.source === "user_defined" && row.owner_user_id === actorUserId) {
      site.ownerUserId = actorUserId;
    }
    return site;
  }

  async loadObservations(input: NocosilExportObservationSelection): Promise<NocosilExportObservationInput[]> {
    const siteId = input.siteId.trim();
    const actorUserId = input.actorUserId.trim();
    const observationIds = Array.from(new Set(input.observationIds.map((id) => id.trim()).filter(Boolean)));
    if (!siteId || !actorUserId) throw new Error("site_owner_required");
    if (observationIds.length === 0) return [];
    if (observationIds.length > 500) throw new Error("nocosil_export_selection_too_large");
    const period = validPeriod(input.period);

    // Authorization is resolved before site geometry is read and repeated in
    // the final record query so a grant revoked between queries fails closed.
    const authorized = await this.queryable.query<SiteRow>(OWNER_AUTH_SQL, [siteId, actorUserId]);
    const field = authorized.rows[0];
    if (!field) throw new Error("site_owner_required");
    const visitIds = await loadAreaSnapshotVisitIds(
      {
        fieldId: field.field_id,
        lat: Number(field.lat),
        lng: Number(field.lng),
        radiusM: Number(field.radius_m),
        polygon: field.polygon == null
          ? null
          : parseJsonRecord(field.polygon) as AreaSnapshotScopeField["polygon"],
      },
      null,
      { observedFrom: period.start, observedTo: period.end },
      this.queryable,
    );
    if (visitIds.length === 0) return [];

    const result = await this.queryable.query<RawObservationRow>(OBSERVATION_SQL, [
      siteId,
      actorUserId,
      observationIds,
      visitIds,
      period.start,
      period.end,
    ]);
    return result.rows.map((row) => mapObservation(row, this.photoResolver));
  }
}

export const __test__ = { OWNER_AUTH_SQL, OBSERVATION_SQL, mapObservation, parseJsonRecord, validPeriod };
