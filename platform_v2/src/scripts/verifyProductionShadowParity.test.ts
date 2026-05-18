import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("production shadow parity counts only the legacy primary occurrence", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/verifyProductionShadowParity.ts"), "utf8");

  assert.match(
    source,
    /coalesce\(o\.subject_index, 0\) = 0\) as observation_occurrences/,
  );
  assert.match(
    source,
    /coalesce\(o\.subject_index, 0\) <> 0\) as additional_observation_occurrences/,
  );
  assert.match(
    source,
    /as identifications_linked[\s\S]*actualCounts\?\.identifications_linked/,
  );
  assert.match(
    source,
    /as evidence_assets_linked[\s\S]*actualCounts\?\.evidence_assets_linked/,
  );
  assert.match(source, /const importableObservationIds = importableObservations\.map/);
  assert.match(source, /legacy_observation_id = any\(\$2::text\[\]\)/);
  assert.match(source, /legacy_observation_id = any\(\$1::text\[\]\)/);
  assert.equal((source.match(/coalesce\(o\.subject_index, 0\) = 0/g) ?? []).length, 3);
});
