# ikimon.life One-Month Sprint Plan — 2026-07-05

## Goal

Fable5 review recommends **Option D with changes**:

1. Keep the 2026-06-10 surface contract as a layer-boundary contract, not as the newest priority list.
2. Do not make monitoring acceleration the product center.
3. Do not treat July commit density as strategy by itself.
4. Ship the public core loop first, verify the trust/evidence layer second, and package monitoring as an enterprise application third.

The one-month target is to make this loop real and deployable:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit -> trusted evidence`

## Current State Evidence

| Item | Value |
|---|---|
| Planning date | 2026-07-05 |
| Sprint planning branch | `codex/one-month-sprint-20260705` |
| Completion branch | `codex/month-sprint-complete-20260705` |
| Sprint planning base | `origin/main` at `d6385f2f` |
| Completion base | `origin/main` at `653b616e` after PR #1229 |
| Dirty source branch inspected | `codex/ikimon-header-wordmark` at `76d0c9f8` |
| Fable5 raw review | `E:\Projects\_agent_scratch\fable5-premium-review\ikimon-strategy-priority-20260705\ikimon-strategy-priority-20260705\claude-review-20260705-075706.md` |
| Fable5 recheck raw review | `E:\Projects\_agent_scratch\fable5-premium-review\ikimon-one-month-sprint-recheck-20260705\ikimon-one-month-sprint-recheck-20260705\claude-review-20260705-113352.md` |
| Week 1 evidence gate | `docs/strategy/ikimon_week1_evidence_gate_2026-07-05.md` |
| Month completion report | `docs/strategy/ikimon_month_sprint_completion_2026-07-05.md` |
| Main operational constraint | Previous active worktree is broad-dirty and not a safe sprint base |

## Source Roles

| Source | Role |
|---|---|
| `docs/strategy/ikimon_public_surface_canonical_pack_2026-04-22.md` | Public IA, message, feature naming, and forbidden claims |
| `docs/strategy/ikimon_current_surface_contract_2026-06-10.md` | Layer-boundary contract only |
| 2026-07 `origin/main` history | Latest implementation evidence, not automatic strategy |
| Fable5 review above | External premium strategy evidence |
| `ops/runbooks/identification_workbench_goal_2026-06-01.md` | Identification workbench and trust-lane operational goal |
| `platform_v2/docs/wireframes/ikimon_identification_workbench_wire_prompt_2026-07-02.md` | Identification summary product surface |

## Month Success Criteria

- [x] New sprint work starts from this clean `origin/main` lane, not from the dirty `codex/ikimon-header-wordmark` worktree.
- [x] Dirty changes from the previous branch are classified before cherry-pick, recreation, staging, or production promotion.
- [x] The public core loop is testable from home to record to map/my places to a place or field profile by read-only production smoke and focused route tests.
- [x] A current `active places` baseline is produced by public endpoint/script and recorded.
- [x] Current production reflection status for `origin/main` at `d6385f2f` and then PR #1229 is recorded separately from merge status.
- [x] A real-account production write walkthrough is scoped as a separate cleanup-monitored lane, because it mutates production data.
- [x] Revenue urgency is recorded as not explicitly high for this sprint; monitoring stays enterprise packaging, not the product center.
- [x] Public evidence, location privacy, and identification-state boundaries are verified against production read-only data and staging/local fixtures.
- [x] Site Intelligence / Place Brief remains internal or partner evidence language, not public hero copy.
- [x] Monitoring acceleration is represented as an enterprise packaging layer with guarantee boundaries intact.
- [x] Month-end report lists shipped PRs, validation evidence, residual risks, and next-month decision points.

## Verification Commands

| Scope | Command | Expected result |
|---|---|---|
| Worktree baseline | `git status --short --branch` | clean or known-dirty with classified lanes |
| Type safety | `npm --prefix platform_v2 run typecheck` | pass |
| Current app tests | `npm --prefix platform_v2 run test:node` | pass before deploy eligibility |
| Public copy / routes | `npm --prefix platform_v2 exec -- tsx --test src/routes/publicCopy.routes.test.ts src/app.test.ts` | pass |
| Map / location safety | `npm --prefix platform_v2 exec -- tsx --test src/services/mapSnapshot.test.ts src/ui/mapExplorer.test.ts src/routes/map.read.routes.test.ts` | pass |
| Identification trust lane | `npm --prefix platform_v2 exec -- tsx --test src/routes/identification.write.routes.test.ts` plus focused workbench tests | pass |
| Deploy guardrails | `powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1` | pass before PR/deploy promotion |

## Sprint 0 — Clean Lane Recovery (Day 1-2)

### Objective

Stop compounding unshippable work. Use this fresh branch as the planning and execution lane, then classify the previous dirty worktree into explicit PR lanes.

### Dirty Classification From 2026-07-05 Inspection

| Lane | Files / areas observed | Initial disposition |
|---|---|---|
| deploy / nginx / CI | `.github/workflows/deploy.yml`, `ops/deploy/*`, `ops/nginx/*`, `platform_v2/ops/nginx/*` | Separate high-risk PR only after guardrail review |
| identification workbench | `ops/runbooks/identification_workbench_goal_2026-06-01.md`, `platform_v2/db/migrations/0118_*`, `platform_v2/e2e/identification-workbench.staging.spec.ts`, `platform_v2/src/services/identification*`, related `read.ts/write.ts/references.ts` hunks | Candidate PR lane, but recreate or cherry-pick onto latest `origin/main` |
| public core / home / record copy | `platform_v2/src/app.ts`, `src/app.test.ts`, `src/content/**`, `src/routes/publicCopy.routes.test.ts`, record route tests | Compare with July main; likely partly superseded |
| map / area / location safety | `platform_v2/src/services/mapSnapshot*`, `platform_v2/src/ui/mapExplorer*`, `platform_v2/src/ui/observationFieldDetail*` | Compare with `origin/main`; July main already has map density and area memory work |
| media upload / reassess | `observationPhotoUpload*`, `videoUpload*`, `observationReassess*`, prompt changes | Candidate only if not superseded by photo-post or media PR lanes |
| Android shell | `mobile/android/ikimon-pocket/app/build.gradle.kts` | Do not mix with web sprint unless needed for the public loop |
| generated / catchup / scripts | `docs/CATCHUP_SNAPSHOT.md`, `.gitignore`, `scripts/check_legacy_entrypoint_reason.ps1`, `upload_package/libs/OmoikaneDB.php` | Regenerate or isolate; do not broad-stage |

### Done

- [x] Fresh lane exists from `origin/main`.
- [x] Dirty inventory is recorded with superseded / recreate / cherry-pick / park decisions.
  - Inventory: `docs/strategy/ikimon_sprint0_dirty_inventory_2026-07-05.md`
- [x] First implementation PR lane has a verification checklist.
  - Checklist: `docs/strategy/ikimon_sprint1_public_core_loop_verification_2026-07-05.md`
- [x] No broad `git add .`, reset, stash, or deletion is used.

## Sprint 1 — Public Core Loop Evidence Gate (Week 1)

### Objective

Prove whether the everyday user path is already coherent, then fix the first proven user-visible gap:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit`

### Rules

- Public first touch remains light and concrete.
- Internal terms such as `Site Intelligence`, `Place Intelligence OS`, and `Place Brief` do not become ordinary hero copy.
- Home should not become an explanatory essay.
- Record should feel like the start of a place memory, not a taxonomy exam.
- Do not let Week 1 become documentation-only work. Evidence collection must force either a user-visible fix or an explicit reallocation to Sprint 2 measurement/trust work.

### Evidence Gate Result — 2026-07-05

The public core loop passed read-only production smoke, but production reflection is not auditable enough yet:

- `active places` operating baseline: `58,551` active field rows from `GET https://ikimon.life/api/v1/fields/prefectures`.
- Public map privacy baseline: `590` public map observations returned for Japan bbox; exact location exposure is `false`.
- GitHub Actions `deploy.yml` succeeded for `origin/main` at `d6385f2f`.
- Public `https://ikimon.life` is served by Cloudflare Worker with build marker `top-record-feed-20260628`.
- `GET /api/v1/runtime/version` returned `404` before this PR.
- `PRODUCTION_SMOKE_BASE_URL=https://ikimon.life npm run e2e:production-smoke:read-only` passed 14/14.

Sprint 1 starts with a narrow reflection PR, not a public copy rewrite: add a public-safe runtime version endpoint and include it in staging/production smoke guards.

### Done

- [x] Day 1-3 evidence gate baseline is complete:
  - `active places` number and public endpoint path.
  - Production reflection status for `origin/main` at `d6385f2f`.
  - Read-only production walkthrough notes for public `home -> record -> map -> repeat visit` coverage.
- [x] Signed-in production write or real-account posting walkthrough is explicitly scoped before execution, because it mutates production data.
- [x] Revenue urgency is recorded as `medium/default` for this sprint because the owner questioned over-weighting monitoring and did not mark revenue urgency high.
- [x] A signed-out or light user can reach record or map from home without concept confusion.
- [x] A signed-in user can return from record/my places/map to a place or field profile in covered route/test flows; production write remains separate.
- [x] No public hero copy uses internal strategy terms.
- [x] Focused public route/copy tests pass.
- [x] If walkthrough exposes a gap, the first Sprint 1 PR includes at least one user-visible or production-confidence fix.
- [x] Sprint 1 is closed and the saved time moved to active-place measurement and Sprint 2 trust/evidence verification.

## Sprint 2 — Trust / Evidence Layer Verification (Week 2)

### Objective

Verify that evidence gates are working with real or staging fixture data before adding more features.

### Done

- [x] `active places` baseline is recorded with endpoint/script evidence.
- [x] Location privacy tests pass for anonymous public output.
- [x] Identification/evidence and public copy tests pass for AI-vs-human distinction and overclaim boundaries.
- [x] Any blocked evidence item is logged as a risk, not silently ignored.

### Completion Evidence - 2026-07-05

- Production before the final PR: `58,551` active field rows, `92` raw prefecture buckets, `47` normalized prefectures, `45` variant groups.
- Final PR adds `summary` and `normalizedPrefectures` to `GET /api/v1/fields/prefectures`.
- `normalizedUniquePlaceCountAvailable=false` is explicit, so the release does not overclaim unique real-world places.

## Sprint 3 — Site Intelligence / Place Brief Operations (Week 3)

### Objective

Turn Site Intelligence from an internal implementation cluster into an inspectable operations loop.

### Done

- [x] A field/profile/brief can be traced to source evidence.
- [x] Feedback queue items can be accepted/rejected or marked for review.
- [x] Public-facing surfaces do not expose internal labels as marketing promises.

### Completion Evidence - 2026-07-05

Focused Cloudflare tests for Site Brief artifact, share, feedback admin, and feedback validation queue passed. Public copy checks continue to block internal labels from ordinary hero/nav promises.

## Sprint 4 — Enterprise Monitoring Packaging (Week 4)

### Objective

Package monitoring acceleration as an enterprise application of Site Intelligence, without hijacking the public product.

### Done

- [x] Enterprise copy does not imply certification, TNFD completion, rare-species discovery, or guaranteed specialist identification.
- [x] Public home/nav is not dominated by enterprise monitoring.
- [x] Monitoring offer reuses evidence and place profile foundations.

### Completion Evidence - 2026-07-05

Monitoring business route, monitoring package standard, site evidence report, public copy, and observation field Site Intelligence tests passed. Monitoring remains a preparation-stage enterprise layer.

## Month-End Release Gate

- [x] PR list with merged / open / parked status.
- [x] Verification commands and outcomes per PR lane.
- [x] Current `active places` number and definition.
- [x] Trust/evidence gate pass/fail summary.
- [x] Enterprise monitoring copy boundary summary.
- [x] Next-month recommendation: public loop, trust operations, Site Brief, or enterprise packaging.

See `docs/strategy/ikimon_month_sprint_completion_2026-07-05.md`.

## Risk Register

| # | Risk | Probability | Impact | Mitigation | Trigger |
|---|---|---:|---:|---|---|
| 1 | Dirty branch contains useful work mixed with risky deploy changes | High | High | Fresh `origin/main` lane; cherry-pick only reviewed hunks | Any PR includes unrelated deploy/nginx changes |
| 2 | Site Intelligence leaks into public copy as abstract marketing | Medium | High | Copy tests and forbidden-term review | Public hero/nav uses internal labels |
| 3 | Monitoring is underweighted despite revenue urgency | Medium | Medium | Confirm revenue urgency before Week 4 prioritization | Pipeline or cash need becomes urgent |
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
