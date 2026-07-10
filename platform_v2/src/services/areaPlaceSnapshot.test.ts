import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("area snapshot photos fall back to visit-level assets", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  const visitFallbackMatches = source.match(/ea\.occurrence_id = o\.occurrence_id or ea\.visit_id = o\.visit_id/g) ?? [];
  const occurrencePriorityMatches = source.match(/case when ea\.occurrence_id = o\.occurrence_id then 0 else 1 end/g) ?? [];

  assert.equal(visitFallbackMatches.length, 4);
  assert.equal(occurrencePriorityMatches.length, 4);
});

test("area snapshot exposes contribution feedback contract", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  assert.match(source, /viewerContribution: ViewerAreaContribution;/);
  assert.match(source, /communityPerspective: CommunityAreaPerspective;/);
  assert.match(source, /overlapInsight: AreaOverlapInsight;/);
  assert.match(source, /civicReportReadiness: AreaCivicReportReadinessV0;/);
  assert.match(source, /function buildViewerContribution/);
  assert.match(source, /function buildCommunityPerspective/);
  assert.match(source, /function buildOverlapInsight/);
  assert.match(source, /buildAreaCivicReportReadinessV0/);
  assert.match(source, /記録を足すと|あなたの\$\{recordCount\}件/);
  assert.match(source, /inferPerspective/);
  assert.match(source, /overlapLine/);
});

test("area snapshot turns area watch signals into civic report readiness", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  assert.match(source, /const civicReportReadiness = buildAreaCivicReportReadinessV0\(\{/);
  assert.match(source, /areaWatchScore: areaWatch\.score/);
  assert.match(source, /maskedSpecies: sensitiveMasking\.maskedSpecies/);
  assert.match(source, /hasRepresentativePhoto: Boolean\(representativePhoto\)/);
  assert.match(source, /galleryCount: observationGallery\.length/);
  assert.match(source, /civicReportReadiness,/);
});

test("area snapshot keeps viewer-only memories separate from public album cards", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  assert.match(source, /loadViewerMemoryRows/);
  assert.match(source, /'viewer_private' as visibility/);
  assert.match(source, /false as share_allowed/);
  assert.match(source, /位置を守るため自分だけ表示/);
  assert.match(source, /大切な場所を守るため公開範囲を小さくしています/);
});

test("area snapshot gallery cards collapse multiple observations from the same visit", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "areaPlaceSnapshot.ts"), "utf8");

  assert.match(source, /over \(partition by fo\.visit_id\)::text as observation_count/);
  assert.match(source, /partition by fo\.visit_id\s+order by case when fo\.photo_url is null/);
  assert.doesNotMatch(source, /partition by fo\.taxon_key/);
  assert.match(source, /displayName: subjectCount > 1 \? `\$\{displayName\} ほか\$\{subjectCount - 1\}件` : displayName,/);
  assert.match(source, /const groupedRows = new Map<string, AreaPerspectiveRow\[\]>\(\);/);
  assert.match(source, /const key = row\.visit_id \|\| row\.occurrence_id;/);
  assert.match(source, /displayName: groupRows\.length > 1 \? `\$\{displayName\} ほか\$\{groupRows\.length - 1\}件` : displayName,/);
  assert.match(source, /observationCount: groupRows\.length,/);
});
