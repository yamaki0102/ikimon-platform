import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workerSource = await readFile(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

test("versioned materialized HTML exposes the manifest-bound source SHA", () => {
  assert.ok(workerSource.includes("const MATERIALIZED_SOURCE_SHA256 = new WeakMap<MaterializedR2ObjectBody, string>()"));
  assert.match(workerSource, /readMaterializedManifestSha256[\s\S]*manifest\.json/u);
  assert.match(workerSource, /payload\.items\?\.find\(\(entry\) => String\(entry\?\.key/u);
  assert.match(workerSource, /MATERIALIZED_SOURCE_SHA256\.set\(object, sourceSha256\)/u);
  assert.doesNotMatch(workerSource, /\{ \.\.\.object, materializedSourceSha256:/u);
  assert.match(workerSource, /x-ikimon-cloudflare-materialized-sha256/u);
});
