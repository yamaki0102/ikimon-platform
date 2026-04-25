# Fast Release Path

This runbook keeps production backup and security smoke intact while reducing manual deploy time.

## Local gate only

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke_release_fast_go.ps1 -Mode local
```

Runs deploy guardrails, manifest sync, catch-up sync, PHP lint, platform_v2 typecheck, build, and tests.

## Staging fast path

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke_release_fast_go.ps1 -Mode staging -Branch main
```

Runs the local gate, triggers `deploy-staging.yml`, and watches the staging workflow.

## Production backup and smoke

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke_release_fast_go.ps1 -Mode production-smoke -IncludeStagingSessionSmoke
```

Runs a production backup, then verifies:

- `/healthz`, `/readyz`, `/login`, `/register`, `/record`
- `/login.php` remains 404
- Google OAuth start redirects to `accounts.google.com`
- X/Twitter OAuth start redirects to `twitter.com`
- cross-site auth POST returns 403
- same-origin invalid login returns controlled 400
- optional staging register -> session -> `/record` form smoke

## Full operator path

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke_release_fast_go.ps1 -Mode all -Branch main -IncludeStagingSessionSmoke
```

Use this before or after a main merge when the change touches auth, posting, deploy, or runtime config.

Do not skip production backup for auth, posting, DB, migration, or deploy-script changes.

For script validation without creating a backup:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup_production_v2.ps1 -ValidateOnly
```
