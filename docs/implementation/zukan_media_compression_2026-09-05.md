# ZUKAN media compression — 2026-09-05

Status: SOURCE_ONLY / PARTIAL_IMPLEMENTATION / NOT_DEPLOYED
Owner request: use the best practical image compression in both ZUKAN and NOCOSIL, rather than a fixed JPEG upload policy.

## Resolved direction

Optimize perceived quality, transferred bytes, preparation latency and compatibility together; no universal "world-best compression" claim. Use AVIF as the preferred evaluated display derivative, with WebP/JPEG/PNG fallback where appropriate. Use native browser WebP for interactive photo preparation rather than adding a large client-side AVIF/WASM encoder. Preserve originals/evidence separately from display derivatives in NOCOSIL. SVG icons remain SVG; animations, HDR and evidence/document fidelity are not silently flattened into ordinary photographs.

## This source delta

`platform_v2/src/ui/photoUploadPreparation.ts` now requests native WebP at quality 0.88, retains the established 2560px longest-edge bound and no-upscale behavior, and reads the actual encoded data URL MIME before selecting the filename. Unsupported browser encoding must not produce PNG bytes labelled WebP. JPEG-input fallback may use JPEG; alpha-capable inputs retain PNG fallback. Existing GIF bypass, retry consumers and server-asynchronous face/privacy decisions are unchanged. An already smaller supported original may be reused only within the size bound; it still passes the existing server public-derivative/privacy pipeline. Encoder failure retains the original rather than losing the contribution.

Quality numbers are encoder-specific; 0.88 WebP is not evidence of perceptual equivalence to 0.88 JPEG. This is an initial review candidate, not an asserted optimum.

## Verified in an isolated environment

- Nine Node contract tests passed, including unsupported codecs, accurate MIME/extension, alpha-capable fallback, portrait/no-upscale sizing, null/older canvas APIs, small originals, GIF and cleanup/failure behavior.
- The exact candidate inline script ran in native Chromium 144.0.7559.96, not just a mocked canvas.
- An enlarged bundled photograph fixture: 2,217,909 bytes JPEG -> 318,064 bytes WebP at 2560x2560; this combines resize and compression, is not an owner image and does not isolate the gain over the old JPEG implementation.
- A synthetic RGBA fixture: 3,247 bytes PNG -> 1,588 bytes WebP at 800x600; alpha 0 and 128 were preserved.
- Candidate source SHA-256: `0acdf0cf7c5e94077e13dae6806da98999b664281794e96f3d2901f49ae4bb74`.

Whole-repository typecheck/CI, real owner-image visual acceptance, mobile preparation latency, authenticated staging upload and production runtime verification are NOT proven by these checks. No production/DNS/DB/secret/permission/billing mutation was performed. Remote start-gate/execution calls were blocked by tool safety validation; those actions were not bypassed. This branch was prepared separately through the GitHub connector.

## Remaining AVIF display integration

Fresh-read `platform_v2/cloudflare_shadow/src/index.ts` and the public-derivative metadata inspector. The observed implementation stores `display.webp`, requires a WebP metadata container and checks WebP public-ready metadata. Merely replacing `image/webp` with `image/avif` would break those guarantees. Reuse the existing Cloudflare Images binding; do not add an external optimization service or expose original objects to a public image URL.

Resolve a minimally scoped, authorization-preserving derivative/cache integration before changing the server: bounded display sizes, output MIME and container verification, source/version-bound cache keys, Accept negotiation including q=0, correct Vary semantics, authenticated/private no-shared-cache behavior, deleted/withdrawn/ineligible media rejection before cache access, and graceful fallback. Avoid repeated lossy WebP -> AVIF -> WebP generations. Regenerate from the authorized source or approved master; do not delete originals or rewrite all historical media eagerly. Encoding failure must not break existing valid image delivery.

Compare AVIF/WebP/JPEG at identical display dimensions against actual representative photos, text/signboards and fine biological detail. Accept only useful byte reduction without unacceptable visual loss, broken transparency/orientation or increased end-to-end wait. Preserve existing AI-provider-specific inputs. Review existing Cloudflare limits/cost headroom before increasing transformation cardinality; no budget expansion is authorized here.

## Resume and completion

Continue this branch without repeating passing isolated tests unless their binding changes. Run affected existing upload/Worker contract tests and project typecheck, then actual staging photo/retry/display checks. Implement and verify the AVIF delivery delta independently of the browser patch. Use the canonical release path and its exact-source approval boundary; merged source is not production completion. Read back runtime source, real Content-Type/bytes/dimensions, compatibility fallback and withdrawal behavior before reporting deployment complete. Roll back via the existing release rollback, not data deletion.

References: MDN Canvas toBlob and image format guide; Cloudflare Images Workers binding documentation, checked 2026-09-05.
