# Frontend Foundation automation v1

The automation is intentionally advisory. It must never auto-install, auto-upgrade or auto-promote an external UI library.

## Loop

1. `SOURCE_REGISTRY.json` defines approved upstreams to watch.
2. `node scripts/frontend-scout.mjs` checks upstream reachability and change headers and emits a bounded report.
3. `node scripts/audit-frontend-reuse.mjs` scans project-owned UI for repeated local patterns and token drift candidates.
4. `node scripts/check-frontend-foundation-drift.mjs` fails when the minimum shared contract disappears.
5. Noah or an executor reviews only material candidates, then either rejects them, keeps them local, or promotes the smallest reusable behavior into project-owned Foundation source.

## Material changes

Prioritize accessibility, keyboard/focus behavior, mobile interaction, browser-native replacement, performance, deprecation, security, license/provenance and high-frequency component behavior. Ignore cosmetic churn unless it solves an observed product problem.

## Promotion gate

Repeated local implementation is evidence, not automatic permission to generalize. Promote only when reuse will reduce implementation cost or UI drift. Bulk rewrites are explicitly out of scope; migrate touched surfaces incrementally.

## Cross-repository boundary

Do not add a package or registry service yet. If the same concrete component is copied across at least two repositories and drift becomes measurable, prefer the smallest source-owned distribution path available at that time.
