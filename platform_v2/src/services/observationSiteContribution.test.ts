import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObservationSiteContribution,
} from "./observationSiteContribution.js";

test("site contribution model shows contributed records as area profile inputs", () => {
  const contribution = buildObservationSiteContribution({
    fieldName: "牧志公園",
    contributionStatus: "public",
    publicLocationMode: "site",
    publicTimePrecision: "date",
    aiOnly: false,
    publicationReason: "ordinary_public_area_profile",
  });

  assert.equal(contribution.status, "contributed");
  assert.equal(contribution.aiState, "human_touched");
  assert.equal(contribution.publicStateLabel, "場所単位で公開");
  assert.match(contribution.headline, /牧志公園のプロフィールに貢献しました/);
  assert.deepEqual(contribution.actions.map((action) => action.key), ["dispute", "make_private", "add_evidence"]);
});

test("site contribution model marks AI-only records as draft", () => {
  const contribution = buildObservationSiteContribution({
    fieldName: "牧志公園",
    contributionStatus: "internal",
    publicLocationMode: "hidden",
    publicTimePrecision: "hidden",
    aiOnly: true,
    publicationReason: "low_confidence_ai_draft",
  });

  assert.equal(contribution.status, "pending");
  assert.equal(contribution.aiState, "ai_draft");
  assert.equal(contribution.publicStateLabel, "非公開");
  assert.match(contribution.body, /AI候補は下書きです/);
});

test("site contribution model explains suppressed and private records without exposing exact location", () => {
  const suppressed = buildObservationSiteContribution({
    fieldName: "牧志公園",
    contributionStatus: "suppressed",
    publicLocationMode: "grid_1km",
    publicTimePrecision: "month",
    aiOnly: false,
    publicationReason: "taxon_sensitive",
  });
  assert.equal(suppressed.status, "suppressed");
  assert.equal(suppressed.publicStateLabel, "場所を丸めて保留");
  assert.doesNotMatch(suppressed.body, /正確な座標|exact/);

  const privateRecord = buildObservationSiteContribution({
    fieldName: null,
    contributionStatus: "private",
    publicLocationMode: "hidden",
    publicTimePrecision: "hidden",
    aiOnly: false,
    publicationReason: "public_aggregation_not_allowed",
  });
  assert.equal(privateRecord.status, "private");
  assert.equal(privateRecord.publicStateLabel, "非公開");
  assert.match(privateRecord.headline, /この記録は自分だけに表示/);
});
