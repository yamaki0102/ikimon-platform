import { getPool } from "../db.js";
import { buildObserverNameSql } from "./observerNameSql.js";
import { formatTaxonDisplayName } from "./localizedDisplay.js";
import {
  buildPublicCellGeometry,
  buildPublicCellKeyParts,
  formatPublicCellId,
  parsePublicCellId,
  pickPublicGridMeters,
  radiusForGrid,
  resolvePublicLocalityLabel,
  summarizePublicLocalitySet,
  type PublicCellKeyParts as CellKeyParts,
  type PublicLocalityScope,
} from "./publicLocation.js";
import { buildStagingFixtureExclusionSql } from "./stagingFixtureGuard.js";
import {
  PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL,
  PUBLIC_OBSERVATION_QUALITY_SQL,
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
  VALID_OBSERVATION_VIDEO_ASSET_SQL,
} from "./observationQualityGate.js";
import { buildPublicMapCellName } from "./publicMapCellNaming.js";
import {
  coarsenLatLng,
  decidePublicCoord,
  loadSensitiveSpeciesIndex,
  type CoordDecision,
  type CoordMode,
  type OccurrenceForMasking,
} from "./sensitiveSpeciesMasking.js";

/**
 * Public map snapshot for `/map`.
 *
 * The public map deliberately avoids exact points. It exposes:
 *  - deterministic ambient cells for map rendering
 *  - public-safe record lists for the current viewport or a selected cell
 *
 * Text labels use municipality / prefecture only. Exact coordinates and
 * site-level names stay inside canonical storage and never leave the public API.
 */

export type TaxonGroup =
  | "insect"
  | "bird"
  | "plant"
  | "amphibian_reptile"
  | "mammal"
  | "fungi"
  | "other";

export type MarkerProfile = "manual_only" | "trusted_only" | "all_research_artifacts";
export type ProvenanceBucket = "manual" | "legacy" | "track" | "other";
export type SeasonFilter = "spring" | "summer" | "autumn" | "winter";

export const PUBLIC_MAP_AGGREGATE_POLICY = {
  minCellRecords: 3,
  sensitiveMinCellMeters: 5000,
  municipalityMinCellMeters: 20000,
  bboxScope: "fixed_public_cell_cover",
  policy: "k_anonymous_cell_aggregate",
  exposesSuppressedCounts: false,
} as const;

export type PublicMapPrivacyStats = typeof PUBLIC_MAP_AGGREGATE_POLICY;

export type MapQueryFilters = {
  taxonGroup?: TaxonGroup;
  year?: number;
  bbox?: [number, number, number, number];
  limit?: number;
  markerProfile?: MarkerProfile;
  season?: SeasonFilter;
  zoom?: number;
};

export type PublicMapCellFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    cellId: string;
    label: string;
    albumName: string;
    localityLabel: string;
    themeLabel: string;
    scaleLabel: string;
    nearbyAreaName: string | null;
    nameEraLabel: string | null;
    scope: PublicLocalityScope;
    gridM: number;
    radiusM: number;
    count: number;
    firstObservedAt: string | null;
    latestObservedAt: string | null;
    taxonMix: Partial<Record<TaxonGroup, number>>;
    centroidLat: number;
    centroidLng: number;
  };
};

export type PublicMapCellFeatureCollection = {
  type: "FeatureCollection";
  features: PublicMapCellFeature[];
  stats: {
    totalReturned: number;
    totalAll: number;
    totalRecords: number;
    markerProfile: MarkerProfile;
    gridM: number;
    provenance: {
      sampled: boolean;
      sampleSize: number;
      visible: Record<ProvenanceBucket, number>;
      excluded: Record<ProvenanceBucket, number>;
    };
    privacy: PublicMapPrivacyStats;
  };
};

export type PublicMapObservationRecord = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  /** true = displayName is AI fallback (人手 vernacular/scientific 欠落)。UI で badge を出す。 */
  isAiCandidate: boolean;
  /** displayName が "同定待ち" (AI もまだ識別していない) の場合 true。UI で別表記。 */
  isAwaitingId: boolean;
  localityLabel: string;
  observedAt: string;
  photoUrl: string | null;
  taxonGroup: TaxonGroup;
  cellId: string;
};

export type PublicMapObservationList = {
  items: PublicMapObservationRecord[];
  stats: {
    totalReturned: number;
    totalAll: number;
    markerProfile: MarkerProfile;
    gridM: number;
    selectedCellId: string | null;
    provenance: {
      sampled: boolean;
      sampleSize: number;
      visible: Record<ProvenanceBucket, number>;
      excluded: Record<ProvenanceBucket, number>;
    };
    privacy: PublicMapPrivacyStats;
  };
};

type PublicMapSourceRow = {
  occurrence_id: string;
  visit_id: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  display_name: string;
  ai_candidate_name: string | null;
  ai_candidate_rank: string | null;
  is_ai_candidate: boolean | null;
  municipality: string | null;
  prefecture: string | null;
  observed_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  video_thumb_url: string | null;
  source_kind: string | null;
  session_mode: string | null;
  visit_mode: string | null;
  quality_grade: string | null;
  context_precision: OccurrenceForMasking["contextPrecision"] | null;
  risk_lane: string | null;
};

type PublicMapPreparedRecord = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  aiCandidateName: string | null;
  aiCandidateRank: string | null;
  isAiCandidate: boolean;
  observedAt: string;
  latitude: number;
  longitude: number;
  municipality: string | null;
  prefecture: string | null;
  localityLabel: string;
  localityScope: PublicLocalityScope;
  photoUrl: string | null;
  taxonGroup: TaxonGroup;
  sourceKind: string | null;
  sessionMode: string | null;
  visitMode: string | null;
  qualityGrade: string | null;
  publicCoordMode?: CoordMode;
  publicCoordReason?: CoordDecision["reason"] | null;
};

type PublicMapSnapshotRecord = Omit<PublicMapPreparedRecord, "latitude" | "longitude"> & {
  cellIdsByRequestedGrid: Record<string, string>;
};

type PublicMapRuntimeRecord = PublicMapPreparedRecord | PublicMapSnapshotRecord;

export type PublicMapSnapshotPayload = {
  version: 1;
  generatedAt: string;
  policy: PublicMapPrivacyStats;
  records: PublicMapSnapshotRecord[];
};

export type PublicMapSnapshotRefreshResult = {
  snapshotKey: string;
  generatedAt: string;
  sourceSampleSize: number;
  publicRecordCount: number;
};

export type PublicMapSnapshotStatus = {
  ok: boolean;
  status: "missing" | "fresh" | "stale" | "error";
  snapshotKey: string;
  generatedAt: string | null;
  ageSeconds: number | null;
  maxAgeSeconds: number;
  sourceSampleSize: number;
  publicRecordCount: number;
  refreshedBy: string | null;
  error?: string;
};

type PublicMapSnapshotStatusRow = {
  generated_at: string | Date | null;
  source_sample_size: number | string | null;
  public_record_count: number | string | null;
  refreshed_by: string | null;
};

type PublicCellRecordFilter = {
  cellId?: string;
  zoom?: number;
  limit?: number;
};

type PublicCellGroup = {
  cellId: string;
  gridM: number;
  cellX: number;
  cellY: number;
  count: number;
  firstObservedAt: string | null;
  latestObservedAt: string | null;
  localityInputs: Array<{ municipality?: string | null; prefecture?: string | null }>;
  taxonMix: Partial<Record<TaxonGroup, number>>;
};

type PublicMapCellRange = {
  gridM: number;
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
};

type PublicMapFixedCellScope = {
  requestedGridM: number;
  queryBbox: [number, number, number, number];
  ranges: PublicMapCellRange[];
};

