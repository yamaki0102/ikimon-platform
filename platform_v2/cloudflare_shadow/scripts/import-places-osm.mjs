import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const USER_AGENT = "zukan-place-import/1.0";
export const DEFAULTS = {
  toleranceM: 5,
  maxPoints: 500,
  pointRadiusM: 50,
  circlePoints: 24,
  parkMinHa: 0.1,
  dedupeMeters: 200,
};
export const AREAS = {
  hamamatsu: { slug: "hamamatsu", name: "浜松市", adminLevel: "7", locality: "静岡県浜松市" },
};
export const HERITAGE_HISTORIC = ["castle", "archaeological_site", "ruins", "monument", "tomb"];
export const RESTRICTED_ACCESS = ["private", "no", "customers", "members", "permit", "restricted"];
export const SCHOOL_AMENITY = ["school", "kindergarten", "college", "university", "childcare"];
const EARTH_RADIUS_M = 6_371_008.8;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320;

const NAME_KEYS = ["official_name:ja", "name:ja", "name", "official_name"];
const ALTERNATE_KEYS = ["short_name", "alt_name", "old_name", "loc_name", "official_name", "name"];
const LANG_CODE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;

export const clean = (value) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim() : "";

export function normalizePlaceSearchText(value) {
  const text = clean(value);
  if (!text) return "";
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s　・･·.,，。'’"“”「」『』()（）\[\]【】_\-/\\]+/gu, "");
}

