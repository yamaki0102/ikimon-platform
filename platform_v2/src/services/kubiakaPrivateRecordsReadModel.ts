import { getPool } from "../db.js";

export const KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY = "kubiaka-watch";
export const KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS = 6;
export const KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT = 24;

export type KubiakaPrivateRecordsDbQuery = <T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
) => Promise<{ rows: T[] }>;

export type KubiakaPrivateRecordSummary = {
  visitId: string;
  observedAt: string;
  savedAt: string;
  aiAssessmentStatus: string;
  photoCount: number;
};

export type KubiakaPrivateRecordOverview = {
  totalCount: number;
  latest: KubiakaPrivateRecordSummary | null;
};

export type KubiakaPrivateRecordPage = {
  totalCount: number;
  records: KubiakaPrivateRecordSummary[];
  limit: number;
  hasMore: boolean;
};

export type KubiakaPrivateRecordPhoto = {
  photoIndex: number;
  mimeType: string;
  widthPx: number | null;
  heightPx: number | null;
};

export type KubiakaPrivateRecordDetail = KubiakaPrivateRecordSummary & {
  photos: KubiakaPrivateRecordPhoto[];
};

export type KubiakaPrivateMediaLocator = {
  storagePath: string;
  mimeType: string;
};

export type KubiakaPrivateAcknowledgement = {
  recordId: string;
  visitId: string;
  photoCount: number;
};

type SummaryRow = {
  visit_id: string;
  observed_at: string | Date;
  saved_at: string | Date;
  ai_assessment_status: string | null;
  photo_count: string | number;
  total_count?: string | number;
};

type PhotoRow = {
  photo_index: string | number;
  mime_type: string | null;
  width_px: string | number | null;
  height_px: string | number | null;
};

const PRIVATE_PHOTO_PREDICATE = `
  ea.asset_role = 'observation_photo'
  and ab.storage_backend = 'local_private_fs'
  and ab.public_url is null
  and ab.storage_path like 'private-photos/%'
  and ea.source_payload ->> 'private_experience' = 'true'
  and ea.source_payload ->> 'public_delivery_allowed' = 'false'
  and ab.source_payload ->> 'private_experience' = 'true'
  and ab.source_payload ->> 'public_delivery_allowed' = 'false'
`;

export const KUBIAKA_PRIVATE_RECORD_SCOPE_SQL = `
  v.user_id = $1
  and v.public_visibility = 'hidden'
  and v.source_payload ->> 'experience_key' = $2
  and v.source_payload ->> 'private_record' = 'true'
  and v.source_payload ->> 'public_aggregation_allowed' = 'false'
  and v.source_payload ->> 'research_use_allowed' = 'false'
  and v.source_payload ->> 'enterprise_use_allowed' = 'false'
  and v.source_payload ->> 'external_export_allowed' = 'false'
  and v.source_payload ->> 'external_routing_allowed' = 'false'
  and v.source_payload ->> 'automatic_recipient_delivery_allowed' = 'false'
`;

