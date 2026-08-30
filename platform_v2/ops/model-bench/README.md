# ZUKAN Model Bench

Status: source implementation. `zukan-post-model-bench-v2` supersedes the earlier image-per-fixture draft.

## Current PR #1582 state (2026-08-27)

The current comparison reuses the immutable owner-derived 7-post / 21-image manifest:

- dataset SHA-256: `db98e2a6bd16f0cb3cf9b856dd54472d22760771d970572a3dead7bd99cfbfff`
- prompt SHA-256: `6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9`
- visit IDs and ordered image digests: `fixtures/zukan-owner-post-smoke-v2-7.external.json`
- Gemini baseline: `gemini-3.5-flash-lite`, provider-native `responseJsonSchema`, 2048 output tokens, minimal thinking, one request/post, retry 0, fallback 0
- GLM challenger: `@cf/zai-org/glm-5.3-flash`, official Workers AI REST, 8192 completion tokens, one request/post, retry 0, fallback 0

Gemini's previous 1/7 schema result was a benchmark-adapter omission: the model-router call set JSON MIME type but did not pass `responseJsonSchema`; the router already supported it, and the production Gemini implementation already used a native response schema. The canary passed after this minimum adapter fix, and the same seven posts then passed 7/7 schema validation. Full safe final content and parsed JSON are retained per post in the Evidence report; private reasoning is never stored.

The current grounding comparison intentionally does not use human gold. `NOAH_MAX_READ_V1` is an immutable high-resolution visual reference only, not taxonomic gold. Saved Gemini/GLM final content was reviewed with model names hidden; the comparison verdicts are `BEST_GROUNDING`, `BEST_OPERATIONAL`, and `BEST_BALANCED`, with no biological accuracy winner. See the 2026-08-28 grounding Evidence below. The historical human-gold gate remains unchanged for automatic model switching and is not converted into a zero score for this content comparison.

## Goal

Compare current and future vision models on the smallest useful fixed ZUKAN dataset, using exactly the same posts, the same ordered photo sets, and the same prompt.

## Dataset size

- Core: **24 posts**.
- Smoke: **the first fixed 8 posts of that same Core manifest**. PR #1582's current owner-derived comparison is a separately frozen 7-post / 21-image manifest because one source candidate was excluded by owner scope; it does not rewrite the v2 Core or 8-post freeze.
- Automatic model switching requires at least **8 human-consensus gold posts**.
- Do not grow the suite unless the 24-post Core cannot discriminate models reliably.

## Fairness / identity rules

- One fixture is **one ZUKAN post (`visitId`)**, not one image.
- All photos belonging to that post are sent together in **one model call**, in the same order shown by ZUKAN.
- Selection is not randomized per run. Candidate posts are deduplicated by `visitId`, deterministically ordered by a versioned fixed seed, then frozen once.
- The frozen manifest is immutable and refuses overwrite. Future model runs must reuse that exact manifest.
- Each photo is frozen by URL, MIME, byte length, and SHA-256.
- Each post additionally stores a digest over the complete ordered photo set. A changed image, missing image, added/removed image, or changed order invalidates the run.
- The benchmark prompt is frozen and SHA-256 checked on every run.
- Reports can only be compared when dataset digest, prompt digest, post count, and image count match.

## Gold / leakage rules

- Existing label, exact location, observer identity, and profile context are hidden from the model.
- Human-backed `community_consensus`, `authority_reviewed`, or equivalent durable identified state may be used as gold.
- Existing AI output is never gold.
- Public labels without human consensus are retained only as non-scoring context for dataset review.
- High-confidence over-precision beyond the human gold rank is a critical failure.
- Guessing a precise location when location is hidden is a critical failure.

## Rights boundary

Public visibility is not permission to send media to another AI provider.

Before any model call, derive a separate rights-vetted manifest from canonical `ObservationDataRights`. Only posts with:

- `externalExportAllowed=true`
- `withdrawalStatus=active`

remain eligible. The source manifest is not overwritten. Image bytes are never committed to Git.

## Hard gates

A challenger is ineligible when any of these fail:

- request success rate >= 99%
- JSON schema valid rate >= 99%
- critical failure rate <= 2%
- at least 8 human-consensus gold posts for automatic switching

Quality wins first. Cost and p95 latency are tie-breakers only when quality is within one percentage point.

## Fast path

Run from `platform_v2`.

The one-time Smoke freeze reads the canonical research occurrence projection directly; it does not crawl the map. It fails before downloading images unless at least eight records have human consensus, `externalExportAllowed=true`, and `withdrawalStatus=active`.

```bash
npm run bench:zukan -- prepare-smoke
```

