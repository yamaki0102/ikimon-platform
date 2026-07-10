import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordSafetyProfileV0 } from "./recordSafetyProfile.js";

test("record safety profile allows public story and municipal use for allowlisted public places", () => {
  const profile = buildRecordSafetyProfileV0({
    civicContext: {
      contextId: "civic:1",
      visitId: "visit-1",
      occurrenceId: "occ-1",
      contextKind: "ordinary",
      activityLabel: "park walk",
      activityIntent: "discover",
      participantRole: "finder",
      audienceScope: "public",
      publicPrecision: "site",
      riskLane: "normal",
      reportConsent: "public_summary",
      revisitOfVisitId: null,
      fieldId: "park-1",
      routeId: "route-1",
      plotId: null,
      sourcePayload: {},
    },
    dataRights: {
      visitId: "visit-1",
      occurrenceId: "occ-1",
      recordConsent: "public_summary",
      researchUseConsent: "internal",
      enterpriseReportConsent: "aggregated",
      datasetLicense: null,
      mediaLicense: null,
      externalExportAllowed: false,
      withdrawalStatus: "active",
      sourcePayload: {},
    },
    place: {
      publicSafePlace: true,
      accessStatus: "public_access",
      source: "osm_park",
      adminLevel: "park",
      verificationLevel: "verified",
    },
    occurrences: [{ riskLane: "normal", safePublicRank: "species", vernacularName: "ツバメ" }],
    mediaAssets: [{
      publicUrl: "/uploads/photo.jpg",
      sourcePayload: { face_privacy: { status: "no_faces", faceCount: 0 } },
    }],
  });

  assert.equal(profile.publicPlacePolicy, "allowlisted_public_place");
  assert.equal(profile.publicPrecisionPolicy, "site");
  assert.equal(profile.mediaPublicPolicy, "cleared_public_media");
  assert.equal(profile.publicSummaryGate.ready, true);
  assert.equal(profile.municipalUseGate.ready, true);
});

test("record safety profile blocks school, sensitive subject, and people privacy pending records", () => {
  const profile = buildRecordSafetyProfileV0({
    civicContext: {
      contextId: "civic:2",
      visitId: "visit-2",
      occurrenceId: "occ-2",
      contextKind: "school",
      activityLabel: "school walk",
      activityIntent: "discover",
      participantRole: "student",
      audienceScope: "class_group",
      publicPrecision: "site",
      riskLane: "rare_sensitive",
      reportConsent: "none",
      revisitOfVisitId: null,
      fieldId: "school-1",
      routeId: null,
      plotId: null,
      sourcePayload: {},
    },
    dataRights: null,
    place: {
      publicSafePlace: false,
      accessStatus: "permission_required",
      source: "school",
      adminLevel: "school",
      verificationLevel: "unverified",
    },
    occurrences: [{ riskLane: "rare_sensitive", safePublicRank: "unknown", vernacularName: "希少種" }],
    mediaAssets: [{
      publicUrl: "/uploads/photo.jpg",
      sourcePayload: { face_privacy: { status: "pending", faceCount: 0 } },
    }],
    homeAreaRepeatCount: 3,
  });

  assert.equal(profile.publicPlacePolicy, "school_or_child_sensitive");
  assert.equal(profile.publicPrecisionPolicy, "hidden");
  assert.equal(profile.mediaPublicPolicy, "held_for_face_privacy_review");
  assert.equal(profile.homeAreaRisk, "repeat_private_place_candidate");
  assert.equal(profile.sensitiveSubjectRisk, "school_or_child_context");
  assert.equal(profile.publicSummaryGate.ready, false);
  assert.match(profile.publicSummaryGate.blockers.join(","), /face_privacy_review_required/);
  assert.match(profile.publicSummaryGate.blockers.join(","), /school_or_child_context/);
  assert.equal(profile.municipalUseGate.ready, false);
});

test("record safety profile uses notice takedown media policy for ordinary public walk records", () => {
  const profile = buildRecordSafetyProfileV0({
    civicContext: {
      contextId: "civic:3",
      visitId: "visit-3",
      occurrenceId: "occ-3",
      contextKind: "ordinary",
      activityLabel: "scene walk",
      activityIntent: "share",
      participantRole: "photographer",
      audienceScope: "public",
      publicPrecision: "site",
      riskLane: "normal",
      reportConsent: "public_summary",
      revisitOfVisitId: null,
      fieldId: "park-3",
      routeId: "route-3",
      plotId: null,
      sourcePayload: {},
    },
    dataRights: {
      visitId: "visit-3",
      occurrenceId: "occ-3",
      recordConsent: "public_summary",
      researchUseConsent: "internal",
      enterpriseReportConsent: "aggregated",
      datasetLicense: null,
      mediaLicense: null,
      externalExportAllowed: false,
      withdrawalStatus: "active",
      sourcePayload: {},
    },
    place: {
      publicSafePlace: true,
      accessStatus: "public_access",
      source: "osm_park",
      adminLevel: "park",
      verificationLevel: "verified",
    },
    occurrences: [{ riskLane: "normal", safePublicRank: "species", vernacularName: "桜" }],
    mediaAssets: [{
      publicUrl: "/uploads/scene.jpg",
      sourcePayload: { face_privacy: { status: "pending", faceCount: 0 } },
    }],
  });

  assert.equal(profile.publicSummaryGate.ready, true);
  assert.match(profile.publicSummaryGate.reasons.join(","), /consumer_social_notice_takedown_media_policy/);
  assert.equal(profile.municipalUseGate.ready, false);
  assert.match(profile.municipalUseGate.blockers.join(","), /face_privacy_review_required_for_municipal_use/);
});
