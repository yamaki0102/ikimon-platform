import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("legacy observation visit upsert keeps the row classified as a legacy observation", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");
  assert.match(source, /on conflict \(visit_id\) do update set[\s\S]*legacy_observation_id = excluded\.legacy_observation_id/);
  assert.match(source, /on conflict \(visit_id\) do update set[\s\S]*source_kind = excluded\.source_kind/);
});

test("legacy observation visit upsert only writes user_id when the user still exists", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");

  assert.match(
    source,
    /insert into visits \([\s\S]*case when exists \(select 1 from users u where u\.user_id = \$4\) then \$4 else null end/,
  );
});

test("legacy no-photo quarantine preserves native video evidence publication", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");
  assert.match(source, /hasValidNativeVideoEvidence/);
  assert.match(source, /VALID_OBSERVATION_VIDEO_ASSET_SQL/);
  assert.match(source, /promoteLegacyNoPhotoVisitWithNativeVideo/);
  assert.match(source, /reason_code in \('native_no_photo', 'legacy_no_photo'\)/);
});

test("legacy track bootstrap clears prior imported track points before full reload", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");

  assert.match(source, /delete from visit_track_points vtp[\s\S]*v\.source_kind = 'legacy_track_session'/);
});

test("legacy bootstrap serializes real database imports with a postgres advisory lock", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");

  assert.match(source, /LEGACY_IMPORT_ADVISORY_LOCK_KEY/);
  assert.match(source, /pg_advisory_lock\(hashtext\(\$1\)\)/);
  assert.match(source, /pg_advisory_unlock\(hashtext\(\$1\)\)/);
  assert.match(source, /if \(options\.dryRun\)[\s\S]*return task\(\)/);
});

test("legacy bootstrap preserves existing privileged user roles", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/bootstrapLegacyImport.ts"), "utf8");

  assert.match(source, /role_name = case[\s\S]*lower\(coalesce\(users\.role_name, ''\)\) in \('admin', 'analyst'\)[\s\S]*then users\.role_name/);
  assert.match(source, /rank_label = case[\s\S]*coalesce\(users\.rank_label, ''\) in \('管理者', '分析担当'\)[\s\S]*then users\.rank_label/);
});
