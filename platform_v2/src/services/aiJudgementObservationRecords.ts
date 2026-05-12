import type { PoolClient } from "pg";
import { makeOccurrenceId } from "./writeSupport.js";

export type AiJudgementObservationRecordInput = {
  visitId: string;
  visitLegacyObservationId?: string | null;
  aiRunId: string;
  candidateId: string;
  candidateKey: string;
  vernacularName: string;
  scientificName: string;
  taxonRank: string | null;
  confidence: number | null;
  note: string | null;
  sourceTag: string;
  gbif: {
    usageKey?: number | null;
    matchType?: string | null;
    confidence?: number | null;
  } | null;
  matchedOccurrenceId?: string | null;
};

export type AiJudgementObservationRecordResult = {
  occurrenceId: string | null;
  materialized: boolean;
  matchedExisting: boolean;
};

const MATERIALIZE_CONFIDENCE_MIN = 0.5;
const MATERIALIZE_RANKS = new Set(["species", "genus", "family", "lifeform"]);

function cleanText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function boundedConfidence(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function shouldMaterializeAiJudgement(input: {
  vernacularName?: string | null;
  scientificName?: string | null;
  taxonRank?: string | null;
  confidence?: number | null;
}): boolean {
  const name = cleanText(input.scientificName) || cleanText(input.vernacularName);
  if (!name) return false;
  const rank = cleanText(input.taxonRank).toLowerCase();
  if (rank && !MATERIALIZE_RANKS.has(rank)) return false;
  const confidence = boundedConfidence(input.confidence);
  return confidence == null || confidence >= MATERIALIZE_CONFIDENCE_MIN;
}

async function nextSubjectIndex(client: PoolClient, visitId: string): Promise<number> {
  const result = await client.query<{ next_index: number }>(
    `select coalesce(max(subject_index), -1) + 1 as next_index
       from occurrences
      where visit_id = $1`,
    [visitId],
  );
  return Math.max(0, Number(result.rows[0]?.next_index ?? 0));
}

async function findExistingAiJudgement(
  client: PoolClient,
  visitId: string,
  candidateKey: string,
): Promise<{ occurrenceId: string; subjectIndex: number } | null> {
  const result = await client.query<{ occurrence_id: string; subject_index: number }>(
    `select occurrence_id, subject_index
       from occurrences
      where visit_id = $1
        and source_payload ->> 'ai_judgement_candidate_key' = $2
      order by subject_index asc
      limit 1`,
    [visitId, candidateKey],
  );
  const row = result.rows[0];
  return row ? { occurrenceId: row.occurrence_id, subjectIndex: row.subject_index } : null;
}

export async function materializeAiJudgementObservationRecord(
  client: PoolClient,
  input: AiJudgementObservationRecordInput,
): Promise<AiJudgementObservationRecordResult> {
  if (input.matchedOccurrenceId) {
    return {
      occurrenceId: input.matchedOccurrenceId,
      materialized: false,
      matchedExisting: true,
    };
  }

  if (!shouldMaterializeAiJudgement(input)) {
    return { occurrenceId: null, materialized: false, matchedExisting: false };
  }

  const candidateKey = cleanText(input.candidateKey);
  if (!candidateKey) {
    return { occurrenceId: null, materialized: false, matchedExisting: false };
  }

  const existing = await findExistingAiJudgement(client, input.visitId, candidateKey);
  const subjectIndex = existing?.subjectIndex ?? await nextSubjectIndex(client, input.visitId);
  const occurrenceId = existing?.occurrenceId ?? makeOccurrenceId(input.visitId, subjectIndex);
  const confidence = boundedConfidence(input.confidence);
  const roleHint = cleanText(input.taxonRank).toLowerCase() === "lifeform" ? "vegetation" : "coexisting";
  const sourcePayload = {
    source: "ai_judgement_observation_record",
    ai_judgement_candidate_key: candidateKey,
    ai_judgement: {
      status: "ai_judgement",
      ai_run_id: input.aiRunId,
      candidate_id: input.candidateId,
      confidence,
      note: input.note,
      source_tag: input.sourceTag,
      gbif: input.gbif,
    },
    v2_subject: {
      subject_index: subjectIndex,
      is_primary: false,
      role_hint: roleHint,
      confidence,
      note: input.note,
    },
  };

  await client.query(
    `insert into occurrences (
        occurrence_id, visit_id, legacy_observation_id, subject_index,
        scientific_name, vernacular_name, taxon_rank,
        basis_of_record, occurrence_status, confidence_score,
        evidence_tier, data_quality, quality_grade, ai_assessment_status,
        source_payload, created_at, updated_at
     ) values (
        $1, $2, $3, $4,
        $5, $6, $7,
        'HumanObservation', 'present', $8,
        0.5, 'ai_only_unreviewed', 'ai_judgement', 'ai_judgement',
        $9::jsonb, now(), now()
     )
     on conflict (occurrence_id) do update set
        scientific_name = excluded.scientific_name,
        vernacular_name = excluded.vernacular_name,
        taxon_rank = excluded.taxon_rank,
        confidence_score = excluded.confidence_score,
        evidence_tier = case
          when occurrences.evidence_tier is null or occurrences.evidence_tier < 0.5 then 0.5
          else occurrences.evidence_tier
        end,
        data_quality = 'ai_only_unreviewed',
        quality_grade = 'ai_judgement',
        ai_assessment_status = 'ai_judgement',
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      occurrenceId,
      input.visitId,
      input.visitLegacyObservationId ?? input.visitId,
      subjectIndex,
      cleanText(input.scientificName) || null,
      cleanText(input.vernacularName) || null,
      cleanText(input.taxonRank) || null,
      confidence,
      JSON.stringify(sourcePayload),
    ],
  );

  return {
    occurrenceId,
    materialized: !existing,
    matchedExisting: Boolean(existing),
  };
}

export async function markPrimaryOccurrenceAsAiJudgement(
  client: PoolClient,
  input: {
    occurrenceId: string;
    aiRunId: string;
    confidence: number | null;
    sourceTag: string;
  },
): Promise<void> {
  const confidence = boundedConfidence(input.confidence);
  await client.query(
    `update occurrences o
        set confidence_score = coalesce(o.confidence_score, $2),
            evidence_tier = case
              when o.evidence_tier is null or o.evidence_tier < 0.5 then 0.5
              else o.evidence_tier
            end,
            data_quality = coalesce(nullif(o.data_quality, ''), 'ai_only_unreviewed'),
            quality_grade = coalesce(nullif(o.quality_grade, ''), 'ai_judgement'),
            ai_assessment_status = coalesce(nullif(o.ai_assessment_status, ''), 'ai_judgement'),
            source_payload = coalesce(o.source_payload, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where o.occurrence_id = $1
        and not exists (
          select 1
            from identifications i
           where i.occurrence_id = o.occurrence_id
             and i.actor_kind = 'human'
        )`,
    [
      input.occurrenceId,
      confidence,
      JSON.stringify({
        ai_judgement: {
          status: "ai_judgement",
          ai_run_id: input.aiRunId,
          confidence,
          source_tag: input.sourceTag,
        },
      }),
    ],
  );
}
