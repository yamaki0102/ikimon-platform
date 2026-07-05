# ikimon.life One-Month Sprint Completion Report - 2026-07-05

## Completion Target

Close the one-month sprint from strategy to production with evidence:

`home -> record -> my places / map -> area memory / field public profile -> repeat visit -> trusted evidence`

The sprint follows the Fable5 direction: public core loop first, trust/evidence second, Site Intelligence operations third, enterprise monitoring packaging last. Monitoring is important, but it is not the product center.

## Final Status

| Area | Status | Evidence |
|---|---|---|
| Sprint 0 clean lane | Complete | Dirty inventory recorded in `docs/strategy/ikimon_sprint0_dirty_inventory_2026-07-05.md`; no broad reset/stash/stage used. |
| Sprint 1 public core loop evidence | Complete | Runtime reflection endpoint shipped in PR #1229 and verified on production. |
| Sprint 2 trust/evidence baseline | Complete for public read/evidence lane | Active field rows are recorded; prefecture spelling variants are normalized by the final PR lane. |
| Sprint 3 Site Intelligence / Place Brief operations | Complete for current release lane | Artifact, share, feedback admin, and feedback validation queue tests pass. |
| Sprint 4 enterprise monitoring packaging | Complete for conservative packaging lane | Monitoring remains preparation-stage enterprise packaging with copy and export boundaries. |
| Production write walkthrough | Separate lane | Not executed in this release lane because it mutates production data and requires cleanup monitoring. |

## Shipped / Final PR Lanes

| Lane | PR / branch | Status | Production evidence |
|---|---|---|---|
| Runtime reflection evidence gate | PR #1229 | Merged and deployed | Production `/api/v1/runtime/version` returns `cloudflare_worker_runtime/v1` with `buildMarker=one-month-sprint-evidence-gate-20260705`. |
| Active places normalized evidence gate | `codex/month-sprint-complete-20260705` | In progress | Adds `summary` and `normalizedPrefectures` to `/api/v1/fields/prefectures`; production verification to be recorded after deploy. |

## Production Baselines

Current production before the final normalized-evidence PR:

| Metric | Value | Source |
|---|---:|---|
| Public active field rows | 58,551 | `GET https://ikimon.life/api/v1/fields/prefectures` |
| Raw prefecture buckets | 92 | same endpoint |
| Normalized prefecture count | 47 | client-side normalization using official prefecture aliases |
| Variant groups | 45 | same script |
| Variant buckets inside variant groups | 90 | same script |
| Existing production response has normalized summary | false | same script |
| Public map observations for Japan bbox | 590 | `GET /api/v1/map/observations?...` |
| Public map exact location exposed | false | same endpoint |

Definition: active places in this sprint means **active field rows from the production import field detail readmodel**, not deduplicated real-world place identities.

## Final Implementation

The final PR lane updates `GET /api/v1/fields/prefectures` without breaking the existing response:

- keep `prefectures` as the raw stored-bucket response for compatibility;
- add `normalizedPrefectures` using official Japanese prefecture aliases;
- add `summary.schemaVersion=active_places_prefecture_summary/v1`;
- add `sourceAvailable` / `unavailableReason` so staging can return a non-500 empty summary when the production import readmodel is not deployed there;
- state `normalizedUniquePlaceCountAvailable=false` to prevent overclaiming unique real-world places.

Expected final production summary:

```json
{
  "schemaVersion": "active_places_prefecture_summary/v1",
  "definition": "active_field_rows_from_production_import_field_detail_readmodel",
  "totalFieldRows": 58551,
  "rawPrefectureBucketCount": 92,
  "normalizedPrefectureCount": 47,
  "spellingVariantBucketCount": 90,
  "sourceAvailable": true,
  "unavailableReason": null,
  "normalizedUniquePlaceCountAvailable": false
}
```

## Verification Evidence

Commands already run for the final PR lane:

| Scope | Command | Result |
|---|---|---|
| Cloudflare Worker type safety | `npm run check` from `platform_v2/cloudflare_shadow` | Pass |
| Cloudflare Worker quick regression | `npm run test:quick` from `platform_v2/cloudflare_shadow` | Pass: 220 tests |
| Active places normalization test | Included in `npm run test:quick` and previously focused with `--test-name-pattern "production observation field registry runtime"` | Pass |
| Site Brief operations | `npm exec -- tsx --test --test-name-pattern "site brief artifact|site brief share|site brief feedback admin|site brief feedback validation" src/index.test.ts` | Pass: 4 tests |
| Monitoring packaging / copy boundary | `npm exec -- tsx --test src/routes/monitoringBusiness.routes.test.ts src/services/monitoringPackageStandard.test.ts src/services/siteEvidenceReport.test.ts src/routes/publicCopy.routes.test.ts src/routes/observationFieldsApi.siteIntelligence.routes.test.ts` from `platform_v2` | Pass: 35 tests |
| Public forbidden terms | `npm --prefix platform_v2 run check:public-terms` | Pass |
| Whitespace / patch validity | `git diff --check` | Pass |
| Deploy guardrails | `powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1` | Pass |
| Cloudflare production manifest sync | `powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1` | Pass |
| Cloudflare staging manifest sync | `powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1` | Pass |
| Added-line credential scan | `git diff --unified=0 ... | rg "^\\+.*(...credential patterns...)"` | No credential matches |

Final promotion still requires staging deploy, production deploy, and post-production public checks after the PR is opened.

## Sprint 3 Evidence

Site Intelligence / Place Brief is complete for the month because the current release lane proves the operations loop rather than exposing it as public marketing:

- Site Brief artifact provenance remains traceable.
- Share endpoints preserve controlled evidence access.
- Feedback admin summaries do not leak private share identifiers or public-cell internals.
- Feedback validation queue gives admins an accept/reject/review path.
- Public-facing copy tests keep internal labels out of ordinary hero/nav promises.

## Sprint 4 Evidence

Enterprise monitoring packaging is complete for the month as a conservative packaging layer:

- Monitoring copy stays in preparation and consultation language.
- It does not imply certification, TNFD completion, rare-species discovery, or guaranteed specialist identification.
- Export/report packaging is blocked until review, rights, and external identifiers are ready.
- The public home/nav remains place-first and record-first, not monitoring-first.

## Residual Risks

| Risk | Status | Handling |
|---|---|---|
| Normalized unique real-world place count is not available | Accepted | API summary explicitly says field rows are not deduplicated place identities. |
| Production write walkthrough not executed | Deferred | Run as a separate `private-post` lane with cleanup monitoring and explicit result evidence. |
| Owner revenue urgency was not marked high | Accepted | Monitoring remains Week 4 packaging, not product center. If urgency becomes high, move pricing/legal/package validation earlier next month. |
| Current final PR is not yet deployed at document creation time | Open | Update this report with PR number, Actions runs, and production summary after merge/deploy. |

## Next-Month Recommendation

Next month should focus on normalized place identity and trust operations, not more monitoring UI. The highest-leverage next step is to turn field-row evidence into a deduplicated place identity readmodel with review state, source provenance, and owner-safe public summaries.
