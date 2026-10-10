import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLICATION_SYNDICATION_POLICY_VERSION,
  PUBLICATION_SYNDICATION_PURPOSE,
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
