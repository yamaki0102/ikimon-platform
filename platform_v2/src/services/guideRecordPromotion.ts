import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import {
  buildPlaceId,
  buildPlaceName,
  makeOccurrenceId,
  normalizeTimestamp,
} from "./writeSupport.js";
import { hasUsableObservationCoordinates, normalizeObservationLocality } from "./localityNormalization.js";

const PROMOTION_AUDIO_WINDOW_SECONDS = 120;

type JsonRecord = Record<string, unknown>;

type GuideRecordPromotionRow = {
  guide_record_id: string;
  session_id: string;
  user_id: string | null;
  occurrence_id: string | null;
  lat: number | null;
  lng: number | null;
  scene_summary: string | null;
  detected_species: string[] | null;
  detected_features: JsonRecord[] | null;
  created_at: string;
  captured_at: string | null;
  returned_at: string | null;
  frame_thumb: string | null;
  primary_subject: JsonRecord | null;
  environment_context: string | null;
  seasonal_note: string | null;
  coexisting_taxa: string[] | null;
  media_refs: JsonRecord | null;
};

type PromotableAudioSegment = {
  segment_id: string;
  recorded_at: string;
  duration_sec: number;
  blob_id: string;
  storage_path: string;
  storage_provider: string;
  mime_type: string;
  bytes: number;
  transcription_status: string;
  privacy_status: string;
  visibility: string;
};

export type GuidePromotionEvidenceSummary = {
  photo: "none" | "weak_frame_thumb";
  audioSegmentIds: string[];
};

export type GuideRecordPromotionResult = {
  ok: true;
  guideRecordId: string;
  occurrenceId: string;
  visitId: string;
  reused: boolean;
  evidence: GuidePromotionEvidenceSummary;
  observationHref: string;
};

function normalizeJsonRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function primarySubjectName(primarySubject: unknown): string | null {
  const subject = normalizeJsonRecord(primarySubject);
  return firstText([subject.name, subject.vernacularName, subject.scientificName]);
}

function primarySubjectRank(primarySubject: unknown): string | null {
  const subject = normalizeJsonRecord(primarySubject);
  return firstText([subject.rank]);
}

function detectionName(row: GuideRecordPromotionRow): string | null {
  return firstText([
    primarySubjectName(row.primary_subject),
    ...(row.detected_species ?? []),
    row.scene_summary,
    row.environment_context,
  ]);
}

function observedAtForGuideRecord(row: GuideRecordPromotionRow): string {
  return normalizeTimestamp(row.captured_at ?? row.returned_at ?? row.created_at);
}

function requirePromotableCoordinates(row: GuideRecordPromotionRow): { lat: number; lng: number } {
  const lat = typeof row.lat === "number" ? row.lat : Number(row.lat);
  const lng = typeof row.lng === "number" ? row.lng : Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !hasUsableObservationCoordinates(lat, lng)) {
    throw new Error("guide_record_location_required");
  }
  return { lat, lng };
}

export function isPromotableAudioSegment(row: {
  blob_id?: string | null;
  privacy_status?: string | null;
  voice_flag?: boolean | null;
  transcription_status?: string | null;
  storage_path?: string | null;
}): boolean {
  if (!row.blob_id) return false;
  if (row.privacy_status !== "clean") return false;
  if (row.voice_flag === true) return false;
  if ((row.transcription_status ?? "pending") === "skipped") return false;
  if ((row.storage_path ?? "").includes("v2-audio-quarantine/")) return false;
  return true;
}

