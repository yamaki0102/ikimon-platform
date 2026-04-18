import { getPool } from "../db.js";

export type LineageBreadcrumb = {
  rank: string;
  name: string;
};

export type NearbyObservation = {
  occurrenceId: string;
  displayName: string;
  observerName: string;
  observerUserId: string | null;
  observedAt: string;
  photoUrl: string | null;
  distanceLabel: string;
};

export type PeerObserver = {
  userId: string;
  displayName: string;
  observationCount: number;
};

export type ObservationDetailHeavy = {
  lineage: LineageBreadcrumb[];
  nearby: NearbyObservation[];
  peers: PeerObserver[];
  seasonalHistory: Array<{ month: number; count: number }>;
};

/**
 * 観察詳細ページ Layer 3 (場所の物語) と Layer 4 (あなたの成長) を支えるデータ。
 * lineage: 分類階層（kingdom → species）
 * nearby: 同 place_id での直近観察（自分以外・自分の過去含む別時点）
 * peers: この場所を訪れた他の観察者
 * seasonalHistory: 同地点での月別観察件数（季節性）
 */
export async function getObservationDetailHeavy(
  occurrenceId: string,
  visitId: string | null,
  placeId: string | null,
  viewerUserId: string | null,
): Promise<ObservationDetailHeavy> {
  const pool = getPool();

  const lineage: LineageBreadcrumb[] = [];
  try {
    const row = await pool.query<{
      kingdom: string | null;
      phylum: string | null;
      class_name: string | null;
      order_name: string | null;
      family: string | null;
      genus: string | null;
      scientific_name: string | null;
      vernacular_name: string | null;
    }>(
      `SELECT
         o.kingdom, o.phylum, o.class_name, o.order_name, o.family, o.genus,
         o.scientific_name, o.vernacular_name
       FROM occurrences o WHERE o.occurrence_id = $1 LIMIT 1`,
      [occurrenceId],
    );
    const r = row.rows[0];
    if (r) {
      const pairs: Array<[string, string | null]> = [
        ["界", r.kingdom],
        ["門", r.phylum],
        ["綱", r.class_name],
        ["目", r.order_name],
        ["科", r.family],
        ["属", r.genus],
      ];
      for (const [rank, name] of pairs) {
        if (name) lineage.push({ rank, name });
      }
      if (r.scientific_name) lineage.push({ rank: "学名", name: r.scientific_name });
    }
  } catch {
    // occurrences テーブルに kingdom 等が無い古いスキーマの場合は空
  }

  const nearby: NearbyObservation[] = [];
  if (placeId) {
    try {
      const rows = await pool.query<{
        occurrence_id: string;
        display_name: string;
        observer_name: string;
        observer_user_id: string;
        observed_at: string;
        photo_url: string | null;
      }>(
        `SELECT o.occurrence_id,
                coalesce(nullif(o.vernacular_name,''), o.scientific_name, 'Unresolved') AS display_name,
                coalesce(u.display_name, 'Anonymous') AS observer_name,
                u.user_id AS observer_user_id,
                to_char(v.observed_at, 'YYYY-MM-DD') AS observed_at,
                (SELECT coalesce(ab.public_url, ab.storage_path)
                   FROM evidence_assets ea
                   JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
                   WHERE ea.occurrence_id = o.occurrence_id
                     AND ea.asset_role = 'observation_photo'
                   ORDER BY ea.created_at ASC LIMIT 1) AS photo_url
           FROM visits v
           JOIN occurrences o ON o.visit_id = v.visit_id
           JOIN users u ON u.user_id = v.user_id
          WHERE v.place_id = $1 AND o.occurrence_id <> $2
          ORDER BY v.observed_at DESC LIMIT 6`,
        [placeId, occurrenceId],
      );
      for (const r of rows.rows) {
        nearby.push({
          occurrenceId: r.occurrence_id,
          displayName: r.display_name,
          observerName: r.observer_name,
          observerUserId: r.observer_user_id,
          observedAt: r.observed_at,
          photoUrl: r.photo_url ? normalizeAssetUrl(r.photo_url) : null,
          distanceLabel: "同じ地点",
        });
      }
    } catch {
      // ignore
    }
  }

  const peers: PeerObserver[] = [];
  if (placeId) {
    try {
      const rows = await pool.query<{ user_id: string; display_name: string; n: string }>(
        `SELECT v.user_id, u.display_name, count(*)::text AS n
           FROM visits v JOIN users u ON u.user_id = v.user_id
          WHERE v.place_id = $1
            ${viewerUserId ? "AND v.user_id <> $2" : ""}
          GROUP BY v.user_id, u.display_name
          ORDER BY n::int DESC LIMIT 5`,
        viewerUserId ? [placeId, viewerUserId] : [placeId],
      );
      for (const r of rows.rows) {
        peers.push({
          userId: r.user_id,
          displayName: r.display_name,
          observationCount: Number(r.n),
        });
      }
    } catch {
      // ignore
    }
  }

  const seasonalHistory: Array<{ month: number; count: number }> = [];
  if (placeId) {
    try {
      const rows = await pool.query<{ m: string; n: string }>(
        `SELECT extract(month from observed_at)::text AS m, count(*)::text AS n
           FROM visits WHERE place_id = $1
           GROUP BY m ORDER BY m::int`,
        [placeId],
      );
      for (const r of rows.rows) {
        seasonalHistory.push({ month: Number(r.m), count: Number(r.n) });
      }
    } catch {
      // ignore
    }
  }

  return { lineage, nearby, peers, seasonalHistory };
}

function normalizeAssetUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return "/" + raw;
}
