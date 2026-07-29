# Kubiaka private-pilot UI slice

## Purpose

Add the first polished public-facing shell for the Kubiaka focused experience while preserving the canonical safety order:

> all-alert interlock → private contribution → private receipt → delayed feedback → closed pilot

This slice deliberately does **not** claim that the private receipt persistence and Kubiaka Record link are complete.

## Included

- feature-gated `/kubiaka` landing page
- mobile-first, rights-safe inline SVG visual
- one primary action: photograph a cherry tree
- explicit one-photo / no-extra-shot / no-expertise framing
- private-receipt preview with honest unknown state
- no-public-map, no-auto-reporting, no-AI-confirmation safety copy
- localized JA / EN / ES / PT-BR copy
- `/kubiaka/guide`, `/kubiaka/about`, `/kubiaka/faq` anchor redirects
- `/kubiaka/record` handoff to the existing `/record` composer
- route contract tests

## Runtime gate

The page and handoff routes return 404 unless:

```text
KUBIAKA_PRIVATE_PILOT_UI_ENABLED=1
```

The page is `noindex`, `no-store`, hides the global record launcher, and does not enter the public sitemap in this slice.

## Explicit boundary

The query parameter below is a UI handoff marker only:

```text
source=kubiaka_watch
```

It is **not** the durable experience link required by the canonical plan. The next implementation slice must add the server-authoritative Kubiaka context, Record link/outbox, participant, and private receipt without forking the existing composer.

## Not included

- `kubiaka_record_links`
- link outbox
- guest credential or receipt persistence
- account claim
- AI assessment or feedback publication
- public coverage map
- survey non-detection
- external send or routing activation
- database migration
- staging or production deployment

## Intended branch topology

Create this as a successor/stacked Draft PR from the exact head of Gate 0 PR #1498. After Gate 0 merges, retarget or rebuild from the resulting latest `main`; do not modify PR #1498 to add UI.
