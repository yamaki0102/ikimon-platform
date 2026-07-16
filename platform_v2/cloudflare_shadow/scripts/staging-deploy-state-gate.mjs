const STABLE_FIELDS = ["gitHead", "deployInputSha256", "packageLockSha256"];

export function assertStagingExecuteState({ execute, before, after, phase }) {
  if (!execute) return;
  const normalizedPhase = String(phase || "unknown");
  if (before?.clean !== true) {
    throw new Error(`staging_execute_requires_clean_worktree:${normalizedPhase}:before`);
  }
  if (after?.clean !== true) {
    throw new Error(`staging_execute_requires_clean_worktree:${normalizedPhase}:after`);
  }
  for (const field of STABLE_FIELDS) {
    if (String(before?.[field] || "") !== String(after?.[field] || "")) {
      throw new Error(`staging_execute_state_changed:${normalizedPhase}:${field}`);
    }
  }
}