To freeze a specific owner's posts without sending them externally, provide that owner's fixed candidate IDs. The same versioned seed deterministically selects eight posts from the list:

```bash
npm run bench:zukan -- freeze-owner-smoke --visit-ids=record-1,record-2,...
```

This creates a source-only manifest. It still must pass `vet-rights` before any model call.

The benchmark never treats an owner attestation, public visibility, or a prior report as a substitute for canonical rights. The run reads `ObservationDataRights` for every selected post and stops before image download or model calls if any row is missing or does not have the required consent, license, and active withdrawal state.

The current Gemini baseline uses the existing `model-router` path with Gemini's provider-native `responseJsonSchema` for the scored output keys (`recommended_taxon_name`, `recommended_rank`, and `confidence_band`). Optional final-output fields remain allowed and are persisted for later human or judge review. This changes only the benchmark adapter request configuration; production model, traffic, secrets, schema, and permissions are unchanged.

The Cloudflare GLM Smoke uses the official Workers AI REST API. It sends exactly one request per post, with all ordered photos in that request; it has no retry, fallback model, or Playground path:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 npm run bench:zukan -- smoke-glm \
  --manifest=ops/model-bench/fixtures/zukan-owner-post-smoke-v2.external.json
```

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` must already be configured in the execution environment. The historical command above used the original eight-post / 24-image freeze (`datasetSha256=5636ef685524c59813449c3c9afffbeaee4be062d80834f3f86bc3ee185b251b`, `promptSha256=6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9`). The current PR #1582 run uses the separate immutable seven-post / 21-image SHA listed above, `max_completion_tokens=8192`, and Cloudflare's 2026-08-26 published token rates ($0.15/M input, $0.50/M output). Reports include request count, provider usage, cost estimate, post-level scores, full safe final output, and p50/p95 latency; no retry or fallback is permitted.

The 2026-08-27 expanded Cloudflare-only canary is recorded in `platform_v2/ops/model-bench/evidence/2026-08-27-cloudflare-expanded-model-comparison.json`. It reused the same seven-post / 21-image manifest, prompt, rights snapshot, and ordered image inputs:

- `@cf/qwen/qwen3.8-27b`: one canary request returned HTTP 408 / provider code `3046` after 121353 ms; classified as a provider timeout and stopped before the seven-post run.
- `openai/gpt-5.6-luna`: one Cloudflare Responses request returned HTTP 402 / `invalid_prompt` for the unchanged multimodal input; stopped before the seven-post run.
- `@cf/meta/llama-3.2-11b-vision-instruct`: one request returned HTTP 403 / `5016` (Meta model terms not accepted); no license agreement request was sent and the model is `BLOCKED_LICENSE`.

All three canaries used Cloudflare authentication and official REST endpoints, with one request, no retry, no fallback, `stream=false`, and the same native ZUKAN output schema. Because no new model passed canary, no expanded model completed a seven-post run. Existing Gemini and GLM reports remain the only full-run operational inputs; their saved final content is compared in the bounded 2026-08-28 grounding Evidence. Cloudflare's `openai/gpt-5.6-luna` route uses the Responses API and does not require a local OpenAI API key.

The 2026-08-28 Luna route diagnostic tried the unchanged three-image canary once on each official Cloudflare path: `/ai/v1/responses` with the provider-native Responses payload and `/ai/run` with the model-specific Responses input. Both returned HTTP 402 before final content or usage (`invalid_prompt` and provider code `2021` respectively); no seven-post run was started. This is a provider/account entitlement boundary, not a parser or model-quality result. The benchmark adapter now accepts an explicit existing named `CLOUDFLARE_AI_GATEWAY_ID` and rejects missing or `default` gateway selection, so a future run cannot implicitly create a new Gateway. See `evidence/2026-08-28-cloudflare-luna-vision-route-diagnostic.json` and the two linked canary reports.

The 2026-08-28 grounding comparison did not call any model. It re-opened the fixed 21 images, verified their manifest SHA-256 values, and compared saved final content against the immutable `NOAH_MAX_READ_V1` visual reference. The blind artifact preserves full safe `raw_final_content`, full `parsed_json`, claim-level labels, scores, and nullable later-human-review fields. The GLM beetle post has no saved final content and is excluded from score means rather than scored as zero. See:

- `evidence/2026-08-28-blind-grounding-per-post.json`
- `evidence/2026-08-28-gemini-grounding-summary.json`
- `evidence/2026-08-28-glm-grounding-summary.json`
- `evidence/2026-08-28-grounding-cross-model-comparison.json`
- `evidence/2026-08-28-grounding-cross-model-comparison.md`
- `schemas/zukan-grounding-comparison-v1.schema.json`