async function findPromotableAudioSegments(
  client: PoolClient,
  row: GuideRecordPromotionRow,
  observedAt: string,
): Promise<PromotableAudioSegment[]> {
  const result = await client.query<PromotableAudioSegment & { voice_flag: boolean | null }>(
    `select
        segment_id::text,
        recorded_at::text,
        duration_sec,
        blob_id::text,
        storage_path,
        storage_provider,
        mime_type,
        bytes,
        transcription_status,
        privacy_status,
        voice_flag,
        visibility
       from audio_segments
      where session_id = $1
        and user_id = $2
        and abs(extract(epoch from (recorded_at - $3::timestamptz))) <= $4
        and blob_id is not null
        and privacy_status = 'clean'
        and coalesce(voice_flag, false) = false
        and coalesce(transcription_status, 'pending') <> 'skipped'
      order by abs(extract(epoch from (recorded_at - $3::timestamptz))) asc, recorded_at asc
      limit 3`,
    [row.session_id, row.user_id, observedAt, PROMOTION_AUDIO_WINDOW_SECONDS],
  );
  return result.rows
    .filter(isPromotableAudioSegment)
    .map((segment) => ({
      segment_id: segment.segment_id,
      recorded_at: segment.recorded_at,
      duration_sec: segment.duration_sec,
      blob_id: segment.blob_id,
      storage_path: segment.storage_path,
      storage_provider: segment.storage_provider,
      mime_type: segment.mime_type,
      bytes: segment.bytes,
      transcription_status: segment.transcription_status,
      privacy_status: segment.privacy_status,
      visibility: segment.visibility,
    }));
}

async function loadGuideRecordForPromotion(
  client: PoolClient,
  guideRecordId: string,
): Promise<GuideRecordPromotionRow | null> {
  const result = await client.query<GuideRecordPromotionRow>(
    `select
        gr.guide_record_id::text,
        gr.session_id,
        gr.user_id,
        gr.occurrence_id,
        gr.lat,
        gr.lng,
        gr.scene_summary,
        gr.detected_species,
        gr.detected_features,
        gr.created_at::text,
        gls.captured_at::text,
        gls.returned_at::text,
        gls.frame_thumb,
        gls.primary_subject,
        gls.environment_context,
        gls.seasonal_note,
        gls.coexisting_taxa,
        gls.media_refs
       from guide_records gr
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
      where gr.guide_record_id = $1::uuid
      for update of gr`,
    [guideRecordId],
  );
  return result.rows[0] ?? null;
}

async function existingPromotionResult(
  client: PoolClient,
  guideRecordId: string,
  occurrenceId: string,
): Promise<GuideRecordPromotionResult> {
  const result = await client.query<{ visit_id: string }>(
    `select visit_id
       from occurrences
      where occurrence_id = $1
      limit 1`,
    [occurrenceId],
  );
  const visitId = result.rows[0]?.visit_id ?? occurrenceId.replace(/^occ:/, "").replace(/:0$/, "");
  return {
    ok: true,
    guideRecordId,
    occurrenceId,
    visitId,
    reused: true,
    evidence: { photo: "none", audioSegmentIds: [] },
    observationHref: `/observations/${encodeURIComponent(visitId)}?occurrence=${encodeURIComponent(occurrenceId)}`,
  };
}

