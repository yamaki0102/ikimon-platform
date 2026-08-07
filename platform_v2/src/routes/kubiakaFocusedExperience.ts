import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { ObservationUpsertInput } from "../services/observationWrite.js";

export const KUBIAKA_EXPERIENCE_KEY = "kubiaka-watch";
export const KUBIAKA_ENTRY_PATH = "/kubiaka";
export const KUBIAKA_RECORD_PATH = "/kubiaka/record";
export const KUBIAKA_MEMBER_PATH = "/kubiaka/me";
export const KUBIAKA_GENERIC_UPSERT_PATH = "/api/v1/observations/upsert";
export const KUBIAKA_UPSERT_PATH = "/api/v1/kubiaka/observations/upsert";
export const KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX = "/api/v1/kubiaka/observations";
export const KUBIAKA_CONTEXT_VERSION = "kubiaka-private-entry-v1";
export const KUBIAKA_PROTOCOL_PROFILE = "casual-sakura-photo-v1";
export const KUBIAKA_ACKNOWLEDGEMENT_LABEL = "Private acknowledgement";
export const KUBIAKA_MAX_PHOTOS = 6;

/**
 * Compatibility type for old callers. PostgreSQL is intentionally not part of
 * the request runtime anymore; Cloudflare Worker + D1 owns this experience.
 */
export type KubiakaDbQuery = <T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
) => Promise<{ rows: T[] }>;

export type OwnedKubiakaAcknowledgement = {
  recordId: string;
  visitId: string;
  photoCount: number;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeOptionalText(value: unknown, maxLength = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function safePhotoHashes(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, 256))
      .filter(Boolean)
      .slice(0, KUBIAKA_MAX_PHOTOS)
    : [];
}

export function isKubiakaFocusedExperienceEnabled(rawValue = process.env.KUBIAKA_FOCUSED_EXPERIENCE_ENABLED): boolean {
  return !["0", "false", "off", "no"].includes(String(rawValue ?? "").trim().toLowerCase());
}

export function rewriteKubiakaUpsertUrl(url: string): string {
  return url.includes(KUBIAKA_GENERIC_UPSERT_PATH) ? url.replace(KUBIAKA_GENERIC_UPSERT_PATH, KUBIAKA_UPSERT_PATH) : url;
}

export function rewriteKubiakaPhotoUploadUrl(url: string): string {
  return url.replace(/\/api\/v1\/observations\/([^/?]+)\/photos\/upload(?=\?|$)/, `${KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX}/$1/photos/upload`);
}

function localizedHref(basePath: string, path: string, lang: SiteLang): string {
  return withBasePath(basePath, appendLangToHref(path, lang));
}

export function resolveKubiakaCurrentPath(basePath: string, url: string): string {
  const normalizedUrl = String(url || "/");
  const normalizedBase = String(basePath || "").replace(/\/$/, "");
  if (!normalizedBase) return normalizedUrl;
  if (normalizedUrl === normalizedBase || normalizedUrl.startsWith(`${normalizedBase}/`) || normalizedUrl.startsWith(`${normalizedBase}?`)) return normalizedUrl;
  return withBasePath(normalizedBase, normalizedUrl);
}

export function rewriteKubiakaRecordDocument(html: string, basePath: string, lang: SiteLang): string {
  const dedicatedTarget = localizedHref(basePath, `${KUBIAKA_RECORD_PATH}?start=photo`, lang);
  return ["photo", "video", "gallery"].reduce((result, kind) => {
    const genericTargets = [
      localizedHref(basePath, `/record?start=${kind}`, lang),
      withBasePath(basePath, `/record?start=${kind}`),
    ];
    return genericTargets.reduce(
      (next, genericTarget) => next.split(JSON.stringify(genericTarget)).join(JSON.stringify(dedicatedTarget)),
      result,
    );
  }, html);
}

