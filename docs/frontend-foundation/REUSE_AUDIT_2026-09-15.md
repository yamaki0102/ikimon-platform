# Frontend reuse audit — 2026-09-15

Fresh runtime-only scan of `platform_v2/src/ui` found 46 UI implementation files after excluding `frontendFoundation.ts` and test files.

Observed repeated signals:
- sheet-related implementation in 4 files;
- dialog behavior in 2 files;
- hard-coded transitions in 15 files / 71 occurrences;
- foundation-compatible radii in 31 files / 594 occurrences;
- 44/48px touch-target rules in 18 files / 91 occurrences;
- toast behavior exists in one runtime file, so it is not yet a reuse-promotion signal by itself.

## Decision

Do not bulk-refactor these surfaces. The evidence is strong enough to make token/pattern drift a standing audit, but not strong enough to justify a new package or cross-repository component registry.

The shared spacing scale is promoted now because the source contract already declares spacing shared and the runtime token layer lacked it. Sheet/dialog behavior remains an incremental promotion candidate when those surfaces are next touched. Product composition and brand remain local.
