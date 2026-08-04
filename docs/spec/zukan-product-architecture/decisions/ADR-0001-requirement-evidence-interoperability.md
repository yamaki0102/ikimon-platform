# ADR-0001: Requirement evidence interoperability

- Status: accepted
- Date: 2026-08-03
- Scope: source-only Product Registry contract

## Context

ZUKAN already owns stable requirement IDs and acceptance meaning, while the cross-repository Universal Outcome Resolver owns evidence collection and resolved truth. Machine tests alone cannot represent visual quality or named human acceptance, and invalidating all evidence for every source change discards valid independent evidence.

## Decision

Each Product Registry requirement declares:

- the required evidence lanes: `machine`, `design`, or `human`
- the applicable Verification Ladder levels
- stable product dependency keys used for selective invalidation

The normal Product Registry loader validates these declarations and their quality/journey references. Central Claim IDs, Collector authority, exact-SHA/freshness policies, evidence digests and resolved states remain exclusively in the shared resolver.

## Consequences

- Product changes can invalidate only evidence whose declared dependencies intersect the change set.
- Design and human acceptance remain explicit and independently auditable.
- Product Registry cannot claim completion or release readiness.
- No runtime route, database, secret, DNS, permission, production state or customer communication changes.

## Rollback

Revert the requirement fields, loader validation, tests and this ADR. No runtime or data rollback is required.
