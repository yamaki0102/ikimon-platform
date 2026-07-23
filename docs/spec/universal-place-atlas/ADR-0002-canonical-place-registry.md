# ADR-0002: expand the existing place registry into the canonical Place domain

Status: accepted

Date: 2026-07-23

Parent issue: #1421

## Context

Place Atlas v1 resolves an `observation_field`, live OSM way/relation, or public
cell directly. That is sufficient for a park profile but cannot preserve one
identity across OSM replacement, field registration, aliases, boundary
versions, or a Place → Zone → Spot hierarchy.

The platform already has PostgreSQL `places`, `place_boundaries`,
`observation_fields`, Place Memory, guide/activity data, and a Cloudflare D1
production read runtime. A separate CMS or another top-level place table in
PostgreSQL would duplicate responsibility.

## Decision

1. Expand PostgreSQL `places` and `place_boundaries`.
2. Add normalized supporting tables for aliases, source references,
   relationships, multi-place Record membership, themes, policy, sourced
   content, corrections, and merge audit.
3. Project the same meaning contract into the observation D1 database for the
   Cloudflare-native runtime.
4. Keep `observation_fields` as a boundary/profile source and connect it through
   `place_source_references`.
5. Keep Place Atlas v1 and add a v2 read contract. The v1 adapter remains the
   fallback and rollback path.
6. Allocate internal Place IDs independently of OSM. Source-ref resolution and
   merge audit preserve the ID when OSM objects split or are replaced.
7. Treat policy as sourced data. OSM access is not photography or publication
   permission.
8. Use additive migrations and a default-off rollout flag. Forward rollback
   disables the v2 read/backfill path; it does not delete schema or evidence.

## Rejected alternatives

### Use OSM way/relation ID as Place ID

Rejected because OSM objects can be redrawn, split, merged, or retagged.

### Reuse `observation_fields.field_id` as the only Place ID

Rejected because not every public place is a managed field, and one canonical
place can have both a field and several source boundaries.

### Add every new property to `observation_fields.profile_payload`

Rejected because memberships, aliases, relationships, source history, and
themes need independently queryable audit and lifecycle state.

### Build a new Place CMS

Rejected because existing field/admin controls and normalized source tables are
enough for the first complete slice. The correction queue provides a bounded
review surface.

### Infer recording permission from OSM access

Rejected because access describes entry, not photography, publication,
commercial use, privacy, or attraction-specific restrictions.

## Consequences

- Both PostgreSQL and D1 migrations must maintain semantic parity.
- Read paths need schema-capability checks during expand-first rollout.
- Backfill is explicit, dry-run first, idempotent, and versioned.
- Public projections must translate internal precision into place/zone/cell
  precision.
- Source conflict remains visible instead of being overwritten.
- A later admin UI can extend existing field management without changing the
  canonical contract.