export function resolveKubiakaMediaCount(input: ObservationUpsertInput): number {
  const sourcePayload = objectRecord(input.sourcePayload);
  const inlineCount = Array.isArray(input.photos) ? input.photos.length : 0;
  const hasDeclaredCount = sourcePayload.media_count !== undefined && sourcePayload.media_count !== null;
  const declaredCount = hasDeclaredCount ? Number(sourcePayload.media_count) : inlineCount;
  if (!Number.isInteger(declaredCount) || declaredCount < 1) throw new Error("kubiaka_photo_required");
  if (declaredCount > KUBIAKA_MAX_PHOTOS || inlineCount > KUBIAKA_MAX_PHOTOS) throw new Error("kubiaka_photo_limit_exceeded");
  if (inlineCount > 0 && hasDeclaredCount && inlineCount !== declaredCount) throw new Error("kubiaka_photo_count_mismatch");
  return declaredCount;
}

export function buildKubiakaObservationInput(input: ObservationUpsertInput, userId: string): ObservationUpsertInput {
  const sourcePayload = objectRecord(input.sourcePayload);
  const mediaCount = resolveKubiakaMediaCount(input);
  return {
    userId,
    observedAt: String(input.observedAt ?? ""),
    latitude: typeof input.latitude === "number" ? input.latitude : null,
    longitude: typeof input.longitude === "number" ? input.longitude : null,
    country: safeOptionalText(input.country, 80),
    prefecture: safeOptionalText(input.prefecture, 120),
    municipality: safeOptionalText(input.municipality, 120),
    localityNote: safeOptionalText(input.localityNote, 300),
    note: safeOptionalText(input.note, 1000),
    visitMode: "manual",
    completeChecklistFlag: false,
    targetTaxaScope: null,
    taxon: null,
    subjects: [{ isPrimary: true, roleHint: "primary" }],
    aiAssessmentStatus: "not_requested",
    clientSubmissionId: input.clientSubmissionId,
    sourcePayload: {
      source: "kubiaka_private_entry",
      record_mode: "quick",
      quick_capture_state: "present",
      media_count: mediaCount,
      client_photo_sha256s: safePhotoHashes(sourcePayload.client_photo_sha256s),
      subject_inference: "disabled",
      experience_key: KUBIAKA_EXPERIENCE_KEY,
      experience_context_version: KUBIAKA_CONTEXT_VERSION,
      entrypoint: KUBIAKA_RECORD_PATH,
      protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
      manual_photo_record: true,
      private_record: true,
      survey_non_detection_allowed: false,
      automatic_taxon_confirmation_allowed: false,
      public_aggregation_allowed: false,
      research_use_allowed: false,
      enterprise_use_allowed: false,
      external_export_allowed: false,
      external_routing_allowed: false,
      automatic_recipient_delivery_allowed: false,
    },
    dataRights: {
      recordConsent: "private",
      researchUseConsent: "none",
      enterpriseReportConsent: "none",
      datasetLicense: null,
      mediaLicense: "all_rights_reserved",
      externalExportAllowed: false,
      areaProfileUseConsent: "none",
      publicAggregationAllowed: false,
      publicProfileAttributionMode: "hidden",
      consentSource: "default",
      sourcePayload: {
        experience_key: KUBIAKA_EXPERIENCE_KEY,
        protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
        enforced_by: KUBIAKA_UPSERT_PATH,
      },
    },
  };
}

/** Legacy PostgreSQL enforcement is retired. Native D1 writes own this scope. */
export async function enforceKubiakaVisitPrivate(_query: KubiakaDbQuery, _visitId: string, _userId: string): Promise<void> {
  throw new Error("kubiaka_cloudflare_native_required");
}

/** Legacy PostgreSQL acknowledgement lookup is retired and fails closed. */
export async function findOwnedKubiakaAcknowledgement(_query: KubiakaDbQuery, _recordId: string, _userId: string): Promise<OwnedKubiakaAcknowledgement | null> {
  return null;
}

/** The old Fastify registration is intentionally inert after Cloudflare cutover. */
export async function registerKubiakaFocusedExperienceRoutes(app: unknown): Promise<void> {
  void app;
}

export function kubiakaForwardedBasePath(headers: Record<string, unknown>): string {
  return getForwardedBasePath(headers);
}
