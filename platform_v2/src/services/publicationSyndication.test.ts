import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLICATION_SYNDICATION_POLICY_VERSION,
  PUBLICATION_SYNDICATION_PURPOSE,
  evaluatePublicationSyndication,
  normalizePublicationSyndicationConsent,
  projectOwnerPublicationReturn,
} from "./publicationSyndication.js";

const now = new Date("2026-09-15T00:00:00.000Z");
const destination = "miyakoda-renri-area";

const consent = {
  status: "active",
  purpose: PUBLICATION_SYNDICATION_PURPOSE,
  policyVersion: PUBLICATION_SYNDICATION_POLICY_VERSION,
  grantedAt: "2026-08-01T00:00:00.000Z",
  validUntil: "2027-08-01T00:00:00.000Z",
  subjectStatus: "adult",
  destinationFeedKeys: [destination],
  guardian: { status: "not_required" },
};

const rights = {
  recordConsent: "external_export",
  researchUseConsent: "public_export",
  datasetLicense: "CC-BY-4.0",
  mediaLicense: "CC-BY-4.0",
  externalExportAllowed: true,
  withdrawalStatus: "active",
  sourcePayload: { syndicationConsent: consent },
};

test("normalizes only explicit destination-bound syndication consent", () => {
  const normalized = normalizePublicationSyndicationConsent({
    syndication_consent: {
      ...consent,
      destination_feed_keys: [destination, destination, "https://unsafe.example"],
    },
  });
  assert.deepEqual(normalized.destinationFeedKeys, [destination]);
  assert.equal(normalized.purpose, PUBLICATION_SYNDICATION_PURPOSE);
  assert.equal(normalized.policyVersion, PUBLICATION_SYNDICATION_POLICY_VERSION);
  assert.equal(normalized.guardian.status, "not_required");
  assert.equal(normalizePublicationSyndicationConsent({}).status, "unknown");
});

test("missing, mismatched, expired, or withdrawn syndication consent fails closed", () => {
  const cases = [
    [{}, "syndication_consent_missing"],
    [{ ...consent, destinationFeedKeys: ["other-feed"] }, "destination_not_consented"],
    [{ ...consent, purpose: "ordinary_display" }, "syndication_purpose_mismatch"],
    [{ ...consent, validUntil: "2026-09-14T23:59:59.000Z" }, "syndication_expired"],
    [{ ...consent, status: "withdrawn" }, "syndication_consent_withdrawn"],
  ] as const;
  for (const [payload, reasonCode] of cases) {
    const result = evaluatePublicationSyndication({
      ...rights,
      sourcePayload: { syndicationConsent: payload },
      destinationFeedKey: destination,
      now,
    });
    assert.equal(result.decision, "DENY");
    assert.equal(result.reasonCode, reasonCode);
  }
});

test("minor records require current purpose/version/term-bound guardian authority", () => {
  const minor = { ...consent, subjectStatus: "minor", guardian: { status: "unknown" } };
  const unresolved = evaluatePublicationSyndication({
    ...rights,
    sourcePayload: { syndicationConsent: minor },
    destinationFeedKey: destination,
    now,
  });
  assert.equal(unresolved.decision, "DENY");
  assert.equal(unresolved.reasonCode, "guardian_authority_unresolved");

  const withdrawn = evaluatePublicationSyndication({
    ...rights,
    sourcePayload: { syndicationConsent: { ...minor, guardian: { status: "withdrawn" } } },
    destinationFeedKey: destination,
    now,
  });
  assert.equal(withdrawn.reasonCode, "guardian_authority_withdrawn");

  const confirmed = evaluatePublicationSyndication({
    ...rights,
    sourcePayload: {
      syndicationConsent: {
        ...minor,
        guardian: {
          status: "confirmed",
          purpose: PUBLICATION_SYNDICATION_PURPOSE,
          policyVersion: PUBLICATION_SYNDICATION_POLICY_VERSION,
          grantedAt: "2026-08-01T00:00:00.000Z",
          validUntil: "2027-08-01T00:00:00.000Z",
        },
      },
    },
    destinationFeedKey: destination,
    now,
  });
  assert.equal(confirmed.decision, "ALLOW");
  assert.equal(confirmed.reasonCode, "eligible");
});

test("withdrawal is checked before derived publication can be reused", () => {
  const result = evaluatePublicationSyndication({
    ...rights,
    withdrawalStatus: "withdrawn",
    destinationFeedKey: destination,
    now,
  });
  assert.equal(result.decision, "DENY");
  assert.equal(result.reasonCode, "record_withdrawn");
});

test("owner publication return separates human Review, eligibility, configured destination, and read-back publication", () => {
  const returned = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "human_review", decidedAt: "2026-09-14T12:00:00.000Z" },
    rights,
    destinations: [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: null, sourceEnvironment: "production", readOnly: true }],
    now,
  });
  assert.ok(returned);
  assert.equal(returned.review.state, "approved");
  assert.equal(returned.review.source, "human_review");
  assert.equal(returned.publication.state, "eligible");
  assert.deepEqual(returned.publication.destinations.map((item) => item.status), ["eligible"]);

  const published = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "human_review", decidedAt: "2026-09-14T12:00:00.000Z" },
    rights,
    destinations: [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: null, sourceEnvironment: "production", readOnly: true }],
    publishedDestinations: [destination],
    now,
  });
  assert.equal(published?.publication.state, "published");
  assert.equal(published?.publication.destinations[0]?.status, "published");

  const aiOnly = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "ai", decidedAt: "2026-09-14T12:00:00.000Z" },
    rights,
    destinations: [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: null, sourceEnvironment: "production", readOnly: true }],
    now,
  });
  assert.equal(aiOnly?.review.state, "not_reviewed");
  assert.equal(aiOnly?.publication.state, "not_ready");
});

test("guest and non-public owner projections do not receive private return data", () => {
  assert.equal(projectOwnerPublicationReturn({
    owner: false,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "human_review" },
    rights,
    destinations: [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: null, sourceEnvironment: "production", readOnly: true }],
    now,
  }), null);

  const nonPublic = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "private",
    reviewDecision: { state: "approved", source: "human_review" },
    rights,
    destinations: [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: null, sourceEnvironment: "production", readOnly: true }],
    now,
  });
  assert.equal(nonPublic?.publication.state, "excluded");
  assert.equal(nonPublic?.publication.exclusionCode, "record_not_public");
});


test("correction and withdrawal cannot retain a previously published destination", () => {
  const destinationConfig = [{ feedKey: destination, label: "浜松・都田", sourceVersion: "public-feed-v1", href: "/publication/miyakoda", sourceEnvironment: "production" as const, readOnly: true as const }];
  const correction = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "changes_requested", source: "human_review" },
    rights,
    destinations: destinationConfig,
    publishedDestinations: [destination],
    now,
  });
  assert.equal(correction?.publication.state, "not_ready");
  assert.deepEqual(correction?.publication.destinations.map((item) => item.status), ["excluded"]);

  const withdrawn = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "human_review" },
    rights: { ...rights, withdrawalStatus: "withdrawn" },
    destinations: destinationConfig,
    publishedDestinations: [destination],
    now,
  });
  assert.equal(withdrawn?.publication.state, "excluded");
  assert.deepEqual(withdrawn?.publication.destinations.map((item) => item.status), ["excluded"]);
});
