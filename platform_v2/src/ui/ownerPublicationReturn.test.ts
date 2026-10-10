import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PUBLICATION_SYNDICATION_POLICY_VERSION,
  PUBLICATION_SYNDICATION_PURPOSE,
  ownerPublicationReviewDecisionFromQualityStatus,
} from "../services/publicationSyndication.js";
import { renderOwnerPublicationReturn } from "./ownerPublicationReturn.js";

const rights = {
  recordConsent: "external_export",
  researchUseConsent: "public_export",
  datasetLicense: "CC-BY-4.0",
  mediaLicense: "CC-BY-4.0",
  externalExportAllowed: true,
  withdrawalStatus: "active",
  sourcePayload: {
    syndicationConsent: {
      status: "active",
      purpose: PUBLICATION_SYNDICATION_PURPOSE,
      policyVersion: PUBLICATION_SYNDICATION_POLICY_VERSION,
      grantedAt: "2026-08-01T00:00:00.000Z",
      validUntil: "2027-08-01T00:00:00.000Z",
      subjectStatus: "adult",
      destinationFeedKeys: ["miyakoda-renri-area"],
      guardian: { status: "not_required" },
    },
  },
};

const base = {
  owner: true,
  recordVisibility: "public" as const,
  reviewDecision: { state: "approved", source: "human_review" },
  rights,
  now: new Date("2026-09-15T00:00:00.000Z"),
};
const readRouteSource = readFileSync(new URL("../routes/read.ts", import.meta.url), "utf8");

test("Node owner publication return uses the latest review status with an absence-only fallback", () => {
  assert.match(readRouteSource, /ownerPublicationReviewDecisionFromQualityStatus\(snapshot\.qualityReviewStatus, reviewFallback\)/);
  assert.match(readRouteSource, /const reviewFallback = currentSubject\.hasSpecialistApproval/);
  assert.doesNotMatch(readRouteSource, /const reviewDecision = currentSubject\.hasSpecialistApproval/);
});

test("publication return is owner-only", () => {
  const html = renderOwnerPublicationReturn({ ...base, owner: false, lang: "ja" });
  assert.equal(html, "");
});

test("eligible publication shows the configured destination policy version without claiming publication", () => {
  const html = renderOwnerPublicationReturn({ ...base, lang: "ja" });
  assert.match(html, /data-publication-return="owner-only"/);
  assert.match(html, /確認済み・承認/);
  assert.match(html, /公開可能（未公開）/);
  assert.match(html, /設定済み・未公開/);
  assert.match(html, /ポリシー版: public-feed-v1/);
  assert.doesNotMatch(html, /公開確認済み/);
});

test("quality visibility status alone is not presented as a human Review decision", () => {
  const html = renderOwnerPublicationReturn({ ...base, reviewDecision: null, lang: "en" });
  assert.match(html, /data-publication-review-state="not_reviewed"/);
  assert.match(html, /Not reviewed/);
  assert.doesNotMatch(html, /Reviewed and approved/);
});

test("explicit non-accepted quality state clears prior approval and excludes a published destination", () => {
  const destination = "miyakoda-renri-area";
  for (const status of ["needs_review", "rejected", "archived", "pending", "changes_requested", "correction_requested"]) {
    const decision = ownerPublicationReviewDecisionFromQualityStatus(status, base.reviewDecision);
    const html = renderOwnerPublicationReturn({
      ...base,
      reviewDecision: decision,
      publishedDestinations: [destination],
      lang: "en",
    });

    assert.match(html, /data-publication-review-state="not_reviewed"/);
    assert.match(html, /data-publication-state="not_ready"/);
    assert.match(html, /data-publication-destination-status="excluded"/);
    assert.doesNotMatch(html, /Eligible \(not published\)|Publication confirmed/);
  }
});

test("accepted quality status cannot manufacture human approval", () => {
  const qualityAcceptedOnly = renderOwnerPublicationReturn({
    ...base,
    reviewDecision: ownerPublicationReviewDecisionFromQualityStatus("accepted", null),
    lang: "en",
  });
  assert.match(qualityAcceptedOnly, /data-publication-review-state="not_reviewed"/);
  assert.match(qualityAcceptedOnly, /data-publication-state="not_ready"/);
  assert.doesNotMatch(qualityAcceptedOnly, /Reviewed and approved|Eligible \(not published\)|Publication confirmed/);

  const qualityAcceptedWithHumanApproval = renderOwnerPublicationReturn({
    ...base,
    reviewDecision: ownerPublicationReviewDecisionFromQualityStatus("accepted", base.reviewDecision),
    lang: "en",
  });
  assert.match(qualityAcceptedWithHumanApproval, /data-publication-review-state="approved"/);
  assert.match(qualityAcceptedWithHumanApproval, /data-publication-state="eligible"/);
});

test("pending, unknown, and unsupported review states fail closed", () => {
  for (const status of ["verified", "ACCEPTED", "unknown", 1]) {
    const html = renderOwnerPublicationReturn({
      ...base,
      reviewDecision: ownerPublicationReviewDecisionFromQualityStatus(status, base.reviewDecision),
      lang: "en",
    });
    assert.match(html, /data-publication-review-state="not_reviewed"/);
    assert.match(html, /data-publication-state="not_ready"/);
    assert.doesNotMatch(html, /Eligible \(not published\)|Publication confirmed/);
  }

  for (const absentStatus of [null, undefined]) {
    const html = renderOwnerPublicationReturn({
      ...base,
      reviewDecision: ownerPublicationReviewDecisionFromQualityStatus(absentStatus, base.reviewDecision),
      lang: "en",
    });
    assert.match(html, /data-publication-state="eligible"/);
  }
});

test("missing destination consent remains excluded", () => {
  const html = renderOwnerPublicationReturn({ ...base, rights: { ...rights, sourcePayload: {} }, lang: "en" });
  assert.match(html, /Excluded from publication/);
  assert.match(html, /Consent does not cover this destination/);
  assert.doesNotMatch(html, /Eligible \(not published\)/);
});

test("rights read failure is presented as unavailable, not as an eligible or unconsented state", () => {
  const html = renderOwnerPublicationReturn({ ...base, rightsUnavailable: true, rights: {}, lang: "en" });
  assert.match(html, /data-publication-state="unavailable"/);
  assert.match(html, /Publication conditions could not be checked/);
  assert.doesNotMatch(html, /Eligible \(not published\)|Consent does not cover this destination/);
});

test("publication return labels follow each supported UI language", () => {
  for (const [lang, title] of [["ja", "公開と確認"], ["en", "Review and publication"], ["es", "Revisión y publicación"], ["pt-BR", "Revisão e publicação"]] as const) {
    const html = renderOwnerPublicationReturn({ ...base, lang });
    assert.match(html, new RegExp(title));
  }
});
