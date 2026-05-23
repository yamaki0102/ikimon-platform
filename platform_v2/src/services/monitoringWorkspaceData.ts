import { getPool } from "../db.js";
import { buildObservationPackage } from "./observationPackage.js";
import {
  buildMonitoringWorkspaceReadModel,
  type MonitoringWorkspaceBbox,
  type MonitoringWorkspaceInput,
  type MonitoringWorkspaceReadModel,
  type MonitoringWorkspaceRecordInput,
  type MonitoringWorkspaceReportPurpose,
} from "./monitoringWorkspaceReadModel.js";

type FieldRow = {
  field_id: string;
  name: string;
  polygon: unknown;
  bbox_min_lng: number | null;
  bbox_min_lat: number | null;
  bbox_max_lng: number | null;
  bbox_max_lat: number | null;
};

type VisitPointRow = {
  visit_id: string;
  observed_at: string;
  lat: number | null;
  lng: number | null;
  field_ids: string[] | null;
};

export type LoadMonitoringWorkspaceForFieldInput = {
  fieldId: string;
  start: string;
  end: string;
  limit?: number;
  reportPurpose?: MonitoringWorkspaceReportPurpose;
  gridStepDegrees?: number;
};

function walkCoordinates(value: unknown, visit: (lng: number, lat: number) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value[0], value[1]);
    return;
  }
  for (const item of value) walkCoordinates(item, visit);
}

function bboxFromPolygon(polygon: unknown): MonitoringWorkspaceBbox | null {
  if (!polygon || typeof polygon !== "object") return null;
  const coordinates = (polygon as { coordinates?: unknown; geometry?: { coordinates?: unknown } }).coordinates
    ?? (polygon as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  walkCoordinates(coordinates, (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });
  return Number.isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

function bboxForField(row: FieldRow): MonitoringWorkspaceBbox | null {
  if (
    row.bbox_min_lng !== null
    && row.bbox_min_lat !== null
    && row.bbox_max_lng !== null
    && row.bbox_max_lat !== null
  ) {
    return [row.bbox_min_lng, row.bbox_min_lat, row.bbox_max_lng, row.bbox_max_lat];
  }
  return bboxFromPolygon(row.polygon);
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return 120;
  return Math.max(1, Math.min(300, Math.trunc(limit!)));
}

function tagsForRecord(record: MonitoringWorkspaceRecordInput): string[] {
  const contract = record.contract;
  return [...new Set([
    contract.recordCore.taxon.safePublicRank,
    contract.methodExtension.observationMethod,
    contract.protocolCampaign.monitoringPackageId,
    contract.protocolCampaign.contextKind,
  ].filter((value): value is string => Boolean(value)))];
}

async function loadField(fieldId: string): Promise<FieldRow | null> {
  const pool = getPool();
  const result = await pool.query<FieldRow>(
    `select field_id::text as field_id,
            name,
            polygon,
            bbox_min_lng,
            bbox_min_lat,
            bbox_max_lng,
            bbox_max_lat
       from observation_fields
      where field_id::text = $1
      limit 1`,
    [fieldId],
  );
  return result.rows[0] ?? null;
}

async function loadVisitPoints(bbox: MonitoringWorkspaceBbox, start: string, end: string, limit: number): Promise<VisitPointRow[]> {
  const pool = getPool();
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const result = await pool.query<VisitPointRow>(
    `select v.visit_id,
            v.observed_at::text as observed_at,
            coalesce(v.point_latitude, p.center_latitude)::float as lat,
            coalesce(v.point_longitude, p.center_longitude)::float as lng,
            coalesce(v.resolved_field_ids::text[], array[]::text[]) as field_ids
       from visits v
       left join places p on p.place_id = v.place_id
      where v.observed_at >= $1
        and v.observed_at <= $2
        and coalesce(v.point_latitude, p.center_latitude) is not null
        and coalesce(v.point_longitude, p.center_longitude) is not null
        and coalesce(v.point_longitude, p.center_longitude) between $3 and $4
        and coalesce(v.point_latitude, p.center_latitude) between $5 and $6
      order by v.observed_at desc
      limit $7`,
    [start, end, minLng, maxLng, minLat, maxLat, limit],
  );
  return result.rows;
}

async function toWorkspaceRecord(row: VisitPointRow): Promise<MonitoringWorkspaceRecordInput | null> {
  const pkg = await buildObservationPackage({ visitId: row.visit_id }).catch(() => null);
  if (!pkg?.monitoringRecordContract || row.lat === null || row.lng === null) return null;
  const record: MonitoringWorkspaceRecordInput = {
    recordId: row.visit_id,
    observedAt: row.observed_at,
    point: {
      lat: row.lat,
      lng: row.lng,
      locationPrecision: pkg.monitoringRecordContract.recordCore.place.locationPrecision,
      publicPrecision: pkg.monitoringRecordContract.recordCore.place.publicPrecision,
    },
    fieldIds: row.field_ids ?? [],
    tags: [],
    contract: pkg.monitoringRecordContract,
  };
  return {
    ...record,
    tags: tagsForRecord(record),
  };
}

export async function loadMonitoringWorkspaceReadModelForField(
  input: LoadMonitoringWorkspaceForFieldInput,
): Promise<MonitoringWorkspaceReadModel | null> {
  const field = await loadField(input.fieldId);
  if (!field) return null;
  const bbox = bboxForField(field);
  if (!bbox) return null;
  const limit = clampLimit(input.limit);
  const visitRows = await loadVisitPoints(bbox, input.start, input.end, limit);
  const records = (await Promise.all(visitRows.map(toWorkspaceRecord)))
    .filter((record): record is MonitoringWorkspaceRecordInput => record !== null);

  const modelInput: MonitoringWorkspaceInput = {
    workspaceId: `field:${field.field_id}`,
    label: `${field.name} Monitoring Workspace`,
    area: {
      areaId: field.field_id,
      label: field.name,
      bbox,
      polygon: field.polygon,
    },
    term: {
      start: input.start,
      end: input.end,
    },
    records,
    gridStepDegrees: input.gridStepDegrees,
    reportPurpose: input.reportPurpose,
  };
  return buildMonitoringWorkspaceReadModel(modelInput);
}
