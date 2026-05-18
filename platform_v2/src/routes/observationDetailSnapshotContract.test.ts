import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const platformRoot = join(repoRoot, "platform_v2");
const snapshotDir = join(repoRoot, "docs", "review", "observation-record-final-polish-2026-05-17");

const readRouteSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const e2eSource = readFileSync(join(platformRoot, "e2e", "observation-detail-target.spec.ts"), "utf8");
const packageJsonSource = readFileSync(join(platformRoot, "package.json"), "utf8");
const ciSource = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
const readmeSource = readFileSync(join(snapshotDir, "README.md"), "utf8");
const meceSource = readFileSync(join(snapshotDir, "snapshot_content_order_mece.md"), "utf8");
const snapshotHtml = readFileSync(join(snapshotDir, "snapshot.html"));

const requiredTerms = [
  "かなり近そう",
  "分類候補",
  "Chloris sinica",
  "端末の声で読む",
  "浜松市浜名区をもう少し見る",
  "近い投稿 2件",
];

const forbiddenTerms = [
  "この映像で読む対象を切り替える",
  "この映像に写っているもの",
  "候補を確かめる材料",
  "名前の記録",
  "現場アドバイス",
  "確定前",
  "イネ科植物",
  "映像フレームから拾えている手がかり",
];

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = readRouteSource.indexOf(startMarker);
  const end = readRouteSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return readRouteSource.slice(start, end);
}

test("observation detail canonical snapshot artifact is versioned and unchanged", () => {
  const snapshotText = snapshotHtml.toString("utf8");
  const normalizedSnapshotText = snapshotText.replace(/\r\n/g, "\n");
  const sha256 = createHash("sha256").update(normalizedSnapshotText).digest("hex").toUpperCase();

  assert.match(readmeSource, /Source SHA256: `1987CE475E7186F61D875B3406C31AC0F9963D9D759C5BEA9AABA890B2F4C13F`/);
  assert.match(readmeSource, new RegExp(`Expected normalized SHA256: \`${sha256}\``));
  assert.match(meceSource, /Source SHA256: `1987CE475E7186F61D875B3406C31AC0F9963D9D759C5BEA9AABA890B2F4C13F`/);
  assert.match(meceSource, new RegExp(`LF正規化SHA256: \`${sha256}\``));
  assert.match(readmeSource, /Canonical implementation reference: `snapshot\.html`/);
  assert.match(readmeSource, /Target URL: `\/ja\/observations\/record-1778829649026\?subject=occ%3Arecord-1778829649026%3A0`/);
  assert.match(meceSource, /このMDは「実際に見えている順番」を正本化する/);

  for (const term of requiredTerms) {
    assert.match(snapshotText, new RegExp(term), `canonical snapshot should contain ${term}`);
  }
});

test("observation detail implementation keeps the snapshot visual order contract", () => {
  const styleSource = sourceBetween("const OBSERVATION_DETAIL_STYLES", "function aiJudgementStateLabel");

  for (const selector of [
    "section#photos.obs-reading-hero",
    ".obs-reading-media",
    ".obs-reading-panel",
    ".obs-local-quality-inline.is-full-width",
    "#place.obs-area-records",
    ".obs-record-brief-compact",
    ".obs-reading-panel > .obs-media-ledger",
    ".obs-hero-video .obs-record-insight",
    "[data-obs-switch-ai-readout]",
  ]) {
    assert.match(meceSource, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(styleSource, /\.obs-reading-hero \{ display: grid; grid-template-columns: 1fr;/);
  assert.match(styleSource, /\.obs-reading-hero \{ grid-template-columns: minmax\(0, 1\.18fr\) minmax\(330px, \.82fr\);/);
  assert.match(styleSource, /\.obs-reading-panel \{ display: contents; \}/);
  assert.match(styleSource, /\.obs-record-brief-compact \{ order: 1;/);
  assert.match(styleSource, /\.obs-reading-panel > \.obs-media-ledger \{ order: 2;/);
  assert.match(styleSource, /\.obs-reading-media \{ order: 3;/);
  assert.match(styleSource, /\.obs-hero-video \.obs-record-insight \{ order: 3;/);
  assert.match(styleSource, /\.obs-reading-panel \[data-obs-switch-ai-readout\] \{ order: 5;/);
  assert.match(styleSource, /\.obs-local-quality-inline, \.obs-local-quality-inline\.is-full-width \{ order: 7;/);
  assert.match(styleSource, /#place\.obs-area-records \{ width: auto !important; max-width: none !important; justify-self: stretch !important; margin-left: 0 !important; \}/);
});

test("observation detail production browser check follows the snapshot copy contract", () => {
  assert.match(e2eSource, /\/ja\/observations\/record-1778829649026\?subject=occ%3Arecord-1778829649026%3A0/);

  for (const term of requiredTerms) {
    assert.match(e2eSource, new RegExp(term), `production target e2e should require ${term}`);
  }
  for (const term of forbiddenTerms) {
    assert.match(e2eSource, new RegExp(term), `production target e2e should forbid ${term}`);
  }

  assert.match(e2eSource, /width: 390, height: 844/);
  assert.match(e2eSource, /width: 625, height: 844/);
  assert.match(e2eSource, /width: 1440, height: 900/);
  assert.match(e2eSource, /expectNoHorizontalOverflow/);
  assert.match(e2eSource, /expectPolishedObservationPage/);
});

test("observation detail snapshot contract is pinned to the normal CI gate", () => {
  assert.match(packageJsonSource, /"test:node": "tsx --test \\"src\/\*\*\/\*\.test\.ts\\""/);
  assert.match(ciSource, /working-directory: platform_v2[\s\S]*?run: npm run test:node/);
});
