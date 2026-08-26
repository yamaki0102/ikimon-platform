# ZUKAN Model Bench

Status: source implementation. No paid model call or production mutation is performed by this repository change.

## Goal

Compare current and future vision models on exactly the same ZUKAN observation image bytes. Quality is gated before price or latency.

## Fixture policy

- Discover candidates only from ZUKAN's production public observation surface.
- Reuse the existing public observation quality gate/resolver; do not query private posts for benchmark discovery.
- Freeze each source image by URL, MIME, byte length, and SHA-256. Every model run re-fetches the image and aborts if the bytes no longer match.
- Do not commit image bytes to Git. The manifest contains references and hashes only.
- Freeze the benchmark prompt together with the manifest and verify its SHA-256 on every run.
- Hide existing label, exact location, observer identity, and profile context from the model prompt so the test measures the image model rather than metadata leakage.
- Treat only human-backed `community_consensus` / `authority_reviewed` or an equivalent durable public identified state as gold. Existing AI output is never gold.
- Public labels without verified human consensus are retained only for review and do not affect automatic model switching.
- Public visibility is not permission to send media to a new AI provider. Before any model run, create a rights-vetted manifest. Only observations whose canonical `ObservationDataRights.externalExportAllowed` resolves to true and whose withdrawal state is active remain eligible.
- A frozen dataset is immutable. Rights vetting creates a separate `.external.json` manifest; it does not overwrite the public-source snapshot.
- If rights, source identity, image bytes, or benchmark policy changes, create a new dataset version and rerun every compared model.

## Hard gates

A challenger is ineligible when any of these fail:

- request success rate >= 99%
- core JSON schema valid rate >= 99%
- critical failure rate <= 2%
- at least 10 human-consensus gold fixtures before automatic switching

Critical failures include high-confidence wrong species on a human-gold fixture and asserting a precise location in the cold-start test where no location was provided.

Quality is ranked first. Cost and p95 latency are tie-breakers only when quality is within one percentage point.

## Commands

Run from `platform_v2`.

Freeze 80 public ZUKAN images and the current production reassessment prompt. This is read-only against the public site and does not send images to an AI provider:

```bash
npx tsx src/scripts/zukanModelBench.ts freeze --count=80
```

In a read-only runtime connected to the canonical production rights database, produce the externally-processable subset:

```bash
npx tsx src/scripts/zukanModelBench.ts vet-rights \
  --manifest=ops/model-bench/fixtures/zukan-public-core-v1.json
```

This writes `ops/model-bench/fixtures/zukan-public-core-v1.external.json`.

Run the current visual baseline on that exact rights-vetted manifest:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
npx tsx src/scripts/zukanModelBench.ts run \
  --model=gemini:gemini-3.5-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-core-v1.external.json
```

Run Cloudflare Workers AI GLM-5.3-Flash on the same manifest after the external-provider/cost boundary is intentionally enabled:

```bash
ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING=1 \
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_API_TOKEN=... \
npx tsx src/scripts/zukanModelBench.ts run \
  --model=openai-compatible:@cf/zai-org/glm-5.3-flash \
  --manifest=ops/model-bench/fixtures/zukan-public-core-v1.external.json \
  --input-usd-per-1m=0.15 \
  --output-usd-per-1m=0.50 \
  --pricing-source=cloudflare-workers-ai-2026-08-27
```

Compare reports, with the first report treated as the baseline:

```bash
npx tsx src/scripts/zukanModelBench.ts compare \
  --reports=ops/model-bench/reports/baseline.json,ops/model-bench/reports/challenger.json
```

The comparison verdict is one of `KEEP`, `SWITCH`, `REJECT_CHALLENGER`, or `INSUFFICIENT_GOLD`.