const PUBLIC_MAP_SNAPSHOT_KEY = "public-map:v1:global";
const PUBLIC_MAP_FRESHNESS_REGISTRY_KEY = "public_map_snapshot";
const PUBLIC_MAP_REQUESTED_GRIDS = [1000, 3000, 10000] as const;
export const DEFAULT_PUBLIC_MAP_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const MAP_READ_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v.user_id",
  visitIdColumn: "v.visit_id",
  occurrenceIdColumn: "o.occurrence_id",
  visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
  occurrenceSourceColumn: "coalesce(o.source_payload->>'source', '')",
});

const MAP_TRACE_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v.user_id",
  visitIdColumn: "v.visit_id",
  visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
});

const MAP_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "v.user_id",
  displayNameExpr: "u.display_name",
  sourcePayloadExpr: "v.source_payload",
  guestFallback: "Guest",
  defaultFallback: "Unknown observer",
});

// Kingdom / class-level latin prefixes or Japanese vernacular cues for each
// coarse group. Order matters: first match wins. The list is intentionally
// conservative — unknowns fall through to "other" rather than being misplaced.
const TAXON_RULES: ReadonlyArray<{
  group: TaxonGroup;
  scientificPrefixes?: string[];
  scientificContains?: string[];
  vernacularContains?: string[];
}> = [
  {
    group: "bird",
    scientificPrefixes: ["Passer", "Corvus", "Turdus", "Parus", "Hirundo", "Alauda", "Motacilla", "Sturnus", "Emberiza", "Cygnus", "Anas", "Accipiter", "Falco", "Columba", "Picus", "Dendrocopos", "Zosterops", "Pycnonotus"],
    vernacularContains: ["鳥", "ハト", "カラス", "ツバメ", "スズメ", "ムクドリ", "カモ", "サギ", "タカ", "ワシ", "フクロウ", "ヒヨドリ", "シジュウカラ", "メジロ", "キジ", "ハクチョウ"],
  },
  {
    group: "mammal",
    scientificPrefixes: ["Canis", "Felis", "Vulpes", "Nyctereutes", "Cervus", "Sus", "Ursus", "Mustela", "Procyon", "Rattus", "Mus", "Apodemus", "Lepus", "Petaurista", "Macaca", "Sciurus"],
    vernacularContains: ["犬", "猫", "キツネ", "タヌキ", "シカ", "イノシシ", "クマ", "イタチ", "ネズミ", "ウサギ", "リス", "サル", "コウモリ", "イルカ", "クジラ", "モグラ"],
  },
  {
    group: "amphibian_reptile",
    scientificPrefixes: ["Rana", "Bufo", "Hyla", "Rhacophorus", "Cynops", "Gekko", "Elaphe", "Trimeresurus", "Mauremys", "Pelodiscus", "Plestiodon", "Takydromus"],
    vernacularContains: ["カエル", "蛙", "イモリ", "サンショウウオ", "ヤモリ", "トカゲ", "ヘビ", "蛇", "カメ", "亀"],
  },
  {
    group: "fungi",
    scientificPrefixes: ["Amanita", "Boletus", "Tricholoma", "Lactarius", "Russula", "Agaricus", "Lentinula", "Pleurotus", "Cortinarius", "Pholiota", "Hypholoma"],
    scientificContains: ["mycetes", "mycota"],
    vernacularContains: ["キノコ", "茸", "タケ", "ナメコ", "シイタケ", "マツタケ", "エノキ"],
  },
  {
    group: "insect",
    scientificPrefixes: ["Papilio", "Pieris", "Vanessa", "Apis", "Bombus", "Vespa", "Polistes", "Libellula", "Orthetrum", "Oryctes", "Trypoxylus", "Carabus", "Cicindela", "Formica", "Tenodera", "Gryllus"],
    scientificContains: ["optera", "ptera"],
    vernacularContains: ["チョウ", "蝶", "ガ", "蛾", "ハチ", "蜂", "トンボ", "蜻蛉", "セミ", "蝉", "カマキリ", "カブトムシ", "クワガタ", "テントウ", "バッタ", "コオロギ", "アリ", "蟻", "ハナバチ"],
  },
  {
    group: "plant",
    scientificPrefixes: ["Prunus", "Cerasus", "Quercus", "Acer", "Camellia", "Cornus", "Fagus", "Pinus", "Cryptomeria", "Taxus", "Ginkgo", "Rosa", "Trifolium", "Taraxacum", "Oxalis", "Plantago", "Rubus", "Hydrangea", "Wisteria", "Iris", "Lilium"],
    scientificContains: ["aceae"],
    vernacularContains: ["花", "草", "木", "樹", "桜", "梅", "松", "杉", "竹", "葉", "苔", "シダ", "タンポポ", "スミレ", "アジサイ", "ツツジ"],
  },
];

export function inferTaxonGroup(
  scientificName: string | null,
  vernacularName: string | null,
): TaxonGroup {
  const sci = (scientificName ?? "").trim();
  const vern = (vernacularName ?? "").trim();
  if (!sci && !vern) return "other";

  for (const rule of TAXON_RULES) {
    if (sci && rule.scientificPrefixes) {
      const genus = sci.split(/\s+/)[0] ?? "";
      if (rule.scientificPrefixes.includes(genus)) return rule.group;
    }
    if (sci && rule.scientificContains) {
      const lower = sci.toLowerCase();
      if (rule.scientificContains.some((needle) => lower.includes(needle))) return rule.group;
    }
    if (vern && rule.vernacularContains) {
      if (rule.vernacularContains.some((needle) => vern.includes(needle))) return rule.group;
    }
  }
  return "other";
}

function emptyBucketCounts(): Record<ProvenanceBucket, number> {
  return { manual: 0, legacy: 0, track: 0, other: 0 };
}

function publicAggregateProvenance(publicRecordCount: number): PublicMapCellFeatureCollection["stats"]["provenance"] {
  return {
    sampled: true,
    sampleSize: publicRecordCount,
    visible: emptyBucketCounts(),
    excluded: emptyBucketCounts(),
  };
}

const PUBLIC_MAP_VIEWER = {
  isAdminOrAnalyst: false,
  fieldRole: null,
} as const;

function publicMapGridMetersForRecord(
  row: Pick<PublicMapRuntimeRecord, "publicCoordMode" | "publicCoordReason">,
  requestedGridM: number,
): number {
  if (row.publicCoordReason === "rare_redlist") {
    return Math.max(requestedGridM, PUBLIC_MAP_AGGREGATE_POLICY.sensitiveMinCellMeters);
  }
  if (row.publicCoordMode === "municipality") {
    return Math.max(requestedGridM, PUBLIC_MAP_AGGREGATE_POLICY.municipalityMinCellMeters);
  }
  return requestedGridM;
}

function buildPublicCellKeyForRecord(row: PublicMapPreparedRecord, requestedGridM: number): CellKeyParts {
  const gridM = publicMapGridMetersForRecord(row, requestedGridM);
  return buildPublicCellKeyParts(row.latitude, row.longitude, gridM);
}

function snapshotRecordCellParts(row: PublicMapSnapshotRecord, requestedGridM: number): CellKeyParts {
  const cellId = row.cellIdsByRequestedGrid[String(requestedGridM)];
  const parsed = cellId ? parsePublicCellId(cellId) : null;
  if (!parsed) {
    throw new Error(`public_map_snapshot_missing_cell:${requestedGridM}`);
  }
  return parsed;
}

function publicCellKeyForRuntimeRecord(row: PublicMapRuntimeRecord, requestedGridM: number): CellKeyParts {
  if ("cellIdsByRequestedGrid" in row) return snapshotRecordCellParts(row, requestedGridM);
  return buildPublicCellKeyForRecord(row, requestedGridM);
}

