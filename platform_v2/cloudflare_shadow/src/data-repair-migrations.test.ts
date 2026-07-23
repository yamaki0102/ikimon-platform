import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = path.resolve(process.cwd());

async function migration(group: "core" | "observations", filename: string): Promise<string> {
  return readFile(path.join(root, "migrations", group, filename), "utf8");
}

test("legacy public rights backfill is provenance-marked and cannot grant export rights", async () => {
  const sql = await migration("observations", "0062_legacy_public_observation_rights_backfill.sql");

  assert.match(sql, /INSERT OR IGNORE INTO observation_data_rights/i);
  assert.match(sql, /FROM observations AS o/i);
  assert.match(sql, /o\.visibility = 'public'/i);
  assert.match(sql, /'public_summary'/i);
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
    INSERT INTO observation_data_rights (
      visit_id, record_consent, research_use_consent, enterprise_report_consent,
      external_export_allowed, withdrawal_status, source_payload_json
    ) VALUES (
      'eligible-existing', 'private', 'none', 'none', 0, 'withdrawn', '{"source":"explicit"}'
    );
    INSERT INTO observations VALUES ('eligible-existing', 'public', 0, 'accepted');
  `);
  db.exec(sql);

  const rows = db.prepare(`
    SELECT visit_id, record_consent, research_use_consent, enterprise_report_consent,
           dataset_license, media_license, external_export_allowed, withdrawal_status,
           source_payload_json
    FROM observation_data_rights
    ORDER BY visit_id
  `).all() as Array<Record<string, unknown>>;

  assert.deepEqual(rows.map((row) => row.visit_id), ["eligible-existing", "eligible-public"]);
  const backfilled = rows.find((row) => row.visit_id === "eligible-public");
  assert.equal(backfilled?.record_consent, "public_summary");
  assert.equal(backfilled?.research_use_consent, "none");
  assert.equal(backfilled?.enterprise_report_consent, "none");
  assert.equal(backfilled?.dataset_license, null);
  assert.equal(backfilled?.media_license, null);
  assert.equal(backfilled?.external_export_allowed, 0);
  assert.equal(backfilled?.withdrawal_status, "active");
  assert.match(String(backfilled?.source_payload_json), /"inferred_export_consent":false/);

  const explicit = rows.find((row) => row.visit_id === "eligible-existing");
  assert.equal(explicit?.record_consent, "private");
  assert.equal(explicit?.withdrawal_status, "withdrawn");
  assert.equal(explicit?.source_payload_json, '{"source":"explicit"}');
  db.close();
});

test("Place Atlas legacy import rights backfill requires preexisting public visibility and grants no export rights", async () => {
  const sql = await migration("observations", "0069_place_atlas_legacy_import_public_rights.sql");

  assert.match(sql, /INSERT OR IGNORE INTO observation_data_rights/i);
  assert.match(sql, /FROM production_import_visits AS v/i);
  assert.match(sql, /v\.public_visibility = 'public'/i);
  assert.match(sql, /'public_summary'/i);
  assert.match(sql, /place_atlas_legacy_import_public_visibility_20260724/i);
  assert.match(sql, /external_export_allowed[\s\S]*0/i);
  assert.match(sql, /dataset_license[\s\S]*NULL/i);
  assert.match(sql, /media_license[\s\S]*NULL/i);
  assert.doesNotMatch(sql, /^\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/im);

  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE production_import_visits (
      visit_id TEXT PRIMARY KEY,
      public_visibility TEXT
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
    INSERT INTO production_import_visits VALUES
      ('legacy-public', 'public'),
      ('legacy-private', 'private'),
      ('explicit-withdrawn', 'public');
    INSERT INTO observation_data_rights (
      visit_id, record_consent, withdrawal_status, source_payload_json
    ) VALUES (
      'explicit-withdrawn', 'private', 'withdrawn', '{"source":"explicit"}'
    );
  `);
  db.exec(sql);

  const rows = db.prepare(`
    SELECT visit_id, record_consent, research_use_consent,
           enterprise_report_consent, dataset_license, media_license,
           external_export_allowed, withdrawal_status, source_payload_json
      FROM observation_data_rights
     ORDER BY visit_id
  `).all() as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((row) => row.visit_id), ["explicit-withdrawn", "legacy-public"]);
  const publicRow = rows.find((row) => row.visit_id === "legacy-public");
  assert.equal(publicRow?.record_consent, "public_summary");
  assert.equal(publicRow?.research_use_consent, "none");
  assert.equal(publicRow?.enterprise_report_consent, "none");
  assert.equal(publicRow?.dataset_license, null);
  assert.equal(publicRow?.media_license, null);
  assert.equal(publicRow?.external_export_allowed, 0);
  assert.equal(publicRow?.withdrawal_status, "active");
  assert.match(String(publicRow?.source_payload_json), /"inferred_export_consent":false/);
  const explicit = rows.find((row) => row.visit_id === "explicit-withdrawn");
  assert.equal(explicit?.record_consent, "private");
  assert.equal(explicit?.withdrawal_status, "withdrawn");
  assert.equal(explicit?.source_payload_json, '{"source":"explicit"}');
  db.close();
});

