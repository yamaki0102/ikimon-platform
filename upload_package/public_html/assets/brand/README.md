# ZUKAN Brand Assets

Canonical current-app assets for the public service **ZUKAN**. The legal/operator identity remains IKIMON株式会社 and the technical runtime identifiers remain `ikimon.life`.

## Current assets

- `zukan-symbol.svg`: standalone ZUKAN mark.
- `zukan-wordmark.svg`: ZUKAN wordmark.
- `zukan-lockup.svg`: horizontal mark and wordmark.
- `zukan-app-icon.svg`: standard browser/PWA icon.
- `zukan-app-icon-maskable.svg`: maskable PWA icon with a larger safe zone.
- `zukan-app-icon-192.png` / `zukan-app-icon-512.png`: PWA `any` icons.
- `zukan-app-icon-192-maskable.png` / `zukan-app-icon-512-maskable.png`: PWA maskable icons with the artwork kept inside the 40% safe-zone radius.
- `zukan-apple-touch-icon.png`: 180×180 Apple touch icon.
- `zukan-favicon-32.png`: 32×32 browser favicon.
- `zukan-ogp-default.png`: opaque 1200×630 social preview.
- `/favicon.ico`: 32px ZUKAN PNG wrapped in an ICO container.

Regenerate the committed raster derivatives deterministically from the SVG sources:

```bash
node platform_v2/scripts/generate-zukan-brand-assets.mjs
```

The assets were reconstructed from the adopted source image recorded in `ikimon-business-strategy/decisions/2026-07-28-zukan-logo-source-assets.md`. The SVG geometry uses smooth vector curves and true circles; do not replace it with pixel-traced polygon steps. Do not change the symbol concept, colors, or four-dot order without updating the strategy decision first.

Legacy `ikimon-*` files remain available for rollback and compatibility. New current-app references must use the ZUKAN files above.
