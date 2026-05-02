import { getPool } from "../db.js";

export type GuideEnvironmentRefreshRunInput = {
  triggerSource: "postdeploy" | "timer" | "manual" | "staging";
  status: "success" | "failure";
  diagnosisDate: string;
  startedAt: Date;
  finishedAt: Date;
  meshRebuildNeeded: boolean;
  rebuildAction: string;
  guideRecordCount: number;
  aggregatableGuideRecords: number;
  publicMeshCellCount: number;
  suppressedMeshCellCount: number;
  hypothesesGenerated: number;
  hypothesesWritten: number;
  evalItemsCount: number;
  promptImprovementsWritten: number;
  runPayload: Record<string, unknown>;
  errorMessage?: string;
};

export type GuideEnvironmentDashboardMetrics = {
  latestRun: {
    runId: string;
    triggerSource: string;
    status: string;
    diagnosisDate: string;
    startedAt: string;
    finishedAt: string;
    meshRebuildNeeded: boolean;
    rebuildAction: string;
    guideRecordCount: number;
    publicMeshCellCount: number;
    suppressedMeshCellCount: number;
    hypothesesWritten: number;
    evalItemsCount: number;
    promptImprovementsWritten: number;
    errorMessage: string;
  } | null;
  totals: {
    meshCells: number;
    publicMeshCells: number;
    hypotheses: number;
    helpfulInteractions: number;
    wrongInteractions: number;
    promptImprovements: number;
  };
};

type LatestRunRow = {
  run_id: string;
  trigger_source: string;
  status: string;
  diagnosis_date: string;
  started_at: string;
  finished_at: string;
  mesh_rebuild_needed: boolean;
  rebuild_action: string;
  guide_record_count: number | string;
  public_mesh_cell_count: number | string;
  suppressed_mesh_cell_count: number | string;
  hypotheses_written: number | string;
  eval_items_count: number | string;
  prompt_improvements_written: number | string;
  error_message: string;
};

type TotalsRow = {
  mesh_cells: string | number;
  public_mesh_cells: string | number;
  hypotheses: string | number;
  helpful_interactions: string | number;
  wrong_interactions: string | number;
  prompt_improvements: string | number;
};

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function recordGuideEnvironmentRefreshRun(input: GuideEnvironmentRefreshRunInput): Promise<string | null> {
  const result = await getPool().query<{ run_id: string }>(
    `insert into guide_environment_refresh_runs (
        trigger_source,
        status,
        diagnosis_date,
        started_at,
        finished_at,
        mesh_rebuild_needed,
        rebuild_action,
        guide_record_count,
        aggregatable_guide_records,
        public_mesh_cell_count,
        suppressed_mesh_cell_count,
        hypotheses_generated,
        hypotheses_written,
        eval_items_count,
        prompt_improvements_written,
        run_payload,
        error_message
     ) values (
        $1,
        $2,
        $3::date,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16::jsonb,
        $17
     )
     returning run_id::text`,
    [
      input.triggerSource,
      input.status,
      input.diagnosisDate,
      input.startedAt.toISOString(),
      input.finishedAt.toISOString(),
      input.meshRebuildNeeded,
      input.rebuildAction,
      input.guideRecordCount,
      input.aggregatableGuideRecords,
      input.publicMeshCellCount,
      input.suppressedMeshCellCount,
      input.hypothesesGenerated,
      input.hypothesesWritten,
      input.evalItemsCount,
      input.promptImprovementsWritten,
      JSON.stringify(input.runPayload),
      input.errorMessage ?? "",
    ],
  );
  return result.rows[0]?.run_id ?? null;
}

export async function loadGuideEnvironmentDashboardMetrics(): Promise<GuideEnvironmentDashboardMetrics> {
  const latest = await getPool().query<LatestRunRow>(
    `select run_id::text,
            trigger_source,
            status,
            diagnosis_date::text,
            started_at::text,
            finished_at::text,
            mesh_rebuild_needed,
            rebuild_action,
            guide_record_count,
            public_mesh_cell_count,
            suppressed_mesh_cell_count,
            hypotheses_written,
            eval_items_count,
            prompt_improvements_written,
            error_message
       from guide_environment_refresh_runs
      order by started_at desc
      limit 1`,
  ).catch(() => ({ rows: [] as LatestRunRow[] }));

  const totals = await getPool().query<TotalsRow>(
    `select
        (select count(*) from guide_environment_mesh_cells) as mesh_cells,
        (select count(*) from guide_environment_mesh_cells where guide_record_count >= 3 or contributor_count >= 2) as public_mesh_cells,
        (select count(*) from regional_hypotheses where review_status <> 'rejected') as hypotheses,
        (select count(*) from guide_interactions where interaction_type = 'helpful') as helpful_interactions,
        (select count(*) from guide_interactions where interaction_type = 'wrong') as wrong_interactions,
        (select count(*) from guide_hypothesis_prompt_improvements where review_status <> 'rejected') as prompt_improvements`,
  ).catch(() => ({ rows: [] as TotalsRow[] }));

  const latestRow = latest.rows[0];
  const totalRow = totals.rows[0];
  return {
    latestRun: latestRow ? {
      runId: latestRow.run_id,
      triggerSource: latestRow.trigger_source,
      status: latestRow.status,
      diagnosisDate: latestRow.diagnosis_date,
      startedAt: latestRow.started_at,
      finishedAt: latestRow.finished_at,
      meshRebuildNeeded: latestRow.mesh_rebuild_needed,
      rebuildAction: latestRow.rebuild_action,
      guideRecordCount: toInt(latestRow.guide_record_count),
      publicMeshCellCount: toInt(latestRow.public_mesh_cell_count),
      suppressedMeshCellCount: toInt(latestRow.suppressed_mesh_cell_count),
      hypothesesWritten: toInt(latestRow.hypotheses_written),
      evalItemsCount: toInt(latestRow.eval_items_count),
      promptImprovementsWritten: toInt(latestRow.prompt_improvements_written),
      errorMessage: latestRow.error_message,
    } : null,
    totals: {
      meshCells: toInt(totalRow?.mesh_cells),
      publicMeshCells: toInt(totalRow?.public_mesh_cells),
      hypotheses: toInt(totalRow?.hypotheses),
      helpfulInteractions: toInt(totalRow?.helpful_interactions),
      wrongInteractions: toInt(totalRow?.wrong_interactions),
      promptImprovements: toInt(totalRow?.prompt_improvements),
    },
  };
}
