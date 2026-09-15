#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const registryPath = resolve("docs/frontend-foundation/SOURCE_REGISTRY.json");
const reportPath = resolve("docs/frontend-foundation/frontend-scout.latest.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const checkedAt = new Date().toISOString();

const results = [];
for (const source of registry.sources) {
  const result = { id: source.id, name: source.name, status: source.status, url: source.url };
  try {
    const response = await fetch(source.url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "IKIMON-Frontend-Scout/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    result.http_status = response.status;
    result.ok = response.ok;
    result.final_url = response.url;
    result.etag = response.headers.get("etag");
    result.last_modified = response.headers.get("last-modified");
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : String(error);
  }
  results.push(result);
}

const report = {
  schema_version: "ikimon.frontend-scout-report.v1",
  checked_at: checkedAt,
  auto_adopted: false,
  summary: {
    total: results.length,
    reachable: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
  },
  results,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary));
