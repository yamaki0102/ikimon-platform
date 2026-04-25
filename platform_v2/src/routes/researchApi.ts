import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { PUBLIC_OBSERVATION_QUALITY_SQL } from "../services/observationQualityGate.js";

type OccurrenceRow = {
  occurrence_id: string;
  visit_id: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  evidence_tier: number;
  observed_at: string;
  latitude: string | null;
  longitude: string | null;
  place_name: string | null;
  municipality: string | null;
  observer_name: string | null;
  photo_url: string | null;
  consensus_status: string;
  identification_verification_status: string;
};

export function registerResearchApiRoutes(app: FastifyInstance): void {
  /**
   * GET /api/v1/research/occurrences
   * Returns research-grade (Tier ≥ 3 by default) occurrences in DarwinCore-like JSON.
   * Query params:
   *   tier_gte   number  minimum evidence_tier (default 3)
   *   limit      number  max results (default 100, max 1000)
   *   offset     number  pagination offset (default 0)
   *   place_id   string  filter by place
   *   taxon      string  filter by scientific or vernacular name (partial)
   */
  app.get("/api/v1/research/occurrences", async (request, reply) => {
    const query = request.query as Record<string, string>;

    const tierGte = Math.max(1, Math.min(4, Number(query.tier_gte ?? 3)));
    const limit   = Math.min(1000, Math.max(1, Number(query.limit ?? 100)));
    const offset  = Math.max(0, Number(query.offset ?? 0));

    const params: (string | number)[] = [tierGte, limit, offset];
    let whereExtra = "";
    let paramIdx = 4;

    if (query.place_id) {
      whereExtra += ` and v.place_id = $${paramIdx}`;
      params.push(query.place_id);
      paramIdx++;
    }

    if (query.taxon) {
      whereExtra += ` and (o.scientific_name ilike $${paramIdx} or o.vernacular_name ilike $${paramIdx})`;
      params.push(`%${query.taxon}%`);
      paramIdx++;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<OccurrenceRow>(
        `select
           o.occurrence_id,
           o.visit_id,
           o.scientific_name,
           o.vernacular_name,
           o.taxon_rank,
           o.evidence_tier,
           v.observed_at::text,
           coalesce(v.point_latitude,  p.center_latitude)::text  as latitude,
           coalesce(v.point_longitude, p.center_longitude)::text as longitude,
           coalesce(p.canonical_name, 'Unknown') as place_name,
           coalesce(v.observed_municipality, p.municipality)     as municipality,
           coalesce(u.display_name, 'Anonymous')                 as observer_name,
           photo.public_url                                       as photo_url,
           case
             when id_meta.authority_count > 0 then 'authority_backed'
             when id_meta.current_count >= 2 then 'community_consensus'
             else 'tier_gate'
           end as consensus_status,
           case
             when id_meta.authority_count > 0 then 'authority_reviewed'
             when id_meta.current_count >= 2 then 'community_consensus'
             else 'tier3_export_candidate'
           end as identification_verification_status
         from occurrences o
         join visits v on v.visit_id = o.visit_id
         left join places p on p.place_id = v.place_id
         left join users  u on u.user_id  = v.user_id
         left join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url
           from evidence_assets ea
           join asset_blobs ab on ab.blob_id = ea.blob_id
           where ea.occurrence_id = o.occurrence_id
             and ea.asset_role = 'observation_photo'
           order by ea.created_at asc limit 1
         ) photo on true
         left join lateral (
           select
             count(*)::int as current_count,
             count(*) filter (
               where coalesce(source_payload->>'lane', '') = 'public-claim'
                 and coalesce(source_payload->>'reviewClass', source_payload->>'review_class', '') in ('authority_backed', 'admin_override')
             )::int as authority_count
           from identifications i
           where i.occurrence_id = o.occurrence_id
             and i.actor_kind = 'human'
             and coalesce(i.is_current, true) = true
         ) id_meta on true
         where o.evidence_tier >= $1
           and ${PUBLIC_OBSERVATION_QUALITY_SQL}
           and not exists (
             select 1
               from identification_disputes d
              where d.occurrence_id = o.occurrence_id
                and d.status = 'open'
           )
           ${whereExtra}
         order by v.observed_at desc
         limit $2 offset $3`,
        params,
      );

      // Return DarwinCore-inspired structure
      const records = result.rows.map((row) => ({
        occurrenceID:         row.occurrence_id,
        eventID:              row.visit_id,
        scientificName:       row.scientific_name,
        vernacularName:       row.vernacular_name,
        taxonRank:            row.taxon_rank,
        evidenceTier:         row.evidence_tier,
        eventDate:            row.observed_at,
        decimalLatitude:      row.latitude !== null ? Number(row.latitude) : null,
        decimalLongitude:     row.longitude !== null ? Number(row.longitude) : null,
        locality:             row.place_name,
        municipality:         row.municipality,
        recordedBy:           row.observer_name,
        associatedMedia:      row.photo_url,
        basisOfRecord:        "HumanObservation",
        datasetName:          "ikimon Field Loop",
        license:              "CC-BY",
        consensusStatus:      row.consensus_status,
        identificationVerificationStatus: row.identification_verification_status,
      }));

      reply.header("Cache-Control", "public, max-age=300");
      return reply.send({
        totalReturned: records.length,
        offset,
        records,
      });
    } finally {
      client.release();
    }
  });
}
