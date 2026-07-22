import assert from "node:assert/strict";
import test from "node:test";
import { compileBackfillMutation } from "./build-record-observation-backfill.mts";

test("SQL compiler escapes text and preserves typed literals", () => {
  const sql = compileBackfillMutation("INSERT INTO t(a,b,c) VALUES (?,?,?)", ["owner's note", 3, null]);
  assert.equal(sql, "INSERT INTO t(a,b,c) VALUES ('owner''s note',3,NULL);");
});

test("SQL compiler rejects placeholder/value drift", () => {
  assert.throws(() => compileBackfillMutation("SELECT ?", ["a", "b"]), /placeholder_overflow/);
  assert.throws(() => compileBackfillMutation("SELECT ?, ?", ["a"]), /placeholder_underflow/);
});
