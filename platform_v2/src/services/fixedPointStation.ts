import { getPool } from "../db.js";
import { getCanonicalPlaceEnvironmentEvidenceForPlaceId, type PlaceEnvironmentEvidence } from "./placeEnvironmentSignals.js";

export type FixedPointStationVisit = {
  visitId: string;
  observedAt: string;
  note: string | null;
  visitMode: string | null;
  revisitReason: string | null;
  taxa: string[];
  photoCount: number;
  videoCount: number;
  contextLabel: string | null;
  activityIntent: string | null;
  participantRole: string | null;
};

export type FixedPointStationAction = {
  actionId: string;
  occurredAt: string;
  actionKind: string;
  description: string | null;
  linkedVisitId: string | null;
};

export type FixedPointStation = {
  place: {
    placeId: string;
    name: string;
    localityLabel: string | null;
    municipality: string | null;
    prefecture: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  visits: FixedPointStationVisit[];
  environmentEvidence: PlaceEnvironmentEvidence[];
  stewardshipActions: FixedPointStationAction[];
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function contextLabel(kind: string | null, intent: string | null): string | null {
  if (kind === "event") return "観察会";
  if (kind === "school") return "学校/クラス";
  if (kind === "satoyama") return "管理と観察";
  if (kind === "risk") return "確認対象";
  if (intent === "revisit") return "再記録";
  if (intent === "compare") return "比較";
  return null;
}

export async function getFixedPointStation(placeId: string): Promise<FixedPointStation | null> {
  const trimmed = placeId.trim();
  if (!trimmed) return null;
  const pool = getPool();
  const placeResult = await pool.query<{
    place_id: string;
    canonical_name: string;
    locality_label: string | null;
    municipality: string | null;
    prefecture: string | null;
    center_latitude: number | null;
    center_longitude: number | null;
  }>(
    `select place_id, canonical_name, locality_label, municipality, prefecture, center_latitude, center_longitude
       from places
      where place_id = $1
      limit 1`,
    [trimmed],
  );
  const place = placeResult.rows[0];
  if (!place) return null;

  const [visitResult, environmentEvidence, actionResult] = await Promise.all([
    pool.query<{
      visit_id: string;
      observed_at: string;
      note: string | null;
      visit_mode: string | null;
      revisit_reason: string | null;
      taxa: string[] | null;
      photo_count: string | number;
      video_count: string | number;
      context_kind: string | null;
      activity_intent: string | null;
      participant_role: string | null;
    }>(
      `select v.visit_id,
              v.observed_at::text,
              v.note,
              v.visit_mode,
              nullif(v.source_payload->>'revisit_reason', '') as revisit_reason,
              coalesce(array_remove(array_agg(distinct nullif(coalesce(o.vernacular_name, o.scientific_name), '')), null), '{}') as taxa,
              count(distinct ea.asset_id) filter (where ab.media_type = 'image' or ab.mime_type like 'image/%')::text as photo_count,
              count(distinct ea.asset_id) filter (where ab.media_type = 'video' or ab.mime_type like 'video/%')::text as video_count,
              coc.context_kind,
              coc.activity_intent,
              coc.participant_role
         from visits v
         left join occurrences o on o.visit_id = v.visit_id
         left join evidence_assets ea on ea.visit_id = v.visit_id or ea.occurrence_id = o.occurrence_id
         left join asset_blobs ab on ab.blob_id = ea.blob_id
         left join civic_observation_contexts coc on coc.visit_id = v.visit_id
        where v.place_id = $1
        group by v.visit_id, v.observed_at, v.note, v.visit_mode, v.source_payload,
                 coc.context_kind, coc.activity_intent, coc.participant_role
        order by v.observed_at desc, v.visit_id desc
        limit 80`,
      [trimmed],
    ),
    getCanonicalPlaceEnvironmentEvidenceForPlaceId(trimmed),
    pool.query<{
      action_id: string;
      occurred_at: string;
      action_kind: string;
      description: string | null;
      linked_visit_id: string | null;
    }>(
      `select action_id, occurred_at::text, action_kind, description, linked_visit_id
         from stewardship_actions
        where place_id = $1
        order by occurred_at desc
        limit 40`,
      [trimmed],
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    place: {
      placeId: place.place_id,
      name: place.canonical_name,
      localityLabel: place.locality_label,
      municipality: place.municipality,
      prefecture: place.prefecture,
      latitude: place.center_latitude,
      longitude: place.center_longitude,
    },
    visits: visitResult.rows.map((row) => ({
      visitId: row.visit_id,
      observedAt: row.observed_at,
      note: row.note,
      visitMode: row.visit_mode,
      revisitReason: row.revisit_reason,
      taxa: asStringArray(row.taxa).slice(0, 5),
      photoCount: Number(row.photo_count ?? 0),
      videoCount: Number(row.video_count ?? 0),
      contextLabel: contextLabel(row.context_kind, row.activity_intent),
      activityIntent: row.activity_intent,
      participantRole: row.participant_role,
    })),
    environmentEvidence,
    stewardshipActions: actionResult.rows.map((row) => ({
      actionId: row.action_id,
      occurredAt: row.occurred_at,
      actionKind: row.action_kind,
      description: row.description,
      linkedVisitId: row.linked_visit_id,
    })),
  };
}
