import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { buildLearnCatalog } from "./catalog.js";
import { createLearnSearch, type LearnCatalogEntry, type LearnSearchState } from "./search.js";

test("1000 synthetic catalogue entries: measure local search and serialized transfer size", (context) => {
  const canonical = buildLearnCatalog();
  assert.ok(canonical.length > 0);
  // Reuse actual title/summary/heading lengths, vary title and path, and keep
  // the fixture local. This measures capacity; it is not 1000 real articles.
  const synthetic: LearnCatalogEntry[] = Array.from({ length: 1000 }, (_, index) => {
    const source = canonical[index % canonical.length]!;
    return { ...source, path: `/learn/local-fixture-${index}`, title: `${source.title}（試験 ${index}）` };
  });
  const payload = JSON.stringify(synthetic);
  const rawBytes = Buffer.byteLength(payload, "utf8");
  const gzipBytes = gzipSync(payload).byteLength;
  const search = createLearnSearch();
  const coldStarted = performance.now();
  const first = search.search(synthetic, { q: "自然", kind: "all" });
  const coldMs = performance.now() - coldStarted;
  assert.ok(first.length > 0 && first.length < synthetic.length);
  const queries: LearnSearchState[] = [
    { q: "自然", kind: "all" },
    { q: "ＴＮＦＤ", kind: "term" },
    { q: "ﾈｲﾁｬｰﾎﾟｼﾞﾃｨﾌﾞ", kind: "all" },
    { q: "存在しない検索語".repeat(40), kind: "all" },
    { q: "", kind: "all" },
    { q: "evidence tier", kind: "term" },
    { q: "観察努力量", kind: "reading" },
  ];
  const samples: number[] = [];
  for (let index = 0; index < 350; index += 1) {
    const started = performance.now();
    search.search(synthetic, queries[index % queries.length]!);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const p50Ms = samples[Math.floor(samples.length * 0.5)]!;
  const p95Ms = samples[Math.floor(samples.length * 0.95)]!;
  assert.equal(synthetic.length, 1000);
  assert.ok(coldMs < 1000 && p95Ms < 100, "bounded in-memory search should not stall the UI");
  assert.ok(rawBytes < 4_000_000, "projection contains only searchable metadata/headings, not full article bodies");
  context.diagnostic(JSON.stringify({
    fixture: "1000 synthetic entries; not a published-article count",
    canonicalArticleCount: canonical.length,
    simulatedArticleCount: synthetic.length,
    node: process.version,
    rawJsonBytes: rawBytes,
    gzipJsonBytes: gzipBytes,
    coldSearchMs: Number(coldMs.toFixed(3)),
    warmSearchP50Ms: Number(p50Ms.toFixed(3)),
    warmSearchP95Ms: Number(p95Ms.toFixed(3)),
    warmQueries: samples.length,
  }));
});