function appDbQuery<T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
): Promise<{ rows: T[] }> {
  return getPool().query<T>(text, values);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function safeCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function summaryFromRow(row: SummaryRow): KubiakaPrivateRecordSummary | null {
  const photoCount = safeCount(row.photo_count);
  const visitId = String(row.visit_id ?? "").trim();
  const observedAt = toIso(row.observed_at);
  const savedAt = toIso(row.saved_at);
  if (!visitId || !observedAt || !savedAt) return null;
  if (photoCount < 1 || photoCount > KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS) return null;
  return {
    visitId,
    observedAt,
    savedAt,
    aiAssessmentStatus: String(row.ai_assessment_status ?? "not_requested").trim() || "not_requested",
    photoCount,
  };
}

function scopedRecordsCte(ownerParameter = "$1", experienceParameter = "$2"): string {
  const scope = KUBIAKA_PRIVATE_RECORD_SCOPE_SQL
    .replaceAll("$1", ownerParameter)
    .replaceAll("$2", experienceParameter);
  return `with scoped_kubiaka_records as (
    select
      v.visit_id::text as visit_id,
      v.observed_at,
      greatest(v.created_at, coalesce(photo_facts.saved_at, v.created_at)) as saved_at,
      case
        when latest_assessment.generated_at is not null then 'completed'
        else coalesce(nullif(primary_occurrence.ai_assessment_status, ''), 'not_requested')
      end as ai_assessment_status,
      photo_facts.photo_count
    from visits v
    left join lateral (
      select o.ai_assessment_status
      from occurrences o
      where o.visit_id = v.visit_id
      order by o.subject_index asc, o.created_at asc
      limit 1
    ) primary_occurrence on true
    left join lateral (
      select aa.generated_at
      from observation_ai_assessments aa
      where aa.visit_id = v.visit_id
      order by aa.generated_at desc, aa.created_at desc
      limit 1
    ) latest_assessment on true
    join lateral (
      select count(distinct ea.asset_id)::int as photo_count,
             max(ea.created_at) as saved_at
      from evidence_assets ea
      join asset_blobs ab on ab.blob_id = ea.blob_id
      where ea.visit_id = v.visit_id
        and ${PRIVATE_PHOTO_PREDICATE}
    ) photo_facts on photo_facts.photo_count between 1 and ${KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS}
    where ${scope}
  )`;
}

export async function readOwnedKubiakaRecordOverview(
  userId: string,
  query: KubiakaPrivateRecordsDbQuery = appDbQuery,
): Promise<KubiakaPrivateRecordOverview> {
  const result = await query<SummaryRow & { total_count: string | number }>(
    `${scopedRecordsCte()}
     select totals.total_count,
            latest.visit_id,
            latest.observed_at,
            latest.saved_at,
            latest.ai_assessment_status,
            latest.photo_count
       from (select count(*)::int as total_count from scoped_kubiaka_records) totals
       left join lateral (
         select * from scoped_kubiaka_records
         order by saved_at desc, visit_id desc
         limit 1
       ) latest on true`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY],
  );
  const row = result.rows[0];
  if (!row) return { totalCount: 0, latest: null };
  return {
    totalCount: safeCount(row.total_count),
    latest: row.visit_id ? summaryFromRow(row) : null,
  };
}

export async function listOwnedKubiakaRecords(
  userId: string,
  query: KubiakaPrivateRecordsDbQuery = appDbQuery,
  limit = KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
): Promise<KubiakaPrivateRecordPage> {
  const safeLimit = Math.max(1, Math.min(KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT, Math.floor(limit)));
  const result = await query<SummaryRow>(
    `${scopedRecordsCte()}
     select visit_id, observed_at, saved_at, ai_assessment_status, photo_count,
            count(*) over()::int as total_count
       from scoped_kubiaka_records
      order by saved_at desc, visit_id desc
      limit $3`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, safeLimit],
  );
  const records = result.rows
    .map(summaryFromRow)
    .filter((record): record is KubiakaPrivateRecordSummary => record !== null);
  const totalCount = result.rows[0] ? safeCount(result.rows[0].total_count) : 0;
  return {
    totalCount,
    records,
    limit: safeLimit,
    hasMore: totalCount > records.length,
  };
}

