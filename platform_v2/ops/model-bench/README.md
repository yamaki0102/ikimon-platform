# ZUKAN Model Bench

Status: source implementation. `zukan-post-model-bench-v2` supersedes the earlier image-per-fixture draft.

## Goal

Compare current and future vision models on the smallest useful fixed ZUKAN dataset, using exactly the same posts, the same ordered photo sets, and the same prompt.

## Dataset size

- Core: **24 posts**.
- Smoke: **the first fixed 8 posts of that same Core manifest**.
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

## Commands

Run from `platform_v2`.

Freeze the fixed 24-post Core dataset:

```bash
npx tsx src/scripts/zukanModelBench.ts freeze
```

The command refuses to overwrite an existing v2 manifest. A new dataset requires a new version/path rather than re-sampling the old one.

Rights-vet the same frozen posts:

```bash
npx tsx src/scripts/zukanModelBench.ts vet-rights \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.json
```

This writes `ops/model-bench/fixtures/zukan-public-post-core-v2.external.json`.

Smoke test a model on the fixed first 8 posts:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npx tsx src/scripts/zukanModelBench.ts run \
  --model=gemini:gemini-3.5-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json \
  --limit=8
```

Core baseline uses all fixed 24 posts:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npx tsx src/scripts/zukanModelBench.ts run \
  --model=gemini:gemini-3.5-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json
```

Run Cloudflare Workers AI GLM-5.3-Flash on that exact same manifest:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_API_TOKEN=... \
npx tsx src/scripts/zukanModelBench.ts run \
  --model=openai-compatible:@cf/zai-org/glm-5.3-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-post-core-v2.external.json \
  --input-usd-per-1m=0.15 \
  --output-usd-per-1m=0.50 \
  --pricing-source=cloudflare-workers-ai-2026-08-27
```

Compare reports with the first report as baseline:

```bash
npx tsx src/scripts/zukanModelBench.ts compare \
  --reports=ops/model-bench/reports/baseline.json,ops/model-bench/reports/challenger.json
```

Verdict: `KEEP`, `SWITCH`, `REJECT_CHALLENGER`, or `INSUFFICIENT_GOLD`.