function publicMapDisplayName(row: PublicMapRuntimeRecord): string {
  if (row.publicCoordReason === "rare_redlist") return "大切な生きもの";
  return row.displayName;
}

function publicMapPhotoUrl(row: PublicMapRuntimeRecord): string | null {
  if (row.publicCoordReason === "rare_redlist") return null;
  return row.photoUrl;
}

function buildPublicMapSnapshotRecord(row: PublicMapPreparedRecord): PublicMapSnapshotRecord {
  const cellIdsByRequestedGrid: Record<string, string> = {};
  for (const gridM of PUBLIC_MAP_REQUESTED_GRIDS) {
    cellIdsByRequestedGrid[String(gridM)] = formatPublicCellId(buildPublicCellKeyForRecord(row, gridM));
  }
  return {
    occurrenceId: row.occurrenceId,
    visitId: row.visitId,
    displayName: publicMapDisplayName(row),
    aiCandidateName: row.publicCoordReason === "rare_redlist" ? null : row.aiCandidateName,
    aiCandidateRank: row.publicCoordReason === "rare_redlist" ? null : row.aiCandidateRank,
    isAiCandidate: row.publicCoordReason === "rare_redlist" ? false : row.isAiCandidate,
    observedAt: row.observedAt,
    municipality: row.municipality,
    prefecture: row.prefecture,
    localityLabel: row.localityLabel,
    localityScope: row.localityScope,
    photoUrl: publicMapPhotoUrl(row),
    taxonGroup: row.taxonGroup,
    sourceKind: row.sourceKind,
    sessionMode: row.sessionMode,
    visitMode: row.visitMode,
    qualityGrade: row.qualityGrade,
    publicCoordMode: row.publicCoordMode,
    publicCoordReason: row.publicCoordReason,
    cellIdsByRequestedGrid,
  };
}

function buildPublicMapSnapshotPayload(rows: PublicMapPreparedRecord[], generatedAt = new Date().toISOString()): PublicMapSnapshotPayload {
  return {
    version: 1,
    generatedAt,
    policy: PUBLIC_MAP_AGGREGATE_POLICY,
    records: rows.map(buildPublicMapSnapshotRecord),
  };
}

function uniqueGridMetersForFixedScope(requestedGridM: number): number[] {
  return Array.from(new Set([
    requestedGridM,
    Math.max(requestedGridM, PUBLIC_MAP_AGGREGATE_POLICY.sensitiveMinCellMeters),
    Math.max(requestedGridM, PUBLIC_MAP_AGGREGATE_POLICY.municipalityMinCellMeters),
  ])).sort((a, b) => a - b);
}

function cellRangeForBbox(bbox: [number, number, number, number], gridM: number): PublicMapCellRange {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const southWest = buildPublicCellKeyParts(minLat, minLng, gridM);
  const northEast = buildPublicCellKeyParts(maxLat, maxLng, gridM);
  return {
    gridM,
    minCellX: Math.min(southWest.cellX, northEast.cellX),
    maxCellX: Math.max(southWest.cellX, northEast.cellX),
    minCellY: Math.min(southWest.cellY, northEast.cellY),
    maxCellY: Math.max(southWest.cellY, northEast.cellY),
  };
}

function rangeBounds(range: PublicMapCellRange): [number, number, number, number] {
  const minGeom = buildPublicCellGeometry({
    gridM: range.gridM,
    cellX: range.minCellX,
    cellY: range.minCellY,
  });
  const maxGeom = buildPublicCellGeometry({
    gridM: range.gridM,
    cellX: range.maxCellX,
    cellY: range.maxCellY,
  });
  return [
    Math.min(minGeom.bounds[0], maxGeom.bounds[0]),
    Math.min(minGeom.bounds[1], maxGeom.bounds[1]),
    Math.max(minGeom.bounds[2], maxGeom.bounds[2]),
    Math.max(minGeom.bounds[3], maxGeom.bounds[3]),
  ];
}

function buildPublicMapFixedCellScope(
  bbox: [number, number, number, number],
  requestedGridM: number,
): PublicMapFixedCellScope {
  const ranges = uniqueGridMetersForFixedScope(requestedGridM).map((gridM) => cellRangeForBbox(bbox, gridM));
  const bounds = ranges.map(rangeBounds);
  return {
    requestedGridM,
    ranges,
    queryBbox: [
      Math.min(...bounds.map((bound) => bound[0])),
      Math.min(...bounds.map((bound) => bound[1])),
      Math.max(...bounds.map((bound) => bound[2])),
      Math.max(...bounds.map((bound) => bound[3])),
    ],
  };
}

function publicCellPartsInFixedScope(parts: CellKeyParts, scope: PublicMapFixedCellScope): boolean {
  return scope.ranges.some((range) => (
    range.gridM === parts.gridM
    && parts.cellX >= range.minCellX
    && parts.cellX <= range.maxCellX
    && parts.cellY >= range.minCellY
    && parts.cellY <= range.maxCellY
  ));
}

function publicRecordInFixedScope(record: PublicMapRuntimeRecord, scope: PublicMapFixedCellScope): boolean {
  return publicCellPartsInFixedScope(publicCellKeyForRuntimeRecord(record, scope.requestedGridM), scope);
}

function classifyProvenance(
  row: Pick<PublicMapSourceRow, "source_kind" | "session_mode" | "visit_mode">,
): ProvenanceBucket {
  if (row.source_kind === "legacy_observation") return "legacy";
  if (
    row.source_kind === "legacy_track_session" ||
    row.source_kind === "v2_track_session" ||
    row.session_mode === "fieldscan" ||
    row.visit_mode === "track"
  ) {
    return "track";
  }
  if (row.source_kind === "v2_observation" && row.session_mode === "standard" && row.visit_mode !== "track") {
    return "manual";
  }
  return "other";
}

function markerProfileMatches(
  row: Pick<PublicMapSourceRow, "source_kind" | "session_mode" | "visit_mode" | "quality_grade">,
  profile: MarkerProfile,
): boolean {
  const provenance = classifyProvenance(row);
  if (profile === "all_research_artifacts") return provenance !== "track";
  if (profile === "trusted_only") return provenance === "manual" && row.quality_grade === "research";
  return provenance === "manual";
}

function markerProfileMatchesRuntime(
  row: Pick<PublicMapRuntimeRecord, "sourceKind" | "sessionMode" | "visitMode" | "qualityGrade">,
  profile: MarkerProfile,
): boolean {
  return markerProfileMatches({
    source_kind: row.sourceKind,
    session_mode: row.sessionMode,
    visit_mode: row.visitMode,
    quality_grade: row.qualityGrade,
  }, profile);
}

function snapshotRecordMatchesFilters(row: PublicMapSnapshotRecord, filters: MapQueryFilters): boolean {
  const markerProfile = filters.markerProfile ?? "all_research_artifacts";
  if (!markerProfileMatchesRuntime(row, markerProfile)) return false;
  if (filters.taxonGroup && row.taxonGroup !== filters.taxonGroup) return false;
  if (filters.year && new Date(row.observedAt).getUTCFullYear() !== filters.year) return false;
  if (filters.season) {
    const month = new Date(row.observedAt).getUTCMonth() + 1;
    if (!monthForSeason(filters.season).includes(month)) return false;
  }
  return true;
}

function normalizeAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

function monthForSeason(season: SeasonFilter): number[] {
  if (season === "spring") return [3, 4, 5];
  if (season === "summer") return [6, 7, 8];
  if (season === "autumn") return [9, 10, 11];
  return [12, 1, 2];
}

function compareIsoDesc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

