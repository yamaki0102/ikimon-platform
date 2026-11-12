import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

const srcDir = new URL("./", import.meta.url);
const snapshotUrl = new URL("./__snapshots__/route-table.json", import.meta.url);

const PATTERNS: RegExp[] = [
  /\burl\.pathname\s*===\s*"[^"]*"/g,
  /(?<!url\.)\bpathname\s*===\s*"[^"]*"/g,
  new RegExp(String.raw`\.pathname\.match\(/.*?/[a-z]*\)`, "g"),
  /\.startsWith\("[^"]*"\)/g,
  /\brequest\.method\s*===\s*"[A-Z]+"/g,
];

function listSources(): string[] {
  return readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.startsWith("__snapshots__/"))
    .sort();
}

function extract(source: string, lineOffset = 0): string[] {
  const hits: Array<{ line: number; col: number; text: string }> = [];
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) hits.push({ line: i + lineOffset, col: match.index ?? 0, text: match[0] });
    }
  });
  hits.sort((a, b) => a.line - b.line || a.col - b.col);
  return hits.map((hit) => hit.text);
}

function dispatchBody(indexSource: string): string {
  const start = indexSource.indexOf("export const worker = {");
  const end = indexSource.indexOf("export default worker;");
  assert.ok(start >= 0 && end > start);
  return indexSource.slice(start, end);
}

function buildTable() {
  const files = listSources();
  const dispatch = extract(dispatchBody(readFileSync(new URL("./index.ts", import.meta.url), "utf8")));
  const multiset: Record<string, number> = {};
  for (const file of files) {
    for (const text of extract(readFileSync(new URL(file, srcDir), "utf8"))) {
      const key = `${text}`;
      multiset[key] = (multiset[key] ?? 0) + 1;
    }
  }
  return { dispatch, multiset: Object.fromEntries(Object.entries(multiset).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) };
}

test("route table literals are unchanged", () => {
  const table = buildTable();
  if (process.env.P0_SNAPSHOT_WRITE === "1") writeFileSync(snapshotUrl, `${JSON.stringify(table)}\n`);
  const expected = JSON.parse(readFileSync(snapshotUrl, "utf8"));
  assert.deepEqual(table.dispatch, expected.dispatch);
  assert.deepEqual(table.multiset, expected.multiset);
});
