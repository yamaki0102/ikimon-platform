# ZUKAN Free Organizational Core Contract

Status: accepted strategy constraint / implementation pending

Date: 2026-07-27

Strategy source:

- `yamaki0102/ikimon-business-strategy@main`
- `decisions/2026-07-27-zukan-organizational-core-free.md`
- `decisions/2026-07-27-zukan-species-report-export-boundary.md`
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
7. Operational activity summaries and raw-record portability archive
8. Publication into a regional View after safety, rights, and review gates

The internal aggregate is `Program`. Human-facing labels may be activity, team, editorial group, project, class, event, or another context-appropriate term. `Workspace` must not become a paid-tier boundary in the domain model.

The free contract covers activity operations and source-record access. It does not include site-, Program-, organization-, or period-level taxon inventories, biodiversity aggregation, comparison, or report-oriented export.

## 2. Non-negotiable invariants

- No per-seat entitlement is required for the eight capabilities.
- Team, Quest, standard Review, handover, operational summary, raw-record portability, and normal regional View publication are not premium-only states.
- Safety features such as consent, visibility control, correction, and Review cannot be paywalled.
- Authorization is based on role, responsibility, consent, and data policy, not payment status.
- Organization-specific databases or duplicated Place/Record data are not created for normal use.
- Programs use the shared Place Graph and shared Record/Evidence contracts.
- Program-private data and regional public projections are separate.
- Users can obtain a portability archive of source records they created, subject to rights and privacy controls, without an active paid service contract.
- A free portability archive must not be transformed into a normalized, deduplicated, aggregated taxon inventory.
- AI is optional; the core Program flow must work without AI processing.

## 3. Paid service boundary

The product may charge for work, derived outputs, or resources outside the standard self-service contract:

- site-, Program-, organization-, or period-level species/taxon lists
- provisional or reviewed biodiversity inventories
- species counts, taxonomic composition, conservation-status summaries, and comparisons
- taxonomic name normalization, synonym resolution, and duplicate-observation consolidation
- report-oriented CSV, Excel, PDF, API, dashboards, and charts
- planning, setup, training, facilitation, and ongoing administration
- field staff, equipment, and physical operations
- specialist review, official confirmation support, audit, SLA, and warranty
- customer-specific workflow, screen, form, report, SSO, domain, or system integration
- bulk migration and dedicated environment
- exceptional storage, video delivery, AI computation, or API volume
- FDE, monitoring, canonical writeback support, and managed operations

Payment may change access to derived outputs, service responsibility, or allocated exceptional resources. Payment must not change semantic truth, public safety rules, evidence requirements, or access to source records created by the user or organization.

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
- `OperationalActivitySummary`
- `RawRecordPortabilityArchive`
- `ViewPublicationCandidate`

Paid derived outputs must be separate contracts, such as:

- `TaxonInventory`
- `BiodiversitySummary`
- `ProfessionalReport`

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

A reviewed identification on an individual Record does not automatically grant free access to an aggregated taxon inventory.

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

## 8. Free operational summary

The free operational projection may provide, when source data exists:

- participant, team, Quest, and activity counts
- Place and Record counts
- repeated-observation and continuation counts
- Review status distribution
- visibility distribution
- consent-completeness indicators
- public regional View references

The free operational projection must not provide:

- species or taxon lists
- species counts or taxonomic group counts
- taxonomic composition
- rare-species or conservation-status summaries
- site-, Program-, organization-, or period-level biodiversity aggregation
- year-over-year, period, or site biodiversity comparisons
- deduplicated or normalized taxon tables
- report-oriented tables, charts, or downloads

## 9. Raw-record portability archive

The free portability path exists for preservation and migration, not report generation.

It may include, subject to rights and privacy policy:

- original media or a durable source reference
- Record ID
- contributor-entered fields
- captured/observed time
- Place/location fields
- consent and visibility state
- Review state
- provenance and change history

It must preserve Record granularity and uncertainty. It must not:

- consolidate multiple Records into one taxon row
- normalize names into a report-ready accepted-name list
- generate a site or period inventory
- calculate species totals or taxonomic composition
- create report-oriented CSV, Excel, PDF, or API projections

Users are not prohibited from using their own source records to conduct their own analysis. The contract only prevents ZUKAN from bundling a free report-ready derivative.

## 10. Regional View boundary

Individual Records, individual Place pages, and explicitly non-exhaustive recent or curated discoveries may be displayed without payment.

A free regional View must not claim or imply that it is a complete species inventory for a Place, Program, site, organization, or period. Complete or list-like taxon enumeration belongs to a paid derived-output contract.

## 11. Cost and fair-use boundary

Concrete free capacity limits are not set in this contract. They must be based on measured storage, delivery, support, and AI costs.

Future limits must:

- allow a normal class, community activity, company activity, or municipal pilot to complete the core flow
- be published and predictable
- prevent abuse and exceptional resource consumption rather than create artificial feature locks
- preserve source-record portability before suspension or reduction where legally and operationally possible
- offer resource separation such as bring-your-own storage or AI where appropriate

## 12. Implementation order

1. Audit existing account, group, event, route/Quest, visibility, moderation, report, and export contracts.
2. Identify any current UI/API that exposes taxon aggregation or report-ready export.
3. Define source-only Program domain types and fixtures.
4. Define `OperationalActivitySummary` and `RawRecordPortabilityArchive` separately from paid derived outputs.
5. Prove role and visibility rules without payment entitlements.
6. Add fixtures for school-year handover, guardian consent withdrawal, Program-private to regional public projection, Review hold, and organization-managed expert Review.
7. Add boundary fixtures preventing free taxon inventory, species count, and report-ready export.
8. Define adapters to existing event/group structures.
9. Propose additive database changes separately.
10. Implement UI only after source contract and safety fixtures pass.

## 13. Required fixtures

- school_class_with_guardian_consent_and_one_withdrawn_participant
- municipal_child_editorial_program_with_staff_review
- company_biodiversity_activity_with_private_observations_and_selected_public_records
- community_group_continuing_program_into_next_year
- one_record_reused_in_program_private_and_regional_public_contexts_without_duplication
- expert_review_performed_by_organization_without_paid_entitlement
- paid_facilitation_attached_without_changing_data_semantics
- exceptional_high_volume_media_limited_without_disabling_basic_program_access
- operational_summary_excludes_taxon_counts
- raw_record_archive_preserves_record_granularity
- raw_record_archive_does_not_emit_taxon_inventory
- individual_record_is_viewable_without_complete_site_species_list
- taxon_inventory_requires_paid_derived_output_contract

## 14. Current slice boundary

This document is a strategy-to-implementation contract only.

Not approved in this slice:

- source implementation
- database or migration
- billing or payment system
- production or staging changes
- DNS, domain, secret, or permission changes
- external publication
