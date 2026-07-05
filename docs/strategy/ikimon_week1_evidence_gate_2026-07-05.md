# ikimon.life Week 1 Evidence Gate - 2026-07-05

## Decision

Sprint 1 should not be closed by strategy documents alone. The first production-safe PR lane is a small Cloudflare Worker reflection fix:

- add `GET /api/v1/runtime/version`;
- include that endpoint in `/qa/reflection-loop.json` smoke paths;
- require staging/production deploy guards to smoke it.

Reason: the public core loop passed read-only production smoke, but public production reflection cannot currently prove that the Cloudflare Worker serving `https://ikimon.life` has the latest release.

## Evidence Snapshot

| Evidence | Result | Source |
|---|---:|---|
| Sprint base | `d6385f2ff35cf68c5cf8d7a252674837032a5140` | `git rev-parse HEAD` |
| Latest `deploy.yml` production run for base | success | GitHub Actions run `28685102462`, created `2026-07-03T21:58:52Z`, updated `2026-07-03T22:07:15Z` |
| Public runtime owner | Cloudflare Worker | `GET https://ikimon.life/healthz` |
| Public build marker before this PR | `top-record-feed-20260628` | `GET https://ikimon.life/healthz`, `GET https://ikimon.life/readyz` |
| Runtime version endpoint before this PR | `404` | `GET https://ikimon.life/api/v1/runtime/version` |
| Reflection smoke paths before this PR | `/healthz`, `/readyz`, `/qa/reflection-loop.json` | `GET https://ikimon.life/qa/reflection-loop.json` |
| Active field rows | `58,551` | `GET https://ikimon.life/api/v1/fields/prefectures` |
| Prefecture string buckets | `92` | same endpoint |
| Active field source | `cloudflare_observation_field_registry_runtime` | same endpoint |
| Public map observations returned for Japan bbox | `590` | `GET https://ikimon.life/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&zoom=6&limit=1500` |
| Public map exact location exposed | `false` | same endpoint |
| Production read-only walkthrough | pass: 14/14 | `PRODUCTION_SMOKE_BASE_URL=https://ikimon.life npm run e2e:production-smoke:read-only` |

## Active Places Definition

The current baseline is **58,551 active field rows**, not normalized unique real-world places.

The public endpoint groups rows from the Cloudflare production field readmodel by the stored `prefecture` string, so it includes visible spelling variants such as `静岡` and `静岡県`. Treat this as the Week 1 operating baseline until a normalized place identity count is added.

## Walkthrough Boundary

Read-only production walkthrough passed the public loop coverage available without mutating production:

- `/`
- `/records`
- `/learn`
- `/ja/contact`
- `/map`
- global quick record success return links
- public map privacy payload
- public fixture and placeholder leak checks
- canonical observation detail desktop and mobile scenes
- field-management edit UI exclusion from public snapshot flow

Signed-in write or real-account posting was not run in this lane because it mutates production data. That belongs to a separate explicitly scoped production smoke lane with cleanup monitoring, not the Cloudflare reflection PR.

## Gap

The VPS deploy pipeline can be green while the public host is served by Cloudflare Worker code with an older visible marker. That means `origin/main` reflection cannot be proven from the public URL.

This is a production confidence gap, not a public UX gap. It blocks honest deployment closeout and makes future staging-to-production promotion harder to audit.

## Adopted Fix

Add a public-safe runtime endpoint:

```text
GET /api/v1/runtime/version
```

Expected shape after deploy:

```json
{
  "schemaVersion": "cloudflare_worker_runtime/v1",
  "ok": true,
  "service": "ikimon.life",
  "runtime": "cloudflare-worker",
  "environment": "production",
  "buildMarker": "one-month-sprint-evidence-gate-20260705",
  "publicSafe": true
}
```

The endpoint intentionally exposes no secrets, user data, database credentials, or private configuration.

The production and Cloudflare staging GitHub Actions verification steps are also updated to expect this build marker and to smoke `/api/v1/runtime/version`. Without that workflow change, the Worker deploy would succeed but the post-deploy verification would still expect the previous marker.

## Promotion Rule

This lane can go to production when:

- Cloudflare Worker typecheck and focused tests pass.
- Shadow/staging/production guard scripts include `/api/v1/runtime/version`.
- GitHub Actions staging and production post-deploy verification includes `/api/v1/runtime/version`.
- Repository deploy guardrails pass.
- Staging smoke proves the endpoint before production promotion, or GitHub Actions deploy proves the same through its protected workflow.
- Post-production smoke confirms:
  - `/api/v1/runtime/version` returns `200`;
  - `buildMarker` is `one-month-sprint-evidence-gate-20260705`;
  - `/qa/reflection-loop.json` includes `/api/v1/runtime/version`.

## Residual Risk

| Risk | Status | Next handling |
|---|---|---|
| `gitSha` may be `null` if the deploy runtime does not inject a commit env var | Accepted for this PR | build marker is enough to prove this PR reflection; commit env injection can be a later ops hardening |
| Active field count is not normalized unique places | Accepted as explicit definition | normalize in Sprint 2 evidence work |
| Signed-in production write walkthrough not run | Deferred by boundary | run only as a separate production smoke lane with cleanup evidence |
