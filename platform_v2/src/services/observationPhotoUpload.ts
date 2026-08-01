import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyObservation } from "../legacy/compatibilityWriter.js";
import { recordCompatibilityFailure, upsertAssetBlob } from "./writeSupportPg.js";
import { normalizeMediaRole, type MediaRole } from "./mediaRole.js";
import { upsertEvidenceAssetMediaRole } from "./evidenceAssetMediaRole.js";
import { enqueueMediaProcessingJobsStandalone } from "./mediaProcessingJobs.js";
import {
  createLegacyMediaObjectStore,
  type MediaObjectStore,
  type MediaObjectVisibility,
} from "./mediaObjectStore.js";

export const KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION = Symbol("kubiaka-private-upload-authorization");

export type ObservationPhotoUploadInput = {
  observationId: string;
  filename: string;
  mimeType: string;
  base64Data: string;
  mediaRole?: MediaRole | string | null;
  facePrivacy?: FacePrivacySummary | null;
  [KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION]?: true;
};

export type FacePrivacySummary = {
  detector?: string | null;
  status?: string | null;
  faceCount?: number | null;
  error?: string | null;
};

const ALLOWED_OBSERVATION_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY = "kubiaka-watch";
export const KUBIAKA_PRIVATE_PHOTO_MAX_COUNT = 6;

export type ObservationPhotoUploadResult = {
  visitId: string;
  occurrenceId: string;
  relativePath: string;
  publicUrl: string;
  compatibility: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
  facePrivacy: FacePrivacySummary | null;
};

type CreatedMediaObject = {
  visibility: MediaObjectVisibility;
  storagePath: string;
};

type ObservationPhotoTarget = {
  visit_id: string;
  occurrence_id: string;
  public_visibility: string | null;
  source_payload: Record<string, unknown> | null;
};

export function observationPhotoUploadTargetIds(observationId: string): string[] {
  const primary = observationId.trim();
  if (!primary) return [];
  const candidates = [primary];
  const occurrenceMatch = /^occ:([^:]+):\d+$/.exec(primary);
  if (occurrenceMatch?.[1]) {
    candidates.push(occurrenceMatch[1]);
  }
  return [...new Set(candidates)];
}

export function isKubiakaPrivatePhotoSourcePayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return String((value as Record<string, unknown>).experience_key ?? "").trim() === KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY;
}

export function assertKubiakaPrivatePhotoCapacity(
  existingPhotoCount: number,
  duplicateAlreadyExists: boolean,
): void {
  if (duplicateAlreadyExists) return;
  if (!Number.isInteger(existingPhotoCount) || existingPhotoCount < 0) {
    throw new Error("kubiaka_photo_count_invalid");
  }
  if (existingPhotoCount >= KUBIAKA_PRIVATE_PHOTO_MAX_COUNT) {
    throw new Error("kubiaka_photo_limit_exceeded");
  }
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const safe = trimmed.replace(/[^A-Za-z0-9._-]/g, "-");
  return safe === "" ? "upload.jpg" : safe;
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

function normalizeBase64(input: string): string {
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function assertInput(input: ObservationPhotoUploadInput): void {
  if (!input.observationId.trim()) {
    throw new Error("observationId is required");
  }
  if (!input.filename.trim()) {
    throw new Error("filename is required");
  }
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!ALLOWED_OBSERVATION_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("image mimeType is required");
  }
  if (!input.base64Data.trim()) {
    throw new Error("base64Data is required");
  }
}

function normalizeFacePrivacy(input: unknown): FacePrivacySummary | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : null;
  if (status && !["pending", "redacted", "no_faces", "unavailable"].includes(status)) return null;
  const faceCount = Number(record.faceCount);
  return {
    detector: typeof record.detector === "string" ? record.detector.slice(0, 80) : null,
    status,
    faceCount: Number.isFinite(faceCount) ? Math.max(0, Math.min(100, Math.round(faceCount))) : 0,
    error: typeof record.error === "string" ? record.error.slice(0, 120) : null,
  };
}

