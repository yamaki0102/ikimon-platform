#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const foundationRoot = resolve(repoRoot, "docs/frontend-foundation");
const registryPath = resolve(foundationRoot, "SOURCE_REGISTRY.json");
const baselinePath = resolve(foundationRoot, "frontend-scout.baseline.json");
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 && args[outIndex + 1] ? resolve(args[outIndex + 1]) : null;
const updateBaseline = args.includes("--update-baseline");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
let baseline = { sources: [] };
try { baseline = JSON.parse(await readFile(baselinePath, "utf8")); } catch {}
const baselineById = new Map((baseline.sources ?? []).map((item) => [item.id, item]));

async function sampleHash(response, maxBytes = 262144) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  let seen = 0;
  while (seen < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - seen;
    const chunk = value.byteLength <= remaining ? value : value.subarray(0, remaining);
    hash.update(chunk);
    seen += chunk.byteLength;
    if (chunk.byteLength < value.byteLength) break;
  }
  await reader.cancel().catch(() => {});
  return `${seen}:${hash.digest("hex")}`;
}

const checkedAt = new Date().toISOString();
const results = [];
for (const source of registry.sources) {
  const result = { id: source.id, name: source.name, status: source.status, url: source.url };
  try {
    const response = await fetch(source.watch_url ?? source.url, {
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
    result.sample_hash = source.watch_mode === "sample_hash" ? await sampleHash(response) : null;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : String(error);
  }
  const previous = baselineById.get(source.id);
  const changedSignals = [];
  if (previous) {
    if (previous.ok && !result.ok) changedSignals.push("availability_lost");
    if (previous.final_url && result.final_url && previous.final_url !== result.final_url) changedSignals.push("redirect_changed");
    if (previous.etag && result.etag && previous.etag !== result.etag) changedSignals.push("etag_changed");
    if (previous.last_modified && result.last_modified && previous.last_modified !== result.last_modified) changedSignals.push("last_modified_changed");
    if (previous.sample_hash && result.sample_hash && previous.sample_hash !== result.sample_hash) changedSignals.push("sample_hash_changed");
  }
  result.changed_signals = [...new Set(changedSignals)];
  results.push(result);
}

const candidates = results.flatMap((result) => {
  if (result.changed_signals.includes("availability_lost")) {
    return [{ source_id: result.id, priority: "P1", reason: "approved_source_unreachable" }];
  }
  if (result.changed_signals.length) {
    return [{ source_id: result.id, priority: "P2", reason: "upstream_change_signal", signals: result.changed_signals }];
  }
  return [];
});

const report = {
  schema_version: "ikimon.frontend-scout-report.v2",
  checked_at: checkedAt,
  auto_adopted: false,
  summary: {
    total: results.length,
    reachable: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    candidates: candidates.length,
  },
  candidates,
  results,
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) await writeFile(outPath, json, "utf8");
if (updateBaseline) {
  const nextBaseline = {
    schema_version: "ikimon.frontend-scout-baseline.v1",
    accepted_at: checkedAt,
    sources: results.map(({ id, ok, final_url, etag, last_modified, sample_hash }) => ({
      id, ok, final_url, etag, last_modified, sample_hash,
    })),
  };
  await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
}
console.log(json.trim());