async function insertPromotedObservation(
  client: PoolClient,
  input: {
    row: GuideRecordPromotionRow;
    observedAt: string;
    userId: string;
    visitId: string;
    occurrenceId: string;
    audioSegments: PromotableAudioSegment[];
  },
): Promise<void> {
  const { row, observedAt, userId, visitId, occurrenceId, audioSegments } = input;
  const { lat, lng } = requirePromotableCoordinates(row);
  const locality = normalizeObservationLocality({ latitude: lat, longitude: lng });
  const placeId = buildPlaceId({
    latitude: lat,
    longitude: lng,
    municipality: locality.municipality,
    prefecture: locality.prefecture,
  });
  const displayName = detectionName(row);
  const sourcePayload = {
    source: "guide_record_promotion",
    guide_record_id: row.guide_record_id,
    guide_session_id: row.session_id,
    claim_limit: "ai_guide_candidate_promoted_with_evidence_not_confirmed_identification",
    frame_thumb_policy: row.frame_thumb ? "not_used_as_observation_photo_evidence" : "none",
    detected_species: row.detected_species ?? [],
    detected_features: row.detected_features ?? [],
    primary_subject: normalizeJsonRecord(row.primary_subject),
    media_refs: normalizeJsonRecord(row.media_refs),
  };

  await client.query(
    `insert into places (
        place_id, legacy_place_key, canonical_name, locality_label, source_kind,
        country_code, prefecture, municipality, center_latitude, center_longitude, metadata, first_visit_at, last_visit_at, created_at, updated_at
     ) values (
        $1, $1, $2, $3, 'v2_observation', 'JP', $4, $5, $6, $7, $8::jsonb, $9, $9, now(), now()
     )
     on conflict (place_id) do update set
        canonical_name = excluded.canonical_name,
        locality_label = excluded.locality_label,
        center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
        center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
        last_visit_at = greatest(coalesce(places.last_visit_at, excluded.last_visit_at), excluded.last_visit_at),
        metadata = places.metadata || excluded.metadata,
        updated_at = now()`,
    [
      placeId,
      buildPlaceName({ municipality: locality.municipality, prefecture: locality.prefecture }),
      locality.municipality ?? locality.prefecture ?? "ガイド記録から昇格",
      locality.prefecture,
      locality.municipality,
      lat,
      lng,
      JSON.stringify({ source: "guide_record_promotion" }),
      observedAt,
    ],
  );

  const note = [
    row.scene_summary,
    row.environment_context,
    row.seasonal_note,
    "AIガイド成果から作成した未検証候補です。frame_thumb は検証写真として扱っていません。",
  ].filter(Boolean).join("\n");

  await client.query(
    `insert into visits (
        visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
        complete_checklist_flag, point_latitude, point_longitude, observed_country, observed_prefecture,
        observed_municipality, locality_note, note, source_kind, source_payload, public_visibility,
        quality_review_status, quality_gate_reasons, created_at, updated_at
     ) values (
        $1, $1, $2, $3, $4, 'standard', 'manual',
        false, $5, $6, 'JP', $7, $8, $9, $10, 'guide_record_promotion', $11::jsonb,
        'review', 'needs_review', $12::jsonb, $4, now()
     )`,
    [
      visitId,
      placeId,
      userId,
      observedAt,
      lat,
      lng,
      locality.prefecture,
      locality.municipality,
      "ガイド成果から昇格",
      note,
      JSON.stringify(sourcePayload),
      JSON.stringify(["missing_photo", "guide_candidate_unverified"]),
    ],
  );

  await client.query(
    `insert into occurrences (
        occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
        taxon_rank, basis_of_record, occurrence_status, confidence_score, evidence_tier, data_quality,
        quality_grade, ai_assessment_status, evidence_tags, source_payload, created_at, updated_at
     ) values (
        $1, $2, $2, 0, null, $3, $4, 'HumanObservation', 'present', null, 1,
        'guide_candidate_needs_review', 'needs_id', 'guide_candidate_unverified', $5::jsonb, $6::jsonb, $7, now()
     )`,
    [
      occurrenceId,
      visitId,
      displayName,
      primarySubjectRank(row.primary_subject),
      JSON.stringify(["audio_evidence", "guide_candidate", "photo_required_for_visual_verification"]),
      JSON.stringify(sourcePayload),
      observedAt,
    ],
  );

  if (displayName) {
    await client.query(
      `insert into identifications (
          occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank,
          identification_method, confidence_score, is_current, notes, source_payload
       ) values (
          $1, $2, 'ai_assisted', $3, $4, 'guide_record_promotion', null, true,
          'AIガイド由来の候補名。観察証拠による確認が必要です。', $5::jsonb
       )`,
      [
        occurrenceId,
        userId,
        displayName,
        primarySubjectRank(row.primary_subject),
        JSON.stringify({ source: "guide_record_promotion", guide_record_id: row.guide_record_id }),
      ],
    );
  }

  for (const segment of audioSegments) {
    const assetResult = await client.query<{ asset_id: string }>(
      `insert into evidence_assets (
          asset_id, blob_id, occurrence_id, visit_id, asset_role, captured_at,
          legacy_asset_key, source_payload
       ) values (
          $1::uuid, $2::uuid, $3, $4, 'observation_audio', $5::timestamptz,
          $6, $7::jsonb
       )
       on conflict (legacy_asset_key) do update set
          blob_id = excluded.blob_id,
          occurrence_id = excluded.occurrence_id,
          visit_id = excluded.visit_id,
          captured_at = excluded.captured_at,
          source_payload = evidence_assets.source_payload || excluded.source_payload
       returning asset_id::text`,
      [
        randomUUID(),
        segment.blob_id,
        occurrenceId,
        visitId,
        segment.recorded_at,
        `guide_promote_audio:${row.guide_record_id}:${segment.segment_id}`,
        JSON.stringify({
          source: "guide_record_promotion",
          guide_record_id: row.guide_record_id,
          segment_id: segment.segment_id,
          privacy_status: segment.privacy_status,
          transcription_status: segment.transcription_status,
          visibility: segment.visibility,
        }),
      ],
    );
    const assetId = assetResult.rows[0]?.asset_id;
    if (!assetId) throw new Error("guide_promotion_audio_asset_failed");
    await client.query(
      `insert into evidence_asset_media_roles (
          asset_id, occurrence_id, visit_id, asset_role, media_role, media_role_source, source_payload
       ) values (
          $1::uuid, $2, $3, 'observation_audio', 'sound_motion', 'system', $4::jsonb
       )
       on conflict (asset_id) do update set
          occurrence_id = excluded.occurrence_id,
          visit_id = excluded.visit_id,
          asset_role = excluded.asset_role,
          media_role = excluded.media_role,
          media_role_source = excluded.media_role_source,
          source_payload = evidence_asset_media_roles.source_payload || excluded.source_payload,
          updated_at = now()`,
      [
        assetId,
        occurrenceId,
        visitId,
        JSON.stringify({ source: "guide_record_promotion", segment_id: segment.segment_id }),
      ],
    );
    await client.query(
      `update audio_segments
          set visit_id = coalesce(visit_id, $2),
              updated_at = now()
        where segment_id = $1::uuid
          and user_id = $3
          and privacy_status = 'clean'
          and coalesce(voice_flag, false) = false`,
      [segment.segment_id, visitId, userId],
    );
  }
}

