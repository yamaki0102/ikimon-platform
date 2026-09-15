# Frontend Foundation automation v1

Purpose: continuously discover useful frontend improvements without auto-installing libraries, creating framework churn, or turning Foundation into a large design-system program.

## Loop

1. `SOURCE_REGISTRY.json` defines approved upstreams and watch signals.
2. `node scripts/frontend-scout.mjs` compares current upstream signals with the accepted baseline and emits review candidates.
3. `node scripts/audit-frontend-reuse.mjs` finds repeated project-owned patterns and token drift candidates.
4. `node scripts/check-frontend-foundation-drift.mjs` fails if the minimum Foundation contract disappears.
5. Review only material candidates. Reject them, keep them local, or promote the smallest reusable behavior into project-owned source.
6. After a reviewed upstream change is accepted or intentionally ignored, refresh the baseline explicitly with `node scripts/frontend-scout.mjs --update-baseline`.

The scout may discover, diff and prioritize. It must never install packages, change runtime dependencies, rewrite product UI, publish, merge or promote an external component automatically.

## Priority

- P1: accessibility/keyboard regression, deprecation/security/license change, source unavailable, or a native-platform replacement that can delete custom code.
- P2: upstream change signal, repeated local implementation, mobile interaction improvement, material performance improvement, high-frequency async/state behavior.
- P3: visual inspiration or low-frequency variants; keep as reference unless a current product need exists.

## Material-change filter

Prioritize accessibility, keyboard/focus behavior, mobile interaction, browser-native replacement, performance, deprecation, security, license/provenance and high-frequency component behavior. Ignore cosmetic churn unless it solves an observed product problem.

Repeated implementation is evidence, not automatic permission to generalize. Promote only when reuse will reduce implementation cost or UI drift. Bulk rewrites are out of scope; migrate touched surfaces incrementally.

Product routing: NOCOSIL prioritizes chat/composer, async state, search and workspace interaction; ZUKAN prioritizes capture, event/participation, map/sheet, upload and field-mobile behavior; iPortal inherits NOCOSIL behavior before adding organization-specific presentation.

Do not add a package, Storybook or registry server yet. If the same concrete component is copied across at least two repositories and drift becomes measurable, choose the smallest source-owned distribution path then.
