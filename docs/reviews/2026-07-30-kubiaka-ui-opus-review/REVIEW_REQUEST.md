# Opus review request — Kubiaka private-pilot entry UI

## Decision requested

Return one verdict: `APPROVE`, `APPROVE_WITH_CHANGES`, or `REQUEST_CHANGES`.

Review the product experience, visual hierarchy, copy, accessibility, route behavior, tests, and safety boundary. Prioritize concrete P0/P1 findings over general design commentary.

## Intended experience

A person notices a nearby cherry tree and begins with one ordinary photo. They are not asked to identify the insect, take additional photos, or make a report. The first value is that the record was safely received; findings and unknowns remain separate.

Primary copy:

> 近くのサクラを 撮ってみよう。

## Canonical context

- Strategy: **Receipt-first, Map-later**
- Parent safety PR: `yamaki0102/ikimon-platform#1498`
- Parent exact head: `fb47e198a828ab37f5935e84c17c30c757b6f186`
- Superseded PR `#1492` must not be used.
- This review PR contains the complete proposed source and a self-contained visual reference, but does not wire the proposal into runtime.

## Required invariants

1. One obvious primary CTA.
2. One photo is enough to begin; no additional photography is assumed.
3. No expertise, diagnosis, or reporting burden is placed on the contributor.
4. Submitted location is not published as-is.
5. AI candidate is not described as confirmed.
6. No public map or external routing is introduced.
7. The route is default-off and hidden unless `KUBIAKA_PRIVATE_PILOT_UI_ENABLED=1`; flag any mismatch or typo.
8. The existing composer is reused rather than forked.
9. `source=kubiaka_watch` is only a UI handoff marker, not a durable Record link.
10. The receipt preview must not imply that receipt persistence is complete.

## Proposed source files

Review the mirrored files under `proposed/`. The UI source is split into four consecutive files; concatenate `part00` through `part03` byte-for-byte. `proposed/platform_v2/src/app.ts.diff` contains the required app registration edits.

## Visual evidence

- `visual-preview.html`: self-contained responsive visual reference
- `VISUAL_QA.md`: viewport and static-contract evidence

The visual reference follows the same hierarchy, copy, layout, inline artwork, and responsive rules as the proposed source. Repository-native runtime screenshots remain a post-application gate.

## Existing visual checks

| Width | Horizontal overflow | Primary CTA height | Intended hero lines | Reduced motion |
|---:|---|---:|---|---|
| 320 | PASS | 60 px | PASS | PASS |
| 375 | PASS | 60 px | PASS | PASS |
| 390 | PASS | 60 px | PASS | PASS |
| 412 | PASS | 60 px | PASS | PASS |
| 768 | PASS | 58 px | PASS | PASS |
| 1024 | PASS | 58 px | PASS | PASS |
| 1440 | PASS | 58 px | PASS | PASS |

Additional static checks: one primary action, no duplicate IDs, no `/map` link, no `/kubiaka/area`, all core anchors present. Full tests, build, authentication return-path verification, and runtime Visual QA remain required after findings are resolved and the source is applied.

## Explicit non-goals

- durable Kubiaka Record link
- link outbox
- participant or guest credential
- private receipt persistence
- account claim
- AI assessment or feedback publication
- public coverage map
- external routing or send
- DB migration or deploy

## Review severity

### P0 — block implementation

Safety/privacy overclaim; accidental routing, publication, map exposure, or AI confirmation; misleading completed-backend representation; unexpected route exposure; mobile failure preventing the main task.

### P1 — correct before pilot

Confusing hierarchy; too much explanation before the camera action; specialist burden; accessibility or overflow defects; locale/base-path defects; tests that fail to protect the invariants.

### P2 — optional refinement

Visual polish and microcopy improvements that do not change the safety boundary.

## Required response format

1. Verdict
2. Findings ordered P0 → P1 → P2
3. For each finding: file/section, problem, impact, exact recommended change
4. What is strong and should be preserved
5. Minimum change set required before implementation

Do not reopen the settled ZUKAN naming decision or propose a public map for this phase.
