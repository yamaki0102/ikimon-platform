import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsUrl = new URL("../migrations/observations/", import.meta.url);
const baselineSql = await readFile(new URL("0071_observation_event_guest_media.sql", migrationsUrl), "utf8");
const migrationSql = await readFile(new URL("0073_observation_event_guest_media_video.sql", migrationsUrl), "utf8");
const imageOnlySql = baselineSql.replace(", 'video/mp4', 'video/webm'", "");
const tableName = "observation_event_guest_media";

function database(schema = imageOnlySql): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schema);
  return db;
}

// D1's registered migration runner owns the transaction. Model the same atomic
// boundary in real SQLite, including a failure after the table has been rebuilt.
function migrate(db: DatabaseSync, sql = migrationSql): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function rows(db: DatabaseSync) {
  return db.prepare(`SELECT rowid, * FROM ${tableName} ORDER BY rowid`).all();
}

function schemaObjects(db: DatabaseSync) {
  return db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name").all();
}

function seedPhotoReceipts(db: DatabaseSync): void {
  const insert = db.prepare(`INSERT INTO ${tableName} (
    rowid, submission_id, session_id, participant_id, actor_user_id, asset_key,
    request_sha256, media_sha256, mime, bytes, media_state, idempotency_key,
    private_storage_consent_at, creator_rights_attested_at, rights_review_status,
    rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility,
    private_delete_pending, active_upload_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const receipts = [
    ["pending", "uploading", "image/jpeg"],
    ["approved", "saved", "image/png"],
    ["rejected", "failed", "image/webp"],
    ["withdrawn", "saved", "image/jpeg"],
  ] as const;
  for (const [index, [rightsStatus, mediaState, mime]] of receipts.entries()) {
    insert.run(
      11 + index * 7, `receipt-${index}`, "session-existing", `participant-${index}`,
      index === 0 ? null : `actor-${index}`, `private/receipt-${index}.bin`,
      `request-digest-${index}`, `media-digest-${index}`, mime, index === 1 ? 12582912 : 100 + index,
      mediaState, "same-key-different-participant", "2026-09-27T02:03:04.000Z", "2026-09-27T02:03:05.000Z",
      rightsStatus, index === 0 ? null : "reviewer-existing", index === 0 ? null : "2026-09-28T03:04:05.000Z",
      index === 0 ? null : index === 1 ? "" : "権利確認：公開せず、撤回状態を保持", "private",
      index === 3 ? 1 : 0, index === 0 ? 2 : 0, "2026-09-27T02:03:06.000Z", `2026-09-2${7 + index}T04:05:06.000Z`,
    );
  }
}

let submissionSequence = 0;
function insertReceipt(db: DatabaseSync, overrides: Record<string, string | number | null> = {}): void {
  submissionSequence += 1;
  const values = {
    submission_id: `new-receipt-${submissionSequence}`,
    session_id: "session-new",
    participant_id: "participant-new",
    asset_key: `private/new-receipt-${submissionSequence}.bin`,
    request_sha256: "request-digest",
    media_sha256: "media-digest",
    mime: "image/jpeg",
    bytes: 1024,
    idempotency_key: `new-idempotency-${submissionSequence}`,
    private_storage_consent_at: "2026-10-06T12:00:00.000Z",
    creator_rights_attested_at: "2026-10-06T12:00:01.000Z",
    ...overrides,
  };
  const columns = Object.keys(values);
  db.prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...Object.values(values));
}

function indexKeys(db: DatabaseSync, name: string) {
  return db.prepare('SELECT seqno, name, "desc", coll FROM pragma_index_xinfo(?) WHERE "key" = 1 ORDER BY seqno')
    .all(name).map((row) => ({ ...row }));
}

test("0073 has a unique prefix and leaves its transaction to the D1 runner", async () => {
  const names = await readdir(migrationsUrl);
  assert.deepEqual(names.filter((name) => name.startsWith("0073_")), ["0073_observation_event_guest_media_video.sql"]);
  const statements = migrationSql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(statements, /\b(BEGIN|COMMIT|ROLLBACK)\b/i);
  assert.doesNotMatch(statements, /PRAGMA\s+(?:defer_foreign_keys|foreign_keys)\s*=/i);
});

test("old image-only schema preserves every receipt value and accepts private MP4/WebM", () => {
  const db = database();
  try {
    seedPhotoReceipts(db);
    const before = rows(db);
    assert.throws(() => insertReceipt(db, { mime: "video/mp4" }), /CHECK constraint failed/);
    migrate(db);
    assert.deepEqual(rows(db), before);
    insertReceipt(db, { mime: "video/mp4" });
    insertReceipt(db, { mime: "video/webm" });
    assert.deepEqual(
      db.prepare(`SELECT mime, visibility, rights_review_status, media_state, private_delete_pending, active_upload_count
        FROM ${tableName} WHERE mime LIKE 'video/%' ORDER BY mime`).all().map((row) => ({ ...row })),
      ["video/mp4", "video/webm"].map((mime) => ({
        mime, visibility: "private", rights_review_status: "pending", media_state: "uploading",
        private_delete_pending: 0, active_upload_count: 0,
      })),
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE '%video_0073%'").get()?.n, 0);
  } finally {
    db.close();
  }
});

test("fresh 0071 schema and a repeated 0073 preserve existing photos, videos, and indexes", () => {
  const db = database(baselineSql);
  try {
    seedPhotoReceipts(db);
    insertReceipt(db, { mime: "video/mp4", rights_review_status: "withdrawn", private_delete_pending: 1 });
    insertReceipt(db, { mime: "video/webm", media_state: "failed" });
    const before = rows(db);
    migrate(db);
    const schemaAfterFirst = schemaObjects(db);
    migrate(db);
    assert.deepEqual(rows(db), before);
    assert.deepEqual(schemaObjects(db), schemaAfterFirst);
    assert.deepEqual(indexKeys(db, "idx_obs_event_guest_media_participant"), [
      { seqno: 0, name: "session_id", desc: 0, coll: "BINARY" },
      { seqno: 1, name: "participant_id", desc: 0, coll: "BINARY" },
      { seqno: 2, name: "created_at", desc: 1, coll: "BINARY" },
    ]);
    assert.deepEqual(indexKeys(db, "idx_obs_event_guest_media_review"), [
      { seqno: 0, name: "session_id", desc: 0, coll: "BINARY" },
      { seqno: 1, name: "rights_review_status", desc: 0, coll: "BINARY" },
      { seqno: 2, name: "created_at", desc: 1, coll: "BINARY" },
    ]);
    assert.equal(db.prepare(`SELECT count(*) AS n FROM pragma_index_list('${tableName}') WHERE "unique" = 1`).get()?.n, 3);
  } finally {
    db.close();
  }
});

test("video repair retains privacy, rights, byte limits, upload state, and replay constraints", () => {
  const db = database();
  try {
    seedPhotoReceipts(db);
    migrate(db);
    const rejected: Record<string, string | number | null>[] = [
      { mime: "image/gif" }, { mime: "video/quicktime" }, { mime: "text/html" }, { mime: null },
      { mime: "video/mp4", visibility: "public" }, { visibility: "unlisted" },
      { bytes: 0 }, { bytes: 12582913 }, { media_state: "published" },
      { rights_review_status: "unreviewed" }, { private_delete_pending: 2 }, { active_upload_count: -1 },
      { private_storage_consent_at: null }, { creator_rights_attested_at: null },
    ];
    for (const values of rejected) {
      assert.throws(() => insertReceipt(db, values), /(?:CHECK|NOT NULL) constraint failed/, JSON.stringify(values));
    }
    assert.throws(() => insertReceipt(db, { submission_id: "receipt-0" }), /UNIQUE constraint failed/);
    assert.throws(() => insertReceipt(db, { asset_key: "private/receipt-0.bin" }), /UNIQUE constraint failed/);
    assert.throws(() => insertReceipt(db, {
      session_id: "session-existing", participant_id: "participant-0", idempotency_key: "same-key-different-participant",
    }), /UNIQUE constraint failed/);
    insertReceipt(db, {
      session_id: "another-session", participant_id: "participant-0", idempotency_key: "same-key-different-participant",
      mime: "video/mp4", bytes: 12582912,
    });
    assert.equal(rows(db).length, 5);
  } finally {
    db.close();
  }
});

test("unexpected columns or constraints abort without losing stored rows or schema", () => {
  const variants = [
    imageOnlySql.replace("  actor_user_id TEXT,", "  actor_user_id TEXT,\n  extra_private_note TEXT,"),
    imageOnlySql.replace("  actor_user_id TEXT,", "  actor_user_id TEXT,\n  generated_note TEXT GENERATED ALWAYS AS (session_id) VIRTUAL,"),
    imageOnlySql.replace("CHECK (visibility = 'private')", "CHECK (visibility IN ('private', 'public'))"),
    imageOnlySql.replace("bytes > 0 AND bytes <= 12582912", "bytes > 0 AND bytes <= 25000000"),
    imageOnlySql.replace("DEFAULT 'uploading'", "DEFAULT 'saved'"),
    imageOnlySql.replace("UNIQUE (session_id, participant_id, idempotency_key)", "UNIQUE (session_id, participant_id, idempotency_key), CHECK (length(request_sha256) > 0)"),
  ];
  for (const variant of variants) {
    const db = database(variant);
    try {
      seedPhotoReceipts(db);
      const beforeRows = rows(db);
      const beforeSchema = schemaObjects(db);
      assert.throws(() => migrate(db), /guest_media_0073_known_schema/);
      assert.deepEqual(rows(db), beforeRows);
      assert.deepEqual(schemaObjects(db), beforeSchema);
    } finally {
      db.close();
    }
  }
});

test("inbound CASCADE foreign keys are refused before DROP even with deferred checks", () => {
  const db = database();
  try {
    seedPhotoReceipts(db);
    db.exec(`CREATE TABLE receipt_child (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL
      REFERENCES "OBSERVATION_EVENT_GUEST_MEDIA" (submission_id) ON DELETE CASCADE);
      INSERT INTO receipt_child VALUES ('keep-child', 'receipt-0');`);
    const beforeSchema = schemaObjects(db);
    const beforeRows = rows(db);
    db.exec("BEGIN; PRAGMA defer_foreign_keys = ON");
    assert.throws(() => db.exec(migrationSql), /guest_media_0073_no_inbound_foreign_keys/);
    // Inspect before rollback: a destructive DROP would have removed this child.
    assert.equal(db.prepare("SELECT submission_id FROM receipt_child WHERE id = 'keep-child'").get()?.submission_id, "receipt-0");
    assert.deepEqual(rows(db), beforeRows);
    assert.doesNotMatch(String(db.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(tableName)?.sql), /video\/mp4/);
    db.exec("ROLLBACK");
    assert.deepEqual(schemaObjects(db), beforeSchema);
  } finally {
    db.close();
  }
});

test("unknown triggers, dependent views, and extra or changed indexes are refused", () => {
  const variants = [
    ["CREATE TRIGGER receipt_update AFTER UPDATE ON observation_event_guest_media BEGIN SELECT 1; END;", /guest_media_0073_no_dependent_triggers_or_views/],
    ["CREATE VIEW private_receipts AS SELECT submission_id FROM observation_event_guest_media;", /guest_media_0073_no_dependent_triggers_or_views/],
    ["CREATE TABLE unrelated (id TEXT); CREATE TRIGGER indirect_receipt_update AFTER INSERT ON unrelated BEGIN UPDATE observation_event_guest_media SET updated_at = 'changed'; END;", /guest_media_0073_no_dependent_triggers_or_views/],
    ["CREATE INDEX extra_receipt_index ON observation_event_guest_media (updated_at);", /guest_media_0073_known_indexes/],
    ["DROP INDEX idx_obs_event_guest_media_review; CREATE INDEX idx_obs_event_guest_media_review ON observation_event_guest_media (session_id, rights_review_status, created_at ASC);", /guest_media_0073_known_indexes/],
  ] as const;
  for (const [extraSchema, error] of variants) {
    const db = database();
    try {
      seedPhotoReceipts(db);
      db.exec(extraSchema);
      const beforeRows = rows(db);
      const beforeSchema = schemaObjects(db);
      assert.throws(() => migrate(db), error);
      assert.deepEqual(rows(db), beforeRows);
      assert.deepEqual(schemaObjects(db), beforeSchema);
    } finally {
      db.close();
    }
  }
});

test("failure after the rebuild rolls back rows, original CHECK, and every index", () => {
  const db = database();
  try {
    seedPhotoReceipts(db);
    const beforeRows = rows(db);
    const beforeSchema = schemaObjects(db);
    assert.throws(() => migrate(db, `${migrationSql}\nSELECT * FROM simulated_missing_apply_receipt_table;`), /no such table/);
    assert.deepEqual(rows(db), beforeRows);
    assert.deepEqual(schemaObjects(db), beforeSchema);
    assert.throws(() => insertReceipt(db, { mime: "video/mp4" }), /CHECK constraint failed/);
    migrate(db);
    insertReceipt(db, { mime: "video/mp4" });
  } finally {
    db.close();
  }
});

test("invalid legacy data aborts copying and keeps the original receipt unchanged", () => {
  const db = database();
  try {
    seedPhotoReceipts(db);
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.exec(`UPDATE ${tableName} SET visibility = 'public' WHERE submission_id = 'receipt-0'`);
    db.exec("PRAGMA ignore_check_constraints = OFF");
    const beforeRows = rows(db);
    const beforeSchema = schemaObjects(db);
    assert.throws(() => migrate(db), /CHECK constraint failed/);
    assert.deepEqual(rows(db), beforeRows);
    assert.deepEqual(schemaObjects(db), beforeSchema);
  } finally {
    db.close();
  }
});

test("0073 requires 0071 and does not silently create a missing production table", () => {
  const db = database("");
  try {
    assert.throws(() => migrate(db), /guest_media_0073_known_schema/);
    assert.deepEqual(schemaObjects(db), []);
  } finally {
    db.close();
  }
});
