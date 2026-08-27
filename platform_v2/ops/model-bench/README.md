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

The seven-post run has no human-consensus gold. The final verdict is therefore `INSUFFICIENT_GOLD`; no model adoption decision is made. See the latest Evidence summary and its linked per-model reports for the measured comparison and the exact gold shortage.

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

All three canaries used Cloudflare authentication and official REST endpoints, with one request, no retry, no fallback, `stream=false`, and the same native ZUKAN output schema. Because no new model passed canary, no expanded model completed a seven-post run. Existing Gemini and GLM reports remain the only full-run comparison inputs; the verdict remains `INSUFFICIENT_GOLD`. Cloudflare's `openai/gpt-5.6-luna` route uses the Responses API and does not require a local OpenAI API key.

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
  --model=gemini:gemini-3.5-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json \
  --limit=8
```

Core baseline uses all fixed 24 posts:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npm run bench:zukan -- run \
  --model=gemini:gemini-3.5-flash \
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

Compare reports with the first report as baseline:

```bash
npm run bench:zukan -- compare \
  --reports=ops/model-bench/reports/baseline.json,ops/model-bench/reports/challenger.json
```

The legacy `decision` field remains for compatibility. Current Gemini-vs-GLM Evidence uses the governed `finalVerdict`: `KEEP_GEMINI`, `SWITCH_TO_GLM`, `INSUFFICIENT_GOLD`, or `BASELINE_INVALID`. The last state explicitly approves no model.