function canKeepPreparedJpeg(buffer: Buffer, mimeType: string, metadata: Metadata): boolean {
  const width = typeof metadata.width === "number" ? metadata.width : 0;
  const height = typeof metadata.height === "number" ? metadata.height : 0;
  const extraMetadata = metadata as Metadata & { iptc?: unknown; xmp?: unknown };
  const hasSensitiveMetadata = Boolean(metadata.exif || extraMetadata.iptc || extraMetadata.xmp);
  return mimeType === "image/jpeg"
    && metadata.format === "jpeg"
    && width > 0
    && height > 0
    && width <= 2560
    && height <= 2560
    && (!metadata.orientation || metadata.orientation === 1)
    && !hasSensitiveMetadata
    && buffer.byteLength <= 10 * 1024 * 1024;
}

async function normalizeObservationImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string; widthPx: number | null; heightPx: number | null }> {
  const normalizedMime = mimeType.trim().toLowerCase();
  try {
    const inputMetadata = await sharp(buffer, { failOn: "none" }).metadata();
    if (canKeepPreparedJpeg(buffer, normalizedMime, inputMetadata)) {
      return {
        buffer,
        mimeType: "image/jpeg",
        widthPx: inputMetadata.width ?? null,
        heightPx: inputMetadata.height ?? null,
      };
    }
    const image = sharp(buffer, { failOn: "none" }).rotate().resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    });
    const pipeline = normalizedMime === "image/png"
      ? image.png({ compressionLevel: 8, adaptiveFiltering: true })
      : normalizedMime === "image/webp"
        ? image.webp({ quality: 86, effort: 4 })
        : image.jpeg({ quality: 88, mozjpeg: true });
    const output = await pipeline.toBuffer();
    const metadata = await sharp(output, { failOn: "none" }).metadata();
    return {
      buffer: output,
      mimeType: normalizedMime === "image/png" || normalizedMime === "image/webp" ? normalizedMime : "image/jpeg",
      widthPx: typeof metadata.width === "number" ? metadata.width : null,
      heightPx: typeof metadata.height === "number" ? metadata.height : null,
    };
  } catch {
    throw new Error("image_normalization_failed");
  }
}

async function cleanupCreatedObservationMedia(
  mediaObjectStore: MediaObjectStore,
  createdObjects: CreatedMediaObject[],
): Promise<void> {
  const failures: unknown[] = [];
  for (const object of [...createdObjects].reverse()) {
    try {
      await mediaObjectStore.delete(object);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "observation_photo_compensation_failed");
  }
}

