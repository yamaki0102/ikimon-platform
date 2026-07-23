export const PLACE_KINDS = [
  "park",
  "school",
  "nature_area",
  "theme_park",
  "shopping_mall",
  "commercial_complex",
  "museum",
  "zoo",
  "aquarium",
  "stadium",
  "sports_facility",
  "resort",
  "market",
  "farm",
  "temple_shrine",
  "cultural_facility",
  "public_facility",
  "event_venue",
  "neighborhood",
  "administrative_area",
  "other_named_area",
] as const;

export type PlaceKind = typeof PLACE_KINDS[number];

export const RECORDING_POLICIES = [
  "allowed",
  "check_rules",
  "customers_only",
  "permission_required",
  "prohibited",
  "unknown",
] as const;

export type RecordingPolicy = typeof RECORDING_POLICIES[number];

export type PlaceDiscoveryContext =
  | "viewport"
  | "search"
  | "record_nearby"
  | "selected";

export type OsmNamedAreaTags = Record<string, string | undefined>;

export type PlaceNameSet = {
  canonicalName: string | null;
  aliases: string[];
  multilingualNames: Record<string, string>;
  canonicalNameSource: string | null;
};

export type PlacePolicyProjection = {
  placeVisibility: "public" | "limited" | "hidden";
  recordingPolicy: RecordingPolicy;
  publicLocationMode: "place" | "zone" | "public_cell" | "hidden";
  contributionCtaMode: "record" | "check_rules" | "suppressed";
  ruleSource: "official" | "administrator" | "osm_access" | "default";
  ruleUrl: string | null;
  reason: string;
};

export type PlaceGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

export type PlaceBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type PlaceCandidate = {
  candidateId: string;
  canonicalName: string;
  aliases: string[];
  placeKind: PlaceKind;
  geometry: PlaceGeometry | null;
  bbox: PlaceBbox | null;
  areaHa: number | null;
  sourceType: string;
  sourceId: string;
  sourceConfidence: number;
  verificationStatus: string;
  localityLabel?: string | null;
  tags?: OsmNamedAreaTags;
};

export type CanonicalPlaceCandidate = PlaceCandidate & {
  sourceReferences: Array<{
    sourceType: string;
    sourceId: string;
    confidence: number;
    verificationStatus: string;
  }>;
  mergedCandidateIds: string[];
};

export type MembershipBoundary = {
  placeId: string;
  geometry: PlaceGeometry;
  confidence: number;
  precision: "exact" | "approximate";
  hierarchyDepth?: number;
  areaHa?: number | null;
};

export type MembershipDecision = {
  placeId: string;
  state: "confirmed" | "candidate" | "outside";
  membershipType: "inside" | "near_boundary";
  confidence: number;
  primary: boolean;
  reason: string;
};

const COMMERCIAL_CONTEXT_KINDS = new Set<PlaceKind>([
  "theme_park",
  "shopping_mall",
  "commercial_complex",
  "museum",
  "zoo",
  "aquarium",
  "stadium",
  "sports_facility",
  "resort",
  "market",
  "cultural_facility",
  "event_venue",
]);

const DEFAULT_MIN_AREA_HA: Partial<Record<PlaceKind, number>> = {
  park: 0.03,
  school: 0.05,
  nature_area: 0.1,
  theme_park: 0.2,
  shopping_mall: 0.35,
  commercial_complex: 0.75,
  museum: 0.05,
  zoo: 0.2,
  aquarium: 0.03,
  stadium: 0.1,
  sports_facility: 0.1,
  resort: 0.2,
  market: 0.05,
  farm: 0.1,
  temple_shrine: 0.03,
  cultural_facility: 0.03,
  public_facility: 0.03,
  event_venue: 0.05,
  neighborhood: 1,
  administrative_area: 2,
  other_named_area: 0.1,
};

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function normalizePlaceSearchText(value: unknown): string {
  const text = nonEmpty(value);
  if (!text) return "";
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\u3000・･·.,，。'’"“”「」『』()（）\[\]【】_\-/\\]+/g, "");
}

