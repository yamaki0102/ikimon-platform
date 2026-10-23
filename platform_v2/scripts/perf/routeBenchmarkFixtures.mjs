const fixtureTime = "2026-10-22T09:00:00.000Z";
const visitId = "z3-perf-visit";
const occurrenceId = "z3-perf-occurrence";
let sqlQueryCount = 0;

export function buildMapFixtureRows() {
  return [
    ["1", 34.7121, 137.7279, "浜松市"],
    ["2", 34.7122, 137.7280, "浜松市"],
    ["3", 34.7123, 137.7281, "浜松市"],
  ].map(([suffix, latitude, longitude, municipality]) => ({
    occurrenceId: `z3-perf-occurrence-${suffix}`,
    visitId: `z3-perf-visit-${suffix}`,
    userId: `z3-perf-user-${suffix}`,
    displayName: "モンシロチョウ",
    observedAt: fixtureTime,
    latitude,
    longitude,
    municipality,
    prefecture: "静岡県",
    localityLabel: municipality,
    localityScope: "municipality",
    photoUrl: null,
    taxonGroup: "insect",
    sourceKind: "v2_observation",
    sessionMode: "standard",
    visitMode: "manual",
    qualityGrade: "research",
    aiCandidateName: null,
    aiCandidateRank: null,
    isAiCandidate: false,
  }));
}

const empty = { rows: [] };
const subjects = Array.from({ length: 12 }, (_, index) => ({
  occurrence_id: index === 0 ? occurrenceId : `z3-perf-occurrence-${index + 1}`,
  visit_id: visitId,
  subject_index: index,
  scientific_name: index === 0 ? "Pieris rapae" : `Perfus species-${index + 1}`,
  vernacular_name: index === 0 ? "モンシロチョウ" : `測定用の種${index + 1}`,
  taxon_rank: "species",
  confidence_score: "0.95",
  evidence_tier: "1",
  ai_assessment_status: null,
  source_payload: {},
  ai_candidate_name: null,
  ai_candidate_rank: null,
}));

function detailRowFor(subject) {
  return {
    occurrence_id: subject.occurrence_id,
    visit_id: subject.visit_id,
    place_id: "z3-perf-place",
    observer_user_id: null,
    observer_avatar_url: null,
    display_name: subject.vernacular_name,
    scientific_name: subject.scientific_name,
    vernacular_name: subject.vernacular_name,
    organism_origin: "wild",
    environment_record: null,
    ai_assessment_status: null,
    public_visibility: "public",
    quality_review_status: "approved",
    observed_at: fixtureTime,
    note: "測定用の公開サンプル記録です。",
    visit_mode: "manual",
    complete_checklist_flag: false,
    target_taxa_scope: null,
    effort_minutes: null,
    distance_meters: null,
    source_payload: {},
    observer_name: "記録者",
    place_name: "測定用の場所",
    municipality: "浜松市",
    prefecture: "静岡県",
    latitude: 34.7121,
    longitude: 137.7279,
  };
}

function rowsFor(sql, parameters, mapFixture) {
  const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.includes("from public_map_snapshots")) return [{ payload: mapFixture }];
  if (normalized.includes("with matched_visit as")) return [{ visit_id: visitId, matched_occurrence_id: occurrenceId }];
  if (normalized.includes("from occurrences o") && normalized.includes("order by o.subject_index")) return subjects;
  if (normalized.includes("from occurrences o") && normalized.includes("where (o.occurrence_id = $1")) {
    const subjectId = String(parameters?.[0] ?? occurrenceId);
    const subject = subjects.find((row) => row.occurrence_id === subjectId);
    return subject ? [detailRowFor(subject)] : [];
  }
  return empty.rows;
}

export function seedDatabaseMocks(Pool, mapFixture) {
  const originalQuery = Pool.prototype.query;
  const originalConnect = Pool.prototype.connect;
  const query = async function mockQuery(sql, parameters) {
    sqlQueryCount += 1;
    return { rows: rowsFor(String(sql), parameters, mapFixture), rowCount: 0 };
  };
  const client = {
    query,
    release() {},
  };
  Pool.prototype.query = query;
  Pool.prototype.connect = async () => client;
  return () => {
    Pool.prototype.query = originalQuery;
    Pool.prototype.connect = originalConnect;
  };
}

export function queryCount() {
  return sqlQueryCount;
}

export function resetQueryCount() {
  sqlQueryCount = 0;
}

export function fixtureMetadata(mapFixture) {
  return {
    mapRecords: mapFixture.records.length,
    observationSubjects: subjects.length,
    visitId,
    occurrenceIds: subjects.map((subject) => subject.occurrence_id),
    responseStrategy: "select SQL patterns return deterministic rows; all other PostgreSQL calls return empty rows",
  };
}
