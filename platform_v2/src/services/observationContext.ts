import { getPool } from "../db.js";

export type CoOccurringFeature = {
  type: "species" | "vegetation" | "landform" | "structure" | "sound" | "audio_detection";
  name: string;
  confidence?: number;
  note?: string;
  sourceKind: "guide" | "audio";
};

export type ObservationContext = {
  features: CoOccurringFeature[];
  environmentContexts: string[];
  seasonalNotes: string[];
  audioSessionsRecorded: number;
};

/**
 * ある観察 (occurrence_id) と同一 visit / 同一 place の guide_records と
 * audio_detections を拾って、"同地点の生きもの" と "場所の物語" を組み立てる。
 *
 * 折り畳み UI のバックエンド。空データでもエラーにはしない（returns 空配列）。
 */
export async function getObservationContext(
  occurrenceId: string,
  visitId: string | null,
  placeId: string | null,
): Promise<ObservationContext> {
  const pool = getPool();
  const features: CoOccurringFeature[] = [];
  const envSet = new Set<string>();
  const noteSet = new Set<string>();

  // guide_records: scene_summary + detected_features JSONB
  try {
    const guideRows = await pool.query<{
      scene_summary: string | null;
      detected_features: Array<{ type: string; name: string; confidence?: number; note?: string }> | null;
      meta: Record<string, unknown> | null;
    }>(
      `select scene_summary, detected_features, meta
         from guide_records
        where occurrence_id = $1
           or (${visitId ? "session_id = $2 or " : ""}false)
        order by created_at desc
        limit 30`,
      visitId ? [occurrenceId, visitId] : [occurrenceId],
    );
    for (const row of guideRows.rows) {
      if (Array.isArray(row.detected_features)) {
        for (const f of row.detected_features) {
          if (!f?.name) continue;
          const t = (f.type ?? "species") as CoOccurringFeature["type"];
          features.push({ type: t, name: f.name, confidence: f.confidence, note: f.note, sourceKind: "guide" });
        }
      }
      // 環境文脈・季節ノートは meta.environmentContext / meta.seasonalNote として保存されている可能性
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const ec = typeof meta.environmentContext === "string" ? meta.environmentContext : null;
      const sn = typeof meta.seasonalNote === "string" ? meta.seasonalNote : null;
      if (ec) envSet.add(ec);
      if (sn) noteSet.add(sn);
    }
  } catch {
    // テーブル未存在等の場合はスキップ
  }

  // audio_detections: segment が 同 visit_id / 同 place_id のもの。
  // visitId も placeId も null の場合は **一切検索しない**（以前は where false が全件返す IDOR リスクがあった）。
  let audioSessionsRecorded = 0;
  if (!visitId && !placeId) {
    return {
      features,
      environmentContexts: Array.from(envSet),
      seasonalNotes: Array.from(noteSet),
      audioSessionsRecorded,
    };
  }
  try {
    const audioRows = await pool.query<{
      detected_taxon: string;
      confidence: number;
      provider: string;
      session_count: string;
    }>(
      `with sess as (
         select distinct s.segment_id
           from audio_segments s
          where (
                 ($1::text is not null and s.visit_id = $1)
              or ($2::text is not null and s.place_id = $2)
                )
            and s.privacy_status = 'clean'
       )
       select d.detected_taxon,
              max(d.confidence) as confidence,
              (array_agg(d.provider order by d.confidence desc))[1] as provider,
              (select count(distinct s.session_id)
                 from audio_segments s
                where (
                       ($1::text is not null and s.visit_id = $1)
                    or ($2::text is not null and s.place_id = $2)
                      )
                  and s.privacy_status = 'clean')::text as session_count
         from audio_detections d
         join sess on sess.segment_id = d.segment_id
        group by d.detected_taxon
        order by max(d.confidence) desc
        limit 20`,
      [visitId ?? null, placeId ?? null],
    );
    for (const r of audioRows.rows) {
      features.push({
        type: "audio_detection",
        name: r.detected_taxon,
        confidence: Number(r.confidence),
        note: `音声検出 (${r.provider})`,
        sourceKind: "audio",
      });
      audioSessionsRecorded = Number(r.session_count) || audioSessionsRecorded;
    }
  } catch {
    // audio_segments/detections テーブル未存在等
  }

  return {
    features,
    environmentContexts: Array.from(envSet),
    seasonalNotes: Array.from(noteSet),
    audioSessionsRecorded,
  };
}

/** フィールドノート 3層構造用に features をグルーピングする。 */
export function groupFeaturesByLayer(features: CoOccurringFeature[]): {
  coexistingTaxa: CoOccurringFeature[];
  environment: CoOccurringFeature[];
  sounds: CoOccurringFeature[];
} {
  const coexistingTaxa: CoOccurringFeature[] = [];
  const environment: CoOccurringFeature[] = [];
  const sounds: CoOccurringFeature[] = [];
  for (const f of features) {
    if (f.type === "species" || f.type === "vegetation") coexistingTaxa.push(f);
    else if (f.type === "landform" || f.type === "structure") environment.push(f);
    else if (f.type === "sound" || f.type === "audio_detection") sounds.push(f);
  }
  return { coexistingTaxa, environment, sounds };
}
