import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSupportedVerificationMethod,
  chooseBestVerificationSummary,
  importedFieldVerificationSummary,
  isSupportedVerificationMethod,
} from "./fieldVerification.js";

test("field verification deliberately excludes phone and SMS methods", () => {
  assert.equal(isSupportedVerificationMethod("owner_domain_email"), true);
  assert.equal(isSupportedVerificationMethod("phone_call"), false);
  assert.equal(isSupportedVerificationMethod("sms_code"), false);
  assert.equal(isSupportedVerificationMethod("telephone"), false);
  assert.throws(() => assertSupportedVerificationMethod("phone_call"), /unsupported_field_verification_method/);
});

test("school registry imports can be verified without a school-owned domain", () => {
  const summary = importedFieldVerificationSummary({
    source: "school",
    adminLevel: "school",
    entityKey: "mext_school:B122210001234",
    certificationId: "mext-school:B122210001234",
  });

  assert.equal(summary?.level, "registry_matched");
  assert.equal(summary?.method, "public_registry");
  assert.equal(summary?.label, "学校台帳と一致");
});

test("verification summary prefers stronger verified evidence", () => {
  const summary = chooseBestVerificationSummary([
    {
      verificationLevel: "registry_matched",
      verificationMethod: "public_registry",
      status: "verified",
      label: "学校台帳と一致",
    },
    {
      verificationLevel: "owner_verified",
      verificationMethod: "authority_email",
      status: "verified",
      label: "教育委員会により確認済み",
    },
    {
      verificationLevel: "staff_verified",
      verificationMethod: "staff_email",
      status: "pending",
      label: "担当者確認待ち",
    },
  ]);

  assert.equal(summary.level, "owner_verified");
  assert.equal(summary.method, "authority_email");
  assert.equal(summary.label, "教育委員会により確認済み");
  assert.equal(summary.sourceConfidence, 0.95);
});
