import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("area snapshot photos fall back to visit-level assets", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  const visitFallbackMatches = source.match(/ea\.occurrence_id = o\.occurrence_id or ea\.visit_id = o\.visit_id/g) ?? [];
  const occurrencePriorityMatches = source.match(/case when ea\.occurrence_id = o\.occurrence_id then 0 else 1 end/g) ?? [];

  assert.equal(visitFallbackMatches.length, 3);
  assert.equal(occurrencePriorityMatches.length, 3);
});

test("area snapshot exposes contribution feedback contract", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  assert.match(source, /viewerContribution: ViewerAreaContribution;/);
  assert.match(source, /communityPerspective: CommunityAreaPerspective;/);
  assert.match(source, /overlapInsight: AreaOverlapInsight;/);
  assert.match(source, /function buildViewerContribution/);
  assert.match(source, /function buildCommunityPerspective/);
  assert.match(source, /function buildOverlapInsight/);
  assert.match(source, /あなたのおかげで|あなたの\$\{recordCount\}件/);
  assert.match(source, /inferPerspective/);
  assert.match(source, /overlapLine/);
});
