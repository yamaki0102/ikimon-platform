# ikimon.life Sprint 1 Public Core Loop Verification Checklist — 2026-07-05

## Purpose

This checklist defines the first implementation PR lane for the one-month sprint. It turns the Fable5 strategy review into a narrow, verifiable engineering target:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit`

The PR lane should improve or verify that loop only. It must not mix in deploy/nginx changes, DB migrations, enterprise monitoring packaging, or broad Site Intelligence copy.

## Strategic Boundary

### In Scope

- Home entry points for a light public user.
- Record creation and post-save return links.
- My records / records workbench tabs, especially `mine`, `places`, `needs_id`, and `identification_summary`.
- Map and area-memory links that let a user return from a saved record to nearby public context.
- Field/public profile links when they are already backed by safe public evidence.
- Public copy checks that keep internal strategy names out of ordinary hero/nav copy.

### Out of Scope

- Production deploy, nginx, CI, or cutover guardrail changes.
- New migrations or direct data changes.
- Enterprise monitoring offer pages, unless only referenced as an excluded layer.
- Site Intelligence / Place Brief as public hero language.
- Cherry-picking from `E:\Projects\ikimon\worktrees\active-clean` without file-by-file comparison against `origin/main`.

## Current `origin/main` Evidence

| Area | Current evidence to preserve |
|---|---|
| Public home | `platform_v2/src/routes/publicCopy.routes.test.ts` includes place-first home tests for signed-out / anonymous users. |
| Records workbench | `publicCopy.routes.test.ts` verifies unified personal/public records, identification summary launcher, redirects from legacy `/notes`, and direct `mine` card grid entry. |
| Record success loop | `platform_v2/src/routes/record.routes.test.ts` verifies success CTAs for saved record, my records, profile, nearby map, and same-place revisit. |
| Revisit privacy | `record.routes.test.ts` verifies revisit URLs do not serialize raw latitude/longitude. |
| Map privacy | `platform_v2/src/services/mapSnapshot.test.ts` verifies public lists drop exact coordinates and only owner-visible payloads keep exact coordinates. |
| Shared map state | `platform_v2/src/ui/mapExplorer.test.ts` verifies shared map state does not serialize private owner observation coordinates. |
| Latest main direction | Recent commits include aggregation gates, field public profiles, GBIF name governance, Site Brief provenance, and map density. These are evidence layers, not a reason to make monitoring the public center. |

## PR Lane Done Criteria

- [ ] `git status --short --branch` starts from `codex/one-month-sprint-20260705` and shows only planned files.
- [ ] The user can navigate from home to `/record` and `/map` without abstract strategy language.
- [ ] A saved-record success state still exposes links to:
  - saved observation detail
  - `/records?view=mine`
  - `/profile`
  - nearby `/map`
  - same-place revisit without exact coordinates in the URL
- [ ] `/records?view=mine` remains a direct card-grid entry, not a story/marketing page.
- [ ] `/records?view=places`, `/records?view=needs_id`, and `/records?view=identification_summary` remain reachable from the workbench or shell.
- [ ] Public map/list output does not expose exact coordinates, site-level names, or private owner observation coordinates to anonymous or non-owner users.
- [ ] Ordinary public hero/nav copy does not use `Site Intelligence`, `Place Intelligence OS`, or `Place Brief`.
- [ ] No deploy/nginx/CI, migration, Android shell, generated catchup, or unrelated media upload files are included.

## Verification Commands

Run these before the first implementation PR is considered reviewable:

```powershell
git status --short --branch
npm --prefix platform_v2 exec -- tsx --test src/routes/publicCopy.routes.test.ts src/routes/record.routes.test.ts src/routes/map.read.routes.test.ts
npm --prefix platform_v2 exec -- tsx --test src/services/mapSnapshot.test.ts src/ui/mapExplorer.test.ts
npm --prefix platform_v2 run check:public-terms
git diff --check
```

If a PR touches the full shell, route registration, or shared read models, also run:

```powershell
npm --prefix platform_v2 run typecheck
```

Before any staging or production promotion, run the repository deploy guardrails if available:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
```

## Stop Conditions

