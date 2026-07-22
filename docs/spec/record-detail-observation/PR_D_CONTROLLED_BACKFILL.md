# PR-D: observation-first controlled backfill

## Scope

The backfill reads only the Cloudflare D1 compatibility tables and writes only the additive observation-first tables introduced by migration `0067_record_observation_foundation.sql`.

- `observations` becomes one owner/human-asserted observation per record.
- `asset_ledger` is linked to that owner observation only when both the parent record and owner match.
- `observation_identifications` becomes candidate claims. `is_current` is retained as source evidence and never becomes `accepted` by inference.
- `observation_ai_review_targets` becomes an independent AI/provisional observation. It never becomes human-asserted, accepted, or an active occurrence projection.
- explicit rights consent controls record proposal policy; withdrawn or private records reject external identification proposals.
- missing parents and owner mismatches are written to the consistency ledger as `quarantined` instead of being guessed.

The mapping rule is `record-observation-backfill/v1`. Stable source keys, deterministic UUIDs, SHA-256 source/target digests, and `ON CONFLICT` guards make the operation replayable.

## Snapshot contract

Create a temporary JSON object with these arrays. Do not include coordinates, cell IDs, geohashes, object keys, notes, session data, or secrets.

```json
{
  "observations": [],
  "assets": [],
  "identifications": [],
  "aiTargets": []
}
```

The selected columns are the TypeScript row contracts in `cloudflareObservationBackfill.ts`. Rights are joined to `observations` with `observation_data_rights.visit_id = observations.observation_id`; AI targets and identifications use the canonical `occ:<record-id>:<index>` relation.

## Build and execute

1. Run the builder without a mutation flag. It produces immutable numbered SQL batches and a report containing only counts and hashes.
2. Inspect the report, batch digests, and quarantine classification.
3. Execute the numbered files in order with `wrangler d1 execute <registered-db> --remote --file <batch>`.
4. Re-run the same snapshot and batches once. Counts must not grow except ledger attempt counters.
5. Verify `PRAGMA foreign_key_check`, source/target counts, duplicate source keys, accepted claims, active projections, and provenance separation.

```powershell
npm --prefix platform_v2/cloudflare_shadow run build:record-observation-backfill -- `
  --input <temporary-snapshot.json> `
  --output-dir <temporary-batch-directory> `
  --report <evidence-report.json> `
  --batch-size 200
```

## Required postconditions

- owner observation count equals compatible record count.
- active media links equal eligible asset count; every skipped asset has a quarantine reason.
- legacy identification count equals candidate claim count plus quarantine count.
- legacy AI target count equals provisional AI observation count plus quarantine count.
- accepted identification count created by this backfill is zero.
- active occurrence projection count created by this backfill is zero.
- every matched ledger row has source and target SHA-256 digests.
- every quarantined ledger row has a bounded machine-readable reason.
- `PRAGMA foreign_key_check` returns zero rows.

## Rollback

The runtime reader and writer flags stay off while backfill runs. Rollback is flag-only: keep the additive rows, stop further backfill/dual-write, and continue serving the compatibility reader/writer. Do not run a destructive reverse migration.
