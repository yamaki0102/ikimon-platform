import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyObservation } from "../legacy/compatibilityWriter.js";
import { recordCompatibilityFailure, upsertAssetBlob } from "./writeSupport.js";
import { normalizeMediaRole, type MediaRole } from "./mediaRole.js";
import { upsertEvidenceAssetMediaRole } from "./evidenceAssetMediaRole.js";

export type ObservationPhotoUploadInput = {
  observationId: string;
  filename: string;
  mimeType: string;
  base64Data: string;
  mediaRole?: MediaRole | string | null;
};

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
};

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
    case "image/gif":
      return ".gif";
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
  if (!input.mimeType.trim() || !input.mimeType.startsWith("image/")) {
    throw new Error("image mimeType is required");
  }
  if (!input.base64Data.trim()) {
    throw new Error("base64Data is required");
  }
}

export async function uploadObservationPhoto(input: ObservationPhotoUploadInput): Promise<ObservationPhotoUploadResult> {
  assertInput(input);

  const config = loadConfig();
  const pool = getPool();
  const client = await pool.connect();
  const normalizedBase64 = normalizeBase64(input.base64Data);
  const buffer = Buffer.from(normalizedBase64, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("decoded image is empty");
  }
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("image exceeds 10MB limit");
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const mediaRole = normalizeMediaRole(input.mediaRole);
  const safeBase = sanitizeFilename(input.filename).replace(/\.[A-Za-z0-9]+$/, "");
  const fileName = `${safeBase}-${sha256.slice(0, 12)}${extensionForMime(input.mimeType)}`;

  let visitId = "";
  let occurrenceId = "";
  let relativePath = "";

  try {
    await client.query("begin");

    const targetResult = await client.query<{
      visit_id: string;
      occurrence_id: string;
    }>(
      `select
          v.visit_id,
          o.occurrence_id
       from visits v
       join occurrences o on o.visit_id = v.visit_id
       where v.visit_id = $1
          or v.legacy_observation_id = $1
          or o.occurrence_id = $1
       order by o.subject_index asc, o.created_at asc
       limit 1`,
      [input.observationId],
    );

    const target = targetResult.rows[0];
    if (!target) {
      throw new Error(`observation not found: ${input.observationId}`);
    }

    visitId = target.visit_id;
    occurrenceId = target.occurrence_id;
    relativePath = path.posix.join("uploads", "v2-observations", visitId, fileName);
    const absolutePath = path.join(config.legacyPublicRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    const blobId = await upsertAssetBlob(client, {
      storageBackend: "local_fs",
      storagePath: relativePath,
      mediaType: "image",
      mimeType: input.mimeType,
      publicUrl: `/${relativePath}`,
      sha256,
      bytes: buffer.byteLength,
      sourcePayload: {
        source: "v2_photo_upload",
        visit_id: visitId,
        media_role: mediaRole,
      },
    });

    const legacyAssetKey = `observation_photo:${visitId}:upload:${sha256}`;
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
          source: "v2_photo_upload",
          filename: input.filename,
          media_role: mediaRole,
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
        source: "v2_photo_upload",
        filename: input.filename,
      },
    });

    await client.query(
      `update visits
          set public_visibility = 'public',
              quality_review_status = 'accepted',
              quality_gate_reasons = coalesce((
                select jsonb_agg(reason)
                  from jsonb_array_elements_text(coalesce(quality_gate_reasons, '[]'::jsonb)) as reasons(reason)
                 where reason <> 'missing_photo'
              ), '[]'::jsonb),
              updated_at = now()
        where visit_id = $1`,
      [visitId],
    );

    await client.query(
      `update observation_quality_reviews
          set review_status = 'accepted',
              public_visibility = 'public',
              reviewed_at = coalesce(reviewed_at, now()),
              updated_at = now()
        where visit_id = $1
          and reason_code = 'native_no_photo'
          and review_status = 'needs_review'`,
      [visitId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const compatibility = {
    attempted: config.compatibilityWriteEnabled,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (config.compatibilityWriteEnabled) {
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

  return {
    visitId,
    occurrenceId,
    relativePath,
    publicUrl: `/${relativePath}`,
    compatibility,
  };
}
