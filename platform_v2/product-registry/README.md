# ZUKAN Product Experience Registry

このディレクトリは、ZUKANのproduct meaning、Acceptance/Eval参照、静的な依存順と実装navigationを保持する正本projectionです。既存のProduct Registryを拡張し、別のproduct-management frameworkは作りません。

Canonical trace:

`Outcome → Golden Journey → Capability → Requirement → Surface → Design → Dependency → Roadmap → Task → Acceptance/Eval → Shared Status Resolver → Runtime Evidence`

## Authority boundary

- SPEC/ADRはproduct meaning、PLANはdependency/migration orderを定義します。
- Registryはstable IDs、acceptance、source asset locator、surface navigation、static dependency/roadmapを定義します。
- resolved status、Claim ID、Collector authority、exact-SHA/freshness、Evidence acceptanceは共有Resolverだけが決めます。
- Status authority: `operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus` (v1.0.0)
- Registry内にevidence snapshot、live source audit、learning state、local status resolver、local next-slice selectorは置きません。

## Files

- `product.json`: identity、canonical chain、shared Resolver locator、source asset locator
- `outcomes.json`: North Star、actor jobs、product outcomes and non-goals
- `surfaces.json`: user-facing routes/states/transitions and implementation references; planned items must not claim a route/runtime
- `capabilities.json`: capability matrix and stable Requirement references
- `journeys.json`: actor-based Golden Journeys、success/recovery、Outcome/Capability/Requirement trace
- `requirements.json`: stable product/trust/resilience contracts、evidence lanes、verification levels、invalidation keys
- `design.json`: visible states、layout/interaction contracts and bounded exceptions
- `content.json`: audience/message/CTA/prohibited claims/SEO/analytics contracts
- `quality.json`: acceptance、test locators、negative/property contracts、desktop/mobile Journey evaluator
- `evals.json`: Requirement-bound source/staging Eval contracts and negative Eval navigation for shared Resolver consumption
- `delivery.json`: static dependency graph、M1-M5 roadmap、Source/Delta/Done task contract and implementation navigation

## Roadmap

M1 Personal Record/media integrity → M2 Safe Publication + rights/data lifecycle → M3 Program/Event/Quest/Workspace collaboration → M4 Regional knowledge/PublicationEdition/portability/correction → M5 Live-camera POC.

Live-camera is deferred to M5. Its POC is limited to official/authorized sources, an additive existing MapLibre layer, pin-selection lazy playback, and no frame processing without separate rights.

## Update flow

1. SPEC/ADR/PLANでmeaning and orderを確認する。
2. Registryのstable Requirement、Golden Journey、negative Eval、source locatorを更新する。
3. `delivery.json`のstatic dependencies/navigationを更新する。Resolved statusを手書きしない。
4. Shared Resolverのfresh projectionがexecutor eligibilityを示したTaskだけをSource / Delta / Doneで実装する。
5. exact source identity、Requirement-specific Eval、real browser Journey、staging/runtime Evidenceを別々に検証する。

## Validation

```powershell
npm --prefix platform_v2 run test:product-registry
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_zukan_product_registry.ps1
```

Tests fail on route/surface drift、missing state/transition contracts、unsafe write contracts、unknown trace references、incomplete Requirement coverage、dependency cycles、roadmap gaps、or local status/evidence/selector reintroduction.

## Privacy/trust invariants

Private/unknown/rejected/quarantined/blocked content fails closed on public projections. EXIF/GPS、exact coordinates、face/person/living-place/private-land risk、minor/guardian consent、withdrawal/deletion/retention、correction/takedown、PublicationEdition and external-inference permission remain explicit Requirement + negative Eval boundaries. AI output is a candidate, not human/expert verification. Existing data, visibility, consent and rights are preserved unless an explicit approved migration changes them. Basic personal/organizational contribution, viewing, participation, Review and ordinary Publication remain within the free core.
