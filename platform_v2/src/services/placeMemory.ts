import { getPool } from "../db.js";
import { CONTINUOUS_VISIT_GAP_INTERVAL_SQL } from "./visitWindows.js";

export type PlaceMemorySort = "recent" | "frequent" | "seasonal";

export type PlaceMemoryItem = {
  placeId: string;
  placeName: string;
  municipality: string | null;
  lastObservedAt: string;
  previousObservedAt: string | null;
  firstObservedAt: string | null;
  visitCount: number;
  latestVisitId: string | null;
  latestDisplayName: string | null;
  revisitReason: string | null;
  nextLookFor: string | null;
  lastRecordMode: string | null;
  lastSurveyResult: string | null;
  absenceSemantics: string | null;
  latitude: number | null;
  longitude: number | null;
  seasonalVisitCount: number;
  currentSeasonVisited: boolean;
};

type PlaceMemoryRow = {
  place_id: string;
  place_name: string | null;
  municipality: string | null;
  last_observed_at: string;
  previous_observed_at: string | null;
  first_observed_at: string | null;
  visit_count: string;
  latest_visit_id: string | null;
  latest_display_name: string | null;
  last_record_mode: string | null;
  last_survey_result: string | null;
  absence_semantics: string | null;
  target_taxa_scope: string | null;
  source_payload: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  seasonal_visit_count: string;
  current_season_visit_count: string;
};

export function normalizePlaceMemorySort(value: unknown): PlaceMemorySort {
  return value === "frequent" || value === "seasonal" || value === "recent" ? value : "recent";
}

function sortSql(sort: PlaceMemorySort): string {
  if (sort === "frequent") {
    return "stats.visit_count::int desc, latest_visit.observed_at desc";
  }
  if (sort === "seasonal") {
    return `case when stats.seasonal_visit_count > 0 and stats.current_season_visit_count = 0 then 0 else 1 end asc,
            stats.seasonal_visit_count desc,
            latest_visit.observed_at asc`;
  }
  return "latest_visit.observed_at desc";
}