export async function readOwnedKubiakaRecordDetail(
  visitId: string,
  userId: string,
  query: KubiakaPrivateRecordsDbQuery = appDbQuery,
): Promise<KubiakaPrivateRecordDetail | null> {
  const summaryResult = await query<SummaryRow>(
    `${scopedRecordsCte()}
     select visit_id, observed_at, saved_at, ai_assessment_status, photo_count
       from scoped_kubiaka_records
      where visit_id = $3
      limit 1`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, visitId],
  );
  const summary = summaryResult.rows[0] ? summaryFromRow(summaryResult.rows[0]) : null;
  if (!summary) return null;

  const photoResult = await query<PhotoRow>(
    `select row_number() over (order by ea.created_at asc, ea.asset_id asc)::int as photo_index,
            coalesce(nullif(ab.mime_type, ''), 'image/jpeg') as mime_type,
            ab.width_px,
            ab.height_px
       from visits v
       join evidence_assets ea on ea.visit_id = v.visit_id
       join asset_blobs ab on ab.blob_id = ea.blob_id
      where ${KUBIAKA_PRIVATE_RECORD_SCOPE_SQL}
        and v.visit_id = $3
        and ${PRIVATE_PHOTO_PREDICATE}
      order by ea.created_at asc, ea.asset_id asc
      limit ${KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS}`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, visitId],
  );
  const photos = photoResult.rows.map((row) => ({
    photoIndex: safeCount(row.photo_index),
    mimeType: String(row.mime_type ?? "image/jpeg"),
    widthPx: row.width_px === null ? null : safeCount(row.width_px),
    heightPx: row.height_px === null ? null : safeCount(row.height_px),
  })).filter((photo) => photo.photoIndex >= 1 && photo.photoIndex <= KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS);
  if (photos.length !== summary.photoCount || photos.length < 1 || photos.length > KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS) {
    return null;
  }
  return { ...summary, photos };
}

export async function readOwnedKubiakaPrivateMedia(
  visitId: string,
  photoIndex: number,
  userId: string,
  query: KubiakaPrivateRecordsDbQuery = appDbQuery,
): Promise<KubiakaPrivateMediaLocator | null> {
  if (!Number.isInteger(photoIndex) || photoIndex < 1 || photoIndex > KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS) {
    return null;
  }
  const result = await query<{ storage_path: string; mime_type: string | null }>(
    `${scopedRecordsCte()}
     select ab.storage_path,
            coalesce(nullif(ab.mime_type, ''), 'image/jpeg') as mime_type
       from scoped_kubiaka_records scoped
       join evidence_assets ea on ea.visit_id = scoped.visit_id
       join asset_blobs ab on ab.blob_id = ea.blob_id
      where scoped.visit_id = $3
        and ${PRIVATE_PHOTO_PREDICATE}
      order by ea.created_at asc, ea.asset_id asc
      offset ($4::int - 1)
      limit 1`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, visitId, photoIndex],
  );
  const row = result.rows[0];
  if (!row) return null;
  const storagePath = String(row.storage_path ?? "").trim();
  const mimeType = String(row.mime_type ?? "image/jpeg").trim().toLowerCase();
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!storagePath.startsWith("private-photos/") || !allowedMimeTypes.has(mimeType)) return null;
  return { storagePath, mimeType };
}

export async function readOwnedKubiakaAcknowledgement(
  recordId: string,
  userId: string,
  query: KubiakaPrivateRecordsDbQuery = appDbQuery,
): Promise<KubiakaPrivateAcknowledgement | null> {
  const result = await query<{ visit_id: string; photo_count: string | number }>(
    `select v.visit_id::text,
            count(distinct ea.asset_id)::int as photo_count
       from visits v
       left join occurrences o on o.visit_id = v.visit_id
       join evidence_assets ea on ea.visit_id = v.visit_id
       join asset_blobs ab on ab.blob_id = ea.blob_id
      where ${KUBIAKA_PRIVATE_RECORD_SCOPE_SQL}
        and (v.visit_id::text = $3 or o.occurrence_id::text = $3)
        and ${PRIVATE_PHOTO_PREDICATE}
      group by v.visit_id
     having count(distinct ea.asset_id) between 1 and ${KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS}
      limit 1`,
    [userId, KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, recordId],
  );
  const row = result.rows[0];
  const photoCount = safeCount(row?.photo_count);
  return row && photoCount >= 1 && photoCount <= KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS
    ? { recordId, visitId: row.visit_id, photoCount }
    : null;
}
