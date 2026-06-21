import { getPool } from "../db.js";
import {
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
  VALID_OBSERVATION_VIDEO_ASSET_SQL,
} from "./observationQualityGate.js";

export type MapOwnObservation = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  mediaKind: "photo" | "video";
  localityLabel: string;
};

type MapOwnObservationRow = {
  occurrence_id: string;
  visit_id: string;
  display_name: string | null;
  note: string | null;
  observed_at: string;
  latitude: number | string | null;
  longitude: number | string | null;
  photo_url: string | null;
  video_thumb_url: string | null;
  municipality: string | null;
  prefecture: string | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ownDisplayName(row: MapOwnObservationRow): string {
  const name = cleanText(row.display_name);
  if (name) return name;
  const note = cleanText(row.note).replace(/\s+/g, " ");
  return note.length > 40 ? `${note.slice(0, 39)}…` : note;
}

export function isMeaningfulOwnObservationLabel(value: unknown): boolean {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (!text) return false;
  if (text.length < 2) return false;
  if (/^(?:同定待ち|名前を確認中|未同定|不明|unknown|unidentified|unresolved|awaiting id)$/i.test(text)) return false;
  if (/^(?:記録|写真|動画|画像|撮影|メモ|スキャン|scan|photo|video|record|memo)$/i.test(text)) return false;
  if (/^(?:test|dummy|sample|fixture|placeholder|regression)(?:[-_\s]|$)/i.test(text)) return false;
  return true;
}

function localityLabel(row: MapOwnObservationRow): string {
  return cleanText(row.municipality) || cleanText(row.prefecture);
}

export async function listMapOwnObservations(
  userId: string,
  options: { limit?: number } = {},
): Promise<MapOwnObservation[]> {
  const pool = getPool();
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 120);
  const result = await pool.query<MapOwnObservationRow>(
    `
      select
        o.occurrence_id,
        o.visit_id,
        coalesce(
          nullif(o.vernacular_name, ''),
          nullif(o.scientific_name, ''),
          nullif(ai.recommended_taxon_name, ''),
          nullif(v.note, ''),
          ''
        ) as display_name,
        v.note,
        v.observed_at::text,
        coalesce(v.point_latitude, p.center_latitude) as latitude,
        coalesce(v.point_longitude, p.center_longitude) as longitude,
        photo.public_url as photo_url,
        video.thumb_url as video_thumb_url,
        coalesce(v.observed_municipality, p.municipality) as municipality,
        coalesce(v.observed_prefecture, p.prefecture) as prefecture
      from occurrences o
      join visits v on v.visit_id = o.visit_id
      left join places p on p.place_id = v.place_id
      left join lateral (
        select recommended_taxon_name
        from observation_ai_assessments a
        where a.occurrence_id = o.occurrence_id
        order by generated_at desc
        limit 1
      ) ai on true
      left join lateral (
        select coalesce(ab.public_url, ab.storage_path) as public_url
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
        where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
          and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
        order by case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
          ea.created_at asc
        limit 1
      ) photo on true
      left join lateral (
        select coalesce(ea.source_payload->>'thumbnail_url', ab.source_payload->>'thumbnail_url', ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url') as thumb_url
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
        where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
          and ${VALID_OBSERVATION_VIDEO_ASSET_SQL}
        order by case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
          ea.created_at asc
        limit 1
      ) video on true
      where v.user_id = $1
        and v.source_kind = 'v2_observation'
        and coalesce(v.session_mode, '') = 'standard'
        and coalesce(v.visit_mode, 'manual') in ('manual', 'survey')
        and coalesce(v.point_latitude, p.center_latitude) is not null
        and coalesce(v.point_longitude, p.center_longitude) is not null
        and coalesce(v.source_payload->>'source', '') !~* '(^|[-_])(e2e|smoke|fixture|dummy|placeholder|sample[-_]?data|sample[-_]?record|sample[-_]?media|regression[-_]?seed|regression[-_]?fixture|test[-_]?fixture)([-_]|$)'
        and coalesce(
          nullif(o.vernacular_name, ''),
          nullif(o.scientific_name, ''),
          nullif(ai.recommended_taxon_name, ''),
          nullif(v.note, '')
        ) is not null
        and (photo.public_url is not null or video.thumb_url is not null)
      order by v.observed_at desc
      limit $2
    `,
    [userId, limit],
  );

  return result.rows
    .map((row): MapOwnObservation | null => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const photoUrl = row.photo_url || row.video_thumb_url || null;
      if (!photoUrl) return null;
      const displayName = ownDisplayName(row);
      if (!isMeaningfulOwnObservationLabel(displayName)) return null;
      return {
        occurrenceId: row.occurrence_id,
        visitId: row.visit_id,
        displayName,
        observedAt: row.observed_at,
        latitude,
        longitude,
        photoUrl,
        mediaKind: row.photo_url ? "photo" as const : "video" as const,
        localityLabel: localityLabel(row),
      };
    })
    .filter((row): row is MapOwnObservation => row !== null);
}
