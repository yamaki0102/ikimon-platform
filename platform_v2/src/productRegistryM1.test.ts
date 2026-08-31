import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadProductRegistryNavigation } from "./productRegistryNavigation.js";

const navigation = loadProductRegistryNavigation();
const m1 = navigation.implementation_tasks.find((task) => task.id === "task.zukan.m1.record-media-integrity");

test("M1 reuses the existing Record/media integrity implementation boundary", () => {
  assert.ok(m1);
  assert.deepEqual(m1.source_locators, [
    "platform_v2/src/services/observationWrite.ts",
    "platform_v2/src/services/observationPhotoUpload.ts",
    "platform_v2/src/routes/write.ts",
  ]);
  assert.deepEqual(m1.negative_eval_ids, [
    "prop.capture.same-intent-one-record",
    "prop.capture.partial-failure-recoverable",
    "prop.media.exif-gps-not-public",
  ]);
});

test("M1 source contract keeps replay, conflict, draft and metadata boundaries explicit", () => {
  const write = readFileSync(new URL("./services/observationWrite.ts", import.meta.url), "utf8");
  const photo = readFileSync(new URL("./services/observationPhotoUpload.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("./routes/write.ts", import.meta.url), "utf8");
  assert.match(write, /observation_write_idempotency/);
  assert.match(write, /requestFingerprint/);
  assert.match(write, /client_submission_id_conflict/);
  assert.match(write, /duplicate_count = duplicate_count \+ 1/);
  assert.match(photo, /normalizeObservationImage/);
  assert.match(photo, /metadata\.exif/);
  assert.match(photo, /on conflict \(legacy_asset_key\)/);
  assert.match(route, /\/api\/v1\/observations\/upsert/);
});
