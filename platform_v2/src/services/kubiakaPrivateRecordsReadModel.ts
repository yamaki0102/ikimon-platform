export const KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY = "kubiaka-watch";
export const KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS = 6;
export const KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT = 24;

/** Compatibility type for tests and retired Fastify adapters. */
export type KubiakaPrivateRecordsDbQuery = <T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
) => Promise<{ rows: T[] }>;

/**
 * Scope authority now lives in the Cloudflare D1 table
 * `kubiaka_private_records`; this marker is intentionally not executable SQL.
 */
export const KUBIAKA_PRIVATE_RECORD_SCOPE_SQL = "cloudflare_d1_kubiaka_private_record_owner_scope_v1";

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

/**
 * No legacy Fastify route is registered after the Worker cutover. Returning an
 * empty read model is safer than attempting to reconstruct private records
 * from the retired PostgreSQL schema.
 */
export async function readOwnedKubiakaRecordOverview(
  _userId: string,
  _query?: KubiakaPrivateRecordsDbQuery,
): Promise<KubiakaPrivateRecordOverview> {
  return { totalCount: 0, latest: null };
}

export async function listOwnedKubiakaRecords(
  _userId: string,
  _query?: KubiakaPrivateRecordsDbQuery,
  limit = KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
): Promise<KubiakaPrivateRecordPage> {
  const safeLimit = Math.max(1, Math.min(KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT, Math.floor(limit)));
  return { totalCount: 0, records: [], limit: safeLimit, hasMore: false };
}

export async function readOwnedKubiakaRecordDetail(
  _visitId: string,
  _userId: string,
  _query?: KubiakaPrivateRecordsDbQuery,
): Promise<KubiakaPrivateRecordDetail | null> {
  return null;
}

export async function readOwnedKubiakaPrivateMedia(
  _visitId: string,
  _photoIndex: number,
  _userId: string,
  _query?: KubiakaPrivateRecordsDbQuery,
): Promise<KubiakaPrivateMediaLocator | null> {
  return null;
}

export async function readOwnedKubiakaAcknowledgement(
  _recordId: string,
  _userId: string,
  _query?: KubiakaPrivateRecordsDbQuery,
): Promise<KubiakaPrivateAcknowledgement | null> {
  return null;
}
