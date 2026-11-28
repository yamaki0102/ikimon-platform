import { publicSafetyDecisionForContext, shouldCoarsenPublicAreaLabel } from "./publicAreaLabel";

export type Position = [number, number];
export type Ring = Position[];
export type AdminGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };
export type AdminUnitLevel = "pref" | "city" | "ward" | "town" | "village";
export type AdminBoundary = {
  code: string;
  level: AdminUnitLevel;
  parent_code: string | null;
  bbox: [number, number, number, number];
  geometry: AdminGeometry;
};
export type AdminCodes = {
  country_code: string;
  pref_code: string | null;
  city_code: string | null;
  ward_code: string | null;
  town_code: string | null;
};
export type PublishedLevel = "town" | "ward" | "city" | "pref" | "hidden";

export function ringBbox(ring: Ring, acc: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]): [number, number, number, number] {
  for (const [x, y] of ring) {
    if (x < acc[0]) acc[0] = x;
    if (y < acc[1]) acc[1] = y;
    if (x > acc[2]) acc[2] = x;
    if (y > acc[3]) acc[3] = y;
  }
  return acc;
}

export function geometryBbox(geometry: AdminGeometry): [number, number, number, number] {
  const acc: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) if (poly[0]) ringBbox(poly[0], acc);
  return acc;
}

export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(lng, lat, rings[i])) return false;
  return true;
}

export function pointInGeometry(lng: number, lat: number, geometry: AdminGeometry): boolean {
  if (geometry.type === "Polygon") return pointInPolygon(lng, lat, geometry.coordinates);
  for (const poly of geometry.coordinates) if (pointInPolygon(lng, lat, poly)) return true;
  return false;
}

export function pointInBoundary(lng: number, lat: number, unit: AdminBoundary): boolean {
  const b = unit.bbox;
  if (lng < b[0] || lat < b[1] || lng > b[2] || lat > b[3]) return false;
  return pointInGeometry(lng, lat, unit.geometry);
}

export type AdminIndex = { leaves: AdminBoundary[]; townsByParent: Map<string, AdminBoundary[]> };

export function buildAdminIndex(units: AdminBoundary[]): AdminIndex {
  const leaves: AdminBoundary[] = [];
  const townsByParent = new Map<string, AdminBoundary[]>();
  for (const u of units) {
    if (u.level === "town") {
      const key = u.parent_code ?? "";
      const list = townsByParent.get(key) ?? [];
      list.push(u);
      townsByParent.set(key, list);
    } else if (u.level !== "pref") leaves.push(u);
  }
  return { leaves, townsByParent };
}

export function resolveAdminCodes(lng: number, lat: number, index: AdminIndex, country = "JP"): AdminCodes {
  const out: AdminCodes = { country_code: country, pref_code: null, city_code: null, ward_code: null, town_code: null };
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return out;
  const leaf = index.leaves.find((u) => pointInBoundary(lng, lat, u));
  if (!leaf) return out;
  out.pref_code = leaf.code.slice(0, 2);
  if (leaf.level === "village") return out;
  if (leaf.level === "ward") {
    out.ward_code = leaf.code;
    out.city_code = leaf.parent_code;
  } else out.city_code = leaf.code;
  const town = (index.townsByParent.get(leaf.code) ?? []).find((u) => pointInBoundary(lng, lat, u));
  if (town) out.town_code = town.code;
  return out;
}

const LEVEL_RANK: Record<PublishedLevel, number> = { hidden: 0, pref: 1, city: 2, ward: 3, town: 4 };

export function resolvedDepth(codes: AdminCodes): PublishedLevel {
  if (codes.town_code) return "town";
  if (codes.ward_code) return "ward";
  if (codes.city_code) return "city";
  if (codes.pref_code) return "pref";
  return "hidden";
}

export type PublishPolicyInput = {
  location_share_mode?: string | null;
  is_child_or_rare?: boolean | number | null;
  coarsened?: boolean | number | null;
  audience_scope?: string | null;
  public_precision?: string | null;
  risk_lane?: string | null;
  municipality?: string | null;
};

export function publishedLevelFor(codes: AdminCodes, policy: PublishPolicyInput | null): PublishedLevel {
  let cap: PublishedLevel = "town";
  if (policy) {
    const safety = publicSafetyDecisionForContext({
      audience_scope: policy.audience_scope ?? null,
      public_precision: policy.public_precision ?? null,
      risk_lane: policy.risk_lane ?? null
    });
    if (safety.blocked || policy.location_share_mode === "hidden") cap = "hidden";
    else if (policy.is_child_or_rare || policy.coarsened || (policy.municipality && shouldCoarsenPublicAreaLabel(policy.municipality))) cap = "pref";
  }
  const depth = resolvedDepth(codes);
  return LEVEL_RANK[depth] <= LEVEL_RANK[cap] ? depth : cap;
}

function simplifyLine(pts: Position[], tol: number): Position[] {
  const n = pts.length;
  if (n <= 2) return pts;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      let d2: number;
      if (len2 === 0) d2 = (px - x1) ** 2 + (py - y1) ** 2;
      else {
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        d2 = (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2;
      }
      if (d2 > maxD) {
        maxD = d2;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: Position[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

export function simplifyRing(ring: Ring, tolerance: number): Ring {
  const n = ring.length;
  if (n <= 4) return ring;
  const closed = ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const open = closed ? ring.slice(0, n - 1) : ring.slice();
  let far = 0;
  let farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  if (far === 0) return ring;
  const a = simplifyLine(open.slice(0, far + 1), tolerance);
  const b = simplifyLine(open.slice(far).concat([open[0]]), tolerance);
  const res = a.concat(b.slice(1));
  return res.length >= 4 ? res : ring;
}

export function simplifyGeometry(geometry: AdminGeometry, tolerance: number, decimals = 5): AdminGeometry {
  const f = 10 ** decimals;
  const round = (r: Ring): Ring => r.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f] as Position);
  const simpRings = (rings: Ring[], force: boolean): Ring[] | null => {
    const outer = round(simplifyRing(rings[0], tolerance));
    if (!force) {
      const bb = ringBbox(outer);
      if (outer.length < 4 || (bb[2] - bb[0] < tolerance && bb[3] - bb[1] < tolerance)) return null;
    }
    const res: Ring[] = [outer.length >= 4 ? outer : round(rings[0])];
    for (let i = 1; i < rings.length; i++) {
      const s = round(simplifyRing(rings[i], tolerance));
      if (s.length >= 4) res.push(s);
    }
    return res;
  };
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: simpRings(geometry.coordinates, true)! };
  const polys = geometry.coordinates.map((p) => simpRings(p, false)).filter((p): p is Ring[] => p !== null);
  if (!polys.length && geometry.coordinates.length) polys.push(simpRings(geometry.coordinates[0], true)!);
  return { type: "MultiPolygon", coordinates: polys };
}
