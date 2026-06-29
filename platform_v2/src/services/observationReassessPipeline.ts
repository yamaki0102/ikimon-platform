export const OBSERVATION_REASSESS_PIPELINE_VERSION = "observation-reassess/v2-durable";

export const OBSERVATION_REASSESS_CANDIDATE_ONLY_CONTRACT =
  "observation_reassess_candidate_only_pipeline_contract";

export const OBSERVATION_REASSESS_FORBIDDEN_PROMOTION_TARGETS = [
  "reviewed_occurrence",
  "public_claim",
] as const;

export type ObservationReassessPipelineWrite =
  | "none"
  | "ai_run"
  | "ai_assessment"
  | "ai_judgement_candidate_record"
  | "visual_subject_candidate"
  | "visual_subject_region"
  | "field_context"
  | "management_action_candidate"
  | "alert_event";

export type ObservationReassessPipelineStage = {
  id: string;
  writes: readonly ObservationReassessPipelineWrite[];
  trustBoundary: "read_only" | "candidate_only" | "environment_context" | "best_effort_notification";
  bestEffort?: true;
};

export const OBSERVATION_REASSESS_PIPELINE_STAGES = [
  {
    id: "load_observation_package",
    writes: ["none"],
    trustBoundary: "read_only",
  },
  {
    id: "load_feedback_knowledge",
    writes: ["none"],
    trustBoundary: "read_only",
  },
  {
    id: "prepare_visual_evidence",
    writes: ["none"],
    trustBoundary: "read_only",
  },
  {
    id: "render_prompt",
    writes: ["none"],
    trustBoundary: "read_only",
  },
  {
    id: "run_model_chain",
    writes: ["none"],
    trustBoundary: "read_only",
  },
  {
    id: "parse_taxonomic_guardrails",
    writes: ["none"],
    trustBoundary: "candidate_only",
  },
  {
    id: "persist_ai_run_assessment",
    writes: ["ai_run", "ai_assessment"],
    trustBoundary: "candidate_only",
  },
  {
    id: "persist_candidate_materialization",
    writes: ["ai_judgement_candidate_record", "visual_subject_candidate", "visual_subject_region"],
    trustBoundary: "candidate_only",
  },
  {
    id: "persist_area_inference",
    writes: ["field_context", "management_action_candidate"],
    trustBoundary: "environment_context",
  },
  {
    id: "dispatch_alerts_best_effort",
    writes: ["alert_event"],
    trustBoundary: "best_effort_notification",
    bestEffort: true,
  },
] as const satisfies readonly ObservationReassessPipelineStage[];

export function observationReassessPipelineStageIds(): string[] {
  return OBSERVATION_REASSESS_PIPELINE_STAGES.map((stage) => stage.id);
}
