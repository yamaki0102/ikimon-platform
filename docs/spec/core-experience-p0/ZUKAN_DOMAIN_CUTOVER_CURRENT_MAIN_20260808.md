# ZUKAN Domain Cutover — current-main contract (2026-08-08)

## Canonical identities

- Production canonical: `https://zukan.earth`
- Production rollback/legacy host: `https://ikimon.life` and `https://www.ikimon.life`
- Staging canonical: `https://staging.zukan.earth`
- Staging rollback/legacy host: `https://staging.ikimon.life`
- Active source lane: PR #1553 from current main baseline `4e6e290476b3e9e2e3187a5e1911b366602250ce`
- Historical PR #1520 is superseded and closed; never merge or deploy it as the current source.

## Security boundary

Request origin and presentation origin are deliberately separate during migration.

- OAuth/CSRF/same-origin checks use the actual allowlisted host that received the request.
- Canonical, sitemap, robots, LLM discovery, OGP/Twitter and structured-data presentation use the canonical ZUKAN host.
- Forwarded headers and the unsigned fallback marker are not trust sources.
- Legacy-host sessions must not be silently treated as cross-origin ZUKAN sessions.

## Legacy redirect boundary

`LEGACY_HOST_REDIRECT_MODE` is fail-closed and disabled unless explicitly set to `enabled` in production.

When enabled, only exact HTTPS `GET`/`HEAD` requests to legacy production hosts and safe public page paths redirect to `zukan.earth`. API, media, assets, authentication, login/register, callbacks, webhooks, operations/internal paths, `.well-known`, PWA/static/dotted files and write methods never enter the redirect lane.

The initial redirect phase also excludes session-bound or personalized surfaces such as Home, capture/Record, Profile/account/settings/notifications, Guide, app/debug, admin/specialist and `me` paths. Legacy host-only cookies are not silently migrated between domains. These paths stay on the receiving legacy host until a separately verified session-migration contract exists.

Do not enable the redirect before the canonical production custom domain has passed exact-runtime verification and rollback remains proven.

## Remaining source reconciliation

The current-main migration intentionally does not claim complete removal of every legacy-host literal. Before production cutover, reconcile these remaining source-level surfaces against current `main`, using historical PR #1520 only as a reference and never as a merge source:

- `platform_v2/src/app.ts`: production/staging public-host identity, CSP and origin-dependent runtime configuration.
- `platform_v2/src/ui/siteShell.ts`: static `PUBLIC_ORIGIN` and canonical/alternate/OGP/structured-data generation. The Worker final-presentation patch currently protects runtime SEO output, but source ownership should still move to the canonical-origin contract.
- `platform_v2/cloudflare_shadow/src/index.ts`: public custom-host allowlists, CSP/connect-src, write-host gating, reporting/attribution URLs, production shadow origin and staging QA host. This file is large and must be reconciled with a repository execution surface that can safely read, patch and test the exact current file.
- `platform_v2/cloudflare_shadow/wrangler.jsonc` and release/runtime configuration: make custom-domain routing and the disabled-by-default legacy redirect contract explicit without bypassing Release Commander.

A source literal is not changed merely because it contains `ikimon.life`: product copy, historical identifiers, rollback contracts and host-bound security references may intentionally remain. Only transport/canonical/configuration ownership moves to `zukan.earth`.

## Cutover gates

1. Current PR exact head is validated by the canonical repository execution lane.
2. Exact head is deployed to staging only through Release Commander.
3. `staging.zukan.earth` runtime identity is read back and matches the exact source SHA.
4. Staging HTTP/browser checks cover Home, capture, map, records, media, OAuth start/failure, robots, sitemap, canonical/alternate/OGP/JSON-LD, PWA assets and noindex behavior.
5. Rollback through `staging.ikimon.life` remains functional.
6. Production `zukan.earth` attachment/routing/TLS is verified before traffic migration.
7. Production deploy occurs through the protected release path with exact source identity and rollback locator.
8. `zukan.earth` is verified while `ikimon.life` still serves rollback-compatible behavior.
9. Only after the preceding gates pass may `LEGACY_HOST_REDIRECT_MODE=enabled` be approved.
10. Post-cutover verification checks public 1:1 path/query preservation, authentication/session exclusions, SEO canonicals, crawl controls and external monitoring.
11. Session-bound legacy paths are migrated only under a separate verified cookie/session strategy; they are not implicitly folded into the public redirect switch.

## Current external blocker

As of 2026-08-08, Release Commander capability reads work, but staging release creation returns non-retryable `AUTH_REQUIRED` for the required staging-write OAuth scope. Do not bypass this with direct credentials, GitHub Actions or an ad-hoc Wrangler production deploy.

## Mutation rule

Until the release gate is restored, this lane may change source/tests/docs only. Production runtime, staging runtime, DNS/custom-domain attachment, D1/R2 business data, secrets, permissions, external sends and redirect enablement remain unchanged.
