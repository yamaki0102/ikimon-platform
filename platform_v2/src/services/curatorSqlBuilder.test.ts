import assert from "node:assert/strict";
import test from "node:test";
import { buildInvasiveLawMigrationSql } from "./curatorSqlBuilder.js";
import type { CuratorSourceSnapshot } from "./curatorSourceSnapshot.js";

const snapshot: CuratorSourceSnapshot = {
  sourceKind: "env_invasive_jp",
  sourceUrl: "https://example.test/invasive.html",
  fetchedAtIso: "2026-04-29T00:00:00.000Z",
  contentSha256: "abc123",
  contentBytes: 1234,
  storagePath: "curator://env_invasive_jp/abc123.txt",
  license: "gov-jp-open",
  text: "unused",
};

test("invasive-law migration inserts source_snapshots before target rows and preserves FK", () => {
  const sql = buildInvasiveLawMigrationSql({
    runId: "11111111-1111-4111-8111-111111111111",
    snapshot,
    rows: [
      {
        scientific_name: "Solenopsis invicta",
        vernacular_jp: "ヒアリ",
        mhlw_category: "iaspecified",
        source_excerpt: "ヒアリ Solenopsis invicta",
      },
    ],
  });
  assert.match(sql, /WITH inserted_snapshot AS \(\s*INSERT INTO source_snapshots/s);
  assert.match(sql, /source_snapshot AS \(\s*SELECT snapshot_id FROM inserted_snapshot/s);
  assert.match(sql, /source_snapshot_id/);
  assert.match(sql, /\(SELECT snapshot_id FROM source_snapshot\)/);
  assert.match(sql, /WHERE NOT EXISTS \(/);
});

test("invasive-law migration escapes SQL strings", () => {
  const sql = buildInvasiveLawMigrationSql({
    runId: "11111111-1111-4111-8111-111111111111",
    snapshot,
    rows: [
      {
        scientific_name: "Example species",
        vernacular_jp: "O'Brien",
        mhlw_category: "priority",
        source_excerpt: "O'Brien excerpt",
      },
    ],
  });
  assert.match(sql, /O''Brien/);
});
