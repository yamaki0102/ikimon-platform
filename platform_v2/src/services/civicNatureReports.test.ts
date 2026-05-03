import assert from "node:assert/strict";
import test from "node:test";
import { buildCivicReportDraft } from "./civicNatureReports.js";

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
