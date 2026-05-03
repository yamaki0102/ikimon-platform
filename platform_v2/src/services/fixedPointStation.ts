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

/**
 * Versioned environment metric (NDVI mean / forest_pct / etc.) for the place,
 * sourced from place_environment_snapshots (Phase 3-1).
 *
 * Drives the "satellite change" lane in the year-over-year comparison view.
 */
export type FixedPointStationEnvironmentSnapshot = {
  snapshotId: string;
  metricKind: string;
  metricValue: number;
  metricUnit: string;
  observedOn: string;
  validFrom: string;
  validTo: string | null;
  sourceKind: string;
};

/**
 * Time-bucketed roll-up so the UI can render "this year vs last year vs five
 * years ago" in a single horizontal grid: visits, photos, videos, stewardship
 * actions, dominant taxa, environment snapshots.
 */
export type FixedPointStationYearBucket = {
  year: number;
  visitCount: number;
  photoCount: number;
  videoCount: number;
  stewardshipCount: number;
  uniqueTaxa: number;
  dominantTaxa: string[];           // up to 5
  environmentDigest: {              // most recent metric_value per kind in the year
    [metricKind: string]: { value: number; observedOn: string };
  };
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
  /** Phase 3-1: versioned NDVI / forest_pct / etc. — null when worker hasn't run. */
  environmentSnapshots: FixedPointStationEnvironmentSnapshot[];
  /** Phase 3-2: same-place year-over-year comparison data. */
  yearlyTimeline: FixedPointStationYearBucket[];
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

  const [visitResult, environmentEvidence, actionResult, envSnapshotResult] = await Promise.all([
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
    pool.query<{
      snapshot_id: string;
      metric_kind: string;
      metric_value: string;
      metric_unit: string;
      observed_on: string;
      valid_from: string;
      valid_to: string | null;
      source_kind: string | null;
    }>(
      `select pes.snapshot_id,
              pes.metric_kind,
              pes.metric_value::text as metric_value,
              pes.metric_unit,
              pes.observed_on::text,
              pes.valid_from::text,
              pes.valid_to::text,
              ss.source_kind
         from place_environment_snapshots pes
         left join source_snapshots ss on ss.snapshot_id = pes.source_snapshot_id
        where pes.place_id = $1
        order by pes.observed_on desc, pes.valid_from desc
        limit 200`,
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
    environmentSnapshots: envSnapshotResult.rows.map((row) => ({
      snapshotId: row.snapshot_id,
      metricKind: row.metric_kind,
      metricValue: Number(row.metric_value),
      metricUnit: row.metric_unit,
      observedOn: row.observed_on,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      sourceKind: row.source_kind ?? "",
    })),
    yearlyTimeline: buildYearlyTimeline({
      visits: visitResult.rows,
      actions: actionResult.rows,
      envSnapshots: envSnapshotResult.rows,
    }),
  };
}

interface YearlyTimelineInput {
  visits: Array<{
    observed_at: string;
    taxa: string[] | null;
    photo_count: string | number;
    video_count: string | number;
  }>;
  actions: Array<{ occurred_at: string }>;
  envSnapshots: Array<{
    metric_kind: string;
    metric_value: string;
    observed_on: string;
  }>;
}

function buildYearlyTimeline(input: YearlyTimelineInput): FixedPointStationYearBucket[] {
  const byYear = new Map<number, FixedPointStationYearBucket & { _taxa: Map<string, number> }>();
  const ensure = (year: number): FixedPointStationYearBucket & { _taxa: Map<string, number> } => {
    let bucket = byYear.get(year);
    if (!bucket) {
      bucket = {
        year,
        visitCount: 0,
        photoCount: 0,
        videoCount: 0,
        stewardshipCount: 0,
        uniqueTaxa: 0,
        dominantTaxa: [],
        environmentDigest: {},
        _taxa: new Map(),
      };
      byYear.set(year, bucket);
    }
    return bucket;
  };

  for (const v of input.visits) {
    const year = Number(String(v.observed_at).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const bucket = ensure(year);
    bucket.visitCount += 1;
    bucket.photoCount += Number(v.photo_count ?? 0);
    bucket.videoCount += Number(v.video_count ?? 0);
    for (const t of asStringArray(v.taxa)) {
      bucket._taxa.set(t, (bucket._taxa.get(t) ?? 0) + 1);
    }
  }

  for (const a of input.actions) {
    const year = Number(String(a.occurred_at).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    ensure(year).stewardshipCount += 1;
  }

  for (const e of input.envSnapshots) {
    const year = Number(String(e.observed_on).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const bucket = ensure(year);
    // Keep the most recent observed_on per metric_kind in this year.
    const existing = bucket.environmentDigest[e.metric_kind];
    if (!existing || existing.observedOn < e.observed_on) {
      bucket.environmentDigest[e.metric_kind] = {
        value: Number(e.metric_value),
        observedOn: e.observed_on,
      };
    }
  }

  const buckets = Array.from(byYear.values()).map((b) => {
    const dominantTaxa = Array.from(b._taxa.entries())
      .sort((a, c) => c[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    return {
      year: b.year,
      visitCount: b.visitCount,
      photoCount: b.photoCount,
      videoCount: b.videoCount,
      stewardshipCount: b.stewardshipCount,
      uniqueTaxa: b._taxa.size,
      dominantTaxa,
      environmentDigest: b.environmentDigest,
    };
  });
  buckets.sort((a, b) => b.year - a.year);
  return buckets;
}

export const __test__ = { buildYearlyTimeline };
