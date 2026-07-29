# Revision 1 — Opus REQUEST_CHANGES response

This directory contains the revised Kubiaka private-pilot UI proposal after the first Opus review.

## Review order

1. `REVIEW_RESOLUTION.md`
2. `VISUAL_QA.md`
3. concatenate `revision-1.patch.part00`, `part01`, and `part02` in that order
4. review the resulting patch against the original `proposed/` packet
5. `visual-preview-revision-1.patch` updates the original self-contained preview

## Main decision

The active camera CTA and `/kubiaka/record` route are removed from this UI slice. The participant authentication and composer handoff will be implemented as a separate slice that preserves `entry=kubiaka_watch`, uses minimal chrome, never exposes `/map`, and reuses the existing composer without forking it.

This remains review-only. No runtime, database, deployment, routing, public map, or external-send change is included.
