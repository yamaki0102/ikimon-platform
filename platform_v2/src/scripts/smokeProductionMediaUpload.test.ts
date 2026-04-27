import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("production media smoke verifies duplicate post guard", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "smokeProductionMediaUpload.ts"), "utf8");

  assert.match(source, /verifyDuplicateGuard/);
  assert.match(source, /clientSubmissionId/);
  assert.match(source, /duplicate_upsert_created_new_visit/);
  assert.match(source, /duplicate_media_visit_detected/);
  assert.match(source, /observation_write_idempotency/);
});