export async function listPlaceMemory(
  userId: string,
  options: { limit?: number; sort?: PlaceMemorySort } = {},
): Promise<PlaceMemoryItem[]> {
  const limit = Math.max(1, Math.min(24, Math.trunc(options.limit ?? 12)));
  const sort = normalizePlaceMemorySort(options.sort);
  const pool = getPool();
  const result = await pool.query<PlaceMemoryRow>(
    `with ordered_place_visits as (
        select
          v.*,
          lag(v.observed_at) over (partition by v.place_id order by v.observed_at asc, v.visit_id asc) as previous_observed_at
        from visits v
        where v.user_id = $1
          and v.place_id is not null
      ),
      visit_windows as (
        select
          *,
          sum(
            case
              when previous_observed_at is null
                or observed_at - previous_observed_at > ${CONTINUOUS_VISIT_GAP_INTERVAL_SQL}
              then 1
              else 0
            end
          ) over (partition by place_id order by observed_at asc, visit_id asc) as visit_window_index
        from ordered_place_visits
      ),
      place_window_stats as (
        select
          place_id,
          visit_window_index,
          min(observed_at) as first_observed_at,
          max(observed_at) as last_observed_at
        from visit_windows
        group by place_id, visit_window_index
      ),
      place_stats as (
        select
          place_id,
          count(*)::text as visit_count,
          min(first_observed_at)::text as first_observed_at,
          max(last_observed_at)::text as last_observed_at,
          count(*) filter (
            where case
              when extract(month from last_observed_at) in (3, 4, 5) then 'spring'
              when extract(month from last_observed_at) in (6, 7, 8) then 'summer'
              when extract(month from last_observed_at) in (9, 10, 11) then 'autumn'
              else 'winter'
            end = case
              when extract(month from now()) in (3, 4, 5) then 'spring'
              when extract(month from now()) in (6, 7, 8) then 'summer'
              when extract(month from now()) in (9, 10, 11) then 'autumn'
              else 'winter'
            end
          )::text as seasonal_visit_count,
          count(*) filter (
            where extract(year from last_observed_at) = extract(year from now())
              and case
                when extract(month from last_observed_at) in (3, 4, 5) then 'spring'
                when extract(month from last_observed_at) in (6, 7, 8) then 'summer'
                when extract(month from last_observed_at) in (9, 10, 11) then 'autumn'
                else 'winter'
              end = case
                when extract(month from now()) in (3, 4, 5) then 'spring'
                when extract(month from now()) in (6, 7, 8) then 'summer'
                when extract(month from now()) in (9, 10, 11) then 'autumn'
                else 'winter'
              end
          )::text as current_season_visit_count
        from place_window_stats
        group by place_id
      )
      select
        p.place_id,
        coalesce(nullif(p.canonical_name, ''), nullif(p.locality_label, ''), p.place_id) as place_name,
        p.municipality,
        stats.last_observed_at,
        previous_visit.previous_observed_at,
        stats.first_observed_at,
        stats.visit_count,
        latest_visit.visit_id as latest_visit_id,
        latest_subject.display_name as latest_display_name,
        latest_visit.visit_mode as last_record_mode,
        latest_visit.source_payload,
        latest_visit.source_payload->>'survey_result' as last_survey_result,
        latest_visit.source_payload->>'absence_semantics' as absence_semantics,
        latest_visit.target_taxa_scope,
        coalesce(latest_visit.point_latitude, p.center_latitude)::float8 as latitude,
        coalesce(latest_visit.point_longitude, p.center_longitude)::float8 as longitude,
        stats.seasonal_visit_count,
        stats.current_season_visit_count
      from place_stats stats
      join places p on p.place_id = stats.place_id
      join lateral (
        select
          v.visit_id,
          v.observed_at,
          v.visit_mode,
          v.target_taxa_scope,
          v.source_payload,
          v.point_latitude,
          v.point_longitude
        from visits v
        where v.user_id = $1
          and v.place_id = stats.place_id
        order by v.observed_at desc, v.visit_id desc
        limit 1
      ) latest_visit on true
      left join lateral (
        select window_stats.last_observed_at::text as previous_observed_at
        from place_window_stats window_stats
        where window_stats.place_id = stats.place_id
        order by window_stats.last_observed_at desc
        offset 1
        limit 1
      ) previous_visit on true
      left join lateral (
        select coalesce(o.vernacular_name, o.scientific_name) as display_name
        from occurrences o
        where o.visit_id = latest_visit.visit_id
        order by o.subject_index asc
        limit 1
      ) latest_subject on true
      order by ${sortSql(sort)}
      limit $2`,
    [userId, limit],
  );

  return result.rows.map((row) => {
    const visitPayload = (row.source_payload && typeof row.source_payload === "object")
      ? row.source_payload
      : {};
    const revisitReason = typeof visitPayload.revisit_reason === "string"
      ? visitPayload.revisit_reason.trim()
      : "";
    const nextLookFor = typeof visitPayload.next_look_for === "string"
      ? visitPayload.next_look_for.trim()
      : "";
    const seasonalVisitCount = Number(row.seasonal_visit_count) || 0;
    return {
      placeId: row.place_id,
      placeName: row.place_name ?? row.place_id,
      municipality: row.municipality,
      lastObservedAt: row.last_observed_at,
      previousObservedAt: row.previous_observed_at,
      firstObservedAt: row.first_observed_at,
      visitCount: Number(row.visit_count) || 0,
      latestVisitId: row.latest_visit_id,
      latestDisplayName: row.latest_display_name,
      revisitReason: revisitReason || null,
      nextLookFor: nextLookFor || row.target_taxa_scope || row.latest_display_name || null,
      lastRecordMode: row.last_record_mode,
      lastSurveyResult: row.last_survey_result,
      absenceSemantics: row.absence_semantics,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      seasonalVisitCount,
      currentSeasonVisited: (Number(row.current_season_visit_count) || 0) > 0,
    };
  });
}
