type LegacyTaxonLike = {
  scientific_name?: unknown;
  name?: unknown;
  rank?: unknown;
};

export type LegacyObservationQualityInput = {
  id?: unknown;
  photos?: unknown;
  lat?: unknown;
  lng?: unknown;
  municipality?: unknown;
  prefecture?: unknown;
  site_id?: unknown;
  site_name?: unknown;
  taxon?: LegacyTaxonLike | null;
  ai_assessments?: unknown;
};

export type ObservationQualitySignals = {
  hasPhoto: boolean;
  hasAudio: boolean;
  hasLocation: boolean;
  hasIdentification: boolean;
  isPublicReady: boolean;
  gateReasons: string[];
};

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function hasFiniteCoordinate(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") return Number.isFinite(Number.parseFloat(value));
  return false;
}

export function hasLegacyObservationPhoto(observation: LegacyObservationQualityInput): boolean {
  if (!Array.isArray(observation.photos)) return false;
  return observation.photos.some(hasNonEmptyString);
}

export function assessLegacyObservationQuality(observation: LegacyObservationQualityInput): ObservationQualitySignals {
  const hasPhoto = hasLegacyObservationPhoto(observation);
  const hasAudio = false;
  const hasLocation =
    (hasFiniteCoordinate(observation.lat) && hasFiniteCoordinate(observation.lng)) ||
    hasNonEmptyString(observation.municipality) ||
    hasNonEmptyString(observation.prefecture) ||
    hasNonEmptyString(observation.site_id) ||
    hasNonEmptyString(observation.site_name);
  const taxon = observation.taxon && typeof observation.taxon === "object" ? observation.taxon : null;
  const hasIdentification =
    hasNonEmptyString(taxon?.scientific_name) ||
    hasNonEmptyString(taxon?.name) ||
    hasNonEmptyString(taxon?.rank) ||
    (Array.isArray(observation.ai_assessments) && observation.ai_assessments.length > 0);
  const gateReasons = [
    hasPhoto ? null : "missing_photo",
    hasAudio ? null : "missing_audio",
    hasLocation ? null : "missing_location",
    hasIdentification ? null : "missing_identification",
  ].filter((reason): reason is string => reason !== null);

  return {
    hasPhoto,
    hasAudio,
    hasLocation,
    hasIdentification,
    isPublicReady: hasPhoto || hasAudio || hasLocation || hasIdentification,
    gateReasons,
  };
}

export function shouldQuarantineLegacyNoPhoto(observation: LegacyObservationQualityInput): boolean {
  return !hasLegacyObservationPhoto(observation);
}

export function hasNativeObservationPhoto(photos: unknown): boolean {
  if (!Array.isArray(photos)) return false;
  return photos.some((photo) => {
    if (!photo || typeof photo !== "object") return false;
    const path = (photo as { path?: unknown }).path;
    return hasNonEmptyString(path);
  });
}

export const PUBLIC_OBSERVATION_QUALITY_SQL = `
  coalesce(v.public_visibility, 'public') = 'public'
  and coalesce(v.quality_review_status, 'accepted') = 'accepted'
`;

export const VALID_OBSERVATION_PHOTO_ASSET_SQL = `
  ea.asset_role = 'observation_photo'
  and coalesce(nullif(lower(ea.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
  and coalesce(nullif(lower(ab.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
  and nullif(coalesce(ab.public_url, ab.storage_path), '') is not null
`;

export const PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL = `
  exists (
    select 1
      from evidence_assets public_photo_ea
      join asset_blobs public_photo_ab on public_photo_ab.blob_id = public_photo_ea.blob_id
     where public_photo_ea.visit_id = v.visit_id
       and public_photo_ea.asset_role = 'observation_photo'
       and coalesce(nullif(lower(public_photo_ea.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
       and coalesce(nullif(lower(public_photo_ab.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
       and nullif(coalesce(public_photo_ab.public_url, public_photo_ab.storage_path), '') is not null
  )
`;

export async function upsertLegacyObservationQualityReview(
  db: Queryable,
  input: {
    observation: LegacyObservationQualityInput;
    importVersion: string;
    reasonCode: string;
    reasonDetail: string;
    legacyPath?: string;
  },
): Promise<void> {
  const legacyId = hasNonEmptyString(input.observation.id) ? String(input.observation.id) : "";
  if (legacyId === "") return;
  const signals = assessLegacyObservationQuality(input.observation);
  await db.query(
    `insert into observation_quality_reviews (
        review_kind, review_status, legacy_source, legacy_entity_type, legacy_id,
        reason_code, reason_detail, public_visibility, quality_signals, source_payload, import_version
     ) values (
        'import_quarantine', 'needs_review', 'php_json', 'observation', $1,
        $2, $3, 'review', $4::jsonb, $5::jsonb, $6
     )
     on conflict (legacy_source, legacy_entity_type, legacy_id, import_version)
     where legacy_id is not null
     do update set
        review_status = 'needs_review',
        reason_code = excluded.reason_code,
        reason_detail = excluded.reason_detail,
        public_visibility = excluded.public_visibility,
        quality_signals = excluded.quality_signals,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      legacyId,
      input.reasonCode,
      input.reasonDetail,
      JSON.stringify(signals),
      JSON.stringify({
        ...input.observation,
        _legacy_path: input.legacyPath ?? null,
      }),
      input.importVersion,
    ],
  );
}

export async function upsertVisitQualityReview(
  db: Queryable,
  input: {
    visitId: string;
    occurrenceId?: string | null;
    reasonCode: string;
    reasonDetail: string;
    qualitySignals: ObservationQualitySignals;
    sourcePayload?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `insert into observation_quality_reviews (
        review_kind, review_status, visit_id, occurrence_id,
        reason_code, reason_detail, public_visibility, quality_signals, source_payload
     ) values (
        'native_write_review', 'needs_review', $1, $2,
        $3, $4, 'review', $5::jsonb, $6::jsonb
     )
     on conflict (visit_id, reason_code)
     where visit_id is not null and review_status = 'needs_review'
     do update set
        occurrence_id = excluded.occurrence_id,
        reason_detail = excluded.reason_detail,
        public_visibility = excluded.public_visibility,
        quality_signals = excluded.quality_signals,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      input.visitId,
      input.occurrenceId ?? null,
      input.reasonCode,
      input.reasonDetail,
      JSON.stringify(input.qualitySignals),
      JSON.stringify(input.sourcePayload ?? {}),
    ],
  );
}
