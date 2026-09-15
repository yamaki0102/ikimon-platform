#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve("docs/frontend-foundation/frontend-scout.latest.json");
const registryPath = resolve("docs/frontend-foundation/SOURCE_REGISTRY.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
const candidates = [];

for (const result of report.results ?? []) {
  const source = sourceById.get(result.id);
  if (!source) continue;
  if (!result.ok) {
    candidates.push({ source_id: result.id, priority: "P1", reason: "approved_source_unreachable", action: "verify source URL or availability" });
  }
}

console.log(JSON.stringify({
  schema_version: "ikimon.frontend-scout-candidates.v1",
  checked_at: report.checked_at,
  candidates,
  note: "No candidate means no deterministic material signal was detected. Upstream release/content review remains bounded to material changes only."
}, null, 2));
