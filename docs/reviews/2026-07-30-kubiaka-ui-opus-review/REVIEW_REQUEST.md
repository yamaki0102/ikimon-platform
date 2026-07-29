# Opus re-review request — Kubiaka private-pilot entry UI revision 1

## Decision requested

Return one verdict: `APPROVE`, `APPROVE_WITH_CHANGES`, or `REQUEST_CHANGES`.

The first review returned `REQUEST_CHANGES`. Start with `revision-1/REVIEW_RESOLUTION.md`, then review `revision-1/VISUAL_QA.md` and decode the two revision patch files described in `revision-1/README.md`.

## Revision 1 product decision

The generic `/record` handoff cannot preserve an honest one-photo experience for an unauthenticated participant without exposing generic login, browse, and public-map actions. Revision 1 therefore removes the active camera CTA and `/kubiaka/record` route from this slice rather than pretending that integration is complete.

The landing now states that participant camera entry is being prepared. A separate participant/auth slice must later preserve `entry=kubiaka_watch`, use minimal chrome, retain the context through login/registration, reuse the existing composer without forking it, and prove that the final path contains no `/map` link.

## Canonical context

- Strategy: **Receipt-first, Map-later**
- Parent safety PR: `yamaki0102/ikimon-platform#1498`
- Parent exact head: `fb47e198a828ab37f5935e84c17c30c757b6f186`
- Superseded PR `#1492` must not be used.
- This remains a review-only proposal and is not wired into runtime.

## Required invariants for revision 1

1. There is no active participant camera link in this slice.
2. `/kubiaka/record` remains unavailable even when the landing feature is enabled.
3. The page does not expose `/map`, public records, generic navigation, or external routing.
4. The receipt is visibly and semantically an unavailable example, not a functioning backend state.
5. Planned/future wording is consistent in JA / EN / ES / PT-BR.
6. Submitted location is not described as published as-is.
7. AI candidate is not described as confirmed.
8. All five reviewed paths are hidden through the standard application 404 when the feature is disabled.
9. The page has one main landmark, accessible visual copy, sufficient contrast, and a visible private-pilot badge on mobile.
10. Canonical, hreflang, cache, and robot behavior are scoped to the localized Kubiaka path.

## Evidence

- `revision-1/REVIEW_RESOLUTION.md`: response to every P0/P1/P2 finding
- `revision-1/VISUAL_QA.md`: Playwright/Chromium measurements at 320–1440 px and reduced-motion results
- `revision-1/revision-1.patch.gz.b64`: complete source revision patch
- `revision-1/visual-preview-revision-1.patch.gz.b64`: exact self-contained preview revision

Repository-native typecheck, Node tests, build, authenticated return-path verification, and runtime Visual QA remain post-application gates.

## Explicit non-goals

- active camera/auth/composer connection
- durable Kubiaka Record link
- participant or guest credential
- private receipt persistence
- AI assessment or feedback publication
- public coverage map
- external routing or send
- DB migration or deploy

## Required response format

1. Verdict
2. Remaining findings ordered P0 → P1 → P2
3. For each finding: file/section, problem, impact, exact recommended change
4. What should be preserved
5. Minimum remaining change set before implementation

Do not reopen the settled ZUKAN naming decision or propose a public map for this phase.
