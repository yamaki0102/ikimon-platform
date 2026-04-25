/**
 * PostgreSQL-backed cache for SiteSignals.
 * TTL defaults to 24h; callers can pass a shorter duration for dynamic
 * environments (waterways, tidal zones) where habitat signals shift faster.
 *
 * All methods are safe to call when DATABASE_URL is absent — they catch
 * the connection error and return null/void so siteBrief falls back to
 * live Overpass without crashing.
 */
import { getPool } from "../db.js";
import type { SiteSignals } from "./siteBrief.js";

const DEFAULT_TTL_HOURS = 24;

type CacheRow = {
  signals: SiteSignals;
  expires_at: Date;
};

export async function getCachedSignals(geohash7: string): Promise<SiteSignals | null> {
  try {
    const pool = getPool();
    const res = await pool.query<CacheRow>(
      `SELECT signals, expires_at
         FROM site_signals_cache
        WHERE geohash7 = $1
          AND expires_at > NOW()
        LIMIT 1`,
      [geohash7],
    );
    if (res.rows.length === 0) return null;
    return res.rows[0]!.signals as SiteSignals;
  } catch {
    return null;
  }
}

export async function putCachedSignals(
  geohash7: string,
  signals: SiteSignals,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO site_signals_cache (geohash7, signals, expires_at)
            VALUES ($1, $2::jsonb, NOW() + ($3 || ' hours')::INTERVAL)
       ON CONFLICT (geohash7) DO UPDATE
               SET signals = EXCLUDED.signals,
                   expires_at = EXCLUDED.expires_at`,
      [geohash7, JSON.stringify(signals), String(ttlHours)],
    );
  } catch {
    /* cache write failure is non-fatal */
  }
}

export async function purgeExpiredSignals(): Promise<number> {
  try {
    const pool = getPool();
    const res = await pool.query("DELETE FROM site_signals_cache WHERE expires_at <= NOW()");
    return (res as unknown as { rowCount?: number | null }).rowCount ?? 0;
  } catch {
    return 0;
  }
}
