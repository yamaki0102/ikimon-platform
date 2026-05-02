import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("observation upsert only deletes photos owned by the v2 write API", () => {
  const source = readFileSync(path.join(process.cwd(), "src/services/observationWrite.ts"), "utf8");
  const guardedDeletes = source.match(/delete from evidence_assets[\s\S]*?source_payload ->> 'source' = 'v2_write_api'/g) ?? [];

  assert.equal(guardedDeletes.length, 2);
  assert.doesNotMatch(source, /delete from evidence_assets[\s\S]*?and legacy_asset_key is not null`\s*,/);
});