async function fetchPublicMapRows(filters: MapQueryFilters): Promise<{
  rows: PublicMapPreparedRecord[];
  markerProfile: MarkerProfile;
  provenance: {
    sampled: boolean;
    sampleSize: number;
    visible: Record<ProvenanceBucket, number>;
    excluded: Record<ProvenanceBucket, number>;
  };
}> {
  const markerProfile = filters.markerProfile ?? "all_research_artifacts";
  const requestedGridM = pickPublicGridMeters(filters.zoom);
  const fixedCellScope = filters.bbox
    ? buildPublicMapFixedCellScope(filters.bbox, requestedGridM)
    : null;
  let pool;
  try {
    pool = getPool();
  } catch {
    return {
      rows: [],
      markerProfile,
      provenance: {
        sampled: false,
        sampleSize: 0,
        visible: emptyBucketCounts(),
        excluded: emptyBucketCounts(),
      },
    };
  }

  const limit = Math.min(Math.max(filters.limit ?? 2000, 1), 4000);
  const whereClauses: string[] = [
    "coalesce(v.point_latitude, p.center_latitude) is not null",
    "coalesce(v.point_longitude, p.center_longitude) is not null",
    MAP_READ_FIXTURE_EXCLUSION_SQL,
    PUBLIC_OBSERVATION_QUALITY_SQL,
    PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL,
  ];
  const params: unknown[] = [];

  if (filters.year) {
    params.push(filters.year);
    whereClauses.push(`extract(year from v.observed_at) = $${params.length}`);
  }
  const queryBbox = fixedCellScope?.queryBbox ?? filters.bbox;
  if (queryBbox) {
    const [minLng, minLat, maxLng, maxLat] = queryBbox;
    params.push(minLng, minLat, maxLng, maxLat);
    whereClauses.push(
      `coalesce(v.point_longitude, p.center_longitude) between $${params.length - 3} and $${params.length - 1}`,
    );
    whereClauses.push(
      `coalesce(v.point_latitude, p.center_latitude) between $${params.length - 2} and $${params.length}`,
    );
  }

  const sql = `
    select
      o.occurrence_id,
      o.visit_id,
      o.scientific_name,
      o.vernacular_name,
      coalesce(
        nullif(o.vernacular_name, ''),
        nullif(o.scientific_name, ''),
        nullif(ai.recommended_taxon_name, ''),
        '同定待ち'
      ) as display_name,
      ai.recommended_taxon_name as ai_candidate_name,
      ai.recommended_rank as ai_candidate_rank,
      (coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, '')) is null
        and nullif(ai.recommended_taxon_name, '') is not null) as is_ai_candidate,
      ${MAP_OBSERVER_NAME_SQL} as observer_name,
      coalesce(v.observed_municipality, p.municipality) as municipality,
      coalesce(v.observed_prefecture, p.prefecture) as prefecture,
      v.observed_at::text,
      coalesce(v.point_latitude, p.center_latitude) as latitude,
      coalesce(v.point_longitude, p.center_longitude) as longitude,
      photo.public_url as photo_url,
      video.thumb_url as video_thumb_url,
      v.source_kind,
      v.session_mode,
      v.visit_mode,
      o.quality_grade,
      coc.context_precision,
      coc.risk_lane
    from occurrences o
    join visits v on v.visit_id = o.visit_id
    left join users u on u.user_id = v.user_id
    left join places p on p.place_id = v.place_id
    left join lateral (
      select recommended_taxon_name, recommended_rank
      from observation_ai_assessments a
      where a.occurrence_id = o.occurrence_id
      order by generated_at desc
      limit 1
    ) ai on true
    left join lateral (
      select coalesce(ab.public_url, ab.storage_path) as public_url
      from evidence_assets ea
      join asset_blobs ab on ab.blob_id = ea.blob_id
      where (ea.occurrence_id = o.occurrence_id or ea.visit_id = v.visit_id)
        and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
      order by
        case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
        ea.created_at asc
      limit 1
    ) photo on true
    left join lateral (
      select coalesce(ea.source_payload->>'thumbnail_url', ab.source_payload->>'thumbnail_url', ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url') as thumb_url
      from evidence_assets ea
      join asset_blobs ab on ab.blob_id = ea.blob_id
      where (ea.occurrence_id = o.occurrence_id or ea.visit_id = v.visit_id)
        and ${VALID_OBSERVATION_VIDEO_ASSET_SQL}
      order by
        case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
        ea.created_at asc
      limit 1
    ) video on true
    left join lateral (
      select max(c.public_precision) as context_precision,
             max(c.risk_lane) as risk_lane
        from civic_observation_contexts c
       where c.visit_id = v.visit_id
    ) coc on true
    where ${whereClauses.join(" and ")}
    order by v.observed_at desc
    limit ${limit}
  `;

  const visibleBuckets = emptyBucketCounts();
  const excludedBuckets = emptyBucketCounts();
  const seasonMonths = filters.season ? monthForSeason(filters.season) : null;

  try {
    const sensitiveIndex = await loadSensitiveSpeciesIndex();
    const result = await pool.query<PublicMapSourceRow>(sql, params);
    const rows = result.rows
      .filter((row) => row.latitude !== null && row.longitude !== null)
      .filter((row) => {
        const bucket = classifyProvenance(row);
        const include = markerProfileMatches(row, markerProfile);
        if (include) visibleBuckets[bucket] += 1;
        else excludedBuckets[bucket] += 1;
        return include;
      })
      .map((row): PublicMapPreparedRecord | null => {
        const originalLat = Number(row.latitude);
        const originalLng = Number(row.longitude);
        const coordDecision = decidePublicCoord(
          {
            scientificName: row.scientific_name,
            vernacularName: row.vernacular_name,
            contextPrecision: row.context_precision ?? null,
            riskLane: row.risk_lane,
          },
          PUBLIC_MAP_VIEWER,
          sensitiveIndex,
        );
        if (coordDecision.mode === "hidden") return null;
        const coarsened = coordDecision.mode === "mesh_1km"
          ? coarsenLatLng(originalLat, originalLng, coordDecision.mode)
          : { lat: originalLat, lng: originalLng };
        if (coarsened.lat === null || coarsened.lng === null) return null;
        const locality = resolvePublicLocalityLabel({
          municipality: row.municipality,
          prefecture: row.prefecture,
        });
        const display = formatTaxonDisplayName({
          vernacularName: row.vernacular_name,
          scientificName: row.scientific_name,
          displayName: row.display_name,
          aiCandidateName: row.ai_candidate_name,
        }, "ja");
        return {
          occurrenceId: row.occurrence_id,
          visitId: row.visit_id,
          displayName: display.primaryLabel,
          aiCandidateName: row.ai_candidate_name ?? null,
          aiCandidateRank: row.ai_candidate_rank ?? null,
          isAiCandidate: Boolean(row.is_ai_candidate),
          observedAt: row.observed_at,
          latitude: coarsened.lat,
          longitude: coarsened.lng,
          municipality: row.municipality,
          prefecture: row.prefecture,
          localityLabel: locality.label,
          localityScope: locality.scope,
          photoUrl: normalizeAssetUrl(row.photo_url ?? row.video_thumb_url),
          taxonGroup: inferTaxonGroup(row.scientific_name, row.vernacular_name),
          sourceKind: row.source_kind,
          sessionMode: row.session_mode,
          visitMode: row.visit_mode,
          qualityGrade: row.quality_grade,
          publicCoordMode: coordDecision.mode,
          publicCoordReason: coordDecision.reason,
        } satisfies PublicMapPreparedRecord;
      })
      .filter((row): row is PublicMapPreparedRecord => row !== null)
      .filter((row) => !fixedCellScope || publicRecordInFixedScope(row, fixedCellScope))
      .filter((row) => !filters.taxonGroup || row.taxonGroup === filters.taxonGroup)
      .filter((row) => {
        if (!seasonMonths) return true;
        const month = new Date(row.observedAt).getUTCMonth() + 1;
        return seasonMonths.includes(month);
      });

    return {
      rows,
      markerProfile,
      provenance: {
        sampled: true,
        sampleSize: visibleBuckets.manual + visibleBuckets.legacy + visibleBuckets.track + visibleBuckets.other + excludedBuckets.manual + excludedBuckets.legacy + excludedBuckets.track + excludedBuckets.other,
        visible: visibleBuckets,
        excluded: excludedBuckets,
      },
    };
  } catch {
    return {
      rows: [],
      markerProfile,
      provenance: {
        sampled: true,
        sampleSize: 0,
        visible: visibleBuckets,
        excluded: excludedBuckets,
      },
    };
  }
}

