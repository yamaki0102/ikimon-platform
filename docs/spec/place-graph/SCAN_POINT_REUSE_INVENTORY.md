# SCAN_POINT_REUSE_INVENTORY

Source inventory only. No runtime, deployment, or product code changes.

## Board / checkout

- Work: `ZUKAN-PLACE-007`
- Branch: `codex/zukan-place-007-inventory-20260907`
- Exact base / HEAD: `f7b1c9762cad787a70756310a40082dac8b705c0`
- Tree: `076efdfceaa91ac80e3cd96a53531bb57480342b`
- Current Board evidence: `/home/nexus/NEXUS/state/fresh-release-eXDGet/all-projects-management/operations/ai_os/noah_current_work_queue.v1.json:15520-15564`
- Board contract read-back: `/home/nexus/NEXUS/state/fresh-release-eXDGet/all-projects-management/operations/ai_os/noah_operating_contract.md:1-80`
- Board projection read-back: `/home/nexus/NEXUS/state/fresh-release-eXDGet/all-projects-management/00_dashboard.md:1-24`

The current Board entry for this work states:

- `scope`: inventory current tracked source for scan / QR / NFC / guide-page implementations
- `verification`: bind every reuse candidate to exact paths / symbols / search evidence
- `exact_source`: `github:yamaki0102/ikimon-platform@f7b1c9762cad787a70756310a40082dac8b705c0:AGENTS.md`

## Search scope

Bounded searches were run against tracked current source in:

- `platform_v2/src`
- `platform_v2/cloudflare_shadow/src`
- `platform_v2/e2e`
- `docs/spec/place-graph`

Search terms checked included:

- `scanned-data-page`
- `scanned data page`
- `scan data page`
- `scan-data page`
- `scan point`
- `scanpoint`
- `guide page`
- `guide-page`
- `ScanPoint`
- `GuideContent`
- `NFC` / `nfc`

Result:

- No literal `scanned-data-page`, `scan point`, `scanpoint`, `ScanPoint`, or `GuideContent` symbol was found in the bounded active-source search.
- No NFC-specific route / component / page was found in the bounded active-source search.
- The closest reusable cluster is the existing scan / guide / outcomes / fieldscan surface described below.

## Reuse candidates

### 1. Public scan entry and routing shell

| Path | Exact evidence | Reuse note |
| --- | --- | --- |
| `platform_v2/src/routes/publicEntryRead.ts` | `app.get("/lens")`, `lensPageCopy`, `renderPublicRouteCardGrid` at `:69-100` | Current public scan-like entrypoint. Strong candidate for a ScanPoint router wrapper or alias. |
| `platform_v2/src/ui/siteShell.ts` | main nav item `href: "/lens"` at `:651-656` | Stable navigation hook for a place / scan page. |
| `platform_v2/src/ui/landingTop.ts` | scan shelf copy and CTA at `:1711-1724`, `:1800-1826`, `:1865-1870` | Existing scan-oriented landing copy. Reuse this before inventing new top-of-funnel language. |
| `platform_v2/src/ui/mapExplorer.ts` | `lensHref` at `:1122-1130`; place actions `guide` / `scan` at `:5321-5348` | Existing map actions already route to `/guide`, `/lens`, and `/record`. Useful for a place-page entry and nearby scan affordance. |
| `platform_v2/src/ui/observationRally.ts` | action dock and scan redirect at `:89-102`, `:295-305` | Existing in-context scan action already routes to `/record?fieldScanMode=site_snapshot&start=photo`. Reuse this behavior rather than adding a new capture path. |
| `platform_v2/src/ui/observationEventOrganizerConsole.ts` | QR join instruction at `:65-75`; `verification_policy` includes `qr` at `:169-174` | The only explicit QR-facing UI in active source. Reuse it as the organizer-side QR reference point. |

### 2. Guide capture and analysis core

| Path | Exact evidence | Reuse note |
| --- | --- | --- |
| `platform_v2/src/ui/guideFlow.ts` | `renderGuideFlow` export at `:688`; session summary / recap / audio submit / offline queue at `:910-924`, `:2490-2865` | Full live-guide capture shell already exists. This is the best base for any scan-point capture, recap, or offline retry behavior. |
| `platform_v2/src/routes/fieldscanApi.ts` | fieldscan audio submit / callback / privacy callback / recap at `:69-207` | Current fieldscan audio pipeline. Reuse for any place-page workflow that needs trusted audio submit and recap read-back. |
| `platform_v2/src/routes/fieldscanIdentity.routes.test.ts` | trusted-user resolver assertions at `:45-83` | Confirms the current auth boundary for fieldscan writes. Keep this guard in the reuse path. |
| `platform_v2/src/routes/guideApi.ts` | imports and route handlers at `:1-17`, `:568-770`, `:1017-1147` | Existing guide scene, record, telemetry, live-token, TTS, and promotion routes. Do not recreate a second analysis backend. |
| `platform_v2/src/services/guideSession.ts` | `GuideMode`, `SceneResult`, `absenceBoundary`, `detectedFeatures` at `:12-73`, `:150-219` | Canonical scene-result schema for live guide capture. Good source for a scan-point result model if the place page needs one. |
| `platform_v2/src/services/guideEnvironmentMesh.ts` | feature aggregation and mesh upsert at `:17-27`, `:86-103`, `:133-260` | Existing spatial aggregation from guide records. This is the current reusable place-density / environment mesh layer. |
| `platform_v2/src/services/guideRecordPromotion.ts` | location gating, promotable audio, promotion helpers at `:105-127`, `:177-260` | Safe path from guide record to observation. Reuse the promotion boundary rather than bypassing it. |

