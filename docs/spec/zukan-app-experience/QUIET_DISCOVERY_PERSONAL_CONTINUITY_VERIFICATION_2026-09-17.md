# Quiet discovery / saved-reference source candidate — verification

Date: 2026-09-17 JST
Owner: IKIMON
State: SOURCE CANDIDATE; NOT MERGED OR DEPLOYED
Base: `2a155322f6871d97140b79af27c322f2de60139d`

## Integration ownership

An earlier active source writer is publishing the same Home/Saved scope in `ikimon-platform#1758`. This candidate is preserved for review/reuse, not a second independently deployable Saved subsystem. Do not apply both `0019` migrations or enable two authoritative save stores. Reconcile against that existing candidate and its current Work before any merge. No claim is transferred by this note.

## Verified on this candidate

- Cloudflare Worker quick suite: 545 tests PASS, 0 FAIL (includes the two new CSP cases).
- Shared Home / privacy tests: 34 PASS, 0 FAIL.
- Worker and platform TypeScript checks: PASS.
- Registered staging configuration Worker bundle: dry-run PASS; no upload/deployment.
- Exact repository D1 migrations: pinned Wrangler4.130.0/workerd local runtime PASS, including the additive private reference schema. No remote database migration.
- Synthetic browser journey with Chromium151.0.7922.34: widths320/375/768/1280/1440, actual shared renderers and saved-reference native handler over local SQLite. Signed-in header, search/return routes, save/reload/remove, stale retry, synthetic account isolation, selected export and unavailable-source handling PASS. No browser JavaScript errors or horizontal overflow. The local fixture is not proof of provider/runtime state.
- A selected-reference bundle was imported by NOCOSIL's actual `ContinuityD1Store` at source `ec24ebb1df6728485ecd970f9f74de24b5864472`, using local Miniflare D1. Reload and same-bundle idempotency PASS; other Security Domain returned0 records. The result is one C2 candidate note, not an adopted fact, planned appointment, confirmed booking or participation receipt.
- Scoped visual inspection: narrow authenticated header fixed without hiding the ZUKAN wordmark; empty status/watch elements no longer occupy an empty card; NOCOSIL export is secondary disclosure rather than a required step.

## Known boundaries

The unrelated platform `src/routes/zukanHomeReleaseClosure.test.ts` has two robots-format expectation failures on the exact unchanged base commit. These were reproduced in an independent base worktree and not silently skipped or modified. The statement above is not a full-repository all-green claim.

The independent subscription reviewer attempt timed out without a verdict. Do not label this candidate independently approved. Initial browser evidence from an incorrectly shaped synthetic auth response was invalidated and rerun after the fixture matched the actual `session` API shape; final evidence includes the authenticated header.

No live two-account linking, standing grants, automatic save/remove synchronization, private media bridge, full travel-scene implementation or new commercial portal activation is claimed. Public-source availability is re-resolved through existing guest detail routes; per-profile publication eligibility and full account-erasure integration require independent review before release. An exported file is not a completed NOCOSIL import in the user's account.

No production/staging deployment, remote migration, real user enrollment, automatic publication, IAM/DNS or credentials were changed.

## Repeatable checks

```sh
cd platform_v2
npm run typecheck
npx tsx --test src/ui/landingTop.test.ts src/ui/landingHomePrivacyClosure.test.ts
QUIET_DISCOVERY_QA_DIR=/absolute/outside-repo/qa npx tsx scripts/verify-quiet-discovery-saved.mts
cd cloudflare_shadow
npm run check
npm run test:quick
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may identify an already-installed browser; the receipt records the actual browser version. Keep test exports/synthetic data outside the repository. Exact evidence and resumable execution paths are retained in the existing owner Work store, not duplicated into GitHub narrative state.

## Evidence digests

- `native-full-quick.log`: `84b62675932732d28fdefd233f9c4671631052dfef1391af742da0126c7f4c00`
- `shared-home-tests.log`: `be01845b49da4d79a2d25ccee3ea2bd48d7b797f2fcbd0878d4405f918f68726`
- `typecheck.log`: `d9266129d5b83713e69feb409ae8a56c9e19581581faaafb7b9ddd0f50c9b103`
- `platform-typecheck.log`: `8b36d7da196f4c803afc66a70865116a9487f1d537dddfdc1385d439f10c8486`
- `worker-build.log`: `0eec78d7be3a5f2475548c8f4053bfe823338d0319c95f6d2025cb1ab6109564`
- `native-import-verification.json`: `57f5322ae8dd39b77c02662ccf0d8024cf39292c453b877942c164f8274ae091`
- `ui/browser-verification.json`: `a05a7a36f892cf7e70a35856e4dc030e84a398ef0e56eb8da0af4689f44a8d83`
- `baseline-robots.log`: `ad8b3da8587317d447698d6b47f3e740a50478e69b9ebc54d2a5c8c72a059d02`
