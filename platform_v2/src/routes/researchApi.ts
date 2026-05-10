import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import {
  PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL,
  PUBLIC_OBSERVATION_QUALITY_SQL,
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
} from "../services/observationQualityGate.js";
import { MEDIA_ROLE_VALUES } from "../services/mediaRole.js";
import {
  buildResearchExportQaReport,
  toDarwinCoreCsvV0,
  type ResearchExportRecord,
} from "../services/researchExport.js";
import { selectMonitoringPackage } from "../services/monitoringPackageStandard.js";

type OccurrenceRow = {
  occurrence_id: string;
  visit_id: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  evidence_tier: number;
  basis_of_record: string | null;
  data_quality: string | null;
  ai_assessment_status: string | null;
  observed_at: string;
  latitude: string | null;
  longitude: string | null;
  place_name: string | null;
  municipality: string | null;
  observer_name: string | null;
  photo_url: string | null;
  machine_media_ref: string | null;
  media_role: string | null;
  public_precision: string | null;
  civic_risk_lane: string | null;
  record_consent: string | null;
  research_use_consent: string | null;
  dataset_license: string | null;
  media_license: string | null;
  external_export_allowed: boolean | null;
  withdrawal_status: string | null;
  visit_mode: string | null;
  observation_method: string | null;
  protocol_id: string | null;
  effort_minutes: string | null;
  target_taxa_scope: string | null;
  water_effort_minutes: string | null;
  water_target_taxa_scope: string | null;
  catch_outcome: string | null;
  field_scan_mode: string | null;
  governance_context_present: boolean;
  review_scope_present: boolean;
  site_policy_context_present: boolean;
  latest_package_stage: string | null;
  consensus_status: string;
  identification_verification_status: string;
  calibration_decision: Record<string, unknown> | null;
  external_taxon_id_count: number;
};

function machineEvidenceStatus(row: Pick<OccurrenceRow, "basis_of_record" | "ai_assessment_status" | "data_quality">): "human_observation" | "ai_candidate" | "reviewer_verified" | "reviewer_rejected" {
  if (row.basis_of_record !== "MachineObservation") return "human_observation";
  const status = row.ai_assessment_status || row.data_quality || "";
  if (status === "reviewer_verified") return "reviewer_verified";
  if (status === "reviewer_rejected" || status === "rejected") return "reviewer_rejected";
  return "ai_candidate";
}

function normalizeMediaRoleQuery(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const role = value.trim();
  return MEDIA_ROLE_VALUES.includes(role as (typeof MEDIA_ROLE_VALUES)[number]) ? role : null;
}

function isExportReadyOnlyQuery(query: Record<string, string>): boolean {
  return query.export_ready_only === "1" || query.export_ready_only === "true";
}

function includeMachineObservationsQuery(query: Record<string, string>): boolean {
  return query.include_machine_observations === "1" || query.include_machine_observations === "true";
}

