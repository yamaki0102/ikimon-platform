import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("monitoring package migration is additive and keeps no_catch outside occurrence absence", () => {
  const sql = readFileSync(path.join(process.cwd(), "db", "migrations", "0092_monitoring_package_foundation.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS waterbodies/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS water_record_extensions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_data_rights/);
  assert.match(sql, /'no_catch'/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
