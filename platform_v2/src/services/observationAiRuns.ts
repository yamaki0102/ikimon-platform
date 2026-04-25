import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type ObservationAiRun = {
  aiRunId: string;
  visitId: string;
  triggerOccurrenceId: string | null;
  pipelineVersion: string;
  modelProvider: string;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  taxonomyVersion: string;
  inputAssetFingerprint: string;
  triggerKind: string;
  triggeredBy: string | null;
  supersedesRunId: string | null;
  runStatus: string;
  generatedAt: string;
};

export type CreateObservationAiRunInput = Omit<ObservationAiRun, "aiRunId" | "generatedAt"> & {
  aiRunId?: string;
  generatedAt?: string;
  sourcePayload?: Record<string, unknown>;
};

function inferModelProvider(modelUsed: string): string {
  const normalized = modelUsed.trim().toLowerCase();
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("gpt") || normalized.includes("openai")) return "openai";
  return normalized ? "unknown" : "legacy";
}

export async function createObservationAiRun(
  queryable: Queryable,
  input: CreateObservationAiRunInput,
): Promise<ObservationAiRun> {
  const aiRunId = input.aiRunId ?? randomUUID();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  await queryable.query(
    `INSERT INTO observation_ai_runs (
        ai_run_id,
        visit_id,
        trigger_occurrence_id,
        pipeline_version,
        model_provider,
        model_name,
        model_version,
        prompt_version,
        taxonomy_version,
        input_asset_fingerprint,
        trigger_kind,
        triggered_by,
        supersedes_run_id,
        run_status,
        source_payload,
        generated_at
     ) VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::uuid,
        $14,
        $15::jsonb,
        $16::timestamptz
     )`,
    [
      aiRunId,
      input.visitId,
      input.triggerOccurrenceId,
      input.pipelineVersion,
      input.modelProvider,
      input.modelName,
      input.modelVersion,
      input.promptVersion,
      input.taxonomyVersion,
      input.inputAssetFingerprint,
      input.triggerKind,
      input.triggeredBy,
      input.supersedesRunId,
      input.runStatus,
      JSON.stringify(input.sourcePayload ?? {}),
      generatedAt,
    ],
  );
  return {
    aiRunId,
    visitId: input.visitId,
    triggerOccurrenceId: input.triggerOccurrenceId,
    pipelineVersion: input.pipelineVersion,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    taxonomyVersion: input.taxonomyVersion,
    inputAssetFingerprint: input.inputAssetFingerprint,
    triggerKind: input.triggerKind,
    triggeredBy: input.triggeredBy,
    supersedesRunId: input.supersedesRunId,
    runStatus: input.runStatus,
    generatedAt,
  };
}

export async function ensureLegacyAiRunsForVisit(queryable: Queryable, visitId: string): Promise<void> {
  const assessments = await queryable.query<{
    assessment_id: string;
    occurrence_id: string | null;
    visit_id: string;
    model_used: string;
    prompt_version: string;
    pipeline_version: string;
    taxonomy_version: string;
    generated_at: string;
  }>(
    `SELECT assessment_id::text,
            occurrence_id,
            visit_id,
            model_used,
            prompt_version,
            pipeline_version,
            taxonomy_version,
            generated_at::text
       FROM observation_ai_assessments
      WHERE visit_id = $1
        AND ai_run_id IS NULL
      ORDER BY generated_at ASC`,
    [visitId],
  );

  for (const assessment of assessments.rows) {
    const modelName = assessment.model_used?.trim() || "legacy-import";
    const aiRunId = randomUUID();
    await createObservationAiRun(queryable, {
      aiRunId,
      visitId: assessment.visit_id,
      triggerOccurrenceId: assessment.occurrence_id,
      pipelineVersion: assessment.pipeline_version?.trim() || "legacy-import",
      modelProvider: inferModelProvider(modelName),
      modelName,
      modelVersion: modelName,
      promptVersion: assessment.prompt_version?.trim() || "legacy-import",
      taxonomyVersion: assessment.taxonomy_version?.trim() || "unknown",
      inputAssetFingerprint: `legacy-assessment:${assessment.assessment_id}`,
      triggerKind: "legacy_backfill",
      triggeredBy: null,
      supersedesRunId: null,
      runStatus: "succeeded",
      sourcePayload: { legacyAssessmentId: assessment.assessment_id },
      generatedAt: assessment.generated_at,
    });
    await queryable.query(
      `UPDATE observation_ai_assessments
          SET ai_run_id = $2::uuid,
              pipeline_version = CASE WHEN pipeline_version = '' THEN 'legacy-import' ELSE pipeline_version END,
              taxonomy_version = CASE WHEN taxonomy_version = '' THEN 'unknown' ELSE taxonomy_version END,
              interpretation_status = CASE WHEN interpretation_status = '' THEN 'selected' ELSE interpretation_status END
        WHERE assessment_id = $1::uuid
          AND ai_run_id IS NULL`,
      [assessment.assessment_id, aiRunId],
    );
  }
}

export async function listObservationAiRunsForVisit(
  queryable: Queryable,
  visitId: string,
): Promise<ObservationAiRun[]> {
  const result = await queryable.query<{
    ai_run_id: string;
    visit_id: string;
    trigger_occurrence_id: string | null;
    pipeline_version: string;
    model_provider: string;
    model_name: string;
    model_version: string;
    prompt_version: string;
    taxonomy_version: string;
    input_asset_fingerprint: string;
    trigger_kind: string;
    triggered_by: string | null;
    supersedes_run_id: string | null;
    run_status: string;
    generated_at: string;
  }>(
    `SELECT ai_run_id::text,
            visit_id,
            trigger_occurrence_id,
            pipeline_version,
            model_provider,
            model_name,
            model_version,
            prompt_version,
            taxonomy_version,
            input_asset_fingerprint,
            trigger_kind,
            triggered_by,
            supersedes_run_id::text,
            run_status,
            generated_at::text
       FROM observation_ai_runs
      WHERE visit_id = $1
      ORDER BY generated_at DESC, created_at DESC`,
    [visitId],
  );
  return result.rows.map((row) => ({
    aiRunId: row.ai_run_id,
    visitId: row.visit_id,
    triggerOccurrenceId: row.trigger_occurrence_id,
    pipelineVersion: row.pipeline_version,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    modelVersion: row.model_version,
    promptVersion: row.prompt_version,
    taxonomyVersion: row.taxonomy_version,
    inputAssetFingerprint: row.input_asset_fingerprint,
    triggerKind: row.trigger_kind,
    triggeredBy: row.triggered_by,
    supersedesRunId: row.supersedes_run_id,
    runStatus: row.run_status,
    generatedAt: row.generated_at,
  }));
}

export async function getLatestObservationAiRunForVisit(
  queryable: Queryable,
  visitId: string,
): Promise<ObservationAiRun | null> {
  const runs = await listObservationAiRunsForVisit(queryable, visitId);
  return runs[0] ?? null;
}