const round6 = (value) => Math.round(value * 1e6) / 1e6;

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function circleRing(lat, lng, radiusM, points = DEFAULTS.circlePoints) {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const ring = [];
  for (let index = 0; index < points; index += 1) {
    const angle = (2 * Math.PI * index) / points;
    ring.push([round6(lng + dLng * Math.cos(angle)), round6(lat + dLat * Math.sin(angle))]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

export function buildOverpassQuery(scope) {
  const where = scope.kind === "bbox" ? `(${scope.bbox.join(",")})` : "(area.a)";
  const head = scope.kind === "bbox"
    ? ""
    : scope.kind === "relation"
      ? `area(${3_600_000_000 + Number(scope.relationId)})->.a;`
      : `area["boundary"="administrative"]["admin_level"="${scope.adminLevel}"]["name"="${scope.name}"]->.a;`;
  const named = `["name"]`;
  return [
    "[out:json][timeout:180];",
    head,
    "(",
    `nwr${where}["leisure"~"^(park|garden|nature_reserve)$"]${named};`,
    `nwr${where}["boundary"~"^(protected_area|national_park)$"]${named};`,
    `nwr${where}["heritage"]${named};`,
    `nwr${where}["historic"~"^(${HERITAGE_HISTORIC.join("|")})$"]${named};`,
    ");",
    "out geom;",
  ].filter(Boolean).join("\n");
}

export function pickNames(tags) {
  let name = "";
  for (const key of NAME_KEYS) {
    name = clean(tags[key]);
    if (name) break;
  }
  const canonicalKey = normalizePlaceSearchText(name);
  const seen = new Set([canonicalKey]);
  const aliases = [];
  const push = (alias, language, kind) => {
    const text = clean(alias);
    const key = normalizePlaceSearchText(text);
    if (!text || !key || [...text].length > 80 || seen.has(key)) return;
    seen.add(key);
    aliases.push({ alias: text, normalized: key, language, kind });
  };
  for (const [key, value] of Object.entries(tags)) {
    const match = /^name:(.+)$/u.exec(key);
    if (!match || match[1] === "ja") continue;
    const language = match[1].replace(/^ja_kana$/u, "ja-Hira");
    if (LANG_CODE.test(language)) push(value, language, language.startsWith("ja-") ? "reading" : "multilingual");
  }
  for (const key of ALTERNATE_KEYS) {
    for (const part of String(tags[key] ?? "").split(";")) push(part, null, "alternate");
  }
  for (const key of ["name:ja"]) push(tags[key], null, "alternate");
  const multilingual = aliases.filter((item) => item.kind !== "alternate").slice(0, 8);
  const alternate = aliases.filter((item) => item.kind === "alternate").slice(0, 4);
  return { name, aliases: [...multilingual, ...alternate] };
}

export function classifyFeature(tags) {
  const hasHeritageTag = Boolean(clean(tags.heritage)) && clean(tags.heritage) !== "no";
  const heritage = hasHeritageTag || HERITAGE_HISTORIC.includes(clean(tags.historic));
  const nature = ["protected_area", "national_park"].includes(clean(tags.boundary));
  const park = ["park", "garden", "nature_reserve"].includes(clean(tags.leisure));
  const category = nature ? "nature" : park ? "park" : heritage ? "heritage" : null;
  if (!category) return null;
  let placeKind;
  if (nature || clean(tags.leisure) === "nature_reserve") placeKind = "nature_area";
  else if (park) placeKind = "park";
  else if (clean(tags.amenity) === "place_of_worship") placeKind = "temple_shrine";
  else if (clean(tags.tourism) === "museum") placeKind = "museum";
  else placeKind = "other_named_area";
  return { category, heritage, placeKind };
}

const pointKey = (point) => `${point[0]},${point[1]}`;
const toPair = (point) => [round6(point.lon), round6(point.lat)];

export function stitchRings(segments) {
  const pool = segments.filter((segment) => segment.length >= 2).map((segment) => segment.slice());
  const rings = [];
  const used = new Array(pool.length).fill(false);
  const byEnd = new Map();
  pool.forEach((segment, index) => {
    for (const end of [pointKey(segment[0]), pointKey(segment[segment.length - 1])]) {
      if (!byEnd.has(end)) byEnd.set(end, []);
      byEnd.get(end).push(index);
    }
  });
  for (let start = 0; start < pool.length; start += 1) {
    if (used[start]) continue;
    used[start] = true;
    let chain = pool[start].slice();
    let guard = 0;
    while (pointKey(chain[0]) !== pointKey(chain[chain.length - 1]) && guard < pool.length + 2) {
      guard += 1;
      const tail = pointKey(chain[chain.length - 1]);
      const next = (byEnd.get(tail) ?? []).find((index) => !used[index]);
      if (next === undefined) break;
      used[next] = true;
      const segment = pool[next];
      const forward = pointKey(segment[0]) === tail;
      const oriented = forward ? segment : segment.slice().reverse();
      chain = chain.concat(oriented.slice(1));
    }
    if (chain.length >= 4 && pointKey(chain[0]) === pointKey(chain[chain.length - 1])) rings.push(chain);
  }
  return rings;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function elementPolygons(el) {
  if (el.type === "way") {
    const ring = (el.geometry ?? []).map(toPair);
    if (ring.length >= 4 && pointKey(ring[0]) === pointKey(ring[ring.length - 1])) return [[ring]];
    return [];
  }
  if (el.type !== "relation" || !Array.isArray(el.members)) return [];
  const segments = (role) =>
    el.members
      .filter((member) => member.type === "way" && Array.isArray(member.geometry) && (role === "inner" ? member.role === "inner" : member.role !== "inner"))
      .map((member) => member.geometry.map(toPair));
  const outers = stitchRings(segments("outer"));
  if (outers.length === 0) return [];
  const polygons = outers.map((ring) => [ring]);
  for (const inner of stitchRings(segments("inner"))) {
    const owner = polygons.find((polygon) => pointInRing(inner[0][0], inner[0][1], polygon[0]));
    if (owner) owner.push(inner);
  }
  return polygons;
}

function projector(lat0, lng0) {
  const kx = M_PER_DEG_LNG * Math.cos((lat0 * Math.PI) / 180);
  return (point) => [(point[0] - lng0) * kx, (point[1] - lat0) * M_PER_DEG_LAT];
}

export function ringAreaM2(ring) {
  const project = projector(ring[0][1], ring[0][0]);
  const pts = ring.map(project);
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i += 1) sum += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(sum) / 2;
}

export function polygonsAreaHa(polygons) {
  let total = 0;
  for (const polygon of polygons) {
    total += ringAreaM2(polygon[0]);
    for (let i = 1; i < polygon.length; i += 1) total -= ringAreaM2(polygon[i]);
  }
  return Math.max(0, total) / 10_000;
}

export function polygonsBbox(polygons) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        west = Math.min(west, lng);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        north = Math.max(north, lat);
      }
    }
  }
  return { west, south, east, north };
}

