import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../migrations/core/0018_user_area_subscriptions.sql", import.meta.url),
  "utf8",
);

test("area subscription migration matches the Worker contract", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(migration);

    const columns = database.prepare(
      "PRAGMA table_info(user_area_subscriptions)",
    ).all() as Array<{ name: string }>;
    assert.deepEqual(
      columns.map((column) => column.name),
      [
        "subscription_id",
        "user_id",
        "target_type",
        "target_id",
        "label",
        "href",
        "is_active",
        "created_at",
        "updated_at",
      ],
    );

    const indexes = database.prepare(
      "PRAGMA index_list(user_area_subscriptions)",
    ).all() as Array<{ name: string }>;
    assert.ok(indexes.some((index) => index.name === "idx_user_area_subscriptions_user"));

    const statsColumns = database.prepare(
      "PRAGMA table_info(user_area_subscription_stats)",
    ).all() as Array<{ name: string }>;
    assert.deepEqual(
      statsColumns.map((column) => column.name),
      [
        "user_id",
        "target_type",
        "target_id",
        "observation_count",
        "needs_id_count",
        "updated_at",
      ],
    );

    database.prepare(
      `INSERT INTO user_area_subscriptions
         (subscription_id, user_id, target_type, target_id, label, href)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("area-sub-1", "user-1", "field", "field-1", "Field 1", "/fields/field-1");

    database.prepare(
      `INSERT INTO user_area_subscriptions
         (subscription_id, user_id, target_type, target_id, label, href)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, target_type, target_id)
       DO UPDATE SET label = excluded.label,
                     href = excluded.href,
                     is_active = 1,
                     updated_at = CURRENT_TIMESTAMP`,
    ).run("area-sub-2", "user-1", "field", "field-1", "Updated", "/fields/field-1");

    const upserted = database.prepare(
      "SELECT subscription_id, label, is_active FROM user_area_subscriptions WHERE user_id = ? AND target_type = ? AND target_id = ?",
    ).get("user-1", "field", "field-1") as { subscription_id: string; label: string; is_active: number };
    assert.deepEqual({ ...upserted }, {
      subscription_id: "area-sub-1",
      label: "Updated",
      is_active: 1,
    });

    database.prepare(
      `INSERT INTO user_area_subscription_stats
         (user_id, target_type, target_id, observation_count, needs_id_count)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("user-1", "field", "field-1", 3, 1);

    const joined = database.prepare(
      `SELECT s.subscription_id, COALESCE(st.observation_count, 0) AS observation_count,
              COALESCE(st.needs_id_count, 0) AS needs_id_count
         FROM user_area_subscriptions s
         LEFT JOIN user_area_subscription_stats st
           ON st.user_id = s.user_id AND st.target_type = s.target_type AND st.target_id = s.target_id
        WHERE s.user_id = ? AND s.is_active = 1`,
    ).get("user-1") as { subscription_id: string; observation_count: number; needs_id_count: number };
    assert.deepEqual({ ...joined }, {
      subscription_id: "area-sub-1",
      observation_count: 3,
      needs_id_count: 1,
    });

    assert.throws(
      () => database.prepare(
        `INSERT INTO user_area_subscriptions
           (subscription_id, user_id, target_type, target_id)
         VALUES (?, ?, ?, ?)`,
      ).run("area-sub-invalid-type", "user-1", "taxon", "taxon-1"),
      /CHECK constraint failed/,
    );

    database.prepare(
      `INSERT INTO user_area_subscriptions
         (subscription_id, user_id, target_type, target_id, is_active)
       VALUES (?, ?, ?, ?, 0)`,
    ).run("area-sub-3", "user-1", "region", "region-1");

    assert.throws(
      () => database.prepare(
        `INSERT INTO user_area_subscriptions
           (subscription_id, user_id, target_type, target_id)
         VALUES (?, ?, ?, ?)`,
      ).run("area-sub-4", "user-1", "region", "region-1"),
      /UNIQUE constraint failed/,
    );
  } finally {
    database.close();
  }
});

test("area subscription migration remains compatible with the pre-existing production table shape", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      CREATE TABLE user_area_subscriptions (
        subscription_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        href TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE UNIQUE INDEX idx_user_area_subscriptions_target
        ON user_area_subscriptions(user_id, target_type, target_id);
      CREATE INDEX idx_user_area_subscriptions_user_active
        ON user_area_subscriptions(user_id, is_active, updated_at DESC);
      CREATE TABLE user_area_subscription_stats (
        user_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        observation_count INTEGER NOT NULL DEFAULT 0,
        needs_id_count INTEGER NOT NULL DEFAULT 0,
        refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, target_type, target_id)
      );
    `);

    assert.doesNotThrow(() => database.exec(migration));

    database.prepare(
      `INSERT INTO user_area_subscriptions
         (subscription_id, user_id, target_type, target_id, label, href, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, target_type, target_id)
       DO UPDATE SET label = excluded.label,
                     href = excluded.href,
                     is_active = 1,
                     updated_at = CURRENT_TIMESTAMP`,
    ).run("prod-sub-1", "prod-user", "place", "place-1", "Place 1", "/ja/map?place=place-1");

    database.prepare(
      `INSERT INTO user_area_subscription_stats
         (user_id, target_type, target_id, observation_count, needs_id_count)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("prod-user", "place", "place-1", 4, 2);

    const joined = database.prepare(
      `SELECT s.subscription_id,
              COALESCE(st.observation_count, 0) AS observation_count,
              COALESCE(st.needs_id_count, 0) AS needs_id_count
         FROM user_area_subscriptions s
         LEFT JOIN user_area_subscription_stats st
           ON st.user_id = s.user_id AND st.target_type = s.target_type AND st.target_id = s.target_id
        WHERE s.user_id = ? AND s.is_active = 1`,
    ).get("prod-user") as { subscription_id: string; observation_count: number; needs_id_count: number };

    assert.deepEqual({ ...joined }, {
      subscription_id: "prod-sub-1",
      observation_count: 4,
      needs_id_count: 2,
    });
  } finally {
    database.close();
  }
});
