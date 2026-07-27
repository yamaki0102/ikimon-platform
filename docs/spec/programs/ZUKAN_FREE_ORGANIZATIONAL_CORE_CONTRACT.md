# ZUKAN Free Organizational Core Contract

Status: accepted strategy constraint / implementation pending

Date: 2026-07-27

Parent issue: #1461

Strategy source:

- `yamaki0102/ikimon-business-strategy@860bea0a1382f0a754fd2d7d4b5f8350f3d3d82e`
- `decisions/2026-07-27-zukan-organizational-core-free.md`
- `strategy/zukan-free-organizational-core.md`

## 1. Decision

ZUKAN organizational use is not a separate paid SaaS tier.

The following capabilities are standard ZUKAN product capabilities and must be implementable without a paid-plan entitlement:

1. Program participants and teams
2. Quest and mission creation and participation
3. Draft, program-only, restricted, and public visibility separation
4. Participant and guardian consent records
5. Review, correction, hold, approval, and rejection history
6. Cross-year continuation and handover
7. Basic organizational reporting and export
8. Publication into a regional View after safety, rights, and review gates

The internal aggregate is `Program`. Human-facing labels may be activity, team, editorial group, project, class, event, or another context-appropriate term. `Workspace` must not become a paid-tier boundary in the domain model.

## 2. Non-negotiable invariants

- No per-seat entitlement is required for the eight capabilities.
- Team, Quest, standard Review, handover, basic report, basic export, and normal regional View publication are not premium-only states.
- Safety features such as consent, visibility control, correction, and Review cannot be paywalled.
- Authorization is based on role, responsibility, consent, and data policy, not payment status.
- Organization-specific databases or duplicated Place/Record data are not created for normal use.
- Programs use the shared Place Graph and shared Record/Evidence contracts.
- Program-private data and regional public projections are separate.
- Users can export their basic organizational data without an active paid service contract.
- AI is optional; the core Program flow must work without AI processing.

## 3. Paid service boundary

The product may charge for work or resources outside the standard self-service contract:

- planning, setup, training, facilitation, and ongoing administration
- field staff, equipment, and physical operations
- specialist review, official confirmation support, audit, SLA, and warranty
- customer-specific workflow, screen, form, report, SSO, domain, or system integration
- bulk migration and dedicated environment
- exceptional storage, video delivery, AI computation, or API volume
- FDE, monitoring, canonical writeback support, and managed operations

Payment may change service responsibility or allocated exceptional resources. Payment must not change the semantic truth, public safety rule, evidence requirement, or basic access to the eight capabilities.

## 4. Minimum domain contract

Source implementation should eventually define, without committing to database schema in this document:

- `Program`
- `ProgramParticipant`
- `ProgramTeam`
- `ProgramRoleAssignment`
- `Quest`
- `QuestParticipation`
- `ConsentRecord` with version and withdrawal state
- `ProgramRecordMembership`
- `ReviewDecision`
- `ProgramHandover`
- `ProgramReportProjection`
- `ViewPublicationCandidate`

Each state-changing entity must preserve actor, timestamp, source, and change history where applicable.

## 5. Visibility and consent

At minimum, source contracts must distinguish:

- private draft
- Program-restricted
- specifically shared
- public candidate
- public
- withdrawn or suppressed

Public projection requires all applicable consent, rights, privacy, location precision, rare-species, minor-safety, and Review gates. Paid status cannot bypass these gates.

Consent must support:

- consent policy/version
- subject or guardian identity reference
- purpose and permitted uses
- capture/publication/location choices where applicable
- granted time
- withdrawal time and effect

This document does not approve a legal form or production storage model.

## 6. Review

Standard Review supports:

- requested
- in review
- changes requested
- held
- approved
- rejected
- withdrawn

Review access is free. The labor and liability of expert or official review may be provided by the organization itself or under a separate paid service.

## 7. Cross-year handover

A Program can continue or be copied into a later period without duplicating canonical Place or Record identities.

Handover preserves:

- source Program
- target Program or continuation period
- selected Quest and template references
- selected Place and Record references
- unresolved questions and Review state
- outgoing and incoming responsible actors
- handover timestamp and notes

## 8. Basic report and export

The free projection should be able to provide, when source data exists:

- participant, team, Quest, and activity counts
- Place and Record counts
- repeated-observation and continuation counts
- Review status distribution
- visibility distribution
- consent-completeness indicators
- public regional View references
- basic machine-readable export

Human analysis, policy evaluation, educational evaluation, specialist interpretation, custom formats, and guaranteed reports are separate services.

## 9. Cost and fair-use boundary

Concrete free capacity limits are not set in this contract. They must be based on measured storage, delivery, support, and AI costs.

Future limits must:

- allow a normal class, community activity, company activity, or municipal pilot to complete the full core flow
- be published and predictable
- prevent abuse and exceptional resource consumption rather than create artificial feature locks
- preserve export before suspension or reduction where legally and operationally possible
- offer resource separation such as bring-your-own storage or AI where appropriate

## 10. Implementation order

1. Audit existing account, group, event, route/Quest, visibility, moderation, and export contracts.
2. Define source-only Program domain types and fixtures.
3. Prove role and visibility rules without payment entitlements.
4. Add fixtures for school-year handover, guardian consent withdrawal, Program-private to regional public projection, Review hold, and organization-managed expert Review.
5. Define adapters to existing event/group structures.
6. Propose additive database changes separately.
7. Implement UI only after source contract and safety fixtures pass.

## 11. Required fixtures

- school class with guardian consent and one withdrawn participant
- municipal child editorial Program with staff Review
- company biodiversity activity with private observations and selected public records
- community group continuing a Program into the next year
- one Record reused in Program-private and regional public contexts without duplication
- expert Review performed by the organization without paid entitlement
- paid facilitation attached to a Program without changing data semantics
- exceptional high-volume media usage limited without disabling basic Program access

## 12. Current slice boundary

This document is a strategy-to-implementation contract only.

Not approved in this slice:

- source implementation
- database or migration
- billing or payment system
- production or staging changes
- DNS, domain, secret, or permission changes
- external publication
