import type { Pool, PoolClient } from "pg";
import { rankVisitSubjects, type SubjectRankInput } from "./subjectRanking.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type SelectionSource =
  | "human_consensus"
  | "specialist_lock"
  | "system_stable"
  | "latest_ai_default";

export type DisplayStability = "locked" | "stable" | "adaptive";

export type VisitDisplaySubject = SubjectRankInput & {
  hasSpecialistApproval?: boolean;
};

export type VisitDisplayStateRecord = {
  visitId: string;
  featuredOccurrenceId: string | null;
  selectedReason: string;
  selectionSource: SelectionSource;
  lockedByHuman: boolean;
  derivedFromAiRunId: string | null;
  updatedAt: string | null;
  displayStability: DisplayStability;
};

function displayStabilityFor(state: Pick<VisitDisplayStateRecord, "selectionSource" | "lockedByHuman">): DisplayStability {
  if (state.lockedByHuman || state.selectionSource === "specialist_lock") return "locked";
  if (state.selectionSource === "human_consensus" || state.selectionSource === "system_stable") return "stable";
  return "adaptive";
}

export function deriveVisitDisplayState(
  visitId: string,
  subjects: VisitDisplaySubject[],
  latestAiRunId: string | null,
): VisitDisplayStateRecord {
  const specialistSubjects = subjects.filter((subject) => subject.hasSpecialistApproval);
  if (specialistSubjects.length > 0) {
    const chosen = rankVisitSubjects(specialistSubjects)[0] ?? specialistSubjects[0] ?? null;
    return {
      visitId,
      featuredOccurrenceId: chosen?.occurrenceId ?? null,
      selectedReason: chosen ? `専門家レビュー済みの ${chosen.displayName} を固定表示します。` : "専門家レビュー済みの対象を優先表示します。",
      selectionSource: "specialist_lock",
      lockedByHuman: true,
      derivedFromAiRunId: latestAiRunId,
      updatedAt: null,
      displayStability: "locked",
    };
  }

  const withHumanConsensus = subjects.some((subject) => subject.identificationCount > 0);
  if (withHumanConsensus) {
    const chosen = rankVisitSubjects(subjects)[0] ?? null;
    return {
      visitId,
      featuredOccurrenceId: chosen?.occurrenceId ?? null,
      selectedReason: chosen ? `${chosen.displayName} にコミュニティ同定が最も集まっています。` : "コミュニティ同定が集まっている対象を優先表示します。",
      selectionSource: "human_consensus",
      lockedByHuman: true,
      derivedFromAiRunId: latestAiRunId,
      updatedAt: null,
      displayStability: "locked",
    };
  }

  const hasAiSignal = Boolean(latestAiRunId) || subjects.some((subject) => subject.latestAssessmentBand && subject.latestAssessmentBand !== "unknown");
  if (hasAiSignal) {
    const chosen = rankVisitSubjects(subjects)[0] ?? null;
    return {
      visitId,
      featuredOccurrenceId: chosen?.occurrenceId ?? null,
      selectedReason: chosen ? `${chosen.displayName} を、写真から読めている手がかりの主な候補として表示しています。` : "写真から読めている手がかりの主な候補を表示しています。",
      selectionSource: "latest_ai_default",
      lockedByHuman: false,
      derivedFromAiRunId: latestAiRunId,
      updatedAt: null,
      displayStability: "adaptive",
    };
  }

  const chosen = rankVisitSubjects(subjects)[0] ?? null;
  return {
    visitId,
    featuredOccurrenceId: chosen?.occurrenceId ?? null,
    selectedReason: chosen?.focusReason ?? "安定した既定順で対象を表示します。",
    selectionSource: "system_stable",
    lockedByHuman: false,
    derivedFromAiRunId: null,
    updatedAt: null,
    displayStability: "stable",
  };
}

export async function getStoredVisitDisplayState(
  queryable: Queryable,
  visitId: string,
): Promise<VisitDisplayStateRecord | null> {
  const result = await queryable.query<{
    visit_id: string;
    featured_occurrence_id: string | null;
    selected_reason: string;
    selection_source: SelectionSource;
    locked_by_human: boolean;
    derived_from_ai_run_id: string | null;
    updated_at: string;
  }>(
    `SELECT visit_id,
            featured_occurrence_id,
            selected_reason,
            selection_source,
            locked_by_human,
            derived_from_ai_run_id::text,
            updated_at::text
       FROM visit_display_state
      WHERE visit_id = $1
      LIMIT 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    visitId: row.visit_id,
    featuredOccurrenceId: row.featured_occurrence_id,
    selectedReason: row.selected_reason,
    selectionSource: row.selection_source,
    lockedByHuman: row.locked_by_human,
    derivedFromAiRunId: row.derived_from_ai_run_id,
    updatedAt: row.updated_at,
    displayStability: displayStabilityFor({
      selectionSource: row.selection_source,
      lockedByHuman: row.locked_by_human,
    }),
  };
}

export async function upsertVisitDisplayState(
  queryable: Queryable,
  state: Omit<VisitDisplayStateRecord, "displayStability" | "updatedAt">,
): Promise<void> {
  await queryable.query(
    `INSERT INTO visit_display_state (
        visit_id,
        featured_occurrence_id,
        selected_reason,
        selection_source,
        locked_by_human,
        derived_from_ai_run_id,
        updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (visit_id) DO UPDATE SET
        featured_occurrence_id = EXCLUDED.featured_occurrence_id,
        selected_reason = EXCLUDED.selected_reason,
        selection_source = EXCLUDED.selection_source,
        locked_by_human = EXCLUDED.locked_by_human,
        derived_from_ai_run_id = EXCLUDED.derived_from_ai_run_id,
        updated_at = NOW()`,
    [
      state.visitId,
      state.featuredOccurrenceId,
      state.selectedReason,
      state.selectionSource,
      state.lockedByHuman,
      state.derivedFromAiRunId,
    ],
  );
}
