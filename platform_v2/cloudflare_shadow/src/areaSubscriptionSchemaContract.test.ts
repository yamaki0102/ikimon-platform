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
