# Production Deploy Timing

This note tracks production deploy duration without weakening deploy safety checks.

## Measurement Command

Use the timing script after a production deploy run finishes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\summarize_deploy_timing.ps1 -Limit 8 -CompletedOnly -StepThresholdSeconds 60
```

For a single run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\summarize_deploy_timing.ps1 -RunId <run-id> -StepThresholdSeconds 30
```

The script separates:

- GitHub Actions queue wait: run `createdAt` to first job `startedAt`.
- Active deploy span: first job start to last completed job.
- Job durations: pre-flight, prepare, candidate smoke, promote, post-deploy verification.
- Heavy prepare steps: legacy deploy over SSH and inactive `platform_v2` candidate prepare.

The VPS prepare script also emits `deploy_timing ...` lines and writes JSONL to:

- `/var/www/ikimon.life/deploy_state/prepare_timing_<release-id>.jsonl`
- `/var/www/ikimon.life/deploy_state/prepare_timing_latest.jsonl`

Rank the VPS-side prepare stages from a downloaded JSONL file:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\summarize_prepare_timing.ps1 -Path .\prepare_timing_latest.jsonl
```

Or read it directly over SSH when the deploy host alias is available:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\summarize_prepare_timing.ps1 -HostAlias <ssh-alias>
```

## Baseline Before PR #715

Sample: latest 7 completed successful production deploy runs before PR #715.

| Metric | Average | Min | Max |
| --- | ---: | ---: | ---: |
| Total run wall time | 10.61 min | 8.65 min | 13.95 min |
| Queue wait | 0.04 min | 0.03 min | 0.07 min |
| Prepare Production Candidate job | 5.68 min | 3.75 min | 8.70 min |
| Legacy deploy over SSH step | 100.29 sec | 68 sec | 142 sec |
| Inactive platform_v2 candidate prepare step | 226.86 sec | 143 sec | 368 sec |

Interpretation:

- Recent deploys are not currently dominated by GitHub Actions queue wait.
- The stable bottleneck is VPS-side prepare work, especially inactive `platform_v2` candidate prepare.
- The 30+ minute historical run had a large queue/environment wait; that needs separate tracking from code/runtime work.

## PR #715 Expected Effect

PR #715 targets only repeated deterministic work in the VPS prepare phase:

- `npm ci` uses a persistent npm cache with lockfile validation preserved.
- Fixed static imports are skipped when deploy-state markers match source hashes.
- N03 Shizuoka source ZIP is cached locally.
- Server build uses `build:server`; full quality checks stay in GitHub Actions pre-flight.

Safety checks intentionally retained:

- blue/green candidate runtime
- candidate browser smoke
- readiness gates
- nginx snapshot rollback
- public smoke after promote

## Post-Merge Comparison Gate

After PR #715 is merged and the first production deploy finishes:

1. Run the measurement command for the new production run.
2. Compare `Prepare Production Candidate`, `Legacy deploy over SSH`, and `Inactive platform_v2 candidate prepare` against the baseline above.
3. If `Inactive platform_v2 candidate prepare` remains over 180 seconds, inspect the server-side timing markers from `deploy_platform_v2_blue_green.sh` around:
   - `npm ci`
   - `npm run build:server`
   - migrations
   - N03 import
   - fixed seed imports
   - knowledge navigation compile
   - guide environment postdeploy
   - legacy sync / parity / drift report
4. Use `scripts/summarize_prepare_timing.ps1` with the VPS `prepare_timing_latest.jsonl` log to rank the remaining prepare bottlenecks.
5. If total wall time is high but active span is low, treat it as GitHub queue/environment pressure rather than deploy script work.

## Next Improvement Candidates

1. Keep legacy sync in cursor-based delta mode during deploy. If `sync_legacy` remains dominant,
   inspect changed-file counts before considering a broader architecture change. Use
   `FORCE_LEGACY_SYNC=1` only for recovery, cursor repair, or an intentional full re-import.
2. Candidate browser smoke is the largest remaining fixed safety cost after warm-path prepare.
   Any fast lane should add a separate reduced smoke contract instead of weakening the normal
   production deploy.
3. Split candidate packaging from server install only if repeated `npm ci` and build become
   dominant again after cache.
4. Keep candidate/browser smoke and readiness gates intact; do not trade rollback safety for speed.
