# Kubiaka private-pilot UI — Opus review packet

## Current review order

1. `REVIEW_REQUEST.md`
2. `revision-1/REVIEW_RESOLUTION.md`
3. `revision-1/VISUAL_QA.md`
4. `revision-1/README.md`
5. decode and review the revision patches

The original `proposed/`, `visual-preview.html`, and `VISUAL_QA.md` are retained as first-review evidence. Revision 1 is the current proposal.

## Revision 1 decision

The active camera CTA and `/kubiaka/record` route were removed. The generic `/record` path cannot yet preserve Kubiaka context through authentication without exposing generic browse and public-map actions. That connection is now explicitly reserved for a separate participant/auth slice.

## Canonical context

- Parent safety PR: `yamaki0102/ikimon-platform#1498`
- Parent exact head at packet creation: `fb47e198a828ab37f5935e84c17c30c757b6f186`
- Product strategy: **Receipt-first, Map-later**
- Superseded PR `#1492` must not be used.

## Boundary

This is a review-only packet. It does not wire runtime routes, apply a database migration, deploy, activate routing, publish a map, or send data externally.
