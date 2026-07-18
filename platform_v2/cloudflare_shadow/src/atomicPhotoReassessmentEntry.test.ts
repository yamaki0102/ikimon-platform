import assert from "node:assert/strict";
import test from "node:test";
import { createAtomicPhotoReassessmentDatabase } from "./atomicPhotoReassessmentEntry.js";

type RecordedStatement = {
  sql: string;
  values: unknown[];
};

class FakeStatement {
  constructor(
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): FakeStatement {
    return new FakeStatement(this.sql, values);
  }

  async first<T>(): Promise<T | null> {
    return null;
  }

  async run(): Promise<unknown> {
    return {};
  }

  async all<T>(): Promise<unknown> {
    return { results: [] as T[] };
  }

  async raw<T>(): Promise<T[]> {
    return [];
  }
}

class FakeDatabase {
  readonly batches: RecordedStatement[][] = [];

  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql);
  }

  async batch<T>(statements: FakeStatement[]): Promise<T[]> {
    this.batches.push(statements.map((statement) => ({
      sql: statement.sql,
      values: statement.values,
    })));
    return statements.map(() => ({ success: true })) as T[];
  }
}

test("photo asset batch includes the pending reassessment intent atomically", async () => {
  const database = new FakeDatabase();
  const state = { intentAppended: false };
  const wrapped = createAtomicPhotoReassessmentDatabase(
    database as never,
    { observationId: "obs-1", ownerUserId: "owner-1" },
    state,
  );

  await wrapped.batch([
    wrapped.prepare("INSERT INTO asset_ledger (asset_id) VALUES (?)").bind("asset-1"),
    wrapped.prepare("INSERT INTO outbox (outbox_id) VALUES (?)").bind("outbox-1"),
  ]);

  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0]?.length, 3);
  const intent = database.batches[0]?.[2];
  assert.match(intent?.sql ?? "", /INSERT INTO observation_reassessment_requests/);
  assert.deepEqual(intent?.values.slice(0, 3), [
    "reassess:obs-1:standard:owner-1",
    "obs-1",
    "owner-1",
  ]);
  assert.match(String(intent?.values[3] ?? ""), /cloudflare_photo_upload_atomic_reassessment/);
  assert.equal(state.intentAppended, true);
});

test("non-photo batches are delegated without an analysis intent", async () => {
  const database = new FakeDatabase();
  const state = { intentAppended: false };
  const wrapped = createAtomicPhotoReassessmentDatabase(
    database as never,
    { observationId: "obs-1", ownerUserId: "owner-1" },
    state,
  );

  await wrapped.batch([
    wrapped.prepare("UPDATE observations SET note = ? WHERE observation_id = ?").bind("memo", "obs-1"),
  ]);

  assert.equal(database.batches[0]?.length, 1);
  assert.equal(state.intentAppended, false);
});

test("intent persistence shares the same failed D1 batch", async () => {
  const database = new FakeDatabase();
  database.batch = async () => {
    throw new Error("d1_batch_failed");
  };
  const state = { intentAppended: false };
  const wrapped = createAtomicPhotoReassessmentDatabase(
    database as never,
    { observationId: "obs-1", ownerUserId: "owner-1" },
    state,
  );

  await assert.rejects(
    wrapped.batch([wrapped.prepare("INSERT INTO asset_ledger (asset_id) VALUES (?)").bind("asset-1")]),
    /d1_batch_failed/,
  );
  assert.equal(state.intentAppended, true);
});