function normalizePublicMapSnapshotPayload(value: unknown): PublicMapSnapshotPayload | null {
  const raw = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<PublicMapSnapshotPayload>;
  if (payload.version !== 1 || !Array.isArray(payload.records)) return null;
  return {
    version: 1,
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date(0).toISOString(),
    policy: PUBLIC_MAP_AGGREGATE_POLICY,
    records: payload.records.filter((row): row is PublicMapSnapshotRecord => (
      Boolean(row)
      && typeof row === "object"
      && "cellIdsByRequestedGrid" in row
      && typeof (row as { observedAt?: unknown }).observedAt === "string"
    )),
  };
}

async function loadPublicMapSnapshotPayload(): Promise<PublicMapSnapshotPayload | null> {
  let pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }
  try {
    const result = await pool.query<{ payload: unknown }>(
      `select payload
         from public_map_snapshots
        where snapshot_key = $1
        limit 1`,
      [PUBLIC_MAP_SNAPSHOT_KEY],
    );
    return normalizePublicMapSnapshotPayload(result.rows[0]?.payload ?? null);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    if (code !== "42P01") {
      console.warn("[mapSnapshot] public map snapshot read failed", error);
    }
    return null;
  }
}

function parsePositiveNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function snapshotGeneratedAtIso(value: string | Date | null): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function resolvePublicMapSnapshotMaxAgeMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const rawHours = Number(env.IKIMON_PUBLIC_MAP_SNAPSHOT_MAX_AGE_HOURS);
  if (Number.isFinite(rawHours) && rawHours > 0) {
    return Math.max(30 * 60 * 1000, Math.trunc(rawHours * 60 * 60 * 1000));
  }
  return DEFAULT_PUBLIC_MAP_SNAPSHOT_MAX_AGE_MS;
}

function publicMapSnapshotStatusFromRow(
  row: PublicMapSnapshotStatusRow | null | undefined,
  options: { now?: Date; maxAgeMs?: number; error?: string } = {},
): PublicMapSnapshotStatus {
  const maxAgeMs = options.maxAgeMs ?? resolvePublicMapSnapshotMaxAgeMs();
  const maxAgeSeconds = Math.max(1, Math.floor(maxAgeMs / 1000));
  if (!row) {
    return {
      ok: false,
      status: "missing",
      snapshotKey: PUBLIC_MAP_SNAPSHOT_KEY,
      generatedAt: null,
      ageSeconds: null,
      maxAgeSeconds,
      sourceSampleSize: 0,
      publicRecordCount: 0,
      refreshedBy: null,
      error: options.error,
    };
  }

  const generatedAt = snapshotGeneratedAtIso(row.generated_at);
  if (!generatedAt) {
    return {
      ok: false,
      status: "error",
      snapshotKey: PUBLIC_MAP_SNAPSHOT_KEY,
      generatedAt: null,
      ageSeconds: null,
      maxAgeSeconds,
      sourceSampleSize: parsePositiveNumber(row.source_sample_size),
      publicRecordCount: parsePositiveNumber(row.public_record_count),
      refreshedBy: row.refreshed_by ?? null,
      error: options.error ?? "invalid_generated_at",
    };
  }

  const nowMs = options.now?.getTime() ?? Date.now();
  const generatedMs = Date.parse(generatedAt);
  const ageSeconds = Math.max(0, Math.floor((nowMs - generatedMs) / 1000));
  const status = ageSeconds <= maxAgeSeconds ? "fresh" : "stale";
  return {
    ok: status === "fresh",
    status,
    snapshotKey: PUBLIC_MAP_SNAPSHOT_KEY,
    generatedAt,
    ageSeconds,
    maxAgeSeconds,
    sourceSampleSize: parsePositiveNumber(row.source_sample_size),
    publicRecordCount: parsePositiveNumber(row.public_record_count),
    refreshedBy: row.refreshed_by ?? null,
    error: options.error,
  };
}

export async function getPublicMapSnapshotStatus(
  options: { maxAgeMs?: number; now?: Date } = {},
): Promise<PublicMapSnapshotStatus> {
  let pool;
  try {
    pool = getPool();
  } catch (error) {
    return publicMapSnapshotStatusFromRow(null, {
      ...options,
      error: error instanceof Error ? error.message : "db_unavailable",
    });
  }
  try {
    const result = await pool.query<PublicMapSnapshotStatusRow>(
      `select generated_at, source_sample_size, public_record_count, refreshed_by
         from public_map_snapshots
        where snapshot_key = $1
        limit 1`,
      [PUBLIC_MAP_SNAPSHOT_KEY],
    );
    return publicMapSnapshotStatusFromRow(result.rows[0], options);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    return publicMapSnapshotStatusFromRow(null, {
      ...options,
      error: code === "42P01"
        ? "public_map_snapshots_table_missing"
        : error instanceof Error ? error.message : "snapshot_status_read_failed",
    });
  }
}

