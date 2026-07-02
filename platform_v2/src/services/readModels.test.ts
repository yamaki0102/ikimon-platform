import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("observation detail snapshot accepts public observations with video evidence", async () => {
  const qualityGate = await readFile(path.join(process.cwd(), "src", "services", "observationQualityGate.ts"), "utf8");
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");

  assert.match(qualityGate, /PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL/);
  assert.match(qualityGate, /public_media_ea\.asset_role = 'observation_video'/);
  assert.match(qualityGate, /public_media_ab\.source_payload->>'iframe_url'/);
  assert.match(readModels, /PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL/);
});

test("observation list cards bound recent visits before scanning valid media", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const listCardsQuery = readModels.slice(
    readModels.indexOf("async function loadObservationListCards"),
    readModels.indexOf("export async function getObservationListSnapshot"),
  );

  assert.match(listCardsQuery, /WITH recent_public_visits AS MATERIALIZED/);
  assert.match(listCardsQuery, /PUBLIC_OBSERVATION_DISCOVERY_EXCLUSION_SQL/);
  assert.match(listCardsQuery, /FROM recent_public_visits rpv\s+JOIN occurrences o ON o\.visit_id = rpv\.visit_id\s+JOIN evidence_assets ea ON \(ea\.occurrence_id = o\.occurrence_id OR ea\.visit_id = rpv\.visit_id\)/);
  assert.match(listCardsQuery, /valid_media AS MATERIALIZED/);
  assert.match(listCardsQuery, /field_refs_by_visit AS/);
  assert.match(listCardsQuery, /JOIN primary_media pm ON pm\.visit_id = v\.visit_id/);
  assert.match(listCardsQuery, /LEFT JOIN field_refs_by_visit fields ON fields\.visit_id = v\.visit_id/);
  assert.doesNotMatch(listCardsQuery, /WHERE o\.visit_id = v\.visit_id[\s\S]*VALID_OBSERVATION_(?:PHOTO|VIDEO)_ASSET_SQL/);
  assert.doesNotMatch(listCardsQuery, /FROM observation_fields f\s+WHERE f\.valid_to IS NULL[\s\S]*v\.resolved_field_ids/);
});

test("public observation quality gate excludes production smoke fixtures from every public surface", async () => {
  const qualityGate = await readFile(path.join(process.cwd(), "src", "services", "observationQualityGate.ts"), "utf8");

  assert.match(qualityGate, /PUBLIC_SMOKE_UI_VISIT_MARKER_PATTERN_SQL/);
  assert.match(qualityGate, /smoke\[-_\]\?ui/);
  assert.match(qualityGate, /coalesce\(v\.source_payload::text, ''\) !~\* '\$\{PUBLIC_SMOKE_UI_VISIT_MARKER_PATTERN_SQL\}'/);
  assert.match(qualityGate, /coalesce\(v\.note, ''\) !~\* '\$\{PUBLIC_SMOKE_UI_VISIT_MARKER_PATTERN_SQL\}'/);
  assert.match(qualityGate, /coalesce\(v\.locality_note, ''\) !~\* '\$\{PUBLIC_SMOKE_UI_VISIT_MARKER_PATTERN_SQL\}'/);
  assert.match(qualityGate, /from users public_quality_user/);
  assert.match(qualityGate, /public_quality_user\.display_name/);
  assert.doesNotMatch(qualityGate, /coalesce\(v\.source_payload::text, ''\) !~\* '\$\{PUBLIC_FIXTURE_ASSET_MARKER_PATTERN_SQL\}'/);
});

test("observation detail revalidates public municipality labels against admin polygons", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const detailSnapshot = readModels.slice(
    readModels.indexOf("export async function getObservationDetailSnapshot"),
    readModels.indexOf("export async function getProfileSnapshot"),
  );

  assert.match(readModels, /resolveAdminLocalityForPoint/);
  assert.match(readModels, /wardLabel && wardLabel !== normalizedInputMunicipality/);
  assert.match(detailSnapshot, /verifiedPublicMunicipalityLabel/);
  assert.match(detailSnapshot, /publicLocation: buildPublicLocationSummary\(\{/);
});

test("record form coordinate fallback does not guess Shizuoka municipalities from rectangles", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const localityFallback = readRoute.slice(
    readRoute.indexOf("const inferLocalityFromCoords"),
    readRoute.indexOf("const localityFromAddress"),
  );

  assert.match(localityFallback, /prefecture: '静岡県'/);
  assert.doesNotMatch(localityFallback, /municipality: '静岡市'/);
  assert.doesNotMatch(localityFallback, /municipality: '浜松市'/);
});

test("home snapshot recent observations stay scoped to the signed-in user", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const homeSnapshot = readModels.slice(
    readModels.indexOf("export async function getHomeSnapshot"),
    readModels.indexOf("export async function getExploreSnapshot"),
  );

  assert.match(homeSnapshot, /loadVisitSummaryObservations\(12, userId \? \{ userId \} : \{\}\)/);
  assert.doesNotMatch(homeSnapshot, /loadVisitSummaryObservations\(12\);/);
});

test("profile snapshot stats reuse the public quality gate so hidden records do not linger", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const profileSnapshot = readModels.slice(
    readModels.indexOf("export async function getProfileSnapshot"),
    readModels.indexOf("export async function getObservationListSnapshot"),
  );

  assert.match(profileSnapshot, /where v\.user_id = \$1\s+and \$\{PUBLIC_OBSERVATION_QUALITY_SQL\}/);
  assert.match(profileSnapshot, /from visits v\s+where v\.user_id = \$1\s+and \$\{PUBLIC_OBSERVATION_QUALITY_SQL\}/);
  assert.match(profileSnapshot, /where v\.user_id = \$1\s+and \$\{PUBLIC_OBSERVATION_QUALITY_SQL\}\s+and coalesce/);
});

test("public profile snapshots do not build owner-only place or exact activity fields", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const profileSnapshot = readModels.slice(
    readModels.indexOf("export async function getProfileSnapshot"),
    readModels.indexOf("export async function getObservationListSnapshot"),
  );

  assert.match(profileSnapshot, /visibility = options\.visibility \?\? "public"/);
  assert.match(profileSnapshot, /visibility === "owner"\s+\? await getHomeSnapshot\(userId\)\s+:\s+\{ viewerUserId: null, recentObservations: \[\], myPlaces: \[\] \}/);
  assert.match(profileSnapshot, /visibility === "owner"\s+\? exactStats\s+:\s+\{/);
  assert.match(profileSnapshot, /currentStreakDays: 0/);
  assert.match(profileSnapshot, /lifeListPreview: visibility === "owner" \? lifeListPreview : \[\]/);
  assert.match(profileSnapshot, /publicContributionRange: formatPublicProfileContributionRange\(exactStats\.totalObservations\)/);
});
