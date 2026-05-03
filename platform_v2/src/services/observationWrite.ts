import { createHash, randomUUID } from "node:crypto";
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
import { tryAutoPromoteToTier1_5 } from "./tierPromotion.js";
import { normalizeMediaRole, type MediaRole } from "./mediaRole.js";
import { upsertEvidenceAssetMediaRole } from "./evidenceAssetMediaRole.js";
import {
  hasNativeObservationPhoto,
  upsertVisitQualityReview,
  type ObservationQualitySignals,
} from "./observationQualityGate.js";
import {
  hasUsableObservationCoordinates,
  normalizeObservationLocality,
  type NormalizedObservationLocality,
} from "./localityNormalization.js";
import {
  deriveDefaultCivicContext,
  upsertCivicObservationContext,
  type CivicObservationContextInput,
} from "./civicNatureContext.js";

type ObservationPhotoInput = {
  path: string;
  publicUrl?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
  bytes?: number | null;
  mediaRole?: MediaRole | string | null;
};

/**
 * ADR-0004: 1 observation に複数 subject を並列で保存するための入力型。
 * 画面内の主被写体 + 背景生物、もしくは AI の代替候補を別々の subject として扱う。
 *
 * `isPrimary: true` の subject は subject_index=0、compatibilityWriter と photo 紐付けの対象。
 * それ以外は v2 DB のみに保存（DwC-compliant occurrence として成立させる）。
 *
 * `roleHint` は UI の意味論保持に使う：
 *   - "primary"     写真の主被写体
 *   - "coexisting"  同じ写真に写った別個体（host plant 等）
 *   - "vegetation"  群落・生活形レベル
 *   - "alt_candidate" 同じ被写体に対する代替 taxa 候補
 */
export type ObservationSubjectInput = {
  scientificName?: string | null;
  vernacularName?: string | null;
  rank?: string | null;
  confidence?: number | null;
  isPrimary?: boolean;
  roleHint?: "primary" | "coexisting" | "vegetation" | "alt_candidate";
  note?: string | null;
};

export type ObservationUpsertInput = {
  observationId?: string;
  legacyObservationId?: string | null;
  clientSubmissionId?: string | null;
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
  /** ADR-0004: 複数 subject を並列で書き込みたい時に使う。未指定なら従来通り taxon から 1件作る。 */
  subjects?: ObservationSubjectInput[];
  visitMode?: "manual" | "survey" | null;
  completeChecklistFlag?: boolean;
  targetTaxaScope?: string | null;
  effortMinutes?: number | null;
  distanceMeters?: number | null;
  revisitReason?: string | null;
  sourcePayload?: Record<string, unknown>;
  civicContext?: Partial<CivicObservationContextInput> | null;
};

export type ObservationWriteResult = {
  visitId: string;
  /** primary (subject_index=0) の occurrence_id。後方互換用。 */
  occurrenceId: string;
  /** 全 subject の occurrence_id。primary が先頭。 */
  occurrenceIds: string[];
  placeId: string;
  impact: {
    placeName: string;
    visitCount: number;
    previousObservedAt: string | null;
    focusLabel: string | null;
    captureState: string | null;
  };
  compatibility: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
  idempotency?: {
    clientSubmissionId: string;
    reused: boolean;
  };
};

/**
 * 入力 subjects から書き込む subject 配列を組み立てる。
 *
 * Contract:
 * - manual Field Note は taxon 未設定でも primary subject を 1 件持つ
 * - /notes は visit-first でも、/map は occurrence-first なので
 *   ここで primary occurrence を欠かさないことが整合条件になる
 */
function resolveSubjects(input: ObservationUpsertInput): ObservationSubjectInput[] {
  const inputSubjects = Array.isArray(input.subjects) ? input.subjects : [];
  const fromTaxon = input.taxon
    ? ({
        scientificName: input.taxon.scientificName ?? null,
        vernacularName: input.taxon.vernacularName ?? null,
        rank: input.taxon.rank ?? null,
        isPrimary: true,
        roleHint: "primary" as const,
      } as ObservationSubjectInput)
    : null;

  // subjects 未指定: taxon 1件 or 完全な null primary 1件。
  // note-only write でも occurrence を作るため、この fallback を崩さない。
  if (inputSubjects.length === 0) {
    return [fromTaxon ?? { isPrimary: true, roleHint: "primary" }];
  }

  // subjects 指定あり
  const normalized = inputSubjects.map((s, i) => ({
    ...s,
    isPrimary: s.isPrimary ?? i === 0,
  }));
  const hasPrimary = normalized.some((s) => s.isPrimary);

  if (!hasPrimary) {
    // 明示 primary なし: taxon を先頭 primary として差し込む（taxon もなければ最初の subject を primary に昇格）
    if (fromTaxon) return [fromTaxon, ...normalized];
    normalized[0] = { ...normalized[0]!, isPrimary: true, roleHint: normalized[0]?.roleHint ?? "primary" };
    return normalized;
  }

  // 既に primary あり: primary を先頭にソート
  return [...normalized].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
}