async function markPublicMapSnapshotFreshnessSuccess(
  pool: ReturnType<typeof getPool>,
  generatedAt: string,
): Promise<void> {
  try {
    await pool.query(
      `update freshness_registry
          set last_attempt_at = $2::timestamptz,
              last_success_at = $2::timestamptz,
              consecutive_failures = 0,
              status = 'fresh',
              next_due_at = $2::timestamptz + ($3::int * interval '1 second'),
              updated_at = now()
        where registry_key = $1`,
      [
        PUBLIC_MAP_FRESHNESS_REGISTRY_KEY,
        generatedAt,
        Math.floor(resolvePublicMapSnapshotMaxAgeMs() / 1000),
      ],
    );
    await pool.query(
      `update staleness_alerts
          set resolved_at = now()
        where registry_key = $1
          and resolved_at is null`,
      [PUBLIC_MAP_FRESHNESS_REGISTRY_KEY],
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    if (code !== "42P01") {
      console.warn("[mapSnapshot] freshness registry success update failed", error);
    }
  }
}

async function markPublicMapSnapshotFreshnessFailure(): Promise<void> {
  let pool;
  try {
    pool = getPool();
  } catch {
    return;
  }
  try {
    await pool.query(
      `update freshness_registry
          set last_attempt_at = now(),
              consecutive_failures = consecutive_failures + 1,
              status = case when consecutive_failures + 1 >= 3 then 'critical' else 'stale' end,
              updated_at = now()
        where registry_key = $1`,
      [PUBLIC_MAP_FRESHNESS_REGISTRY_KEY],
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    if (code !== "42P01") {
      console.warn("[mapSnapshot] freshness registry failure update failed", error);
    }
  }
}

function emptyPublicMapCells(markerProfile: MarkerProfile, zoom?: number): PublicMapCellFeatureCollection {
  const collection = buildPublicMapCells([], zoom);
  collection.stats.markerProfile = markerProfile;
  return collection;
}

function emptyPublicMapObservations(
  markerProfile: MarkerProfile,
  filters: PublicCellRecordFilter = {},
): PublicMapObservationList {
  const list = buildPublicCellRecords([], filters);
  list.stats.markerProfile = markerProfile;
  return list;
}

function filteredSnapshotRecords(
  payload: PublicMapSnapshotPayload,
  filters: MapQueryFilters,
): PublicMapSnapshotRecord[] {
  const requestedGridM = pickPublicGridMeters(filters.zoom);
  const fixedCellScope = filters.bbox
    ? buildPublicMapFixedCellScope(filters.bbox, requestedGridM)
    : null;
  return payload.records
    .filter((row) => snapshotRecordMatchesFilters(row, filters))
    .filter((row) => !fixedCellScope || publicRecordInFixedScope(row, fixedCellScope));
}

export async function refreshPublicMapSnapshot(options: { limit?: number; refreshedBy?: string } = {}): Promise<PublicMapSnapshotRefreshResult> {
  const generatedAt = new Date().toISOString();
  const prepared = await fetchPublicMapRows({
    limit: options.limit ?? 4000,
    markerProfile: "all_research_artifacts",
  });
  const payload = buildPublicMapSnapshotPayload(prepared.rows, generatedAt);
  const pool = getPool();
  await pool.query(
    `insert into public_map_snapshots (
        snapshot_key, payload, policy, generated_at, source_sample_size, public_record_count, refreshed_by
      ) values ($1, $2::jsonb, $3::jsonb, $4::timestamptz, $5, $6, $7)
      on conflict (snapshot_key) do update set
        payload = excluded.payload,
        policy = excluded.policy,
        generated_at = excluded.generated_at,
        source_sample_size = excluded.source_sample_size,
        public_record_count = excluded.public_record_count,
        refreshed_by = excluded.refreshed_by`,
    [
      PUBLIC_MAP_SNAPSHOT_KEY,
      JSON.stringify(payload),
      JSON.stringify(PUBLIC_MAP_AGGREGATE_POLICY),
      generatedAt,
      prepared.provenance.sampleSize,
      payload.records.length,
      options.refreshedBy ?? "manual",
    ],
  );
  await markPublicMapSnapshotFreshnessSuccess(pool, generatedAt);
  return {
    snapshotKey: PUBLIC_MAP_SNAPSHOT_KEY,
    generatedAt,
    sourceSampleSize: prepared.provenance.sampleSize,
    publicRecordCount: payload.records.length,
  };
}

export async function refreshPublicMapSnapshotIfStale(
  options: { maxAgeMs?: number; force?: boolean; limit?: number; refreshedBy?: string } = {},
): Promise<{
  refreshed: boolean;
  status: PublicMapSnapshotStatus;
  refresh: PublicMapSnapshotRefreshResult | null;
}> {
  const before = await getPublicMapSnapshotStatus({ maxAgeMs: options.maxAgeMs });
  if (!options.force && before.ok) {
    return { refreshed: false, status: before, refresh: null };
  }

  try {
    const refresh = await refreshPublicMapSnapshot({
      limit: options.limit,
      refreshedBy: options.refreshedBy ?? "auto",
    });
    const status = await getPublicMapSnapshotStatus({ maxAgeMs: options.maxAgeMs });
    return { refreshed: true, status, refresh };
  } catch (error) {
    await markPublicMapSnapshotFreshnessFailure();
    throw error;
  }
}

export function buildPublicMapCells(
  rows: PublicMapRuntimeRecord[],
  zoom?: number,
): PublicMapCellFeatureCollection {
  const gridM = pickPublicGridMeters(zoom);
  const groups = new Map<string, PublicCellGroup>();

  for (const row of rows) {
    const cell = publicCellKeyForRuntimeRecord(row, gridM);
    const cellId = formatPublicCellId(cell);
    if (!groups.has(cellId)) {
      groups.set(cellId, {
        cellId,
        gridM: cell.gridM,
        cellX: cell.cellX,
        cellY: cell.cellY,
        count: 0,
        firstObservedAt: null,
        latestObservedAt: null,
        localityInputs: [],
        taxonMix: {},
      });
    }
    const group = groups.get(cellId)!;
    group.count += 1;
    group.localityInputs.push({
      municipality: row.municipality,
      prefecture: row.prefecture,
    });
    if (!group.firstObservedAt || row.observedAt < group.firstObservedAt) {
      group.firstObservedAt = row.observedAt;
    }
    if (!group.latestObservedAt || row.observedAt > group.latestObservedAt) {
      group.latestObservedAt = row.observedAt;
    }
    group.taxonMix[row.taxonGroup] = (group.taxonMix[row.taxonGroup] ?? 0) + 1;
  }

  const publicGroups = Array.from(groups.values())
    .filter((group) => group.count >= PUBLIC_MAP_AGGREGATE_POLICY.minCellRecords);
  const publicRecordCount = publicGroups.reduce((sum, group) => sum + group.count, 0);

  const features = publicGroups
    .sort((a, b) => (b.count - a.count) || compareIsoDesc(a.latestObservedAt, b.latestObservedAt))
    .map((group) => {
      const locality = summarizePublicLocalitySet(group.localityInputs);
      const polygon = buildPublicCellGeometry(group);
      const name = buildPublicMapCellName({
        localityLabel: locality.label,
        localityScope: locality.scope,
        gridM: group.gridM,
        count: group.count,
        taxonMix: group.taxonMix,
      });
      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [polygon.ring],
        },
        properties: {
          cellId: group.cellId,
          label: locality.label,
          albumName: name.albumName,
          localityLabel: name.localityLabel,
          themeLabel: name.themeLabel,
          scaleLabel: name.scaleLabel,
          nearbyAreaName: name.nearbyAreaName,
          nameEraLabel: name.nameEraLabel,
          scope: locality.scope,
          gridM: group.gridM,
          radiusM: radiusForGrid(group.gridM),
          count: group.count,
          firstObservedAt: group.firstObservedAt,
          latestObservedAt: group.latestObservedAt,
          taxonMix: group.taxonMix,
          centroidLat: polygon.centroidLat,
          centroidLng: polygon.centroidLng,
        },
      };
    });

  return {
    type: "FeatureCollection",
    features,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      totalRecords: publicRecordCount,
      markerProfile: "all_research_artifacts",
      gridM,
      provenance: publicAggregateProvenance(publicRecordCount),
      privacy: PUBLIC_MAP_AGGREGATE_POLICY,
    },
  };
}

