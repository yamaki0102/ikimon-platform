import { getPool } from "../db.js";
import { buildPlaceId } from "./writeSupport.js";
import type { Landcover, SiteSignals } from "./siteBrief.js";

export type PlaceEnvironmentEvidence = {
  kind: "landcover" | "vegetation" | "water" | "canopy" | "impervious" | "elevation" | "slope" | "context";
  label: string;
  value: string;
  source: string;
  capturedAt: string | null;
  limitation: string | null;
};

type PlaceEnvironmentSnapshotRow = {
  metric_kind: string;
  metric_value: string | number;
  metric_unit: string | null;
  observed_on: string | Date | null;
  valid_from: string | Date | null;
  metadata: Record<string, unknown> | null;
  source_kind: string | null;
};

type PlotSatelliteContextRow = {
  captured_at: string | Date | null;
  provider: string | null;
  metrics_json: Record<string, unknown> | null;
};

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value: unknown): string | null {
  const n = numberValue(value);
  if (n == null) return null;
  return `${Math.round(n * 10) / 10}%`;
}

function landcoverJa(c: Landcover | string): string {
  switch (c) {
    case "tree_cover": return "樹林";
    case "shrubland": return "低木・やぶ";
    case "grassland": return "草地";
    case "cropland": return "農地";
    case "built_up": return "市街地";
    case "bare": return "裸地";
    case "water": return "水域";
    case "wetland": return "湿地";
    default: return String(c);
  }
}

function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "stac_landuse": return "衛星土地被覆";
    case "stac_impervious": return "衛星不透水面";
    case "mlit_landuse_mesh": return "国土数値/土地利用";
    case "nasa_impervious": return "NASA 不透水面";
    case "planetary_computer": return "Sentinel/Copernicus STAC";
    case "osm": return "OpenStreetMap";
    case "gsi": return "国土地理院";
    default: return source || "環境データ";
  }
}

export function environmentEvidenceFromSiteSignals(signals: SiteSignals): PlaceEnvironmentEvidence[] {
  const covers = [...new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover])];
  const evidence: PlaceEnvironmentEvidence[] = [];
  if (covers.length > 0) {
    evidence.push({
      kind: "landcover",
      label: "地図上の土地被覆",
      value: covers.map(landcoverJa).slice(0, 3).join("・"),
      source: "OpenStreetMap",
      capturedAt: null,
      limitation: "公開地図のタグなので、現地の足元・季節・管理状態は未確認",
    });
  }
  if (signals.waterDistanceM != null) {
    evidence.push({
      kind: "water",
      label: "水辺との距離",
      value: `約${Math.round(signals.waterDistanceM)}m`,
      source: "OpenStreetMap",
      capturedAt: null,
      limitation: "小さな水路や一時的な水たまりは地図に出ないことがあります",
    });
  }
  if (signals.elevationM != null) {
    evidence.push({
      kind: "elevation",
      label: "標高",
      value: `約${Math.round(signals.elevationM)}m`,
      source: "国土地理院",
      capturedAt: null,
      limitation: "微地形や日陰、水分条件は現地写真・動画で確認します",
    });
  }
  return evidence;
}

function evidenceFromPlaceSnapshot(row: PlaceEnvironmentSnapshotRow): PlaceEnvironmentEvidence | null {
  const source = sourceLabel(row.source_kind);
  const capturedAt = formatDate(row.observed_on ?? row.valid_from);
  const metadata = row.metadata ?? {};
  const metricValue = numberValue(row.metric_value);
  switch (row.metric_kind) {
    case "landuse_class": {
      const rawClass = typeof metadata.class === "string"
        ? metadata.class
        : typeof metadata.landuse_class === "string"
          ? metadata.landuse_class
          : String(row.metric_value);
      return {
        kind: "landcover",
        label: "衛星/メッシュ土地被覆",
        value: landcoverJa(rawClass),
        source,
        capturedAt,
        limitation: "土地被覆は面の傾向で、個々の生物や管理状態を断定しません",
      };
    }
    case "ndvi_mean":
    case "ndvi_max":
      return metricValue == null ? null : {
        kind: "vegetation",
        label: row.metric_kind === "ndvi_max" ? "植生指数 最大" : "植生指数 平均",
        value: metricValue.toFixed(2),
        source,
        capturedAt,
        limitation: "雲・季節・刈り取り直後の影響を受けます",
      };
    case "water_pct":
      return {
        kind: "water",
        label: "水域割合",
        value: pct(row.metric_value) ?? `${row.metric_value}${row.metric_unit ?? ""}`,
        source,
        capturedAt,
        limitation: "細い水路や一時水域は現地確認が必要です",
      };
    case "forest_pct":
      return {
        kind: "canopy",
        label: "樹林割合",
        value: pct(row.metric_value) ?? `${row.metric_value}${row.metric_unit ?? ""}`,
        source,
        capturedAt,
        limitation: "樹冠の下の草本層や管理状態は写真・動画で補います",
      };
    case "impervious_pct":
    case "urban_pct":
      return {
        kind: "impervious",
        label: row.metric_kind === "urban_pct" ? "市街地割合" : "不透水面割合",
        value: pct(row.metric_value) ?? `${row.metric_value}${row.metric_unit ?? ""}`,
        source,
        capturedAt,
        limitation: "舗装・建物の傾向で、生き物の有無は断定しません",
      };
    case "cropland_pct":
      return {
        kind: "landcover",
        label: "農地割合",
        value: pct(row.metric_value) ?? `${row.metric_value}${row.metric_unit ?? ""}`,
        source,
        capturedAt,
        limitation: "作物・耕起・草刈りなどの管理行為は現地記録が必要です",
      };
    case "elevation_m":
      return metricValue == null ? null : {
        kind: "elevation",
        label: "標高",
        value: `約${Math.round(metricValue)}m`,
        source,
        capturedAt,
        limitation: "微地形や湿り気は現地で確認します",
      };
    case "slope_deg":
      return metricValue == null ? null : {
        kind: "slope",
        label: "斜面",
        value: `約${Math.round(metricValue * 10) / 10}度`,
        source,
        capturedAt,
        limitation: "足元の安全と土壌状態は現地で確認します",
      };
    default:
      return null;
  }
}

