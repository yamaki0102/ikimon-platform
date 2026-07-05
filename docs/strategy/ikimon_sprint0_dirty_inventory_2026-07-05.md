# ikimon.life Sprint 0 Dirty Inventory — 2026-07-05

## Purpose

This inventory records the dirty state found in `E:\Projects\ikimon\worktrees\active-clean` before the one-month sprint begins. It exists to prevent broad staging, accidental deploy, or mixing unrelated changes into the sprint lane.

## Baseline

| Item | Evidence |
|---|---|
| Dirty source worktree | `E:\Projects\ikimon\worktrees\active-clean` |
| Dirty source branch | `codex/ikimon-header-wordmark` |
| Dirty source HEAD | `76d0c9f8` |
| Latest `origin/main` at sprint lane creation | `d6385f2f` |
| Tracked modified files | 55 |
| Untracked files | 13 |
| Tracked diff size | 4,366 insertions / 1,151 deletions |
| Clean sprint worktree | `E:\Projects\ikimon\worktrees\one-month-sprint-20260705` |
| Clean sprint branch | `codex/one-month-sprint-20260705` |

## Lane Classification

### Lane A — Sprint Planning

Disposition: keep only in the clean sprint lane. The copy created in the dirty worktree is superseded by the clean-lane version and should not be staged from `active-clean`.

- `docs/strategy/ikimon_one_month_sprint_2026-07-05.md`

### Lane B — Deploy / Nginx / CI

Disposition: high-risk, separate PR only. Do not mix with public loop, map, identification, or media changes.

- `.github/workflows/deploy.yml`
- `ops/deploy/deploy_manifest.json`
- `ops/deploy/deploy_platform_v2_blue_green.sh`
- `ops/nginx/ikimon.life.v2-cutover.conf`
- `platform_v2/ops/nginx/ikimon.life-v2-cutover.conf`
- `ops/deploy/legacy_entrypoint_reasons.json`

Open questions:

- Whether the `/intake-hub/` route is still needed after latest `origin/main`.
- Whether adding `npm run test:node` to production preflight should be its own guarded PR.

### Lane C — Identification Workbench / Trust Lane

Disposition: candidate PR lane after comparison against latest main and existing July worktrees. Likely relevant to Sprint 2.

- `ops/runbooks/identification_workbench_goal_2026-06-01.md`
- `platform_v2/db/migrations/0118_identification_workbench_holds.sql`
- `platform_v2/docs/wireframes/ikimon_identification_workbench_wire_prompt_2026-07-02.md`
- `platform_v2/e2e/identification-workbench.staging.spec.ts`
- `platform_v2/src/routes/identification.write.routes.test.ts`
- `platform_v2/src/routes/references.ts`
- `platform_v2/src/routes/write.ts`
- `platform_v2/src/services/identificationParticipation.ts`
- `platform_v2/src/services/identificationReferencesView.ts`
- `platform_v2/src/services/identificationWorkbenchHolds.ts`
- `platform_v2/src/services/referenceLibrary.ts`
- `platform_v2/src/services/readModels.ts`
- `platform_v2/src/services/stagingFixtureCleanup.ts`
- `platform_v2/src/services/stagingRegressionFixtures.ts`

Open questions:

- Compare with existing worktrees `identification-summary-20260702`, `identification-summary-deploy-20260702`, and `id-workbench-holds-20260702`.
- Confirm whether `0118_identification_workbench_holds.sql` still fits current migration sequence.

### Lane D — Public Core Loop / Copy / Route Surface

Disposition: compare with latest July main before recreating. Some work is likely superseded by merged home, map, profile, and public surface PRs.

- `platform_v2/src/app.ts`
- `platform_v2/src/app.test.ts`
- `platform_v2/src/content/contentBuild.test.ts`
- `platform_v2/src/content/contentLoader.test.ts`
- `platform_v2/src/content/longform/ja/learn-updates.md`
- `platform_v2/src/content/short/ja/ops.json`
- `platform_v2/src/content/short/ja/public.json`
- `platform_v2/src/routes/publicCopy.routes.test.ts`
- `platform_v2/src/routes/record.routes.test.ts`
- `platform_v2/src/routes/read.ts`
- `platform_v2/src/ui/siteShell.ts`
- `platform_v2/src/ui/siteShell.test.ts`

