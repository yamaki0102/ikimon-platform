import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { createIkimonDbMcpServer } from "./index.js";

const sourceUrl = new URL("../src/index.ts", import.meta.url);

test("creates a fresh MCP SDK v2 server for each stdio connection", () => {
  const pool = {} as Pool;
  const first = createIkimonDbMcpServer(pool, "invasive-law");
  const second = createIkimonDbMcpServer(pool, "invasive-law");
  assert.notEqual(first, second);
});

test("reserves stdout for the protocol and serves through the v2 factory", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /serveStdio\(\(\) => createIkimonDbMcpServer/);
  assert.doesNotMatch(source, /console\.log\(/);
  assert.match(source, /console\.error\(/);
  assert.doesNotMatch(source, /@modelcontextprotocol\/sdk/);
});

test("keeps write tools bounded by proposal and explicit run-status contracts", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /This tool never applies the proposal to the database/);
  assert.match(source, /explicit direct-write permission/);
  assert.match(source, /runId: z\.uuid\(\)/);
  assert.match(source, /contentSha256: z\.string\(\)\.regex/);
});