The 2026-08-28 `gemini-3.1-flash-lite` run was stopped at the one-post canary. Production D1 native read-only SELECT confirmed all seven fixed posts satisfied the canonical external-export predicate. The official Gemini Generate Content path accepted the unchanged three-image input and native schema, but the canary ended with `MAX_TOKENS` and invalid JSON at output caps 8192, 16384, and 32768; each raw final response was preserved, and no seven-post run was started. This is recorded as `CANARY_BLOCKED` rather than a model-quality score. The final raw output remained an unclosed `recommended_taxon_name` string, so the failure is provider-native structured-output truncation, not a parser-only failure. See `evidence/2026-08-28-gemini-3.1-flash-lite-canary-diagnostic.json` and its three linked per-attempt reports.

## Explicit commands

Freeze the fixed 24-post Core dataset through the legacy public candidate path:

```bash
npm run bench:zukan -- freeze
```

Then rights-vet it directly against canonical `ObservationDataRights`:

```bash
npm run bench:zukan -- vet-rights \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.json
```

Run an explicitly selected model on a frozen manifest:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npm run bench:zukan -- run \
  --model=gemini:gemini-3.5-flash-lite \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json \
  --limit=8
```

Core baseline uses all fixed 24 posts:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npm run bench:zukan -- run \
  --model=gemini:gemini-3.5-flash-lite \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json
```

Run Cloudflare Workers AI GLM-5.3-Flash on that exact same manifest:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_API_TOKEN=... \
npm run bench:zukan -- run \
  --model=openai-compatible:@cf/zai-org/glm-5.3-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json \
  --input-usd-per-1m=0.15 \
  --output-usd-per-1m=0.50 \
  --pricing-source=cloudflare-workers-ai-2026-08-27
```

The expanded adapter is also available for Cloudflare REST models. It preserves the same ordered multimodal post input and native ZUKAN schema; canary gating is performed by the bounded runner used for the Evidence above:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npm run bench:zukan -- run \
  --transport=cloudflare-ai-rest \
  --model=@cf/qwen/qwen3.8-27b \
  --manifest=ops/model-bench/fixtures/zukan-owner-post-smoke-v2-7.external.json \
  --max-output-tokens=8192 \
  --input-usd-per-1m=0.45 \
  --output-usd-per-1m=3.20 \
  --pricing-source=cloudflare-workers-ai-qwen3.8-27b-2026-08-27
```

For an existing Cloudflare Gateway, set its ID in the already-authorized execution environment before a canary. A non-`default` name remains acceptable directly. The `default` Gateway is accepted only when a fresh dashboard/API read-back proves that it already exists and `ZUKAN_MODEL_BENCH_VERIFIED_DEFAULT_GATEWAY=1` is set for that run. This avoids both false rejection of an existing `default` Gateway and implicit creation when its state is unknown. The adapter does not create or mutate a Gateway, provider key, billing setting, production binding, or deployment.

The Cloudflare Luna path is invoked only with that existing named Gateway:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
CLOUDFLARE_AI_GATEWAY_ID=<existing-named-gateway-id> \
npm run bench:zukan -- run \
  --transport=cloudflare-ai-run \
  --model=openai/gpt-5.6-luna \
  --manifest=ops/model-bench/fixtures/zukan-owner-post-smoke-v2-7.external.json \
  --max-output-tokens=8192 \
  --limit=1 \
  --report-label=cloudflare-luna-canary
```

Run the remaining six posts only after that one-post canary passes schema validation. The runner still performs the canonical rights gate before every run. Cloudflare account credits and model capability remain provider-side prerequisites; they are not created or changed by this command.

Compare reports with the first report as baseline:

```bash
npm run bench:zukan -- compare \
  --reports=ops/model-bench/reports/baseline.json,ops/model-bench/reports/challenger.json
