# External review adoption

- task: `ikimon-record-observation-prb-20260721`
- Claude model used: `claude-opus-4-8`
- Gemini model used: `gemini-3-flash-preview` (`gemini-3.5-flash` timed out)
- review scope: design document; neither reviewer independently proved the final migration implementation

## Adopted

- `source_key` and `operation_key` are non-null idempotency anchors.
- PostgreSQL and D1 enforce UUID shape/parity, confidence bounds, JSON validity/size and partial uniqueness.
- accepted claims and active projections are constrained to the same observation.
- human provenance is required before assertion/verification/scope/acceptance promotion.
- research eligibility references a consent lifecycle event.
- canonical JSON and SHA-256 digest rules are explicit.
- public serializers remove high-precision locators and original-media metadata by default.

## Rejected or refined

- Rejected the literal rule `origin='ai'` can never become `human_asserted`. The product contract permits an AI-created provisional observation to be promoted by a later auditable human transition. The database instead requires non-AI reviewer identity and timestamp for every elevated state.
- Deferred outbound withdrawal propagation for already distributed external research copies. It belongs to projection/export rollout, not additive schema apply, but must be resolved before research export is enabled.
- Deferred sockpuppet/trust weighting details to the shared authorization/consensus evaluator phase; AI remains structurally excluded from human claims.

## Still unverified

- final implementation review after local corrections;
- D1 transaction behavior under concurrent writers;
- rendered privacy scan and 100-record shadow comparison;
- approved production/staging migration lane.
