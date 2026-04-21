import { getPool } from "../db.js";

export type EffortRole = "note" | "guide" | "scan" | "mixed";
export type FrontierStage = "blank" | "building" | "repeatable" | "mature";
export type MapBbox = [number, number, number, number];
export type EffortActorClass = "all" | "local_steward" | "traveler" | "casual";
export type FrontierPriorityCue = "steady_revisit" | "fresh_gap" | "nearby_gap";

type ActivityKind = "note" | "guide" | "scan" | "audio";

export type EffortActivityPoint = {
  kind: ActivityKind;
  lat: number;
  lng: number;
  userId: string | null;
  timestamp: string;
  placeKey: string;
};

type ActivityPoint = EffortActivityPoint;

type VisitPointRow = {
  lat: number | null;
  lng: number | null;
  user_id: string | null;
  ts: string;
  place_id: string | null;
  visit_id: string;
};

type GuidePointRow = {
  lat: number | null;
  lng: number | null;
  user_id: string | null;
  ts: string;
  session_id: string;
  guide_record_id: string;
};

type AudioPointRow = {
  lat: number | null;
  lng: number | null;
  user_id: string | null;
  ts: string;
  place_id: string | null;
  session_id: string;
};

type CellStat = {
  key: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  noteCount: number;
  guideCount: number;
  scanCount: number;
  audioCount: number;
  userIds: Set<string>;
  placeKeys: Set<string>;
  uniqueDays: Set<string>;
  lastSeen: string | null;
};

export type FrontierFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    stage: FrontierStage;
    recommendedRole: EffortRole;
    priorityCue: FrontierPriorityCue;
    missingAxes: string[];
    communityGain: number;
    contributorCount: number;
    activityCount: number;
    roleCounts: { note: number; guide: number; scan: number };
    lastSeen: string | null;
  };
};

export type FrontierFeatureCollection = {
  type: "FeatureCollection";
  features: FrontierFeature[];
  meta: {
    gridStep: number;
    blankCount: number;
    buildingCount: number;
    repeatableCount: number;
    matureCount: number;
  };
};

export type EffortSummary = {
  communityPresenceMode: "aggregate_only";
  actorLens: {
    actorClass: EffortActorClass;
    matchingContributorCount: number;
    estimatedFrom: "behavioral_inference";
  };
  myProgress: null | {
    roleBreakdown: { note: number; guide: number; scan: number };
    revisitCount: number;
    winCount: number;
    focusRole: EffortRole;
  };
  communityProgress: {
    contributorBand: "0" | "1-2" | "3-5" | "6+";
    activeCellCount: number;
    strengthenedCellCount: number;
    progressRatio: number;
  };
  frontierRemaining: {
    blankCount: number;
    buildingCount: number;
    repeatableCount: number;
    matureCount: number;
    topMissingAxes: string[];
    recommendedRole: EffortRole;
    priorityCue: FrontierPriorityCue;
  };
  campaignProgress: {
    labelKey: "scan_blank" | "guide_building" | "note_repeatable" | "mixed_frontier";
    progressRatio: number;
    remainingCount: number;
    recommendedRole: EffortRole;
    priorityCue: FrontierPriorityCue;
  };
};

type EffortFilters = {
  bbox?: MapBbox;
  year?: number;
  role?: EffortRole;
  actorClass?: EffortActorClass;
};

function chooseGridStep(bbox: MapBbox): number {
  const width = Math.max(0.01, bbox[2] - bbox[0]);
  const height = Math.max(0.01, bbox[3] - bbox[1]);
  const area = width * height;
  return Math.max(0.01, Math.min(1.5, Math.sqrt(area / 220)));
}

function bboxWhere(latExpr: string, lngExpr: string, bbox: MapBbox | undefined, year: number | undefined, tsExpr: string): {
  clause: string;
  params: unknown[];
} {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    params.push(minLng, maxLng, minLat, maxLat);
    parts.push(`${lngExpr} between $${params.length - 3} and $${params.length - 2}`);
    parts.push(`${latExpr} between $${params.length - 1} and $${params.length}`);
  }
  if (year) {
    params.push(year);
    parts.push(`extract(year from ${tsExpr}) = $${params.length}`);
  }
  return { clause: parts.length ? ` and ${parts.join(" and ")}` : "", params };
}

