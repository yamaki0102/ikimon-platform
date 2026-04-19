import { getPool } from "../db.js";

/**
 * Map-layer-specific snapshot, separate from landingSnapshot because:
 *  - it fetches more rows (up to 2000) and supports bbox / year / taxon_group filters
 *  - it returns GeoJSON-ready shape so MapLibre can consume it directly
 *  - it computes a coarse taxon_group on the server using scientific_name / vernacular_name
 *    heuristics, mirroring the legacy `/api/get_observations.php?taxon_group=` behavior
 *    until a real taxa table lands.
 */

export type MapObservationFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    occurrenceId: string;
    visitId: string;
    displayName: string;
    scientificName: string | null;
    vernacularName: string | null;
    observerName: string;
    placeName: string;
    municipality: string | null;
    observedAt: string;
    year: number | null;
    taxonGroup: TaxonGroup;
    photoUrl: string | null;
  };
};

export type MapObservationFeatureCollection = {
  type: "FeatureCollection";
  features: MapObservationFeature[];
  stats: {
    totalReturned: number;
    totalAll: number;
    markerProfile: MarkerProfile;
    provenance: {
      sampled: boolean;
      sampleSize: number;
      visible: Record<ProvenanceBucket, number>;
      excluded: Record<ProvenanceBucket, number>;
    };
  };
};

export type TaxonGroup =
  | "insect"
  | "bird"
  | "plant"
  | "amphibian_reptile"
  | "mammal"
  | "fungi"
  | "other";

export type MapQueryFilters = {
  taxonGroup?: TaxonGroup;
  year?: number;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  limit?: number;
  markerProfile?: MarkerProfile;
};

export type MarkerProfile = "manual_only" | "trusted_only" | "all_research_artifacts";
export type ProvenanceBucket = "manual" | "legacy" | "track" | "other";

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

type FeedRow = {
  occurrence_id: string;
  visit_id: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  display_name: string;
  observer_name: string;
  place_name: string;
  municipality: string | null;
  observed_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  source_kind: string | null;
  session_mode: string | null;
  visit_mode: string | null;
  quality_grade: string | null;
};

function emptyBucketCounts(): Record<ProvenanceBucket, number> {
  return { manual: 0, legacy: 0, track: 0, other: 0 };
}

function classifyProvenance(row: Pick<FeedRow, "source_kind" | "session_mode" | "visit_mode">): ProvenanceBucket {
  if (row.source_kind === "legacy_observation") return "legacy";
  if (
    row.source_kind === "legacy_track_session" ||
    row.source_kind === "v2_track_session" ||
    row.session_mode === "fieldscan" ||
    row.visit_mode === "track"
  ) {
    return "track";
  }
  if (row.source_kind === "v2_observation" && row.session_mode === "standard" && row.visit_mode === "manual") {
    return "manual";
  }
  return "other";
}

