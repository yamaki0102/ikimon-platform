import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const MIGRATION_0027 = readFileSync(
  new URL("../migrations/core/0027_zukan_observation_place_publications.sql", import.meta.url),
  "utf8",
);

test("0027 applies cleanly on empty DB (0 rows) and backfills existing zukan_book_publications rows", (t) => {
  // 1. Empty DB (0 rows)
  const emptyDb = new DatabaseSync(":memory:");
  t.after(() => emptyDb.close());
  emptyDb.exec(MIGRATION_0027);
  emptyDb.exec(MIGRATION_0027);
  const emptyCount = emptyDb.prepare("SELECT COUNT(*) AS n FROM zukan_observation_publications").get() as { n: number };
  assert.equal(emptyCount.n, 0);

  // 2. Existing DB with legacy zukan_book_publications rows
  const existingDb = new DatabaseSync(":memory:");
  t.after(() => existingDb.close());
  existingDb.exec(`
    CREATE TABLE zukan_book_publications (
      group_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      place_name TEXT NOT NULL,
      observation_ids_json TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO zukan_book_publications (group_key, user_id, place_name, observation_ids_json, published, updated_at)
    VALUES ('2026-11-24__常磐公園', 'user-a', '常磐公園', '["obs-1","obs-2"]', 1, 1795400000000);
  `);
  existingDb.exec(MIGRATION_0027);
  existingDb.exec(MIGRATION_0027);

  const rows = existingDb.prepare(
    "SELECT user_id, observation_id, place_id, legacy_group_key, published FROM zukan_observation_publications ORDER BY observation_id",
  ).all() as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { user_id: "user-a", observation_id: "obs-1", place_id: null, legacy_group_key: "2026-11-24__常磐公園", published: 1 },
    { user_id: "user-a", observation_id: "obs-2", place_id: null, legacy_group_key: "2026-11-24__常磐公園", published: 1 },
  ]);
});
