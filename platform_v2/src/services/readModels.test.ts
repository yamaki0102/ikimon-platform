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
    readModels.indexOf("function observationListRowsToRecentObservations"),
  );

  assert.match(listCardsQuery, /WITH recent_public_visits AS MATERIALIZED/);
  assert.match(listCardsQuery, /FROM recent_public_visits rpv\s+JOIN occurrences o ON o\.visit_id = rpv\.visit_id\s+JOIN evidence_assets ea ON ea\.occurrence_id = o\.occurrence_id/);
  assert.match(listCardsQuery, /valid_media AS MATERIALIZED/);
  assert.match(listCardsQuery, /field_refs_by_visit AS/);
  assert.match(listCardsQuery, /JOIN primary_media pm ON pm\.visit_id = v\.visit_id/);
  assert.match(listCardsQuery, /LEFT JOIN field_refs_by_visit fields ON fields\.visit_id = v\.visit_id/);
  assert.doesNotMatch(listCardsQuery, /WHERE o\.visit_id = v\.visit_id[\s\S]*VALID_OBSERVATION_(?:PHOTO|VIDEO)_ASSET_SQL/);
  assert.doesNotMatch(listCardsQuery, /FROM observation_fields f\s+WHERE f\.valid_to IS NULL[\s\S]*v\.resolved_field_ids/);
});

test("records needs-id page queries a filtered queue before applying cursors", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const needsIdQuery = readModels.slice(
    readModels.indexOf("async function loadObservationNeedsIdCards"),
    readModels.indexOf("export async function getObservationListSnapshot"),
  );
  const needsIdEndpoint = readRoute.slice(
    readRoute.indexOf('"/api/v1/records/needs-id-page"'),
    readRoute.indexOf('"/api/v1/observations/:id/reference-candidates"'),
  );

  assert.match(readModels, /export function isObservationAwaitingIdentification/);
  assert.match(readModels, /export async function getObservationNeedsIdPage/);
  assert.match(needsIdQuery, /AND \(\s*coalesce\(ids\.identification_count, 0\) = 0/);
  assert.match(needsIdQuery, /LIMIT \$1\s+OFFSET \$2/);
  assert.match(needsIdEndpoint, /getObservationNeedsIdPage/);
  assert.doesNotMatch(needsIdEndpoint, /\.slice\(offset, offset \+ pageSize\)/);
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
