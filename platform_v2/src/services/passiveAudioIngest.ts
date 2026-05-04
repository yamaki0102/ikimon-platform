import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { buildPlaceId, makeOccurrenceId } from "./writeSupport.js";

export type PassiveAudioSourceType =
  | "birdnet_go_csv"
  | "birdnet_go_mqtt"
  | "birdnet_go_rest"
  | "tinyml_rest"
  | "manual_test_fixture";

export type AudioConsentScope = "private" | "community" | "public";
export type AudioDetectionMethod = "ai_audio";
export type BasisOfRecord = "MachineObservation";
export type SamplingProtocol = "passive-audio";

export type NormalizedPassiveAudioDetectionEventV01 = {
  ingest_schema_version: "birdnet-go-event-only-v0.1";
  source_type: PassiveAudioSourceType;
  source_id: string;
  source_name: string;
  site_id: string;
  observed_start_at: string;
  observed_end_at: string;
  timezone: string;
  species_label: string;
  confidence: number;
  detection_method: AudioDetectionMethod;
  basisOfRecord: BasisOfRecord;
  samplingProtocol: SamplingProtocol;
  provenance: {
    created_by: "import" | "passive_engine";
    imported_at: string;
    adapter_name: string;
    adapter_version: string;
    raw_payload_hash?: string;
  };
  plot_id?: string;
  lat?: number;
  lng?: number;
  coordinate_uncertainty_m?: number;
  scientific_name?: string;
  vernacular_name?: string;
  taxon_concept_version?: string;
  model_id?: string;
  model_version?: string;
  birdnet_go_version?: string;
  device_id?: string;
  audio_snippet_hash?: string;
  spectrogram_ref?: string;
  clip_ref?: string;
  consent_scope?: AudioConsentScope;
};

export type PassiveAudioIngestResult = {
  status: "accepted" | "duplicate";
  dedupeKey: string;
  visitId?: string;
  occurrenceId?: string;
  segmentId?: string;
  tier15Candidate?: boolean;
};

export type PassiveAudioBatchResult = {
  ok: boolean;
  accepted: number;
  rejected: number;
  duplicates: number;
  results: Array<{
    index: number;
    status: "accepted" | "duplicate" | "rejected";
    dedupeKey?: string;
    visitId?: string;
    occurrenceId?: string;
    segmentId?: string;
    tier15Candidate?: boolean;
    error?: string;
  }>;
};

export class PassiveAudioValidationError extends Error {
  override name = "PassiveAudioValidationError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new PassiveAudioValidationError(`${key}_required`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PassiveAudioValidationError(`${key}_required`);
  }
  return trimmed;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value == null || value === "") return undefined;
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(num)) throw new PassiveAudioValidationError(`${key}_invalid`);
  return num;
}

function requiredConfidence(record: Record<string, unknown>): number {
  const confidence = optionalNumber(record, "confidence");
  if (confidence == null) throw new PassiveAudioValidationError("confidence_required");
  if (confidence < 0 || confidence > 1) throw new PassiveAudioValidationError("confidence_out_of_range");
  return confidence;
}

