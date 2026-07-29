# Revision 1 — Opus REQUEST_CHANGES response

This directory contains the revised Kubiaka private-pilot UI proposal after the first Opus review.

## Review order

1. `REVIEW_RESOLUTION.md`
2. `VISUAL_QA.md`
3. decode `revision-1.patch.gz.b64` and review the resulting patch against the original `proposed/` packet
4. decode `visual-preview-revision-1.patch.gz.b64` to inspect the exact preview update

Decode command:

```bash
base64 --decode revision-1.patch.gz.b64 | gzip --decompress > revision-1.patch
base64 --decode visual-preview-revision-1.patch.gz.b64 | gzip --decompress > visual-preview-revision-1.patch
```

## Main decision

The active camera CTA and `/kubiaka/record` route are removed from this UI slice. The participant authentication and composer handoff will be implemented as a separate slice that preserves `entry=kubiaka_watch`, uses minimal chrome, never exposes `/map`, and reuses the existing composer without forking it.

This remains review-only. No runtime, database, deployment, routing, public map, or external-send change is included.
