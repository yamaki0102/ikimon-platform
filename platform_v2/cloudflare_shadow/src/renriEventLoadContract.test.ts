import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../scripts/run-renri-event-load-check.mjs", import.meta.url);

test("Renri staging load check is fail-closed and covers the event capacity contract", async () => {
  const source = await readFile(scriptUrl, "utf8");

  assert.match(source, /hostname === "ikimon\.life"[\s\S]*production_target_forbidden/);
  assert.match(source, /"staging\.zukan\.earth"/);
  assert.match(source, /"staging\.ikimon\.life"/);
  assert.match(source, /staging_target_required/);
  assert.match(source, /execute_requires_600_seconds/);
  assert.match(source, /renri-e2e-load-/);
  assert.match(source, /participantSessions: 20/);
  assert.match(source, /liveViewers: 20/);
  assert.match(source, /photoPosts: 40/);
  assert.match(source, /Promise\.all\(participants\.map/);
  assert.match(source, /new Set\(checkins\)\.size !== 20/);
  assert.match(source, /clientSubmissionId/);
  assert.match(source, /photos\/upload/);
  assert.match(source, /observationCount !== 40/);
  assert.match(source, /inventory\(prefix, "cleanup"/);
  assert.match(source, /result\.ok = Boolean\(result\.ok && result\.cleanupZero\)/);
  assert.doesNotMatch(source, /\.catch\(\(\) => undefined\)/);
});
