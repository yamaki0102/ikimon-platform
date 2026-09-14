# IKIMON Frontend Foundation v1

Status: `ADOPTED / SOURCE CONTRACT`

## Outcome

Make reuse the default for frontend work across NOCOSIL, iPortal, ZUKAN and adjacent IKIMON surfaces without forcing one visual brand or one framework.

The target is not a large design-system program. The target is lower implementation time, lower UI drift, and more consistent interaction quality.

## Required reuse order

Before creating a new UI primitive, use this order:

1. existing project component or pattern;
2. IKIMON Frontend Foundation token/pattern;
3. browser/platform native capability;
4. approved external source adapted into project-owned code;
5. new implementation only for a proven gap.

A new primitive should state why steps 1-4 were insufficient.

## Shared versus product-local

Shared: spacing logic, radius scale, focus, touch target, loading/success/error/empty states, motion timing, reduced-motion behavior, modal/sheet/menu/tab/search interaction semantics.

Product-local: brand color, typography, photography, illustration, information density, public/internal tone and marketing expression.

NOCOSIL and ZUKAN should therefore feel related in operation without looking like the same product.

## Runtime strategy

`platform_v2` remains the current implementation target. Do not introduce React, shadcn, Motion, Storybook or a registry server merely to adopt this foundation.

`platform_v2/src/ui/frontendFoundation.ts` is dependency-free and supplies the initial cross-surface tokens and base interaction classes.

Existing UI is migrated incrementally when touched. No bulk rewrite is required.

## Initial pattern set

The v1 set is intentionally limited to 15 high-frequency patterns: action, async action, loading, success, error, empty, toast, modal, sheet, dropdown, tabs, search, validation, skeleton and confirmation.

See `PATTERNS.md` for behavior rules and `SOURCES.md` for external-source governance.

## Verification

Changes using the foundation should use change-proportional checks. At minimum verify relevant desktop/mobile behavior, keyboard focus, loading/error/success states, reduced motion and layout stability.

Reuse existing `platform_v2` Node tests and Playwright/visual checks. Do not add a verification platform for this work.

## Expansion gate

Create a cross-repository registry only after two or more repositories demonstrably reuse the same component and copy drift becomes a real maintenance cost.

Until then, repository-owned source is canonical.