function isGenericBrandName(value: string, tags: OsmNamedAreaTags): boolean {
  const normalized = normalizePlaceSearchText(value);
  if (!normalized) return false;
  return [
    tags.brand,
    tags["brand:ja"],
    tags["brand:en"],
    tags.short_name,
  ].some((candidate) => normalizePlaceSearchText(candidate) === normalized);
}

function pushUniqueName(target: string[], value: unknown): void {
  const text = nonEmpty(value);
  if (!text) return;
  const key = normalizePlaceSearchText(text);
  if (!key || target.some((existing) => normalizePlaceSearchText(existing) === key)) return;
  target.push(text);
}

export function collectOsmPlaceNames(tags: OsmNamedAreaTags): PlaceNameSet {
  const multilingualNames: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (!key.startsWith("name:") && !key.startsWith("official_name:")) continue;
    const text = nonEmpty(value);
    if (!text) continue;
    const language = key.split(":").slice(1).join(":");
    if (language && !multilingualNames[language]) multilingualNames[language] = text;
  }

  const candidates: Array<{ source: string; value: string | null }> = [
    { source: "official_name:ja", value: nonEmpty(tags["official_name:ja"]) },
    { source: "name:ja", value: nonEmpty(tags["name:ja"]) },
    { source: "name", value: nonEmpty(tags.name) },
    { source: "official_name", value: nonEmpty(tags.official_name) },
    { source: "brand", value: nonEmpty(tags.brand) },
    { source: "short_name", value: nonEmpty(tags.short_name) },
  ];

  let selected = candidates.find((candidate) => candidate.value)?.value ?? null;
  let source = candidates.find((candidate) => candidate.value)?.source ?? null;

  const generalName = nonEmpty(tags.name);
  if (
    selected &&
    generalName &&
    isGenericBrandName(selected, tags) &&
    normalizePlaceSearchText(generalName).includes(normalizePlaceSearchText(selected)) &&
    normalizePlaceSearchText(generalName).length > normalizePlaceSearchText(selected).length
  ) {
    selected = generalName;
    source = "name";
  }

  const aliases: string[] = [];
  for (const candidate of candidates) pushUniqueName(aliases, candidate.value);
  for (const [key, value] of Object.entries(tags)) {
    if (
      key === "alt_name" ||
      key === "old_name" ||
      key === "loc_name" ||
      key.startsWith("alt_name:") ||
      key.startsWith("old_name:") ||
      key.startsWith("official_name:") ||
      key.startsWith("name:")
    ) {
      String(value ?? "").split(";").forEach((part) => pushUniqueName(aliases, part));
    }
  }

  const canonicalKey = normalizePlaceSearchText(selected);
  return {
    canonicalName: selected,
    aliases: aliases.filter((alias) => normalizePlaceSearchText(alias) !== canonicalKey),
    multilingualNames,
    canonicalNameSource: source,
  };
}