function toIsoDay(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toActivityPoint(
  kind: ActivityKind,
  row: VisitPointRow | GuidePointRow | AudioPointRow,
): ActivityPoint | null {
  if (row.lat === null || row.lng === null) return null;
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null;
  const placeKey = "visit_id" in row
    ? row.place_id ?? row.visit_id
    : "guide_record_id" in row
      ? row.session_id || row.guide_record_id
      : row.place_id ?? row.session_id;
  return {
    kind,
    lat: row.lat,
    lng: row.lng,
    userId: row.user_id,
    timestamp: row.ts,
    placeKey,
  };
}

function emptyCell(key: string, minLng: number, minLat: number, step: number): CellStat {
  return {
    key,
    minLng,
    minLat,
    maxLng: minLng + step,
    maxLat: minLat + step,
    noteCount: 0,
    guideCount: 0,
    scanCount: 0,
    audioCount: 0,
    userIds: new Set<string>(),
    placeKeys: new Set<string>(),
    uniqueDays: new Set<string>(),
    lastSeen: null,
  };
}

function buildGrid(bbox: MapBbox, step: number): Map<string, CellStat> {
  const grid = new Map<string, CellStat>();
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const cols = Math.max(1, Math.ceil((maxLng - minLng) / step));
  const rows = Math.max(1, Math.ceil((maxLat - minLat) / step));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellMinLng = minLng + (col * step);
      const cellMinLat = minLat + (row * step);
      const key = `${row}:${col}`;
      grid.set(key, emptyCell(key, cellMinLng, cellMinLat, step));
    }
  }
  return grid;
}

function cellKeyForPoint(point: ActivityPoint, bbox: MapBbox, step: number): string | null {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  if (point.lng < minLng || point.lng > maxLng || point.lat < minLat || point.lat > maxLat) return null;
  const col = Math.min(Math.floor((point.lng - minLng) / step), Math.ceil((maxLng - minLng) / step) - 1);
  const row = Math.min(Math.floor((point.lat - minLat) / step), Math.ceil((maxLat - minLat) / step) - 1);
  if (row < 0 || col < 0) return null;
  return `${row}:${col}`;
}

function stageForCell(cell: CellStat): FrontierStage {
  const weighted =
    cell.noteCount +
    (cell.guideCount * 0.9) +
    (cell.scanCount * 1.2) +
    (cell.audioCount * 0.4);
  const roleCoverage =
    Number(cell.noteCount > 0) +
    Number(cell.guideCount > 0) +
    Number(cell.scanCount + cell.audioCount > 0);
  if (weighted === 0) return "blank";
  if (weighted >= 7 && roleCoverage >= 2 && cell.uniqueDays.size >= 3) return "mature";
  if (weighted >= 2.5 && (cell.uniqueDays.size >= 2 || cell.placeKeys.size >= 2)) return "repeatable";
  return "building";
}

function missingAxesForCell(cell: CellStat): string[] {
  const missing: string[] = [];
  if (cell.scanCount + cell.audioCount === 0) missing.push("scan_pass");
  if (cell.guideCount === 0 && cell.noteCount > 0) missing.push("guide_scene");
  if (cell.noteCount < 2) missing.push("revisit_note");
  return missing;
}

function priorityCueForCell(cell: CellStat, actorClass: EffortActorClass): FrontierPriorityCue {
  if (actorClass === "local_steward") {
    return "steady_revisit";
  }
  if (actorClass === "traveler") {
    return "fresh_gap";
  }
  if (actorClass === "casual") {
    return cell.noteCount > 0 || cell.guideCount > 0 ? "nearby_gap" : "fresh_gap";
  }
  return cell.noteCount < 2 || cell.uniqueDays.size < 2 ? "steady_revisit" : "fresh_gap";
}

function recommendedRoleForCell(cell: CellStat, actorClass: EffortActorClass): EffortRole {
  if (actorClass === "local_steward") {
    if (cell.noteCount < 2 || cell.uniqueDays.size < 2) return "note";
    if (cell.guideCount === 0 && cell.noteCount > 0) return "guide";
    if (cell.scanCount + cell.audioCount === 0) return "scan";
    return "mixed";
  }
  if (actorClass === "traveler") {
    if (cell.scanCount + cell.audioCount === 0) return "scan";
    if (cell.guideCount === 0) return "guide";
    if (cell.noteCount < 1) return "note";
    return "mixed";
  }
  if (actorClass === "casual") {
    if (cell.guideCount === 0 && cell.noteCount > 0) return "guide";
    if (cell.noteCount < 1) return "note";
    if (cell.scanCount + cell.audioCount === 0) return "scan";
    return "mixed";
  }
  if (cell.scanCount + cell.audioCount === 0) return "scan";
  if (cell.guideCount === 0 && cell.noteCount > 0) return "guide";
  if (cell.noteCount < 2 || cell.uniqueDays.size < 2) return "note";
  return "mixed";
}

