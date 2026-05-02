export type CuratorName = "invasive-law" | "redlist" | "paper-research" | "satellite-update";

export type ReceiverCredentials = {
  url: string;
  secret: string;
};

export type CuratorWorkflowContext = {
  runId: string;
  curator: CuratorName;
  inputSnapshotIds: string[];
  receiver: ReceiverCredentials | null;
};

export type CuratorWorkflowResult = {
  status: "success" | "partial" | "failed" | "cancelled";
  prUrl: string | null;
  error: string | null;
  costUsd: number;
  costJpy: number;
  cmaSessionId: null;
  curatorModelProvider: "gemini" | "deepseek" | "none";
  curatorModelName: string | null;
  curatorModelCallCount: number;
  geminiCallCount: number;
  geminiSkipReason: string;
  chunkCount: number;
  rowsProposed: number;
  rowsDroppedValidation: number;
};

export function cancelledResult(reason: string): CuratorWorkflowResult {
  return {
    status: "cancelled",
    prUrl: null,
    error: reason,
    costUsd: 0,
    costJpy: 0,
    cmaSessionId: null,
    curatorModelProvider: "none",
    curatorModelName: null,
    curatorModelCallCount: 0,
    geminiCallCount: 0,
    geminiSkipReason: reason,
    chunkCount: 0,
    rowsProposed: 0,
    rowsDroppedValidation: 0,
  };
}
