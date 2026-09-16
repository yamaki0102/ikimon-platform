/** Pure derived-guide freshness classification. No translation, audio or publication occurs here. */

export const DERIVED_GUIDE_FRESHNESS_SCHEMA = "zukan.derived-guide-freshness/v1" as const;
export type GuideFormat = "TEXT" | "EASY_JAPANESE" | "AUDIO";
export type GuideVisibility = "PUBLIC" | "PRIVATE";

export type DerivedGuideSource = {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly visibility: GuideVisibility;
  readonly approved: boolean;
};

export type DerivedGuideMetadata = {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly language: string;
  readonly format: GuideFormat;
  readonly visibility: GuideVisibility;
};

export type DerivedGuideFreshnessInput = {
  readonly source: DerivedGuideSource;
  readonly derivative: DerivedGuideMetadata;
};

export type DerivedGuideFreshnessResult = {
  readonly schema: typeof DERIVED_GUIDE_FRESHNESS_SCHEMA;
  readonly status: "CURRENT" | "STALE" | "REJECTED";
  readonly reason: "CURRENT_SOURCE_VERSION" | "SOURCE_VERSION_CHANGED" | "PRIVATE_SOURCE_FORBIDDEN" | "UNAPPROVED_SOURCE" | "SOURCE_MISMATCH" | "INVALID_METADATA";
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly derivative: Pick<DerivedGuideMetadata, "language" | "format"> | null;
  readonly publication: "NOT_DECIDED";
};

const formats: readonly GuideFormat[] = ["TEXT", "EASY_JAPANESE", "AUDIO"];
const visibilities: readonly GuideVisibility[] = ["PUBLIC", "PRIVATE"];

export function assessDerivedGuideFreshness(input: DerivedGuideFreshnessInput): DerivedGuideFreshnessResult {
  const sourceId = input.source.sourceId.trim();
  const sourceVersion = input.source.sourceVersion.trim();
  const derivativeSourceId = input.derivative.sourceId.trim();
  const derivativeSourceVersion = input.derivative.sourceVersion.trim();
  const derivative = { language: input.derivative.language.trim(), format: input.derivative.format };
  const base = { schema: DERIVED_GUIDE_FRESHNESS_SCHEMA, sourceId, sourceVersion, derivative, publication: "NOT_DECIDED" as const };

  if (
    !sourceId ||
    !sourceVersion ||
    !derivativeSourceId ||
    !derivativeSourceVersion ||
    !derivative.language ||
    !formats.includes(input.derivative.format) ||
    !visibilities.includes(input.source.visibility) ||
    !visibilities.includes(input.derivative.visibility)
  ) return { ...base, status: "REJECTED", reason: "INVALID_METADATA" };
  if (input.source.visibility !== "PUBLIC" || input.derivative.visibility !== "PUBLIC") {
    return { ...base, status: "REJECTED", reason: "PRIVATE_SOURCE_FORBIDDEN" };
  }
  if (!input.source.approved) return { ...base, status: "REJECTED", reason: "UNAPPROVED_SOURCE" };
  if (sourceId !== derivativeSourceId) return { ...base, status: "REJECTED", reason: "SOURCE_MISMATCH" };
  if (sourceVersion !== derivativeSourceVersion) return { ...base, status: "STALE", reason: "SOURCE_VERSION_CHANGED" };
  return { ...base, status: "CURRENT", reason: "CURRENT_SOURCE_VERSION" };
}
