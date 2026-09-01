# ZUKAN Vision mechanism hardening

Status: `SOURCE_VERIFIED_NOT_DEPLOYED`

Existing 7-post / 21-image Evidence remains immutable. No model was rerun, canonical rights were not changed, and production was not deployed.

## 1. Compact structured output

The new `compact-v2` contract gives each kind of information its own bounded field instead of allowing prose inside the taxon name.

- Prompt: `observation-reassess-post-compact-v3`
- Prompt SHA: `ba51fce67c344e7555198bb2c01a31feff7dbfe9dc45e0794b4f9c96384167d6`
- Output schema SHA: `294cfb4a8cbeeb9353b584937fcfb0000ee746d46f693dcadb79bfcee052a11f`
- Taxon name: name only, local maximum 120 characters
- Candidates: maximum 4
- Observed/missing/uncertain feature arrays: maximum 8/8/6
- Extra fields: rejected

Reports store the output contract and schema SHA. Comparisons now stop when output contracts differ, even when the dataset and prompt happen to match.

The frozen `zukan.earth` derived URL redirected to Cloudflare Access before the first model request. The runner now permits an explicit fetch-origin override while retaining the frozen URL in the manifest and refusing any bytes that do not match the original image SHA. The measured run used the same production Worker at `ikimon-life-cloudflare-prod.yamaki0102.workers.dev`; request config records that retrieval origin.

## 2. Canary-gated parallel full run

The full runner supports bounded concurrency while preserving manifest order. Concurrency greater than one requires an exact successful one-post canary report matching model, dataset, prompt, output contract, and schema SHA. Before dispatch, twice the measured canary cost multiplied by the full fixture count must fit the explicit cost cap. Recommended fixed-seven setting is three concurrent requests. Retry and fallback remain zero.

Measured Gemini 3.5 Flash-Lite compact-v2 result:

- Canary: 1/1 success/schema, 2,894ms, 3,546/232 tokens, $0.0016438
- Full: 7/7 success/schema, p50/p95 2,812/2,937ms, 24,822/1,706 tokens, $0.0117116
- Full wall time with concurrency 3: 8,530ms
- Delta from the historical Gemini 3.5 Flash-Lite baseline: input -70.04%, output -23.77%, cost -61.54%, p95 -39.21%, wall time -65.15%
- Raw final content: 7/7 saved

This new prompt/output contract is not mixed into the historical comparison. Reference-relative quality improved on Acalypha stopping rank and retained concise diagnostic fields, but the Bidens/Rubus miss remained and the blurred bird returned a semantic `Aves`/family-rank mismatch. Verdict: `OPERATIONAL_IMPROVEMENT_QUALITY_NOT_PROVEN`.

## 3. Adaptive image resolution

The existing production specialist escalation is reused rather than adding another classifier.

- primary/census/environment: `MEDIA_RESOLUTION_MEDIUM`
- conditionally escalated specialist: `MEDIA_RESOLUTION_HIGH`
- summary: no image input

The runtime default remains `current`. `adaptive-medium-high` is only available behind `AI_OBSERVATION_MEDIA_PROFILE` for a separately governed staging canary; this source change does not alter production behavior.

## 4. Queue durability and operator recovery

Source configuration adds dedicated DLQs for shadow, staging, and production media queues, keeps Cloudflare automatic concurrency, and makes three retries explicit. The existing admin Monitoring Workspace reads a new aggregate-only health endpoint showing pending, processing, failed, stale, recent-failure, and exhausted counts without returning observation identities.

A same-origin, admin-only requeue endpoint resets one failed standard reassessment with compare-and-swap protection, preserves prior failure metadata, writes the existing outbox shape, and dispatches through the existing `MEDIA_QUEUE`. It does not change rights or accepted identification.

Fresh pre-deploy runtime read-back remained: completed 31, failed 7, pending 0, processing 0; production queue had no DLQ yet. Activation requires a later governed Worker deployment and read-back.

## Verification

- Related tests: 63/63 PASS
- TypeScript typecheck: PASS
- Wrangler production dry-run: PASS
- Production deploy: not run
- D1/rights mutation: zero
- Model inference: 8 requests on the new compact-v2 contract only; historical reports were not rerun