export function classifyOsmPlaceKind(tags: OsmNamedAreaTags): PlaceKind | null {
  const tourism = nonEmpty(tags.tourism)?.toLowerCase();
  const shop = nonEmpty(tags.shop)?.toLowerCase();
  const landuse = nonEmpty(tags.landuse)?.toLowerCase();
  const leisure = nonEmpty(tags.leisure)?.toLowerCase();
  const amenity = nonEmpty(tags.amenity)?.toLowerCase();
  const place = nonEmpty(tags.place)?.toLowerCase();
  const building = nonEmpty(tags.building)?.toLowerCase();
  const hasSpecificName = Boolean(collectOsmPlaceNames(tags).canonicalName);

  if (tourism === "theme_park" || leisure === "water_park") return "theme_park";
  if (shop === "mall" || shop === "shopping_centre" || shop === "shopping_center") return "shopping_mall";
  if (landuse === "retail" || landuse === "commercial") return "commercial_complex";
  if (tourism === "museum") return "museum";
  if (tourism === "zoo") return "zoo";
  if (tourism === "aquarium") return "aquarium";
  if (leisure === "stadium") return "stadium";
  if (leisure === "sports_centre" || leisure === "sports_center" || leisure === "sports_hall") return "sports_facility";
  if (tourism === "resort") return "resort";
  if (amenity === "marketplace") return "market";
  if (
    landuse === "farmland" ||
    landuse === "farmyard" ||
    landuse === "orchard" ||
    landuse === "vineyard" ||
    tourism === "farm" ||
    tags.crop ||
    tags.produce
  ) return "farm";
  if (amenity === "place_of_worship") return "temple_shrine";
  if (amenity === "arts_centre" || amenity === "arts_center" || amenity === "theatre" || tourism === "gallery") {
    return "cultural_facility";
  }
  if (amenity === "community_centre" || amenity === "community_center" || amenity === "townhall" || amenity === "library") {
    return "public_facility";
  }
  if (amenity === "events_venue" || amenity === "conference_centre" || amenity === "conference_center") return "event_venue";
  if (
    amenity === "school" ||
    amenity === "kindergarten" ||
    amenity === "college" ||
    amenity === "university" ||
    amenity === "childcare" ||
    landuse === "education" ||
    landuse === "school" ||
    landuse === "college" ||
    landuse === "university" ||
    landuse === "kindergarten" ||
    (
      hasSpecificName &&
      (building === "school" || building === "kindergarten" || building === "college" || building === "university")
    )
  ) {
    return "school";
  }
  if (leisure === "park" || leisure === "garden" || leisure === "playground" || leisure === "recreation_ground") return "park";
  if (
    leisure === "nature_reserve" ||
    landuse === "forest" ||
    landuse === "meadow" ||
    tags.natural === "wood" ||
    tags.boundary === "protected_area"
  ) return "nature_area";
  if (place === "neighbourhood" || place === "neighborhood" || place === "quarter" || place === "suburb") return "neighborhood";
  if (tags.boundary === "administrative") return "administrative_area";
  if (tourism === "attraction") return "other_named_area";
  return null;
}

export function isDiscoverableNamedArea(input: {
  osmType: string;
  tags: OsmNamedAreaTags;
  geometry: PlaceGeometry | null;
  areaHa: number | null;
  zoom: number;
  context: PlaceDiscoveryContext;
}): boolean {
  if (input.osmType !== "way" && input.osmType !== "relation") return false;
  if (!input.geometry || (input.geometry.type !== "Polygon" && input.geometry.type !== "MultiPolygon")) return false;
  const names = collectOsmPlaceNames(input.tags);
  if (!names.canonicalName) return false;
  const placeKind = classifyOsmPlaceKind(input.tags);
  if (!placeKind) return false;

  if (
    input.context === "viewport" &&
    COMMERCIAL_CONTEXT_KINDS.has(placeKind) &&
    input.zoom < 12.5
  ) return false;

  if (input.context === "viewport" && input.zoom < 8) return false;
  const minimum = DEFAULT_MIN_AREA_HA[placeKind] ?? 0.1;
  return input.areaHa === null || input.areaHa >= minimum;
}

export function defaultPlacePolicy(input: {
  placeKind: PlaceKind;
  osmAccess?: string | null;
  officialRecordingPolicy?: RecordingPolicy | null;
  officialRuleUrl?: string | null;
  administratorVerified?: boolean;
}): PlacePolicyProjection {
  const officialPolicy = input.officialRecordingPolicy ?? null;
  if (officialPolicy) {
    const suppressed = officialPolicy === "prohibited" || officialPolicy === "permission_required";
    return {
      placeVisibility: "public",
      recordingPolicy: officialPolicy,
      publicLocationMode: "place",
      contributionCtaMode: suppressed
        ? "suppressed"
        : officialPolicy === "allowed"
          ? "record"
          : "check_rules",
      ruleSource: input.administratorVerified ? "administrator" : "official",
      ruleUrl: nonEmpty(input.officialRuleUrl),
      reason: "verified_recording_policy",
    };
  }

  const access = nonEmpty(input.osmAccess)?.toLowerCase() ?? "";
  if (input.placeKind === "school") {
    return {
      placeVisibility: "public",
      recordingPolicy: "permission_required",
      publicLocationMode: "place",
      contributionCtaMode: "suppressed",
      ruleSource: "default",
      ruleUrl: null,
      reason: "school_fail_closed",
    };
  }
  if (access === "private" || access === "no" || access === "restricted") {
    return {
      placeVisibility: "limited",
      recordingPolicy: "permission_required",
      publicLocationMode: "place",
      contributionCtaMode: "suppressed",
      ruleSource: "osm_access",
      ruleUrl: null,
      reason: "restricted_entry_does_not_imply_recording_permission",
    };
  }
  if (COMMERCIAL_CONTEXT_KINDS.has(input.placeKind)) {
    return {
      placeVisibility: "public",
      recordingPolicy: "check_rules",
      publicLocationMode: "place",
      contributionCtaMode: "check_rules",
      ruleSource: "default",
      ruleUrl: null,
      reason: "commercial_or_managed_facility_rules_unverified",
    };
  }
  return {
    placeVisibility: "public",
    recordingPolicy: "check_rules",
    publicLocationMode: "place",
    contributionCtaMode: "check_rules",
    ruleSource: access ? "osm_access" : "default",
    ruleUrl: null,
    reason: access
      ? "osm_access_supports_browsing_only"
      : "recording_rules_unverified",
  };
}

