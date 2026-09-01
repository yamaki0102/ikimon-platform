# ZUKAN Vision 1024px resolution comparison

Fixed input: 7 posts / 21 images, dataset `db98e2a6bd16f0cb3cf9b856dd54472d22760771d970572a3dead7bd99cfbfff`, prompt `6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9`. Canonical rights passed 7/7 immediately before each provider run. Retry and fallback were zero.

The source images were mostly 1600×2133 (18/21) with three 1200×1600 images. The deterministic 1024px JPEG derivatives reduced transmitted bytes from 10,598,046 to 3,674,980 (-65.32%). Original image SHA-256 values remain the dataset identity; derivative image/post SHA-256 values are recorded separately in each run.

## Operational result

| Exact model and input | success/schema | p50/p95 | input/output tokens | estimated USD | delta vs original |
|---|---:|---:|---:|---:|---|
| Gemini 3.5 Flash-Lite, original/default | 7/7, 7/7 | 2,582 / 4,831ms | 82,845 / 2,238 | 0.0304485 | baseline |
| Gemini 3.5 Flash-Lite, 1024px/default | 7/7, 6/7 | 2,578 / 7,496ms | 82,845 / 3,290 | 0.0330785 | input 0%; cost +8.64% |
| Gemini 3.5 Flash-Lite, 1024px/medium | 7/7, 6/7 | 5,155 / 7,272ms | 71,841 / 6,805 | 0.0385648 | input -13.28%; cost +26.66% |
| Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash`, original | 7/7, 7/7 | 53,996 / 64,073ms | 153,402 / 26,359 | 0.0361898 | baseline |
| Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash`, 1024px | 7/7, 7/7 | 81,288 / 104,051ms | 87,288 / 27,551 | 0.0268687 | input -43.10%; cost -25.76% |

Gemini 3.5 Flash-Lite allocates image tokens by media-resolution tier. Physical resizing to 1024px while leaving media resolution at default did not reduce input tokens. Explicit `medium` reduced input tokens, but one output ran to the 2,048-token cap and total output grew enough to make the run more expensive.

Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash` did respond to the smaller physical images: input tokens and estimated cost fell materially. It was nevertheless slower in this sample, and its reference-relative content did not show a clear net improvement.

## Reference-relative reading

`NOAH_MAX_READ_V1` is used only as a high-resolution visual reference, not human gold.

| visitId | Gemini 3.5 Flash-Lite 1024px/default | Gemini 3.5 Flash-Lite 1024px/medium | Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash` 1024px |
|---|---|---|---|
| `record-1784366489892` | invalid JSON | Erigeron-like genus; aligned but very noisy | Erigeron-like genus; aligned |
| `record-1784430741938` | Oxalis genus; conservative/aligned | Oxalis genus; conservative/aligned | Oxalis genus; conservative/aligned |
| `record-1781252770584` | Scarabaeidae family; aligned | Scarabaeidae family; aligned | scarab genus; parent direction aligned but overprecise |
| `record-1784430374598` | Acalypha hispida species; overprecise for dwarf complex | invalid JSON | Acalypha hispida species; overprecise with nomenclature noise |
| `record-1784430118720` | Rubus genus; target miss | Rubus species rank; target miss and overprecision | Rosa genus; target miss |
| `record-1784431188621` | Passer montanus species; aligned | Passer montanus species; aligned | Passer montanus species; aligned |
| `record-1784430530197` | Pycnonotidae family with Hypsipetes comparison; restrained and closer | thrush/starling alternatives; weak direction | Passer genus; restrained but target miss |

The decisive Bidens post remained a miss in all three 1024px arms. The small developing head, peduncle, and bract-like structures were not integrated correctly. The dwarf Acalypha case also remained vulnerable to `A. hispida` overprecision. There is therefore no evidence that 1024px improves reading quality, and the sample does not prove biological accuracy equivalence.

## Production decision

Verdict: `NO_CLEAR_QUALITY_GAIN`. Keep the current production image-resolution behavior for now.

- Gemini 3.5 Flash-Lite 1024px/default saves transfer bytes but not model input tokens and reduced schema reliability in this run.
- Gemini 3.5 Flash-Lite 1024px/medium reduced input tokens but increased latency, output tokens, and total cost.
- Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash` 1024px reduced estimated inference cost, but remained much slower and did not resolve the key visual misses.

Production ZUKAN is not using the benchmark's serial loop. Fresh Cloudflare read-back showed `ikimon-prod-media-jobs` with batch size 25 and no fixed `max_concurrency`, so Cloudflare autoscaling remains enabled. The Worker groups AI reassessments into provider batch jobs of up to 10 posts and drains backlog every five minutes. D1 read-only state at inspection time was completed 31, failed 7, pending 0, processing 0.

## Evidence caveat and repair

Gemini 3.5 Flash-Lite stored raw final content for all 14 full-run outputs across the two 1024px arms. The Cloudflare Workers AI `@cf/zai-org/glm-5.3-flash` 1024px full run stored raw final content for 2/7 posts; five outputs triggered the previous all-or-nothing sensitive-output guard. Their parsed score fields were retained, but the discarded raw text cannot be reconstructed without a prohibited retry. The runner has been repaired prospectively to remove only sensitive values and private reasoning fields while preserving the rest of valid final JSON.
