# ADR-0002: specialist capability reuse before category recreation

Status: accepted candidate for PR #1686
Date: 2026-09-07

## Context

ZUKAN needs participation, spatial, publishing and operational capabilities around its Core Loop, but mature specialist products already cover deep GIS, booking, surveys, workflow automation, notifications, CMS administration, commerce and credential infrastructure.

Rebuilding those categories inside ZUKAN would increase code, operating cost and UI complexity without strengthening ZUKAN's differentiated public-commons semantics.

## Decision

Keep ZUKAN-owned semantics limited to Record/Place/Area public knowledge, contributor capture and return, AI-candidate versus verified truth, Review, rights/consent/correction/withdrawal, public discovery and ZUKAN-specific participation continuity.

When a journey requires a mature specialist category, reuse a current specialist/native engine and add only the ZUKAN-specific adapter/delta. `SPECIALIST_CAPABILITY_ROUTING_2026-09-07.md` records the current candidates and routing; `PLAN.md` remains the implementation-sequence authority.

## Consequences

- Do not build a general GIS editor, booking/waitlist engine, survey builder, workflow builder, notification transport, CMS platform, commerce core or credential infrastructure.
- Specialist engines remain replaceable and do not become canonical ZUKAN truth.
- Public map/capture/discovery UX remains ZUKAN-owned where it is part of the Core Loop.
- Provider selection is runtime/configuration evidence, not a new product ontology.
- A candidate provider may change when license, API, cost, rights or product fit changes.

## Rejected alternatives

- Build each capability directly in ZUKAN: rejected as unnecessary category recreation.
- Expose specialist admin UIs as the ZUKAN product: rejected because it breaks contributor-first UX and product identity.
- Standardize one vendor for all categories: rejected because it creates avoidable lock-in and conflates unrelated capabilities.