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
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ALLOWED_PUBLIC_MEDIA_PREFIXES = [
  "/derived/",
  "/derived-transform/",
  "/thumb/",
  "/uploads/",
  "/data/uploads/",
] as const;

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalized(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validTimestamp(value: string | null | undefined): boolean {
  if (!nonEmpty(value)) return false;
  const normalizedValue = value.trim();
  const match = ISO_TIMESTAMP_PATTERN.exec(normalizedValue);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] ? Number(match[10]) : 0;
  const offsetMinute = match[11] ? Number(match[11]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return month >= 1 && month <= 12
    && day >= 1 && day <= daysInMonth
    && hour >= 0 && hour <= 23
    && minute >= 0 && minute <= 59
    && second >= 0 && second <= 59
    && offsetHour >= 0 && offsetHour <= 23
    && offsetMinute >= 0 && offsetMinute <= 59
    && Number.isFinite(Date.parse(normalizedValue));
}

function allowedPublicMediaPath(value: string): boolean {
  if (!value || value.includes("\\") || CONTROL_CHARACTER_PATTERN.test(value)) return false;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (/(?:^|\/)\.\.(?:\/|$)/.test(decodedPath)) return false;
  return ALLOWED_PUBLIC_MEDIA_PREFIXES.some((prefix) => decodedPath.startsWith(prefix));
}

function publicMediaUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.length > 2048 || CONTROL_CHARACTER_PATTERN.test(normalizedValue)) return null;
  if (normalizedValue.startsWith("/")) {
    if (normalizedValue.startsWith("//")) return null;
    const path = normalizedValue.split(/[?#]/u, 1)[0] ?? "";
    return allowedPublicMediaPath(path) ? normalizedValue : null;
  }
  try {
    const parsed = new URL(normalizedValue);
    const allowedHost = parsed.hostname === "ikimon.life" || parsed.hostname.endsWith(".ikimon.life");
    const canonicalAuthority = parsed.username === ""
      && parsed.password === ""
      && (parsed.port === "" || parsed.port === "443");
    return parsed.protocol === "https:" && allowedHost && canonicalAuthority && allowedPublicMediaPath(parsed.pathname)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
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
  if (!validTimestamp(input.publicDerivativeVerifiedAt)) {
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
  if (!validTimestamp(input.publicReadyAt)) {
    return decision(false, null, "public_media_not_ready");
  }
  const verifiedPublicMediaUrl = publicMediaUrl(input.publicMediaUrl);
  if (!verifiedPublicMediaUrl) {
    return decision(false, null, "public_media_missing");
  }

  return decision(true, verifiedPublicMediaUrl, "metadata_privacy_verified");
}
