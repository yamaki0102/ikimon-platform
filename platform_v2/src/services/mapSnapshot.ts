import { getPool } from "../db.js";
import { buildObserverNameSql } from "./observerNameSql.js";
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

export type MapQueryFilters = {
  taxonGroup?: TaxonGroup;
  year?: number;
  bbox?: [number, number, number, number];
  limit?: number;
  markerProfile?: MarkerProfile;
  season?: SeasonFilter;
};

export type PublicMapCellFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    cellId: string;
    label: string;
    scope: PublicLocalityScope;
    gridM: number;
    radiusM: number;
    count: number;
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
  source_kind: string | null;
  session_mode: string | null;
  visit_mode: string | null;
  quality_grade: string | null;
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
  latestObservedAt: string | null;
  localityInputs: Array<{ municipality?: string | null; prefecture?: string | null }>;
  taxonMix: Partial<Record<TaxonGroup, number>>;
};

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
  ];
  const params: unknown[] = [];

  if (filters.year) {
    params.push(filters.year);
    whereClauses.push(`extract(year from v.observed_at) = $${params.length}`);
  }
  if (filters.bbox) {
    const [minLng, minLat, maxLng, maxLat] = filters.bbox;
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
      v.source_kind,
      v.session_mode,
      v.visit_mode,
      o.quality_grade
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
      where ea.occurrence_id = o.occurrence_id
        and ea.asset_role = 'observation_photo'
      order by ea.created_at asc
      limit 1
    ) photo on true
    where ${whereClauses.join(" and ")}
    order by v.observed_at desc
    limit ${limit}
  `;

  const visibleBuckets = emptyBucketCounts();
  const excludedBuckets = emptyBucketCounts();
  const seasonMonths = filters.season ? monthForSeason(filters.season) : null;

  try {
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
      .map((row) => {
        const locality = resolvePublicLocalityLabel({
          municipality: row.municipality,
          prefecture: row.prefecture,
        });
        return {
          occurrenceId: row.occurrence_id,
          visitId: row.visit_id,
          displayName: row.display_name,
          aiCandidateName: row.ai_candidate_name ?? null,
          aiCandidateRank: row.ai_candidate_rank ?? null,
          isAiCandidate: Boolean(row.is_ai_candidate),
          observedAt: row.observed_at,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          municipality: row.municipality,
          prefecture: row.prefecture,
          localityLabel: locality.label,
          localityScope: locality.scope,
          photoUrl: normalizeAssetUrl(row.photo_url),
          taxonGroup: inferTaxonGroup(row.scientific_name, row.vernacular_name),
          sourceKind: row.source_kind,
          sessionMode: row.session_mode,
          visitMode: row.visit_mode,
          qualityGrade: row.quality_grade,
        } satisfies PublicMapPreparedRecord;
      })
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

export function buildPublicMapCells(
  rows: PublicMapPreparedRecord[],
  zoom?: number,
): PublicMapCellFeatureCollection {
  const gridM = pickPublicGridMeters(zoom);
  const groups = new Map<string, PublicCellGroup>();

  for (const row of rows) {
    const cell = buildPublicCellKeyParts(row.latitude, row.longitude, gridM);
    const cellId = formatPublicCellId(cell);
    if (!groups.has(cellId)) {
      groups.set(cellId, {
        cellId,
        gridM,
        cellX: cell.cellX,
        cellY: cell.cellY,
        count: 0,
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
    if (!group.latestObservedAt || row.observedAt > group.latestObservedAt) {
      group.latestObservedAt = row.observedAt;
    }
    group.taxonMix[row.taxonGroup] = (group.taxonMix[row.taxonGroup] ?? 0) + 1;
  }

  const features = Array.from(groups.values())
    .sort((a, b) => (b.count - a.count) || compareIsoDesc(a.latestObservedAt, b.latestObservedAt))
    .map((group) => {
      const locality = summarizePublicLocalitySet(group.localityInputs);
      const polygon = buildPublicCellGeometry(group);
      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [polygon.ring],
        },
        properties: {
          cellId: group.cellId,
          label: locality.label,
          scope: locality.scope,
          gridM: group.gridM,
          radiusM: radiusForGrid(group.gridM),
          count: group.count,
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
      totalRecords: rows.length,
      markerProfile: "all_research_artifacts",
      gridM,
      provenance: {
        sampled: true,
        sampleSize: rows.length,
        visible: emptyBucketCounts(),
        excluded: emptyBucketCounts(),
      },
    },
  };
}

export function buildPublicCellRecords(
  rows: PublicMapPreparedRecord[],
  filters: PublicCellRecordFilter = {},
): PublicMapObservationList {
  const parsedCellId = filters.cellId ? parsePublicCellId(filters.cellId) : null;
  const gridM = parsedCellId?.gridM ?? pickPublicGridMeters(filters.zoom);
  const targetCellId = parsedCellId ? formatPublicCellId(parsedCellId) : null;
  const sorted = rows
    .map((row) => {
      const cellParts = buildPublicCellKeyParts(row.latitude, row.longitude, gridM);
      return {
        row,
        cellId: formatPublicCellId(cellParts),
      };
    })
    .filter((entry) => !targetCellId || entry.cellId === targetCellId)
    .sort((a, b) => compareIsoDesc(a.row.observedAt, b.row.observedAt));

  const items = sorted
    .slice(0, Math.min(Math.max(filters.limit ?? 300, 1), 1200))
    .map((entry) => ({
      occurrenceId: entry.row.occurrenceId,
      visitId: entry.row.visitId,
      displayName: entry.row.displayName,
      isAiCandidate: entry.row.isAiCandidate,
      isAwaitingId: entry.row.displayName === "同定待ち" || entry.row.displayName === "Unresolved",
      localityLabel: entry.row.localityLabel,
      observedAt: entry.row.observedAt,
      photoUrl: entry.row.photoUrl,
      taxonGroup: entry.row.taxonGroup,
      cellId: entry.cellId,
    }));

  return {
    items,
    stats: {
      totalReturned: items.length,
      totalAll: sorted.length,
      markerProfile: "all_research_artifacts",
      gridM,
      selectedCellId: targetCellId,
      provenance: {
        sampled: true,
        sampleSize: rows.length,
        visible: emptyBucketCounts(),
        excluded: emptyBucketCounts(),
      },
    },
  };
}

export async function getMapCells(
  filters: MapQueryFilters & { zoom?: number },
): Promise<PublicMapCellFeatureCollection> {
  const prepared = await fetchPublicMapRows(filters);
  const collection = buildPublicMapCells(prepared.rows, filters.zoom);
  collection.stats.markerProfile = prepared.markerProfile;
  collection.stats.provenance = prepared.provenance;
  return collection;
}

export async function getMapObservations(
  filters: MapQueryFilters & { cellId?: string; zoom?: number },
): Promise<PublicMapObservationList> {
  const parsedCellId = filters.cellId ? parsePublicCellId(filters.cellId) : null;
  const prepared = await fetchPublicMapRows({
    ...filters,
    bbox: filters.bbox ?? (parsedCellId ? buildPublicCellGeometry(parsedCellId).bounds : undefined),
  });
  const list = buildPublicCellRecords(prepared.rows, {
    cellId: filters.cellId,
    zoom: filters.zoom,
    limit: filters.limit,
  });
  list.stats.markerProfile = prepared.markerProfile;
  list.stats.provenance = prepared.provenance;
  return list;
}

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
