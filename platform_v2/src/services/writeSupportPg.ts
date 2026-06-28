import type { PoolClient } from "pg";

type JsonRecord = Record<string, unknown>;

export type AssetBlobInput = {
  storageBackend: string;
  storagePath: string;
  mediaType: string;
  mimeType?: string | null;
  publicUrl?: string | null;
  sha256?: string | null;
  bytes?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
  durationMs?: number | null;
  sourcePayload?: JsonRecord;
};

export async function upsertAssetBlob(client: PoolClient, input: AssetBlobInput): Promise<string> {
  const result = await client.query<{ blob_id: string }>(
    `insert into asset_blobs (
        storage_backend, storage_path, media_type, mime_type, public_url, sha256, bytes,
        width_px, height_px, duration_ms, source_payload, created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now(), now()
     )
     on conflict (storage_backend, storage_path) do update set
        media_type = excluded.media_type,
        mime_type = coalesce(excluded.mime_type, asset_blobs.mime_type),
        public_url = coalesce(excluded.public_url, asset_blobs.public_url),
        sha256 = coalesce(excluded.sha256, asset_blobs.sha256),
        bytes = coalesce(excluded.bytes, asset_blobs.bytes),
        width_px = coalesce(excluded.width_px, asset_blobs.width_px),
        height_px = coalesce(excluded.height_px, asset_blobs.height_px),
        duration_ms = coalesce(excluded.duration_ms, asset_blobs.duration_ms),
        source_payload = excluded.source_payload,
        updated_at = now()
     returning blob_id`,
    [
      input.storageBackend,
      input.storagePath,
      input.mediaType,
      input.mimeType ?? null,
      input.publicUrl ?? null,
      input.sha256 ?? null,
      input.bytes ?? null,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.durationMs ?? null,
      JSON.stringify(input.sourcePayload ?? {}),
    ],
  );

  const blobId = result.rows[0]?.blob_id;
  if (!blobId) {
    throw new Error(`Failed to upsert asset blob for ${input.storageBackend}:${input.storagePath}`);
  }

  return blobId;
}

export async function recordCompatibilityFailure(
  client: PoolClient,
  entityType: string,
  canonicalId: string,
  legacyTarget: string,
  details: JsonRecord,
): Promise<void> {
  await client.query(
    `insert into compatibility_write_ledger (
        entity_type, canonical_id, legacy_target, write_status, attempted_at, completed_at, details
     ) values (
        $1, $2, $3, 'failed', now(), now(), $4::jsonb
     )`,
    [entityType, canonicalId, legacyTarget, JSON.stringify(details)],
  );
}