function fnv1a32(value: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function initialCanonicalPlaceId(input: {
  canonicalName: string;
  localityLabel?: string | null;
  placeKind: PlaceKind;
}): string {
  const identity = [
    normalizePlaceSearchText(input.canonicalName),
    normalizePlaceSearchText(input.localityLabel),
    input.placeKind,
  ].join("|");
  const left = fnv1a32(identity).toString(16).padStart(8, "0");
  const right = fnv1a32(identity, 0x9e3779b9).toString(16).padStart(8, "0");
  return `plc_${left}${right}`;
}

function toFiniteCoordinatePair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function geometryRings(geometry: PlaceGeometry): Array<Array<Array<[number, number]>>> {
  const parsePolygon = (value: unknown): Array<Array<[number, number]>> => {
    if (!Array.isArray(value)) return [];
    return value
      .map((ring) => Array.isArray(ring)
        ? ring.map(toFiniteCoordinatePair).filter((pair): pair is [number, number] => Boolean(pair))
        : [])
      .filter((ring) => ring.length >= 4);
  };
  if (geometry.type === "Polygon") {
    const polygon = parsePolygon(geometry.coordinates);
    return polygon.length ? [polygon] : [];
  }
  if (!Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates
    .map(parsePolygon)
    .filter((polygon) => polygon.length > 0);
}

export function bboxForPlaceGeometry(geometry: PlaceGeometry | null): PlaceBbox | null {
  if (!geometry) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const polygon of geometryRings(geometry)) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        west = Math.min(west, lng);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        north = Math.max(north, lat);
      }
    }
  }
  return [west, south, east, north].every(Number.isFinite)
    ? { west, south, east, north }
    : null;
}

export function bboxAreaHa(bbox: PlaceBbox | null): number | null {
  if (!bbox) return null;
  const centerLat = (bbox.south + bbox.north) / 2;
  const widthM = Math.max(0, bbox.east - bbox.west) * 111_320 * Math.cos(centerLat * Math.PI / 180);
  const heightM = Math.max(0, bbox.north - bbox.south) * 110_540;
  return Number.isFinite(widthM * heightM) ? (widthM * heightM) / 10_000 : null;
}

export function bboxOverlapScore(left: PlaceBbox | null, right: PlaceBbox | null): number {
  if (!left || !right) return 0;
  const west = Math.max(left.west, right.west);
  const south = Math.max(left.south, right.south);
  const east = Math.min(left.east, right.east);
  const north = Math.min(left.north, right.north);
  if (west >= east || south >= north) return 0;
  const intersection = (east - west) * (north - south);
  const leftArea = Math.max(0, left.east - left.west) * Math.max(0, left.north - left.south);
  const rightArea = Math.max(0, right.east - right.west) * Math.max(0, right.north - right.south);
  const smaller = Math.min(leftArea, rightArea);
  return smaller > 0 ? Math.min(1, intersection / smaller) : 0;
}

function candidateNameKeys(candidate: PlaceCandidate): Set<string> {
  return new Set(
    [candidate.canonicalName, ...candidate.aliases]
      .map(normalizePlaceSearchText)
      .filter(Boolean),
  );
}

