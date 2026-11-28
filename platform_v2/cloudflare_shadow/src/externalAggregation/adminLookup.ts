import { buildAdminIndex, type AdminBoundary, type AdminGeometry, type AdminIndex, type AdminUnitLevel } from "../adminUnits";
import type { ExtDb } from "./types";

interface BoundaryRow {
  code: string;
  level: string;
  parent_code: string | null;
  bbox_min_lng: number;
  bbox_min_lat: number;
  bbox_max_lng: number;
  bbox_max_lat: number;
  geometry_json: string;
}

export async function loadAdminIndexForBbox(db: ExtDb, bbox: [number, number, number, number]): Promise<AdminIndex> {
  try {
    const rows = (await db.prepare(
      `SELECT b.code,u.level,u.parent_code,b.bbox_min_lng,b.bbox_min_lat,b.bbox_max_lng,b.bbox_max_lat,b.geometry_json
       FROM admin_unit_boundaries b JOIN admin_units u ON u.code=b.code
       WHERE b.bbox_min_lng<=? AND b.bbox_max_lng>=? AND b.bbox_min_lat<=? AND b.bbox_max_lat>=?`,
    ).bind(bbox[2], bbox[0], bbox[3], bbox[1]).all<BoundaryRow>()).results;
    const units: AdminBoundary[] = [];
    for (const r of rows) {
      try {
        units.push({
          code: r.code,
          level: r.level as AdminUnitLevel,
          parent_code: r.parent_code,
          bbox: [r.bbox_min_lng, r.bbox_min_lat, r.bbox_max_lng, r.bbox_max_lat],
          geometry: JSON.parse(r.geometry_json) as AdminGeometry,
        });
      } catch { /* skip bad geometry */ }
    }
    return buildAdminIndex(units);
  } catch {
    return buildAdminIndex([]);
  }
}