```

The legacy `decision` field remains for compatibility. Historical Gemini-vs-GLM Evidence uses the governed `finalVerdict`: `KEEP_GEMINI`, `SWITCH_TO_GLM`, `INSUFFICIENT_GOLD`, or `BASELINE_INVALID`. The new bounded content comparison uses separate `BEST_GROUNDING`, `BEST_OPERATIONAL`, `BEST_BALANCED`, and `NO_CLEAR_WINNER` fields; it does not approve a biological accuracy winner or change the production model.

The 2026-08-30 additional canary used the unchanged seven-post/21-image owner manifest. `gemini-3.7-flash` was sent one request with three ordered images through the official Gemini API using provider-native JSON schema and `thinking_level=low`; the provider returned HTTP 503 `UNAVAILABLE`, so no full run was started. `grok-4.6` is supported by the official xAI image and structured-output APIs, but no authenticated xAI credential was present in the execution environment, so no request was sent and no full run was started. Both outcomes are recorded as blocked canaries; existing Gemini/GLM results were not rerun. See `evidence/2026-08-30-gemini37-grok46-canary-comparison.json` and `evidence/2026-08-30-gemini-3.7-flash-canary-v1.json`.

The follow-up Cloudflare recovery diagnostic verified that the account's `default` Gateway already exists. Google AI Studio and Grok Provider Keys are unconfigured, while Cloudflare documents both as Unified Billing providers. The runner now supports the verified existing `default` Gateway, Gemini 3.7's supported `low` thinking level, Cloudflare Unified Billing model prefixes, and provider-native Google/xAI Gateway transports. Cloudflare Unified Billing returned HTTP 404/code 7003 for both new model IDs, showing that they are not yet in that REST catalog. The provider-native Google path then returned HTTP 401/code 2009 because a dedicated AI Gateway token is required; the existing Wrangler OAuth token is not interchangeable. No final content or usage was returned and no full run started. Luna was also re-canaryed with the verified `default` Gateway and reproduced HTTP 402/`invalid_prompt`, proving that its blocker is a separate provider/account entitlement or Responses payload boundary rather than the previous Gateway guard. See `evidence/2026-08-30-cloudflare-gateway-model-recovery-diagnostic-v1.json`, `evidence/2026-08-30-luna-verified-default-gateway-canary-v2.json`, and their linked canary reports.

After explicit billing authorization, a least-privilege `AI Gateway Run` token named `zukan-model-bench-20260830` was created for the existing account. The agent did not read, copy, log, or persist the token value; the one-time display remains open in the authenticated Chrome handoff tab. A fresh direct Gemini 3.7 canary still returned HTTP 503 `UNAVAILABLE`, so no full run was started. Provider-native Gemini/Grok canaries remain gated only on placing the displayed token into the current local process as `CLOUDFLARE_AI_GATEWAY_TOKEN`; Grok also requires non-zero Unified Billing credit. See `evidence/2026-08-30-ai-gateway-token-handoff-gemini-direct-v2.json`.

The exposed first token was revoked and replaced by least-privilege token `zukan-model-bench-20260830-r2`; its value was transferred locally through a Windows DPAPI-encrypted scratch file and was never committed or logged. Cloudflare provider-native Gemini 3.7 then passed its canary and ran all seven fixed posts once: 6/7 request/schema success, p50/p95 12,991/14,989ms, 71,010/284 input/output tokens, estimated USD 0.0543225, and six complete raw final outputs. `record-1784430118720` received one provider 503 `UNAVAILABLE` and was not retried. After a paid Cloudflare credit top-up, Grok 4.6 still returned provider-native HTTP 401 before model output, proving that this route requires an active xAI provider key rather than only AI Gateway credit. See `evidence/2026-08-30-gemini37-cloudflare-final-grok-auth-gate-v1.json` and its linked reports.

The separate xAI account had zero credit and required an additional provider-side payment. That purchase was cancelled before any charge or API-key creation. The user declined separate xAI billing, so Grok 4.6 is closed as `ABORTED_SEPARATE_BILLING`; its full run was never started. The existing Cloudflare AI Gateway credit remains available for models currently supported by Cloudflare's catalog. See `evidence/2026-08-30-grok-aborted-separate-xai-billing.json`.

The 2026-08-30 resolution experiment kept the same seven posts, ordered 21 source images, dataset SHA, prompt SHA, and canonical rights, while recording deterministic 1024px transmission derivatives separately from the immutable source identities. Gemini 3.5 Flash-Lite physical resizing at default media resolution did not reduce input tokens and produced 6/7 schema-valid outputs. Gemini 3.5 Flash-Lite with `media_resolution=medium` reduced input tokens by 13.28% but also produced 6/7 schema-valid outputs and cost more because output tokens expanded. Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash` stayed 7/7 schema valid and reduced input tokens by 43.10% and estimated cost by 25.76%, but p95 latency rose to 104,051ms and the key Bidens/Acalypha/blurred-bird weaknesses remained. No production image or model setting changed. See `evidence/2026-08-30-1024-resolution-comparison-v1.json` and `.md`.

The benchmark full-run loop used for that Evidence is intentionally simple and sequential; it is not the production ZUKAN execution design. Production uses the `ikimon-prod-media-jobs` Cloudflare Queue, autoscaling consumer invocations, and Gemini provider batch jobs. The benchmark runner now also preserves valid final JSON when sensitive values or private-reasoning fields are present by removing only those fields/values instead of discarding the whole final output.
