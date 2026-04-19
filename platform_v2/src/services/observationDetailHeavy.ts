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

export type SiblingSubject = {
  occurrenceId: string;
  subjectIndex: number;
  displayName: string;
  scientificName: string | null;
  vernacularName: string | null;
  rank: string | null;
  roleHint: string;
  confidence: number | null;
  identificationCount: number;
  latestAssessmentBand: "high" | "medium" | "low" | "unknown" | null;
  latestAssessmentGeneratedAt: string | null;
  isPrimary: boolean;
};

export type ObservationDetailHeavy = {
  lineage: LineageBreadcrumb[];
  nearby: NearbyObservation[];
  peers: PeerObserver[];
  seasonalHistory: Array<{ month: number; count: number }>;
  subjects: SiblingSubject[];
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

  // ADR-0004: 同 visit の subjects 一覧 (subject_index 昇順、primary=0 が先頭)
  const subjects: SiblingSubject[] = [];
  if (visitId) {
    try {
      const rows = await pool.query<{
        occurrence_id: string;
        subject_index: number;
        scientific_name: string | null;
        vernacular_name: string | null;
        taxon_rank: string | null;
        confidence_score: string | null;
        source_payload: Record<string, unknown> | null;
      }>(
        `SELECT occurrence_id, subject_index, scientific_name, vernacular_name, taxon_rank,
                confidence_score::text, source_payload
           FROM occurrences WHERE visit_id = $1 ORDER BY subject_index ASC`,
        [visitId],
      );
      const occurrenceIds = rows.rows.map((row) => row.occurrence_id);
      const identificationCounts = new Map<string, number>();
      if (occurrenceIds.length > 0) {
        try {
          const idRows = await pool.query<{ occurrence_id: string; n: string }>(
            `SELECT occurrence_id, count(*)::text AS n
               FROM identifications
              WHERE occurrence_id = ANY($1::text[])
              GROUP BY occurrence_id`,
            [occurrenceIds],
          );
          for (const row of idRows.rows) {
            identificationCounts.set(row.occurrence_id, Number(row.n));
          }
        } catch {
          // identifications テーブルが未準備でも subjects 自体は返す
        }
      }

      const latestAssessments = new Map<string, {
        band: "high" | "medium" | "low" | "unknown" | null;
        generatedAt: string | null;
      }>();
      if (occurrenceIds.length > 0) {
        try {
          const aiRows = await pool.query<{
            occurrence_id: string;
            confidence_band: string | null;
            generated_at: string;
          }>(
            `SELECT DISTINCT ON (occurrence_id)
                    occurrence_id,
                    confidence_band,
                    generated_at::text
               FROM observation_ai_assessments
              WHERE occurrence_id = ANY($1::text[])
              ORDER BY occurrence_id, generated_at DESC`,
            [occurrenceIds],
          );
          for (const row of aiRows.rows) {
            latestAssessments.set(row.occurrence_id, {
              band: normalizeAssessmentBand(row.confidence_band),
              generatedAt: row.generated_at,
            });
          }
        } catch {
          // assessment テーブル未準備でも subjects 自体は返す
        }
      }

      for (const r of rows.rows) {
        const v2sub = ((r.source_payload ?? {}) as { v2_subject?: Record<string, unknown> }).v2_subject ?? {};
        const latestAssessment = latestAssessments.get(r.occurrence_id);
        subjects.push({
          occurrenceId: r.occurrence_id,
          subjectIndex: r.subject_index,
          displayName: r.vernacular_name || r.scientific_name || "Unresolved",
          scientificName: r.scientific_name,
          vernacularName: r.vernacular_name,
          rank: r.taxon_rank,
          roleHint: String((v2sub as { role_hint?: string }).role_hint ?? (r.subject_index === 0 ? "primary" : "coexisting")),
          confidence: r.confidence_score != null ? Number(r.confidence_score) : null,
          identificationCount: identificationCounts.get(r.occurrence_id) ?? 0,
          latestAssessmentBand: latestAssessment?.band ?? null,
          latestAssessmentGeneratedAt: latestAssessment?.generatedAt ?? null,
          isPrimary: r.subject_index === 0,
        });
      }
    } catch {
      // no-op
    }
  }

  return { lineage, nearby, peers, seasonalHistory, subjects };
}

function normalizeAssetUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return "/" + raw;
}

function normalizeAssessmentBand(
  raw: string | null | undefined,
): "high" | "medium" | "low" | "unknown" | null {
  if (raw === "high" || raw === "medium" || raw === "low" || raw === "unknown") {
    return raw;
  }
  return raw == null ? null : "unknown";
}