function candidatesShareIdentity(left: PlaceCandidate, right: PlaceCandidate): boolean {
  const leftNames = candidateNameKeys(left);
  const rightNames = candidateNameKeys(right);
  const sharedName = [...leftNames].some((value) => rightNames.has(value));
  const mallPair =
    (left.placeKind === "shopping_mall" && right.placeKind === "commercial_complex") ||
    (left.placeKind === "commercial_complex" && right.placeKind === "shopping_mall");
  if (!sharedName && !mallPair) return false;
  const overlap = bboxOverlapScore(left.bbox, right.bbox);
  if (overlap < 0.55) return false;
  if (sharedName) return true;
  const leftBrand = normalizePlaceSearchText(left.tags?.brand);
  const rightBrand = normalizePlaceSearchText(right.tags?.brand);
  const leftName = normalizePlaceSearchText(left.canonicalName);
  const rightName = normalizePlaceSearchText(right.canonicalName);
  return Boolean(
    (leftBrand && (rightName.includes(leftBrand) || rightBrand === leftBrand)) ||
    (rightBrand && (leftName.includes(rightBrand) || leftBrand === rightBrand)),
  );
}

function candidatePreference(candidate: PlaceCandidate): number {
  const kindScore = candidate.placeKind === "shopping_mall" ? 20 : 0;
  const sourceScore = candidate.sourceType === "ikimon_admin"
    ? 50
    : candidate.sourceType === "official"
      ? 40
      : candidate.sourceType === "observation_field"
        ? 30
        : candidate.sourceType.startsWith("osm")
          ? 10
          : 0;
  return sourceScore + kindScore + Math.round(candidate.sourceConfidence * 10);
}

export function dedupePlaceCandidates(candidates: PlaceCandidate[]): CanonicalPlaceCandidate[] {
  const remaining = [...candidates];
  const output: CanonicalPlaceCandidate[] = [];
  while (remaining.length) {
    const seed = remaining.shift();
    if (!seed) break;
    const group = [seed];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (!candidate || !group.some((member) => candidatesShareIdentity(member, candidate))) continue;
      group.push(candidate);
      remaining.splice(index, 1);
    }
    const preferred = [...group].sort((left, right) => candidatePreference(right) - candidatePreference(left))[0] ?? seed;
    const aliases: string[] = [];
    group.forEach((candidate) => {
      pushUniqueName(aliases, candidate.canonicalName);
      candidate.aliases.forEach((alias) => pushUniqueName(aliases, alias));
    });
    const preferredNameKey = normalizePlaceSearchText(preferred.canonicalName);
    output.push({
      ...preferred,
      aliases: aliases.filter((alias) => normalizePlaceSearchText(alias) !== preferredNameKey),
      sourceReferences: group.map((candidate) => ({
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        confidence: candidate.sourceConfidence,
        verificationStatus: candidate.verificationStatus,
      })),
      mergedCandidateIds: group
        .filter((candidate) => candidate.candidateId !== preferred.candidateId)
        .map((candidate) => candidate.candidateId),
    });
  }
  return output;
}

function pointInRing(point: [number, number], ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) continue;
    const [currentX, currentY] = currentPoint;
    const [previousX, previousY] = previousPoint;
    const intersects = (currentY > point[1]) !== (previousY > point[1]) &&
      point[0] < ((previousX - currentX) * (point[1] - currentY)) / ((previousY - currentY) || Number.EPSILON) + currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPlaceGeometry(
  point: { lat: number; lng: number },
  geometry: PlaceGeometry,
): boolean {
  for (const polygon of geometryRings(geometry)) {
    const outer = polygon[0];
    if (!outer || !pointInRing([point.lng, point.lat], outer)) continue;
    const insideHole = polygon.slice(1).some((hole) => pointInRing([point.lng, point.lat], hole));
    if (!insideHole) return true;
  }
  return false;
}

function pointToSegmentMeters(
  point: { lat: number; lng: number },
  start: [number, number],
  end: [number, number],
): number {
  const latScale = 110_540;
  const lngScale = 111_320 * Math.cos(point.lat * Math.PI / 180);
  const px = point.lng * lngScale;
  const py = point.lat * latScale;
  const ax = start[0] * lngScale;
  const ay = start[1] * latScale;
  const bx = end[0] * lngScale;
  const by = end[1] * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator <= Number.EPSILON
    ? 0
    : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator));
  return Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy));
}

