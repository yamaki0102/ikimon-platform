# IKIMON Debug Fabric — Phase 1

This directory is the first executable slice of the debugging system for ZUKAN, AI Commander, the release control plane, and later iPortal.

The Pixel is the control, review, and notification device. Repeated debugging, fault injection, test generation, and fix loops run locally through Codex Luna in an isolated WSLC worktree. Terra is a conditional escalation lane only after repeated Luna passes leave the same cross-service failure unresolved. Cloudflare is not a debugging loop: it is reserved for one exact-SHA staging deploy/verify proof and, when required, one rollback proof after local green.

## Permanent execution policy

The source of truth is `policy/execution-policy.v1.json` and the deterministic selector in `lib/execution-policy.mjs`.

- default lane: `local_codex_luna`;
- Terra threshold: at least three Luna passes, at least two failures with the same signature, and a multi-repository fault/fix/control-plane scope;
- Pixel Opus: independent read-only review after a candidate patch or full-diff snapshot exists;
- Cloudflare: local green + exact candidate SHA + real runtime dependency only;
- Cloudflare debugging iterations: zero;
- per-SHA Cloudflare budget: one staging deploy/verify and one rollback proof;
- GitHub Actions: forbidden as an execution dependency;
- AI API billing: forbidden;
- production writes, customer sends, production DB/secret/DNS/permission changes: forbidden.

Plan a task before execution:

```bash
node platform_v2/tools/debug-fabric/plan-execution.mjs \
  --input /tmp/debug-execution-request.json \
  --out /tmp/debug-execution-plan.json
```

A request for Cloudflare before local green is returned as `BLOCKED`. A request for Terra before the escalation threshold is also returned as `BLOCKED`. This prevents the system from drifting back to Cloudflare-first debugging when limits or context change.

## Implemented now

- strict `ikimon.debug-run/v1` manifest;
- strict `ikimon.control-plane-run/v1` cross-service trace contract;
- strict `ikimon.debug-execution-request/v1` lane-selection contract;
- strict `ikimon.local-debug-task/v1` Local Luna task contract;
- resumable WSLC Local Luna runner with an isolated exact-SHA Git worktree;
- Luna-first execution and bounded Terra escalation using normalized failure signatures;
- append-only state/events/log evidence and one runner-owned local candidate commit;
- credential-stripped deterministic checks and Codex guard configuration;
- changed-file and path-prefix limits before candidate creation;
- `PASS`, `FAIL`, `BLOCKED`, `UNSAFE` terminal states;
- exact source SHA verification before, during, and after a run;
- per-layer runtime SHA verification across the control plane;
- staging-only exact host allowlist;
- read-only `GET` / `HEAD` probes;
- bounded bodies, no redirects, no raw response retention;
- environment-only synthetic fixture values;
- compact `result.json`, `capsule.json`, and `debug-report.md` evidence;
- a ZUKAN private-boundary profile;
- an AI Commander control-plane profile covering Intake, Command Bus, Queue, Executor, Release Commander, Release Command Bus, and target runtime;
- red proof showing that the same assertion fails when a private marker is deliberately leaked;
- rejection of opaque terminal `failed` states without a known layer-specific failure code and immutable evidence digest.

## Verify

```bash
bash platform_v2/tools/debug-fabric/verify.sh
```

## Run a local Luna task

The Local Runner requires Node.js 22+, Git, and Codex CLI already signed in through the user's ChatGPT subscription. It does not use `OPENAI_API_KEY`.

```bash
cp platform_v2/tools/debug-fabric/local-runner/profiles/ai-commander-local-debug.template.json \
  /tmp/ai-commander-local-debug.json

node platform_v2/tools/debug-fabric/local-runner/run-local.mjs \
  --task /tmp/ai-commander-local-debug.json
```

The runner creates its private ledger and worktree under `~/.ikimon-debug-fabric/runs/` by default. A successful run creates a local `debug/*` candidate commit and immutable `local-evidence.json`. It does not push, create a PR, deploy, or modify production.

See `local-runner/README.md` for the task schema, result layout, resume behavior, and safety boundary.

## Run against ZUKAN staging

Copy the template outside the repository, replace the all-zero SHA with the exact deployed staging SHA, and supply only synthetic staging values through environment variables.

```bash
cp platform_v2/tools/debug-fabric/profiles/zukan-private-boundary.template.json /tmp/zukan-debug.json

export ZUKAN_DEBUG_OWNER_COOKIE='session=...'
export ZUKAN_DEBUG_PRIVATE_MARKER='debug-private-...'
export ZUKAN_DEBUG_PRIVATE_OBSERVATION_ID='...'
export ZUKAN_DEBUG_PRIVATE_LATITUDE_EXACT='...'
export ZUKAN_DEBUG_PRIVATE_LONGITUDE_EXACT='...'

node platform_v2/tools/debug-fabric/run.mjs \
  --manifest /tmp/zukan-debug.json \
  --out /tmp/zukan-debug-evidence
```

No password, bearer token, private marker, raw response body, or exact coordinate is written to evidence.

## Analyze an AI Commander control-plane trace

Each service boundary must emit one observation with the same `trace_id`, its exact runtime SHA, a terminal state, and an immutable evidence digest. A failed, blocked, or unsafe observation must use a known failure code for its layer. Generic `failed` is rejected as `UNSAFE`.

```bash
cp platform_v2/tools/debug-fabric/profiles/ai-commander-control-plane.template.json \
  /tmp/ai-commander-control-plane.json

node platform_v2/tools/debug-fabric/analyze-control-plane.mjs \
  --input /tmp/ai-commander-control-plane.json \
  --out /tmp/ai-commander-control-plane-result.json
```

The result identifies the first responsible layer, missing trace layers, runtime identity mismatches, retryability, and a minimal safe reproducer descriptor. It stores no raw log, token, request body, or credential value.

## Next reviewed slices

1. Add the GitHub Issue intake and candidate publisher adapters: map repository identity to a local path, run the Local Luna task, push only an evidence-bound `debug/*` candidate, create a Draft PR, and post a compact result.
2. Emit the shared trace contract from Intake, Command Bus, Queue, Executor, Release Commander, Release Command Bus, and target Workers.
3. Executor-only staging persona/session issuance; no public session-mint route.
4. Single-writer `debug_run_id` lease, resource ledger, cleanup, and zero-residue gate.
5. Default-deny side-effect sink for mail, LINE, push, Area Watch, publication, payment, and external AI intent.
6. Failure report snapshot to Pixel Review Worker Opus analysis and Android notification after Worker input isolation is repaired.
7. Browser-only checks in a local WSLC container after the HTTP critical pack is stable.
