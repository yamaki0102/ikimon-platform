import { getPool } from "../db.js";
import {
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
  VALID_OBSERVATION_VIDEO_ASSET_SQL,
} from "./observationQualityGate.js";
import { haversineMeters } from "./observationEventAreaGeometry.js";

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

export type MapOwnObservationCluster = {
  clusterId: string;
  label: string;
  localityLabel: string;
  recordCount: number;
  photoCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  latitude: number;
  longitude: number;
  representativePhotoUrl: string | null;
  representativeOccurrenceId: string | null;
  representativeDisplayName: string | null;
  occurrenceIds: string[];
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

function observationTime(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function mostCommonText(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = cleanText(value);
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    [0]?.[0] ?? "";
}

export function buildMapOwnObservationClusters(
  items: MapOwnObservation[],
  options: { limit?: number; radiusMeters?: number; minRecords?: number } = {},
): MapOwnObservationCluster[] {
  const radiusMeters = Math.max(150, Math.min(options.radiusMeters ?? 1000, 3000));
  const minRecords = Math.max(2, Math.min(options.minRecords ?? 3, 12));
  const limit = Math.max(1, Math.min(options.limit ?? 3, 12));
  const clusters: Array<{
    records: MapOwnObservation[];
    latitude: number;
    longitude: number;
  }> = [];

  const sorted = items
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .slice()
    .sort((a, b) => observationTime(b.observedAt) - observationTime(a.observedAt));

  for (const item of sorted) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    clusters.forEach((cluster, index) => {
      const distance = haversineMeters(cluster.latitude, cluster.longitude, item.latitude, item.longitude);
      if (distance <= radiusMeters && distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });

    if (bestIndex < 0) {
      clusters.push({ records: [item], latitude: item.latitude, longitude: item.longitude });
      continue;
    }

    const cluster = clusters[bestIndex]!;
    cluster.records.push(item);
    const count = cluster.records.length;
    cluster.latitude = cluster.latitude + (item.latitude - cluster.latitude) / count;
    cluster.longitude = cluster.longitude + (item.longitude - cluster.longitude) / count;
  }

  return clusters
    .filter((cluster) => cluster.records.length >= minRecords)
    .map((cluster, index): MapOwnObservationCluster => {
      const records = cluster.records
        .slice()
        .sort((a, b) => observationTime(b.observedAt) - observationTime(a.observedAt));
      const observedTimes = records.map((record) => observationTime(record.observedAt)).filter((time) => time > 0);
      const representative = records.find((record) => record.photoUrl) ?? records[0] ?? null;
      const label = mostCommonText(records.map((record) => record.localityLabel)) ||
        mostCommonText(records.map((record) => record.displayName)) ||
        "よく撮った場所";
      return {
        clusterId: `own-area:${index}:${records[0]?.occurrenceId ?? "unknown"}`,
        label,
        localityLabel: mostCommonText(records.map((record) => record.localityLabel)),
        recordCount: records.length,
        photoCount: records.filter((record) => Boolean(record.photoUrl)).length,
        firstObservedAt: observedTimes.length ? new Date(Math.min(...observedTimes)).toISOString() : records[records.length - 1]?.observedAt ?? "",
        lastObservedAt: observedTimes.length ? new Date(Math.max(...observedTimes)).toISOString() : records[0]?.observedAt ?? "",
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        representativePhotoUrl: representative?.photoUrl ?? null,
        representativeOccurrenceId: representative?.occurrenceId ?? null,
        representativeDisplayName: representative?.displayName ?? null,
        occurrenceIds: records.map((record) => record.occurrenceId).slice(0, 48),
      };
    })
    .sort((a, b) => b.recordCount - a.recordCount || observationTime(b.lastObservedAt) - observationTime(a.lastObservedAt))
    .slice(0, limit);
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
        v.point_latitude as latitude,
        v.point_longitude as longitude,
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
        and v.point_latitude is not null
        and v.point_longitude is not null
        and coalesce(v.source_payload->>'source', '') !~* '(^|[-_])(e2e|smoke|fixture|dummy|placeholder|sample[-_]?data|sample[-_]?record|sample[-_]?media|test[-_]?fixture)([-_]|$)'
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
