/**
 * areaPlaceSnapshot — extends `getPlaceSnapshot` with the data the /ja/map
 * area sidesheet needs (yearly timeline, 5 effort indicators, sensitive
 * species masking metadata).
 *
 * The base PlaceSnapshot is reused as-is. New aggregations run side-by-side
 * over the same field-resolved visit set so the contract with the existing
 * sidesheet stays intact.
 *
 * Effort indicators are scored per the literature noted in the implementation
 * plan: eBird Best Practices (Strimas-Mackey 2020), Kelling et al. (2019)
 * "Using semistructured surveys", GBIF sampling completeness (Sousa-Baena
 * 2014), iNaturalist City Nature Challenge / Callaghan (2021), van Strien
 * et al. (2013) on opportunistic occupancy modelling.
 */
import { getPool } from "../db.js";
import { getField } from "./observationFieldRegistry.js";
import {
  composePlaceSnapshot,
  type PlaceSnapshot,
} from "./placeSnapshot.js";
import { getPlaceSnapshot } from "./placeSnapshot.js";
import {
  loadSensitiveSpeciesIndex,
  decidePublicCoord,
  viewerCanSeeExact,
  type ViewerContext,
} from "./sensitiveSpeciesMasking.js";

export type AreaYearlyRow = {
  year: number;
  observations: number;
  uniqueTaxa: number;
  visits: number;
  effortVisits: number;
  completeChecklists: number;
};

export type AreaEffortIndicators = {
  effortReportedRate: number;       // 1
  completeChecklistRate: number;    // 2
  temporalSpreadIndex: number;      // 3
  observerDiversity: number;        // 4 (1 - HHI)
  nonDetectionRate: number;         // 5
  effortIndex: number;              // composite (0-100)
  observerCount: number;
  topObserverShare: number;         // 0-1
  yearsCovered: number;
  monthsCovered: number;
  seasonsCovered: number;
};

export type AreaSensitiveMasking = {
  totalRare: number;
  maskedSpecies: number;
  viewerCanSeeExact: boolean;
};

export type AreaPlaceSnapshot = PlaceSnapshot & {
  yearlyTimeline: AreaYearlyRow[];
  effortIndicators: AreaEffortIndicators;
  sensitiveMasking: AreaSensitiveMasking;
  firstSeenSpecies: Array<{ year: number; scientificName: string; vernacularName: string | null }>;
  environmentChange: null;
};

const EMPTY_INDICATORS: AreaEffortIndicators = {
  effortReportedRate: 0,
  completeChecklistRate: 0,
  temporalSpreadIndex: 0,
  observerDiversity: 0,
  nonDetectionRate: 0,
  effortIndex: 0,
  observerCount: 0,
  topObserverShare: 0,
  yearsCovered: 0,
  monthsCovered: 0,
  seasonsCovered: 0,
};

function fieldBbox(field: { lat: number; lng: number; radiusM: number }): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const radius = Math.max(50, Math.min(field.radiusM || 1000, 200000));
  const latPad = radius / 111_000;
  const lngPad = radius / (111_000 * Math.max(0.05, Math.cos((field.lat * Math.PI) / 180)));
  return {
    minLat: field.lat - latPad,
    maxLat: field.lat + latPad,
    minLng: field.lng - lngPad,
    maxLng: field.lng + lngPad,
  };
}

function monthToSeason(month: number): number {
  if (month >= 3 && month <= 5) return 0;
  if (month >= 6 && month <= 8) return 1;
  if (month >= 9 && month <= 11) return 2;
  return 3;
}

async function safeQuery<T>(label: string, runner: () => Promise<T>, fallback: T): Promise<T> {
  try { return await runner(); }
  catch (err) { console.warn(`[areaPlaceSnapshot] ${label} failed`, err); return fallback; }
}

