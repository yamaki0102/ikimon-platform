# IKIMON Debug Fabric — Phase 1

This directory is the first executable slice of the debugging system for ZUKAN and later iPortal.

The Pixel is the control, review, and notification device. The authoritative test execution belongs in Sandbox Executor or another isolated container. Shared staging is used only to prove behavior against an exact deployed runtime.

## Implemented now

- strict `ikimon.debug-run/v1` manifest;
- `PASS`, `FAIL`, `BLOCKED`, `UNSAFE` terminal states;
- exact source SHA verification before, during, and after a run;
- staging-only exact host allowlist;
- read-only `GET` / `HEAD` probes;
- bounded bodies, no redirects, no raw response retention;
- environment-only synthetic fixture values;
- compact `result.json`, `capsule.json`, and `debug-report.md` evidence;
- a ZUKAN private-boundary profile;
- red proof showing that the same assertion fails when a private marker is deliberately leaked.

## Verify

```bash
bash platform_v2/tools/debug-fabric/verify.sh
```

## Run against staging

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

## Next reviewed slices

1. Executor-only staging persona/session issuance; no public session-mint route.
2. Single-writer `debug_run_id` lease, resource ledger, cleanup, and zero-residue gate.
3. Default-deny side-effect sink for mail, LINE, push, Area Watch, publication, payment, and external AI intent.
4. Signed `debug-run/v1` dispatch through the existing Command Bus and Release Commander evidence index.
5. Failure report snapshot to Pixel Review Worker Opus analysis and Android notification.
6. Browser-only checks in an Executor container after the HTTP critical pack is stable.
