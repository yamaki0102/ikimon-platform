import assert from "node:assert/strict";
import test from "node:test";
import { buildCivicReportDraft } from "./civicNatureReports.js";
import { buildRecordSafetyProfileV0 } from "./recordSafetyProfile.js";

test("risk confirmation memo keeps claims bounded", () => {
  const draft = buildCivicReportDraft({
    kind: "risk_confirmation_memo",
    observations: [{ label: "外来種候補", evidence: ["写真", "位置"] }],
  });

  assert.equal(draft.audience, "自治体・管理者・観察会主催者");
  assert.match(draft.decisionUse, /断定せず/);
  assert.ok(draft.limitations.some((line) => line.includes("行政判断そのものではない")));
});

test("satoyama report carries management actions as internal notes", () => {
  const draft = buildCivicReportDraft({
    kind: "satoyama_management_record",
    managementActions: [{ label: "草刈り", happenedAt: "2026-05-03", note: "南区画" }],
  });

  assert.equal(draft.audience, "里山・農園管理者、地域団体");
  assert.ok(draft.internalNotes.some((line) => line.includes("草刈り")));
});

test("civic report public summary is suppressed until record safety profile passes", () => {
  const safetyProfile = buildRecordSafetyProfileV0({
    civicContext: {
      contextId: "civic:school",
      visitId: "visit-school",
      occurrenceId: "occ-school",
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
    occurrences: [{ riskLane: "rare_sensitive", safePublicRank: "unknown", vernacularName: "sensitive subject" }],
    mediaAssets: [{
      publicUrl: "/uploads/school.jpg",
      sourcePayload: { face_privacy: { status: "pending" } },
    }],
  });

  const draft = buildCivicReportDraft({
    kind: "school_monthly_note",
    observations: [{ label: "sensitive exact school record", evidence: ["photo", "exact place"] }],
    safetyProfile,
  });

  assert.equal(draft.publicSummary.length, 1);
  assert.match(draft.publicSummary[0] ?? "", /安全確認中/);
  assert.doesNotMatch(draft.publicSummary.join(","), /sensitive exact school record/);
  assert.ok(draft.internalNotes.some((line) => line.includes("public_summary_blocked")));
  assert.ok(draft.limitations.some((line) => line.includes("record_safety_profile/v0")));
});
