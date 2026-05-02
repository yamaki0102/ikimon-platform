import { getPool } from "../db.js";
import type { OfficialNoticeSnapshot } from "./officialNotices.js";

type CacheRow = {
  snapshot: OfficialNoticeSnapshot;
  fetched_at: Date;
  expires_at: Date;
};

export type CachedOfficialNoticeSnapshot = {
  snapshot: OfficialNoticeSnapshot;
  fetchedAt: Date;
  expiresAt: Date;
  isExpired: boolean;
};

export async function getCachedOfficialNoticeSnapshot(
  sourceId: string,
): Promise<CachedOfficialNoticeSnapshot | null> {
  try {
    const pool = getPool();
    const res = await pool.query<CacheRow>(
      `SELECT snapshot, fetched_at, expires_at
         FROM official_notice_cache
        WHERE source_id = $1
        LIMIT 1`,
      [sourceId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      snapshot: row.snapshot,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      isExpired: row.expires_at.getTime() <= Date.now(),
    };
  } catch {
    return null;
  }
}

export async function putCachedOfficialNoticeSnapshot(
  sourceId: string,
  parserKey: string,
  sourcePageUrl: string,
  snapshot: OfficialNoticeSnapshot,
  ttlHours: number,
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO official_notice_cache (
         source_id,
         parser_key,
         source_page_url,
         snapshot,
         fetched_at,
         expires_at,
         updated_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4::jsonb,
         NOW(),
         NOW() + ($5 || ' hours')::INTERVAL,
         NOW()
       )
       ON CONFLICT (source_id) DO UPDATE
           SET parser_key = EXCLUDED.parser_key,
               source_page_url = EXCLUDED.source_page_url,
               snapshot = EXCLUDED.snapshot,
               fetched_at = EXCLUDED.fetched_at,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()`,
      [sourceId, parserKey, sourcePageUrl, JSON.stringify(snapshot), String(ttlHours)],
    );
  } catch {
    // Cache write failure must never block the request path.
  }
}

export async function purgeExpiredOfficialNoticeCache(): Promise<number> {
  try {
    const pool = getPool();
    const res = await pool.query("DELETE FROM official_notice_cache WHERE expires_at <= NOW()");
    return (res as unknown as { rowCount?: number | null }).rowCount ?? 0;
  } catch {
    return 0;
  }
}