function normalizeTimestamp(value: string, key: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PassiveAudioValidationError(`${key}_invalid`);
  return date.toISOString();
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalConsentScope(value: unknown): AudioConsentScope {
  if (value == null || value === "") return "private";
  if (value === "private" || value === "community" || value === "public") return value;
  throw new PassiveAudioValidationError("consent_scope_invalid");
}

function normalizeProvenance(value: unknown): NormalizedPassiveAudioDetectionEventV01["provenance"] {
  if (!isRecord(value)) throw new PassiveAudioValidationError("provenance_required");
  const createdBy = stringField(value, "created_by");
  if (createdBy !== "import" && createdBy !== "passive_engine") {
    throw new PassiveAudioValidationError("provenance_created_by_invalid");
  }
  return {
    created_by: createdBy,
    imported_at: normalizeTimestamp(stringField(value, "imported_at"), "provenance_imported_at"),
    adapter_name: stringField(value, "adapter_name"),
    adapter_version: stringField(value, "adapter_version"),
    raw_payload_hash: optionalString(value, "raw_payload_hash"),
  };
}

function isBirdnetSource(sourceType: PassiveAudioSourceType): boolean {
  return sourceType === "birdnet_go_csv" || sourceType === "birdnet_go_mqtt" || sourceType === "birdnet_go_rest";
}

function normalizeSourceType(value: string): PassiveAudioSourceType {
  const allowed: PassiveAudioSourceType[] = ["birdnet_go_csv", "birdnet_go_mqtt", "birdnet_go_rest", "tinyml_rest", "manual_test_fixture"];
  if (!allowed.includes(value as PassiveAudioSourceType)) {
    throw new PassiveAudioValidationError("source_type_invalid");
  }
  return value as PassiveAudioSourceType;
}

export function normalizePassiveAudioDetectionEvent(input: unknown): NormalizedPassiveAudioDetectionEventV01 {
  if (!isRecord(input)) throw new PassiveAudioValidationError("event_object_required");
  const schemaVersion = stringField(input, "ingest_schema_version");
  if (schemaVersion !== "birdnet-go-event-only-v0.1") {
    throw new PassiveAudioValidationError("ingest_schema_version_invalid");
  }
  const sourceType = normalizeSourceType(stringField(input, "source_type"));
  const observedStartAt = normalizeTimestamp(stringField(input, "observed_start_at"), "observed_start_at");
  const observedEndAt = normalizeTimestamp(stringField(input, "observed_end_at"), "observed_end_at");
  if (new Date(observedEndAt).getTime() < new Date(observedStartAt).getTime()) {
    throw new PassiveAudioValidationError("observed_end_before_start");
  }
  if (stringField(input, "detection_method") !== "ai_audio") {
    throw new PassiveAudioValidationError("detection_method_invalid");
  }
  if (stringField(input, "basisOfRecord") !== "MachineObservation") {
    throw new PassiveAudioValidationError("basisOfRecord_invalid");
  }
  if (stringField(input, "samplingProtocol") !== "passive-audio") {
    throw new PassiveAudioValidationError("samplingProtocol_invalid");
  }
  const modelId = optionalString(input, "model_id") ?? (isBirdnetSource(sourceType) ? "birdnet" : undefined);

  return {
    ingest_schema_version: "birdnet-go-event-only-v0.1",
    source_type: sourceType,
    source_id: stringField(input, "source_id"),
    source_name: stringField(input, "source_name"),
    site_id: stringField(input, "site_id"),
    observed_start_at: observedStartAt,
    observed_end_at: observedEndAt,
    timezone: stringField(input, "timezone"),
    species_label: stringField(input, "species_label"),
    confidence: requiredConfidence(input),
    detection_method: "ai_audio",
    basisOfRecord: "MachineObservation",
    samplingProtocol: "passive-audio",
    provenance: normalizeProvenance(input.provenance),
    plot_id: optionalString(input, "plot_id"),
    lat: optionalNumber(input, "lat"),
    lng: optionalNumber(input, "lng"),
    coordinate_uncertainty_m: optionalNumber(input, "coordinate_uncertainty_m"),
    scientific_name: optionalString(input, "scientific_name"),
    vernacular_name: optionalString(input, "vernacular_name"),
    taxon_concept_version: optionalString(input, "taxon_concept_version"),
    model_id: modelId,
    model_version: optionalString(input, "model_version"),
    birdnet_go_version: optionalString(input, "birdnet_go_version"),
    device_id: optionalString(input, "device_id"),
    audio_snippet_hash: optionalString(input, "audio_snippet_hash"),
    spectrogram_ref: optionalString(input, "spectrogram_ref"),
    clip_ref: optionalString(input, "clip_ref"),
    consent_scope: optionalConsentScope(input.consent_scope),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computePassiveAudioDedupeKey(event: NormalizedPassiveAudioDetectionEventV01): string {
  const rawPayloadHash = event.provenance.raw_payload_hash?.trim();
  if (rawPayloadHash) return `raw_payload_hash:${rawPayloadHash}`;
  return `sha256:${sha256(stableJson({
    source_type: event.source_type,
    source_id: event.source_id,
    source_name: event.source_name,
    site_id: event.site_id,
    device_id: event.device_id ?? null,
    observed_start_at: event.observed_start_at,
    observed_end_at: event.observed_end_at,
    species_label: event.species_label,
  }))}`;
}

export function mapBirdnetCsvRowToPassiveAudioEvent(
  row: Record<string, unknown>,
  options: { importedAt?: string; adapterVersion?: string } = {},
): NormalizedPassiveAudioDetectionEventV01 {
  const file = stringField(row, "file");
  const sourceName = optionalString(row, "source_name") ?? file;
  return normalizePassiveAudioDetectionEvent({
    ingest_schema_version: "birdnet-go-event-only-v0.1",
    source_type: "birdnet_go_csv",
    source_id: optionalString(row, "source_id") ?? `csv:${sha256(sourceName).slice(0, 16)}`,
    source_name: sourceName,
    site_id: stringField(row, "site_id"),
    plot_id: optionalString(row, "plot_id"),
    observed_start_at: stringField(row, "start_time"),
    observed_end_at: stringField(row, "end_time"),
    timezone: optionalString(row, "timezone") ?? "Asia/Tokyo",
    species_label: stringField(row, "species"),
    scientific_name: optionalString(row, "scientific_name"),
    vernacular_name: optionalString(row, "common_name"),
    confidence: requiredConfidence(row),
    detection_method: "ai_audio",
    basisOfRecord: "MachineObservation",
    samplingProtocol: "passive-audio",
    model_id: optionalString(row, "model_id"),
    model_version: optionalString(row, "model_version"),
    birdnet_go_version: optionalString(row, "birdnet_go_version"),
    lat: optionalNumber(row, "lat"),
    lng: optionalNumber(row, "lng"),
    consent_scope: optionalString(row, "consent_scope"),
    provenance: {
      created_by: "import",
      imported_at: options.importedAt ?? new Date().toISOString(),
      adapter_name: "birdnet_go_csv",
      adapter_version: options.adapterVersion ?? "v0.1",
      raw_payload_hash: optionalString(row, "raw_payload_hash") ?? `sha256:${sha256(stableJson(row))}`,
    },
  });
}

export function mapBirdnetMqttPayloadToPassiveAudioEvent(
  payload: Record<string, unknown>,
  options: { siteId?: string; importedAt?: string; adapterVersion?: string } = {},
): NormalizedPassiveAudioDetectionEventV01 {
  const timestamp = normalizeTimestamp(stringField(payload, "timestamp"), "timestamp");
  const startOffset = optionalNumber(payload, "startOffsetSec") ?? 0;
  const endOffset = optionalNumber(payload, "endOffsetSec") ?? startOffset;
  const start = new Date(new Date(timestamp).getTime() + startOffset * 1000).toISOString();
  const end = new Date(new Date(timestamp).getTime() + endOffset * 1000).toISOString();
  const scientificName = optionalString(payload, "scientificName");
  return normalizePassiveAudioDetectionEvent({
    ingest_schema_version: "birdnet-go-event-only-v0.1",
    source_type: "birdnet_go_mqtt",
    source_id: stringField(payload, "sourceId"),
    source_name: stringField(payload, "sourceName"),
    site_id: optionalString(payload, "site_id") ?? options.siteId,
    observed_start_at: start,
    observed_end_at: end,
    timezone: optionalString(payload, "timezone") ?? "Asia/Tokyo",
    species_label: optionalString(payload, "species") ?? scientificName,
    scientific_name: scientificName,
    confidence: requiredConfidence(payload),
    detection_method: "ai_audio",
    basisOfRecord: "MachineObservation",
    samplingProtocol: "passive-audio",
    model_id: optionalString(payload, "model_id"),
    model_version: optionalString(payload, "model_version"),
    device_id: optionalString(payload, "deviceId"),
    consent_scope: optionalString(payload, "consent_scope"),
    provenance: {
      created_by: "passive_engine",
      imported_at: options.importedAt ?? new Date().toISOString(),
      adapter_name: "birdnet_go_mqtt",
      adapter_version: options.adapterVersion ?? "v0.1",
      raw_payload_hash: optionalString(payload, "payload_hash") ?? `sha256:${sha256(stableJson(payload))}`,
    },
  });
}

export function isTier15PassiveAudioCandidate(event: NormalizedPassiveAudioDetectionEventV01): boolean {
  return event.confidence >= 0.9
    && Boolean(event.scientific_name)
    && Boolean(event.model_id)
    && Boolean(event.model_version)
    && event.model_version?.toLowerCase() !== "unknown"
    && !event.model_version?.toLowerCase().includes("unknown");
}

function sessionIdFor(event: NormalizedPassiveAudioDetectionEventV01): string {
  const day = event.observed_start_at.slice(0, 10);
  return `passive-audio:${event.site_id}:${event.source_id}:${day}`;
}

export async function ingestPassiveAudioDetection(input: unknown): Promise<PassiveAudioIngestResult> {
  const event = normalizePassiveAudioDetectionEvent(input);
  const dedupeKey = computePassiveAudioDedupeKey(event);
  const tier15Candidate = isTier15PassiveAudioCandidate(event);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const ledgerInsert = await client.query<{ ingest_event_id: string }>(
      `insert into passive_audio_ingest_events (
          dedupe_key, source_type, source_id, source_name, site_id, device_id,
          observed_start_at, observed_end_at, species_label, scientific_name,
          confidence, model_id, model_version, raw_payload_hash, tier15_candidate,
          normalized_event, provenance, ingest_status
       ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16::jsonb, $17::jsonb, 'accepted'
       )
       on conflict (dedupe_key) do nothing
       returning ingest_event_id`,
      [
        dedupeKey,
        event.source_type,
        event.source_id,
        event.source_name,
        event.site_id,
        event.device_id ?? null,
        event.observed_start_at,
        event.observed_end_at,
        event.species_label,
        event.scientific_name ?? null,
        event.confidence,
        event.model_id ?? null,
        event.model_version ?? null,
        event.provenance.raw_payload_hash ?? null,
        tier15Candidate,
        JSON.stringify(event),
        JSON.stringify(event.provenance),
      ],
    );
    const ingestEventId = ledgerInsert.rows[0]?.ingest_event_id;
    if (!ingestEventId) {
      await client.query("commit");
      return { status: "duplicate", dedupeKey };
    }

    const placeId = buildPlaceId({
      siteId: event.site_id,
      latitude: event.lat,
      longitude: event.lng,
    });
    const visitId = randomUUID();
    const occurrenceId = makeOccurrenceId(visitId, 0);
    const segmentId = await writeCanonicalPassiveAudioEvent(client, event, {
      dedupeKey,
      placeId,
      visitId,
      occurrenceId,
      tier15Candidate,
    });

    const review = await client.query<{ review_id: string }>(
      `insert into observation_quality_reviews (
          review_kind, review_status, visit_id, occurrence_id, reason_code,
          reason_detail, public_visibility, quality_signals, source_payload, import_version
       ) values (
          'passive_audio_ai_detection', 'needs_review', $1, $2, 'ai_audio_candidate',
          $3, 'review', $4::jsonb, $5::jsonb, 'birdnet-go-event-only-v0.1'
       )
       returning review_id`,
      [
        visitId,
        occurrenceId,
        tier15Candidate ? "tier_1_5_candidate_pending_ecological_validity" : "tier_1_machine_detection",
        JSON.stringify({
          confidence: event.confidence,
          tier15_candidate: tier15Candidate,
          has_model_version: Boolean(event.model_version),
          has_scientific_name: Boolean(event.scientific_name),
        }),
        JSON.stringify({ source: "passive_audio_ingest", dedupe_key: dedupeKey }),
      ],
    );

    await client.query(
      `update passive_audio_ingest_events
          set visit_id = $2,
              occurrence_id = $3,
              audio_segment_id = $4,
              evidence_asset_id = (
                select asset_id from evidence_assets
                 where occurrence_id = $3 and asset_role = 'observation_audio'
                 order by created_at desc limit 1
              ),
              review_id = $5,
              updated_at = now()
        where ingest_event_id = $1`,
      [ingestEventId, visitId, occurrenceId, segmentId, review.rows[0]?.review_id ?? null],
    );
    await client.query("commit");
    return { status: "accepted", dedupeKey, visitId, occurrenceId, segmentId, tier15Candidate };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function writeCanonicalPassiveAudioEvent(
  client: PoolClient,
  event: NormalizedPassiveAudioDetectionEventV01,
  ids: { dedupeKey: string; placeId: string; visitId: string; occurrenceId: string; tier15Candidate: boolean },
): Promise<string> {
  const placeName = event.site_id || event.source_name;
  await client.query(
    `insert into places (
        place_id, legacy_site_id, canonical_name, locality_label, source_kind,
        country_code, center_latitude, center_longitude, metadata, created_at, updated_at
     ) values (
        $1, $2, $3, $4, 'passive_audio_ingest',
        'JP', $5, $6, $7::jsonb, now(), now()
     )
     on conflict (place_id) do update set
        legacy_site_id = coalesce(excluded.legacy_site_id, places.legacy_site_id),
        canonical_name = excluded.canonical_name,
        center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
        center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
        metadata = places.metadata || excluded.metadata,
        updated_at = now()`,
    [
      ids.placeId,
      event.site_id,
      placeName,
      event.plot_id ?? null,
      event.lat ?? null,
      event.lng ?? null,
      JSON.stringify({
        source: "passive_audio_ingest",
        source_name: event.source_name,
        consent_scope: event.consent_scope,
      }),
    ],
  );

  await client.query(
    `insert into visits (
        visit_id, place_id, observed_at, session_mode, visit_mode, complete_checklist_flag,
        target_taxa_scope, effort_minutes, point_latitude, point_longitude,
        coordinate_uncertainty_m, source_kind, source_payload,
        public_visibility, quality_review_status, quality_gate_reasons,
        created_at, updated_at
     ) values (
        $1, $2, $3, 'passive_audio', 'survey', false,
        'birds_audio', $4, $5, $6,
        $7, 'passive_audio_ingest', $8::jsonb,
        'review', 'needs_review', $9::jsonb,
        now(), now()
     )`,
    [
      ids.visitId,
      ids.placeId,
      event.observed_start_at,
      Math.max(0, (new Date(event.observed_end_at).getTime() - new Date(event.observed_start_at).getTime()) / 60000),
      event.lat ?? null,
      event.lng ?? null,
      event.coordinate_uncertainty_m ?? null,
      JSON.stringify({
        ingest_schema_version: event.ingest_schema_version,
        source_type: event.source_type,
        source_id: event.source_id,
        source_name: event.source_name,
        device_id: event.device_id ?? null,
        samplingProtocol: event.samplingProtocol,
        detection_method: event.detection_method,
        consent_scope: event.consent_scope,
        dedupe_key: ids.dedupeKey,
      }),
      JSON.stringify(["ai_audio_candidate", "missing_human_review"]),
    ],
  );

  await client.query(
    `insert into occurrences (
        occurrence_id, visit_id, subject_index, scientific_name, vernacular_name,
        taxon_concept_version, basis_of_record, occurrence_status, confidence_score,
        evidence_tier, data_quality, ai_assessment_status, evidence_tags, source_payload,
        created_at, updated_at
     ) values (
        $1, $2, 0, $3, $4,
        $5, 'MachineObservation', 'present', $6,
        1, 'ai_candidate', 'ai_audio_candidate', $7::jsonb, $8::jsonb,
        now(), now()
     )`,
    [
      ids.occurrenceId,
      ids.visitId,
      event.scientific_name ?? null,
      event.vernacular_name ?? event.species_label,
      event.taxon_concept_version ?? null,
      event.confidence,
      JSON.stringify(["audio-derived", "passive-audio"]),
      JSON.stringify({
        source: "passive_audio_ingest",
        species_label: event.species_label,
        basisOfRecord: event.basisOfRecord,
        samplingProtocol: event.samplingProtocol,
        detection_method: event.detection_method,
        tier15_candidate: ids.tier15Candidate,
        provenance: event.provenance,
      }),
    ],
  );

  await client.query(
    `insert into identifications (
        occurrence_id, actor_kind, proposed_name, identification_method,
        confidence_score, is_current, notes, source_payload, created_at
     ) values (
        $1, 'ai', $2, 'ai_audio',
        $3, true, $4, $5::jsonb, now()
     )`,
    [
      ids.occurrenceId,
      event.scientific_name ?? event.species_label,
      event.confidence,
      "AI候補。reviewer検証済みではない。",
      JSON.stringify({
        model_id: event.model_id ?? null,
        model_version: event.model_version ?? null,
        birdnet_go_version: event.birdnet_go_version ?? null,
        provider_label: event.species_label,
        verification_status: "raw",
      }),
    ],
  );

  const evidence = await client.query<{ asset_id: string }>(
    `insert into evidence_assets (
        occurrence_id, visit_id, asset_role, legacy_asset_key, source_payload, created_at
     ) values (
        $1, $2, 'observation_audio', $3, $4::jsonb, now()
     )
     returning asset_id`,
    [
      ids.occurrenceId,
      ids.visitId,
      `passive-audio:${ids.dedupeKey}`,
      JSON.stringify({
        media_type: "audio-derived",
        audio_snippet_hash: event.audio_snippet_hash ?? null,
        spectrogram_ref: event.spectrogram_ref ?? null,
        clip_ref: event.clip_ref ?? null,
        consent_scope: event.consent_scope,
        raw_audio_stored: false,
        captureTimestamp: event.observed_start_at,
      }),
    ],
  );

  const segment = await client.query<{ segment_id: string }>(
    `insert into audio_segments (
        external_id, session_id, visit_id, place_id, recorded_at, duration_sec,
        lat, lng, storage_path, storage_provider, mime_type, bytes,
        transcription_status, meta, privacy_status, voice_flag, visibility, fingerprint,
        created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, '', 'event_only', 'application/vnd.ikimon.passive-audio-event+json', 0,
        'done', $9::jsonb, 'clean', false, 'owner_only', $10::jsonb,
        now(), now()
     )
     returning segment_id`,
    [
      `passive-audio:${ids.dedupeKey}`,
      sessionIdFor(event),
      ids.visitId,
      ids.placeId,
      event.observed_start_at,
      Math.max(0, (new Date(event.observed_end_at).getTime() - new Date(event.observed_start_at).getTime()) / 1000),
      event.lat ?? null,
      event.lng ?? null,
      JSON.stringify({
        source: "passive_audio_ingest",
        source_type: event.source_type,
        source_id: event.source_id,
        source_name: event.source_name,
        device_id: event.device_id ?? null,
        evidence_asset_id: evidence.rows[0]?.asset_id ?? null,
        consent_scope: event.consent_scope,
        raw_audio_stored: false,
      }),
      JSON.stringify({ audio_snippet_hash: event.audio_snippet_hash ?? null }),
    ],
  );
  const segmentId = segment.rows[0]?.segment_id;
  if (!segmentId) throw new Error("audio_segment_insert_failed");

  await client.query(
    `insert into audio_detections (
        segment_id, detected_taxon, scientific_name, confidence, provider,
        offset_sec, duration_sec, dual_agree, raw_score, detected_at
     ) values (
        $1, $2, $3, $4, $5,
        0, $6, false, $7::jsonb, now()
     )`,
    [
      segmentId,
      event.species_label,
      event.scientific_name ?? null,
      event.confidence,
      event.model_id ?? event.source_type,
      Math.max(0, (new Date(event.observed_end_at).getTime() - new Date(event.observed_start_at).getTime()) / 1000),
      JSON.stringify({
        model_id: event.model_id ?? null,
        model_version: event.model_version ?? null,
        birdnet_go_version: event.birdnet_go_version ?? null,
        provenance: event.provenance,
        tier15_candidate: ids.tier15Candidate,
      }),
    ],
  );
  return segmentId;
}

export async function ingestPassiveAudioDetectionsBatch(events: unknown[]): Promise<PassiveAudioBatchResult> {
  const results: PassiveAudioBatchResult["results"] = [];
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  for (const [index, event] of events.entries()) {
    try {
      const result = await ingestPassiveAudioDetection(event);
      if (result.status === "accepted") accepted += 1;
      if (result.status === "duplicate") duplicates += 1;
      const { status, ...rest } = result;
      results.push({ index, status, ...rest });
    } catch (error) {
      if (!(error instanceof PassiveAudioValidationError)) throw error;
      rejected += 1;
      results.push({ index, status: "rejected", error: error.message });
    }
  }
  return { ok: rejected === 0, accepted, rejected, duplicates, results };
}