- Any public route serializes exact latitude/longitude for a non-owner.
- Any public hero/nav copy turns internal strategy terms into ordinary user-facing promises.
- Any PR includes deploy/nginx/CI changes alongside public-loop changes.
- The implementation requires DB writes, production data changes, or migration sequencing.
- The branch starts from the dirty `active-clean` worktree instead of the clean sprint lane.

## Fable5 Recheck Reconciliation — 2026-07-05

Second Fable5 verdict: `adopt with changes`.

Adopted changes:

- Week 1 starts with an evidence gate, not another strategy rewrite.
- Collect `active places`, production reflection status for `origin/main` at `d6385f2f`, and a real-account walkthrough before claiming the public loop is working.
- Ask the owner for revenue urgency once and record it; do not spend another premium review on that variable.
- Remove the idea that a read-only PR can be the default Sprint 1 outcome.
- Keep monitoring as Week 4 packaging unless revenue urgency is explicitly high.

Deferred:

- Enterprise monitoring pricing/legal/package work waits for owner urgency and evidence baseline.
- Identification workbench lane recovery stays outside Sprint 1.
- Deploy/nginx/CI changes stay isolated from public-loop work.

Rejected:

- Do not stop the sprint for worktree cleanup only. The clean lane and dirty inventory are sufficient to start evidence-gated product work.

## First Implementation Recommendation

Start with the Week 1 evidence gate:

1. Produce the `active places` number with query or script path.
2. Record whether `origin/main` at `d6385f2f` is reflected in production.
3. Walk a real account through `home -> record -> map -> repeat visit`.

If that walkthrough exposes a user-visible gap, the first Sprint 1 PR must fix at least one such gap. If no gap is found, close Sprint 1 early and move the saved time to measurement or Sprint 2 trust/evidence work. Do not add new monitoring surface area in Sprint 1. Monitoring belongs in Sprint 4 unless the owner marks revenue urgency as high.

## Evidence Gate Result — 2026-07-05

Detailed evidence: `docs/strategy/ikimon_week1_evidence_gate_2026-07-05.md`.

Result:

- `active places` operating baseline is `58,551` active field rows from `GET https://ikimon.life/api/v1/fields/prefectures`.
- Production read-only smoke passed 14/14 with `PRODUCTION_SMOKE_BASE_URL=https://ikimon.life npm run e2e:production-smoke:read-only`.
- GitHub Actions `deploy.yml` succeeded for `origin/main` at `d6385f2f`, but the public host is Cloudflare Worker with build marker `top-record-feed-20260628`.
- `GET https://ikimon.life/api/v1/runtime/version` returned `404` before this PR.

First implementation PR should therefore add a public-safe runtime version endpoint and include it in the Cloudflare Worker deploy smoke guards. This is not a monitoring feature; it is the minimum evidence needed to say production reflection happened.

## Verification Run — 2026-07-05

Commands were run from `E:\Projects\ikimon\worktrees\one-month-sprint-20260705` after `npm --prefix platform_v2 ci`.

| Command | Result |
|---|---|
| `git status --short --branch` | Only the three sprint strategy docs are untracked. |
| `git diff --check` | Pass. |
| `rg -n "[ \t]+$" docs\strategy\...` | No trailing whitespace matches in the three strategy docs. |
| `npm --prefix platform_v2 run check:public-terms` | Pass. |
| `npm exec -- tsx --test src/routes/publicCopy.routes.test.ts` from `platform_v2` | Pass: 24 tests. |
| `npm exec -- tsx --test src/routes/record.routes.test.ts` from `platform_v2` | Pass: 21 tests. |
| `npm exec -- tsx --test src/routes/map.read.routes.test.ts` from `platform_v2` | Pass: 8 tests. |
| `npm exec -- tsx --test src/services/mapSnapshot.test.ts` from `platform_v2` | Pass: 27 tests. |
| `npm exec -- tsx --test src/ui/mapExplorer.test.ts` from `platform_v2` | Pass: 61 tests. |
| `npm --prefix platform_v2 audit --omit=dev` | One existing moderate `protobufjs` advisory remains; not fixed in this planning lane. |

Note: `npm --prefix platform_v2 exec -- tsx --test ...` did not run with `platform_v2` as cwd in this shell, so focused tests must either use `workdir=platform_v2` or the repository's existing npm scripts.
