import { getPool } from "../db.js";

export type ObserverStats = {
  totalObservations: number;
  thisMonthObservations: number;
  currentStreakDays: number;
  placeVisitCount: number; // この地点を訪れた回数
  uniqueTaxaAllTime: number;
  uniqueTaxaThisSeason: number;
  rankLabel: string;
  // 「あなた以外に何人がこの場所を訪れたか」
  peersAtPlaceCount: number;
  // 100年アーカイブ的な数字（総データベース件数との関係）
  contributionRankNumeric: number; // その人の総観察がDB全体の何番目
};

/**
 * 観察詳細ページ Layer 4「あなたの成長」を支える集計。
 * UI コピーに「自己効力感」等の学術用語は出さず、数字だけ出す。
 */
export async function getObserverStats(
  viewerUserId: string,
  currentPlaceId: string | null,
  currentOccurrenceId: string,
): Promise<ObserverStats> {
  const pool = getPool();

  const totals = await pool.query<{
    total: string;
    this_month: string;
    unique_taxa_all: string;
    unique_taxa_season: string;
    rank_label: string | null;
  }>(
    `SELECT
       (SELECT count(*)::text FROM visits WHERE user_id = $1) AS total,
       (SELECT count(*)::text FROM visits WHERE user_id = $1
         AND observed_at >= date_trunc('month', now())) AS this_month,
       (SELECT count(DISTINCT coalesce(o.vernacular_name, o.scientific_name))::text
          FROM occurrences o JOIN visits v ON v.visit_id = o.visit_id
         WHERE v.user_id = $1
           AND (o.vernacular_name IS NOT NULL OR o.scientific_name IS NOT NULL)) AS unique_taxa_all,
       (SELECT count(DISTINCT coalesce(o.vernacular_name, o.scientific_name))::text
          FROM occurrences o JOIN visits v ON v.visit_id = o.visit_id
         WHERE v.user_id = $1
           AND extract(month from v.observed_at) = extract(month from now())
           AND (o.vernacular_name IS NOT NULL OR o.scientific_name IS NOT NULL)) AS unique_taxa_season,
       (SELECT rank_label FROM users WHERE user_id = $1) AS rank_label`,
    [viewerUserId],
  );

  const streakRow = await pool.query<{ streak: string }>(
    `WITH days AS (
       SELECT DISTINCT date_trunc('day', observed_at)::date AS d
         FROM visits WHERE user_id = $1
         ORDER BY d DESC LIMIT 60
     ),
     ranked AS (
       SELECT d, row_number() OVER (ORDER BY d DESC) - 1 AS rn FROM days
     )
     SELECT count(*)::text AS streak
       FROM ranked WHERE d = current_date - rn`,
    [viewerUserId],
  );

  const placeRow = currentPlaceId
    ? await pool.query<{ visits: string; peers: string }>(
        `SELECT
           (SELECT count(*)::text FROM visits WHERE user_id = $1 AND place_id = $2) AS visits,
           (SELECT count(DISTINCT user_id)::text FROM visits
             WHERE place_id = $2 AND user_id <> $1 AND user_id IS NOT NULL) AS peers`,
        [viewerUserId, currentPlaceId],
      )
    : null;

  const rank = await pool.query<{ rank: string }>(
    `SELECT count(*)::text AS rank FROM visits WHERE visit_id <= $1 OR observed_at <= (SELECT observed_at FROM visits WHERE visit_id = (SELECT visit_id FROM occurrences WHERE occurrence_id = $2 LIMIT 1))`,
    [currentOccurrenceId, currentOccurrenceId],
  ).catch(() => ({ rows: [{ rank: "0" }] }));

  const t = totals.rows[0]!;
  return {
    totalObservations: Number(t.total),
    thisMonthObservations: Number(t.this_month),
    currentStreakDays: Number(streakRow.rows[0]?.streak ?? 0),
    placeVisitCount: placeRow ? Number(placeRow.rows[0]?.visits ?? 0) : 0,
    uniqueTaxaAllTime: Number(t.unique_taxa_all),
    uniqueTaxaThisSeason: Number(t.unique_taxa_season),
    rankLabel: t.rank_label ?? "観察者",
    peersAtPlaceCount: placeRow ? Number(placeRow.rows[0]?.peers ?? 0) : 0,
    contributionRankNumeric: Number(rank.rows[0]?.rank ?? 0),
  };
}
