import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("area snapshot photos fall back to visit-level assets", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  const visitFallbackMatches = source.match(/ea\.occurrence_id = o\.occurrence_id or ea\.visit_id = o\.visit_id/g) ?? [];
  const occurrencePriorityMatches = source.match(/case when ea\.occurrence_id = o\.occurrence_id then 0 else 1 end/g) ?? [];

  assert.equal(visitFallbackMatches.length, 2);
  assert.equal(occurrencePriorityMatches.length, 2);
});