export function buildPublicCellRecords(
  rows: PublicMapRuntimeRecord[],
  filters: PublicCellRecordFilter = {},
): PublicMapObservationList {
  const parsedCellId = filters.cellId ? parsePublicCellId(filters.cellId) : null;
  const gridM = parsedCellId?.gridM ?? pickPublicGridMeters(filters.zoom);
  const targetCellId = parsedCellId ? formatPublicCellId(parsedCellId) : null;
  const scopedEntries = rows
    .map((row) => {
      const cellParts = publicCellKeyForRuntimeRecord(row, gridM);
      return {
        row,
        cellId: formatPublicCellId(cellParts),
      };
    })
    .filter((entry) => !targetCellId || entry.cellId === targetCellId);
  const cellCounts = new Map<string, number>();
  for (const entry of scopedEntries) {
    cellCounts.set(entry.cellId, (cellCounts.get(entry.cellId) ?? 0) + 1);
  }
  const publicEntries = scopedEntries
    .filter((entry) => (cellCounts.get(entry.cellId) ?? 0) >= PUBLIC_MAP_AGGREGATE_POLICY.minCellRecords);
  const sorted = publicEntries
    .sort((a, b) => compareIsoDesc(a.row.observedAt, b.row.observedAt));

  const items = sorted
    .slice(0, Math.min(Math.max(filters.limit ?? 300, 1), 1200))
    .map((entry) => ({
      occurrenceId: entry.row.occurrenceId,
      visitId: entry.row.visitId,
      displayName: publicMapDisplayName(entry.row),
      isAiCandidate: entry.row.publicCoordReason === "rare_redlist" ? false : entry.row.isAiCandidate,
      isAwaitingId: entry.row.publicCoordReason === "rare_redlist" ? false : entry.row.displayName === "同定待ち",
      localityLabel: entry.row.localityLabel,
      observedAt: entry.row.observedAt,
      photoUrl: publicMapPhotoUrl(entry.row),
      taxonGroup: entry.row.taxonGroup,
      cellId: entry.cellId,
    }));

  return {
    items,
    stats: {
      totalReturned: items.length,
      totalAll: publicEntries.length,
      markerProfile: "all_research_artifacts",
      gridM,
      selectedCellId: targetCellId,
      provenance: publicAggregateProvenance(publicEntries.length),
      privacy: PUBLIC_MAP_AGGREGATE_POLICY,
    },
  };
}

export type PublicAreaNameCandidate = {
  name: string;
  admin_level: string | null;
  source: string;
  entity_key: string | null;
  area_ha: string | number | null;
  bbox_min_lat: string | number | null;
  bbox_max_lat: string | number | null;
  bbox_min_lng: string | number | null;
  bbox_max_lng: string | number | null;
  valid_from: string | null;
  valid_to: string | null;
};

export type NearbyAreaChoice = {
  name: string;
  nameEraLabel: string | null;
};

function boundsFromFeature(feature: PublicMapCellFeature): [number, number, number, number] | null {
  const ring = feature.geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const coord of ring) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function bboxOverlapsCell(row: PublicAreaNameCandidate, bounds: [number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const rowMinLat = Number(row.bbox_min_lat);
  const rowMaxLat = Number(row.bbox_max_lat);
  const rowMinLng = Number(row.bbox_min_lng);
  const rowMaxLng = Number(row.bbox_max_lng);
  if (![rowMinLat, rowMaxLat, rowMinLng, rowMaxLng].every(Number.isFinite)) return false;
  return rowMinLat <= maxLat && rowMaxLat >= minLat && rowMinLng <= maxLng && rowMaxLng >= minLng;
}

function isPublicNearbyNameCandidate(row: PublicAreaNameCandidate): boolean {
  const level = row.admin_level ?? row.source;
  return ["osm_park", "nature_symbiosis_site", "tsunag", "protected", "oecm"].includes(level);
}

function dateKey(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const key = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function rangeOverlapsCandidate(
  row: PublicAreaNameCandidate,
  period: { firstObservedAt?: string | null; latestObservedAt?: string | null },
): boolean {
  const first = dateKey(period.firstObservedAt);
  const latest = dateKey(period.latestObservedAt) ?? first;
  if (!first || !latest) return row.valid_to === null;
  const validFrom = dateKey(row.valid_from);
  const validTo = dateKey(row.valid_to);
  return (!validFrom || validFrom <= latest) && (!validTo || validTo >= first);
}

function candidateValidAt(row: PublicAreaNameCandidate, observedAt: string | null | undefined): boolean {
  const observed = dateKey(observedAt);
  if (!observed) return row.valid_to === null;
  const validFrom = dateKey(row.valid_from);
  const validTo = dateKey(row.valid_to);
  return (!validFrom || validFrom <= observed) && (!validTo || validTo >= observed);
}

function chooseNearbyAreaName(
  rows: PublicAreaNameCandidate[],
  bounds: [number, number, number, number],
  period: { firstObservedAt?: string | null; latestObservedAt?: string | null } = {},
): NearbyAreaChoice | null {
  const candidates = rows
    .filter((row) => row.name && isPublicNearbyNameCandidate(row) && bboxOverlapsCell(row, bounds))
    .filter((row) => rangeOverlapsCandidate(row, period) || row.valid_to === null)
    .sort((a, b) => {
      const aLatest = candidateValidAt(a, period.latestObservedAt);
      const bLatest = candidateValidAt(b, period.latestObservedAt);
      if (aLatest !== bLatest) return aLatest ? -1 : 1;
      const aOverlaps = rangeOverlapsCandidate(a, period);
      const bOverlaps = rangeOverlapsCandidate(b, period);
      if (aOverlaps !== bOverlaps) return aOverlaps ? -1 : 1;
      const areaA = Number(a.area_ha);
      const areaB = Number(b.area_ha);
      const safeA = Number.isFinite(areaA) ? areaA : 999999;
      const safeB = Number.isFinite(areaB) ? areaB : 999999;
      return safeA - safeB || a.name.localeCompare(b.name, "ja");
    });
  const selected = candidates[0];
  if (!selected) return null;
  return {
    name: selected.name,
    nameEraLabel: selected.valid_to === null ? null : "観察当時の地名",
  };
}

async function enrichPublicMapCellNames(collection: PublicMapCellFeatureCollection): Promise<void> {
  const featureBounds = collection.features
    .map((feature) => ({ feature, bounds: boundsFromFeature(feature) }))
    .filter((entry): entry is { feature: PublicMapCellFeature; bounds: [number, number, number, number] } => entry.bounds !== null);
  if (featureBounds.length === 0) return;

  const minLng = Math.min(...featureBounds.map((entry) => entry.bounds[0]));
  const minLat = Math.min(...featureBounds.map((entry) => entry.bounds[1]));
  const maxLng = Math.max(...featureBounds.map((entry) => entry.bounds[2]));
  const maxLat = Math.max(...featureBounds.map((entry) => entry.bounds[3]));
  const observedStarts = featureBounds
    .map((entry) => dateKey(entry.feature.properties.firstObservedAt))
    .filter((value): value is string => value !== null);
  const observedEnds = featureBounds
    .map((entry) => dateKey(entry.feature.properties.latestObservedAt))
    .filter((value): value is string => value !== null);
  observedStarts.sort();
  observedEnds.sort();
  const observedMin = observedStarts.length > 0 ? observedStarts[0]! : "0001-01-01";
  const observedMax = observedEnds.length > 0 ? observedEnds[observedEnds.length - 1]! : "9999-12-31";

  const result = await getPool().query<PublicAreaNameCandidate>(
    `select name, admin_level, source, entity_key, area_ha::text as area_ha,
            bbox_min_lat::text as bbox_min_lat, bbox_max_lat::text as bbox_max_lat,
            bbox_min_lng::text as bbox_min_lng, bbox_max_lng::text as bbox_max_lng,
            valid_from::text as valid_from, valid_to::text as valid_to
       from observation_fields
      where bbox_min_lat is not null
        and bbox_min_lat <= $1
        and bbox_max_lat >= $2
        and bbox_min_lng <= $3
        and bbox_max_lng >= $4
        and coalesce(admin_level, source) in ('osm_park', 'nature_symbiosis_site', 'tsunag', 'protected', 'oecm')
        and (
          ((valid_from is null or valid_from <= $5::date) and (valid_to is null or valid_to >= $6::date))
          or valid_to is null
        )
      limit 500`,
    [maxLat, minLat, maxLng, minLng, observedMax, observedMin],
  );

  for (const entry of featureBounds) {
    const props = entry.feature.properties;
    const nearbyArea = props.gridM <= 3000
      ? chooseNearbyAreaName(result.rows, entry.bounds, {
        firstObservedAt: props.firstObservedAt,
        latestObservedAt: props.latestObservedAt,
      })
      : null;
    const name = buildPublicMapCellName({
      localityLabel: props.localityLabel || props.label,
      localityScope: props.scope,
      gridM: props.gridM,
      count: props.count,
      taxonMix: props.taxonMix,
      nearbyAreaName: nearbyArea?.name ?? null,
      nameEraLabel: nearbyArea?.nameEraLabel ?? null,
    });
    props.albumName = name.albumName;
    props.localityLabel = name.localityLabel;
    props.themeLabel = name.themeLabel;
    props.scaleLabel = name.scaleLabel;
    props.nearbyAreaName = name.nearbyAreaName;
    props.nameEraLabel = name.nameEraLabel;
  }
}

export async function getMapCells(
  filters: MapQueryFilters & { zoom?: number },
): Promise<PublicMapCellFeatureCollection> {
  const markerProfile = filters.markerProfile ?? "all_research_artifacts";
  const snapshot = await loadPublicMapSnapshotPayload();
  if (!snapshot) return emptyPublicMapCells(markerProfile, filters.zoom);
  const collection = buildPublicMapCells(filteredSnapshotRecords(snapshot, filters), filters.zoom);
  await enrichPublicMapCellNames(collection).catch((error) => {
    console.warn("[mapSnapshot] public map cell naming enrichment failed", error);
  });
  collection.stats.markerProfile = markerProfile;
  return collection;
}

export async function getMapObservations(
  filters: MapQueryFilters & { cellId?: string; zoom?: number },
): Promise<PublicMapObservationList> {
  const parsedCellId = filters.cellId ? parsePublicCellId(filters.cellId) : null;
  const markerProfile = filters.markerProfile ?? "all_research_artifacts";
  const snapshot = await loadPublicMapSnapshotPayload();
  if (!snapshot) {
    return emptyPublicMapObservations(markerProfile, {
      cellId: filters.cellId,
      zoom: filters.zoom,
      limit: filters.limit,
    });
  }
  const scopedFilters = parsedCellId
    ? { ...filters, bbox: undefined }
    : { ...filters, bbox: filters.bbox };
  const list = buildPublicCellRecords(filteredSnapshotRecords(snapshot, scopedFilters), {
    cellId: filters.cellId,
    zoom: filters.zoom,
    limit: filters.limit,
  });
  list.stats.markerProfile = markerProfile;
  return list;
}

export const __test__ = {
  chooseNearbyAreaName,
  buildPublicMapFixedCellScope,
  publicRecordInFixedScope,
  buildPublicMapSnapshotPayload,
  publicMapSnapshotStatusFromRow,
};

/**
 * Coverage mesh — aggregate observations at mesh4 (or mesh3) granularity to
 * show which areas have been walked heavily vs. barely touched. Returns a
 * GeoJSON FeatureCollection of small polygons; each feature's `count` property
 * drives the fill opacity client-side.
 */
export async function getCoverageMesh(
  filters: { year?: number } = {},
): Promise<{
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
    properties: { mesh: string; count: number };
  }>;
  maxCount: number;
}> {
  const empty = { type: "FeatureCollection" as const, features: [], maxCount: 0 };
  let pool;
  try {
    pool = getPool();
  } catch {
    return empty;
  }

  const whereYear = filters.year ? `and extract(year from v.observed_at) = $1` : "";
  const params: unknown[] = filters.year ? [filters.year] : [];
  const sql = `
    select
      round(coalesce(v.point_latitude, p.center_latitude)::numeric, 2)  as lat_bin,
      round(coalesce(v.point_longitude, p.center_longitude)::numeric, 2) as lng_bin,
      count(*)::int as c
    from occurrences o
    join visits v on v.visit_id = o.visit_id
    left join places p on p.place_id = v.place_id
    where coalesce(v.point_latitude, p.center_latitude) is not null
      and coalesce(v.point_longitude, p.center_longitude) is not null
      and ${MAP_READ_FIXTURE_EXCLUSION_SQL}
      and ${PUBLIC_OBSERVATION_QUALITY_SQL}
      and ${PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL}
      ${whereYear}
    group by lat_bin, lng_bin
    order by c desc
    limit 1500
  `;

  try {
    const result = await pool.query<{ lat_bin: string; lng_bin: string; c: number }>(sql, params);
    const features = result.rows.map((row) => {
      const lat = Number(row.lat_bin);
      const lng = Number(row.lng_bin);
      const cellSize = 0.01;
      const ring: [number, number][] = [
        [lng, lat],
        [lng + cellSize, lat],
        [lng + cellSize, lat + cellSize],
        [lng, lat + cellSize],
        [lng, lat],
      ];
      return {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [ring] },
        properties: { mesh: `${lat.toFixed(2)},${lng.toFixed(2)}`, count: row.c },
      };
    });
    const maxCount = features.reduce((m, f) => Math.max(m, f.properties.count), 0);
    return { type: "FeatureCollection", features, maxCount };
  } catch {
    return empty;
  }
}

