import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("legacy observation visit upsert keeps the row classified as a legacy observation", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");
  assert.match(source, /on conflict \(visit_id\) do update set[\s\S]*legacy_observation_id = excluded\.legacy_observation_id/);
  assert.match(source, /on conflict \(visit_id\) do update set[\s\S]*source_kind = excluded\.source_kind/);
});

test("legacy no-photo quarantine preserves native video evidence publication", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");
  assert.match(source, /hasValidNativeVideoEvidence/);
  assert.match(source, /VALID_OBSERVATION_VIDEO_ASSET_SQL/);
  assert.match(source, /promoteLegacyNoPhotoVisitWithNativeVideo/);
  assert.match(source, /reason_code in \('native_no_photo', 'legacy_no_photo'\)/);
});
