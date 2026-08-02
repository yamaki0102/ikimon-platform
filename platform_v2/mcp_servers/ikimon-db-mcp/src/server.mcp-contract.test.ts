import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MCP_RETIREMENT_POLICY, startStdioMcp } from "./server.js";

test("retired DB MCP path cannot be activated in place", async () => {
  assert.deepEqual(MCP_RETIREMENT_POLICY, {
    implementationStatus: "retired",
    activeTransport: false,
    revival: "fresh_architecture_review_required",
    inPlaceMigration: "forbidden",
    legacyLane: "forbidden",
    stateBoundary: "none",
  });

  await assert.rejects(startStdioMcp());

  const source = await readFile(new URL("./server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']@modelcontextprotocol\//);
  assert.doesNotMatch(source, /require\(["']@modelcontextprotocol\//);
});