async function loadYearlyTimeline(
  field: { fieldId: string; lat: number; lng: number; radiusM: number },
  placeId: string | null,
): Promise<AreaYearlyRow[]> {
  const bbox = fieldBbox(field);
  const pool = getPool();
  return safeQuery(
    "yearly_timeline",
    async () => {
      const result = await pool.query<{
        year: string;
        observations: string;
        unique_taxa: string;
        visits: string;
        effort_visits: string;
        complete_checklists: string;
      }>(
        `with field_visits as (
            select v.*
              from visits v
              left join places p on p.place_id = v.place_id
             where v.observed_at is not null
               and (
                 v.source_payload->>'field_id' = $1
                 or ($2::text is not null and v.place_id = $2)
                 or $1::uuid = ANY(v.resolved_field_ids)
                 or (
                   coalesce(v.point_latitude, p.center_latitude) between $3 and $4
                   and coalesce(v.point_longitude, p.center_longitude) between $5 and $6
                 )
               )
          ),
          field_occ as (
            select o.*, fv.observed_at
              from occurrences o
              join field_visits fv on fv.visit_id = o.visit_id
          )
          select extract(year from observed_at)::int::text as year,
                 (select count(*) from field_occ fo where extract(year from fo.observed_at) = extract(year from fv.observed_at))::text as observations,
                 (select count(distinct coalesce(nullif(scientific_name, ''), nullif(vernacular_name, ''), occurrence_id)) from field_occ fo where extract(year from fo.observed_at) = extract(year from fv.observed_at))::text as unique_taxa,
                 count(distinct fv.visit_id)::text as visits,
                 count(*) filter (where fv.effort_minutes is not null or fv.distance_meters is not null)::text as effort_visits,
                 count(*) filter (where fv.complete_checklist_flag is true)::text as complete_checklists
            from field_visits fv
           group by extract(year from observed_at)
           order by year desc
           limit 12`,
        [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
      );
      return result.rows.map((row) => ({
        year: Number(row.year),
        observations: Number(row.observations),
        uniqueTaxa: Number(row.unique_taxa),
        visits: Number(row.visits),
        effortVisits: Number(row.effort_visits),
        completeChecklists: Number(row.complete_checklists),
      }));
    },
    [] as AreaYearlyRow[],
  );
}

async function loadEffortIndicators(
  field: { fieldId: string; lat: number; lng: number; radiusM: number; createdAt: string },
  placeId: string | null,
): Promise<AreaEffortIndicators> {
  const bbox = fieldBbox(field);
  const pool = getPool();
  return safeQuery(
    "effort_indicators",
    async () => {
      const visitsRow = await pool.query<{
        total_visits: string;
        effort_visits: string;
        complete_checklists: string;
        observer_count: string;
        top_observer_visits: string;
        absent_records: string;
      }>(
        `with field_visits as (
            select v.*
              from visits v
              left join places p on p.place_id = v.place_id
             where v.source_payload->>'field_id' = $1
                or ($2::text is not null and v.place_id = $2)
                or $1::uuid = ANY(v.resolved_field_ids)
                or (
                  coalesce(v.point_latitude, p.center_latitude) between $3 and $4
                  and coalesce(v.point_longitude, p.center_longitude) between $5 and $6
                )
          ),
          observer_counts as (
            select coalesce(user_id, source_payload->>'observer_id', source_payload->>'recorded_by', 'anonymous') as observer_id,
                   count(*) as visits
              from field_visits
             group by 1
          )
          select count(distinct visit_id)::text as total_visits,
                 count(*) filter (where effort_minutes is not null or distance_meters is not null)::text as effort_visits,
                 count(*) filter (where complete_checklist_flag is true)::text as complete_checklists,
                 (select count(*)::text from observer_counts) as observer_count,
                 (select coalesce(max(visits), 0)::text from observer_counts) as top_observer_visits,
                 (select count(*)::text from occurrences o
                    join field_visits fv on fv.visit_id = o.visit_id
                   where o.occurrence_status = 'absent') as absent_records
            from field_visits`,
        [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
      );
      const monthsRow = await pool.query<{ months: number[] | null; years: number[] | null }>(
        `with field_visits as (
            select v.*
              from visits v
              left join places p on p.place_id = v.place_id
             where v.source_payload->>'field_id' = $1
                or ($2::text is not null and v.place_id = $2)
                or $1::uuid = ANY(v.resolved_field_ids)
                or (
                  coalesce(v.point_latitude, p.center_latitude) between $3 and $4
                  and coalesce(v.point_longitude, p.center_longitude) between $5 and $6
                )
          )
          select array(select distinct extract(month from observed_at)::int from field_visits where observed_at is not null order by 1) as months,
                 array(select distinct extract(year from observed_at)::int from field_visits where observed_at is not null order by 1) as years`,
        [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
      );
      const observerHHI = await pool.query<{ hhi: string }>(
        `with field_visits as (
            select v.*
              from visits v
              left join places p on p.place_id = v.place_id
             where v.source_payload->>'field_id' = $1
                or ($2::text is not null and v.place_id = $2)
                or $1::uuid = ANY(v.resolved_field_ids)
                or (
                  coalesce(v.point_latitude, p.center_latitude) between $3 and $4
                  and coalesce(v.point_longitude, p.center_longitude) between $5 and $6
                )
          ),
          observer_share as (
            select coalesce(user_id, source_payload->>'observer_id', source_payload->>'recorded_by', 'anonymous') as observer_id,
                   count(*)::float / nullif((select count(*) from field_visits), 0) as share
              from field_visits
             group by 1
          )
          select coalesce(sum(share * share), 0)::text as hhi from observer_share`,
        [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
      );

      const totalVisits = Number(visitsRow.rows[0]?.total_visits ?? 0);
      const effortVisits = Number(visitsRow.rows[0]?.effort_visits ?? 0);
      const completeChecklists = Number(visitsRow.rows[0]?.complete_checklists ?? 0);
      const observerCount = Number(visitsRow.rows[0]?.observer_count ?? 0);
      const topObserverVisits = Number(visitsRow.rows[0]?.top_observer_visits ?? 0);
      const absentRecords = Number(visitsRow.rows[0]?.absent_records ?? 0);
      const months = (monthsRow.rows[0]?.months ?? []).filter((m) => m >= 1 && m <= 12);
      const years = (monthsRow.rows[0]?.years ?? []).filter((y) => Number.isFinite(y));
      const hhi = Number(observerHHI.rows[0]?.hhi ?? 1);

      const seasonsSet = new Set<number>();
      for (const m of months) seasonsSet.add(monthToSeason(m));

      const fieldAgeYears = (() => {
        const created = new Date(field.createdAt);
        if (Number.isNaN(created.getTime())) return 1;
        const yrs = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return Math.max(1, Math.min(5, yrs));
      })();

      const effortReportedRate = totalVisits > 0 ? effortVisits / totalVisits : 0;
      const completeChecklistRate = totalVisits > 0 ? completeChecklists / totalVisits : 0;
      const seasonsCovered = seasonsSet.size;
      const monthsCovered = months.length;
      const yearsCovered = years.length;
      const temporalSpreadIndex = (seasonsCovered / 4) * (monthsCovered / 12) * (yearsCovered / fieldAgeYears);
      const observerDiversity = observerCount <= 1 ? 0 : Math.max(0, Math.min(1, 1 - hhi));
      const topObserverShare = totalVisits > 0 ? topObserverVisits / totalVisits : 0;
      const nonDetectionRate = totalVisits > 0 ? (absentRecords + completeChecklists) / totalVisits : 0;
      const effortIndex = (
        effortReportedRate * 0.30 +
        completeChecklistRate * 0.20 +
        temporalSpreadIndex * 0.20 +
        observerDiversity * 0.15 +
        Math.min(1, nonDetectionRate) * 0.15
      ) * 100;

      return {
        effortReportedRate,
        completeChecklistRate,
        temporalSpreadIndex: Math.max(0, Math.min(1, temporalSpreadIndex)),
        observerDiversity,
        nonDetectionRate: Math.max(0, Math.min(1, nonDetectionRate)),
        effortIndex,
        observerCount,
        topObserverShare,
        yearsCovered,
        monthsCovered,
        seasonsCovered,
      };
    },
    EMPTY_INDICATORS,
  );
}

async function loadSensitiveMasking(
  field: { fieldId: string; lat: number; lng: number; radiusM: number },
  placeId: string | null,
  viewer: ViewerContext,
): Promise<AreaSensitiveMasking> {
  const bbox = fieldBbox(field);
  const pool = getPool();
  return safeQuery(
    "sensitive_masking",
    async () => {
      const index = await loadSensitiveSpeciesIndex();
      if (index.size === 0) {
        return { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: viewerCanSeeExact(viewer) };
      }
      const result = await pool.query<{
        scientific_name: string | null;
        context_precision: string | null;
        risk_lane: string | null;
      }>(
        `with field_visits as (
            select v.*
              from visits v
              left join places p on p.place_id = v.place_id
             where v.source_payload->>'field_id' = $1
                or ($2::text is not null and v.place_id = $2)
                or $1::uuid = ANY(v.resolved_field_ids)
                or (
                  coalesce(v.point_latitude, p.center_latitude) between $3 and $4
                  and coalesce(v.point_longitude, p.center_longitude) between $5 and $6
                )
          )
          select distinct lower(coalesce(o.scientific_name, '')) as scientific_name,
                 (select max(c.public_precision)
                    from civic_observation_contexts c
                   where c.visit_id = fv.visit_id) as context_precision,
                 (select max(c.risk_lane)
                    from civic_observation_contexts c
                   where c.visit_id = fv.visit_id) as risk_lane
            from occurrences o
            join field_visits fv on fv.visit_id = o.visit_id
           where coalesce(o.scientific_name, '') <> ''`,
        [field.fieldId, placeId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng],
      );

      const sensitiveNames = new Set<string>();
      const maskedNames = new Set<string>();
      for (const row of result.rows) {
        const sci = row.scientific_name ?? "";
        if (!sci || !index.has(sci)) continue;
        sensitiveNames.add(sci);
        const decision = decidePublicCoord(
          {
            scientificName: sci,
            vernacularName: null,
            contextPrecision: (row.context_precision as OccurrenceForMaskingPrecision) ?? null,
            riskLane: row.risk_lane,
          },
          viewer,
          index,
        );
        if (decision.mode !== "exact") maskedNames.add(sci);
      }
      return {
        totalRare: sensitiveNames.size,
        maskedSpecies: maskedNames.size,
        viewerCanSeeExact: viewerCanSeeExact(viewer),
      };
    },
    { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: viewerCanSeeExact(viewer) },
  );
}

type OccurrenceForMaskingPrecision = "exact_private" | "site" | "mesh" | "municipality" | "hidden";

export async function getAreaPlaceSnapshot(
  fieldId: string,
  options: { viewer: ViewerContext },
): Promise<AreaPlaceSnapshot | null> {
  const base = await getPlaceSnapshot(fieldId);
  if (!base) return null;
  const field = await getField(fieldId);
  if (!field) return null;
  const placeId = base.relationshipScore.placeId ?? null;
  const fieldForBbox = { fieldId, lat: field.lat, lng: field.lng, radiusM: field.radiusM, createdAt: field.createdAt };
  const [yearlyTimeline, effortIndicators, sensitiveMasking] = await Promise.all([
    loadYearlyTimeline(fieldForBbox, placeId),
    loadEffortIndicators(fieldForBbox, placeId),
    loadSensitiveMasking(fieldForBbox, placeId, options.viewer),
  ]);
  return {
    ...base,
    yearlyTimeline,
    effortIndicators,
    sensitiveMasking,
    firstSeenSpecies: [],
    environmentChange: null,
  };
}

export const __test__ = {
  monthToSeason,
  fieldBbox,
};

// Re-export for the test suite to compose AreaPlaceSnapshot manually.
export { composePlaceSnapshot };
