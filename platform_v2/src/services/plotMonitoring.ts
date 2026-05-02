import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import type { SessionSnapshot } from "./authSession.js";
import { isAdminOrAnalystRole } from "./reviewerAuthorities.js";

type JsonRecord = Record<string, unknown>;

export type SitePlotAccessAction = "view" | "edit";

export type SitePlotPlace = {
  placeId: string;
  legacySiteId: string | null;
  canonicalName: string;
};

export type SitePlot = {
  id: string;
  plotId: string;
  placeId: string;
  legacySiteId: string | null;
  label: string;
  plotKind: string;
  status: "active" | "archived";
  areaSquareMeters: number | null;
  centerLatitude: number | null;
  centerLongitude: number | null;
  geometry: JsonRecord;
  fixedPhotoPoints: unknown[];
  baseline: JsonRecord;
  sourcePayload: JsonRecord;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SitePlotVisit = {
  id: string;
  plotVisitId: string;
  plotId: string;
  observedAt: string;
  surveyorUserId: string | null;
  canopyCoverPercent: number | null;
  treeCount: number | null;
  meanDbhCm: number | null;
  notes: string | null;
  measurements: JsonRecord;
  photoPoints: unknown[];
  sourcePayload: JsonRecord;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SatelliteContextScope = "site" | "plot";

export type PlotSatelliteContext = {
  id: string;
  contextId: string;
  scopeType: SatelliteContextScope;
  placeId: string;
  plotId: string | null;
  capturedAt: string;
  provider: string;
  metrics: JsonRecord;
  sourcePayload: JsonRecord;
  createdByUserId: string | null;
  createdAt: string;
};

export type SitePlotReport = {
  site: SitePlotPlace;
  summary: {
    plotCount: number;
    visitCount: number;
    satelliteContextCount: number;
    proxyReadyCount: number;
  };
  siteSatelliteContext: {
    latest: PlotSatelliteContext | null;
  };
  plots: Array<SitePlot & {
    visits: SitePlotVisit[];
    latestSatelliteContext: PlotSatelliteContext | null;
  }>;
};

type SitePlotRow = {
  plot_id: string;
  place_id: string;
  legacy_site_id: string | null;
  label: string;
  plot_kind: string;
  status: "active" | "archived";
  area_square_meters: string | null;
  center_latitude: number | null;
  center_longitude: number | null;
  geometry_json: unknown;
  fixed_photo_points_json: unknown;
  baseline_json: unknown;
  source_payload: unknown;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SitePlotVisitRow = {
  plot_visit_id: string;
  plot_id: string;
  observed_at: string;
  surveyor_user_id: string | null;
  canopy_cover_percent: string | null;
  tree_count: number | null;
  mean_dbh_cm: string | null;
  notes: string | null;
  measurements_json: unknown;
  photo_points_json: unknown;
  source_payload: unknown;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SatelliteContextRow = {
  context_id: string;
  scope_type: SatelliteContextScope;
  place_id: string;
  plot_id: string | null;
  captured_at: string;
  provider: string;
  metrics_json: unknown;
  source_payload: unknown;
  created_by_user_id: string | null;
  created_at: string;
};

type NormalizedSitePlotInput = {
  plotId: string;
  label: string;
  plotKind: string;
  status: "active" | "archived";
  areaSquareMeters: number | null;
  centerLatitude: number | null;
  centerLongitude: number | null;
  geometry: JsonRecord;
  fixedPhotoPoints: unknown[];
  baseline: JsonRecord;
  sourcePayload: JsonRecord;
};

type NormalizedSitePlotVisitInput = {
  plotVisitId: string;
  observedAt: string;
  surveyorUserId: string | null;
  canopyCoverPercent: number | null;
  treeCount: number | null;
  meanDbhCm: number | null;
  notes: string | null;
  measurements: JsonRecord;
  photoPoints: unknown[];
  sourcePayload: JsonRecord;
};

type NormalizedSatelliteContextInput = {
  contextId: string;
  capturedAt: string;
  provider: string;
  metrics: JsonRecord;
  sourcePayload: JsonRecord;
};

const SITE_PLOT_SELECT = `
  plot_id,
  place_id,
  legacy_site_id,
  label,
  plot_kind,
  status,
  area_square_meters::text as area_square_meters,
  center_latitude,
  center_longitude,
  geometry_json,
  fixed_photo_points_json,
  baseline_json,
  source_payload,
  created_by_user_id,
  updated_by_user_id,
  created_at::text,
  updated_at::text
`;

const SITE_PLOT_VISIT_SELECT = `
  plot_visit_id,
  plot_id,
  observed_at::text,
  surveyor_user_id,
  canopy_cover_percent::text as canopy_cover_percent,
  tree_count,
  mean_dbh_cm::text as mean_dbh_cm,
  notes,
  measurements_json,
  photo_points_json,
  source_payload,
  created_by_user_id,
  updated_by_user_id,
  created_at::text,
  updated_at::text
`;

const SATELLITE_CONTEXT_SELECT = `
  context_id,
  scope_type,
  place_id,
  plot_id,
  captured_at::text,
  provider,
  metrics_json,
  source_payload,
  created_by_user_id,
  created_at::text
`;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonRecord(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

function toJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstPresent(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function timestampValue(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) {
    return new Date().toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sourcePayloadFor(record: JsonRecord): JsonRecord {
  const explicit = firstPresent(record, ["source_payload", "sourcePayload"]);
  return isJsonRecord(explicit) ? explicit : record;
}

function rowToPlot(row: SitePlotRow): SitePlot {
  return {
    id: row.plot_id,
    plotId: row.plot_id,
    placeId: row.place_id,
    legacySiteId: row.legacy_site_id,
    label: row.label,
    plotKind: row.plot_kind,
    status: row.status,
    areaSquareMeters: numberValue(row.area_square_meters),
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    geometry: toJsonRecord(row.geometry_json),
    fixedPhotoPoints: toJsonArray(row.fixed_photo_points_json),
    baseline: toJsonRecord(row.baseline_json),
    sourcePayload: toJsonRecord(row.source_payload),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVisit(row: SitePlotVisitRow): SitePlotVisit {
  return {
    id: row.plot_visit_id,
    plotVisitId: row.plot_visit_id,
    plotId: row.plot_id,
    observedAt: row.observed_at,
    surveyorUserId: row.surveyor_user_id,
    canopyCoverPercent: numberValue(row.canopy_cover_percent),
    treeCount: row.tree_count,
    meanDbhCm: numberValue(row.mean_dbh_cm),
    notes: row.notes,
    measurements: toJsonRecord(row.measurements_json),
    photoPoints: toJsonArray(row.photo_points_json),
    sourcePayload: toJsonRecord(row.source_payload),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSatelliteContext(row: SatelliteContextRow): PlotSatelliteContext {
  return {
    id: row.context_id,
    contextId: row.context_id,
    scopeType: row.scope_type,
    placeId: row.place_id,
    plotId: row.plot_id,
    capturedAt: row.captured_at,
    provider: row.provider,
    metrics: toJsonRecord(row.metrics_json),
    sourcePayload: toJsonRecord(row.source_payload),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export function normalizeSitePlotInput(siteId: string, input: unknown): NormalizedSitePlotInput {
  const record = toJsonRecord(input);
  const plotId = stringValue(firstPresent(record, ["plot_id", "plotId", "id"]))
    ?? `plot:${siteId}:${randomUUID()}`;
  const label = stringValue(firstPresent(record, ["label", "name", "plot_name", "title"]))
    ?? "Fixed plot";
  const plotKind = stringValue(firstPresent(record, ["plot_kind", "plotKind", "kind"]))
    ?? "fixed";
  const rawStatus = stringValue(firstPresent(record, ["status"])) ?? "active";
  if (rawStatus !== "active" && rawStatus !== "archived") {
    throw new Error("invalid_plot_status");
  }

  return {
    plotId,
    label,
    plotKind,
    status: rawStatus,
    areaSquareMeters: numberValue(firstPresent(record, ["area_square_meters", "areaSquareMeters", "area_m2", "area"])),
    centerLatitude: numberValue(firstPresent(record, ["center_latitude", "centerLatitude", "lat", "latitude"])),
    centerLongitude: numberValue(firstPresent(record, ["center_longitude", "centerLongitude", "lng", "longitude"])),
    geometry: toJsonRecord(firstPresent(record, ["geometry", "geometry_json", "geometryJson"])),
    fixedPhotoPoints: toJsonArray(firstPresent(record, ["fixed_photo_points", "fixedPhotoPoints", "photo_points", "photoPoints"])),
    baseline: toJsonRecord(firstPresent(record, ["baseline", "baseline_json", "baselineJson"])),
    sourcePayload: sourcePayloadFor(record),
  };
}

export function normalizeSitePlotVisitInput(
  plotId: string,
  input: unknown,
  actorUserId: string,
): NormalizedSitePlotVisitInput {
  const record = toJsonRecord(input);
  return {
    plotVisitId: stringValue(firstPresent(record, ["plot_visit_id", "plotVisitId", "visit_id", "visitId", "id"]))
      ?? `plot-visit:${plotId}:${randomUUID()}`,
    observedAt: timestampValue(firstPresent(record, ["observed_at", "observedAt", "date", "captured_at"])),
    surveyorUserId: stringValue(firstPresent(record, ["surveyor_user_id", "surveyorUserId", "user_id", "userId"]))
      ?? actorUserId,
    canopyCoverPercent: numberValue(firstPresent(record, ["canopy_cover_percent", "canopyCoverPercent", "canopy_cover"])),
    treeCount: integerValue(firstPresent(record, ["tree_count", "treeCount"])),
    meanDbhCm: numberValue(firstPresent(record, ["mean_dbh_cm", "meanDbhCm", "dbh_cm"])),
    notes: stringValue(firstPresent(record, ["notes", "note", "memo"])),
    measurements: toJsonRecord(firstPresent(record, ["measurements", "measurements_json", "measurementsJson"])),
    photoPoints: toJsonArray(firstPresent(record, ["photo_points", "photoPoints", "fixed_photo_points", "fixedPhotoPoints"])),
    sourcePayload: sourcePayloadFor(record),
  };
}

export function normalizeSatelliteContextInput(input: unknown): NormalizedSatelliteContextInput {
  const record = toJsonRecord(input);
  const explicitMetrics = firstPresent(record, ["metrics", "metrics_json", "metricsJson"]);
  const metrics = toJsonRecord(explicitMetrics);
  if (Object.keys(metrics).length === 0) {
    for (const key of ["ndvi", "evi", "land_cover_class", "canopy_cover", "vegetation_index", "dataset"]) {
      const value = record[key];
      if (value !== undefined && value !== null) {
        metrics[key] = value;
      }
    }
  }

  return {
    contextId: stringValue(firstPresent(record, ["context_id", "contextId", "snapshot_id", "snapshotId", "id"]))
      ?? `satellite-context:${randomUUID()}`,
    capturedAt: timestampValue(firstPresent(record, ["captured_at", "capturedAt", "observed_at", "observedAt", "date"])),
    provider: stringValue(firstPresent(record, ["provider", "source"])) ?? "manual",
    metrics,
    sourcePayload: sourcePayloadFor(record),
  };
}

export async function resolveSitePlace(siteId: string): Promise<SitePlotPlace> {
  const normalizedSiteId = siteId.trim();
  if (!normalizedSiteId) {
    throw new Error("site_id_required");
  }

  const placeCandidate = normalizedSiteId.startsWith("site:")
    ? normalizedSiteId
    : `site:${normalizedSiteId}`;
  const pool = getPool();
  const result = await pool.query<{
    place_id: string;
    legacy_site_id: string | null;
    canonical_name: string;
  }>(
    `select place_id, legacy_site_id, canonical_name
     from places
     where place_id = $1
        or legacy_site_id = $1
        or place_id = $2
     order by case
        when place_id = $1 then 0
        when legacy_site_id = $1 then 1
        else 2
     end
     limit 1`,
    [normalizedSiteId, placeCandidate],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("site_not_found");
  }
  return {
    placeId: row.place_id,
    legacySiteId: row.legacy_site_id,
    canonicalName: row.canonical_name,
  };
}

export async function assertCanAccessSitePlot(
  session: SessionSnapshot | null,
  siteId: string,
  _action: SitePlotAccessAction,
): Promise<SitePlotPlace> {
  if (!session) {
    throw new Error("session_required");
  }
  if (session.banned) {
    throw new Error("account_disabled");
  }
  if (!isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    throw new Error("site_plot_admin_required");
  }
  return resolveSitePlace(siteId);
}

export async function listSitePlots(siteId: string): Promise<{ site: SitePlotPlace; plots: SitePlot[] }> {
  const site = await resolveSitePlace(siteId);
  const pool = getPool();
  const result = await pool.query<SitePlotRow>(
    `select ${SITE_PLOT_SELECT}
     from site_plots
     where place_id = $1
     order by updated_at desc, plot_id asc`,
    [site.placeId],
  );

  return {
    site,
    plots: result.rows.map(rowToPlot),
  };
}

export async function getSitePlot(siteId: string, plotId: string): Promise<SitePlot | null> {
  const site = await resolveSitePlace(siteId);
  const normalizedPlotId = plotId.trim();
  if (!normalizedPlotId) {
    throw new Error("plot_id_required");
  }
  const pool = getPool();
  const result = await pool.query<SitePlotRow>(
    `select ${SITE_PLOT_SELECT}
     from site_plots
     where place_id = $1 and plot_id = $2
     limit 1`,
    [site.placeId, normalizedPlotId],
  );

  return result.rows[0] ? rowToPlot(result.rows[0]) : null;
}

export async function saveSitePlot(
  siteId: string,
  input: unknown,
  actorUserId: string,
): Promise<{ site: SitePlotPlace; plot: SitePlot }> {
  const site = await resolveSitePlace(siteId);
  const normalized = normalizeSitePlotInput(site.legacySiteId ?? siteId, input);
  const pool = getPool();
  const result = await pool.query<SitePlotRow>(
    `insert into site_plots (
        plot_id, place_id, legacy_site_id, label, plot_kind, status,
        area_square_meters, center_latitude, center_longitude,
        geometry_json, fixed_photo_points_json, baseline_json, source_payload,
        created_by_user_id, updated_by_user_id, created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
        $14, $14, now(), now()
     )
     on conflict (plot_id) do update set
        label = excluded.label,
        plot_kind = excluded.plot_kind,
        status = excluded.status,
        area_square_meters = excluded.area_square_meters,
        center_latitude = excluded.center_latitude,
        center_longitude = excluded.center_longitude,
        geometry_json = excluded.geometry_json,
        fixed_photo_points_json = excluded.fixed_photo_points_json,
        baseline_json = excluded.baseline_json,
        source_payload = excluded.source_payload,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
     where site_plots.place_id = excluded.place_id
     returning ${SITE_PLOT_SELECT}`,
    [
      normalized.plotId,
      site.placeId,
      site.legacySiteId,
      normalized.label,
      normalized.plotKind,
      normalized.status,
      normalized.areaSquareMeters,
      normalized.centerLatitude,
      normalized.centerLongitude,
      JSON.stringify(normalized.geometry),
      JSON.stringify(normalized.fixedPhotoPoints),
      JSON.stringify(normalized.baseline),
      JSON.stringify(normalized.sourcePayload),
      actorUserId,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("plot_id_conflict");
  }

  return {
    site,
    plot: rowToPlot(row),
  };
}

export async function listSitePlotVisits(siteId: string, plotId: string): Promise<{ plot: SitePlot; visits: SitePlotVisit[] }> {
  const plot = await getSitePlot(siteId, plotId);
  if (!plot) {
    throw new Error("plot_not_found");
  }

  const pool = getPool();
  const result = await pool.query<SitePlotVisitRow>(
    `select ${SITE_PLOT_VISIT_SELECT}
     from site_plot_visits
     where plot_id = $1
     order by observed_at desc, created_at desc`,
    [plot.plotId],
  );

  return {
    plot,
    visits: result.rows.map(rowToVisit),
  };
}

export async function saveSitePlotVisit(
  siteId: string,
  plotId: string,
  input: unknown,
  actorUserId: string,
): Promise<{ plot: SitePlot; visit: SitePlotVisit }> {
  const plot = await getSitePlot(siteId, plotId);
  if (!plot) {
    throw new Error("plot_not_found");
  }

  const normalized = normalizeSitePlotVisitInput(plot.plotId, input, actorUserId);
  const pool = getPool();
  const result = await pool.query<SitePlotVisitRow>(
    `insert into site_plot_visits (
        plot_visit_id, plot_id, observed_at, surveyor_user_id,
        canopy_cover_percent, tree_count, mean_dbh_cm, notes,
        measurements_json, photo_points_json, source_payload,
        created_by_user_id, updated_by_user_id, created_at, updated_at
     ) values (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9::jsonb, $10::jsonb, $11::jsonb,
        $12, $12, now(), now()
     )
     on conflict (plot_visit_id) do update set
        observed_at = excluded.observed_at,
        surveyor_user_id = excluded.surveyor_user_id,
        canopy_cover_percent = excluded.canopy_cover_percent,
        tree_count = excluded.tree_count,
        mean_dbh_cm = excluded.mean_dbh_cm,
        notes = excluded.notes,
        measurements_json = excluded.measurements_json,
        photo_points_json = excluded.photo_points_json,
        source_payload = excluded.source_payload,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
     where site_plot_visits.plot_id = excluded.plot_id
     returning ${SITE_PLOT_VISIT_SELECT}`,
    [
      normalized.plotVisitId,
      plot.plotId,
      normalized.observedAt,
      normalized.surveyorUserId,
      normalized.canopyCoverPercent,
      normalized.treeCount,
      normalized.meanDbhCm,
      normalized.notes,
      JSON.stringify(normalized.measurements),
      JSON.stringify(normalized.photoPoints),
      JSON.stringify(normalized.sourcePayload),
      actorUserId,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("plot_visit_id_conflict");
  }

  return {
    plot,
    visit: rowToVisit(row),
  };
}

async function listSiteSatelliteContextsByPlace(placeId: string): Promise<PlotSatelliteContext[]> {
  const pool = getPool();
  const result = await pool.query<SatelliteContextRow>(
    `select ${SATELLITE_CONTEXT_SELECT}
     from plot_satellite_contexts
     where scope_type = 'site' and place_id = $1
     order by captured_at desc, created_at desc`,
    [placeId],
  );
  return result.rows.map(rowToSatelliteContext);
}

async function loadPlotVisitsForPlotIds(plotIds: string[]): Promise<Map<string, SitePlotVisit[]>> {
  const map = new Map<string, SitePlotVisit[]>();
  if (plotIds.length === 0) {
    return map;
  }

  const pool = getPool();
  const result = await pool.query<SitePlotVisitRow>(
    `select ${SITE_PLOT_VISIT_SELECT}
     from site_plot_visits
     where plot_id = any($1::text[])
     order by plot_id asc, observed_at desc, created_at desc`,
    [plotIds],
  );

  for (const row of result.rows) {
    const visit = rowToVisit(row);
    const visits = map.get(visit.plotId) ?? [];
    visits.push(visit);
    map.set(visit.plotId, visits);
  }
  return map;
}

async function loadLatestPlotContexts(plotIds: string[]): Promise<Map<string, PlotSatelliteContext>> {
  const map = new Map<string, PlotSatelliteContext>();
  if (plotIds.length === 0) {
    return map;
  }

  const pool = getPool();
  const result = await pool.query<SatelliteContextRow>(
    `select distinct on (plot_id) ${SATELLITE_CONTEXT_SELECT}
     from plot_satellite_contexts
     where scope_type = 'plot' and plot_id = any($1::text[])
     order by plot_id asc, captured_at desc, created_at desc`,
    [plotIds],
  );

  for (const row of result.rows) {
    if (row.plot_id) {
      map.set(row.plot_id, rowToSatelliteContext(row));
    }
  }
  return map;
}

async function countPlotContexts(plotIds: string[]): Promise<number> {
  if (plotIds.length === 0) {
    return 0;
  }
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count
     from plot_satellite_contexts
     where scope_type = 'plot' and plot_id = any($1::text[])`,
    [plotIds],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listSatelliteContexts(
  scopeType: SatelliteContextScope,
  siteId: string,
  plotId?: string | null,
): Promise<{ site: SitePlotPlace; plot: SitePlot | null; contexts: PlotSatelliteContext[]; latest: PlotSatelliteContext | null }> {
  const site = await resolveSitePlace(siteId);
  let plot: SitePlot | null = null;
  const pool = getPool();
  let result;

  if (scopeType === "plot") {
    if (!plotId?.trim()) {
      throw new Error("plot_id_required");
    }
    plot = await getSitePlot(siteId, plotId);
    if (!plot) {
      throw new Error("plot_not_found");
    }
    result = await pool.query<SatelliteContextRow>(
      `select ${SATELLITE_CONTEXT_SELECT}
       from plot_satellite_contexts
       where scope_type = 'plot' and plot_id = $1
       order by captured_at desc, created_at desc`,
      [plot.plotId],
    );
  } else {
    result = await pool.query<SatelliteContextRow>(
      `select ${SATELLITE_CONTEXT_SELECT}
       from plot_satellite_contexts
       where scope_type = 'site' and place_id = $1
       order by captured_at desc, created_at desc`,
      [site.placeId],
    );
  }

  const contexts = result.rows.map(rowToSatelliteContext);
  return {
    site,
    plot,
    contexts,
    latest: contexts[0] ?? null,
  };
}

export async function saveSatelliteContext(
  scopeType: SatelliteContextScope,
  siteId: string,
  plotId: string | null,
  input: unknown,
  actorUserId: string,
): Promise<{ site: SitePlotPlace; plot: SitePlot | null; context: PlotSatelliteContext }> {
  const site = await resolveSitePlace(siteId);
  let plot: SitePlot | null = null;
  if (scopeType === "plot") {
    if (!plotId?.trim()) {
      throw new Error("plot_id_required");
    }
    plot = await getSitePlot(siteId, plotId);
    if (!plot) {
      throw new Error("plot_not_found");
    }
  }

  const normalized = normalizeSatelliteContextInput(input);
  const pool = getPool();
  const result = await pool.query<SatelliteContextRow>(
    `insert into plot_satellite_contexts (
        context_id, scope_type, place_id, plot_id, captured_at, provider,
        metrics_json, source_payload, created_by_user_id, created_at
     ) values (
        $1, $2, $3, $4, $5, $6,
        $7::jsonb, $8::jsonb, $9, now()
     )
     on conflict (context_id) do update set
        captured_at = excluded.captured_at,
        provider = excluded.provider,
        metrics_json = excluded.metrics_json,
        source_payload = excluded.source_payload
     where plot_satellite_contexts.scope_type = excluded.scope_type
       and plot_satellite_contexts.place_id = excluded.place_id
       and coalesce(plot_satellite_contexts.plot_id, '') = coalesce(excluded.plot_id, '')
     returning ${SATELLITE_CONTEXT_SELECT}`,
    [
      normalized.contextId,
      scopeType,
      site.placeId,
      plot?.plotId ?? null,
      normalized.capturedAt,
      normalized.provider,
      JSON.stringify(normalized.metrics),
      JSON.stringify(normalized.sourcePayload),
      actorUserId,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("satellite_context_id_conflict");
  }

  return {
    site,
    plot,
    context: rowToSatelliteContext(row),
  };
}

export async function buildSitePlotReport(siteId: string, plotId?: string | null): Promise<SitePlotReport> {
  const site = await resolveSitePlace(siteId);
  let plots: SitePlot[];
  if (plotId?.trim()) {
    const plot = await getSitePlot(siteId, plotId);
    if (!plot) {
      throw new Error("plot_not_found");
    }
    plots = [plot];
  } else {
    const listed = await listSitePlots(siteId);
    plots = listed.plots;
  }

  const plotIds = plots.map((plot) => plot.plotId);
  const visitsByPlot = await loadPlotVisitsForPlotIds(plotIds);
  const latestContextByPlot = await loadLatestPlotContexts(plotIds);
  const siteContexts = await listSiteSatelliteContextsByPlace(site.placeId);
  const plotContextCount = await countPlotContexts(plotIds);

  const reportPlots = plots.map((plot) => {
    const visits = visitsByPlot.get(plot.plotId) ?? [];
    const latestSatelliteContext = latestContextByPlot.get(plot.plotId) ?? null;
    return {
      ...plot,
      visits,
      latestSatelliteContext,
    };
  });

  const visitCount = reportPlots.reduce((count, plot) => count + plot.visits.length, 0);
  const proxyReadyCount = reportPlots.filter((plot) =>
    plot.visits.length > 0 && plot.latestSatelliteContext !== null,
  ).length;

  return {
    site,
    summary: {
      plotCount: reportPlots.length,
      visitCount,
      satelliteContextCount: siteContexts.length + plotContextCount,
      proxyReadyCount,
    },
    siteSatelliteContext: {
      latest: siteContexts[0] ?? null,
    },
    plots: reportPlots,
  };
}
