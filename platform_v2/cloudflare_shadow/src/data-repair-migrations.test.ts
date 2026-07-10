import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = path.resolve(process.cwd());

test("legacy public rights backfill is provenance-marked and cannot grant export rights", async () => {
  const sql = await readFile(
    path.join(root, "migrations", "observations", "0062_legacy_public_observation_rights_backfill.sql"),
    "utf8",
  );

  assert.match(sql, /INSERT OR IGNORE INTO observation_data_rights/i);
  assert.match(sql, /FROM observations AS o/i);
  assert.match(sql, /o\.visibility = 'public'/i);
  assert.match(sql, /'public_summary'/i);
  assert.match(sql, /'none'/i);
  assert.match(sql, /legacy_public_visibility_backfill_20260710/i);
  assert.match(sql, /external_export_allowed[\s\S]*0/i);
  assert.match(sql, /dataset_license[\s\S]*NULL/i);
  assert.match(sql, /media_license[\s\S]*NULL/i);
  assert.doesNotMatch(sql, /^\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/im);

  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      visibility TEXT NOT NULL,
      emergency_hidden INTEGER NOT NULL DEFAULT 0,
      processing_state TEXT NOT NULL DEFAULT 'accepted'
    );
    CREATE TABLE observation_data_rights (
      visit_id TEXT PRIMARY KEY,
      occurrence_id TEXT,
      record_consent TEXT NOT NULL DEFAULT 'private',
      research_use_consent TEXT NOT NULL DEFAULT 'none',
      enterprise_report_consent TEXT NOT NULL DEFAULT 'none',
      dataset_license TEXT,
      media_license TEXT,
      external_export_allowed INTEGER NOT NULL DEFAULT 0,
      withdrawal_status TEXT NOT NULL DEFAULT 'active',
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO observations VALUES
      ('eligible-public', 'public', 0, 'accepted'),
      ('emergency-hidden', 'public', 1, 'accepted'),
      ('not-accepted', 'public', 0, 'draft'),
      ('private-record', 'private', 0, 'accepted');
  `);
  db.exec(sql);
  const visits = db.prepare("SELECT visit_id FROM observation_data_rights ORDER BY visit_id").all()
    .map((row) => String(row.visit_id));
  assert.deepEqual(visits, ["eligible-public"]);
  db.close();
});

test("auth lifecycle repair only fills missing timestamps and removes expired sessions", async () => {
  const sql = await readFile(
    path.join(root, "migrations", "core", "0008_auth_lifecycle_integrity.sql"),
    "utf8",
  );

  assert.match(sql, /UPDATE auth_users/i);
  assert.match(sql, /created_at\s*=\s*COALESCE\(created_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.match(sql, /updated_at\s*=\s*COALESCE\(updated_at,\s*created_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.match(sql, /WHERE created_at IS NULL OR updated_at IS NULL/i);
  assert.match(sql, /DELETE FROM auth_sessions/i);
  assert.match(sql, /datetime\(\s*CASE[\s\S]*expires_at\s*\|\|\s*':00'[\s\S]*END\s*\)\s*<=\s*datetime\('now'\)/i);
  assert.doesNotMatch(sql, /expires_at <= CURRENT_TIMESTAMP/i);
  assert.doesNotMatch(sql, /DELETE FROM auth_users/i);

  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE auth_users (user_id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT);
    CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
    INSERT INTO auth_users VALUES ('missing-lifecycle', NULL, NULL);
    INSERT INTO auth_sessions VALUES
      ('expired-offset', '2000-07-25 04:28:16.8+09'),
      ('future-offset', '2999-07-25 04:28:16.8+09'),
      ('expired-iso', '2000-07-25T04:28:16.800Z');
  `);
  db.exec(sql);
  const sessions = db.prepare("SELECT token_hash FROM auth_sessions ORDER BY token_hash").all()
    .map((row) => String(row.token_hash));
  assert.deepEqual(sessions, ["future-offset"]);
  const repaired = db.prepare("SELECT created_at, updated_at FROM auth_users WHERE user_id = 'missing-lifecycle'").get();
  assert.ok(repaired?.created_at);
  assert.ok(repaired?.updated_at);
  db.close();
});

test("observation migration chain defines public_area_label only at its numbered migrations", async () => {
  const initial = await readFile(
    path.join(root, "migrations", "observations", "0001_observation_write_contract.sql"),
    "utf8",
  );
  const readmodelChange = await readFile(
    path.join(root, "migrations", "observations", "0052_public_area_label_readmodel.sql"),
    "utf8",
  );
  const observationChange = await readFile(
    path.join(root, "migrations", "observations", "0053_observation_public_area_label.sql"),
    "utf8",
  );

  assert.doesNotMatch(initial, /public_area_label/i);
  assert.match(readmodelChange, /ALTER TABLE readmodel_public_observations ADD COLUMN public_area_label TEXT/i);
  assert.match(observationChange, /ALTER TABLE observations ADD COLUMN public_area_label TEXT/i);
});

test("place memory report migration deduplicates historical rows and enforces one reporter signal", async () => {
  const sql = await readFile(
    path.join(root, "migrations", "observations", "0063_place_memory_report_uniqueness.sql"),
    "utf8",
  );
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE place_memory_reports (
      report_id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
    INSERT INTO place_memory_reports VALUES
      ('report-1', 'entry-1', 'user-1'),
      ('report-2', 'entry-1', 'user-1'),
      ('report-3', 'entry-1', 'user-2');
  `);
  db.exec(sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM place_memory_reports").get()?.count, 2);
  assert.throws(() => db.exec("INSERT INTO place_memory_reports VALUES ('report-4', 'entry-1', 'user-1')"), /UNIQUE constraint failed/i);
  db.close();
});

test("observation ownership migration rejects concurrent owner takeover at the database boundary", async () => {
  const sql = await readFile(
    path.join(root, "migrations", "observations", "0064_observation_owner_immutability.sql"),
    "utf8",
  );
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, note TEXT);
    CREATE TABLE place_memory_entries (entry_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, private_note TEXT);
    INSERT INTO observations VALUES ('obs-1', 'owner-1', 'original');
    INSERT INTO place_memory_entries VALUES ('pm-1', 'owner-1', 'private');
  `);
  db.exec(sql);
  assert.throws(() => db.exec("UPDATE observations SET owner_user_id='attacker', note='taken' WHERE observation_id='obs-1'"), /observation_owner_immutable/);
  assert.throws(() => db.exec("UPDATE place_memory_entries SET user_id='attacker', private_note='taken' WHERE entry_id='pm-1'"), /place_memory_owner_immutable/);
  db.exec("UPDATE observations SET owner_user_id='owner-1', note='edited' WHERE observation_id='obs-1'");
  assert.equal(db.prepare("SELECT owner_user_id FROM observations WHERE observation_id='obs-1'").get()?.owner_user_id, "owner-1");
  assert.equal(db.prepare("SELECT user_id FROM place_memory_entries WHERE entry_id='pm-1'").get()?.user_id, "owner-1");
  db.close();
});
