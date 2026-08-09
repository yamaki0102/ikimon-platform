# ZUKAN brand assets

The authoritative ZUKAN artwork in this directory is copied without redesign or recoloring from:

- Repository: `yamaki0102/all-projects-management`
- Source commit: `c2833f0185fad87ce8ce16d853f74d57447a4898`
- Canonical directory: `docs/zukan/brand/final/`
- Canonical index: `docs/brand-assets/CODEX_BRAND_ASSETS.md`

`brand-manifest.json` records the canonical path and SHA-256 digest for every source SVG. The primary message defined by the source is「撮ると、まちの今が図鑑になる。」.

## Usage

- `zukan-primary.svg`: horizontal primary logo for headers and wide surfaces.
- `zukan-icon.svg`: standard standalone icon.
- `zukan-app-icon.svg`: app/PWA icon and favicon source at every generated browser size.
- `zukan-icon-small.svg`: preferred source only for 16–24px inline UI surfaces.
- `zukan-icon-mono.svg` / `zukan-primary-mono.svg`: monochrome-only use.
- `brand-tokens.json`: canonical color and usage tokens.

The four older SVG route names are retained only as byte-for-byte compatibility aliases to canonical artwork. They must not be used by new UI:

- `zukan-symbol.svg` → `zukan-icon.svg`
- `zukan-wordmark.svg` → `zukan-primary.svg`
- `zukan-lockup.svg` → `zukan-primary.svg`
- `zukan-app-icon-maskable.svg` → `zukan-app-icon.svg`

Raster, OGP, and multi-size favicon files are deterministically generated from the canonical SVGs:

```bash
node platform_v2/scripts/generate-zukan-brand-assets.mjs
```

Legacy `ikimon-*` files remain for rollback compatibility. Current ZUKAN UI must use only the canonical ZUKAN routes above.
