import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export const OBSERVATION_DATA_RIGHTS_POLICY_VERSION = "site_intelligence_p0_v2";
export const PUBLICATION_CONSENT_VERSION = "external_publication_consent_v2";

export type RecordConsent = "private" | "internal" | "public_summary" | "external_export";
export type ResearchUseConsent = "none" | "internal" | "research_allowed" | "public_export";
export type EnterpriseReportConsent = "none" | "internal" | "aggregated" | "identified";
export type DatasetLicense = "CC0-1.0" | "CC-BY-4.0";
export type MediaLicense = "all_rights_reserved" | "CC-BY-4.0" | "CC-BY-NC-4.0";
export type WithdrawalStatus = "active" | "withdrawn" | "delete_requested" | "deleted";
export type AreaProfileUseConsent = "none" | "internal" | "aggregated_public" | "manager_report" | "external_export";
export type PublicProfileAttributionMode = "anonymous" | "credited" | "hidden";
export type ConsentSource = "default" | "user_selected" | "manager_policy" | "migration_backfill";

export type ObservationDataRights = {
  visitId: string;
  occurrenceId: string | null;
  recordConsent: RecordConsent;
  researchUseConsent: ResearchUseConsent;
  enterpriseReportConsent: EnterpriseReportConsent;
  datasetLicense: DatasetLicense | null;
  mediaLicense: MediaLicense | null;
  externalExportAllowed: boolean;
  areaProfileUseConsent: AreaProfileUseConsent;
  publicAggregationAllowed: boolean;
  publicProfileAttributionMode: PublicProfileAttributionMode;
  consentSource: ConsentSource;
  rightsPolicyVersion: string;
  withdrawalStatus: WithdrawalStatus;
  sourcePayload: Record<string, unknown>;
};

export type ObservationDataRightsInput = Partial<Omit<ObservationDataRights, "visitId" | "occurrenceId">> & {
  visitId?: string;
  occurrenceId?: string | null;
  sourcePayload?: Record<string, unknown> | null;
};