function cellToFeature(cell: CellStat, actorClass: EffortActorClass): FrontierFeature {
  const stage = stageForCell(cell);
  const missingAxes = missingAxesForCell(cell);
  const activityCount = cell.noteCount + cell.guideCount + cell.scanCount + cell.audioCount;
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [cell.minLng, cell.minLat],
        [cell.maxLng, cell.minLat],
        [cell.maxLng, cell.maxLat],
        [cell.minLng, cell.maxLat],
        [cell.minLng, cell.minLat],
      ]],
    },
    properties: {
      stage,
      recommendedRole: recommendedRoleForCell(cell, actorClass),
      priorityCue: priorityCueForCell(cell, actorClass),
      missingAxes,
      communityGain: Math.min(1, Number((activityCount / 8).toFixed(3))),
      contributorCount: cell.userIds.size,
      activityCount,
      roleCounts: {
        note: cell.noteCount,
        guide: cell.guideCount,
        scan: cell.scanCount + cell.audioCount,
      },
      lastSeen: cell.lastSeen,
    },
  };
}

async function fetchVisitPoints(kind: "note" | "scan", filters: EffortFilters): Promise<ActivityPoint[]> {
  const pool = getPool();
  const { clause, params } = bboxWhere(
    "coalesce(v.point_latitude, p.center_latitude)",
    "coalesce(v.point_longitude, p.center_longitude)",
    filters.bbox,
    filters.year,
    "v.observed_at",
  );
  const sql = `
    select
      coalesce(v.point_latitude, p.center_latitude) as lat,
      coalesce(v.point_longitude, p.center_longitude) as lng,
      v.user_id,
      v.observed_at::text as ts,
      v.place_id,
      v.visit_id
    from visits v
    left join places p on p.place_id = v.place_id
    where coalesce(v.point_latitude, p.center_latitude) is not null
      and coalesce(v.point_longitude, p.center_longitude) is not null
      and ${kind === "note"
        ? "coalesce(v.session_mode, '') = 'standard' and coalesce(v.visit_mode, 'manual') <> 'track'"
        : "coalesce(v.session_mode, '') = 'fieldscan' and coalesce(v.visit_mode, '') = 'track'"}
      ${clause}
  `;
  try {
    const result = await pool.query<VisitPointRow>(sql, params);
    return result.rows
      .map((row) => toActivityPoint(kind, row))
      .filter((row): row is ActivityPoint => row !== null);
  } catch {
    return [];
  }
}

async function fetchGuidePoints(filters: EffortFilters): Promise<ActivityPoint[]> {
  const pool = getPool();
  const { clause, params } = bboxWhere("lat", "lng", filters.bbox, filters.year, "created_at");
  const sql = `
    select guide_record_id, session_id, user_id, lat, lng, created_at::text as ts
    from guide_records
    where lat is not null
      and lng is not null
      ${clause}
  `;
  try {
    const result = await pool.query<GuidePointRow>(sql, params);
    return result.rows
      .map((row) => toActivityPoint("guide", row))
      .filter((row): row is ActivityPoint => row !== null);
  } catch {
    return [];
  }
}

async function fetchAudioPoints(filters: EffortFilters): Promise<ActivityPoint[]> {
  const pool = getPool();
  const { clause, params } = bboxWhere("lat", "lng", filters.bbox, filters.year, "recorded_at");
  const sql = `
    select session_id, place_id, user_id, lat, lng, recorded_at::text as ts
    from audio_segments
    where lat is not null
      and lng is not null
      and privacy_status = 'clean'
      ${clause}
  `;
  try {
    const result = await pool.query<AudioPointRow>(sql, params);
    return result.rows
      .map((row) => toActivityPoint("audio", row))
      .filter((row): row is ActivityPoint => row !== null);
  } catch {
    return [];
  }
}

async function fetchActivities(filters: EffortFilters): Promise<ActivityPoint[]> {
  const [notes, scans, guides, audios] = await Promise.all([
    fetchVisitPoints("note", filters),
    fetchVisitPoints("scan", filters),
    fetchGuidePoints(filters),
    fetchAudioPoints(filters),
  ]);
  return [...notes, ...scans, ...guides, ...audios];
}

