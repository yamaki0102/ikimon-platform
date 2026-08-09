import assert from "node:assert/strict";
import test from "node:test";
import { buildReflectionLoopManifest } from "./reflectionLoopManifest.js";

test("reflection manifest defaults to ZUKAN while retaining the runtime service id", () => {
  const manifest = buildReflectionLoopManifest("", new Date("2026-08-09T00:00:00.000Z"));

  assert.equal(manifest.origin, "https://zukan.earth");
  assert.equal(manifest.service, "ikimon.life");
  assert.deepEqual(manifest.analytics.production_hosts, [
    "zukan.earth",
    "ikimon.life",
    "www.ikimon.life",
  ]);
});
