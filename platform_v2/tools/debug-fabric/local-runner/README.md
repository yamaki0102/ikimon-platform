# IKIMON WSLC Local Luna Runner

This runner is the local execution engine for IKIMON Debug Fabric. It is intentionally separate from Cloudflare, GitHub Actions, production deployment, and the Pixel Review Worker.

## What this slice does

- validates a closed `ikimon.local-debug-task/v1` task;
- resolves one local repository and one immutable 40-character base SHA;
- creates a dedicated `debug/*` branch in an isolated Git worktree;
- keeps run state in an append-only event ledger and resumes interrupted `running` runs;
- invokes Codex with Luna by default and Terra only after the shared escalation policy is satisfied;
- passes the prompt as an explicit argument with stdin closed by the process adapter;
- removes GitHub, Cloudflare, public-cloud, and API-key credential surfaces from the child environment;
- blocks Git push credentials and redirects GitHub/Cloudflare CLI configuration to an isolated guard directory;
- runs deterministic checks without a shell, with a closed executable policy and an isolated HOME;
- blocks common proxy-based outbound traffic for deterministic checks while preserving localhost tests;
- clusters repeat failures by a normalized SHA-256 signature;
- rejects Codex commits, staging, or branch movement before the runner-owned final commit;
- enforces changed-file count and optional path-prefix limits;
- creates one local candidate commit only after all checks pass;
- writes immutable local evidence bound to the base SHA, candidate SHA, tree SHA, patch hash, checks, and pass counts.

This slice does **not** push a branch, create a pull request, poll GitHub Issues, deploy to Cloudflare, or modify production. Those are separate adapters after the local candidate and evidence exist.

## Requirements

- Node.js 22 or newer;
- Git;
- Codex CLI signed in with the user's ChatGPT subscription;
- a local repository containing the requested exact base SHA.

The default model aliases are `luna` and `terra`. Override them when the local CLI uses different names:

```bash
export IKIMON_CODEX_LUNA_MODEL='luna'
export IKIMON_CODEX_TERRA_MODEL='terra'
```

`OPENAI_API_KEY` is explicitly removed. The runner is designed for the subscription/OAuth login already stored by Codex CLI, not API billing.

## Run

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
  isolated-home/
  codex-guard/
  logs/
  artifacts/local-evidence.json
  worktree/
```

A successful result prints a local candidate SHA. The candidate remains local and has not been pushed or deployed.

## Resume behavior

Re-run the same task file. The persisted task hash must match exactly.

- `running` runs resume from the current isolated worktree;
- `pass`, `failed`, `blocked`, and `unsafe` runs are terminal and do not rerun automatically;
- stale lock files are recovered only when the recorded process no longer exists;
- logs are append-only and receive retry suffixes instead of being overwritten;
- evidence is written once and cannot overwrite a previous candidate.

A changed objective, SHA, check, path policy, or pass limit requires a new task ID or run directory.

## Safety boundary

The runner strips known credential variables and relocates CLI configuration, but Codex itself still needs network access to reach its model service. The authoritative host isolation boundary remains WSLC/Codex sandboxing plus the runner's no-credential, no-push, no-deploy contracts. Deterministic checks receive an isolated HOME and blocked proxy defaults.

Repository text and task text are treated as untrusted input and cannot override the fixed runner boundaries.