test("auth lifecycle repair only fills missing timestamps and removes expired sessions", async () => {
  const sql = await migration("core", "0008_auth_lifecycle_integrity.sql");

  assert.match(sql, /UPDATE auth_users/i);
  assert.match(sql, /created_at\s*=\s*COALESCE\(created_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.match(sql, /updated_at\s*=\s*COALESCE\(updated_at,\s*created_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.match(sql, /WHERE created_at IS NULL OR updated_at IS NULL/i);
  assert.match(sql, /DELETE FROM auth_sessions/i);
  assert.doesNotMatch(sql, /DELETE FROM auth_users/i);

  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE auth_users (user_id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT);
    CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
    INSERT INTO auth_users VALUES
      ('missing-both', NULL, NULL),
      ('missing-updated', '2020-01-02 03:04:05', NULL),
      ('existing', '2021-01-02 03:04:05', '2021-02-03 04:05:06');
    INSERT INTO auth_sessions VALUES
      ('expired-offset-hour', '2000-07-25 04:28:16.8+09'),
      ('expired-offset-minute', '2000-07-25T04:28:16.800+09:00'),
      ('expired-z', '2000-07-25T04:28:16.800Z'),
      ('future-offset-hour', '2999-07-25 04:28:16.8+09'),
      ('future-z', '2999-07-25T04:28:16.800Z');
  `);
  db.exec(sql);

  const sessions = db.prepare("SELECT token_hash FROM auth_sessions ORDER BY token_hash").all()
    .map((row) => String(row.token_hash));
  assert.deepEqual(sessions, ["future-offset-hour", "future-z"]);

  const missingBoth = db.prepare("SELECT created_at, updated_at FROM auth_users WHERE user_id = 'missing-both'").get();
  assert.ok(missingBoth?.created_at);
  assert.ok(missingBoth?.updated_at);
  const missingUpdated = db.prepare("SELECT created_at, updated_at FROM auth_users WHERE user_id = 'missing-updated'").get();
  assert.equal(missingUpdated?.created_at, "2020-01-02 03:04:05");
  assert.equal(missingUpdated?.updated_at, "2020-01-02 03:04:05");
  const existing = db.prepare("SELECT created_at, updated_at FROM auth_users WHERE user_id = 'existing'").get();
  assert.equal(existing?.created_at, "2021-01-02 03:04:05");
  assert.equal(existing?.updated_at, "2021-02-03 04:05:06");
  db.close();
});

test("place memory report migration deduplicates only the same reporter signal", async () => {
  const sql = await migration("observations", "0063_place_memory_report_uniqueness.sql");
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE place_memory_reports (
      report_id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason_code TEXT NOT NULL DEFAULT 'other'
    );
    INSERT INTO place_memory_reports VALUES
      ('report-1', 'entry-1', 'user-1', 'privacy'),
      ('report-2', 'entry-1', 'user-1', 'other'),
      ('report-3', 'entry-1', 'user-2', 'privacy'),
      ('report-4', 'entry-2', 'user-1', 'privacy');
  `);
  db.exec(sql);

  const rows = db.prepare("SELECT report_id, entry_id, user_id FROM place_memory_reports ORDER BY report_id").all()
    .map((row) => ({
      report_id: String(row.report_id),
      entry_id: String(row.entry_id),
      user_id: String(row.user_id),
    }));
  assert.deepEqual(rows, [
    { report_id: "report-1", entry_id: "entry-1", user_id: "user-1" },
    { report_id: "report-3", entry_id: "entry-1", user_id: "user-2" },
    { report_id: "report-4", entry_id: "entry-2", user_id: "user-1" },
  ]);
  assert.throws(
    () => db.exec("INSERT INTO place_memory_reports VALUES ('report-5', 'entry-1', 'user-1', 'other')"),
    /UNIQUE constraint failed/i,
  );
  db.close();
});

test("ownership migration rejects owner takeover including NULL transitions", async () => {
  const sql = await migration("observations", "0064_observation_owner_immutability.sql");
  assert.match(sql, /OLD\.owner_user_id IS NOT NEW\.owner_user_id/i);
  assert.match(sql, /OLD\.user_id IS NOT NEW\.user_id/i);
  assert.doesNotMatch(sql, /OLD\.(?:owner_user_id|user_id)\s*<>/i);

  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, note TEXT);
    CREATE TABLE place_memory_entries (entry_id TEXT PRIMARY KEY, user_id TEXT, private_note TEXT);
    INSERT INTO observations VALUES ('obs-1', 'owner-1', 'original');
    INSERT INTO observations VALUES ('obs-null', NULL, 'legacy');
    INSERT INTO place_memory_entries VALUES ('pm-1', 'owner-1', 'private');
    INSERT INTO place_memory_entries VALUES ('pm-null', NULL, 'legacy');
  `);
  db.exec(sql);

  assert.throws(
    () => db.exec("UPDATE observations SET owner_user_id='attacker', note='taken' WHERE observation_id='obs-1'"),
    /observation_owner_immutable/,
  );
  assert.throws(
    () => db.exec("UPDATE place_memory_entries SET user_id='attacker', private_note='taken' WHERE entry_id='pm-1'"),
    /place_memory_owner_immutable/,
  );
  assert.throws(
    () => db.exec("UPDATE observations SET owner_user_id='owner-2' WHERE observation_id='obs-null'"),
    /observation_owner_immutable/,
  );
  assert.throws(
    () => db.exec("UPDATE place_memory_entries SET user_id='owner-2' WHERE entry_id='pm-null'"),
    /place_memory_owner_immutable/,
  );

  db.exec("UPDATE observations SET owner_user_id='owner-1', note='edited' WHERE observation_id='obs-1'");
  db.exec("UPDATE place_memory_entries SET user_id='owner-1', private_note='edited' WHERE entry_id='pm-1'");
  assert.equal(db.prepare("SELECT note FROM observations WHERE observation_id='obs-1'").get()?.note, "edited");
  assert.equal(db.prepare("SELECT private_note FROM place_memory_entries WHERE entry_id='pm-1'").get()?.private_note, "edited");
  db.close();
});