export function douglasPeucker(ring, toleranceM) {
  const n = ring.length;
  if (n <= 4) return ring.slice();
  const project = projector(ring[0][1], ring[0][0]);
  const pts = ring.map(project);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop();
    if (hi <= lo + 1) continue;
    const [ax, ay] = pts[lo];
    const [bx, by] = pts[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxDist = -1;
    let maxIndex = -1;
    for (let i = lo + 1; i < hi; i += 1) {
      const [px, py] = pts[i];
      let dist;
      if (len2 === 0) dist = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    if (maxDist > toleranceM) {
      keep[maxIndex] = 1;
      stack.push([lo, maxIndex], [maxIndex, hi]);
    }
  }
  return ring.filter((_, index) => keep[index] === 1);
}

const countPoints = (polygons) => polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0), 0);

export function simplifyPolygons(polygons, { toleranceM = DEFAULTS.toleranceM, maxPoints = DEFAULTS.maxPoints } = {}) {
  let tolerance = toleranceM;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const next = [];
    for (const polygon of polygons) {
      const outer = douglasPeucker(polygon[0], tolerance);
      if (outer.length < 4) continue;
      const holes = polygon.slice(1).map((ring) => douglasPeucker(ring, tolerance)).filter((ring) => ring.length >= 4);
      next.push([outer, ...holes]);
    }
    if (next.length > 0 && countPoints(next) <= maxPoints) return { polygons: next, toleranceM: tolerance };
    if (next.length > 0 && attempt >= 8) {
      const trimmed = next
        .map((polygon) => [polygon[0]])
        .sort((a, b) => ringAreaM2(b[0]) - ringAreaM2(a[0]));
      const budget = [];
      let used = 0;
      for (const polygon of trimmed) {
        if (used + polygon[0].length > maxPoints) continue;
        budget.push(polygon);
        used += polygon[0].length;
      }
      if (budget.length > 0) return { polygons: budget, toleranceM: tolerance };
    }
    tolerance *= 1.6;
  }
  const bbox = polygonsBbox(polygons);
  const ring = [[bbox.west, bbox.south], [bbox.east, bbox.south], [bbox.east, bbox.north], [bbox.west, bbox.north], [bbox.west, bbox.south]];
  return { polygons: [[ring]], toleranceM: tolerance };
}

export function geometryGeojson(polygons) {
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

const bboxCenter = (bbox) => ({ lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 });

function elementCenter(el) {
  if (el.type === "node") return { lat: el.lat, lng: el.lon };
  if (el.bounds) return { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lng: (el.bounds.minlon + el.bounds.maxlon) / 2 };
  const pts = (el.geometry ?? (el.members ?? []).flatMap((member) => member.geometry ?? [])).filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)
  );
  if (pts.length === 0) return null;
  const lats = pts.map((point) => point.lat);
  const lons = pts.map((point) => point.lon);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lons) + Math.max(...lons)) / 2 };
}

