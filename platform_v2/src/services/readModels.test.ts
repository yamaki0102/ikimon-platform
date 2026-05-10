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
  assert.match(listCardsQuery, /FROM recent_public_visits rpv\s+JOIN occurrences o ON o\.visit_id = rpv\.visit_id\s+JOIN evidence_assets ea ON ea\.occurrence_id = o\.occurrence_id/);
  assert.match(listCardsQuery, /valid_media AS MATERIALIZED/);
  assert.match(listCardsQuery, /JOIN primary_media pm ON pm\.visit_id = v\.visit_id/);
  assert.doesNotMatch(listCardsQuery, /WHERE o\.visit_id = v\.visit_id[\s\S]*VALID_OBSERVATION_(?:PHOTO|VIDEO)_ASSET_SQL/);
});