const RECORD_CONSENTS: RecordConsent[] = ["private", "internal", "public_summary", "external_export"];
const RESEARCH_CONSENTS: ResearchUseConsent[] = ["none", "internal", "research_allowed", "public_export"];
const ENTERPRISE_CONSENTS: EnterpriseReportConsent[] = ["none", "internal", "aggregated", "identified"];
const DATASET_LICENSES: DatasetLicense[] = ["CC0-1.0", "CC-BY-4.0"];
const MEDIA_LICENSES: MediaLicense[] = ["all_rights_reserved", "CC-BY-4.0", "CC-BY-NC-4.0"];
const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["active", "withdrawn", "delete_requested", "deleted"];
const AREA_PROFILE_USE_CONSENTS: AreaProfileUseConsent[] = ["none", "internal", "aggregated_public", "manager_report", "external_export"];
const PUBLIC_PROFILE_ATTRIBUTION_MODES: PublicProfileAttributionMode[] = ["anonymous", "credited", "hidden"];
const CONSENT_SOURCES: ConsentSource[] = ["default", "user_selected", "manager_policy", "migration_backfill"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? value as T : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanPolicyVersion(value: unknown): string {
  if (typeof value !== "string") return OBSERVATION_DATA_RIGHTS_POLICY_VERSION;
  const trimmed = value.trim();
  return trimmed || OBSERVATION_DATA_RIGHTS_POLICY_VERSION;
}

export function normalizeObservationDataRights(input: ObservationDataRightsInput & {
  visitId: string;
  occurrenceId?: string | null;
}): ObservationDataRights {
  const recordConsent = oneOf(input.recordConsent, RECORD_CONSENTS, "private");
  const researchUseConsent = oneOf(input.researchUseConsent, RESEARCH_CONSENTS, "none");
  const datasetLicense = optionalOneOf(input.datasetLicense, DATASET_LICENSES);
  const mediaLicense = optionalOneOf(input.mediaLicense, MEDIA_LICENSES);
  const withdrawalStatus = oneOf(input.withdrawalStatus, WITHDRAWAL_STATUSES, "active");
  const areaProfileUseConsent = oneOf(input.areaProfileUseConsent, AREA_PROFILE_USE_CONSENTS, "none");
  const requestedAggregation = Boolean(input.publicAggregationAllowed);
  const consentSource = oneOf(input.consentSource, CONSENT_SOURCES, "default");
  const legacyOpenLicenseExternalConsent = Boolean(input.externalExportAllowed)
    && recordConsent === "external_export"
    && researchUseConsent === "public_export"
    && Boolean(datasetLicense)
    && Boolean(mediaLicense)
    && withdrawalStatus === "active";
  const directExternalConsent = Boolean(input.externalExportAllowed)
    && recordConsent === "external_export"
    && researchUseConsent === "none"
    && consentSource === "user_selected"
    && withdrawalStatus === "active";
  const exportAllowed = legacyOpenLicenseExternalConsent || directExternalConsent;
  const aggregationAllowed = requestedAggregation
    && (areaProfileUseConsent === "aggregated_public" || areaProfileUseConsent === "external_export")
    && (recordConsent === "public_summary" || recordConsent === "external_export")
    && withdrawalStatus === "active";

  const rightsPolicyVersion = cleanPolicyVersion(input.rightsPolicyVersion);
  const sourcePayload = asRecord(input.sourcePayload);
  if (consentSource === "user_selected" && (recordConsent === "public_summary" || recordConsent === "external_export")) {
    sourcePayload.publicationConsentVersion = PUBLICATION_CONSENT_VERSION;
  }

  return {
    visitId: input.visitId,
    occurrenceId: input.occurrenceId ?? null,
    recordConsent,
    researchUseConsent,
    enterpriseReportConsent: oneOf(input.enterpriseReportConsent, ENTERPRISE_CONSENTS, "none"),
    datasetLicense,
    mediaLicense,
    externalExportAllowed: exportAllowed,
    areaProfileUseConsent,
    publicAggregationAllowed: aggregationAllowed,
    publicProfileAttributionMode: aggregationAllowed
      ? oneOf(input.publicProfileAttributionMode, PUBLIC_PROFILE_ATTRIBUTION_MODES, "anonymous")
      : "hidden",
    consentSource,
    rightsPolicyVersion,
    withdrawalStatus,
    sourcePayload,
  };
}

export async function upsertObservationDataRights(
  input: ObservationDataRightsInput & { visitId: string; occurrenceId?: string | null },
  queryable: Queryable = getPool(),
): Promise<ObservationDataRights> {
  const rights = normalizeObservationDataRights(input);
  await queryable.query(
    `insert into observation_data_rights (
       visit_id, occurrence_id, record_consent, research_use_consent, enterprise_report_consent,
       dataset_license, media_license, external_export_allowed,
       area_profile_use_consent, public_aggregation_allowed, public_profile_attribution_mode,
       consent_source, rights_policy_version,
       withdrawal_status, source_payload, updated_at
     ) values (
       $1, $2, $3, $4, $5,
       $6, $7, $8,
       $9, $10, $11,
       $12, $13,
       $14, $15::jsonb, now()
     )
     on conflict (visit_id) do update set
       occurrence_id = excluded.occurrence_id,
       record_consent = excluded.record_consent,
       research_use_consent = excluded.research_use_consent,
       enterprise_report_consent = excluded.enterprise_report_consent,
       dataset_license = excluded.dataset_license,
       media_license = excluded.media_license,
       external_export_allowed = excluded.external_export_allowed,
       area_profile_use_consent = excluded.area_profile_use_consent,
       public_aggregation_allowed = excluded.public_aggregation_allowed,
       public_profile_attribution_mode = excluded.public_profile_attribution_mode,
       consent_source = excluded.consent_source,
       rights_policy_version = excluded.rights_policy_version,
       withdrawal_status = excluded.withdrawal_status,
       source_payload = excluded.source_payload,
       updated_at = now()`,
    [
      rights.visitId,
      rights.occurrenceId,
      rights.recordConsent,
      rights.researchUseConsent,
      rights.enterpriseReportConsent,
      rights.datasetLicense,
      rights.mediaLicense,
      rights.externalExportAllowed,
      rights.areaProfileUseConsent,
      rights.publicAggregationAllowed,
      rights.publicProfileAttributionMode,
      rights.consentSource,
      rights.rightsPolicyVersion,
      rights.withdrawalStatus,
      JSON.stringify(rights.sourcePayload),
    ],
  );
  return rights;
}

export async function getObservationDataRights(
  visitId: string,
  queryable: Queryable = getPool(),
): Promise<ObservationDataRights | null> {
  const result = await queryable.query<{
    visit_id: string;
    occurrence_id: string | null;
    record_consent: RecordConsent;
    research_use_consent: ResearchUseConsent;
    enterprise_report_consent: EnterpriseReportConsent;
    dataset_license: DatasetLicense | null;
    media_license: MediaLicense | null;
    external_export_allowed: boolean;
    area_profile_use_consent: AreaProfileUseConsent | null;
    public_aggregation_allowed: boolean | null;
    public_profile_attribution_mode: PublicProfileAttributionMode | null;
    consent_source: ConsentSource | null;
    rights_policy_version: string | null;
    withdrawal_status: WithdrawalStatus;
    source_payload: Record<string, unknown> | null;
  }>(
    `select visit_id, occurrence_id, record_consent, research_use_consent, enterprise_report_consent,
            dataset_license, media_license, external_export_allowed,
            area_profile_use_consent, public_aggregation_allowed, public_profile_attribution_mode,
            consent_source, rights_policy_version,
            withdrawal_status, source_payload
       from observation_data_rights
      where visit_id = $1
      limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return normalizeObservationDataRights({
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    recordConsent: row.record_consent,
    researchUseConsent: row.research_use_consent,
    enterpriseReportConsent: row.enterprise_report_consent,
    datasetLicense: row.dataset_license,
    mediaLicense: row.media_license,
    externalExportAllowed: row.external_export_allowed,
    areaProfileUseConsent: row.area_profile_use_consent ?? "none",
    publicAggregationAllowed: row.public_aggregation_allowed === true,
    publicProfileAttributionMode: row.public_profile_attribution_mode ?? "hidden",
    consentSource: row.consent_source ?? "default",
    rightsPolicyVersion: row.rights_policy_version ?? OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
    withdrawalStatus: row.withdrawal_status,
    sourcePayload: row.source_payload ?? {},
  });
}
