import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("observation event live endpoint is snapshot-only and does not hold a PostgreSQL listener", () => {
  const apiSource = readFileSync(path.join(process.cwd(), "src", "routes", "observationEventApi.ts"), "utf8");
  const liveSource = readFileSync(path.join(process.cwd(), "src", "services", "observationEventLive.ts"), "utf8");

  assert.match(apiSource, /X-Ikimon-Observation-Event-Live-Mode": "snapshot-only"/);
  assert.match(apiSource, /writeSse\(reply, "snapshot"/);
  assert.match(apiSource, /reply\.raw\.end\(\)/);
  assert.doesNotMatch(apiSource, /subscribeToSession|setInterval|heartbeat|onClose/);
  assert.doesNotMatch(liveSource, /LISTEN|UNLISTEN|notification|obs_evt_|PoolClient/);
});