function markerProfileMatches(
  row: Pick<FeedRow, "source_kind" | "session_mode" | "visit_mode" | "quality_grade">,
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

export async function getMapObservations(
  filters: MapQueryFilters,
): Promise<MapObservationFeatureCollection> {
  const markerProfile = filters.markerProfile ?? "manual_only";
  let pool;
  try {
    pool = getPool();
  } catch {
    return {
      type: "FeatureCollection",
      features: [],
      stats: {
        totalReturned: 0,
        totalAll: 0,
        markerProfile,
        provenance: {
          sampled: false,
          sampleSize: 0,
          visible: emptyBucketCounts(),
          excluded: emptyBucketCounts(),
        },
      },
    };
  }

  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 2000);
  const whereClauses: string[] = [
    "coalesce(v.point_latitude, p.center_latitude) is not null",
    "coalesce(v.point_longitude, p.center_longitude) is not null",
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
      coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
      coalesce(u.display_name, 'Unknown observer') as observer_name,
      coalesce(p.canonical_name, 'Unknown place') as place_name,
      coalesce(v.observed_municipality, p.municipality) as municipality,
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

  let features: MapObservationFeature[] = [];
  const visibleBuckets = emptyBucketCounts();
  const excludedBuckets = emptyBucketCounts();
  try {
    const result = await pool.query<FeedRow>(sql, params);
    features = result.rows
      .filter((row) => row.latitude !== null && row.longitude !== null)
      .filter((row) => {
        const bucket = classifyProvenance(row);
        const include = markerProfileMatches(row, markerProfile);
        if (include) visibleBuckets[bucket] += 1;
        else excludedBuckets[bucket] += 1;
        return include;
      })
      .map((row) => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        const year = row.observed_at ? new Date(row.observed_at).getUTCFullYear() : null;
        const group = inferTaxonGroup(row.scientific_name, row.vernacular_name);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lng, lat] as [number, number] },
          properties: {
            occurrenceId: row.occurrence_id,
            visitId: row.visit_id,
            displayName: row.display_name,
            scientificName: row.scientific_name,
            vernacularName: row.vernacular_name,
            observerName: row.observer_name,
            placeName: row.place_name,
            municipality: row.municipality,
            observedAt: row.observed_at,
            year,
            taxonGroup: group,
            photoUrl: normalizeAssetUrl(row.photo_url),
          },
        };
      });
  } catch {
    features = [];
  }

  // Apply server-side taxon_group filter after inference.
  const filtered = filters.taxonGroup
    ? features.filter((f) => f.properties.taxonGroup === filters.taxonGroup)
    : features;

  // Count unfiltered total for stats.
  let totalAll = features.length;
  try {
    const profileWhere =
      markerProfile === "trusted_only"
        ? `and v.source_kind = 'v2_observation'
           and v.session_mode = 'standard'
           and v.visit_mode = 'manual'
           and o.quality_grade = 'research'`
        : markerProfile === "all_research_artifacts"
          ? `and not (
               v.source_kind = 'legacy_track_session'
               or v.source_kind = 'v2_track_session'
               or v.session_mode = 'fieldscan'
               or v.visit_mode = 'track'
             )`
          : `and v.source_kind = 'v2_observation'
             and v.session_mode = 'standard'
             and v.visit_mode = 'manual'`;
    const countRes = await pool.query<{ c: string }>(
      `select count(*)::text as c
         from occurrences o
         join visits v on v.visit_id = o.visit_id
         left join places p on p.place_id = v.place_id
         where coalesce(v.point_latitude, p.center_latitude) is not null
           and coalesce(v.point_longitude, p.center_longitude) is not null
           ${filters.year ? `and extract(year from v.observed_at) = ${Number(filters.year)}` : ""}
           ${filters.bbox ? `and coalesce(v.point_longitude, p.center_longitude) between ${Number(filters.bbox[0])} and ${Number(filters.bbox[2])}
           and coalesce(v.point_latitude, p.center_latitude) between ${Number(filters.bbox[1])} and ${Number(filters.bbox[3])}` : ""}
           ${profileWhere}`,
    );
    totalAll = Number(countRes.rows[0]?.c ?? totalAll);
  } catch {
    // keep fallback
  }

  return {
    type: "FeatureCollection",
    features: filtered,
    stats: {
      totalReturned: filtered.length,
      totalAll,
      markerProfile,
      provenance: {
        sampled: true,
        sampleSize: visibleBuckets.manual + visibleBuckets.legacy + visibleBuckets.track + visibleBuckets.other + excludedBuckets.manual + excludedBuckets.legacy + excludedBuckets.track + excludedBuckets.other,
        visible: visibleBuckets,
        excluded: excludedBuckets,
      },
    },
  };
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

  // We group by a ~0.01 deg (~1.1 km) grid snap to avoid relying on mesh4
  // populated on every place (sparse in legacy data). Cheap and visually
  // close to the legacy mesh3/4 buckets.
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
    for (const [visitId, v] of visitMap) {
      if (v.coords.length < 2) continue;
      features.push({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: v.coords },
        properties: { visitId, observedAt: v.observedAt, pointCount: v.coords.length },
      });
    }
    return { type: "FeatureCollection", features };
  } catch {
    return empty;
  }
}