/**
 * Trace lines — recent walk tracks from visit_track_points as GeoJSON
 * LineStrings, so the map can draw "歩いた道" overlaid on observations.
 * Only visits with ≥ 2 recorded points are included; very short single-point
 * sessions are skipped. Results are capped at 300 visits (~100k points) for
 * render performance.
 */
export async function getTraceLines(
  filters: { year?: number; limit?: number } = {},
): Promise<{
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { visitId: string; observedAt: string; pointCount: number };
  }>;
}> {
  const empty = { type: "FeatureCollection" as const, features: [] };
  let pool;
  try {
    pool = getPool();
  } catch {
    return empty;
  }

  const maxVisits = Math.min(filters.limit ?? 200, 300);
  const params: unknown[] = [];
  const yearClause = filters.year
    ? (params.push(filters.year), `and extract(year from v.observed_at) = $${params.length}`)
    : "";

  params.push(maxVisits);
  const sql = `
    with ranked_visits as (
      select v.visit_id, v.observed_at, count(vtp.sequence_no) as pt_count
      from visits v
      join visit_track_points vtp on vtp.visit_id = v.visit_id
      where vtp.point_latitude is not null and vtp.point_longitude is not null
        and ${MAP_TRACE_FIXTURE_EXCLUSION_SQL}
        ${yearClause}
      group by v.visit_id, v.observed_at
      having count(vtp.sequence_no) >= 2
      order by v.observed_at desc
      limit $${params.length}
    )
    select rv.visit_id, rv.observed_at::text, rv.pt_count,
           vtp.sequence_no, vtp.point_latitude as lat, vtp.point_longitude as lng
    from ranked_visits rv
    join visit_track_points vtp on vtp.visit_id = rv.visit_id
    order by rv.observed_at desc, rv.visit_id, vtp.sequence_no
  `;

  try {
    const result = await pool.query<{
      visit_id: string;
      observed_at: string;
      pt_count: string | number;
      sequence_no: number;
      lat: number;
      lng: number;
    }>(sql, params);

    const visitMap = new Map<string, { observedAt: string; ptCount: number; coords: [number, number][] }>();
    for (const row of result.rows) {
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!visitMap.has(row.visit_id)) {
        visitMap.set(row.visit_id, {
          observedAt: String(row.observed_at),
          ptCount: Number(row.pt_count),
          coords: [],
        });
      }
      visitMap.get(row.visit_id)!.coords.push([lng, lat]);
    }

    const features = [];
    for (const [visitId, visit] of visitMap) {
      if (visit.coords.length < 2) continue;
      features.push({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: visit.coords },
        properties: { visitId, observedAt: visit.observedAt, pointCount: visit.coords.length },
      });
    }
    return { type: "FeatureCollection", features };
  } catch {
    return empty;
  }
}
