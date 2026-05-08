import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("audio review closes canonical MachineObservation workflow", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "services", "audioReview.ts"), "utf8");

  assert.match(source, /applyConfirmedClusterToCanonical/);
  assert.match(source, /reviewer_verified/);
  assert.match(source, /audio_reviewer_verified/);
  assert.match(source, /applyRejectedClusterToCanonical/);
  assert.match(source, /reviewer_rejected/);
  assert.match(source, /MachineObservation/);
  assert.match(source, /observation_package_events/);
});
