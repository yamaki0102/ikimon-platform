# ZUKAN — Agent Guide

ZUKAN is a place-centered shared knowledge and participation product across nature, culture, history and everyday regional life. Biodiversity is one Domain Pack; an observation event is one Program profile.

## Authority and start

- Fresh-read `yamaki0102/all-projects-management:operations/ai_os/noah_operating_contract.md`, the current work queue, and the relevant project packet before making current-state or delivery claims.
- Product entry: `docs/START_HERE.md`, `PROJECT.json`, `docs/spec/zukan-product-architecture/{SPEC,PLAN,PROFILE_HORIZON}.md`. UI work also reads `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`; participation/Program discovery UI additionally reads `docs/spec/zukan-app-experience/PARTICIPATION_EXPERIENCE_V1.md`.
- Product Registry owns meaning, acceptance and static dependencies. The management queue and shared Verified Outcome Status Resolver own current assignment and resolved evidence. A static task is not a live lease or runtime proof.
- Use exact current source in an isolated native workspace, with one writer for the repository. Preserve unrelated dirty work and existing failed Work identities. Apply the current management start/locality and admission contract for the actual execution node.
- Owner-authorized reversible source, test, branch, PR and merge work proceeds without repeated approval. Existing protected release, rights, privacy, identity and external-send boundaries remain binding.

## Runtime and repository map

| Responsibility | Current source |
|---|---|
| Public product | `https://zukan.earth/` |
| Staging product | `https://staging.zukan.earth/` |
| Active Worker request/read/write routes | `platform_v2/cloudflare_shadow/src/index.ts` and sibling modules |
| Shared UI, domain services and Node materialization | `platform_v2/src/{ui,routes,services,content}` |
| Active storage and media | registered Cloudflare D1/R2 bindings; verify current provider identities before mutation |
| PostgreSQL/Node implementation | retained source and compatibility/materialization assets; existence is not active production proof |
| PHP compatibility archive | `upload_package/`; explicit compatibility, rollback or data-preservation work only |

`ikimon-life`, `yamaki0102/ikimon-platform` and `platform_v2` remain technical identifiers. `ikimon.life` is a legacy compatibility/rollback host, not the canonical product URL. Do not rename physical roots or identifiers opportunistically.

When changing a shared UI renderer, verify how the active Worker consumes its materialized HTML; a correct Node route alone does not prove a production fix.

## Product and safety invariants

- Keep Record, Source/Evidence, Claim/ClaimRevision, Place/Entity, Rights/Review and PublicationEdition distinct. New conclusions do not overwrite the original source.
- AI supplies candidates with uncertainty and provenance. Missing or failed analysis never becomes a confirmed human claim.
- Preserve private capture, explicit publication, field-scoped rights and location/media minimization. A public-list eligible record is not automatically eligible for homepage promotion, external syndication or provider transmission.
- Reuse current `observationDataRights.ts`, `publicationFeedNative.ts`, active Worker privacy/media policies and their tests. Do not infer current protection from an archived PHP helper.
- NOCOSIL and ZUKAN keep their product-local canonical stores and domain sessions. No private-to-public automatic projection or giant shared product DB. Shared Identity & Activity is a separately evaluated draft until formally adopted; it grants no publication authority.
- Use existing Program/Publication/Place and release paths. No customer-specific core, extra scheduler, feed, auth system or generic engine without a demonstrated unmet need.
- Preserve source records, production data, secrets and credentials. Never log secret values or use owner impersonation for a test.

## UI conventions

Use the established Alpine/Tailwind/MapLibre and shared renderer assets. Keep Japanese copy concrete, concise and non-coercive; preserve pinned CDN dependencies and existing tokens. Shared controls need visible keyboard focus, accessible names and touch targets of at least 44px (preserve larger established capture targets). Support empty, unavailable, denied, partial and retry states. A map failure must still allow record discovery.

## Verification

Apply management `operations/ai_os/change_proportional_verification_policy.md`: classify the actual delta and choose the smallest proof set for its material risk. For copy/docs use bounded diff and relevant rendering/schema checks; for privacy, draft recovery, idempotency and state transitions use meaningful negative/behavior tests. Use the registered runner as authoritative build owner when preparing a release; do not duplicate its build.

Useful commands, selected by scope:

```bash
npm --prefix platform_v2 run test:product-registry
cd platform_v2 && npx tsx --test src/productRegistryBroadRoadmap.test.ts
cd platform_v2 && npx tsx --test <affected-test-paths>
```

Real-account QA uses an already authorized normal product session. Authentication/consent remains with its owner; never spoof an owner ID. Label source, tested, staging and production evidence separately, including what was not exercised.

## Release and source adoption

The sole release lookup is management `operations/deploy_standard/service_deploy_registry.json`; run `php scripts/get_service_deploy_method.php zukan.earth --catalog` there and follow its current effective route and registered release contract. `STANDARD_READY` uses the registered provider-native runner; custom transport is required only when the catalog says so. Read current source, provider snapshot, staging proof, rollback and valid authority before protected production work.

Use a short-lived `codex/<work-id>` branch → reviewed/verified PR → authorized merge. No direct main push, forced history or bypass of failing required checks. Do not claim deployment from merge. A database change does not itself create a human gate; apply the actual current migration/profile and recovery authority. No implicit DNS/IAM/secret/billing/customer-send permission.

**SUPERSEDED (2026-09-05):** former root instructions describing VPS/Node/PostgreSQL as current production, mandatory GitHub Actions deployment, unconditional Queue/Sandbox routing, `ikimon.life` as canonical URL, archived PHP privacy helpers, mandatory full-suite verification and three unsolicited future proposals. Their historical text remains in Git history; current authority is the management contract/catalog and the product sources above.

## Completion

Report changed behavior, exact source/PR, proportional checks, current runtime read-back, remaining real dependencies and next admitted Work. A passing test, merged PR, HTTP 200 or old LIVE_VERIFIED record does not establish the complete user journey. Preserve existing blocked slices and failure bindings; continue independent adopted source work through the same management queue without renaming or retrying the blocked task.

## Test data isolation (owner correction, 2026-09-05)

- Do not create dummy or synthetic production posts as product verification, including private posts under the owner's account. Use local fixtures, isolated staging tests with cleanup, and read-only production checks.
- The daily production-media-smoke writer is retired. Do not re-enable its timer or bypass the production guard to satisfy a test. Existing sample data does not prove real participation or user contribution.
- Delete or hide only positively identified test records through the existing owner/canonical cleanup semantics. Preserve actual user posts, keep a bounded before/rollback record, verify removal from lists/detail/maps, and close the producer that recreated the data.
