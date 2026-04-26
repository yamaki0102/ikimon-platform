import type { PoolClient } from "pg";
import { normalizeMediaRole, type MediaRole } from "./mediaRole.js";

export type EvidenceAssetMediaRoleInput = {
  assetId: string;
  occurrenceId: string;
  visitId: string;
  assetRole: "observation_photo" | "observation_video" | string;
  mediaRole?: MediaRole | string | null;
  mediaRoleSource?: "user" | "ai" | "system" | "backfill";
  sourcePayload?: Record<string, unknown>;
};

export async function upsertEvidenceAssetMediaRole(
  client: PoolClient,
  input: EvidenceAssetMediaRoleInput,
): Promise<void> {
  const mediaRole = normalizeMediaRole(input.mediaRole);
  await client.query(
    `insert into evidence_asset_media_roles (
        asset_id, occurrence_id, visit_id, asset_role, media_role, media_role_source, source_payload
     ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7::jsonb
     )
     on conflict (asset_id) do update set
        occurrence_id = excluded.occurrence_id,
        visit_id = excluded.visit_id,
        asset_role = excluded.asset_role,
        media_role = excluded.media_role,
        media_role_source = excluded.media_role_source,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      input.assetId,
      input.occurrenceId,
      input.visitId,
      input.assetRole,
      mediaRole,
      input.mediaRoleSource ?? "user",
      JSON.stringify(input.sourcePayload ?? {}),
    ],
  );
}
