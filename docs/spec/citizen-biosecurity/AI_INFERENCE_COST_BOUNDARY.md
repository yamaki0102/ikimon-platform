# Citizen Biosecurity — Bounded AI / API Cost

Status: `ADOPTED ON MERGE / DESIGN ONLY / IMPLEMENTATION UNVERIFIED`
Date: 2026-09-13 JST
Parents: `SPEC.md`, `SERVICE_SURFACE_AND_PROMPT_BOUNDARY.md` and the [Global Platform Bundle revision 2](https://github.com/yamaki0102/all-projects-management/blob/main/operations/decisions/2026-09-13-zukan-public-portal-network-and-nocosil-distribution-v1.md).

## 0. Decision and correction

ZUKAN is a bundle of peer platforms with no privileged default product or compulsory global AI prompt. The previous version's `normal ZUKAN` / `generic ZUKAN path` hierarchy is **SUPERSEDED**. Cost policy is selected by an authorized operation, not by an invented general parent application.

Adding a portal, species Target Profile, guide, region policy or public placement does not itself invoke AI or reprocess historical records. Browsing, deterministic filtering and displaying an already accepted result require no new model inference. They still incur storage, request, DB, indexing, media-transfer and operation costs; zero new AI is not zero total API cost.

Forbidden scaling rule: `all records × all species/profiles/portals × all images × all languages`.

Intended scaling rule: necessary new authorized assessments plus selected changed-publication translations/distributions, bounded retries and actual infrastructure/human work.

## 1. Permitted assessment triggers

A new biosecurity provider call requires both a real task and current rights/authority/capacity. Valid tasks are:

1. a user explicitly requests the biosecurity assessment/capture workflow, including from another peer surface;
2. an existing authorized Program/monitoring policy specifies target scope, location/period, budget and accountable review path;
3. an authorized operator/reviewer requests a materially necessary re-assessment.

An already persisted result from another capability may be reused to present a guide or candidate handoff without a new call. Its existence alone does not authorize additional external processing or publication. Profile activation, an image upload, a geographical match or an untrusted route/query parameter is not an inference trigger.

Provider policies are evaluated before expensive processing. Do not apply every domain's screening pipeline to a shared record.

## 2. Direct task path

```text
resolve operation / authority / evidence scope
-> deterministic MIME, size, dimension, duplicate and required-input checks
-> compatible authorized assessment reuse
-> budget admission/reservation
-> one bounded assessment stage when needed
-> persisted result + assessed/unassessed asset IDs
-> candidate feedback / real review or official handoff when applicable
```

Domain prompt, relevant Target Profile and current regional policy are composed into the necessary context, not executed as mandatory separate calls. A selected Kubiaka target narrows the task, not the allowed answer: lookalikes, other subjects and uncertainty must remain possible.

For unknown subjects, use a bounded candidate-generation stage only when requested/eligible, then deterministic taxonomy/profile/policy lookup. Never run one call per active profile or pass every registered species to the model. A later targeted assessment is allowed only for a meaningful unresolved task within a configured ceiling, not an automatic second stage for all records.

Region and season may prioritize evidence/context; they cannot prove absence, reject a novel invasion, or turn `out of scope` into `not supported by evidence`.

## 3. Reuse contract

Use stored evidence and assessment provenance as the reuse authority, not a provider cache.

Equivalent assessment requires compatible:

```text
rights/security scope and allowed processing purpose
asset contents + selected asset set/crop/preprocessing digest
record/evidence revisions
normalized task/purpose and output-schema version
model/provider/version + pipeline/prompt version
material observation/context values (including time/location when used)
material Target Profile/policy versions
```

A single image checksum is insufficient when context, purpose or permissions differ. Permission is checked before lookup/return so caches cannot reveal another user's private capture or result. Cross-product reuse uses only an explicitly eligible projection, not the private source/cache.

Changing a heading, profile label, route or UI language does not re-run image inference. New photos, corrected context, invalidated results or a deliberately adopted new assessment method may justify bounded re-assessment. Store assessed and unassessed images separately; never mark six photos reviewed after assessing three.

Provider/Gateway equivalent-request caching is supplemental. Do not assume unique field photographs produce cache hits. Translation reuse is separate from image-assessment reuse and remains bound to source edition, selected locale, human edits and glossary/pipeline.

## 4. Images, retries and model choice

Multiple images may share a request when the chosen model can evaluate them appropriately; batching does not make image tokens, bytes or compute free. Bound number, resolution/crops, bytes, input/output tokens and total calls per task. Validate image suitability rather than destructively compressing away identification evidence merely to hit a cost figure.

Prefer no AI, then permitted reuse, then the cheapest evaluated model sufficient for the task. Escalate only the material unresolved remainder. A risk flag raises attention/appropriate routing; it does not automatically authorize a premium model or require an unavailable human service.

Retries are finite and distinguish transient transport failure from deterministic invalid input or unsupported provider capability. Persist request/result identity; reconcile ambiguous effects before retry where needed. Do not repeat the same permanent failure or enqueue unbounded premium fallbacks.

Model identities/prices/allowances stay current configuration, not copied into every Target Profile. Evidence of model adequacy is separate from a generic benchmark or a fluent answer.

## 5. Hard admission and degradation

Before paid inference reserve/check applicable per-task, user/workspace, provider/account and platform budgets/concurrency through the existing native admission/Action seam. Release/settle reservations on known completion/cancellation. Account for outstanding work so concurrent calls cannot all spend the same remaining allowance.

A cost dashboard or after-the-fact provider report alone is not an enforceable spending limit. Until a limit is actually enforced, do not claim capped costs. Numeric limits require measured task/quality/latency baselines and explicit existing budget policy; this design authorizes no new paid provider or spending increase.

At quota/provider failure:
- preserve record/media/receipt truth;
- display AI not-run/unavailable/pending only when actually applicable;
- keep save/edit, deterministic guidance and authorized official/manual handoff available;
- avoid an unbounded delayed backlog or promising expert review where no accountable capacity exists.

A budget cap never converts uncertainty into a negative identification or asserts safety. Accountable human review, moderation and support have their own capacity; do not promise free unlimited specialist verification.

## 6. Global publication and non-AI cost

Reusing one permitted record in an environmental view, a school activity or a regional publication does not require image re-analysis. Changed public facts can be rendered into existing views/feeds deterministically. Optional translation is generated for requested supported locales and only affected accepted source editions, not every global language on every view.

External provider costs grow with selected operations/destinations and verification, not the number of possible registered adapters. Use source deltas, permitted webhooks or conditional reads before polling. UI browsing must not call each external provider per item or each specialist model per image.

The total bill also includes DB rows/work, media storage/transforms/transfer, map/geocoding services where used, search indexing, moderation and human minutes. No fixed per-photo price or global scalability guarantee is claimed without actual measurement.

## 7. Metrics and acceptance

Measure by operation/surface with privacy-safe aggregation:
- model calls, image/input/output volume and money per 1,000 assessed records;
- zero-new-inference share and compatible reuse share;
- extra-stage/premium escalation and human-review load;
- outstanding reservation, actual spend, retry/failure and wait times;
- publication/translation/provider cost per accepted changed edition;
- non-AI storage, DB and media usage.

Required invariants:
1. Profile/portal addition alone causes zero inference and no historical replay.
2. A peer-surface browse/contribution does not silently trigger biosecurity AI.
3. Reuse checks material context and current rights, not only asset hash.
4. No request contains every active profile by default.
5. Multimodal batching reports actual evaluated assets and metered use.
6. Concurrent admission and bounded retries cannot bypass the configured spend ceiling.
7. Failed/unused AI cannot invalidate a saved record or block available official-contact guidance.
8. Human review is explicitly staffed/capacity-bound or shown as unavailable, never inferred from AI status.
9. Translation/distribution uses selected changed editions and independent destination effects.
10. Pricing and technical/provider capabilities are verified at implementation, not assumed from this document.

No new generic inference scheduler, per-species classifier service, second AI truth database, global prompt registry or permanent premium route is introduced. Reuse existing native/model/Action infrastructure and generalize only after measured recurring demand.
