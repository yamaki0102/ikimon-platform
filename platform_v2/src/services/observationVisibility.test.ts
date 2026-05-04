import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("owner delete is a soft hide and keeps observation media intact", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationVisibility.ts"), "utf8");
  assert.match(source, /public_visibility = 'hidden'/);
  assert.match(source, /quality_review_status = 'archived'/);
  assert.doesNotMatch(source, /delete\s+from\s+(visits|occurrences|evidence_assets|asset_blobs)/i);
});

test("owner delete verifies ownership before hiding the visit", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationVisibility.ts"), "utf8");
  assert.match(source, /target\.user_id !== actorUserId/);
  assert.match(source, /observation_not_owned/);
});

test("owner delete casts jsonb_build_object parameters for postgres type inference", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationVisibility.ts"), "utf8");
  assert.match(source, /'owner_hidden_at',\s+\$2::text/);
  assert.match(source, /'owner_hidden_by',\s+\$3::text/);
});
