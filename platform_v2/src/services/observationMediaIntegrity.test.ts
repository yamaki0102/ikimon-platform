import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("missing photo integrity report compares expected media_count with valid photo assets", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationMediaIntegrity.ts"), "utf8");
  const packageJson = await readFile(path.join(process.cwd(), "package.json"), "utf8");

  assert.match(source, /source_payload->>'media_count'/);
  assert.match(source, /expected\.expected_photo_count > photo\.valid_photo_count/);
  assert.match(source, /VALID_OBSERVATION_PHOTO_ASSET_SQL/);
  assert.match(source, /valid_video_count/);
  assert.match(source, /v\.source_kind = 'v2_observation'/);
  assert.match(packageJson, /"report:missing-photos": "tsx src\/scripts\/reportMissingObservationPhotos\.ts"/);
});
