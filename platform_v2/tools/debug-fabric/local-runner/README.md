# IKIMON WSLC Local Luna Runner

This runner is the local execution engine for IKIMON Debug Fabric. It is intentionally separate from Cloudflare, GitHub Actions, production deployment, and the Pixel Review Worker.

## What this slice does

- validates a closed `ikimon.local-debug-task/v1` task;
- resolves one local repository and one immutable 40-character base SHA;
- creates a dedicated `debug/*` branch in an isolated Git worktree;
- acquires a per-task lock before initialization, keeps run state in an append-only event ledger, and resumes interrupted `running` runs;
- accounts each Codex pass before invocation, uses Luna by default, and escalates to Terra only after the shared failure-signature policy is satisfied;
- passes the prompt as an explicit argument with stdin closed by the process adapter;
- removes GitHub, Cloudflare, public-cloud, and API-key credential surfaces from the child environment and redacts common credential shapes from local logs;
- blocks Git push credentials, disables repository commit hooks, redirects GitHub/Cloudflare CLI configuration to an isolated guard directory, and detects repository-local config or ref mutation;
- runs deterministic checks without a command shell, with a closed executable policy and an isolated HOME;
- blocks common proxy-based outbound traffic for deterministic checks while preserving localhost tests, rejects inline interpreter commands, and constrains script paths to the worktree;
- clusters repeat failures by a normalized SHA-256 signature;
- rejects Codex commits, staging, branch movement, changed symlinks, unsafe file types, and path escapes before the runner-owned final commit;
- enforces changed-file count and optional path-prefix limits;
- creates one hook-free local candidate commit only after all checks pass, then reruns checks on the exact committed candidate;
- recovers the narrow candidate-finalization crash window and writes immutable local evidence bound to the base SHA, candidate SHA, tree SHA, patch hash, checks, and pass counts.

This slice does **not** push a branch, create a pull request, poll GitHub Issues, deploy to Cloudflare, or modify production. Those are separate adapters after the local candidate and evidence exist.

## Requirements

- Node.js 22 or newer;
- Git;
- Codex CLI signed in with the user's ChatGPT subscription;
- a local repository containing the requested exact base SHA.

The default model slugs are `gpt-5.6-luna` and `gpt-5.6-terra`. Override them only when the installed Codex CLI exposes different model names:

```bash
export IKIMON_CODEX_LUNA_MODEL='gpt-5.6-luna'
export IKIMON_CODEX_TERRA_MODEL='gpt-5.6-terra'
```

The default executable is `codex` on Linux/macOS and `codex.exe` on Windows. Set `IKIMON_CODEX_BIN` when the installed CLI uses another absolute executable path.

The adapter supplies the schema-backed `approval_policy="never"` override before the `exec` subcommand and keeps the Codex sandbox at `workspace-write`. `OPENAI_API_KEY` is explicitly removed. The runner is designed for the subscription/OAuth login already stored by Codex CLI, not API billing.

## One-command WSLC smoke

This creates a private throwaway repository, asks the real signed-in Codex Luna to create one synthetic file, runs the deterministic check, commits the local candidate, and reads back `local-evidence.json`.

```bash
node platform_v2/tools/debug-fabric/local-runner/smoke-wslc.mjs
```

It does not use a project repository, push, deploy, or contact Cloudflare/GitHub. The retained smoke path is printed at completion under `~/.ikimon-debug-fabric/smoke/`.

## Run a real task

Copy the template outside the repository and replace its placeholder path and SHA.

```bash
cp platform_v2/tools/debug-fabric/local-runner/profiles/ai-commander-local-debug.template.json \
  /tmp/ai-commander-local-debug.json

node platform_v2/tools/debug-fabric/local-runner/run-local.mjs \
  --task /tmp/ai-commander-local-debug.json
```

The default run root is outside the repository:

```text
~/.ikimon-debug-fabric/runs/<repository-path-hash>/<task-id>/
```

Set `IKIMON_DEBUG_RUNS_ROOT` or pass `--runs-root` to use a different private local location.

## Result layout

```text
<run>/
  task.json
  state.json
  events.jsonl
  run.lock
  repository-guard.json
  isolated-home/
  git-guard/
  logs/
  artifacts/local-evidence.json
  worktree/
```

A successful result prints a local candidate SHA. The candidate remains local and has not been pushed or deployed.

## Resume behavior

Re-run the same task file. The persisted task hash must match exactly.

- `running` runs resume from the current isolated worktree;
- a pass is counted before Codex starts, so a process crash cannot create unbounded free retries;
- a candidate committed immediately before interruption is recovered only when it is the one direct child of the exact base SHA and the worktree is clean;
- `pass`, `failed`, `blocked`, and `unsafe` runs are terminal and do not rerun automatically;
- stale lock files are recovered only when the recorded process no longer exists;
- logs are append-only and receive retry suffixes instead of being overwritten;
- evidence is written once and cannot overwrite a previous candidate.

A changed objective, SHA, check, path policy, or pass limit requires a new task ID or run directory.

## Safety boundary

The runner strips known credential variables and relocates CLI configuration, but Codex itself still needs network access to reach its model service. The authoritative host isolation boundary remains WSLC/Codex sandboxing plus the runner's no-credential, no-push, no-deploy contracts. Deterministic checks receive an isolated HOME and blocked proxy defaults. Proxy variables are defense in depth, not a substitute for a network namespace.

Repository text and task text are treated as untrusted input and cannot override the fixed runner boundaries.
