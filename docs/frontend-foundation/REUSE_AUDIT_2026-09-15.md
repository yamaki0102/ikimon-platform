# Frontend reuse audit — 2026-09-15

Fresh scan of `platform_v2/src/ui` found 78 UI source files.

Observed repeated signals:
- sheet-related implementation in 9 files;
- dialog behavior in 2 files;
- hard-coded transitions in 17 files;
- foundation-compatible radii repeated across 32 files;
- 44/48px touch-target rules repeated across 21 files;
- toast behavior already exists outside the Foundation contract.

## Decision

Do not bulk-refactor these surfaces. The evidence is strong enough to make token/pattern drift a standing audit, but not strong enough to justify a new package or cross-repository component registry.

The shared spacing scale is promoted now because the source contract already declares spacing shared and the runtime token layer lacked it. Sheet/dialog and toast/async-state behavior remain incremental promotion candidates when those surfaces are next touched. Product composition and brand remain local.
