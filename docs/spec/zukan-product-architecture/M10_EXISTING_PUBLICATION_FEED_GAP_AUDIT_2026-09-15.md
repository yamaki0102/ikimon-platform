# M10 Track A — Existing Publication Feed Gap Audit

Status: `SOURCE_VERIFIED / NO_NEW_PROFILE_ENGINE_REQUIRED`

Audit date: 2026-09-15 (JST)

Work: `ZUKAN-M10-PUBLIC-FEED-PROFILE-GAP-20260905`

Repository: `yamaki0102/ikimon-platform`

Base source: `9094d6a160e67a01647742347b0efa454ae370fb`

Base tree: `513f4b9ae19b4f46348a0b9572d7ce54f7e2af15`

## Outcome

The current source already provides the M10 Track A publication-feed surface through the existing Publication/PublicationEdition boundary. A second public-profile or feed engine is not justified by the current source. This audit records the reuse decision and the remaining frontier boundary; it does not activate M10 Track B or claim a new runtime release.

## Canonical inputs

The audit used the exact base above and these current product contracts:

- `docs/spec/zukan-product-architecture/PLAN.md`
- `docs/spec/zukan-product-architecture/SPEC.md`
- `docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`
- `DESIGN.md`

The roadmap states that M10 Track A hardens the existing publication feed, while new Publication Profiles remain frontier work. The product contracts require one governed source truth, explicit rights/review/publication boundaries, and no profile-specific content silo.

## Existing surface found

| Responsibility | Current source | Finding |
|---|---|---|
| Feed configuration and stable channel schema | `platform_v2/src/services/publicationFeedDefinitions.ts` (`f28cada7a397e34b2f4a2b5f1d448dc3c9e609ed`) | Config-driven feed/channel definitions; no profile-specific backend or database |
| Public projection and ordering | `platform_v2/src/services/publicationFeed.ts` (`b19cb34f46f923b39b94383cbd984a139d566f9b`) | Deterministic ordering, opaque cursor, bounded limit, explicit `verified` / `candidate` / `accepted` classification |
| HTTP surface | `platform_v2/src/routes/publicationFeeds.ts` (`1d3e7d9ee232f40256d29dd232f0ddb9f0218e75`) | One feed route with config-owned scope, 400/404/503 failure states, ETag, cache and CORS allowlist |
| Cloudflare projection adapter | `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts` (`a77718053aaf446932516009197a4e98f1657d25`) | Reuses the same public eligibility envelope against the Worker read model |

## Safety and reuse boundary

The existing projection rejects records unless public visibility and accepted quality are present, destination-bound syndication rights allow the feed, sensitive species and face-bearing media are excluded, and community-photo roles are independently publishable. Source correction/withdrawal changes the derived feed instead of creating a second canonical copy. Private source data is not auto-published by this surface.

The bounded current-source search found no generic `PublicationProfile` entity/table or profile-specific feed engine. Existing `PublicationEdition`, feed configuration, and native Worker projection are the reusable M10 Track A surface. M10 Track B remains a future profile decision and is not activated by this audit.

## Verification coverage

The existing source tests cover:

- `platform_v2/src/services/publicationFeed.test.ts` (`1abb840bc9b54fd7889fa4282a5ba66d07d40ace`): configuration reuse, privacy/rights/media/sensitive-location gates, explicit classification, deterministic pagination, channel reuse, correction/withdrawal, and destination-bound syndication.
- `platform_v2/src/routes/publicationFeeds.routes.test.ts` (`43ed97ef3d96d20d7eb7d20d19018814a36684c0`): public envelope, cache/CORS headers, ETag 304, supported query values, malformed input rejection, 404 and 503 behavior.
- `platform_v2/cloudflare_shadow/src/publicationFeedNative.test.ts` (`25c31214a9d16afd407f231f156a8880bce9ebfb`): Worker-native projection and eligibility behavior.

The checks for this audit are source-level and do not establish current staging or production runtime identity. Runtime/public-journey acceptance remains governed by the registered release Evidence for the exact deployed SHA.

Executed on this exact source tree:

- `npm exec -- tsx --test src/services/publicationFeed.test.ts src/routes/publicationFeeds.routes.test.ts` → 15 passed, 0 failed.
- `npm exec -- tsx --test cloudflare_shadow/src/publicationFeedNative.test.ts` → 5 passed, 0 failed.
- `npm run typecheck` → passed.
- `git diff --check` → passed.

## Decision

M10 Track A is source-verified by reuse of the existing feed surface. No product code change is required for this bounded gap audit, and no duplicate public profile/feed system should be created. Any future M10 Track B implementation must be a separate, explicitly adopted Work with its own demand, rights, review, publication and runtime Evidence.
