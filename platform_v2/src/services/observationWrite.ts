import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyObservation } from "../legacy/compatibilityWriter.js";
import {
  buildPlaceId,
  buildPlaceName,
  makeOccurrenceId,
  normalizeTimestamp,
  recordCompatibilityFailure,
  upsertAssetBlob,
} from "./writeSupport.js";
import { fetchSiteSignals, composeSiteBrief } from "./siteBrief.js";

type ObservationPhotoInput = {
  path: string;
  publicUrl?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
  bytes?: number | null;
};

export type ObservationUpsertInput = {
  observationId?: string;
  legacyObservationId?: string | null;
  userId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  prefecture?: string | null;
  municipality?: string | null;
  localityNote?: string | null;
  note?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  cultivation?: string | null;
  organismOrigin?: string | null;
  biome?: string | null;
  dataQuality?: string | null;
  qualityGrade?: string | null;
  aiAssessmentStatus?: string | null;
  bestSupportedDescendantTaxon?: string | null;
  substrateTags?: string[];
  evidenceTags?: string[];
  taxon?: {
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
  } | null;
  photos?: ObservationPhotoInput[];
  sourcePayload?: Record<string, unknown>;
};

export type ObservationWriteResult = {
  visitId: string;
  occurrenceId: string;
  placeId: string;
  compatibility: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
};

function assertObservationInput(input: ObservationUpsertInput): void {
  if (!input.userId || input.userId.trim() === "") {
    throw new Error("userId is required");
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error("latitude and longitude are required");
  }

  if (!input.observedAt || input.observedAt.trim() === "") {
    throw new Error("observedAt is required");
  }
}