type ActorMetrics = {
  totalActivities: number;
  uniqueDays: number;
  distinctPlaces: number;
  revisitPlaces: number;
};

function actorMetricsForPoints(points: ActivityPoint[]): ActorMetrics {
  const daySet = new Set<string>();
  const placeCounts = new Map<string, number>();
  for (const point of points) {
    const day = toIsoDay(point.timestamp);
    if (day) daySet.add(day);
    placeCounts.set(point.placeKey, (placeCounts.get(point.placeKey) ?? 0) + 1);
  }
  return {
    totalActivities: points.length,
    uniqueDays: daySet.size,
    distinctPlaces: placeCounts.size,
    revisitPlaces: Array.from(placeCounts.values()).filter((count) => count >= 2).length,
  };
}

export function classifyActorClassFromMetrics(metrics: ActorMetrics): EffortActorClass {
  if (metrics.totalActivities <= 3 && metrics.uniqueDays <= 2) {
    return "casual";
  }
  if (
    metrics.revisitPlaces >= 2 ||
    (metrics.revisitPlaces >= 1 && metrics.uniqueDays >= 3) ||
    (metrics.revisitPlaces >= 1 && metrics.distinctPlaces <= 4)
  ) {
    return "local_steward";
  }
  if (
    metrics.distinctPlaces >= 4 &&
    metrics.revisitPlaces === 0 &&
    metrics.uniqueDays <= 3
  ) {
    return "traveler";
  }
  return metrics.revisitPlaces >= 1 ? "local_steward" : "casual";
}

export function classifyEffortActors(activities: EffortActivityPoint[]): Record<string, EffortActorClass> {
  const byUser = new Map<string, ActivityPoint[]>();
  for (const point of activities) {
    if (!point.userId) continue;
    const list = byUser.get(point.userId) ?? [];
    list.push(point);
    byUser.set(point.userId, list);
  }
  const result: Record<string, EffortActorClass> = {};
  for (const [userId, points] of byUser.entries()) {
    result[userId] = classifyActorClassFromMetrics(actorMetricsForPoints(points));
  }
  return result;
}

function filterActivitiesByActorClass(
  activities: ActivityPoint[],
  actorClass: EffortActorClass,
): { activities: ActivityPoint[]; matchingContributorCount: number } {
  if (actorClass === "all") {
    return {
      activities,
      matchingContributorCount: new Set(
        activities.map((activity) => activity.userId).filter((userId): userId is string => Boolean(userId)),
      ).size,
    };
  }
  const actorIndex = classifyEffortActors(activities);
  const matchingUsers = Object.entries(actorIndex)
    .filter(([, value]) => value === actorClass)
    .map(([userId]) => userId);
  const userSet = new Set(matchingUsers);
  return {
    activities: activities.filter((activity) => activity.userId !== null && userSet.has(activity.userId)),
    matchingContributorCount: userSet.size,
  };
}

function buildCellStats(bbox: MapBbox, activities: ActivityPoint[]): { cells: CellStat[]; gridStep: number } {
  const gridStep = chooseGridStep(bbox);
  const grid = buildGrid(bbox, gridStep);
  for (const point of activities) {
    const key = cellKeyForPoint(point, bbox, gridStep);
    if (!key) continue;
    const cell = grid.get(key);
    if (!cell) continue;
    if (point.userId) cell.userIds.add(point.userId);
    if (point.placeKey) cell.placeKeys.add(point.placeKey);
    const day = toIsoDay(point.timestamp);
    if (day) cell.uniqueDays.add(day);
    if (!cell.lastSeen || point.timestamp > cell.lastSeen) cell.lastSeen = point.timestamp;
    if (point.kind === "note") cell.noteCount += 1;
    else if (point.kind === "guide") cell.guideCount += 1;
    else if (point.kind === "scan") cell.scanCount += 1;
    else cell.audioCount += 1;
  }
  return { cells: Array.from(grid.values()), gridStep };
}

function contributorBandFor(count: number): "0" | "1-2" | "3-5" | "6+" {
  if (count <= 0) return "0";
  if (count <= 2) return "1-2";
  if (count <= 5) return "3-5";
  return "6+";
}

