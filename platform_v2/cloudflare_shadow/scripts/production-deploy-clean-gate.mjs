const ALLOWED_GENERATED_DEPLOY_PATHS = new Set([
  ".cache/",
  "materialize-original-ui.json",
  "platform_v2/cloudflare_shadow/materialize-original-ui.json",
]);

function unexpectedWorktreeStatus(state) {
  const status = String(state.worktreeGitStatus ?? state.gitStatus ?? "").trim();
  if (!status) return [];
  return status
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const match = line.match(/^\?\?\s+(.+)$/);
      if (!match) return true;
      const path = match[1].replace(/^"|"$/g, "");
      return !ALLOWED_GENERATED_DEPLOY_PATHS.has(path);
    });
}

export function assertProductionExecuteWorktreeClean({ execute, state, phase }) {
  if (!execute) return;
  const clean = state.worktreeClean ?? state.clean;
  if (clean) return;
  const unexpected = unexpectedWorktreeStatus(state);
  if (unexpected.length === 0) return;
  throw new Error(`production_execute_requires_clean_worktree:${phase}\n${unexpected.join("\n")}`);
}

export function assertProductionExecuteStateUnchanged({ execute, before, after, phase }) {
  if (!execute) return;
  for (const field of ["gitHead", "deployInputSha256", "packageLockSha256"]) {
    if (before[field] !== after[field]) {
      throw new Error(`production_execute_state_changed:${phase}:${field}`);
    }
  }
}