export async function upsertObservation(input: ObservationUpsertInput): Promise<ObservationWriteResult> {
  assertObservationInput(input);

  const pool = getPool();
  const client = await pool.connect();
  const visitId = input.observationId?.trim() || randomUUID();
  const occurrenceId = makeOccurrenceId(visitId, 0);
  const placeId = buildPlaceId({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    municipality: input.municipality,
    prefecture: input.prefecture,
  });
  const observedAt = normalizeTimestamp(input.observedAt);

  try {
    await client.query("begin");

    const userExists = await client.query<{ exists: boolean }>(
      "select exists(select 1 from users where user_id = $1) as exists",
      [input.userId],
    );
    if (!userExists.rows[0]?.exists) {
      throw new Error(`Unknown userId: ${input.userId}`);
    }

    await client.query(
      `insert into places (
          place_id, legacy_place_key, legacy_site_id, canonical_name, locality_label,
          source_kind, country_code, prefecture, municipality, center_latitude, center_longitude, metadata, created_at, updated_at
       ) values (
          $1, $2, $3, $4, $5, 'v2_observation', $6, $7, $8, $9, $10, $11::jsonb, $12, now()
       )
       on conflict (place_id) do update set
          legacy_site_id = excluded.legacy_site_id,
          canonical_name = excluded.canonical_name,
          locality_label = excluded.locality_label,
          country_code = excluded.country_code,
          prefecture = excluded.prefecture,
          municipality = excluded.municipality,
          center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
          center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
          metadata = excluded.metadata,
          updated_at = now()`,
      [
        placeId,
        placeId,
        input.siteId ?? null,
        buildPlaceName({
          siteName: input.siteName,
          municipality: input.municipality,
          prefecture: input.prefecture,
        }),
        input.siteName ?? input.localityNote ?? null,
        input.country ?? "JP",
        input.prefecture ?? null,
        input.municipality ?? null,
        input.latitude,
        input.longitude,
        JSON.stringify({
          source: "v2_write_api",
          site_id: input.siteId ?? null,
          site_name: input.siteName ?? null,
        }),
        observedAt,
      ],
    );

    await client.query(
      `insert into visits (
          visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
          complete_checklist_flag, target_taxa_scope, point_latitude, point_longitude,
          observed_country, observed_prefecture, observed_municipality, locality_note, note,
          source_kind, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4, $5, 'standard', 'manual', false, null, $6, $7,
          $8, $9, $10, $11, $12, 'v2_observation', $13::jsonb, $14, now()
       )
       on conflict (visit_id) do update set
          legacy_observation_id = excluded.legacy_observation_id,
          place_id = excluded.place_id,
          user_id = excluded.user_id,
          observed_at = excluded.observed_at,
          point_latitude = excluded.point_latitude,
          point_longitude = excluded.point_longitude,
          observed_country = excluded.observed_country,
          observed_prefecture = excluded.observed_prefecture,
          observed_municipality = excluded.observed_municipality,
          locality_note = excluded.locality_note,
          note = excluded.note,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        visitId,
        input.legacyObservationId ?? visitId,
        placeId,
        input.userId,
        observedAt,
        input.latitude,
        input.longitude,
        input.country ?? "JP",
        input.prefecture ?? null,
        input.municipality ?? null,
        input.localityNote ?? null,
        input.note ?? null,
        JSON.stringify(input.sourcePayload ?? {}),
        observedAt,
      ],
    );

    await client.query(
      `insert into occurrences (
          occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
          taxon_rank, basis_of_record, organism_origin, cultivation, occurrence_status,
          evidence_tier, data_quality, quality_grade, ai_assessment_status, best_supported_descendant_taxon,
          biome, substrate_tags, evidence_tags, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, 0, $4, $5, $6, 'HumanObservation', $7, $8, 'present',
          1, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17, now()
       )
       on conflict (occurrence_id) do update set
          scientific_name = excluded.scientific_name,
          vernacular_name = excluded.vernacular_name,
          taxon_rank = excluded.taxon_rank,
          organism_origin = excluded.organism_origin,
          cultivation = excluded.cultivation,
          data_quality = excluded.data_quality,
          quality_grade = excluded.quality_grade,
          ai_assessment_status = excluded.ai_assessment_status,
          best_supported_descendant_taxon = excluded.best_supported_descendant_taxon,
          biome = excluded.biome,
          substrate_tags = excluded.substrate_tags,
          evidence_tags = excluded.evidence_tags,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        occurrenceId,
        visitId,
        input.legacyObservationId ?? visitId,
        input.taxon?.scientificName ?? null,
        input.taxon?.vernacularName ?? null,
        input.taxon?.rank ?? null,
        input.organismOrigin ?? null,
        input.cultivation ?? null,
        input.dataQuality ?? null,
        input.qualityGrade ?? null,
        input.aiAssessmentStatus ?? null,
        input.bestSupportedDescendantTaxon ?? null,
        input.biome ?? null,
        JSON.stringify(input.substrateTags ?? []),
        JSON.stringify(input.evidenceTags ?? []),
        JSON.stringify(input.sourcePayload ?? {}),
        observedAt,
      ],
    );

    const photos = Array.isArray(input.photos) ? input.photos : [];
    const legacyPhotoKeys = photos.map((photo, index) => `observation_photo:${visitId}:${index}:${photo.path}`);
    if (legacyPhotoKeys.length > 0) {
      await client.query(
        `delete from evidence_assets
         where occurrence_id = $1
           and asset_role = 'observation_photo'
           and legacy_asset_key is not null
           and not (legacy_asset_key = any($2::text[]))`,
        [occurrenceId, legacyPhotoKeys],
      );
    } else {
      await client.query(
        `delete from evidence_assets
         where occurrence_id = $1
           and asset_role = 'observation_photo'
           and legacy_asset_key is not null`,
        [occurrenceId],
      );
    }

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (!photo) {
        continue;
      }
      const legacyAssetKey = `observation_photo:${visitId}:${index}:${photo.path}`;
      const blobId = await upsertAssetBlob(client, {
        storageBackend: "local_fs",
        storagePath: photo.path,
        mediaType: "image",
        mimeType: photo.mimeType ?? null,
        publicUrl: photo.publicUrl ?? photo.path,
        sha256: photo.sha256 ?? null,
        bytes: photo.bytes ?? null,
        sourcePayload: {
          source: "v2_write_api",
          visit_id: visitId,
          photo_index: index,
        },
      });

      await client.query(
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
            source_payload = excluded.source_payload`,
        [
          randomUUID(),
          blobId,
          occurrenceId,
          visitId,
          legacyAssetKey,
          photo.path,
          JSON.stringify({
            source: "v2_write_api",
            visit_id: visitId,
            photo_index: index,
          }),
        ],
      );
    }

    const legacyIdentificationKey = `legacy_taxon:${occurrenceId}:primary`;
    const proposedName = input.taxon?.scientificName?.trim() || input.taxon?.vernacularName?.trim() || null;
    if (!proposedName) {
      await client.query(
        `delete from identifications
         where occurrence_id = $1
           and legacy_identification_key = $2`,
        [occurrenceId, legacyIdentificationKey],
      );
    } else {
      await client.query(
        `insert into identifications (
            occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, legacy_identification_key,
            identification_method, confidence_score, is_current, notes, source_payload
         ) values (
            $1, $2, 'human', $3, $4, $5, 'v2_write_api', null, true, null, $6::jsonb
         )
         on conflict (legacy_identification_key) do update set
            occurrence_id = excluded.occurrence_id,
            actor_user_id = excluded.actor_user_id,
            proposed_name = excluded.proposed_name,
            proposed_rank = excluded.proposed_rank,
            identification_method = excluded.identification_method,
            is_current = excluded.is_current,
            source_payload = excluded.source_payload`,
        [
          occurrenceId,
          input.userId,
          proposedName,
          input.taxon?.rank ?? null,
          legacyIdentificationKey,
          JSON.stringify({
            source: "v2_write_api",
          }),
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  // Non-blocking: capture Site Brief snapshot at observation time.
  // Failures silently drop — never block the observation write path.
  void (async () => {
    try {
      const signals = await fetchSiteSignals(input.latitude, input.longitude);
      const brief = composeSiteBrief(signals, "ja");
      const fcPool = getPool();
      const fcClient = await fcPool.connect();
      try {
        await fcClient.query(
          `insert into field_context
             (occurrence_id, lat, lng, hypothesis_id, hypothesis_label, hypothesis_confidence, signals, source_lang)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'ja')
           on conflict do nothing`,
          [
            occurrenceId,
            input.latitude,
            input.longitude,
            brief.hypothesis.id,
            brief.hypothesis.label,
            brief.hypothesis.confidence,
            JSON.stringify(signals),
          ],
        );
      } finally {
        fcClient.release();
      }
    } catch {
      // intentionally swallowed
    }
  })();

  const config = loadConfig();
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
        await recordCompatibilityFailure(failureClient, "observation", visitId, config.legacyDataRoot, {
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
    placeId,
    compatibility,
  };
}
