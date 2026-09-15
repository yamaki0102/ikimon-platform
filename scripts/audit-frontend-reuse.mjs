#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("platform_v2/src/ui");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) files.push(path);
  }
}
await walk(root);

const rules = [
  ["toast", /\btoast\b/gi],
  ["sheet", /(?:bottom[-_ ]?sheet|start[-_ ]?sheet|\bsheet\b)/gi],
  ["dialog", /role=["']dialog["']/gi],
  ["hard_coded_transition", /transition\s*:[^;\n]*(?:\d+(?:\.\d+)?m?s)/gi],
  ["hard_coded_radius", /border-radius\s*:\s*(?:8|10|12|16|20|24|999)px/gi],
  ["touch_target", /(?:min-)?height\s*:\s*(?:44|48)px/gi],
];
const matches = Object.fromEntries(rules.map(([id]) => [id, { files: 0, occurrences: 0, examples: [] }]));
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const [id, regex] of rules) {
    const found = [...text.matchAll(regex)];
    if (!found.length) continue;
    matches[id].files += 1;
    matches[id].occurrences += found.length;
    if (matches[id].examples.length < 5) matches[id].examples.push(file.replaceAll("\\", "/"));
  }
}
const candidates = Object.entries(matches)
  .filter(([, value]) => value.files >= 2)
  .map(([pattern, value]) => ({ pattern, reason: "repeated_across_ui_files", ...value }));
console.log(JSON.stringify({ schema_version: "ikimon.frontend-reuse-audit.v1", scanned_files: files.length, matches, candidates }, null, 2));
