# IKIMON Debug Fabric Phase 1

Date: 2026-08-02

## Decision

Extend the existing Release Commander, Command Bus, and Sandbox Executor instead of creating a second release system or running heavy tests on the Pixel.

The Pixel remains the chat, review, and notification terminal. Deterministic execution runs in an isolated container. Shared staging provides the final exact-runtime proof.

## This slice

`platform_v2/tools/debug-fabric/` implements the first read-only authoritative runner:

- strict `ikimon.debug-run/v1` contract;
- exact SHA and runtime identity checks;
- staging-only host boundary;
- read-only HTTP probes;
- evidence minimisation and secret-leak protection;
- ZUKAN private/public boundary profile;
- deliberate red proof.

## Next slices

- private Executor-only persona/session issuance;
- `debug_run_id` lease, resource ledger, cleanup, and residue blocking;
- default-deny side-effect sink;
- signed Command Bus dispatch and Release Commander evidence indexing;
- failure-only Pixel Opus analysis;
- browser checks in Executor containers only.
