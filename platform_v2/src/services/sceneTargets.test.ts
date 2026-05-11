import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { normalizeSceneTargetRect, normalizeTargetTimeRange } from "./sceneTargets.js";

test("scene target rect normalization keeps bounding boxes inside the media", () => {
  assert.deepEqual(
    normalizeSceneTargetRect({ x: 0.8, y: 0.75, width: 0.4, height: 0.5 }),
    { x: 0.8, y: 0.75, width: 0.19999999999999996, height: 0.25 },
  );
  assert.equal(normalizeSceneTargetRect({ x: 0.1, y: 0.1, width: 0, height: 0.2 }), null);
  assert.equal(normalizeSceneTargetRect(null), null);
});

test("scene target time range accepts media intervals and rejects inverted intervals", () => {
  assert.deepEqual(normalizeTargetTimeRange("3", "8"), { startSecond: 3, endSecond: 8 });
  assert.deepEqual(normalizeTargetTimeRange("", ""), { startSecond: null, endSecond: null });
  assert.throws(() => normalizeTargetTimeRange("8", "3"), /invalid_scene_target_time_range/);
});

test("scene target migration and routes preserve scene-target-observation vocabulary", async () => {
  const root = process.cwd();
  const migration = await readFile(path.join(root, "db", "migrations", "0103_scene_targets.sql"), "utf8");
  const route = await readFile(path.join(root, "src", "routes", "sceneTargets.ts"), "utf8");
  const spec = await readFile(path.join(root, "..", "docs", "spec", "ikimon_scene_observation_record_vocabulary_2026-05-11.md"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS scene_targets/);
  assert.match(migration, /status IN \('draft', 'adopted', 'ignored', 'later', 'converted'\)/);
  assert.match(migration, /normalized_rect/);
  assert.match(migration, /start_second/);
  assert.match(migration, /end_second/);
  assert.match(route, /記録対象を整理する/);
  assert.match(route, /採用する/);
  assert.match(route, /無視する/);
  assert.match(route, /あとで見る/);
  assert.match(route, /採用しても最終同定済みにはしません/);
  assert.match(spec, /\/scenes\/\{id\}\/targets/);
});
