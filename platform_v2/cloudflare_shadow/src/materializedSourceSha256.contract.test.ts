import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workerSource = await readFile(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

test("versioned materialized HTML exposes the manifest-bound source SHA", () => {
  assert.ok(workerSource.includes("type MaterializedR2ObjectBody = R2ObjectBody & { materializedSourceSha256?: string }"));
  assert.match(workerSource, /readMaterializedManifestSha256[\s\S]*manifest\.json/u);
  assert.match(workerSource, /payload\.items\?\.find\(\(entry\) => String\(entry\?\.key/u);
  assert.match(workerSource, /x-ikimon-cloudflare-materialized-sha256/u);
});