function mapOccurrenceRow(row: OccurrenceRow): ResearchExportRecord & Record<string, unknown> {
  const machineStatus = machineEvidenceStatus(row);
  const exportReady = Boolean(
    row.external_export_allowed
    && row.withdrawal_status === "active"
    && row.dataset_license
    && row.media_license
    && row.public_precision
    && row.public_precision !== "exact_private"
    && (row.consensus_status === "authority_backed" || row.evidence_tier >= 3)
    && (row.basis_of_record !== "MachineObservation" || machineStatus === "reviewer_verified")
  );
  return {
    observationMode:       row.observation_method ?? (row.field_scan_mode ? "field_scan" : row.visit_mode === "survey" ? "guide_survey" : "image_post"),
    occurrenceID:         row.occurrence_id,
    eventID:              row.visit_id,
    scientificName:       row.scientific_name,
    vernacularName:       row.vernacular_name,
    taxonRank:            row.taxon_rank,
    evidenceTier:         row.evidence_tier,
    eventDate:            row.observed_at,
    decimalLatitude:      row.latitude !== null ? Number(row.latitude) : null,
    decimalLongitude:     row.longitude !== null ? Number(row.longitude) : null,
    locality:             row.place_name,
    municipality:         row.municipality,
    recordedBy:           row.observer_name,
    associatedMedia:      row.photo_url ?? row.machine_media_ref,
    associatedMediaRole:  row.media_role,
    basisOfRecord:        row.basis_of_record ?? "HumanObservation",
    machineEvidenceLayer: machineStatus,
    machineEvidence: row.basis_of_record === "MachineObservation" ? {
      status: machineStatus,
      humanReviewRequired: machineStatus === "ai_candidate",
      exportUse: machineStatus === "reviewer_verified" ? "reviewed_record_candidate" : "activity_indicator_only",
      claimLimit: machineStatus === "reviewer_verified" ? "reviewed_machine_observation" : "not_a_confirmed_species_record",
      calibrationDecision: row.calibration_decision ?? null,
    } : null,
    datasetName:          "ikimon Field Loop",
    license:              row.dataset_license ?? "not_export_ready",
    consensusStatus:      row.consensus_status,
    identificationVerificationStatus: row.identification_verification_status,
    readiness: {
      exportReady,
      reviewReady: row.identification_verification_status !== "tier3_export_candidate" || row.evidence_tier >= 3,
      modelReady: Boolean(
        row.basis_of_record === "MachineObservation"
          ? row.place_name && row.observed_at && row.observation_method && (row.effort_minutes || row.water_effort_minutes || row.protocol_id)
          : row.place_name
            && row.observed_at
            && (row.visit_mode === "survey" || row.field_scan_mode || row.catch_outcome)
            && (row.effort_minutes || row.water_effort_minutes)
            && row.photo_url
      ),
      machineObservationReady: Boolean(
        row.basis_of_record === "MachineObservation"
        && machineStatus === "reviewer_verified"
      ),
      indicatorReady: Boolean(
        row.field_scan_mode
        && row.review_scope_present
        && (row.effort_minutes || row.water_effort_minutes)
        && (row.consensus_status === "authority_backed" || row.identification_verification_status === "authority_reviewed")
      ),
      governanceReady: Boolean(row.governance_context_present && row.site_policy_context_present && row.review_scope_present),
      fieldScanReady: row.field_scan_mode
        ? Boolean(row.field_scan_mode && row.photo_url && (row.effort_minutes || row.water_effort_minutes))
        : true,
    },
    methodContext: {
      visitMode: row.visit_mode,
      observationMethod: row.observation_method,
      protocolId: row.protocol_id,
      fieldScanMode: row.field_scan_mode,
      catchOutcome: row.catch_outcome,
      effortMinutes: row.water_effort_minutes !== null ? Number(row.water_effort_minutes) : row.effort_minutes !== null ? Number(row.effort_minutes) : null,
      targetTaxaScope: row.water_target_taxa_scope ?? row.target_taxa_scope,
    },
    dataProductChain: {
      exportFormat: "darwin_core_csv_v0",
      latestStage: row.latest_package_stage ?? "raw_observation",
      reportOutput: "metadata_plus_qa_report",
    },
    trendAbundancePolicy: {
      claimAllowed: Boolean(row.field_scan_mode && row.review_scope_present && row.consensus_status === "authority_backed"),
      defaultClaimLimit: row.catch_outcome === "no_catch"
        ? "capture_attempt_only"
        : row.basis_of_record === "MachineObservation"
          ? "activity_indicator_candidate"
          : row.field_scan_mode
          ? "indicator_candidate"
          : "presence_only",
    },
    monitoringPackage: selectMonitoringPackage({
      actionMode: row.observation_method ?? row.visit_mode,
      observationMethod: row.observation_method,
      fieldScanMode: row.field_scan_mode,
      captureOutcome: row.catch_outcome,
      targetTaxaScope: row.water_target_taxa_scope ?? row.target_taxa_scope,
      visitMode: row.visit_mode,
      hasSite: Boolean(row.place_name),
      hasTime: Boolean(row.observed_at),
      hasMethod: Boolean(row.observation_method || row.field_scan_mode || row.visit_mode || row.catch_outcome),
      hasEffort: Boolean(row.effort_minutes || row.water_effort_minutes || row.protocol_id),
      hasQualityEvidence: Boolean(row.photo_url || row.machine_media_ref),
      hasReview: row.identification_verification_status === "authority_reviewed" || row.evidence_tier >= 3 || machineStatus === "reviewer_verified",
      hasRights: Boolean(row.external_export_allowed),
      hasExternalTaxonId: row.external_taxon_id_count > 0,
    }),
    dataGeneralizations: {
      location: row.public_precision ?? "not_set",
    },
    informationWithheld: [
      row.public_precision && row.public_precision !== "exact_private" ? "precise_coordinates" : null,
      row.civic_risk_lane && row.civic_risk_lane !== "normal" ? "risk_lane_sensitive_context" : null,
      row.governance_context_present ? "local_knowledge_or_site_policy_context" : null,
    ].filter(Boolean),
    licenseStatus: {
      recordConsent: row.record_consent ?? "missing",
      researchUseConsent: row.research_use_consent ?? "missing",
      datasetLicense: row.dataset_license,
      mediaLicense: row.media_license,
      externalExportAllowed: Boolean(row.external_export_allowed),
      withdrawalStatus: row.withdrawal_status ?? "missing",
    },
  };
}

