import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("monitoring package migration is additive and keeps no_catch outside occurrence absence", () => {
  const sql = readFileSync(path.join(process.cwd(), "db", "migrations", "0099_monitoring_package_foundation.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS waterbodies/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS water_record_extensions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_data_rights/);
  assert.match(sql, /'no_catch'/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});

test("data chain migration is additive and models field scan, governance, and package events", () => {
  const sql = readFileSync(path.join(process.cwd(), "db", "migrations", "0100_observation_package_data_chain.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS field_scan_contexts/);
  assert.match(sql, /'fixed_point'/);
  assert.match(sql, /'area_footprint'/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_governance_contexts/);
  assert.match(sql, /local_knowledge_context/);
  assert.match(sql, /site_policy_context/);
  assert.match(sql, /review_scope/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_package_events/);
  assert.match(sql, /'raw_observation'/);
  assert.match(sql, /'export_package'/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
