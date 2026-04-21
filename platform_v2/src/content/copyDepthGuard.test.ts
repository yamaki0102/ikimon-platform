import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContentStore } from "./index.js";

type MatrixRow = {
  routePageId: string;
  shortSourceKey: string;
  longformFile: string;
  pageDepth: string;
  firstScreenPromise: string;
  bodyObligation: string;
  pairedCta: string;
  internalJargonRisk: string;
  status: "done" | "next pass";
};

type Threshold = {
  leadMin: number;
  bodyMin: number;
  h2Min?: number;
};

const store = createContentStore();
const jaPublic = store.short.ja.public as any;
const marketingPages = jaPublic.marketing.pages as Record<string, { lead: string; bodyPageId: string }>;
const matrixPath = fileURLToPath(
  new URL("../../../docs/review/2026-04-21-ja-short-longform-review-matrix.md", import.meta.url),
);
const matrix = parseMatrix(readFileSync(matrixPath, "utf8"));
const coverageAllowlist = new Set(["learn-glossary", "learn-updates"]);

function normalizeCell(value: string): string {
  return value.trim().replace(/`/g, "");
}

function parseMatrix(markdown: string): MatrixRow[] {
  const tableLines = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.trim());
  const [headerLine, separatorLine, ...rowLines] = tableLines;
  assert.ok(headerLine, "review matrix header is required");
  assert.ok(separatorLine, "review matrix separator is required");
  const headers = headerLine
    .split("|")
    .slice(1, -1)
    .map((cell) => normalizeCell(cell));

  return rowLines.map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => normalizeCell(cell));
    assert.equal(cells.length, headers.length, `matrix row should have ${headers.length} cells: ${line}`);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]])) as Record<string, string>;
    const routePageId = row["route/pageId"];
    const shortSourceKey = row["short source key"];
    const longformFile = row["longform file"];
    const pageDepth = row["page depth"];
    const firstScreenPromise = row["first-screen promise"];
    const bodyObligation = row["body obligation"];
    const pairedCta = row["paired CTA"];
    const internalJargonRisk = row["internal-jargon risk"];
    const status = row["status"];
    assert.ok(routePageId, `matrix row is missing route/pageId: ${line}`);
    assert.ok(shortSourceKey, `matrix row is missing short source key: ${line}`);
    assert.ok(longformFile, `matrix row is missing longform file: ${line}`);
    assert.ok(pageDepth, `matrix row is missing page depth: ${line}`);
    assert.ok(firstScreenPromise, `matrix row is missing first-screen promise: ${line}`);
    assert.ok(bodyObligation, `matrix row is missing body obligation: ${line}`);
    assert.ok(pairedCta !== undefined, `matrix row is missing paired CTA: ${line}`);
    assert.ok(internalJargonRisk, `matrix row is missing internal-jargon risk: ${line}`);
    assert.ok(status === "done" || status === "next pass", `matrix row has invalid status: ${line}`);
    return {
      routePageId,
      shortSourceKey,
      longformFile,
      pageDepth,
      firstScreenPromise,
      bodyObligation,
      pairedCta,
      internalJargonRisk,
      status,
    };
  });
}

function tokensFrom(value: string): string[] {
  return value
    .split(" / ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function pageKeyPatternFrom(shortSourceKey: string): string {
  return shortSourceKey.replace(/^marketing\.pages\./, "");
}

function rowMatchesPageKey(row: MatrixRow, pageKey: string): boolean {
  const pattern = pageKeyPatternFrom(row.shortSourceKey);
  if (pattern.endsWith("*")) {
    return pageKey.startsWith(pattern.slice(0, -1));
  }
  return pageKey === pattern;
}

function pageKeysForRow(row: MatrixRow): string[] {
  return Object.keys(marketingPages).filter((pageKey) => rowMatchesPageKey(row, pageKey));
}

function thresholdForDepth(pageDepth: string): Threshold {
  switch (pageDepth) {
    case "解説面":
      return { leadMin: 55, bodyMin: 800, h2Min: 5 };
    case "団体相談面":
      return { leadMin: 55, bodyMin: 300, h2Min: 3 };
    case "信頼面":
      return { leadMin: 35, bodyMin: 120 };
    default:
      throw new Error(`Unknown page depth in matrix: ${pageDepth}`);
  }
}

function countH2(markdown: string): number {
  return (markdown.match(/^## /gm) ?? []).length;
}

test("review matrix covers every marketing page with a bodyPageId or allowlist", () => {
  for (const [pageKey, page] of Object.entries(marketingPages)) {
    const covered = matrix.some((row) => rowMatchesPageKey(row, pageKey));
    assert.ok(
      covered || coverageAllowlist.has(page.bodyPageId),
      `${pageKey} (${page.bodyPageId}) must be covered by the review matrix or allowlist`,
    );
  }
});

test("done rows keep lead promises and body obligations aligned", () => {
  const doneRows = matrix.filter((row) => row.status === "done");
  assert.ok(doneRows.length >= 6, "done rows should include the reviewed explanation pages");

  for (const row of doneRows) {
    const pageKeys = pageKeysForRow(row);
    assert.equal(pageKeys.length, 1, `done row should resolve to exactly one page: ${row.shortSourceKey}`);
    const pageKey = pageKeys[0]!;
    const meta = marketingPages[pageKey];
    assert.ok(meta, `${pageKey} should exist in canonical marketing metadata`);
    const rawMarkdown = store.longform.ja[meta.bodyPageId];
    assert.ok(rawMarkdown, `${pageKey} should have canonical ja markdown`);
    assert.ok(tokensFrom(row.firstScreenPromise).length >= 2, `${pageKey} promise should be tokenized`);
    assert.ok(tokensFrom(row.bodyObligation).length >= 2, `${pageKey} obligation should be tokenized`);

    for (const token of tokensFrom(row.firstScreenPromise)) {
      assert.ok(meta.lead.includes(token), `${pageKey} lead should include promise token: ${token}`);
    }
    for (const token of tokensFrom(row.bodyObligation)) {
      assert.ok(rawMarkdown.includes(token), `${pageKey} markdown should include obligation token: ${token}`);
    }

    assert.equal(
      row.longformFile,
      `platform_v2/src/content/longform/ja/${meta.bodyPageId}.md`,
      `${pageKey} should point at the resolved longform file`,
    );
  }
});

test("marketing copy depth heuristics stay above the staging floor", () => {
  for (const row of matrix) {
    for (const pageKey of pageKeysForRow(row)) {
      const meta = marketingPages[pageKey];
      assert.ok(meta, `${pageKey} should exist in canonical marketing metadata`);
      const rawMarkdown = store.longform.ja[meta.bodyPageId];
      assert.ok(rawMarkdown, `${pageKey} should have canonical ja markdown`);
      const threshold = thresholdForDepth(row.pageDepth);

      assert.ok(meta.lead.length >= threshold.leadMin, `${pageKey} lead should be at least ${threshold.leadMin} chars`);
      assert.ok(
        rawMarkdown.length >= threshold.bodyMin,
        `${pageKey} markdown should be at least ${threshold.bodyMin} chars`,
      );

      if (typeof threshold.h2Min === "number") {
        assert.ok(countH2(rawMarkdown) >= threshold.h2Min, `${pageKey} should keep at least ${threshold.h2Min} H2 sections`);
      }
    }
  }
});