function summarizeMine(userId: string | null, activities: ActivityPoint[]): EffortSummary["myProgress"] {
  if (!userId) return null;
  const mine = activities.filter((point) => point.userId === userId);
  const roleBreakdown = {
    note: mine.filter((point) => point.kind === "note").length,
    guide: mine.filter((point) => point.kind === "guide").length,
    scan: mine.filter((point) => point.kind === "scan" || point.kind === "audio").length,
  };
  const revisitMap = new Map<string, number>();
  for (const point of mine) {
    revisitMap.set(point.placeKey, (revisitMap.get(point.placeKey) ?? 0) + 1);
  }
  const revisitCount = Array.from(revisitMap.values()).filter((count) => count >= 2).length;
  const focusRole = roleBreakdown.scan >= roleBreakdown.note && roleBreakdown.scan >= roleBreakdown.guide
    ? "scan"
    : roleBreakdown.guide >= roleBreakdown.note
      ? "guide"
      : "note";
  const winCount = [
    roleBreakdown.note > 0,
    roleBreakdown.guide > 0,
    roleBreakdown.scan > 0,
    revisitCount > 0,
  ].filter(Boolean).length;
  return { roleBreakdown, revisitCount, winCount, focusRole };
}

function topMissingAxes(cells: CellStat[]): string[] {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    for (const axis of missingAxesForCell(cell)) {
      counts.set(axis, (counts.get(axis) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([axis]) => axis);
}

function topMissingAxesFromFeatures(features: FrontierFeature[]): string[] {
  const counts = new Map<string, number>();
  for (const feature of features) {
    for (const axis of feature.properties.missingAxes) {
      counts.set(axis, (counts.get(axis) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([axis]) => axis);
}

function recommendedRoleFromFeatures(features: FrontierFeature[], preferredRole?: EffortRole): EffortRole {
  if (preferredRole && preferredRole !== "mixed") return preferredRole;
  const tallies: Record<EffortRole, number> = { note: 0, guide: 0, scan: 0, mixed: 0 };
  for (const feature of features) {
    tallies[feature.properties.recommendedRole] += 1;
  }
  return (Object.entries(tallies).sort((a, b) => b[1] - a[1])[0]?.[0] as EffortRole | undefined) ?? "mixed";
}

function campaignLabelKey(role: EffortRole, counts: { blank: number; building: number; repeatable: number }): EffortSummary["campaignProgress"]["labelKey"] {
  if (role === "scan" && counts.blank > 0) return "scan_blank";
  if (role === "guide" && counts.building > 0) return "guide_building";
  if (role === "note" && counts.repeatable > 0) return "note_repeatable";
  return "mixed_frontier";
}

function frontierPriorityCue(actorClass: EffortActorClass, role: EffortRole): FrontierPriorityCue {
  if (actorClass === "local_steward") return "steady_revisit";
  if (actorClass === "traveler") return "fresh_gap";
  if (actorClass === "casual") return role === "guide" || role === "note" ? "nearby_gap" : "fresh_gap";
  return role === "note" ? "steady_revisit" : "fresh_gap";
}

function actorCandidateScore(feature: FrontierFeature, actorClass: EffortActorClass): number {
  const { stage, activityCount, contributorCount, missingAxes } = feature.properties;
  const hasRevisitGap = missingAxes.includes("revisit_note");
  const hasGuideGap = missingAxes.includes("guide_scene");
  const hasScanGap = missingAxes.includes("scan_pass");
  if (actorClass === "local_steward") {
    return (stage === "repeatable" ? 6 : stage === "building" ? 5 : stage === "blank" ? 2 : 1)
      + (activityCount > 0 ? 3 : 0)
      + (hasRevisitGap ? 2 : 0)
      + (hasGuideGap ? 1 : 0);
  }
  if (actorClass === "traveler") {
    return (stage === "blank" ? 6 : stage === "building" ? 4 : 1)
      + (activityCount === 0 ? 2 : 0)
      + (hasScanGap ? 2 : 0)
      + (contributorCount <= 1 ? 1 : 0);
  }
  if (actorClass === "casual") {
    return (stage === "building" ? 6 : stage === "blank" ? 3 : 1)
      + (activityCount > 0 && activityCount <= 3 ? 2 : 0)
      + (contributorCount <= 2 ? 2 : 0)
      + (hasGuideGap ? 2 : 0);
  }
  return (stage === "blank" ? 5 : stage === "building" ? 4 : stage === "repeatable" ? 3 : 1)
    + (hasScanGap ? 2 : 0)
    + (hasRevisitGap ? 1 : 0);
}

function prioritizedFrontierCandidates(features: FrontierFeature[], actorClass: EffortActorClass): FrontierFeature[] {
  const candidates = features.filter((feature) => feature.properties.stage === "blank" || feature.properties.stage === "building");
  const ranked = [...candidates].sort((left, right) => actorCandidateScore(right, actorClass) - actorCandidateScore(left, actorClass));
  return ranked.slice(0, Math.max(1, Math.min(ranked.length, 24)));
}

function buildFrontierCollection(
  bbox: MapBbox,
  activities: ActivityPoint[],
  actorClass: EffortActorClass,
): FrontierFeatureCollection {
  const { cells, gridStep } = buildCellStats(bbox, activities);
  const features = cells.map((cell) => cellToFeature(cell, actorClass));
  const counts = features.reduce(
    (acc, feature) => {
      acc[feature.properties.stage] += 1;
      return acc;
    },
    { blank: 0, building: 0, repeatable: 0, mature: 0 },
  );
  return {
    type: "FeatureCollection",
    features,
    meta: {
      gridStep,
      blankCount: counts.blank,
      buildingCount: counts.building,
      repeatableCount: counts.repeatable,
      matureCount: counts.mature,
    },
  };
}

export async function getFrontierMap(filters: EffortFilters): Promise<FrontierFeatureCollection> {
  if (!filters.bbox) {
    return {
      type: "FeatureCollection",
      features: [],
      meta: { gridStep: 0, blankCount: 0, buildingCount: 0, repeatableCount: 0, matureCount: 0 },
    };
  }
  const actorClass = filters.actorClass ?? "all";
  const rawActivities = await fetchActivities(filters);
  const scoped = filterActivitiesByActorClass(rawActivities, actorClass);
  return buildFrontierCollection(filters.bbox, scoped.activities, actorClass);
}

export async function getEffortSummary(filters: EffortFilters & { userId?: string | null }): Promise<EffortSummary> {
  const actorClass = filters.actorClass ?? "all";
  const rawActivities = filters.bbox ? await fetchActivities(filters) : [];
  const scoped = filterActivitiesByActorClass(rawActivities, actorClass);
  const activities = scoped.activities;
  const frontier = filters.bbox
    ? buildFrontierCollection(filters.bbox, activities, actorClass)
    : {
        type: "FeatureCollection" as const,
        features: [],
        meta: { gridStep: 0, blankCount: 0, buildingCount: 0, repeatableCount: 0, matureCount: 0 },
      };
  const activeFeatures = frontier.features.filter((feature) => feature.properties.activityCount > 0);
  const strengthenedCellCount = activeFeatures.filter((feature) => feature.properties.lastSeen && (Date.now() - Date.parse(feature.properties.lastSeen)) / 86400000 <= 30).length;
  const contributorCount = new Set(activities.map((activity) => activity.userId).filter((userId): userId is string => Boolean(userId))).size;
  const counts = frontier.meta;
  const frontierCandidates = prioritizedFrontierCandidates(frontier.features, actorClass);
  const recommendedRole = recommendedRoleFromFeatures(frontierCandidates, filters.role);
  const priorityCue = frontierPriorityCue(actorClass, recommendedRole);
  const progressDenominator = Math.max(1, counts.buildingCount + counts.repeatableCount + counts.matureCount);
  const progressRatio = Number(((counts.repeatableCount + counts.matureCount) / progressDenominator).toFixed(3));

  return {
    communityPresenceMode: "aggregate_only",
    actorLens: {
      actorClass,
      matchingContributorCount: scoped.matchingContributorCount,
      estimatedFrom: "behavioral_inference",
    },
    myProgress: summarizeMine(filters.userId ?? null, activities),
    communityProgress: {
      contributorBand: contributorBandFor(contributorCount),
      activeCellCount: activeFeatures.length,
      strengthenedCellCount,
      progressRatio,
    },
    frontierRemaining: {
      blankCount: counts.blankCount,
      buildingCount: counts.buildingCount,
      repeatableCount: counts.repeatableCount,
      matureCount: counts.matureCount,
      topMissingAxes: topMissingAxesFromFeatures(frontierCandidates),
      recommendedRole,
      priorityCue,
    },
    campaignProgress: {
      labelKey: campaignLabelKey(recommendedRole, {
        blank: counts.blankCount,
        building: counts.buildingCount,
        repeatable: counts.repeatableCount,
      }),
      progressRatio,
      remainingCount: counts.blankCount + counts.buildingCount,
      recommendedRole,
      priorityCue,
    },
  };
}
