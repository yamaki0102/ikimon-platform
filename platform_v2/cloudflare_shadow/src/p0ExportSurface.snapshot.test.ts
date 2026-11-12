import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

const snapshotUrl = new URL("./__snapshots__/export-surface.json", import.meta.url);

test("index export surface is unchanged", async () => {
  const keys = Object.keys(await import("./index")).sort();
  if (process.env.P0_SNAPSHOT_WRITE === "1") writeFileSync(snapshotUrl, `${JSON.stringify(keys)}\n`);
  assert.deepEqual(keys, JSON.parse(readFileSync(snapshotUrl, "utf8")));
});
