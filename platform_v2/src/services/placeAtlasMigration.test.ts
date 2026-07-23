import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationSql = readFileSync(
  new URL("../../cloudflare_shadow/migrations/observations/0068_universal_place_atlas.sql", import.meta.url),
  "utf8",
);

const forwardRollbackSql = readFileSync(
  new URL("../../../ops/deploy/forward_rollback/0068_disable_universal_place_atlas.sql", import.meta.url),
  "utf8",
);

function priorSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE place_memory_entries (
      entry_id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL UNIQUE,
      occurrence_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      cell_id TEXT NOT NULL,
      cell_grid_m INTEGER NOT NULL DEFAULT 1000,
      memory_tags_json TEXT NOT NULL DEFAULT '[]',
      tags_public INTEGER NOT NULL DEFAULT 1,
      echo_note TEXT NOT NULL DEFAULT '',
      private_note TEXT NOT NULL DEFAULT '',
      photo_echo_enabled INTEGER NOT NULL DEFAULT 0,
      photo_echo_visibility TEXT NOT NULL DEFAULT 'hidden_by_user',
      moderation_status TEXT NOT NULL DEFAULT 'visible',
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
  `);
}

test("D1 migration expands a fresh compatible database and defaults rollout off", () => {
  const db = new DatabaseSync(":memory:");
  priorSchema(db);
  db.exec(migrationSql);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all().map((row) => String(row.name));
  assert.ok(tables.includes("places"));
  assert.ok(tables.includes("place_boundaries"));
  assert.ok(tables.includes("place_source_references"));
  assert.ok(tables.includes("record_place_memberships"));
  assert.ok(tables.includes("record_theme_assertions"));
  assert.ok(tables.includes("place_correction_proposals"));

  const rollout = db.prepare(
    "SELECT enabled, enabled_place_kinds_json, calculation_version FROM place_atlas_rollout_state WHERE rollout_key = ?",
  ).get("universal_place_atlas_v2") as Record<string, unknown>;
  assert.equal(rollout.enabled, 0);
  assert.equal(rollout.enabled_place_kinds_json, "[]");
  assert.equal(rollout.calculation_version, "place_membership/v1");

  const memoryColumns = db.prepare("PRAGMA table_info(place_memory_entries)").all()
    .map((row) => String(row.name));
  assert.ok(memoryColumns.includes("public_place_opt_in"));
  assert.ok(memoryColumns.includes("public_place_moderation_status"));
  assert.ok(memoryColumns.includes("public_attribution_mode"));
});

test("D1 migration preserves existing private Place Memory fail-closed", () => {
  const db = new DatabaseSync(":memory:");
  priorSchema(db);
  db.prepare(`
    INSERT INTO place_memory_entries (
      entry_id, visit_id, occurrence_id, user_id, cell_id,
      echo_note, private_note, moderation_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "memory-1",
    "record-1",
    "occurrence-1",
    "user-1",
    "34.97,138.38",
    "public-looking echo",
    "owner private note",
    "visible",
  );
  db.exec(migrationSql);

  const memory = db.prepare(`
    SELECT private_note, public_place_opt_in, public_place_moderation_status,
           public_attribution_mode
    FROM place_memory_entries
    WHERE entry_id = ?
  `).get("memory-1") as Record<string, unknown>;
  assert.equal(memory.private_note, "owner private note");
  assert.equal(memory.public_place_opt_in, 0);
  assert.equal(memory.public_place_moderation_status, "not_submitted");
  assert.equal(memory.public_attribution_mode, "anonymous");
});

test("forward rollback disables v2 without deleting schema or memberships", () => {
  const db = new DatabaseSync(":memory:");
  priorSchema(db);
  db.exec(migrationSql);
  db.exec(`
    UPDATE place_atlas_rollout_state
    SET enabled = 1, enabled_place_kinds_json = '["park","theme_park"]'
    WHERE rollout_key = 'universal_place_atlas_v2';
    INSERT INTO places (
      place_id, canonical_name, canonical_name_normalized, place_kind
    ) VALUES ('place-1', 'Example', 'example', 'park');
    INSERT INTO record_place_memberships (
      membership_id, record_id, place_id, membership_type,
      membership_state, derivation_source, calculation_version
    ) VALUES (
      'membership-1', 'record-1', 'place-1', 'inside',
      'confirmed', 'geometry', 'place_membership/v1'
    );
  `);
  db.exec(forwardRollbackSql);

  const rollout = db.prepare(
    "SELECT enabled, enabled_place_kinds_json FROM place_atlas_rollout_state WHERE rollout_key = ?",
  ).get("universal_place_atlas_v2") as Record<string, unknown>;
  assert.equal(rollout.enabled, 0);
  assert.equal(rollout.enabled_place_kinds_json, "[]");
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM record_place_memberships").get() as Record<string, unknown>).count,
    1,
  );
});