async function queryResearchOccurrenceRecords(
  query: Record<string, string>,
  options: { forceExportReadyOnly?: boolean; defaultTierGte?: number } = {},
): Promise<{ records: Array<ResearchExportRecord & Record<string, unknown>>; offset: number; exportReadyOnly: boolean }> {
  const tierGte = Math.max(1, Math.min(4, Number(query.tier_gte ?? options.defaultTierGte ?? 3)));
  const limit = Math.min(1000, Math.max(1, Number(query.limit ?? 100)));
  const offset = Math.max(0, Number(query.offset ?? 0));
  const exportReadyOnly = options.forceExportReadyOnly || isExportReadyOnlyQuery(query);
  const includeMachine = includeMachineObservationsQuery(query);
  const params: (string | number | boolean)[] = [tierGte, limit, offset, includeMachine];
  let whereExtra = "";
  let paramIdx = 5;

  if (query.place_id) {
    whereExtra += ` and v.place_id = $${paramIdx}`;
    params.push(query.place_id);
    paramIdx++;
  }
  if (query.taxon) {
    whereExtra += ` and (o.scientific_name ilike $${paramIdx} or o.vernacular_name ilike $${paramIdx})`;
    params.push(`%${query.taxon}%`);
    paramIdx++;
  }
  const mediaRole = normalizeMediaRoleQuery(query.media_role);
  if (query.media_role && !mediaRole) {
    throw new Error("invalid_media_role");
  }
  if (mediaRole) {
    whereExtra += ` and exists (
        select 1
          from evidence_asset_media_roles emr_filter
         where emr_filter.occurrence_id = o.occurrence_id
           and emr_filter.media_role = $${paramIdx}
      )`;
    params.push(mediaRole);
    paramIdx++;
  }
  if (exportReadyOnly) {
    whereExtra += ` and coalesce(odr.external_export_allowed, false) = true
        and odr.withdrawal_status = 'active'
        and odr.dataset_license is not null
        and odr.media_license is not null
        and coalesce(coc.public_precision, '') not in ('', 'exact_private')
        and (
          id_meta.authority_count > 0
          or o.evidence_tier >= 3
        )`;
  }

  const result = await getPool().query<OccurrenceRow>(
    `select
       o.occurrence_id, o.visit_id, o.scientific_name, o.vernacular_name,
       o.taxon_rank, o.evidence_tier, o.basis_of_record, o.data_quality,
       o.ai_assessment_status, v.observed_at::text,
       coalesce(v.point_latitude, p.center_latitude)::text as latitude,
       coalesce(v.point_longitude, p.center_longitude)::text as longitude,
       coalesce(p.canonical_name, 'Unknown') as place_name,
       coalesce(v.observed_municipality, p.municipality) as municipality,
       coalesce(u.display_name, 'Anonymous') as observer_name,
       photo.public_url as photo_url,
       machine_media.media_ref as machine_media_ref,
       photo.media_role as media_role,
       coc.public_precision,
       coc.risk_lane as civic_risk_lane,
       odr.record_consent,
       odr.research_use_consent,
       odr.dataset_license,
       odr.media_license,
       odr.external_export_allowed,
       odr.withdrawal_status,
       v.visit_mode,
       omc.observation_method,
       omc.protocol_id,
       v.effort_minutes::text,
       v.target_taxa_scope,
       wre.effort_minutes::text as water_effort_minutes,
       wre.target_taxa_scope as water_target_taxa_scope,
       wre.catch_outcome,
       fsc.scan_mode as field_scan_mode,
       (ogc.governance_context_id is not null) as governance_context_present,
       (ogc.review_scope <> '{}'::jsonb) as review_scope_present,
       (ogc.site_policy_context <> '{}'::jsonb) as site_policy_context_present,
       pkg_event.latest_package_stage,
       o.source_payload->'calibration' as calibration_decision,
       external_taxon_ids.external_taxon_id_count,
       case
         when id_meta.authority_count > 0 then 'authority_backed'
         when id_meta.current_count >= 2 then 'community_consensus'
         else 'tier_gate'
       end as consensus_status,
       case
         when id_meta.authority_count > 0 then 'authority_reviewed'
         when id_meta.current_count >= 2 then 'community_consensus'
         else 'tier3_export_candidate'
       end as identification_verification_status
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join places p on p.place_id = v.place_id
     left join users u on u.user_id = v.user_id
     left join observation_data_rights odr on odr.visit_id = v.visit_id
     left join civic_observation_contexts coc on coc.visit_id = v.visit_id
     left join water_record_extensions wre on wre.visit_id = v.visit_id
     left join field_scan_contexts fsc on fsc.visit_id = v.visit_id
     left join observation_governance_contexts ogc on ogc.visit_id = v.visit_id
     left join observation_method_contexts omc on omc.visit_id = v.visit_id
     left join lateral (
       select coalesce(ab.public_url, ab.storage_path) as public_url, emr.media_role
       from evidence_assets ea
       join asset_blobs ab on ab.blob_id = ea.blob_id
       left join evidence_asset_media_roles emr on emr.asset_id = ea.asset_id
       where ea.occurrence_id = o.occurrence_id
         and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
       order by ea.created_at asc limit 1
     ) photo on true
     left join lateral (
       select coalesce(
                ea.source_payload->>'spectrogram_ref',
                ea.source_payload->>'clip_ref',
                ea.source_payload->>'audio_snippet_hash',
                ea.legacy_asset_key
              ) as media_ref
         from evidence_assets ea
        where ea.occurrence_id = o.occurrence_id
          and ea.asset_role = 'observation_audio'
        order by ea.created_at asc limit 1
     ) machine_media on true
     left join lateral (
       select count(*)::int as current_count,
              count(*) filter (
                where coalesce(source_payload->>'lane', '') = 'public-claim'
                  and coalesce(source_payload->>'reviewClass', source_payload->>'review_class', '') in ('authority_backed', 'admin_override')
              )::int as authority_count
       from identifications i
       where i.occurrence_id = o.occurrence_id
         and i.actor_kind = 'human'
         and coalesce(i.is_current, true) = true
     ) id_meta on true
     left join lateral (
       select event_stage as latest_package_stage
       from observation_package_events ope
       where ope.visit_id = v.visit_id
       order by created_at desc
       limit 1
     ) pkg_event on true
     left join lateral (
       select count(*)::int as external_taxon_id_count
         from taxon_external_ids tei
        where lower(tei.taxon_name) in (lower(coalesce(o.scientific_name, '')), lower(coalesce(o.vernacular_name, '')))
          and tei.authority in ('gbif', 'easin', 'dwc_taxon', 'inat', 'local_authority')
     ) external_taxon_ids on true
     where o.evidence_tier >= $1
       and (
         (coalesce(o.basis_of_record, 'HumanObservation') <> 'MachineObservation'
          and ${PUBLIC_OBSERVATION_QUALITY_SQL}
          and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL})
         or
         ($4::boolean = true
          and o.basis_of_record = 'MachineObservation'
          and coalesce(v.quality_review_status, 'accepted') in ('accepted', 'verified', 'needs_review')
          and coalesce(v.source_payload->>'source', '') !~* '(^|[-_])(e2e|fixture|prod[-_]?media[-_]?smoke|smoke[-_]?test)([-_]|$)'
          and machine_media.media_ref is not null)
       )
       and not exists (
         select 1 from identification_disputes d
         where d.occurrence_id = o.occurrence_id and d.status = 'open'
       )
       ${whereExtra}
     order by v.observed_at desc
     limit $2 offset $3`,
    params,
  );
  return {
    records: result.rows.map(mapOccurrenceRow),
    offset,
    exportReadyOnly,
  };
}

