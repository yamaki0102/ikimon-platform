import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("legacy drift report judges the latest terminal delta sync instead of a concurrent running row", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/reportLegacyDrift.ts"), "utf8");

  assert.match(source, /function selectLatestDeltaRun\(rows: MigrationRunRow\[\]\)/);
  assert.match(source, /rows\.find\(isTerminalDeltaRun\) \?\? rows\[0\] \?\? null/);
  assert.match(source, /const latestDelta = selectLatestDeltaRun\(deltaRunsResult\.rows\)/);
});
