import { getPool } from "../db.js";

type RepairCountRow = {
  visits_shizuoka_prefecture_from_coords: string;
  places_shizuoka_prefecture_from_coords: string;
  visits_prefecture: string;
  places_prefecture: string;
};

async function main(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<RepairCountRow>(`
      WITH visits_shizuoka_prefecture_from_coords AS (
        UPDATE visits
           SET observed_prefecture = '静岡県',
               updated_at = now()
         WHERE coalesce(point_latitude, 999) BETWEEN 34.55 AND 35.40
           AND coalesce(point_longitude, 999) BETWEEN 137.45 AND 139.20
           AND (
             observed_prefecture IS NULL
             OR observed_prefecture = ''
             OR lower(observed_prefecture) IN ('shizuoka', 'shizuoka prefecture')
             OR observed_prefecture = '静岡'
           )
         RETURNING 1
      ),
      places_shizuoka_prefecture_from_coords AS (
        UPDATE places
           SET prefecture = '静岡県',
               canonical_name = CASE
                 WHEN canonical_name IS NULL
                   OR canonical_name = ''
                   OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'v2 place')
                   OR canonical_name = '静岡'
                 THEN '静岡県'
                 ELSE canonical_name
               END,
               locality_label = CASE
                 WHEN locality_label IS NULL
                   OR locality_label = ''
                   OR lower(locality_label) IN ('shizuoka', 'shizuoka prefecture')
                   OR locality_label = '静岡'
                 THEN NULL
                 ELSE locality_label
               END,
               updated_at = now()
         WHERE coalesce(center_latitude, 999) BETWEEN 34.55 AND 35.40
           AND coalesce(center_longitude, 999) BETWEEN 137.45 AND 139.20
           AND (
             prefecture IS NULL
             OR prefecture = ''
             OR lower(prefecture) IN ('shizuoka', 'shizuoka prefecture')
             OR prefecture = '静岡'
             OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'v2 place')
           )
         RETURNING 1
      ),
      visits_prefecture AS (
        UPDATE visits
           SET observed_prefecture = '静岡県',
               updated_at = now()
         WHERE lower(observed_prefecture) IN ('shizuoka', 'shizuoka prefecture')
            OR observed_prefecture = '静岡'
         RETURNING 1
      ),
      places_prefecture AS (
        UPDATE places
           SET prefecture = '静岡県',
               updated_at = now()
         WHERE lower(prefecture) IN ('shizuoka', 'shizuoka prefecture')
            OR prefecture = '静岡'
         RETURNING 1
      )
      SELECT
        (SELECT count(*) FROM visits_shizuoka_prefecture_from_coords)::text AS visits_shizuoka_prefecture_from_coords,
        (SELECT count(*) FROM places_shizuoka_prefecture_from_coords)::text AS places_shizuoka_prefecture_from_coords,
        (SELECT count(*) FROM visits_prefecture)::text AS visits_prefecture,
        (SELECT count(*) FROM places_prefecture)::text AS places_prefecture
    `);

    await client.query("commit");
    console.log(JSON.stringify({
      status: "ok",
      repair: "observation_location_labels",
      counts: result.rows[0] ?? {},
    }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
