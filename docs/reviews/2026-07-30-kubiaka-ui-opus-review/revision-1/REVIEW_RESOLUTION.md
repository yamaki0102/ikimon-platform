# Opus review resolution — revision 1

## Verdict received

`REQUEST_CHANGES`

## Product decision

The review correctly identified that the generic `/record` handoff cannot honestly support the current one-photo promise for unauthenticated participants. Revision 1 does not paper over that integration gap. It removes the active camera-entry link until a separate participant/auth slice can preserve Kubiaka context through authentication without exposing public-map or generic browse actions.

## P0 resolutions

### P0-1 — generic `/record` handoff

**Resolved by scope reduction.**

- removed `/kubiaka/record` registration from the proposal
- removed `source=kubiaka_watch`
- hero camera treatment is now non-interactive and explicitly says the participant entry is being prepared
- tests require `/kubiaka/record` to remain 404 even while the landing feature is enabled
- the next-slice contract requires a dedicated `entry=kubiaka_watch` context, minimal unauthenticated gate, login/registration return preservation, existing-composer reuse, and final-path no-`/map` assertions

### P0-2 — receipt preview overclaim

**Resolved.**

- changed receipt container to `<figure>` / visible `<figcaption>`
- caption explicitly says the screen is an example and is not available yet
- changed accepted/status/body copy in JA / EN / ES / PT-BR to example wording
- changed flow step 03 and receipt lead/title to future/planned wording in all four languages

## P1 resolutions

### P1-1 — nested `<main>`

Outer component changed from `<main>` to `<div>`. The site shell remains the single main landmark.

### P1-2 — hidden visual copy and contrast

- removed `aria-hidden` from the visual wrapper
- retained `aria-hidden` only on decorative halo, SVG, and corner marks
- increased visual-note text opacity to `0.95`
- strengthened the lower image overlay from `0.46` to `0.68`

### P1-3 — pilot badge hidden on mobile

Removed the mobile `display:none`; the top bar now wraps and the badge remains visible at every measured viewport.

### P1-4 — incomplete feature-off tests

Added table-driven 404 checks for `/kubiaka`, `/guide`, `/about`, `/faq`, and `/record`. Added default-Japanese, temporary redirect header, standard not-found, no-map, single-main, honest-receipt, and unavailable-record assertions.

### P1-5 — marker lost after one hop

The broken marker was removed from this slice. The required next slice defines a separate `entry` context independent from generic recovery-source parsing.

### P1-6 — visual evidence mismatch

Added a revised self-contained preview and Playwright/Chromium measurement report. The report distinguishes mobile animation suppression, normal desktop animation, and emulated reduced motion.

### P1-7 — canonical and robot mismatch

- added localized `currentPath` and `canonicalPath`
- aligned HTML/header policy to `noindex, follow`
- temporary anchor redirects receive the same robot and no-store headers

## P2 dispositions

- anchor redirects changed from 308 to 302
- disabled routes delegate to the application standard not-found handler
- receipt `aria-label` replaced by semantic figure/caption
- trust-list label is now purpose-specific in four languages
- redundant H1 `aria-label` removed
- brand link returns to the Kubiaka page rather than the general site root
- external-send promise now requires explicit operational approval and any required consent
- CSS indentation corrected
- `activeNav` uses stable key `kubiaka`
- anchor routes remain for external deep links and are documented as such

## Remaining boundary

Revision 1 is still a review-only source proposal. It does not apply runtime code, create persistence, enable a route, deploy, publish a map, or send externally.
