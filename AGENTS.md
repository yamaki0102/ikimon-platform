# ZUKAN — Agent Guide

ZUKAN is a place-centered shared knowledge and participation product across nature, culture, history and everyday regional life. Biodiversity is one Domain Pack; an observation event is one Program profile.

## Native development and release — 2026-10-09 owner decision

- Ordinary development, verification, staging and release must not depend on a custom plugin, MCP, executor, Factory acceptance or NOCOSIL Work connection. Use git, protected GitHub PRs and the service's registered provider-native route with existing authorization.
- Apply the current owner's task scope directly. Preserve supplied task references and useful evidence, but do not require a Work selector or claim token to start ordinary code work. Keep one writer per mutable scope and read back unknown effects before continuing.
- A frozen or unavailable Factory remains a separate infrastructure task. Its repair, connectivity and background jobs are not prerequisites for ZUKAN delivery.
- Preserve applicable production activation, database, secret, IAM, DNS, rights, billing and external-send boundaries. Confirm the actual ZUKAN release route; NOCOSIL's `release/production` branch is not a portfolio-wide deployment setting.

## Codex Cloud — P0 fast start

For “P0から開発して”, “最優先から”, or “続きから”:

1. Scope to `ZUKAN`, current repo `yamaki0102/ikimon-platform` (`ikimon-life` is the existing technical key). P0 is a **priority filter**, not a Work ID, an old Factory P0-A/B/C/D phase, or a grant. Do not work in `t3ta/zukan`, legacy `ikimon.life`, or archived PHP by default.
2. Start with the current owner instruction and any supplied task ID, PR, source SHA or handoff. Fresh-read the relevant current source, existing candidate and available task evidence. Preserve supplied identities without turning their originating service into an execution prerequisite.
3. For priority-only P0, use available current approved project priorities and task evidence to identify a bounded next action. A static plan or old PR is not a live queue or a grant. If the priority cannot be established, report that specific uncertainty and continue independently authorized work; do not stop merely because a Factory/Work selector is unavailable.
4. Bind the permitted scope, valid authority, exact source/tree, unresolved effects and reusable candidate. Execute the next scoped action; read changed paths and affected canonicals, not the full documentation/history. Active Worker is `platform_v2/cloudflare_shadow/src/`, shared source `platform_v2/src/`; UI additionally reads `DESIGN.md` plus affected experience spec.
5. Do focused checks and registered publication/runtime read-back under existing rights. Keep concise purpose, changes and verification in the PR, with detailed evidence locators only when useful. Preserve the existing task reference and next action without waiting for a custom plugin write-back. PR, staging, production and user Journey remain distinct.

This is a bounded entry rule, not a new selector or permission grant. Product/security/release rules below remain effective; demand-load only applicable documentation. The former mandatory Factory selector and `WORK_SELECTOR_UNAVAILABLE` startup gate are superseded by the 2026-10-09 owner decision.

## Authority and start

- Fresh-read the current owner scope, relevant source and exact next-effect policy. Reference `yamaki0102/all-projects-management:operations/ai_os/noah_operating_contract.md` as the shared contract; read available relevant task evidence on demand, not the entire portfolio queue. A missing custom connection does not block independently authorized source work.
- Product entry: `docs/START_HERE.md`, `PROJECT.json`, `docs/spec/zukan-product-architecture/{SPEC,PLAN,PROFILE_HORIZON}.md`. UI work first reads `DESIGN.md`, the canonical ZUKAN design rulebook for shared brand, visual, interaction, internationalization and accessibility decisions, then `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md` for existing navigation, screen and state responsibilities; `/profile` / `自分` UI additionally reads `docs/spec/zukan-app-experience/MY_PAGE_V2.md`; participation/Program discovery UI additionally reads `docs/spec/zukan-app-experience/PARTICIPATION_EXPERIENCE_V1.md`.
- Product Registry owns meaning, acceptance and static dependencies. Preserve supplied Work/assignment/Resume provenance when available; management projections, PRs and static tasks do not prove current runtime or grant protected authority.
- Use exact current source in an isolated native workspace, with one writer for the repository. Preserve unrelated dirty work and existing failed task identities. Apply the current service-scoped authority and conflict boundaries without reviving a superseded custom admission prerequisite.
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

For ZUKAN frontend implementation, redesign, CSS, responsive layout or visual review, also use .agents/skills/zukan-frontend-quality/SKILL.md as the project adapter. It does not replace DESIGN.md; it binds implementation to rendered before/after inspection and existing Evidence/Resume.

`DESIGN.md` is adopted design, not proof of current UI or runtime conformance. It preserves the existing product/rights/state semantics and explicitly scopes any superseded visual guidance. Do not start a page redesign, new feature, new locale or deployment solely because the rulebook was adopted.

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

The sole release lookup is management `operations/deploy_standard/service_deploy_registry.json`; run `php scripts/get_service_deploy_method.php zukan.earth --catalog` there and follow its current `effective_route` and registered release contract. `STANDARD_READY` uses the registered provider-native runner; legacy Queue/Executor fields do not override the resolved native route. Read current source, provider snapshot, staging proof, rollback and valid authority before protected production work. If the Cloud Codex execution host cannot use its existing provider authorization, recover through an already authorized Cloudflare Workers Builds execution host only when the current central runner adapter registers that host. Keep the same runner, exact source/tree, staging and production gates, and runtime read-back. This reuses an existing host; it does not add a workflow, credential, IAM grant or deployment backend. If that capability is unavailable, complete independently authorized source work and report the specific release gap. Do not invent a route or copy NOCOSIL's release branch configuration.

Use a short-lived `codex/<task-name>` branch → reviewed/verified PR → authorized merge. No direct main push, forced history or bypass of failing required checks. Do not claim deployment from merge. A database change does not itself create a human gate; apply the actual current migration/profile and recovery authority. No implicit DNS/IAM/secret/billing/customer-send permission.

**SUPERSEDED (2026-09-05):** former root instructions describing VPS/Node/PostgreSQL as current production, mandatory GitHub Actions deployment, unconditional Queue/Sandbox routing, `ikimon.life` as canonical URL, archived PHP privacy helpers, mandatory full-suite verification and three unsolicited future proposals. Their historical text remains in Git history; current authority is the management contract/catalog and the product sources above.

## Completion

Report changed behavior, exact source/PR, proportional checks, current runtime read-back, remaining real dependencies and the next concrete action. A passing test, merged PR, HTTP 200 or old LIVE_VERIFIED record does not establish the complete user journey. Preserve existing blocked slices and failure bindings; continue independent authorized work without renaming or blindly retrying the blocked task. Custom plugin write-back and Factory closeout are not ordinary delivery gates.

## Test data isolation (owner correction, 2026-09-05)

- Do not create dummy or synthetic production posts as product verification, including private posts under the owner's account. Use local fixtures, isolated staging tests with cleanup, and read-only production checks.
- The daily production-media-smoke writer is retired. Do not re-enable its timer or bypass the production guard to satisfy a test. Existing sample data does not prove real participation or user contribution.
- Delete or hide only positively identified test records through the existing owner/canonical cleanup semantics. Preserve actual user posts, keep a bounded before/rollback record, verify removal from lists/detail/maps, and close the producer that recreated the data.
