import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOwnedKubiakaPrivateUploadTarget,
} from "./kubiakaPrivateUploadGuard.js";
import type { KubiakaDbQuery } from "./kubiakaFocusedExperience.js";

test("private upload guard binds record, owner, hidden state and experience", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [{ visit_id: "visit-1" }] };
  }) as KubiakaDbQuery;

  await assertOwnedKubiakaPrivateUploadTarget(query, "occ:visit-1:0", "user-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /v\.user_id = \$2/);
  assert.match(calls[0]!.text, /public_visibility = 'hidden'/);
  assert.match(calls[0]!.text, /experience_key/);
  assert.deepEqual(calls[0]!.values, ["occ:visit-1:0", "user-1", "kubiaka-watch"]);
});

test("private upload guard fails closed for another owner or non-Kubiaka record", async () => {
  const query = (async () => ({ rows: [] })) as KubiakaDbQuery;
  await assert.rejects(
    assertOwnedKubiakaPrivateUploadTarget(query, "visit-other", "user-1"),
    /kubiaka_private_upload_scope_required/,
  );
});