### 3. Guide outcomes and public recap surfaces

| Path | Exact evidence | Reuse note |
| --- | --- | --- |
| `platform_v2/src/routes/guideRead.ts` | `renderGuideLoopPanel` with `/guide/outcomes` action at `:75-124`; `/guide`, `/guide-programs`, `/my-guides` routes at `:444-560` | Existing guide-page shell already connects guide traces to records, outcomes, and map. Good host for a concise mobile place page. |
| `platform_v2/src/routes/guideRecordsDebug.ts` | login gate and outcomes cards at `:79-95`, `:662-745`; `/guide/outcomes` route at `:1378-1390` | Current `/guide/outcomes` page. It is the closest existing “guide page / recap page” prototype. |
| `platform_v2/src/routes/guideRecordsDebug.test.ts` | outcome filtering and promotion assertions at `:8-37` | Confirms the outcomes page already separates saved, non-detection, not-retained, and audio records. |
| `platform_v2/cloudflare_shadow/src/index.ts` | redirect to `/guide/outcomes` at `:16480-16487`; static outcomes HTML at `:18052-18078` | Worker-side materialization of the guide-outcomes prototype. This is a real current source asset, but it is a presentation materialization, not a new capture stack. |
| `platform_v2/src/ui/guideFlow.ts` | results link to `/guide/outcomes` at `:910-924` | Shows the live guide flow already hands off to the outcomes page instead of ending in-place. |
| `platform_v2/src/routes/publicCopy.routes.test.ts` | `/guide` and `/guide/outcomes` public contract at `:612-628` | Confirms the guide/outcomes route is part of current public copy and redirect behavior. |

### 4. Legacy / adjacent prototype signal

| Path | Exact evidence | Reuse note |
| --- | --- | --- |
| `platform_v2/cloudflare_shadow/src/index.ts` | `renderGuideOutcomesHtml` at `:18052-18064` | The static worker HTML is the closest literal “page prototype” in active runtime. If a scan-point landing page needs a lightweight HTML shell, this is the nearest pattern. |
| `platform_v2/cloudflare_shadow/src/index.test.ts` | `/guide/outcomes` fetch assertion at `:12919-12923` | Confirms the worker route is still exercised as a current behavior, not just dead code. |

## Gaps

- No active-source symbol literally named `ScanPoint` was found.
- No active-source symbol literally named `GuideContent` was found.
- No active-source NFC-specific page or route was found.
- No active-source file literally named `scanned-data-page` or `scan point` exists.
- The current source has scan and guide affordances, but they are distributed across `/lens`, `/guide`, `/guide/outcomes`, `guideFlow`, `fieldscan`, `mapExplorer`, and organizer / landing UI rather than packaged as one dedicated ScanPoint page.

## Minimum reuse path for ZUKAN-PLACE-003 / 008

### ZUKAN-PLACE-003

Use the existing public scan entry and guide shell instead of building a new capture stack:

- front door: `platform_v2/src/routes/publicEntryRead.ts` (`/lens`)
- navigation: `platform_v2/src/ui/siteShell.ts` and `platform_v2/src/ui/landingTop.ts`
- guide page shell: `platform_v2/src/routes/guideRead.ts`
- recap page: `platform_v2/src/routes/guideRecordsDebug.ts` and `platform_v2/src/ui/guideFlow.ts`
- trusted write path: `platform_v2/src/routes/fieldscanApi.ts` and `platform_v2/src/routes/guideApi.ts`

For 003, the smallest safe move is a thin ScanPoint router / alias layer that forwards into those existing modules, with no duplicate media pipeline and no new backend concept.

### ZUKAN-PLACE-008

Build the pilot E2E on the same reuse path and only add the pilot-specific place / multilingual framing around it:

- capture / analysis: `platform_v2/src/ui/guideFlow.ts`, `platform_v2/src/routes/guideApi.ts`, `platform_v2/src/services/guideSession.ts`
- spatial summarization: `platform_v2/src/services/guideEnvironmentMesh.ts`
- promotion boundary: `platform_v2/src/services/guideRecordPromotion.ts`
- guide / outcomes UI: `platform_v2/src/routes/guideRead.ts`, `platform_v2/src/routes/guideRecordsDebug.ts`
- place exploration and CTA surfaces: `platform_v2/src/ui/mapExplorer.ts`, `platform_v2/src/ui/landingTop.ts`, `platform_v2/src/ui/siteShell.ts`

For 008, the smallest safe move is an E2E that composes those existing modules into one real multi-place pilot, rather than inventing a new page family or a second scan runtime.

## Limitations

- This inventory intentionally stayed inside tracked current source. It did not rely on runtime proof, deployment proof, or any untracked workspace.
- `upload_package/` was not used as the primary reuse path because the repo guide treats it as a compatibility / rollback archive rather than current runtime.
- Search evidence is bounded to the paths and terms listed above; absence claims are limited to that search scope.
