# ZUKAN media compression — 2026-09-05

Status: SOURCE_VERIFIED / STAGING_RUNTIME_PARTIAL / PRODUCTION_UNVERIFIED

## Current-main reconciliation

The site-shell browser preparation path requests native WebP at quality `0.88`, keeps the established 2560px longest-edge bound, and never upscales smaller photos. The returned filename and MIME are derived from the actual encoded data URL, with the requested `Blob.type` checked as well; unsupported WebP must not be labelled as WebP. Only JPEG, PNG, and WebP originals may be reused without re-encoding because those are the image MIME types accepted by the current upload API.

When WebP encoding is unavailable, JPEG input may use JPEG fallback. Non-JPEG inputs use PNG fallback so RGBA alpha is not discarded. GIF remains an original-media bypass. Decode and canvas resources are released, and canvas preparation failure retains the original file with the existing pending server face-privacy state. Reusing an already smaller supported original still carries that privacy state and does not alter public-derivative eligibility.

The current-main server path now negotiates a display transform separately from the canonical stored derivative. The registered `/derived-transform/w{width}/...` route reads the R2 object through the Images binding and honors explicit `Accept` quality values among AVIF, WebP and JPEG. A wildcard or missing codec preference falls back conservatively to JPEG. Responses carry `Vary: Accept`; public cache headers are used only for public access, while owner/private access stays no-store. Canonical derivative keys, public-ready metadata, privacy state and withdrawal semantics remain unchanged, and originals are never rewritten by this transform.

This reconciliation records the merged AVIF source behavior without claiming that the currently read-back staging runtime is the current product main or that production has been released. It does not change database, secret, DNS/IAM, billing or external-send state.

## Focused verification

- `photoUploadPreparation.test.ts`: WebP-first output, actual MIME/extension, RGBA-safe PNG fallback, JPEG fallback, no-upscale/portrait sizing, GIF bypass, encoder/canvas failure fallback, cleanup, and privacy metadata.
- Current-main AVIF transform tests in `cloudflare_shadow/src/index.test.ts`: 3/3 passed for bounded public transformation, R2/Images binding access with private preservation, and explicit codec negotiation with conservative wildcard fallback.
- Current product main observed at `9b109d3c26fa882d664b677ad8522997d679e8cb` retained the AVIF worker path blob `f825ea45c133e5744170d4e6e0a7a696158e6069`; `npm run typecheck`, `cloudflare_shadow` check, staging Wrangler dry-run and `git diff --check` passed.
- Registered staging workers.dev runtime read-back returned HTTP 200 with source `1c16520c9a3491636ab170d7e7d4f79d3f9e52a6`. A public fixture transformed to AVIF/WebP/JPEG with HTTP 200, the negotiated MIME, `Vary: Accept`, public cache headers and 680px output. The staging runtime source is not current product main.
- Mobile-equivalent Chromium at 390×844 with DPR2 decoded all three formats at 680×906. One read-only sample observed 139,044 bytes AVIF, 181,128 bytes WebP and 161,826 bytes JPEG; this is not a latency benchmark.
- No authenticated upload, provider write, original-hash/export read-back, private/withdrawn rejection read-back, physical-device acceptance, deployment or external mutation is claimed by this document.

## Remaining boundary

The remaining acceptance boundary is real authenticated staging upload failure/retry with cleanup and read-back of the original/derivative hashes plus private/withdrawn rejection, followed by a bounded physical-mobile quality/latency check. The existing staging E2E is fixture-only route interception and cannot substitute for that backend proof; the current environment had no registered write key. The custom staging domain is Access-protected, so the workers.dev result is read-only runtime evidence only. Production remains unverified and untouched.

The legacy duplicate preparation path under `src/routes/read.ts` remains separate work. Any future change must preserve existing privacy/public-ready metadata, fallback, withdrawal and cache contracts.