export async function uploadObservationPhoto(input: ObservationPhotoUploadInput): Promise<ObservationPhotoUploadResult> {
  assertInput(input);

  const config = loadConfig();
  const mediaObjectStore = createLegacyMediaObjectStore({
    publicRoot: config.legacyPublicRoot,
    privateRoot: config.legacyDataRoot,
  });
  const pool = getPool();
  const normalizedBase64 = normalizeBase64(input.base64Data);
  const originalBuffer = Buffer.from(normalizedBase64, "base64");
  if (originalBuffer.byteLength === 0) {
    throw new Error("decoded image is empty");
  }
  if (originalBuffer.byteLength > 18 * 1024 * 1024) {
    throw new Error("image exceeds upload preflight limit");
  }
  const normalizedImage = await normalizeObservationImage(originalBuffer, input.mimeType);
  const buffer = normalizedImage.buffer;
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("image exceeds 10MB limit after normalization");
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const mediaRole = normalizeMediaRole(input.mediaRole);
  const facePrivacy = normalizeFacePrivacy(input.facePrivacy);
  const safeBase = sanitizeFilename(input.filename).replace(/\.[A-Za-z0-9]+$/, "");
  const fileName = `${safeBase}-${sha256.slice(0, 12)}${extensionForMime(normalizedImage.mimeType)}`;

  let visitId = "";
  let occurrenceId = "";
  let relativePath = "";
  let originalRelativePath = "";
  let privateKubiakaUpload = false;
  const createdMediaObjects: CreatedMediaObject[] = [];
  const client = await pool.connect();

  try {
    await client.query("begin");

    const targetIds = observationPhotoUploadTargetIds(input.observationId);
    const targetResult = await client.query<ObservationPhotoTarget>(
      `select
          v.visit_id,
          o.occurrence_id,
          v.public_visibility,
          v.source_payload
       from visits v
       join occurrences o on o.visit_id = v.visit_id
       where v.visit_id = any($1::text[])
          or v.legacy_observation_id = any($1::text[])
          or o.occurrence_id = any($1::text[])
       order by case
          when o.occurrence_id = $2 then 0
          when v.visit_id = $2 or v.legacy_observation_id = $2 then 1
          else 2
       end,
       o.subject_index asc, o.created_at asc
       limit 1`,
      [targetIds, input.observationId.trim()],
    );

    const target = targetResult.rows[0];
    if (!target) {
      throw new Error("observation_not_found");
    }

    visitId = target.visit_id;
    occurrenceId = target.occurrence_id;
    privateKubiakaUpload = isKubiakaPrivatePhotoSourcePayload(target.source_payload);
    if (privateKubiakaUpload && input[KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION] !== true) {
      throw new Error("kubiaka_private_upload_endpoint_required");
    }
    if (privateKubiakaUpload && target.public_visibility !== "hidden") {
      throw new Error("kubiaka_private_visibility_required");
    }
    relativePath = path.posix.join(
      privateKubiakaUpload ? "private-photos" : "uploads",
      "v2-observations",
      visitId,
      fileName,
    );
    originalRelativePath = path.posix.join("photo-originals", "v2-observations", visitId, fileName);

    if (privateKubiakaUpload) {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`observation-photo-count:${visitId}`],
      );
    }

    // Serialise identical observation/hash uploads. The lock remains held until
    // commit/rollback, so cleanup cannot race a successful retry of the same file.
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`observation-photo:${visitId}:${sha256}`],
    );

    const legacyAssetKey = `observation_photo:${visitId}:upload:${sha256}`;
    if (privateKubiakaUpload) {
      const capacityResult = await client.query<{
        photo_count: string | number;
        duplicate_exists: boolean;
      }>(
        `select count(*)::int as photo_count,
                coalesce(bool_or(legacy_asset_key = $2), false) as duplicate_exists
           from evidence_assets
          where visit_id = $1
            and asset_role = 'observation_photo'`,
        [visitId, legacyAssetKey],
      );
      const capacity = capacityResult.rows[0];
      assertKubiakaPrivatePhotoCapacity(
        Number(capacity?.photo_count ?? 0),
        capacity?.duplicate_exists === true,
      );
    }

    const originalInput: CreatedMediaObject = {
      visibility: "private",
      storagePath: originalRelativePath,
    };
    const originalExisted = await mediaObjectStore.exists(originalInput);
    let originalObject;
    if (originalExisted) {
      originalObject = mediaObjectStore.reference(originalInput);
    } else {
      createdMediaObjects.push(originalInput);
      originalObject = await mediaObjectStore.write({ ...originalInput, buffer });
    }

    // Kubiaka display copies stay in the private store. Non-managed observations
    // retain the existing public display-copy behavior.
    const publicInput: CreatedMediaObject = {
      visibility: privateKubiakaUpload ? "private" : "public",
      storagePath: relativePath,
    };
    const publicExisted = await mediaObjectStore.exists(publicInput);
    let publicObject;
    if (publicExisted) {
      publicObject = mediaObjectStore.reference(publicInput);
    } else {
      createdMediaObjects.push(publicInput);
      publicObject = await mediaObjectStore.write({ ...publicInput, buffer });
    }

    const originalBlobId = await upsertAssetBlob(client, {
      storageBackend: originalObject.storageBackend,
      storagePath: originalObject.storagePath,
      mediaType: "image",
      mimeType: normalizedImage.mimeType,
      publicUrl: originalObject.publicUrl,
      sha256,
      bytes: buffer.byteLength,
      widthPx: normalizedImage.widthPx,
      heightPx: normalizedImage.heightPx,
      sourcePayload: {
        source: "v2_photo_upload_original",
        visit_id: visitId,
        media_role: mediaRole,
        face_privacy: facePrivacy,
        privacy_processing_status: privateKubiakaUpload ? "private_no_public_processing" : "pending",
        private_storage_root: "legacy_data",
        display_relative_path: relativePath,
        private_experience: privateKubiakaUpload,
        normalized_max_edge_px: 2560,
        original_bytes: originalBuffer.byteLength,
      },
    });

    const originalLegacyAssetKey = `observation_photo_original:${visitId}:upload:${sha256}`;
    await client.query(
      `insert into evidence_assets (
          asset_id, blob_id, occurrence_id, visit_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
       ) values (
          $1::uuid, $2::uuid, $3, $4, 'observation_photo_original', $5, $6, $7::jsonb
       )
       on conflict (legacy_asset_key) do update set
          blob_id = excluded.blob_id,
          occurrence_id = excluded.occurrence_id,
          visit_id = excluded.visit_id,
          legacy_relative_path = excluded.legacy_relative_path,
          source_payload = excluded.source_payload`,
      [
        randomUUID(),
        originalBlobId,
        occurrenceId,
        visitId,
        originalLegacyAssetKey,
        originalRelativePath,
        JSON.stringify({
          source: "v2_photo_upload_original",
          filename: input.filename,
          media_role: mediaRole,
          face_privacy: facePrivacy,
          privacy_processing_status: privateKubiakaUpload ? "private_no_public_processing" : "pending",
          private_storage_root: "legacy_data",
          display_relative_path: relativePath,
          private_experience: privateKubiakaUpload,
        }),
      ],
    );

    const blobId = await upsertAssetBlob(client, {
      storageBackend: publicObject.storageBackend,
      storagePath: publicObject.storagePath,
      mediaType: "image",
      mimeType: normalizedImage.mimeType,
      publicUrl: publicObject.publicUrl,
      sha256,
      bytes: buffer.byteLength,
      widthPx: normalizedImage.widthPx,
      heightPx: normalizedImage.heightPx,
      sourcePayload: {
        source: privateKubiakaUpload ? "kubiaka_private_photo_upload" : "v2_photo_upload",
        visit_id: visitId,
        media_role: mediaRole,
        face_privacy: facePrivacy,
        privacy_processing_status: privateKubiakaUpload ? "private_no_public_processing" : "pending",
        original_relative_path: originalRelativePath,
        original_storage_backend: originalObject.storageBackend,
        private_experience: privateKubiakaUpload,
        public_delivery_allowed: !privateKubiakaUpload,
        normalized_max_edge_px: 2560,
        original_bytes: originalBuffer.byteLength,
      },
    });

    const assetResult = await client.query<{ asset_id: string }>(
      `insert into evidence_assets (
          asset_id, blob_id, occurrence_id, visit_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
       ) values (
          $1::uuid, $2::uuid, $3, $4, 'observation_photo', $5, $6, $7::jsonb
       )
       on conflict (legacy_asset_key) do update set
          blob_id = excluded.blob_id,
          occurrence_id = excluded.occurrence_id,
          visit_id = excluded.visit_id,
          legacy_relative_path = excluded.legacy_relative_path,
          source_payload = excluded.source_payload
       returning asset_id::text`,
      [
        randomUUID(),
        blobId,
        occurrenceId,
        visitId,
        legacyAssetKey,
        relativePath,
        JSON.stringify({
          source: privateKubiakaUpload ? "kubiaka_private_photo_upload" : "v2_photo_upload",
          filename: input.filename,
          media_role: mediaRole,
          face_privacy: facePrivacy,
          privacy_processing_status: privateKubiakaUpload ? "private_no_public_processing" : "pending",
          original_relative_path: originalRelativePath,
          private_experience: privateKubiakaUpload,
          public_delivery_allowed: !privateKubiakaUpload,
        }),
      ],
    );
    const assetId = assetResult.rows[0]?.asset_id;
    if (!assetId) {
      throw new Error("failed_to_upsert_photo_asset");
    }
    await upsertEvidenceAssetMediaRole(client, {
      assetId,
      occurrenceId,
      visitId,
      assetRole: "observation_photo",
      mediaRole,
      mediaRoleSource: "user",
      sourcePayload: {
        source: privateKubiakaUpload ? "kubiaka_private_photo_upload" : "v2_photo_upload",
        filename: input.filename,
        facePrivacy,
        privacy_processing_status: privateKubiakaUpload ? "private_no_public_processing" : "pending",
        original_relative_path: originalRelativePath,
        private_experience: privateKubiakaUpload,
      },
    });

    await client.query(
      `update visits
          set public_visibility = case
                when coalesce(source_payload->>'experience_key', '') = $2
                then 'hidden'
                when visit_id like 'prod-media-smoke-%'
                  or coalesce(source_payload->>'source', '') = 'prod_media_smoke'
                then 'hidden'
                else 'public'
              end,
              quality_review_status = case
                when visit_id like 'prod-media-smoke-%'
                  or coalesce(source_payload->>'source', '') = 'prod_media_smoke'
                then 'archived'
                else 'accepted'
              end,
              quality_gate_reasons = case
                when visit_id like 'prod-media-smoke-%'
                  or coalesce(source_payload->>'source', '') = 'prod_media_smoke'
                then case
                  when coalesce(quality_gate_reasons, '[]'::jsonb) ? 'production_smoke_record'
                  then coalesce(quality_gate_reasons, '[]'::jsonb)
                  else coalesce(quality_gate_reasons, '[]'::jsonb) || '["production_smoke_record"]'::jsonb
                end
                else coalesce((
                  select jsonb_agg(reason)
                    from jsonb_array_elements_text(coalesce(quality_gate_reasons, '[]'::jsonb)) as reasons(reason)
                   where reason <> 'missing_photo'
                ), '[]'::jsonb)
              end,
              updated_at = now()
        where visit_id = $1`,
      [visitId, KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY],
    );

    await client.query(
      `update observation_quality_reviews
          set review_status = case
                when exists (
                  select 1 from visits v
                   where v.visit_id = observation_quality_reviews.visit_id
                     and (
                       v.visit_id like 'prod-media-smoke-%'
                       or coalesce(v.source_payload->>'source', '') = 'prod_media_smoke'
                     )
                )
                then 'archived'
                else 'accepted'
              end,
              public_visibility = case
                when exists (
                  select 1 from visits v
                   where v.visit_id = observation_quality_reviews.visit_id
                     and (
                       coalesce(v.source_payload->>'experience_key', '') = $2
                       or v.visit_id like 'prod-media-smoke-%'
                       or coalesce(v.source_payload->>'source', '') = 'prod_media_smoke'
                     )
                )
                then 'hidden'
                else 'public'
              end,
              reviewed_at = coalesce(reviewed_at, now()),
              updated_at = now()
        where visit_id = $1
          and reason_code = 'native_no_photo'
          and review_status = 'needs_review'`,
      [visitId, KUBIAKA_PRIVATE_PHOTO_EXPERIENCE_KEY],
    );

    await client.query("commit");
  } catch (error) {
    // Delete only files created by this transaction while the advisory lock is
    // still held. Existing valid files are never part of the compensation set.
    try {
      await cleanupCreatedObservationMedia(mediaObjectStore, createdMediaObjects);
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error("[observation-photo-upload] compensation cleanup failed", cleanupError);
    }
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      // eslint-disable-next-line no-console
      console.error("[observation-photo-upload] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }

  const compatibility = {
    attempted: config.compatibilityWriteEnabled && !privateKubiakaUpload,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (compatibility.attempted) {
    try {
      await writeLegacyObservation(visitId, {
        legacyDataRoot: config.legacyDataRoot,
        publicRoot: config.legacyPublicRoot,
      });
      compatibility.succeeded = true;
    } catch (error) {
      compatibility.error = error instanceof Error ? error.message : "compatibility_write_failed";
      const failureClient = await pool.connect();
      try {
        await recordCompatibilityFailure(failureClient, "observation_photo", visitId, config.legacyDataRoot, {
          error: compatibility.error,
        });
      } finally {
        failureClient.release();
      }
    }
  }

  if (!privateKubiakaUpload) {
    try {
      await enqueueMediaProcessingJobsStandalone([{
        mediaKind: "photo",
        mediaUid: occurrenceId,
        observationId: visitId,
        occurrenceId,
        jobType: "photo_ready_reassess",
        sourcePayload: {
          source: "v2_photo_upload",
          uploaded_observation_id: input.observationId,
          media_role: mediaRole,
          face_privacy: facePrivacy,
          relative_path: relativePath,
          original_relative_path: originalRelativePath,
          privacy_processing_status: "pending",
        },
      }]);
    } catch {
      // Media jobs are a best-effort follow-up; the photo itself is already durable.
    }
  }

  return {
    visitId,
    occurrenceId,
    relativePath,
    publicUrl: privateKubiakaUpload ? "" : `/${relativePath}`,
    compatibility,
    facePrivacy,
  };
}
