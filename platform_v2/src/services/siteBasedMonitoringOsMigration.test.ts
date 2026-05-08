import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("0101 migration adds site-based monitoring OS foundations", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "db", "migrations", "0101_site_based_monitoring_os.sql"),
    "utf8",
  );

  assert.match(sql, /ALTER TABLE passive_audio_ingest_events/);
  assert.match(sql, /device_deployment_id/);
  assert.match(sql, /sampling_effort/);
  assert.match(sql, /frequency_range_hz/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS observation_method_contexts/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS sensor_deployments/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_confidence_calibration_registry/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS taxon_external_ids/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS edna_reference_evidence/);
});
