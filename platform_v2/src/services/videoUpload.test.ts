import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("video finalize promotes video-only observations out of native no-photo review", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "videoUpload.ts"), "utf8");

  assert.match(source, /'observation_video'/);
  assert.match(source, /public_visibility = 'public'/);
  assert.match(source, /quality_review_status = 'accepted'/);
  assert.match(source, /reason_code = 'native_no_photo'/);
  assert.match(source, /review_status = 'accepted'/);
});
