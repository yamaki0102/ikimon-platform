# ZUKAN media compression — 2026-09-05

Status: SOURCE_ONLY / PARTIAL_IMPLEMENTATION / NOT_DEPLOYED

## Current-main reconciliation

The browser preparation path requests native WebP at quality `0.88`, keeps the established 2560px longest-edge bound, and never upscales smaller photos. The returned filename and MIME are derived from the actual encoded data URL, with the requested `Blob.type` checked as well; unsupported WebP must not be labelled as WebP.

When WebP encoding is unavailable, JPEG input may use JPEG fallback. Non-JPEG inputs use PNG fallback so RGBA alpha is not discarded. GIF remains an original-media bypass. Decode and canvas resources are released, and canvas preparation failure retains the original file with the existing pending server face-privacy state. Reusing an already smaller supported original still carries that privacy state and does not alter public-derivative eligibility.

This reconciliation intentionally does not implement server AVIF derivatives, public-ready metadata changes, staging/production release, database or secret changes, DNS/IAM/billing changes, or external sends.

## Focused verification

- `photoUploadPreparation.test.ts`: WebP-first output, actual MIME/extension, RGBA-safe PNG fallback, JPEG fallback, no-upscale/portrait sizing, GIF bypass, encoder/canvas failure fallback, cleanup, and privacy metadata.
- Existing integrated candidate evidence was fresh-read from the saved Result Capsule. Its native Chromium/photo fixture recorded JPEG → WebP and RGBA PNG → WebP with alpha preservation; those native-browser, staging, and production claims remain evidence-only and are not expanded by this source reconciliation.
- Typecheck and the focused test command are the only required local checks for this three-path source delta. No authenticated upload, provider read-back, deployment, or external mutation is part of this Work.

## Remaining boundary

AVIF display integration requires a separate, authorized server-side Work. It must preserve existing privacy/public-ready metadata and fallback contracts; this document does not authorize that work.