export function registerResearchApiRoutes(app: FastifyInstance): void {
  /**
   * GET /api/v1/research/occurrences
   * Returns research-grade (Tier ≥ 3 by default) occurrences in DarwinCore-like JSON.
   * Query params:
   *   tier_gte   number  minimum evidence_tier (default 3)
   *   limit      number  max results (default 100, max 1000)
   *   offset     number  pagination offset (default 0)
   *   place_id   string  filter by place
   *   taxon      string  filter by scientific or vernacular name (partial)
   *   media_role string  filter by media role
   */
  app.get("/api/v1/research/occurrences", async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (includeMachineObservationsQuery(query)) {
      try {
        const { records, offset } = await queryResearchOccurrenceRecords(query, { defaultTierGte: 1 });
        reply.header("Cache-Control", "private, max-age=60");
        return reply.send({
          totalReturned: records.length,
          offset,
          includesMachineObservations: true,
          records,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_media_role") {
          return reply.code(400).send({ error: "invalid_media_role", allowed: MEDIA_ROLE_VALUES });
        }
        throw error;
      }
    }

    const tierGte = Math.max(1, Math.min(4, Number(query.tier_gte ?? 3)));
    const limit   = Math.min(1000, Math.max(1, Number(query.limit ?? 100)));
    const offset  = Math.max(0, Number(query.offset ?? 0));

    const params: (string | number)[] = [tierGte, limit, offset];
    let whereExtra = "";
    let paramIdx = 4;

    if (query.place_id) {
      whereExtra += ` and v.place_id = $${paramIdx}`;
      params.push(query.place_id);
      paramIdx++;
    }

    if (query.taxon) {
      whereExtra += ` and (o.scientific_name ilike $${paramIdx} or o.vernacular_name ilike $${paramIdx})`;
      params.push(`%${query.taxon}%`);
      paramIdx++;
    }

    const mediaRole = normalizeMediaRoleQuery(query.media_role);
    if (query.media_role && !mediaRole) {
      return reply.code(400).send({
        error: "invalid_media_role",
        allowed: MEDIA_ROLE_VALUES,
      });
    }
    if (mediaRole) {
      whereExtra += ` and exists (
        select 1
          from evidence_asset_media_roles emr_filter
         where emr_filter.occurrence_id = o.occurrence_id
           and emr_filter.media_role = $${paramIdx}
      )`;
      params.push(mediaRole);
      paramIdx++;
    }
    if (query.export_ready_only === "1" || query.export_ready_only === "true") {
      whereExtra += ` and coalesce(odr.external_export_allowed, false) = true
        and odr.withdrawal_status = 'active'
        and odr.dataset_license is not null
        and odr.media_license is not null
        and coalesce(coc.public_precision, '') not in ('', 'exact_private')
        and (
          id_meta.authority_count > 0
          or o.evidence_tier >= 3
        )`;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<OccurrenceRow>(
        `select
           o.occurrence_id,
           o.visit_id,
           o.scientific_name,
           o.vernacular_name,
           o.taxon_rank,
           o.evidence_tier,
           v.observed_at::text,
           coalesce(v.point_latitude,  p.center_latitude)::text  as latitude,
           coalesce(v.point_longitude, p.center_longitude)::text as longitude,
           coalesce(p.canonical_name, 'Unknown') as place_name,
           coalesce(v.observed_municipality, p.municipality)     as municipality,
           coalesce(u.display_name, 'Anonymous')                 as observer_name,
           photo.public_url                                       as photo_url,
           photo.media_role                                       as media_role,
           coc.public_precision,
           coc.risk_lane                                           as civic_risk_lane,
           odr.record_consent,
           odr.research_use_consent,
           odr.dataset_license,
           odr.media_license,
           odr.external_export_allowed,
           odr.withdrawal_status,
           v.visit_mode,
           v.effort_minutes::text,
           v.target_taxa_scope,
           wre.effort_minutes::text as water_effort_minutes,
           wre.target_taxa_scope as water_target_taxa_scope,
           wre.catch_outcome,
           fsc.scan_mode as field_scan_mode,
           (ogc.governance_context_id is not null) as governance_context_present,
           (ogc.review_scope <> '{}'::jsonb) as review_scope_present,
           (ogc.site_policy_context <> '{}'::jsonb) as site_policy_context_present,
           pkg_event.latest_package_stage,
           case
             when id_meta.authority_count > 0 then 'authority_backed'
             when id_meta.current_count >= 2 then 'community_consensus'
             else 'tier_gate'
           end as consensus_status,
           case
             when id_meta.authority_count > 0 then 'authority_reviewed'
             when id_meta.current_count >= 2 then 'community_consensus'
             else 'tier3_export_candidate'
           end as identification_verification_status
         from occurrences o
         join visits v on v.visit_id = o.visit_id
         left join places p on p.place_id = v.place_id
         left join users  u on u.user_id  = v.user_id
         left join observation_data_rights odr on odr.visit_id = v.visit_id
         left join civic_observation_contexts coc on coc.visit_id = v.visit_id
         left join water_record_extensions wre on wre.visit_id = v.visit_id
         left join field_scan_contexts fsc on fsc.visit_id = v.visit_id
         left join observation_governance_contexts ogc on ogc.visit_id = v.visit_id
         left join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url,
                  emr.media_role
           from evidence_assets ea
           join asset_blobs ab on ab.blob_id = ea.blob_id
           left join evidence_asset_media_roles emr on emr.asset_id = ea.asset_id
           where ea.occurrence_id = o.occurrence_id
             and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
           order by ea.created_at asc limit 1
         ) photo on true
         left join lateral (
           select
             count(*)::int as current_count,
             count(*) filter (
               where coalesce(source_payload->>'lane', '') = 'public-claim'
                 and coalesce(source_payload->>'reviewClass', source_payload->>'review_class', '') in ('authority_backed', 'admin_override')
             )::int as authority_count
           from identifications i
           where i.occurrence_id = o.occurrence_id
             and i.actor_kind = 'human'
             and coalesce(i.is_current, true) = true
         ) id_meta on true
         left join lateral (
           select event_stage as latest_package_stage
             from observation_package_events ope
            where ope.visit_id = v.visit_id
            order by created_at desc
            limit 1
         ) pkg_event on true
         where o.evidence_tier >= $1
           and ${PUBLIC_OBSERVATION_QUALITY_SQL}
           and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}
           and not exists (
             select 1
               from identification_disputes d
              where d.occurrence_id = o.occurrence_id
                and d.status = 'open'
           )
           ${whereExtra}
         order by v.observed_at desc
         limit $2 offset $3`,
        params,
      );

      // Return DarwinCore-inspired structure
      const records = result.rows.map((row) => ({
        observationMode:       row.field_scan_mode ? "field_scan" : row.visit_mode === "survey" ? "guide_survey" : "image_post",
        occurrenceID:         row.occurrence_id,
        eventID:              row.visit_id,
        scientificName:       row.scientific_name,
        vernacularName:       row.vernacular_name,
        taxonRank:            row.taxon_rank,
        evidenceTier:         row.evidence_tier,
        eventDate:            row.observed_at,
        decimalLatitude:      row.latitude !== null ? Number(row.latitude) : null,
        decimalLongitude:     row.longitude !== null ? Number(row.longitude) : null,
        locality:             row.place_name,
        municipality:         row.municipality,
        recordedBy:           row.observer_name,
        associatedMedia:      row.photo_url,
        associatedMediaRole:  row.media_role,
        basisOfRecord:        "HumanObservation",
        datasetName:          "ikimon Field Loop",
        license:              row.dataset_license ?? "not_export_ready",
        consensusStatus:      row.consensus_status,
        identificationVerificationStatus: row.identification_verification_status,
        readiness: {
          exportReady: Boolean(
            row.external_export_allowed
            && row.withdrawal_status === "active"
            && row.dataset_license
            && row.media_license
            && row.public_precision
            && row.public_precision !== "exact_private"
            && (row.consensus_status === "authority_backed" || row.evidence_tier >= 3)
          ),
          reviewReady: row.identification_verification_status !== "tier3_export_candidate" || row.evidence_tier >= 3,
          modelReady: Boolean(
            row.place_name
            && row.observed_at
            && (row.visit_mode === "survey" || row.field_scan_mode || row.catch_outcome)
            && (row.effort_minutes || row.water_effort_minutes)
            && row.photo_url
          ),
          indicatorReady: Boolean(
            row.field_scan_mode
            && row.review_scope_present
            && (row.effort_minutes || row.water_effort_minutes)
            && (row.consensus_status === "authority_backed" || row.identification_verification_status === "authority_reviewed")
          ),
          governanceReady: Boolean(row.governance_context_present && row.site_policy_context_present && row.review_scope_present),
          fieldScanReady: row.field_scan_mode
            ? Boolean(row.field_scan_mode && row.photo_url && (row.effort_minutes || row.water_effort_minutes))
            : true,
        },
        methodContext: {
          visitMode: row.visit_mode,
          fieldScanMode: row.field_scan_mode,
          catchOutcome: row.catch_outcome,
          effortMinutes: row.water_effort_minutes !== null ? Number(row.water_effort_minutes) : row.effort_minutes !== null ? Number(row.effort_minutes) : null,
          targetTaxaScope: row.water_target_taxa_scope ?? row.target_taxa_scope,
        },
        dataProductChain: {
          exportFormat: "darwin_core_csv_v0",
          latestStage: row.latest_package_stage ?? "raw_observation",
          reportOutput: "metadata_plus_qa_report",
        },
        trendAbundancePolicy: {
          claimAllowed: Boolean(row.field_scan_mode && row.review_scope_present && row.consensus_status === "authority_backed"),
          defaultClaimLimit: row.catch_outcome === "no_catch"
            ? "capture_attempt_only"
            : row.field_scan_mode
              ? "indicator_candidate"
              : "presence_only",
        },
        dataGeneralizations: {
          location: row.public_precision ?? "not_set",
        },
        informationWithheld: [
          row.public_precision && row.public_precision !== "exact_private" ? "precise_coordinates" : null,
          row.civic_risk_lane && row.civic_risk_lane !== "normal" ? "risk_lane_sensitive_context" : null,
          row.governance_context_present ? "local_knowledge_or_site_policy_context" : null,
        ].filter(Boolean),
        licenseStatus: {
          recordConsent: row.record_consent ?? "missing",
          researchUseConsent: row.research_use_consent ?? "missing",
          datasetLicense: row.dataset_license,
          mediaLicense: row.media_license,
          externalExportAllowed: Boolean(row.external_export_allowed),
          withdrawalStatus: row.withdrawal_status ?? "missing",
        },
      }));

      reply.header("Cache-Control", "public, max-age=300");
      return reply.send({
        totalReturned: records.length,
        offset,
        records,
      });
    } finally {
      client.release();
    }
  });

  app.get("/api/v1/research/darwin-core.csv", async (request, reply) => {
    try {
      const { records } = await queryResearchOccurrenceRecords(
        request.query as Record<string, string>,
        { forceExportReadyOnly: true, defaultTierGte: 3 },
      );
      reply
        .header("Cache-Control", "private, max-age=60")
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", "attachment; filename=\"ikimon-darwin-core-v0.csv\"")
        .header("X-Ikimon-Export-Format", "darwin_core_csv_v0")
        .header("X-Ikimon-Export-Ready-Only", "true");
      return reply.send(toDarwinCoreCsvV0(records));
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_media_role") {
        return reply.code(400).send({ error: "invalid_media_role", allowed: MEDIA_ROLE_VALUES });
      }
      throw error;
    }
  });

  app.get("/api/v1/research/export-qa-report", async (request, reply) => {
    try {
      const { records, offset, exportReadyOnly } = await queryResearchOccurrenceRecords(
        request.query as Record<string, string>,
        { defaultTierGte: 1 },
      );
      reply.header("Cache-Control", "private, max-age=60");
      return reply.send({
        offset,
        exportReadyOnly,
        ...buildResearchExportQaReport(records),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_media_role") {
        return reply.code(400).send({ error: "invalid_media_role", allowed: MEDIA_ROLE_VALUES });
      }
      throw error;
    }
  });

  app.get("/api/v1/research/media-role-summary", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const tierGte = Math.max(1, Math.min(4, Number(query.tier_gte ?? 1)));
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{
        media_role: string;
        asset_role: string;
        asset_count: string;
        occurrence_count: string;
      }>(
        `select
            emr.media_role,
            emr.asset_role,
            count(distinct emr.asset_id)::text as asset_count,
            count(distinct emr.occurrence_id)::text as occurrence_count
         from evidence_asset_media_roles emr
         join occurrences o on o.occurrence_id = emr.occurrence_id
         join visits v on v.visit_id = emr.visit_id
         where o.evidence_tier >= $1
           and ${PUBLIC_OBSERVATION_QUALITY_SQL}
           and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}
         group by emr.media_role, emr.asset_role
         order by emr.media_role asc, emr.asset_role asc`,
        [tierGte],
      );

      reply.header("Cache-Control", "public, max-age=300");
      return reply.send({
        tierGte,
        roles: result.rows.map((row) => ({
          mediaRole: row.media_role,
          assetRole: row.asset_role,
          assetCount: Number(row.asset_count),
          occurrenceCount: Number(row.occurrence_count),
        })),
      });
    } finally {
      client.release();
    }
  });
}
