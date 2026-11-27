import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("scheduled event quests skip open-ended sessions older than one day", () => {
  const index = readFileSync(path.join(process.cwd(), "src", "index.ts"), "utf8").replace(/\r\n/g, "\n");
  const start = index.indexOf("async function runScheduledObservationEventQuests");
  const body = index.slice(start, index.indexOf("LIMIT 50", start));
  assert.ok(start > 0);
  assert.match(body, /AND \(ended_at IS NOT NULL OR julianday\(started_at\) > julianday\('now', '-1 day'\)\)/);
});
