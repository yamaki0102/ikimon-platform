# ikimon.life One-Month Sprint Plan — 2026-07-05

## Goal

Fable5 review after the 2026-07 strategy correction recommends **Option D with changes**:

1. Keep the 2026-06-10 contract as a layer-boundary contract, not as the latest priority list.
2. Do not make monitoring acceleration the product center.
3. Do not treat July commit density as strategy by itself.
4. Ship the public core loop first, then verify the trust/evidence layer, then package monitoring as an enterprise application.

This month is therefore not a "make Site Intelligence copy bigger" month. It is a month to make this loop real and deployable:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit -> trusted evidence`

## Current State Evidence

| Item | Current value |
|---|---|
| Planning date | 2026-07-05 |
| Active local branch inspected | `codex/ikimon-header-wordmark` |
| Local HEAD inspected | `76d0c9f8` |
| Latest `origin/main` inspected | `d6385f2f` |
| Fable5 raw review | `E:\Projects\_agent_scratch\fable5-premium-review\ikimon-strategy-priority-20260705\ikimon-strategy-priority-20260705\claude-review-20260705-075706.md` |
| Main constraint | Current worktree has broad dirty state and is not a safe sprint base |

## Source Roles

| Source | Role |
|---|---|
| `docs/strategy/ikimon_public_surface_canonical_pack_2026-04-22.md` | Public IA, message, feature naming, and forbidden claims |
| `docs/strategy/ikimon_current_surface_contract_2026-06-10.md` | Layer-boundary contract only: public / product / internal / enterprise separation |
| 2026-07 `origin/main` history | Latest implementation evidence, not automatic strategy |
| Fable5 review above | External premium strategy evidence |
| `ops/runbooks/identification_workbench_goal_2026-06-01.md` | Identification workbench and trust-lane operational goal |
| `platform_v2/docs/wireframes/ikimon_identification_workbench_wire_prompt_2026-07-02.md` | Identification summary product surface |

## Month Success Criteria

- [ ] New work starts from `origin/main` or a fresh worktree based on `origin/main`, not from the dirty `codex/ikimon-header-wordmark` branch.
- [ ] Dirty changes are classified into PR lanes before any staging or production promotion.
- [ ] The public core loop is testable from home to record to map/my places to a place or field profile.
- [ ] A current `active places` baseline is produced by SQL or a script and recorded.
- [ ] Public evidence, location privacy, and identification-state boundaries are verified against real or staging fixture data.
- [ ] Site Intelligence / Place Brief appears as an internal or partner evidence product, not as ordinary public hero copy.
- [ ] Monitoring acceleration is represented as an enterprise packaging layer, with guarantee boundaries intact.
- [ ] Month-end report lists shipped PRs, validation evidence, residual risks, and next-month decision points.

## Verification Commands

Use the narrowest command that covers the change, then run broader gates before PR or deploy eligibility.

| Scope | Command | Expected result |
|---|---|---|
| Baseline worktree | `git status --short --branch` | Clean or known-dirty with classified lanes |
| Type safety | `npm --prefix platform_v2 run typecheck` | Pass |
| Current app tests | `npm --prefix platform_v2 run test:node` | Pass before deploy eligibility |
| Public copy / route contracts | `npm --prefix platform_v2 exec -- tsx --test src/routes/publicCopy.routes.test.ts src/app.test.ts` | Pass |
| Map / location safety | `npm --prefix platform_v2 exec -- tsx --test src/services/mapSnapshot.test.ts src/ui/mapExplorer.test.ts src/routes/map.read.routes.test.ts` | Pass |
| Identification workbench | `npm --prefix platform_v2 exec -- tsx --test src/routes/identification.write.routes.test.ts` plus relevant workbench tests | Pass |
| Route split guard | `npm --prefix platform_v2 run typecheck` and focused moved-lane route tests | Pass |
| Deploy guardrails | `powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1` | Pass before PR/deploy promotion |

## Sprint 0 — Clean Lane Recovery (Day 1-2)

### Objective

Stop compounding unshippable work. Classify the current dirty branch and create clean PR lanes from latest `origin/main`.

### Dirty Classification From 2026-07-05 Inspection

| Lane | Files / areas observed | Initial disposition |
|---|---|---|
| deploy / nginx / CI | `.github/workflows/deploy.yml`, `ops/deploy/*`, `ops/nginx/*`, `platform_v2/ops/nginx/*` | Separate high-risk PR only after guardrail review |
| identification workbench | `ops/runbooks/identification_workbench_goal_2026-06-01.md`, `platform_v2/db/migrations/0118_*`, `platform_v2/e2e/identification-workbench.staging.spec.ts`, `platform_v2/src/services/identification*`, `platform_v2/src/routes/identification.write.routes.test.ts`, related `read.ts/write.ts/references.ts` hunks | Candidate PR lane 1, but must rebase/cherry-pick onto `origin/main` |
| public core / home / record copy | `platform_v2/src/app.ts`, `src/app.test.ts`, `src/content/**`, `src/routes/publicCopy.routes.test.ts`, record route tests | Compare with July main; likely many parts already superseded |
| map / area / location safety | `platform_v2/src/services/mapSnapshot*`, `platform_v2/src/ui/mapExplorer*`, `platform_v2/src/ui/observationFieldDetail*` | Compare with `origin/main` because July main has map density and area memory work |
| media upload / reassess | `observationPhotoUpload*`, `videoUpload*`, `observationReassess*`, prompt changes | Candidate PR only if not already covered by production photo-post fix lane |
| Android shell | `mobile/android/ikimon-pocket/app/build.gradle.kts` | Do not mix with web sprint unless needed for public loop |
| generated / catchup / scripts | `docs/CATCHUP_SNAPSHOT.md`, `.gitignore`, `scripts/check_legacy_entrypoint_reason.ps1`, `upload_package/libs/OmoikaneDB.php` | Re-generate or isolate; do not broad-stage |

### Tasks

1. Create or pick a fresh worktree from `origin/main`.
2. Produce `git diff --name-only` and grouped lane inventory for current dirty branch.
3. For each lane, decide: cherry-pick, recreate manually, superseded by main, or park.
4. Start with the smallest lane that advances the month goal: public core loop or identification trust lane.

### Done

- [ ] Fresh lane exists from `origin/main`.
- [ ] Dirty inventory is recorded.
- [ ] No broad `git add .`.
- [ ] First PR lane has a verification checklist.

## Sprint 1 — Public Core Loop (Week 1)

### Objective

Make the everyday user path coherent:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit`

### Product Rules

- Public first touch remains light and concrete.
- Internal terms such as `Site Intelligence`, `Place Intelligence OS`, and `Place Brief` do not become ordinary hero copy.
- Home should not become an explanatory essay.
- Record should feel like the start of a place memory, not a taxonomy exam.

### Tasks

1. Audit current `origin/main` home, record, map, my places, and field public profile routes.
2. Add or fix only the missing links that complete the loop.
3. Ensure mobile first view has one obvious next action.
4. Add focused route/UI tests for the completed loop.

### Done

- [ ] A signed-out or light user can reach record or map from home without concept confusion.
- [ ] A signed-in user can return from record/my places/map to a place or field profile.
- [ ] No public hero copy uses internal strategy terms.
- [ ] Focused public route/copy tests pass.

## Sprint 2 — Trust / Evidence Layer Verification (Week 2)

### Objective

Verify that evidence gates are working with real or staging fixture data before adding more features.

### Target Boundaries

- AI suggestion is not human confirmation.
- Candidate / identification / public evidence are visually and structurally distinct.
- Exact coordinates and sensitive notes do not leak to anonymous public surfaces.
- Aggregation gates prevent weak area/profile claims.

### Tasks

1. Produce current `active places` baseline.
2. Smoke public evidence contract and aggregation gate with real or fixture data.
3. Smoke location privacy on map, area, profile, and observation surfaces.
4. Smoke identification summary and reference/evidence display.

### Done

- [ ] `active places` baseline is recorded with query or script path.
- [ ] Location privacy tests pass for anonymous public output.
- [ ] Identification/evidence tests pass for AI-vs-human distinction.
- [ ] Any blocked evidence item is logged as a risk, not silently ignored.

## Sprint 3 — Site Intelligence / Place Brief Operations (Week 3)

### Objective

Turn Site Intelligence from an internal implementation cluster into an inspectable operations loop.

### Tasks

1. Verify Site Brief / Place Brief provenance and feedback validation queue.
2. Connect field public profile, map area memory, and brief artifacts by stable identifiers.
3. Add one operator-facing status page or report if missing.
4. Keep public-facing terminology plain: place, field, evidence, memory, records.

### Done

- [ ] A field/profile/brief can be traced to source evidence.
- [ ] Feedback queue items can be accepted/rejected or marked for review.
- [ ] Public-facing surfaces do not expose internal labels as marketing promises.

## Sprint 4 — Enterprise Monitoring Packaging (Week 4)

### Objective

Package monitoring acceleration as an enterprise application of Site Intelligence, without hijacking the public product.

### Tasks

1. Audit `/for-business*` current wording against guarantee boundaries.
2. Reframe from "visualization" to "start with place evidence, gaps, and next monitoring plan".
3. Decide the smallest CTA: consultation, sample Place Brief, or initial site quickstart.
4. Add route/copy tests for forbidden claims.

### Done

- [ ] Enterprise copy does not imply certification, TNFD completion, rare-species discovery, or guaranteed specialist identification.
- [ ] Public home/nav is not dominated by enterprise monitoring.
- [ ] Monitoring offer reuses evidence and place profile foundations.

## Month-End Release Gate

### Required Evidence

- [ ] PR list with merged / open / parked status.
- [ ] Verification commands and outcomes per PR lane.
- [ ] Current `active places` number and definition.
- [ ] Trust/evidence gate pass/fail summary.
- [ ] Enterprise monitoring copy boundary summary.
- [ ] Next-month recommendation: public loop, trust operations, Site Brief, or enterprise packaging.

## Risk Register

| # | Risk | Probability | Impact | Mitigation | Trigger |
|---|---|---:|---:|---|---|
| 1 | Dirty branch contains useful work mixed with risky deploy changes | High | High | Fresh `origin/main` lane; cherry-pick only reviewed hunks | Any PR includes unrelated deploy/nginx changes |
| 2 | Site Intelligence leaks into public copy as abstract marketing | Medium | High | Copy tests and forbidden-term review | Public hero/nav uses internal labels |
| 3 | Monitoring is underweighted despite revenue urgency | Medium | Medium | Ask/record revenue urgency before Week 4 prioritization | Pipeline or cash need becomes urgent |
| 4 | Public loop is claimed complete without usage metric | Medium | High | Produce `active places` baseline before trust sprint closes | No baseline query/script exists |
| 5 | Location or evidence privacy regression | Medium | High | Focused map/profile/observation privacy tests before PR | Any public endpoint emits exact sensitive coordinates |

## Rollback Plan

### Public Core Loop / Copy Changes

- Trigger: public page smoke fails, internal labels leak, or conversion path becomes unclear.
- Steps:
  1. Revert only the PR lane commit or disable route copy flag if available.
  2. Re-run public route/copy tests.
- Data impact: none.

### Trust / Evidence Gate Changes

- Trigger: public evidence is hidden incorrectly at broad scale, or private evidence leaks.
- Steps:
  1. Revert the gate PR or switch the affected surface to conservative hidden/rounded fallback.
  2. Re-run focused privacy and evidence tests.
- Data impact: no destructive data change allowed in this sprint without separate approval.

### Enterprise Monitoring Copy Changes

- Trigger: copy implies certification, regulatory completion, or guaranteed outcomes.
- Steps:
  1. Revert the copy PR or replace with conservative consultation language.
  2. Re-run public copy tests.
- Data impact: none.

