import { getPool } from "../db.js";

export type PropagateMode = "all" | "high_conf";

export type PropagateResult = {
  clusterId: string;
  detectionsInserted: number;
  membersUpdated: number;
  mode: PropagateMode;
};

const HIGH_CONF_THRESHOLD = 0.85;

export type PropagateLabelInput = {
  clusterId: string;
  taxonName: string;
  scientificName?: string;
  confidence?: number;
  mode?: PropagateMode;
};

export async function propagateClusterLabel(
  input: PropagateLabelInput,
): Promise<PropagateResult> {
  if (!input.clusterId) throw new Error("clusterId_required");
  if (!input.taxonName) throw new Error("taxonName_required");
  const mode: PropagateMode = input.mode ?? "high_conf";
  const confidence = Number.isFinite(input.confidence) ? Number(input.confidence) : 0.9;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const memberRows = await client.query<{
      segment_id: string;
      distance: number;
    }>(
      `select segment_id::text as segment_id, distance_to_centroid as distance
         from sound_cluster_members
        where cluster_id = $1
        order by distance_to_centroid asc`,
      [input.clusterId],
    );

    let detectionsInserted = 0;
    let membersUpdated = 0;
    for (const member of memberRows.rows) {
      const distance = Number(member.distance);
      const similarity = 1 - distance;
      const include =
        mode === "all" || (mode === "high_conf" && similarity >= HIGH_CONF_THRESHOLD);
      if (!include) continue;

      const insert = await client.query<{ inserted: boolean }>(
        `insert into audio_detections
           (segment_id, detected_taxon, scientific_name, confidence, provider,
            offset_sec, duration_sec, dual_agree, raw_score)
         values ($1, $2, $3, $4, 'cluster_propagation', 0, 0, false, $5::jsonb)
         on conflict do nothing
         returning true as inserted`,
        [
          member.segment_id,
          input.taxonName,
          input.scientificName ?? null,
          Math.max(0, Math.min(1, confidence * Math.max(similarity, 0.5))),
          JSON.stringify({
            cluster_id: input.clusterId,
            similarity,
            mode,
          }),
        ],
      );
      if (insert.rows[0]?.inserted) detectionsInserted += 1;

      await client.query(
        `update sound_cluster_members
            set propagated_label_status = 'propagated',
                added_at = added_at
          where cluster_id = $1 and segment_id = $2`,
        [input.clusterId, member.segment_id],
      );
      membersUpdated += 1;
    }

    await client.query(
      `update sound_clusters
          set propagated_count = $2,
              updated_at = now()
        where cluster_id = $1`,
      [input.clusterId, membersUpdated],
    );

    await client.query("commit");
    return {
      clusterId: input.clusterId,
      detectionsInserted,
      membersUpdated,
      mode,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
