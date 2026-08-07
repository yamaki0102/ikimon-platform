import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOwnedKubiakaPrivateUploadTarget,
} from "./kubiakaPrivateUploadGuard.js";
import type { KubiakaDbQuery } from "./kubiakaFocusedExperience.js";

test("legacy private upload guard fails closed after Cloudflare cutover", async () => {
  const query = (async () => ({ rows: [] })) as KubiakaDbQuery;
  await assert.rejects(
    assertOwnedKubiakaPrivateUploadTarget(query, "visit-1", "user-1"),
    /kubiaka_cloudflare_native_required/,
  );
});
