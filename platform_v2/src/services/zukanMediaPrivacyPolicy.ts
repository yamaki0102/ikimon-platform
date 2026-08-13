export const ZUKAN_MEDIA_PRIVACY_POLICY_VERSION = "zukan.media-privacy/v1" as const;

export type ZukanPublicDerivativeMetadata = Readonly<{
  scannedContainer?: string | null;
  gpsExifPresent?: boolean | null;
  exifPresent?: boolean | null;
  gpsPresent?: boolean | null;
  xmpPresent?: boolean | null;
  exactCoordinateLiteralPresent?: boolean | null;
}>;

export type ZukanMediaPrivacyPolicyInput = Readonly<{
  publicMediaUrl?: string | null;
  publicDerivativeVerifiedAt?: string | null;
  publicDerivativeMetadata?: ZukanPublicDerivativeMetadata | null;
  exifScrubState?: string | null;
  publicReadyAt?: string | null;
}>;

export type ZukanMediaPrivacyPolicyReason =
  | "metadata_privacy_unverified"
  | "metadata_privacy_not_scrubbed"
  | "metadata_privacy_inspection_missing"
  | "metadata_privacy_failed"
  | "public_media_not_ready"
  | "public_media_missing"
  | "metadata_privacy_verified";

export type ZukanMediaPrivacyPolicyDecision = Readonly<{
  canExposePublicMedia: boolean;
  publicMediaUrl: string | null;
  reason: ZukanMediaPrivacyPolicyReason;
  policyVersion: typeof ZUKAN_MEDIA_PRIVACY_POLICY_VERSION;
}>;

const PRIVACY_FLAGS = [
  "gpsExifPresent",
  "exifPresent",
  "gpsPresent",
  "xmpPresent",
  "exactCoordinateLiteralPresent",
] as const satisfies readonly (keyof ZukanPublicDerivativeMetadata)[];

const ALLOWED_DERIVATIVE_CONTAINERS = new Set(["audio", "mp4", "webp"]);

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalized(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function decision(
  canExposePublicMedia: boolean,
  publicMediaUrl: string | null,
  reason: ZukanMediaPrivacyPolicyReason,
): ZukanMediaPrivacyPolicyDecision {
  return {
    canExposePublicMedia,
    publicMediaUrl,
    reason,
    policyVersion: ZUKAN_MEDIA_PRIVACY_POLICY_VERSION,
  };
}

function metadataPrivacyIsVerified(metadata: ZukanPublicDerivativeMetadata): boolean {
  const container = normalized(metadata.scannedContainer);
  if (!ALLOWED_DERIVATIVE_CONTAINERS.has(container)) return false;
  return PRIVACY_FLAGS.every((flag) => metadata[flag] === false);
}

/**
 * Pure, source-only publication gate for a public media derivative.
 *
 * The candidate URL is deliberately returned only after every metadata/privacy
 * condition has passed. Missing or malformed verification facts fail closed.
 */
export function decideZukanMediaPrivacyPolicy(
  input: ZukanMediaPrivacyPolicyInput,
): ZukanMediaPrivacyPolicyDecision {
  if (!nonEmpty(input.publicDerivativeVerifiedAt)) {
    return decision(false, null, "metadata_privacy_unverified");
  }
  if (normalized(input.exifScrubState) !== "scrubbed") {
    return decision(false, null, "metadata_privacy_not_scrubbed");
  }
  if (!input.publicDerivativeMetadata) {
    return decision(false, null, "metadata_privacy_inspection_missing");
  }
  if (!metadataPrivacyIsVerified(input.publicDerivativeMetadata)) {
    return decision(false, null, "metadata_privacy_failed");
  }
  if (!nonEmpty(input.publicReadyAt)) {
    return decision(false, null, "public_media_not_ready");
  }
  const publicMediaUrl = typeof input.publicMediaUrl === "string" ? input.publicMediaUrl.trim() : "";
  if (!publicMediaUrl) {
    return decision(false, null, "public_media_missing");
  }

  return decision(true, publicMediaUrl, "metadata_privacy_verified");
}
