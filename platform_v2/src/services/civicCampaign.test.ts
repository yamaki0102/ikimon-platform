import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCivicCampaignReportExportV0,
  getStaticCivicCampaignConfigV0,
} from "./civicCampaign.js";

test("static civic campaign config supports light walk records without a DB migration", () => {
  const config = getStaticCivicCampaignConfigV0();

  assert.equal(config.schemaVersion, "civic_campaign_config/v0");
  assert.equal(config.campaignId, "jp-shizuoka-seasonal-walk-v0");
  assert.equal(config.theme, "seasonal_walk");
  assert.deepEqual(config.allowedRecordModes, ["photo", "audio", "memo", "unknown_species", "non_detection"]);
  assert.equal(config.publicPrecisionPolicy, "site_or_coarser");
  assert.equal(config.publicResultMode, "area_digest");
  assert.match(config.claimBoundary.join("\n"), /公式提出物ではなく/);
});

test("civic campaign report export includes markdown json csv and claim boundaries", () => {
  const campaign = getStaticCivicCampaignConfigV0();
  const exportModel = buildCivicCampaignReportExportV0({
    campaign,
    generatedAt: "2026-06-24T00:00:00.000Z",
    participation: {
      participantCount: 12,
      recordCount: 48,
      visitCount: 18,
      firstTimerRate: 0.42,
      schoolOrEventCount: 2,
    },
    recordBreakdown: {
      taxaGroups: { plants: 18, birds: 7, unknown_scene: 6 },
      seasons: { spring: 20, summer: 12 },
      placeTypes: { park: 16, waterfront: 10 },
      mediaModes: { photo: 32, audio: 4, memo: 12 },
      unknownNameRate: 0.25,
    },
    verificationState: {
      unverified: 20,
      aiSuggested: 18,
      locallyReviewed: 6,
      expertVerified: 3,
      municipalReady: 1,
    },
    safetyHandling: {
      privateCount: 4,
      precisionDowngradeCount: 7,
      rareSpeciesCount: 1,
      schoolContextCount: 2,
      homeAreaRiskCount: 1,
      privateLandCount: 1,
    },
    qualityExclusions: {
      duplicate_candidate: 2,
      captive_or_planted: 1,
      missing_location: 3,
    },
    coverageDebt: ["冬の水辺記録が少ない", "夜間の音声記録が少ない"],
    nextYearSuggestions: ["水辺の短い散策企画を増やす", "地域確認の担当日を決める"],
  });

  assert.equal(exportModel.schemaVersion, "civic_campaign_report_export/v0");
  assert.equal(exportModel.campaignId, campaign.campaignId);
  assert.match(exportModel.formats.markdown, /## Claim Boundary/);
  assert.match(exportModel.formats.markdown, /不在証明/);
  assert.match(exportModel.formats.markdown, /## 安全処理/);
  assert.equal((exportModel.formats.json.campaign as { campaignId: string }).campaignId, campaign.campaignId);
  assert.match(exportModel.formats.csv, /"claim_boundary","item"/);
  assert.match(exportModel.formats.csv, /"verification_state","municipalReady","1"/);
});