function evidenceFromPlotContext(row: PlotSatelliteContextRow): PlaceEnvironmentEvidence[] {
  const metrics = row.metrics_json ?? {};
  const source = sourceLabel(row.provider ?? "manual");
  const capturedAt = formatDate(row.captured_at);
  const evidence: PlaceEnvironmentEvidence[] = [];
  const ndvi = numberValue(metrics.ndvi ?? metrics.vegetation_index);
  if (ndvi != null) {
    evidence.push({
      kind: "vegetation",
      label: "区画の植生指数",
      value: ndvi.toFixed(2),
      source,
      capturedAt,
      limitation: "区画単位の傾向です。足元の写真・動画・管理メモで補います",
    });
  }
  const canopy = numberValue(metrics.canopy_cover);
  if (canopy != null) {
    evidence.push({
      kind: "canopy",
      label: "区画の樹冠/被覆",
      value: canopy <= 1 ? `${Math.round(canopy * 100)}%` : `${Math.round(canopy)}%`,
      source,
      capturedAt,
      limitation: "見通しや下層植生は現地記録が必要です",
    });
  }
  const landCover = typeof metrics.land_cover_class === "string" ? metrics.land_cover_class : null;
  if (landCover) {
    evidence.push({
      kind: "landcover",
      label: "区画の土地被覆",
      value: landcoverJa(landCover),
      source,
      capturedAt,
      limitation: "土地被覆名だけでは管理状態や生物相を断定しません",
    });
  }
  return evidence;
}

export async function getCanonicalPlaceEnvironmentEvidenceForPlaceId(placeId: string): Promise<PlaceEnvironmentEvidence[]> {
  try {
    const pool = getPool();
    const [placeRows, plotRows] = await Promise.all([
      pool.query<PlaceEnvironmentSnapshotRow>(
        `select pes.metric_kind,
                pes.metric_value,
                pes.metric_unit,
                pes.observed_on,
                pes.valid_from,
                pes.metadata,
                ss.source_kind
           from place_environment_snapshots pes
           left join source_snapshots ss on ss.snapshot_id = pes.source_snapshot_id
          where pes.place_id = $1
            and pes.valid_to is null
          order by pes.valid_from desc, pes.created_at desc
          limit 12`,
        [placeId],
      ),
      pool.query<PlotSatelliteContextRow>(
        `select captured_at, provider, metrics_json
           from plot_satellite_contexts
          where place_id = $1
          order by captured_at desc
          limit 3`,
        [placeId],
      ),
    ]);
    const evidence = [
      ...placeRows.rows.map(evidenceFromPlaceSnapshot).filter((item): item is PlaceEnvironmentEvidence => item !== null),
      ...plotRows.rows.flatMap(evidenceFromPlotContext),
    ];
    const deduped = new Map<string, PlaceEnvironmentEvidence>();
    for (const item of evidence) {
      const key = `${item.kind}:${item.label}:${item.value}`;
      if (!deduped.has(key)) deduped.set(key, item);
    }
    return Array.from(deduped.values()).slice(0, 6);
  } catch {
    return [];
  }
}

export async function getCanonicalPlaceEnvironmentEvidence(lat: number, lng: number): Promise<PlaceEnvironmentEvidence[]> {
  return getCanonicalPlaceEnvironmentEvidenceForPlaceId(buildPlaceId({ latitude: lat, longitude: lng }));
}