export function evaluateElement(el, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const tags = el.tags ?? {};
  const reject = (reason) => ({ ok: false, reason });
  if (!["node", "way", "relation"].includes(el.type) || !Number.isFinite(el.id)) return reject("bad_element");
  const names = pickNames(tags);
  if (!names.name || [...names.name].length > 80) return reject("no_name");
  const cls = classifyFeature(tags);
  if (!cls) return reject("not_target");
  if (RESTRICTED_ACCESS.includes(clean(tags.access))) return reject("restricted_access");
  if (SCHOOL_AMENITY.includes(clean(tags.amenity))) return reject("school");
  if (clean(tags.leisure) === "garden" && ["residential", "private"].includes(clean(tags["garden:type"]))) return reject("private_garden");
  if (el.type === "node" && cls.category !== "heritage") return reject("point_not_heritage");
  const hasHeritageTag = Boolean(clean(tags.heritage)) && clean(tags.heritage) !== "no";
  if (clean(tags.historic) === "tomb" && !hasHeritageTag) return reject("tomb_no_heritage");
  if (el.type === "node" && !hasHeritageTag && !["castle", "archaeological_site", "ruins"].includes(clean(tags.historic))) return reject("point_clutter");
  let polygons = el.type === "node" ? [] : elementPolygons(el);
  let isCircle = false;
  let areaHa = null;
  if (polygons.length === 0) {
    if (cls.category !== "heritage") return reject("no_polygon");
    const center = elementCenter(el);
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return reject("no_geometry");
    polygons = [[circleRing(center.lat, center.lng, opts.pointRadiusM, opts.circlePoints)]];
    isCircle = true;
  }
  if (!isCircle) {
    areaHa = polygonsAreaHa(polygons);
    if (cls.category === "park" && !cls.heritage && areaHa < opts.parkMinHa) return reject("too_small");
    if (!(areaHa > 0)) return reject("zero_area");
  }
  const simplified = isCircle ? { polygons, toleranceM: 0 } : simplifyPolygons(polygons, { toleranceM: opts.toleranceM, maxPoints: opts.maxPoints });
  const bbox = polygonsBbox(simplified.polygons);
  const center = bboxCenter(bbox);
  const outputArea = isCircle ? polygonsAreaHa(simplified.polygons) : areaHa;
  const sourceType = el.type === "node" ? "osm_node" : "osm";
  const keep = {};
  for (const key of ["leisure", "boundary", "protect_class", "heritage", "historic", "amenity", "tourism"]) {
    const value = clean(tags[key]);
    if (value) keep[key] = value.slice(0, 60);
  }
  const description = clean(tags["description:ja"] ?? tags.description).slice(0, 360);
  return {
    ok: true,
    candidate: {
      osmType: el.type,
      osmId: el.id,
      sourceType,
      sourceId: `${el.type}:${el.id}`,
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      name: names.name,
      aliases: names.aliases,
      description: description || null,
      category: cls.category,
      heritage: cls.heritage,
      placeKind: cls.placeKind,
      isCircle,
      polygons: simplified.polygons,
      toleranceM: simplified.toleranceM,
      points: countPoints(simplified.polygons),
      bbox,
      lat: round6(center.lat),
      lng: round6(center.lng),
      areaHa: outputArea,
      tags: keep,
    },
  };
}

export function placeIdFor(osmType, osmId) {
  return `plc_${createHash("sha256").update(`osm:${osmType}:${osmId}`).digest("hex").slice(0, 16)}`;
}

