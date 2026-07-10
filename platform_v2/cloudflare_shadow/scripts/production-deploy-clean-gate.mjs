export function assertProductionExecuteWorktreeClean({ execute, state, phase }) {
  if (!execute) return;
  const clean = state.worktreeClean ?? state.clean;
  if (clean) return;
  const status = String(state.worktreeGitStatus ?? state.gitStatus ?? "").trim();
  throw new Error(`production_execute_requires_clean_worktree:${phase}${status ? `\n${status}` : ""}`);
}

export function assertProductionExecuteStateUnchanged({ execute, before, after, phase }) {
  if (!execute) return;
  for (const field of ["gitHead", "deployInputSha256", "packageLockSha256"]) {
    if (before[field] !== after[field]) {
      throw new Error(`production_execute_state_changed:${phase}:${field}`);
    }
  }
}
