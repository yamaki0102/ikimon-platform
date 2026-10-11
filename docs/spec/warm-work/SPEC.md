# ZUKAN Warm Work Profile v1

- Status: CANDIDATE
- Effective date: 2026-08-18 JST
- Product authority: `docs/spec/zukan-product-architecture/SPEC.md`
- Shared Work Fabric authority: `yamaki0102/all-projects-management/operations/work_fabric/WARM_WORK_ARCHITECTURE_v1.md`
- Shared receipt: `nexus.work-fabric.warm-work-receipt/v1`

## 1. Purpose

ZUKAN adopts the shared Warm Work architecture to reduce repeated repository/context loading, dependency setup, build/test work, and AI context while keeping the existing product, Evidence, rights, review, and release boundaries unchanged.

Warm Work is a development/execution optimization layer. It does not redefine ZUKAN Knowledge Core objects or turn cached implementation evidence into domain truth.

## 2. Project flow

```text
Work Object
  -> exact GitHub baseline
  -> isolated Cloudflare Artifacts work repository
  -> ZUKAN task Context Pack
  -> replaceable executor (NEXUS / ARK / Sandbox / other admitted executor)
  -> warm dependency/toolchain restore where eligible
  -> change
  -> affected validation + required fresh validation
  -> independent receipt/read-back
  -> GitHub PR/promotion
  -> existing Release Commander lane
```

The executor may change without restarting repository understanding from zero. Resume state comes from the tracked Work Object, Artifacts identity, Context Pack, and Evidence receipts rather than untracked local machine state.

## 3. ZUKAN Context Pack

The Context Compiler should select only task-relevant material. Common inputs include:

- `docs/spec/zukan-product-architecture/SPEC.md` product invariants;
- `docs/START_HERE.md` active implementation guidance;
- `platform_v2/AGENTS.md` agent/runtime rules;
- relevant Domain Pack contracts;
- affected routes/components/services;
- relevant schema/API contracts;
- affected tests and known failure signatures;
- current Work blocker/evidence references.

A frontend-only task should not receive unrelated Knowledge Core/domain history by default. A rights/review/domain task should receive the applicable semantic and safety contracts even if the changed code surface is small.

Every Context Pack is digest-bound to source, compiler version, policy/safety inputs, and task class.

## 4. Initial cache targets

### Source delta

Reuse baseline/tree identity and changed-path mapping so a new executor can inspect the delta first.

### Dependency/build

Key rebuildable caches by all correctness-relevant inputs, including lockfile, runtime/toolchain, build configuration, and platform where applicable.

High-value targets include `platform_v2` install/build/test setup and browser-test dependencies.

### Executor snapshot

Use sanitized warm executor/sandbox snapshots for common ZUKAN development toolchains. Snapshots must contain no durable raw secrets, customer/private data, or release authority.

### Context Pack

Cache product/domain/task-scoped compiled context when its source/policy/compiler identities match.

### Evidence reuse

Reuse only assertions proven unaffected by the change and verified by a fresh reuse receipt. Release, security, rights, migration, and fresh external-state assertions may declare themselves non-reusable.

## 5. Impact map

Maintain a machine-readable mapping from changed areas to minimum validation obligations.

Initial categories should cover at least:

- UI/component/style change;
- route/API contract change;
- authentication/authorization change;
- Record/Claim/Evidence/rights/review semantics;
- Domain Pack behavior;
- persistence/schema/migration;
- publication/export;
- release/runtime configuration.

The impact map may reduce unnecessary tests but cannot suppress a required security/safety/release gate.

## 6. Knowledge and Evidence boundary

ZUKAN domain Evidence is first-class product truth with provenance/rights/review semantics. Warm Work Evidence is execution/verification evidence for software Work.

They may reference each other where useful, but they are not interchangeable.

A cached passing software test does not establish a Claim, Review, Rights decision, specialist diagnosis, or Publication eligibility inside ZUKAN.

## 7. Reusable-pattern promotion

Repeated implementation patterns may be promoted through:

`Work-local -> ZUKAN reusable component/test/tool -> shared product-neutral Skill/Pack/Core`

Candidate areas include:

- accessible input/review patterns;
- publication/export pipelines;
- import mapping/conformance tooling;
- map/timeline/view components;
- Domain Pack scaffolding;
- safe AI-candidate/review workflows.

Promotion requires tests and removal of ZUKAN-specific assumptions before becoming cross-product shared infrastructure.

## 8. Metrics

Compare cold vs warm Work for:

- time to first meaningful change;
- time to verified candidate;
- model input/output tokens where available;
- Context Pack size/token estimate;
- install/build/test time;
- cache hit/miss/reject/bypass;
- Evidence reused/fresh counts;
- handoff/resume success;
- estimated model/execution cost.

A speedup is accepted only if safety/product/release gates are unchanged or stronger.

## 9. Release boundary

- Artifacts is not the canonical release source.
- Cache keys/snapshots/model results are not release authority.
- Durable code is promoted to GitHub and identified by exact commit.
- Canonical byte/evidence SHA-256 requirements remain unchanged.
- Release Commander remains the formal staging/production release authority.
- No production mutation is implied by Warm Work adoption.
