import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("photo upload route returns the shared ok contract on success", () => {
  const source = readFileSync(path.join(process.cwd(), "src/routes/write.ts"), "utf8");

  assert.match(source, /const result = await uploadObservationPhoto\(/);
  assert.match(source, /return \{\s+ok: true,\s+\.\.\.result,\s+\};/);
  assert.match(source, /return \{\s+ok: false,\s+error:/);
});