export async function promoteGuideRecordToObservation(input: {
  guideRecordId: string;
  userId: string;
}): Promise<GuideRecordPromotionResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const row = await loadGuideRecordForPromotion(client, input.guideRecordId);
    if (!row) throw new Error("guide_record_not_found");
    if (row.user_id !== input.userId) throw new Error("guide_record_forbidden");
    if (row.occurrence_id) {
      const result = await existingPromotionResult(client, row.guide_record_id, row.occurrence_id);
      await client.query("commit");
      return result;
    }

    const observedAt = observedAtForGuideRecord(row);
    requirePromotableCoordinates(row);
    const audioSegments = await findPromotableAudioSegments(client, row, observedAt);
    if (audioSegments.length === 0) {
      throw new Error(row.frame_thumb ? "guide_record_photo_required" : "guide_record_evidence_required");
    }

    const visitId = randomUUID();
    const occurrenceId = makeOccurrenceId(visitId, 0);
    await insertPromotedObservation(client, {
      row,
      observedAt,
      userId: input.userId,
      visitId,
      occurrenceId,
      audioSegments,
    });
    await client.query(
      `update guide_records
          set occurrence_id = $2
        where guide_record_id = $1::uuid
          and occurrence_id is null`,
      [row.guide_record_id, occurrenceId],
    );
    await client.query("commit");
    return {
      ok: true,
      guideRecordId: row.guide_record_id,
      occurrenceId,
      visitId,
      reused: false,
      evidence: {
        photo: row.frame_thumb ? "weak_frame_thumb" : "none",
        audioSegmentIds: audioSegments.map((segment) => segment.segment_id),
      },
      observationHref: `/observations/${encodeURIComponent(visitId)}?occurrence=${encodeURIComponent(occurrenceId)}`,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