export function dedupeCandidates(candidates, existing = { sourceIds: [], places: [] }, dedupeMeters = DEFAULTS.dedupeMeters) {
  const dropped = { duplicate_osm_id: 0, duplicate_name_near: 0, already_in_production: 0 };
  const existingIds = new Set((existing.sourceIds ?? []).map((id) => String(id).replace(/^osm:/u, "")));
  const named = new Map();
  const addNamed = (key, entry) => {
    if (!named.has(key)) named.set(key, []);
    named.get(key).push(entry);
  };
  for (const place of existing.places ?? []) {
    addNamed(normalizePlaceSearchText(place.name), { lat: place.lat, lng: place.lng, existing: true });
  }
  const byId = new Map();
  for (const candidate of candidates) {
    if (byId.has(candidate.sourceId)) dropped.duplicate_osm_id += 1;
    else byId.set(candidate.sourceId, candidate);
  }
  const ordered = [...byId.values()].sort(
    (a, b) => (b.areaHa ?? 0) - (a.areaHa ?? 0) || Number(a.isCircle) - Number(b.isCircle) || a.osmId - b.osmId || a.osmType.localeCompare(b.osmType)
  );
  const kept = [];
  for (const candidate of ordered) {
    if (existingIds.has(candidate.sourceId)) {
      dropped.already_in_production += 1;
      continue;
    }
    const key = normalizePlaceSearchText(candidate.name);
    const near = (named.get(key) ?? []).find((entry) => haversineMeters(entry.lat, entry.lng, candidate.lat, candidate.lng) <= dedupeMeters);
    if (near) {
      dropped[near.existing ? "already_in_production" : "duplicate_name_near"] += 1;
      continue;
    }
    addNamed(key, { lat: candidate.lat, lng: candidate.lng, existing: false });
    kept.push(candidate);
  }
  return { kept, dropped };
}

