import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("photo outbox dispatch overlaps independent media, read-model and AI queue sends", () => {
  const start = source.indexOf("async function dispatchOutboxBestEffort");
  const end = source.indexOf("async function sendOutbox", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /Promise\.all\(jobs\.map/);
  assert.doesNotMatch(block, /for \(const job of jobs\)/);
});

test("native capture and recovery share the normalized photo preparation contract", () => {
  assert.match(source, /PHOTO_UPLOAD_PREPARATION_SCRIPT/);
  assert.match(source, /photoPreparationVersion: "jpeg2560-v1"/);
  assert.match(source, /preparedPhotoUploads/);
});
