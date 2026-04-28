# Curator Model Bakeoff 2026-04-29

Manual command:

```bash
CURATOR_MODEL_BAKEOFF=1 npm run bakeoff:curator
```

Fixtures:

- invasive-law HTML: 10
- redlist sample: 10
- paper metadata/abstract: 10
- satellite/STAC JSON: 10
- total: 40

Result:

| Provider | Model | Critical failures | Schema valid | Field accuracy | Avg cost |
|---|---|---:|---:|---:|---:|
| gemini | gemini-3.1-flash-lite-preview | 0 | 100% | 100% | $0.00017987 |
| deepseek | deepseek-v4-flash | 89 | 50% | 57% | $0.00008214 |

Decision:

Gemini 3.1 Flash-Lite Preview remains the curator default.

Reason:

DeepSeek V4 Flash was cheaper on this fixture set, but it failed required
field extraction and enum validation frequently enough that it did not meet
the Sprint 7 adoption threshold.
