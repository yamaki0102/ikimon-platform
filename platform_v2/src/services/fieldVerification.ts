import { getPool } from "../db.js";
import type { FieldSource } from "./observationFieldRegistry.js";

export type FieldVerificationLevel =
  | "unverified"
  | "registry_matched"
  | "page_verified"
  | "owner_verified"
  | "staff_verified";

export type FieldVerificationMethod =
  | "registry_import"
  | "public_registry"
  | "official_page_match"
  | "owner_domain_email"
  | "owner_domain_dns"
  | "well_known_file"
  | "authority_email"
  | "staff_email"
  | "manual_review"
  | "ai_match";

export type FieldVerificationStatus =
  | "pending"
  | "verified"
  | "needs_review"
  | "rejected"
  | "expired"
  | "revoked";

export type FieldVerificationSummary = {
  level: FieldVerificationLevel;
  method: FieldVerificationMethod | "";
  label: string;
  sourceConfidence: number;
};

const VERIFICATION_METHODS: readonly FieldVerificationMethod[] = [
  "registry_import",
  "public_registry",
  "official_page_match",
  "owner_domain_email",
  "owner_domain_dns",
  "well_known_file",
  "authority_email",
  "staff_email",
  "manual_review",
  "ai_match",
] as const;

const PHONE_METHOD_PATTERN = /phone|tel|sms|voice|call/i;

const LEVEL_WEIGHT: Record<FieldVerificationLevel, number> = {
  unverified: 0,
  registry_matched: 1,
  page_verified: 2,
  owner_verified: 3,
  staff_verified: 4,
};

const LEVEL_CONFIDENCE: Record<FieldVerificationLevel, number> = {
  unverified: 0,
  registry_matched: 0.65,
  page_verified: 0.78,
  owner_verified: 0.95,
  staff_verified: 0.9,
};

const DEFAULT_LABEL: Record<FieldVerificationLevel, string> = {
  unverified: "未確認",
  registry_matched: "公的台帳と一致",
  page_verified: "公式ページで確認",
  owner_verified: "設置者により確認済み",
  staff_verified: "担当者確認済み",
};

export function isSupportedVerificationMethod(value: unknown): value is FieldVerificationMethod {
  return typeof value === "string" &&
    !PHONE_METHOD_PATTERN.test(value) &&
    (VERIFICATION_METHODS as readonly string[]).includes(value);
}

export function assertSupportedVerificationMethod(value: unknown): asserts value is FieldVerificationMethod {
  if (!isSupportedVerificationMethod(value)) {
    throw new Error("unsupported_field_verification_method");
  }
}

export function verificationLabel(level: FieldVerificationLevel, label?: string | null): string {
  const clean = typeof label === "string" ? label.trim() : "";
  return clean || DEFAULT_LABEL[level] || DEFAULT_LABEL.unverified;
}

export function importedFieldVerificationSummary(input: {
  source: FieldSource;
  adminLevel?: string | null;
  entityKey?: string | null;
  certificationId?: string | null;
  certificationUrl?: string | null;
}): FieldVerificationSummary | null {
  const entityKey = String(input.entityKey ?? "");
  const certificationId = String(input.certificationId ?? "");
  const certificationUrl = String(input.certificationUrl ?? "");
  const isSchool = input.source === "school" || input.adminLevel === "school";
  if (isSchool && (
    entityKey.startsWith("mext_school:") ||
    entityKey.startsWith("ksj_p29:") ||
    certificationId.startsWith("mext-school:")
  )) {
    return {
      level: "registry_matched",
      method: "public_registry",
      label: "学校台帳と一致",
      sourceConfidence: LEVEL_CONFIDENCE.registry_matched,
    };
  }
  if (["nature_symbiosis_site", "protected_area", "oecm"].includes(input.source) && (certificationId || certificationUrl)) {
    return {
      level: "registry_matched",
      method: "public_registry",
      label: input.source === "nature_symbiosis_site" ? "認定情報と一致" : "公的データと一致",
      sourceConfidence: 0.95,
    };
  }
  return null;
}

export function chooseBestVerificationSummary(
  claims: Array<{
    verificationLevel: FieldVerificationLevel;
    verificationMethod: FieldVerificationMethod;
    status: FieldVerificationStatus;
    label?: string | null;
    aiMatchScore?: number | null;
  }>,
): FieldVerificationSummary {
  const verified = claims
    .filter((claim) => claim.status === "verified")
    .sort((a, b) => LEVEL_WEIGHT[b.verificationLevel] - LEVEL_WEIGHT[a.verificationLevel]);
  const best = verified[0];
  if (!best) {
    return { level: "unverified", method: "", label: DEFAULT_LABEL.unverified, sourceConfidence: 0 };
  }
  const aiScore = typeof best.aiMatchScore === "number" && Number.isFinite(best.aiMatchScore)
    ? Math.max(0, Math.min(1, best.aiMatchScore))
    : 0;
  return {
    level: best.verificationLevel,
    method: best.verificationMethod,
    label: verificationLabel(best.verificationLevel, best.label),
    sourceConfidence: Math.max(LEVEL_CONFIDENCE[best.verificationLevel] ?? 0, aiScore),
  };
}

export async function recordFieldVerificationClaim(input: {
  fieldId: string;
  issuerId?: string | null;
  verificationLevel: Exclude<FieldVerificationLevel, "unverified">;
  verificationMethod: FieldVerificationMethod;
  status: FieldVerificationStatus;
  evidenceUrl?: string;
  evidenceDomain?: string;
  claimantEmail?: string;
  aiMatchScore?: number | null;
  label?: string;
  note?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  assertSupportedVerificationMethod(input.verificationMethod);
  const pool = getPool();
  const verifiedAt = input.status === "verified" ? new Date().toISOString() : null;
  await pool.query(
    `INSERT INTO field_verification_claims (
       field_id, issuer_id, verification_level, verification_method, status,
       evidence_url, evidence_domain, claimant_email, ai_match_score,
       label, note, payload, verified_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12::jsonb, $13
     )`,
    [
      input.fieldId,
      input.issuerId ?? null,
      input.verificationLevel,
      input.verificationMethod,
      input.status,
      input.evidenceUrl ?? "",
      input.evidenceDomain ?? "",
      input.claimantEmail ?? "",
      input.aiMatchScore ?? null,
      input.label ?? "",
      input.note ?? "",
      JSON.stringify(input.payload ?? {}),
      verifiedAt,
    ],
  );
  if (input.status === "verified") {
    await pool.query(
      `UPDATE observation_fields
          SET verification_level = $2,
              verification_method = $3,
              verification_label = $4,
              verification_updated_at = NOW(),
              source_confidence = GREATEST(source_confidence, $5)
        WHERE field_id = $1`,
      [
        input.fieldId,
        input.verificationLevel,
        input.verificationMethod,
        verificationLabel(input.verificationLevel, input.label),
        chooseBestVerificationSummary([{
          verificationLevel: input.verificationLevel,
          verificationMethod: input.verificationMethod,
          status: input.status,
          label: input.label,
          aiMatchScore: input.aiMatchScore,
        }]).sourceConfidence,
      ],
    );
  }
}
