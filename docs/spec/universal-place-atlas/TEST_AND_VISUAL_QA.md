# Universal Place Atlas test and Visual QA report

Generated: 2026-07-23 JST

## Automated verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Node typecheck | passed | `npm --prefix platform_v2 run typecheck` |
| Node production build | passed | `npm --prefix platform_v2 run build` |
| Node test suite | 1,406 passed, 0 failed | `npm --prefix platform_v2 run test:node` |
| Worker typecheck | passed | `npm --prefix platform_v2/cloudflare_shadow run check` |
| Worker test suite | 399 passed, 0 failed | `npm --prefix platform_v2/cloudflare_shadow test` |
| Worker staging bundle dry-run | passed | 2,053.67 KiB raw / 437.57 KiB gzip |
| Local Place Atlas E2E | 28 passed, 2 skipped, 0 failed | `npm --prefix platform_v2 run e2e:local:place-atlas` |
| Fresh D1 migration | passed | `evidence/local-d1-migration-rehearsal.json` |
| Existing D1 compatibility | passed | `placeAtlasMigration.test.ts` |
| Seed replay/idempotency | passed | `evidence/local-d1-migration-rehearsal.json` |
| Forward rollback | passed; evidence retained | `ops/deploy/forward_rollback/0068_disable_universal_place_atlas.sql` |

The final rerun includes the adopted independent-review fixes: stale calculated
membership retirement without overwriting reviewed corrections, a 1,000-vertex
request-time geometry budget, a 500-row snapshot cap with honest `partial`
status, and a same-origin media-path allowlist.

The two E2E skips are the canonical alias-search browser case in WebKit and
Firefox. The same search contract is covered by Node and Worker registry tests;
the browser interaction is executed in Chromium. They are recorded as a limit,
not counted as passed.

## Visual QA matrix

The Place profile, error recovery, restricted-place policy, image fallback,
keyboard focus, and fixed-UI overlap checks run with page-error, unexpected
console-error, and critical API-response monitoring.

| Engine | 375 | 390 | 768 | 1024 | 1280 | 1536 |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium | passed | passed | passed | passed | passed | passed |
| WebKit | passed | passed | passed | passed | passed | passed |
| Firefox | passed | passed | passed | passed | passed | passed |

Screenshots are under `evidence/visual-qa/local/`. Representative evidence:

- `chromium-mobile-390.png`
- `chromium-desktop-1280.png`
- `chromium-search-junglia-mobile-390.png`
- `chromium-restricted-mobile-390.png`
- `chromium-error-mobile-390.png`
- `webkit-mobile-390.png`
- `firefox-desktop-1280.png`

The restricted-place screenshot is scrolled to the policy surface. It proves
that browse access and the official-rule link remain available, the recording
CTA is absent, and the policy block does not intersect the global record
launcher.

## Interaction assertions

- no horizontal document overflow at all six widths;
- mobile peek and full sheet remain scrollable;
- desktop side panel exposes the same Place profile contract;
- close/back controls remain reachable;
- loading, API error, restricted, empty-gap, and image-failure states are
  distinct;
- theme cards are keyboard operable and show focus;
- reduced-motion CSS remains present;
- stale response sequence guards and `AbortController` remain active;
- expected profile `503` leaves the map and close control usable;
- unexpected page errors, console errors, and critical map API failures are
  zero in normal cases.

## Device limits

No physical Android or iOS device was available in this run. Chromium mobile
emulation and WebKit cover browser-level layout and interaction behavior, but
they are not presented as physical-device proof. Therefore this report cannot
support `READY_100`.

## Pending staging evidence

The same assertions must be rerun against the deployed staging exact SHA.
Staging screenshots and response headers belong under
`evidence/visual-qa/staging/`; until present, staging Visual QA is pending.

The 2026-07-23 central command-bus attempt stopped before an operation ID was
issued with `oauth_mutation_authorization_expired`. Direct local Wrangler
deployment was not used as a bypass. See `STAGING_ATTEMPT_2026-07-23.md`.
