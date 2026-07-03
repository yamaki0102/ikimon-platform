import assert from "node:assert/strict";
import test from "node:test";
import type { FieldPublicProfile } from "./fieldPublicProfile.js";
import { buildSiteBriefMvp, buildSiteBriefMvpSet } from "./siteBriefMvp.js";

function profile(name: string): FieldPublicProfile {
  return {
    fieldId: `field-${name}`,
    placeName: name,
    placeType: "park",
    publicLocation: { mode: "site", label: `沖縄県 / 那覇市 / ${name}`, radiusM: 50 },
    confirmedTaxa: [{ name: "シロツメクサ", observationCount: 5, seasonLabels: ["春"] }],
    seasonTendencyLabels: ["春"],
    environmentTypes: ["草地", "花壇"],
    observationDensityLabel: "育ち始め",
    confidence: { label: "公開条件を満たした記録から作成", canPublishDetails: true },
    limitations: [],
    nextObservationPrompts: ["夏の訪花昆虫を見たい"],
  };
}

test("site brief mvp keeps manager gaps out of public brief", () => {
  const publicBrief = buildSiteBriefMvp({
    audience: "public",
    profile: profile("牧志公園"),
    evidenceSummary: ["春の草地記録が増えています"],
    managerGaps: ["木陰が少ない可能性"],
    nextActions: ["夏の訪花昆虫を記録"],
  });
  const managerBrief = buildSiteBriefMvp({
    audience: "manager",
    profile: profile("牧志公園"),
    evidenceSummary: ["春の草地記録が増えています"],
    managerGaps: ["木陰が少ない可能性"],
    nextActions: ["夏の訪花昆虫を記録"],
  });

  assert.equal(publicBrief.audience, "public");
  assert.deepEqual(publicBrief.gaps, []);
  assert.deepEqual(managerBrief.gaps, ["木陰が少ない可能性"]);
  assert.match(managerBrief.sections[0]?.body ?? "", /牧志公園/);
  assert.match(managerBrief.sections.at(-1)?.body ?? "", /夏の訪花昆虫/);
});

test("site brief mvp set can prepare two or three place briefs", () => {
  const briefs = buildSiteBriefMvpSet([
    { audience: "manager", profile: profile("牧志公園"), evidenceSummary: [], managerGaps: [], nextActions: [] },
    { audience: "manager", profile: profile("与儀公園"), evidenceSummary: [], managerGaps: [], nextActions: [] },
    { audience: "manager", profile: profile("奥武山公園"), evidenceSummary: [], managerGaps: [], nextActions: [] },
  ]);

  assert.equal(briefs.length, 3);
  assert.deepEqual(briefs.map((brief) => brief.placeName), ["牧志公園", "与儀公園", "奥武山公園"]);
});