export function buildPlaces(elements, { existing, ...options } = {}) {
  const rejected = {};
  const candidates = [];
  for (const el of elements) {
    const result = evaluateElement(el, options);
    if (result.ok) candidates.push(result.candidate);
    else rejected[result.reason] = (rejected[result.reason] ?? 0) + 1;
  }
  const deduped = dedupeCandidates(candidates, existing, options?.dedupeMeters);
  const places = deduped.kept
    .map((candidate) => ({ ...candidate, placeId: placeIdFor(candidate.osmType, candidate.osmId) }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.osmType.localeCompare(b.osmType) || a.osmId - b.osmId);
  return { places, rejected, dropped: deduped.dropped, evaluated: elements.length, candidates: candidates.length };
}

export function sqlText(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/\u0000/gu, "").replace(/'/gu, "''")}'`;
}

export function sqlNumber(value) {
  if (!Number.isFinite(value)) throw new Error(`non_finite_number:${value}`);
  return String(value);
}

export function renderPlaceSql(place, ctx) {
  const { batch, locality, retrievedAt } = ctx;
  const pid = sqlText(place.placeId);
  const sourceReferenceId = `src_${place.placeId}_osm`;
  const geometry = geometryGeojson(place.polygons);
  const metadata = {
    importBatch: batch,
    via: "osm_import",
    category: place.category,
    osmType: place.osmType,
    osmId: place.osmId,
    tags: place.tags,
    ...(place.isCircle ? { circleRadiusM: DEFAULTS.pointRadiusM } : {}),
  };
  const validation = place.isCircle
    ? { importBatch: batch, circle: { lat: place.lat, lng: place.lng, radiusM: DEFAULTS.pointRadiusM, points: DEFAULTS.circlePoints } }
    : { importBatch: batch, toleranceM: place.toleranceM, points: place.points };
  const guard = `WHERE EXISTS (SELECT 1 FROM places WHERE place_id = ${pid})`;
  const out = [];
  out.push(
    `INSERT OR IGNORE INTO places (place_id, canonical_name, canonical_name_normalized, locality_label, place_kind, verification_status, public_profile_status, official_status, public_summary, metadata_json, valid_from) SELECT ${pid}, ${sqlText(place.name)}, ${sqlText(normalizePlaceSearchText(place.name))}, ${sqlText(locality)}, ${sqlText(place.placeKind)}, 'osm_imported', 'published', 'unofficial', ${sqlText(place.description)}, ${sqlText(JSON.stringify(metadata))}, ${sqlText(retrievedAt)} WHERE NOT EXISTS (SELECT 1 FROM place_source_references WHERE source_type = ${sqlText(place.sourceType)} AND source_id = ${sqlText(place.sourceId)});`
  );
  out.push(
    `INSERT OR IGNORE INTO place_source_references (source_reference_id, place_id, source_type, source_id, source_url, source_payload_json, source_confidence, verification_status, precedence_rank, observed_at, last_checked_at, valid_from) SELECT ${sqlText(sourceReferenceId)}, ${pid}, ${sqlText(place.sourceType)}, ${sqlText(place.sourceId)}, ${sqlText(place.sourceUrl)}, ${sqlText(JSON.stringify({ attribution: "© OpenStreetMap contributors", license: "ODbL-1.0", retrievedAt: retrievedAt.slice(0, 10), importBatch: batch }))}, ${place.isCircle ? 0.6 : 0.75}, 'source_verified', 40, ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)} ${guard};`
  );
  out.push(
    `INSERT OR IGNORE INTO place_boundaries (boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson, source_reference_id, source_type, confidence, precision_kind, valid_from, boundary_version, validation_state, validation_details_json, is_primary, bbox_west, bbox_south, bbox_east, bbox_north, area_ha) SELECT ${sqlText(`bnd_${place.placeId}_v1`)}, ${pid}, 'primary', ${sqlText(geometry.type)}, ${sqlText(JSON.stringify(geometry))}, ${sqlText(sourceReferenceId)}, ${sqlText(place.sourceType)}, ${place.isCircle ? 0.5 : 0.75}, ${sqlText(place.isCircle ? "approximate" : "exact")}, ${sqlText(retrievedAt)}, 1, 'valid', ${sqlText(JSON.stringify(validation))}, 1, ${sqlNumber(place.bbox.west)}, ${sqlNumber(place.bbox.south)}, ${sqlNumber(place.bbox.east)}, ${sqlNumber(place.bbox.north)}, ${sqlNumber(Math.round(place.areaHa * 10_000) / 10_000)} ${guard};`
  );
  out.push(
    `INSERT OR IGNORE INTO place_policies (place_policy_id, place_id, place_visibility, recording_policy, photography_rule_status, public_location_mode, contribution_cta_mode, verification_status, last_checked_at, valid_from) SELECT ${sqlText(`pol_${place.placeId}_v1`)}, ${pid}, 'public', 'check_rules', 'unknown', 'place', 'check_rules', 'unverified', ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)} ${guard};`
  );
  for (const alias of place.aliases) {
    out.push(
      `INSERT OR IGNORE INTO place_aliases (alias_id, place_id, alias, alias_normalized, language_code, alias_kind, source_type, source_reference_id, confidence, valid_from) SELECT ${sqlText(`${place.placeId}_alias_${alias.normalized}`)}, ${pid}, ${sqlText(alias.alias)}, ${sqlText(alias.normalized)}, ${sqlText(alias.language)}, ${sqlText(alias.kind)}, ${sqlText(place.sourceType)}, ${sqlText(sourceReferenceId)}, 0.7, ${sqlText(retrievedAt)} ${guard};`
    );
  }
  return out;
}

export function renderImportSql(places, ctx) {
  const lines = [`-- importBatch=${ctx.batch} places=${places.length} retrievedAt=${ctx.retrievedAt}`];
  for (const place of places) lines.push(...renderPlaceSql(place, ctx));
  return `${lines.join("\n")}\n`;
}

export function renderRollbackSql(batch) {
  return `UPDATE places SET public_profile_status = 'private', updated_at = CURRENT_TIMESTAMP WHERE json_extract(metadata_json, '$.importBatch') = ${sqlText(batch)} AND public_profile_status = 'published';\n`;
}

export function buildSummary(result, ctx, sqlBytes) {
  const byCategory = {};
  for (const place of result.places) {
    const entry = (byCategory[place.category] ??= { count: 0, nodes: 0, circles: 0, polygons: 0, samples: [] });
    entry.count += 1;
    if (place.osmType === "node") entry.nodes += 1;
    if (place.isCircle) entry.circles += 1;
    else entry.polygons += 1;
    if (entry.samples.length < 20) entry.samples.push(place.name);
  }
  return {
    batch: ctx.batch,
    retrievedAt: ctx.retrievedAt,
    elementsFromOverpass: result.evaluated,
    candidates: result.candidates,
    imported: result.places.length,
    byCategory,
    rejected: result.rejected,
    dropped: result.dropped,
    sqlBytes,
  };
}

export function parseArgs(argv) {
  const args = { dryRun: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      return argv[i];
    };
    if (arg === "--area") args.area = next();
    else if (arg === "--relation") args.relation = next();
    else if (arg === "--bbox") args.bbox = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--existing") args.existing = next();
    else if (arg === "--batch") args.batch = next();
    else if (arg === "--locality") args.locality = next();
    else if (arg === "--dry-run") args.dryRun = true;
    else throw new Error(`unknown_argument:${arg}`);
  }
  return args;
}

export function resolveScope(args) {
  if (args.bbox) {
    const parts = args.bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) throw new Error("invalid_bbox");
    return { kind: "bbox", bbox: parts, slug: "bbox", locality: null };
  }
  if (args.relation) {
    if (!/^\d+$/u.test(args.relation)) throw new Error("invalid_relation");
    return { kind: "relation", relationId: args.relation, slug: `rel${args.relation}`, locality: null };
  }
  const area = AREAS[args.area ?? ""];
  if (!area) throw new Error("area_required");
  return { kind: "area", ...area };
}

async function fetchOverpass(query) {
  const waits = [30_000, 60_000, 120_000, 240_000, 480_000];
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(240_000),
    });
    if ([429, 502, 503, 504].includes(response.status) && attempt < waits.length) {
      await new Promise((done) => setTimeout(done, waits[attempt]));
      continue;
    }
    if (!response.ok) throw new Error(`overpass_${response.status}`);
    const text = await response.text();
    const parsed = JSON.parse(text);
    if (parsed.remark || !Array.isArray(parsed.elements)) throw new Error(`overpass_remark:${String(parsed.remark ?? "no_elements").slice(0, 200)}`);
    return text;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.out) throw new Error("out_required");
  const scope = resolveScope(args);
  const out = resolve(args.out);
  mkdirSync(out, { recursive: true });
  const query = buildOverpassQuery(scope);
  const rawPath = join(out, "overpass-raw.json");
  writeFileSync(join(out, "overpass-query.txt"), `${query}\n`);
  if (!existsSync(rawPath)) writeFileSync(rawPath, await fetchOverpass(query));
  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  const base = raw?.osm3s?.timestamp_osm_base ?? new Date().toISOString();
  const retrievedAt = `${String(base).slice(0, 19)}Z`;
  const batch = args.batch ?? `osm-${scope.slug}-${retrievedAt.slice(0, 10).replace(/-/gu, "")}`;
  const locality = args.locality ?? scope.locality ?? null;
  const existing = args.existing ? JSON.parse(readFileSync(resolve(args.existing), "utf8")) : { sourceIds: [], places: [] };
  const result = buildPlaces(raw.elements ?? [], { existing });
  const ctx = { batch, locality, retrievedAt };
  const sql = renderImportSql(result.places, ctx);
  writeFileSync(join(out, "import.sql"), sql);
  writeFileSync(join(out, "rollback.sql"), renderRollbackSql(batch));
  writeFileSync(
    join(out, "places.jsonl"),
    result.places
      .map((place) =>
        JSON.stringify({
          placeId: place.placeId,
          sourceId: place.sourceId,
          name: place.name,
          category: place.category,
          placeKind: place.placeKind,
          lat: place.lat,
          lng: place.lng,
          areaHa: Math.round(place.areaHa * 100) / 100,
          circle: place.isCircle,
          points: place.points,
        })
      )
      .join("\n") + "\n"
  );
  const summary = buildSummary(result, ctx, Buffer.byteLength(sql));
  writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (summary) => {
      console.log(JSON.stringify({ batch: summary.batch, imported: summary.imported, byCategory: Object.fromEntries(Object.entries(summary.byCategory).map(([key, value]) => [key, value.count])), rejected: summary.rejected, dropped: summary.dropped, sqlBytes: summary.sqlBytes }));
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  );
}
