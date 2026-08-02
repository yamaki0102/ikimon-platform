# IKIMON Debug Fabric — Phase 1

This directory is the first executable slice of the debugging system for ZUKAN, AI Commander, the release control plane, and later iPortal.

The Pixel is the control, review, and notification device. The authoritative test execution belongs in Sandbox Executor or another isolated container. Shared staging is used only to prove behavior against an exact deployed runtime.

## Implemented now

- strict `ikimon.debug-run/v1` manifest;
- strict `ikimon.control-plane-run/v1` cross-service trace contract;
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

1. Emit the shared trace contract from Intake, Command Bus, Queue, Executor, Release Commander, Release Command Bus, and target Workers.
2. Executor-only staging persona/session issuance; no public session-mint route.
3. Single-writer `debug_run_id` lease, resource ledger, cleanup, and zero-residue gate.
4. Default-deny side-effect sink for mail, LINE, push, Area Watch, publication, payment, and external AI intent.
5. Signed `debug-run/v1` dispatch through the existing Command Bus and Release Commander evidence index.
6. Failure report snapshot to Pixel Review Worker Opus analysis and Android notification.
7. Browser-only checks in an Executor container after the HTTP critical pack is stable.