export function distanceToPlaceBoundaryMeters(
  point: { lat: number; lng: number },
  geometry: PlaceGeometry,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const polygon of geometryRings(geometry)) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        const start = ring[index - 1];
        const end = ring[index];
        if (!start || !end) continue;
        minimum = Math.min(minimum, pointToSegmentMeters(point, start, end));
      }
    }
  }
  return minimum;
}

export function decideRecordPlaceMembership(input: {
  point: { lat: number; lng: number };
  uncertaintyM: number | null;
  boundaries: MembershipBoundary[];
}): MembershipDecision[] {
  const uncertainty = Math.max(0, Number(input.uncertaintyM) || 0);
  const decisions = input.boundaries.map((boundary): MembershipDecision => {
    const inside = pointInPlaceGeometry(input.point, boundary.geometry);
    const edgeDistance = distanceToPlaceBoundaryMeters(input.point, boundary.geometry);
    const nearBoundary = Number.isFinite(edgeDistance) && edgeDistance <= Math.max(uncertainty, 5);
    if (!inside && !nearBoundary) {
      return {
        placeId: boundary.placeId,
        state: "outside",
        membershipType: "inside",
        confidence: 0,
        primary: false,
        reason: "outside_boundary_and_uncertainty",
      };
    }
    const candidate = boundary.precision === "approximate" || nearBoundary;
    return {
      placeId: boundary.placeId,
      state: candidate ? "candidate" : "confirmed",
      membershipType: nearBoundary ? "near_boundary" : "inside",
      confidence: Math.max(0, Math.min(1, boundary.confidence * (candidate ? 0.7 : 1))),
      primary: false,
      reason: boundary.precision === "approximate"
        ? "approximate_boundary"
        : nearBoundary
          ? "within_coordinate_uncertainty_of_boundary"
          : "inside_validated_boundary",
    };
  });

  const boundariesById = new Map(input.boundaries.map((boundary) => [boundary.placeId, boundary]));
  const initiallyConfirmed = decisions.filter((decision) => decision.state === "confirmed");
  const deepest = initiallyConfirmed.reduce((maximum, decision) =>
    Math.max(maximum, boundariesById.get(decision.placeId)?.hierarchyDepth ?? 0), 0);
  const deepestPeers = initiallyConfirmed.filter((decision) =>
    (boundariesById.get(decision.placeId)?.hierarchyDepth ?? 0) === deepest
  );
  if (deepestPeers.length > 1) {
    const areas = deepestPeers
      .map((decision) => boundariesById.get(decision.placeId)?.areaHa ?? null)
      .filter((area): area is number => typeof area === "number" && Number.isFinite(area) && area > 0);
    const comparable = areas.length !== deepestPeers.length
      || Math.max(...areas) / Math.min(...areas) <= 1.25;
    if (comparable) {
      for (const decision of deepestPeers) {
        decision.state = "candidate";
        decision.confidence = Math.min(decision.confidence, 0.65);
        decision.reason = "equivalent_overlapping_boundaries";
      }
    }
  }
  const confirmed = decisions.filter((decision) => decision.state === "confirmed");
  if (confirmed.length) {
    const winner = [...confirmed].sort((left, right) => {
      const leftBoundary = boundariesById.get(left.placeId);
      const rightBoundary = boundariesById.get(right.placeId);
      const depthDifference = (rightBoundary?.hierarchyDepth ?? 0) - (leftBoundary?.hierarchyDepth ?? 0);
      if (depthDifference) return depthDifference;
      const areaDifference = (leftBoundary?.areaHa ?? Number.POSITIVE_INFINITY) -
        (rightBoundary?.areaHa ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(areaDifference) && areaDifference !== 0) return areaDifference;
      return right.confidence - left.confidence;
    })[0];
    if (winner) winner.primary = true;
  }
  return decisions;
}

export function publicMembershipProjection(decision: MembershipDecision): {
  placeId: string;
  membershipState: "confirmed" | "candidate";
  publicPrecision: "place";
  primary: boolean;
} | null {
  if (decision.state === "outside") return null;
  return {
    placeId: decision.placeId,
    membershipState: decision.state,
    publicPrecision: "place",
    primary: decision.primary,
  };
}