function assertObservationInput(input: ObservationUpsertInput): void {
  if (!input.userId || input.userId.trim() === "") {
    throw new Error("userId is required");
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error("latitude and longitude are required");
  }

  if (!hasUsableObservationCoordinates(input.latitude, input.longitude)) {
    throw new Error("valid latitude and longitude are required");
  }

  if (!input.observedAt || input.observedAt.trim() === "") {
    throw new Error("observedAt is required");
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizeClientSubmissionId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > 180) {
    throw new Error("client_submission_id_too_long");
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error("client_submission_id_invalid");
  }
  return normalized;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestFingerprint(
  input: ObservationUpsertInput,
  subjects: ObservationSubjectInput[],
  observedAt: string,
  locality: NormalizedObservationLocality,
): string {
  return createHash("sha256").update(stableJson({
    userId: input.userId,
    observedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    siteId: input.siteId ?? null,
    siteName: input.siteName ?? null,
    municipality: locality.municipality,
    prefecture: locality.prefecture,
    photos: (Array.isArray(input.photos) ? input.photos : []).map((photo) => ({
      sha256: photo.sha256 ?? null,
      bytes: photo.bytes ?? null,
      path: photo.path ?? null,
    })),
    clientPhotoHashes: Array.isArray(input.sourcePayload?.client_photo_sha256s)
      ? input.sourcePayload?.client_photo_sha256s
      : null,
    subjects,
    taxon: input.taxon ?? null,
  })).digest("hex");
}

async function buildObservationImpact(input: ObservationUpsertInput, placeId: string, focusLabel: string | null, quickCaptureState: string | null) {
  const locality = normalizeObservationLocality({
    prefecture: input.prefecture,
    municipality: input.municipality,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const impactResult = await getPool().query<{
    place_name: string | null;
    visit_count: string;
    previous_observed_at: string | null;
  }>(
    `select
        p.canonical_name as place_name,
        count(v.visit_id)::text as visit_count,
        previous_visit.previous_observed_at
     from places p
     left join visits v
       on v.place_id = p.place_id
      and v.user_id = $1
     left join lateral (
       select v2.observed_at::text as previous_observed_at
       from visits v2
       where v2.user_id = $1
         and v2.place_id = p.place_id
       order by v2.observed_at desc, v2.visit_id desc
       offset 1
       limit 1
     ) previous_visit on true
     where p.place_id = $2
     group by p.canonical_name, previous_visit.previous_observed_at`,
    [input.userId, placeId],
  );
  const impactRow = impactResult.rows[0];
  return {
    placeName: impactRow?.place_name ?? buildPlaceName({
      siteName: input.siteName,
      municipality: locality.municipality,
      prefecture: locality.prefecture,
    }),
    visitCount: Number(impactRow?.visit_count ?? "1"),
    previousObservedAt: impactRow?.previous_observed_at ?? null,
    focusLabel,
    captureState: quickCaptureState ?? null,
  };
}

async function existingObservationResult(input: ObservationUpsertInput, clientSubmissionId: string, visitId: string): Promise<ObservationWriteResult> {
  const pool = getPool();
  const result = await pool.query<{
    visit_id: string;
    place_id: string | null;
    occurrence_id: string;
    occurrence_ids: string[];
    quick_capture_state: string | null;
    focus_label: string | null;
  }>(
    `select
        v.visit_id,
        v.place_id,
        primary_occ.occurrence_id,
        coalesce(occ_ids.occurrence_ids, array[primary_occ.occurrence_id]) as occurrence_ids,
        v.source_payload ->> 'quick_capture_state' as quick_capture_state,
        coalesce(
          v.source_payload ->> 'next_look_for',
          v.target_taxa_scope,
          v.source_payload ->> 'revisit_reason',
          primary_occ.vernacular_name,
          primary_occ.scientific_name
        ) as focus_label
     from visits v
     join lateral (
       select occurrence_id, vernacular_name, scientific_name
       from occurrences
       where visit_id = v.visit_id
       order by subject_index asc, created_at asc
       limit 1
     ) primary_occ on true
     left join lateral (
       select array_agg(occurrence_id order by subject_index asc, created_at asc) as occurrence_ids
       from occurrences
       where visit_id = v.visit_id
     ) occ_ids on true
     where v.visit_id = $1
     limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("idempotent_observation_missing");
  }
  const locality = normalizeObservationLocality({
    prefecture: input.prefecture,
    municipality: input.municipality,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const placeId = row.place_id ?? buildPlaceId({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    municipality: locality.municipality,
    prefecture: locality.prefecture,
  });
  return {
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    occurrenceIds: row.occurrence_ids,
    placeId,
    impact: await buildObservationImpact(input, placeId, row.focus_label, row.quick_capture_state),
    compatibility: {
      attempted: false,
      succeeded: false,
    },
    idempotency: {
      clientSubmissionId,
      reused: true,
    },
  };
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function buildServerLocationAuditPayload(
  input: ObservationUpsertInput,
  locality: NormalizedObservationLocality,
): Record<string, unknown> {
  const clientPayload = input.sourcePayload && typeof input.sourcePayload === "object"
    ? input.sourcePayload
    : {};
  return {
    schema: "ikimon.location_audit.v1",
    savedCoordinates: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
    savedLocality: {
      country: input.country ?? "JP",
      prefecture: locality.prefecture,
      municipality: locality.municipality,
      localityNote: input.localityNote ?? null,
    },
    submittedLocality: {
      prefecture: input.prefecture ?? null,
      municipality: input.municipality ?? null,
      localityNote: input.localityNote ?? null,
    },
    clientProvenance: clientPayload.location_provenance ?? null,
    normalizedAt: new Date().toISOString(),
  };
}

export async function upsertObservation(input: ObservationUpsertInput): Promise<ObservationWriteResult> {
  assertObservationInput(input);

  const pool = getPool();
  const client = await pool.connect();
  const clientSubmissionId = normalizeClientSubmissionId(input.clientSubmissionId);
  const visitId = input.observationId?.trim() || randomUUID();
  const subjects = resolveSubjects(input);
  const occurrenceId = makeOccurrenceId(visitId, 0);
  const occurrenceIds = subjects.map((_, i) => makeOccurrenceId(visitId, i));
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const hasPhoto = hasNativeObservationPhoto(photos);
  const qualitySignals: ObservationQualitySignals = {
    hasPhoto,
    hasAudio: false,
    hasLocation: hasUsableObservationCoordinates(input.latitude, input.longitude),
    hasIdentification: subjects.some((subject) =>
      Boolean(normalizeOptionalText(subject.scientificName) ?? normalizeOptionalText(subject.vernacularName) ?? normalizeOptionalText(subject.rank)),
    ),
    isPublicReady: true,
    gateReasons: [
      hasPhoto ? null : "missing_photo",
      "missing_audio",
      hasUsableObservationCoordinates(input.latitude, input.longitude) ? null : "missing_location",
      subjects.some((subject) =>
        Boolean(normalizeOptionalText(subject.scientificName) ?? normalizeOptionalText(subject.vernacularName) ?? normalizeOptionalText(subject.rank)),
      ) ? null : "missing_identification",
    ].filter((reason): reason is string => reason !== null),
  };
  const publicVisibility = hasPhoto ? "public" : "review";
  const qualityReviewStatus = hasPhoto ? "accepted" : "needs_review";
  const visitMode = input.visitMode === "survey" ? "survey" : "manual";
  const locality = normalizeObservationLocality({
    prefecture: input.prefecture,
    municipality: input.municipality,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const completeChecklistFlag = visitMode === "survey" ? Boolean(input.completeChecklistFlag) : false;
  const targetTaxaScope = visitMode === "survey"
    ? normalizeOptionalText(input.targetTaxaScope)
    : null;
  const effortMinutes = visitMode === "survey"
    ? normalizeOptionalNumber(input.effortMinutes)
    : null;
  const sourcePayload = (input.sourcePayload && typeof input.sourcePayload === "object")
    ? input.sourcePayload
    : {};
  const distanceMeters = normalizeOptionalNumber(input.distanceMeters);
  const revisitReason = normalizeOptionalText(input.revisitReason);
  const nextLookFor = typeof sourcePayload.next_look_for === "string"
    ? normalizeOptionalText(sourcePayload.next_look_for)
    : null;
  const quickCaptureState = typeof sourcePayload.quick_capture_state === "string"
    ? normalizeOptionalText(sourcePayload.quick_capture_state)
    : null;
  const focusLabel = nextLookFor
    ?? targetTaxaScope
    ?? revisitReason
    ?? normalizeOptionalText(subjects[0]?.vernacularName)
    ?? normalizeOptionalText(subjects[0]?.scientificName)
    ?? null;
  const placeId = buildPlaceId({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    municipality: locality.municipality,
    prefecture: locality.prefecture,
  });
  const observedAt = normalizeTimestamp(input.observedAt);
  const fingerprint = requestFingerprint(input, subjects, observedAt, locality);
  const eventSessionId = (input as unknown as { eventSessionId?: unknown }).eventSessionId;
  const eventCode = (input as unknown as { eventCode?: unknown }).eventCode;
  const explicitCivicContext = input.civicContext && typeof input.civicContext === "object"
    ? input.civicContext
    : null;
  const shouldWriteDerivedContext =
    Boolean(explicitCivicContext) ||
    typeof eventSessionId === "string" ||
    typeof eventCode === "string" ||
    typeof input.sourcePayload?.risk_lane === "string";
  const pendingCivicContext = shouldWriteDerivedContext
    ? explicitCivicContext
      ? {
          ...explicitCivicContext,
          visitId,
          occurrenceId,
        }
      : deriveDefaultCivicContext({
          visitId,
          occurrenceId,
          eventSessionId,
          eventCode,
          sourcePayload: input.sourcePayload ?? null,
        })
    : null;

  try {
    await client.query("begin");

    const userExists = await client.query<{ exists: boolean }>(
      "select exists(select 1 from users where user_id = $1) as exists",
      [input.userId],
    );
    if (!userExists.rows[0]?.exists) {
      throw new Error(`Unknown userId: ${input.userId}`);
    }

    if (clientSubmissionId) {
      const inserted = await client.query<{ client_submission_id: string }>(
        `insert into observation_write_idempotency (
            client_submission_id, user_id, request_fingerprint, write_status, source_payload, created_at, updated_at, last_seen_at
         ) values (
            $1, $2, $3, 'in_progress', $4::jsonb, now(), now(), now()
         )
         on conflict do nothing
         returning client_submission_id`,
        [
          clientSubmissionId,
          input.userId,
          fingerprint,
          JSON.stringify({
            source: "v2_write_api",
            observation_id: visitId,
            client_photo_sha256s: Array.isArray(input.sourcePayload?.client_photo_sha256s)
              ? input.sourcePayload?.client_photo_sha256s
              : [],
          }),
        ],
      );
      if (!inserted.rows[0]?.client_submission_id) {
        const existing = await client.query<{
          user_id: string;
          visit_id: string | null;
          request_fingerprint: string;
          write_status: string;
        }>(
          `select user_id, visit_id, request_fingerprint, write_status
             from observation_write_idempotency
            where client_submission_id = $1
            for update`,
          [clientSubmissionId],
        );
        const row = existing.rows[0];
        if (!row || row.user_id !== input.userId) {
          throw new Error("client_submission_id_conflict");
        }
        if (row.visit_id) {
          await client.query(
            `update observation_write_idempotency
                set duplicate_count = duplicate_count + 1,
                    last_seen_at = now(),
                    updated_at = now()
              where client_submission_id = $1`,
            [clientSubmissionId],
          );
          await client.query("commit");
          return await existingObservationResult(input, clientSubmissionId, row.visit_id);
        }
        if (row.request_fingerprint !== fingerprint) {
          throw new Error("client_submission_id_conflict");
        }
        throw new Error("duplicate_submission_in_progress");
      }
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
          municipality: locality.municipality,
          prefecture: locality.prefecture,
        }),
        input.siteName ?? input.localityNote ?? null,
        input.country ?? "JP",
        locality.prefecture,
        locality.municipality,
        input.latitude,
        input.longitude,
        JSON.stringify({
          source: "v2_write_api",
          site_id: input.siteId ?? null,
          site_name: input.siteName ?? null,
          record_mode: visitMode,
        }),
        observedAt,
      ],
    );

    const locationAudit = buildServerLocationAuditPayload(input, locality);
    const visitSourcePayload = {
      ...(input.sourcePayload ?? {}),
      location_audit: locationAudit,
      record_mode: visitMode,
      revisit_reason: revisitReason,
    };

    await client.query(
      `insert into visits (
          visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
          complete_checklist_flag, target_taxa_scope, effort_minutes, distance_meters, point_latitude, point_longitude,
          observed_country, observed_prefecture, observed_municipality, locality_note, note,
          source_kind, source_payload, public_visibility, quality_review_status, quality_gate_reasons, created_at, updated_at
       ) values (
          $1, $2, $3, $4, $5, 'standard', $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, 'v2_observation', $18::jsonb, $19, $20, $21::jsonb, $22, now()
       )
       on conflict (visit_id) do update set
          legacy_observation_id = excluded.legacy_observation_id,
          place_id = excluded.place_id,
          user_id = excluded.user_id,
          observed_at = excluded.observed_at,
          visit_mode = excluded.visit_mode,
          complete_checklist_flag = excluded.complete_checklist_flag,
          target_taxa_scope = excluded.target_taxa_scope,
          effort_minutes = excluded.effort_minutes,
          distance_meters = excluded.distance_meters,
          point_latitude = excluded.point_latitude,
          point_longitude = excluded.point_longitude,
          observed_country = excluded.observed_country,
          observed_prefecture = excluded.observed_prefecture,
          observed_municipality = excluded.observed_municipality,
          locality_note = excluded.locality_note,
          note = excluded.note,
          source_payload = excluded.source_payload,
          public_visibility = excluded.public_visibility,
          quality_review_status = excluded.quality_review_status,
          quality_gate_reasons = excluded.quality_gate_reasons,
          updated_at = now()`,
      [
        visitId,
        input.legacyObservationId ?? visitId,
        placeId,
        input.userId,
        observedAt,
        visitMode,
        completeChecklistFlag,
        targetTaxaScope,
        effortMinutes,
        distanceMeters,
        input.latitude,
        input.longitude,
        input.country ?? "JP",
        locality.prefecture,
        locality.municipality,
        input.localityNote ?? null,
        input.note ?? null,
        JSON.stringify(visitSourcePayload),
        publicVisibility,
        qualityReviewStatus,
        JSON.stringify(qualitySignals.gateReasons),
        observedAt,
      ],
    );

    // ADR-0004: subjects[] を subject_index 0..N で並列に INSERT。primary=0、背景生物は 1,2,...。
    // manual Field Note と /map の整合のため、subject_index=0 の primary occurrence は常に必要。
    // 同 visit_id に対して subjects 件数より多い古い occurrence があれば削除（掃除）。
    await client.query(
      `delete from occurrences where visit_id = $1 and subject_index >= $2`,
      [visitId, subjects.length],
    );

    for (let i = 0; i < subjects.length; i += 1) {
      const subject = subjects[i]!;
      const occId = occurrenceIds[i]!;
      const occPayload = {
        ...(input.sourcePayload ?? {}),
        location_audit: locationAudit,
        v2_subject: {
          subject_index: i,
          is_primary: Boolean(subject.isPrimary),
          role_hint: subject.roleHint ?? (i === 0 ? "primary" : "coexisting"),
          confidence: typeof subject.confidence === "number" ? subject.confidence : null,
          note: subject.note ?? null,
        },
      };
      await client.query(
        `insert into occurrences (
            occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
            taxon_rank, basis_of_record, organism_origin, cultivation, occurrence_status,
            confidence_score, evidence_tier, data_quality, quality_grade, ai_assessment_status, best_supported_descendant_taxon,
            biome, substrate_tags, evidence_tags, source_payload, created_at, updated_at
         ) values (
            $1, $2, $3, $4, $5, $6, $7, 'HumanObservation', $8, $9, 'present',
            $10, 1, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, now()
         )
         on conflict (occurrence_id) do update set
            subject_index = excluded.subject_index,
            scientific_name = excluded.scientific_name,
            vernacular_name = excluded.vernacular_name,
            taxon_rank = excluded.taxon_rank,
            organism_origin = excluded.organism_origin,
            cultivation = excluded.cultivation,
            confidence_score = excluded.confidence_score,
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
          occId,
          visitId,
          input.legacyObservationId ?? visitId,
          i,
          subject.scientificName ?? null,
          subject.vernacularName ?? null,
          subject.rank ?? null,
          i === 0 ? (input.organismOrigin ?? null) : null,
          i === 0 ? (input.cultivation ?? null) : null,
          typeof subject.confidence === "number" ? Math.max(0, Math.min(1, subject.confidence)) : null,
          i === 0 ? (input.dataQuality ?? null) : null,
          i === 0 ? (input.qualityGrade ?? null) : null,
          i === 0 ? (input.aiAssessmentStatus ?? null) : null,
          i === 0 ? (input.bestSupportedDescendantTaxon ?? null) : null,
          i === 0 ? (input.biome ?? null) : null,
          JSON.stringify(i === 0 ? (input.substrateTags ?? []) : []),
          JSON.stringify(i === 0 ? (input.evidenceTags ?? []) : []),
          JSON.stringify(occPayload),
          observedAt,
        ],
      );
    }

    const legacyPhotoKeys = photos.map((photo, index) => `observation_photo:${visitId}:${index}:${photo.path}`);
    if (legacyPhotoKeys.length > 0) {
      await client.query(
        `delete from evidence_assets
         where occurrence_id = $1
           and asset_role = 'observation_photo'
           and legacy_asset_key is not null
           and source_payload ->> 'source' = 'v2_write_api'
           and not (legacy_asset_key = any($2::text[]))`,
        [occurrenceId, legacyPhotoKeys],
      );
    } else {
      await client.query(
        `delete from evidence_assets
         where occurrence_id = $1
           and asset_role = 'observation_photo'
           and legacy_asset_key is not null
           and source_payload ->> 'source' = 'v2_write_api'`,
        [occurrenceId],
      );
    }

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (!photo) {
        continue;
      }
      const legacyAssetKey = `observation_photo:${visitId}:${index}:${photo.path}`;
      const mediaRole = normalizeMediaRole(photo.mediaRole);
      const photoSourcePayload = {
        source: "v2_write_api",
        visit_id: visitId,
        photo_index: index,
        media_role: mediaRole,
      };
      const blobId = await upsertAssetBlob(client, {
        storageBackend: "local_fs",
        storagePath: photo.path,
        mediaType: "image",
        mimeType: photo.mimeType ?? null,
        publicUrl: photo.publicUrl ?? photo.path,
        sha256: photo.sha256 ?? null,
        bytes: photo.bytes ?? null,
        sourcePayload: photoSourcePayload,
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
          photo.path,
          JSON.stringify(photoSourcePayload),
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
          source: "v2_write_api",
          photo_index: index,
        },
      });
    }

    if (!hasPhoto) {
      await upsertVisitQualityReview(client, {
        visitId,
        occurrenceId,
        reasonCode: "native_no_photo",
        reasonDetail: "V2 observation was saved without photo evidence and is held for review before public display.",
        qualitySignals,
        sourcePayload: {
          source: "v2_write_api",
          visit_id: visitId,
        },
      });
    } else {
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

    if (clientSubmissionId) {
      await client.query(
        `update observation_write_idempotency
            set visit_id = $2,
                occurrence_id = $3,
                occurrence_ids = $4::jsonb,
                place_id = $5,
                write_status = 'succeeded',
                updated_at = now(),
                last_seen_at = now()
          where client_submission_id = $1`,
        [
          clientSubmissionId,
          visitId,
          occurrenceId,
          JSON.stringify(occurrenceIds),
          placeId,
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

  if (pendingCivicContext) {
    void upsertCivicObservationContext(pendingCivicContext).catch(() => undefined);
  }

  const impact = await buildObservationImpact(input, placeId, focusLabel, quickCaptureState);

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

  // Non-blocking: try Tier 1 → 1.5 auto-promotion (AI conf ≥ 0.8 × regional record)
  void tryAutoPromoteToTier1_5(occurrenceId).catch(() => undefined);

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
    occurrenceIds,
    placeId,
    impact,
    compatibility,
    idempotency: clientSubmissionId
      ? {
          clientSubmissionId,
          reused: false,
        }
      : undefined,
  };
}