Open questions:

- Confirm whether public route and home changes are already superseded by `origin/main` commits through `d6385f2f`.
- Keep `Site Intelligence`, `Place Intelligence OS`, and `Place Brief` out of public hero/nav copy.

### Lane E — Map / Area / Location Safety

Disposition: compare with latest main first. July main already contains map density, area memory, placeholder photo gates, public profile safety, and area detail work.

- `platform_v2/src/routes/map.read.routes.test.ts`
- `platform_v2/src/services/mapSnapshot.ts`
- `platform_v2/src/services/mapSnapshot.test.ts`
- `platform_v2/src/ui/mapExplorer.ts`
- `platform_v2/src/ui/mapExplorer.test.ts`
- `platform_v2/src/ui/observationFieldDetail.ts`
- `platform_v2/src/ui/observationFieldDetail.test.ts`

Open questions:

- Determine whether tiny placeholder photo filtering is already fully merged in `origin/main`.
- Keep exact-location leakage tests as release blockers.

### Lane F — Media Upload / Reassessment / Field Evidence

Disposition: candidate only if not superseded by photo-post, media upload, or field evidence branches.

- `platform_v2/src/prompts/observation_reassess.md`
- `platform_v2/src/routes/guideApi.ts`
- `platform_v2/src/routes/observationDetailFriendlyCopy.test.ts`
- `platform_v2/src/routes/observationEventPages.ts`
- `platform_v2/src/routes/observationPhotoRecovery.routes.test.ts`
- `platform_v2/src/scripts/smokeProductionMediaUpload.test.ts`
- `platform_v2/src/services/observationEventLive.ts`
- `platform_v2/src/services/observationEventLive.test.ts`
- `platform_v2/src/services/observationPhotoUpload.ts`
- `platform_v2/src/services/observationPhotoUpload.test.ts`
- `platform_v2/src/services/observationReassess.ts`
- `platform_v2/src/services/observationReassess.mediaRegions.test.ts`
- `platform_v2/src/services/observationReassessSubjectContext.test.ts`
- `platform_v2/src/services/observationVisitBundle.ts`
- `platform_v2/src/services/observationWrite.ts`
- `platform_v2/src/services/videoUpload.ts`
- `platform_v2/src/services/videoUpload.test.ts`

Open questions:

- Compare with `codex/fix-photo-post-submit-loss-20260704` and other media/record branches before carrying anything forward.

### Lane G — Ops / Generated / Non-Sprint

Disposition: do not mix into the sprint PR unless directly needed and regenerated from the clean lane.

- `.gitignore`
- `docs/CATCHUP_SNAPSHOT.md`
- `docs/architecture/read_route_split_plan_2026-06-10.md`
- `docs/strategy/ikimon_current_surface_contract_2026-06-10.md`
- `scripts/check_legacy_entrypoint_reason.ps1`
- `upload_package/libs/OmoikaneDB.php`

Open questions:

- `ikimon_current_surface_contract_2026-06-10.md` should be treated as layer-boundary evidence, not latest priority.
- `docs/CATCHUP_SNAPSHOT.md` should be regenerated from the clean lane if needed.

### Lane H — Android Shell

Disposition: park unless needed for the public core loop. Do not mix with web PRs.

- `mobile/android/ikimon-pocket/app/build.gradle.kts`

## Next Actions

1. Keep sprint planning in `E:\Projects\ikimon\worktrees\one-month-sprint-20260705`.
2. Compare Lane D and Lane E against latest `origin/main` first, because those are closest to Sprint 1.
3. Compare Lane C against existing identification worktrees before recreating any work.
4. Do not stage from `active-clean`; it remains `known-dirty`.
5. Do not reset, stash, delete, or broad-stage the dirty source branch.
