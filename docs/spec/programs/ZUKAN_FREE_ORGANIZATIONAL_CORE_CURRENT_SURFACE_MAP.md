# ZUKAN Free Organizational Core: Current Surface Map

Status: source-only WP2 audit / candidate for parent integration

Audit date: 2026-09-10 (JST)

Work: `ZUKAN-ORG-CORE-01`

Repository: `yamaki0102/ikimon-platform`

Base: `f81024cd29b4934a86e371a994136d1338d7fe1f`

## 1. Scope and evidence boundary

This map records the WP2 audit required by `docs/spec/core-experience-p0/ZUKAN_EXECUTION_PLAN.md` against the exact base above. The user-provided Work Card is the task envelope. The current source contract read for this audit is:

- `docs/spec/programs/ZUKAN_FREE_ORGANIZATIONAL_CORE_CONTRACT.md`
- `docs/spec/zukan-product-architecture/SPEC.md`
- `docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`
- `docs/spec/zukan-app-experience/PARTICIPATION_EXPERIENCE_V1.md`
- `docs/spec/core-experience-p0/ZUKAN_EXECUTION_PLAN.md`
- `platform_v2/product-registry/product.json`
- `platform_v2/product-registry/requirements.json`
- active source under `platform_v2/src/` and `platform_v2/cloudflare_shadow/`

This is a source map, not live verification. `runtime-active` means that the checked-in Worker route/source wiring exists; it does not prove deployed runtime identity, D1/R2 state, authentication, or public behavior. No product code, runtime, database, migration, secret, UI, or external system was changed by this audit.

The classifications are:

- `reuse`: an existing contract is semantically safe to use as-is for the free core, subject to the documented boundary.
- `adapter`: an existing surface can be wrapped or translated without duplicating canonical Place/Record data; the generic organizational contract is not present yet.
- `missing`: no current generic contract was found in the bounded source areas.
- `legacy`: an existing compatibility or specialist surface must not be treated as the free generic organizational contract.
- `source-only`: safe next work can be defined as pure types, fixtures, and tests; it is not implemented here.

## 2. Bounded audit method

The audit searched these areas only: `platform_v2/src/`, `platform_v2/cloudflare_shadow/src/`, `platform_v2/cloudflare_shadow/migrations/`, and the current product/spec documents named above. Tests, Markdown, JSON, `node_modules`, generated output, and external provider state were excluded from absence searches where noted.

Exact positive terms included `record_observations`, `observation_fields`, `user_observation_fields`, `occurrence_projection_versions`, `places`, `place_relationships`, `record_place_memberships`, `observation_event_sessions`, `observation_event_teams`, `observation_event_quests`, `observation_rally_courses`, `guidePrograms`, `programHandover`, `zukan_claim_revisions`, `zukan_rights_evaluations`, `species.csv`, `darwin-core.csv`, and publication-feed symbols.

Bounded absence terms included `organization_core`, `organization_members`, `organization_roles`, `workspace_members`, `workspace_roles`, `group_members`, `group_invites`, `moderation_queue`, `consent_records`, `rights_grants`, `rawrecordportabilityarchive`, `operationalactivitysummary`, `taxoninventory`, `professionalreport`, `promotionalpublication`, `couponcampaign`, `voucher`, `discount`, `sponsor`, and `advertisement`. `program_id`, `event_id`, `participant_id`, and `team_id` were also checked to distinguish existing event/profile scope from organization membership.

Absence means “not found as a dedicated generic contract in those bounded areas.” It does not mean that a future implementation is impossible, nor that a similarly named marketing label, SQL aggregate, or compatibility route is equivalent.

## 3. Current-surface map

### 3.1 Record / Observation / Occurrence

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Record and Observation | `platform_v2/cloudflare_shadow/migrations/observations/0067_record_observation_foundation.sql`: `record_observations`, `record_observation_policies`, `record_observation_source_map`, `record_observation_media`, `observation_lifecycle_events`; `platform_v2/cloudflare_shadow/src/cloudflareObservationReadModel.ts`: `RecordObservationReadSnapshot`, `ObservationFirstCard`, `ObservationFirstRecordDetail` | `platform_v2/cloudflare_shadow/src/cloudflareObservationDualWrite.ts`: `buildObservationAddPlan`, `buildOwnerObservationUpsertPlan`, `buildObservationLifecyclePlan`, `buildHumanObservationEditPlan`, `buildRecordProposalPolicyPlan`, `buildRecordVisibilityPlan`; Worker routes `/api/v0/draft-observations`, `/api/v0/observations/finalize`, `/api/v1/observations/upsert`, and `/api/v1/observations/:id/*` | `ProgramRecordMembership`, generic organization-owned Record scope, and a generic contributor portability adapter | The Observation Record foundation is the canonical source-record path. Do not make `Observation` a parent for event, document, or organization objects; the architecture defines it as a Record kind | `reuse` for source records; `adapter` for Program membership; generic org layer `missing` |
| Occurrence | `platform_v2/src/routes/researchApi.ts`: `OccurrenceRow`, `mapOccurrenceRow`; GET `/api/v1/research/occurrences` | `platform_v2/src/routes/researchApi.ts`: `/api/v1/research/darwin-core.csv`, `/api/v1/research/export-qa-report`, `/api/v1/research/media-role-summary`; Worker forwarding in `platform_v2/cloudflare_shadow/src/index.ts` | Free generic organizational Occurrence view is not defined | Biodiversity/research projection; it is not the free Program source-record contract | `legacy` / specialist adapter |

### 3.2 Place / observation_fields / Place Atlas

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Place | `platform_v2/src/services/placeDomain.ts`: `PLACE_KINDS`, `PlaceGeometry`, `PlaceCandidate`, `MembershipBoundary`, `MembershipDecision`, `decideRecordPlaceMembership`, `publicMembershipProjection` | `platform_v2/cloudflare_shadow/src/placeRegistryD1.ts`: `searchD1PublicPlaces`, `listD1PublicPlaceChildren`; D1 tables `places`, `place_aliases`, `place_boundaries`, `place_source_references`, `place_relationships` | Program-scoped Place membership projection and role-aware Place access are not defined | Do not create organization-specific Place copies or bypass shared Place Graph policy | `reuse` for shared Place Graph; `adapter` for Program binding |
| `observation_fields` | `platform_v2/src/services/observationFieldRegistry.ts`: `ObservationField`, `createField`, `getField`, `createFieldVersion`, `listMyFields`, `listNearbyFields`, `searchFieldsByName`, `listFields`; PostgreSQL `observation_fields` | `platform_v2/src/routes/observationFieldsApi.ts`; Worker/D1 `user_observation_fields` in `platform_v2/cloudflare_shadow/migrations/observations/0046_observation_field_registry_runtime.sql` | Generic organization field registry, organization membership, and field-level consent/rights mapping are missing | Field statistics include event/taxon-oriented data; they cannot be reused as a free biodiversity inventory or organizational ACL | `adapter` for field references; generic org field layer `missing` |
| Place Atlas | `platform_v2/src/services/placeAtlasContract.ts`: `PLACE_ATLAS_PROFILE_VERSION`, `PlaceAtlasRef`, `buildPlaceAtlasProfile`; `platform_v2/src/services/placeAtlasV2Contract.ts`: `PlaceAtlasProfileV2`, `buildPlaceAtlasProfileV2`; `platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.ts`: `loadCloudflarePlaceAtlasProfile` | `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts`: public observation projection; Worker map routes `/api/v1/map/place-profile`, `/api/v1/map/place-search`, `/api/v1/map/place-resolve`, `/api/v1/map/place-children` | Program-private to regional-View candidate projection, with explicit safety/rights/review gates, is missing as a generic source contract | Place Atlas is a regional publication/read projection. It must not imply a complete site or Program species inventory | `reuse` for Place Atlas primitives; `adapter` for publication candidate |

### 3.3 Group / Event / Route / Guide / Rally

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Group / Organization / Workspace | None found as a first-class generic `Group`, `Organization`, `Workspace`, member, role, invite, or ACL contract in the bounded source areas | Existing `tenant_id`, `workspace_id`, or owner fields are only scope/context values; they do not establish membership or authorization | `Organization`, `Workspace`, `ProgramRoleAssignment`, membership lifecycle, role decision, and non-member fail-closed policy | `observation_event_teams` is event-scoped; `GuideProgramOwnerType` is an owner profile enum; neither is organization membership | `missing` |
| Event / Program / Participant / Team / Quest | `platform_v2/cloudflare_shadow/migrations/observations/0019_observation_event_core.sql`: `observation_event_sessions`, `observation_event_teams`, `observation_event_participants`; `0029_observation_event_recap_capsule_report.sql`: `observation_event_quests`; `platform_v2/src/services/observationEventModeManager.ts`, `observationEventParticipantAccess.ts`, `observationEventQuestEngine.ts` | `platform_v2/src/routes/observationEventApi.ts`: `registerObservationEventApiRoutes`; `platform_v2/src/routes/observationEventRecapApi.ts`; Worker `handleObservationEventApi`; `platform_v2/src/routes/observationEventPages.ts` | Generic `Program`, `ProgramParticipant`, `ProgramTeam`, `ProgramRoleAssignment`, and `QuestParticipation` contract with visibility/consent/rights bindings | Existing event stack is a current observation-event profile. It can be adapted, but must not be duplicated into a second event engine | `adapter`; generic free-core types `missing` |
| Route / Guide | `platform_v2/src/services/guideRouteTrack.ts`; `platform_v2/src/services/guidePrograms.ts`: `RuntimeGuideProgram`, `GuideProgramRef`, `GuideProgramProgress`, `GuideProgramPublicDetail` | `platform_v2/src/routes/walkApi.ts`, `platform_v2/src/routes/guideApi.ts`, `platform_v2/src/routes/guideRead.ts`; Worker guide routes `/api/v1/guides/*`, `/api/v1/guide/*`, and `/api/v1/walk/session/*` | Generic `Quest` / route participation binding independent of guide runtime, and Program-level review/consent summary | Guide owner values `owner|community|municipality|school` are profile ownership metadata, not role ACL. Route telemetry is not a Record membership decision | `adapter`; guide runtime remains profile-specific |
| Rally | `platform_v2/cloudflare_shadow/migrations/observations/0020_observation_event_rally.sql`: `observation_rally_courses`, `observation_rally_stations`, `observation_rally_missions`, `observation_rally_submissions`, `observation_rally_progress`, `observation_rally_revisions`; `platform_v2/src/ui/observationRally.ts` | `platform_v2/src/routes/observationEventRecapApi.ts` and observation-event handlers for rally/mission paths | Generic Quest/Mission contract with standard Review, consent, visibility, and handover semantics | Rally is an observation-event profile and must not become a parallel generic workflow engine | `adapter` |
| Handover | `platform_v2/src/services/programHandoverPlanner.ts`: `ProgramHandoverInput`, `ProgramHandoverResult`, `planProgramHandover`; `programHandoverRepositoryContract.ts`; `programHandoverD1Repository.ts`; D1 migrations `0015_zukan_program_handover_persistence.sql` and `0016_zukan_program_handover_offers.sql` | `programHandoverOfferRepositoryContract.ts`, `programHandoverOfferD1Repository.ts` provide source-ready persistence/offer boundaries | Generic Program ownership/role and consent/review reset bindings are not yet connected to the handover planner | M7 handover is not evidence of generic organization membership, incoming acceptance, or live runtime activation | `reuse` as a source-ready planner boundary; `adapter` for the future free core |

### 3.4 Moderation / Consent / Rights / Export

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Foundation review / governance | `platform_v2/cloudflare_shadow/migrations/core/0010_zukan_foundation_v2_predicate_claims.sql`: `zukan_claim_revisions`; `0011_zukan_foundation_v2_authority_resolution.sql`; `0012_zukan_foundation_v2_governance_rights.sql`: `zukan_content_governance_events`, `zukan_rights_evaluations`; `0013_zukan_foundation_v2_disputes_coverage.sql` correction/suppression structures; `platform_v2/src/services/zukanFoundationV2D1Repository.ts` | `platform_v2/cloudflare_shadow/src/runZukanFoundationV2ReadOnlyEvidence.ts` and foundation repository interfaces can back a source-only Review adapter | Generic `ReviewDecision` queue/state machine, organization reviewer role, moderation queue, and Program-level decision projection | Specialist AI/identification review services are not a generic moderation service. No current generic `moderation` route/table was found | `reuse` for provenance/governance primitives; generic Review adapter `missing` |
| Consent / observation rights | `platform_v2/src/services/observationDataRights.ts`: `RecordConsent`, `ResearchUseConsent`, `EnterpriseReportConsent`, `AreaProfileUseConsent`, `ObservationDataRights`, `normalizeObservationDataRights`; D1 `observation_data_rights` in `0030_observation_data_rights.sql` | `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts` reads consent, rights, and withdrawal fields through `isEligible` | Generic versioned `ConsentRecord` with subject/guardian, purpose, capture/publication/location choices, withdrawal effect, and Program binding | Observation rights are valuable primitives but are not proof of guardian or organization workflow coverage; paid/report consent fields must not widen free taxon output | `adapter`; generic org consent ledger `missing` |
| Rights / publication | `platform_v2/cloudflare_shadow/migrations/core/0011_zukan_foundation_v2_authority_resolution.sql` publication snapshots/editions; `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts`: `PublicationFeedNativeRow`, `isEligible`, `responseFor` | `platform_v2/src/routes/write.ts` reference correction route and `platform_v2/src/routes/references.ts` source/reference routes | Program-private to `ViewPublicationCandidate` contract with explicit actor, purpose, rights, review, privacy, precision, minor-safety, and withdrawal checks | Publication feed is a read projection; it must not auto-publish or establish organization authority | `reuse` for gates; `adapter` for candidate |
| Export / portability | `platform_v2/src/routes/researchApi.ts`: `/api/v1/research/darwin-core.csv`, `/api/v1/research/export-qa-report`; `platform_v2/src/routes/observationEventRecapApi.ts`: `/:sessionId/species.csv`; `platform_v2/src/services/observationEventOfficialReport.ts` | Existing Record read model and rights services can supply a future record-granular archive adapter | `RawRecordPortabilityArchive` preserving Record granularity, contributor fields, provenance, review, consent, visibility, and change history without aggregation | Research Darwin Core, species CSV, official report, and monitoring outputs are specialist/report projections. No generic raw portability export contract was found | `legacy` / specialist adapters; free portability contract `missing` |

### 3.5 Species / Taxon / CSV / Report

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Species / Taxon | `platform_v2/src/routes/researchApi.ts`: `OccurrenceRow`, `mapOccurrenceRow`; `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts` taxon-labelled publication items | `platform_v2/src/services/observationEventRecap.ts`: `uniqueSpeciesCount`, `topTaxa`, `recentTaxa`; `platform_v2/src/services/observationEventOfficialReport.ts`: `OfficialSpeciesRecord`, `buildOfficialEventReport` | Free `OperationalActivitySummary` must deliberately omit species/taxon lists, counts, composition, status, and comparison; generic paid `TaxonInventory`/`ProfessionalReport` contracts are not implemented | Individual Record taxon labels and specialist event/research outputs cannot be lifted into a free Program/site/org inventory | `reuse` only inside Biodiversity Pack/specialist adapters; free-core output `missing` |
| CSV / report | `platform_v2/src/routes/researchApi.ts`: `/api/v1/research/darwin-core.csv`, `/api/v1/research/export-qa-report`; monitoring package services/routes in `platform_v2/src/services/monitoringPackageStandard.ts` and `platform_v2/src/routes/monitoringBusiness.ts` | These paths can remain paid/specialist output adapters with explicit rights and service boundaries | `TaxonInventory`, `BiodiversitySummary`, `ProfessionalReport`, and an output authorization contract are absent as generic domain types | Report-oriented CSV/Excel/PDF/API/dashboard output is outside the free operational summary. Existing routes do not prove current entitlement enforcement | `adapter` for paid/specialist boundary; generic paid contracts `missing` |

### 3.6 Campaign / Coupon / Promotion

| Surface | Reuse | Adapter | Missing | Legacy / boundary | Result |
|---|---|---|---|---|---|
| Campaign | No first-class generic `Campaign` entity or organizational campaign contract was found | `platform_v2/src/ui/mapExplorer.ts` and `platform_v2/src/ui/mapEffort.ts` contain campaign/progress presentation labels; `platform_v2/src/routes/marketing.ts` and `platform_v2/src/siteMap.ts` expose marketing content pages | `PromotionalPublication`, campaign ownership, sponsor/advert disclosure, rights, review, and measurement contract | UI labels and marketing pages are not Program/publication domain objects | `missing`; labels are `legacy`/unrelated presentation |
| Coupon / voucher / discount | No generic coupon, voucher, discount, issuance, redemption, or fraud-control entity was found in the bounded source areas | None identified | `CouponCampaign` and payment/commercial rights boundary | No coupon behavior may be inferred from plan/Program/event data or added to the free core slice | `missing` |
| Promotion | `platform_v2/cloudflare_shadow/migrations/observations/0032_guide_record_promotion_requests.sql` and `platform_v2/src/services/guideRecordPromotion.ts` represent guide-record promotion requests | Guide promotion can remain a profile-specific adapter if its rights/review gates are preserved | Generic promotional publication and commercial/sponsor/advertising consent contracts | “Promotion” also appears as guide-record promotion and tier-promotion verbs; neither is coupon campaign or public commercial publication | `legacy` / profile adapter; generic paid contract `missing` |

## 4. Free-core contract disposition

The accepted contract’s minimum types are not yet present as a single generic implementation. The least-duplication disposition is:

| Contract type | Current disposition |
|---|---|
| `Program`, `ProgramParticipant`, `ProgramTeam`, `Quest`, `QuestParticipation` | `adapter` over the observation-event/profile surfaces; generic source-only types remain `missing` |
| `ProgramRoleAssignment` | `missing`; existing owner/team identifiers are not role authorization |
| `ConsentRecord` | `adapter` from `observationDataRights.ts` plus future guardian/withdrawal fixture; generic versioned record `missing` |
| `ProgramRecordMembership` | `adapter` from Record/Place primitives; generic binding `missing` |
| `ReviewDecision` | `reuse` foundation provenance/governance primitives; generic queue/decision projection `missing` |
| `ProgramHandover` | `reuse` `programHandoverPlanner.ts` and repository contracts as a source-ready boundary; role/consent integration `adapter` |
| `OperationalActivitySummary` | `missing`; must be record/place/participant/review/visibility/consent operational counts only |
| `RawRecordPortabilityArchive` | `missing`; future adapter must preserve source-record granularity and never emit taxon aggregation |
| `ViewPublicationCandidate` | `adapter` over Place Atlas/publication eligibility primitives; generic candidate object and decision record `missing` |
| `TaxonInventory`, `BiodiversitySummary`, `ProfessionalReport` | `missing` as generic types; existing research/official/monitoring reports remain specialist adapters |
| `PromotionalPublication`, `CouponCampaign` | `missing`; no free-core implementation |

Important boundary: existing `tenant_id`, `workspace_id`, `corporation_id`, `program_id`, `event_id`, `participant_id`, and `team_id` values are not interchangeable. They identify context in existing rows; none alone proves organization membership, role assignment, guardian consent, or non-member denial.

## 5. Bounded absence areas and stop conditions

The following areas were deliberately searched and remain absent as dedicated generic surfaces:

1. Organization/workspace membership: `platform_v2/src/`, `platform_v2/cloudflare_shadow/src/`, and migrations, using `organization_members`, `organization_roles`, `workspace_members`, `workspace_roles`, `group_members`, `group_invites`, and related exact terms.
2. Moderation/consent/rights: the same source and migration areas, using `moderation_queue`, `consent_records`, `rights_grants`, `ReviewDecision`, and guardian/withdrawal terms. Existing observation rights and foundation governance were retained as primitives, not promoted to a generic org workflow without evidence.
3. Paid derived output: the same areas, using `TaxonInventory`, `ProfessionalReport`, `PromotionalPublication`, `CouponCampaign`, voucher/discount/sponsor/advertisement terms. Existing species CSV, research export, and report routes were classified as specialist/report adapters.
4. Generic campaign: source/UI/route areas, using `campaign`, `promotion`, and `promotional`. Matches were manually separated into map progress labels, marketing content, tier/guide promotion, and guide-record promotion requests; no generic campaign contract was found.

Search stops here because the accepted contract, current event/Record/Place surfaces, and absence boundaries are sufficient to define the next source-only slice. Full repository inventory, live route probing, D1/PostgreSQL inspection, authentication tests, and provider/API verification are outside this WP2 document-only scope.

## 6. Source-only fixture plan

Fixtures must be pure deterministic objects or serialized JSON passed to future contract functions. They must not open D1/PostgreSQL, apply migrations, call Worker routes, use real accounts, use secrets, or publish to a runtime. IDs, timestamps, hashes, and actor references should be synthetic and stable.

Required fixture set:

- `school_class_with_guardian_consent_and_one_withdrawn_participant`: owner/staff/participant/guardian roles; one withdrawal removes public projection while preserving the source Record and audit history.
- `municipal_child_editorial_program_with_staff_review`: Program-private draft, staff Review hold, changes requested, approval, and public-candidate transition; non-member read denied.
- `company_biodiversity_activity_with_private_observations_and_selected_public_records`: private Record membership plus one explicitly eligible regional View candidate; no complete taxon inventory.
- `community_group_continuing_program_into_next_year`: selected Quest/Place/Record references, new period identity, outgoing/incoming responsibility, idempotent retry, and no canonical identity duplication.
- `one_record_reused_in_program_private_and_regional_public_contexts_without_duplication`: one Record identity with separate membership/projection state and rights/precision checks.
- `expert_review_performed_by_organization_without_paid_entitlement`: role/responsibility authorizes standard Review; payment status is absent and cannot bypass evidence or safety gates.
- `paid_facilitation_attached_without_changing_data_semantics`: a paid service annotation changes responsibility/output access only; it does not change Record truth, consent, or public safety.
- `exceptional_high_volume_media_limited_without_disabling_basic_program_access`: fair-use/resource boundary preserves basic Program and source-record access.
- `operational_summary_excludes_taxon_counts`: includes participant/team/Quest/activity/Place/Record/review/visibility/consent indicators and explicitly has no species or taxon fields.
- `raw_record_archive_preserves_record_granularity`: source media/reference, Record ID, contributor fields, time, Place, consent, visibility, Review, provenance, and change history remain per Record.
- `raw_record_archive_does_not_emit_taxon_inventory`: archive serialization rejects normalization, deduplication, species totals, composition, and report-ready rows.
- `individual_record_is_viewable_without_complete_site_species_list`: individual eligible Record/Place display does not imply exhaustive inventory.
- `taxon_inventory_requires_paid_derived_output_contract`: TaxonInventory/ProfessionalReport requires a separate output contract and rights/service decision.

Recommended negative fixtures are equally important: non-member access, withdrawn guardian consent, private Record leaking into a public candidate, Review-held Record publication, handover with unauthorized selected references, and any attempt to derive species counts from a free operational summary.

## 7. Minimal migration-free next slice

Proposed next slice (not implemented in this Work): add source-only types and tests in a future isolated lane, with no database, migration, route, UI, runtime, payment, or secret changes.

1. Define a small pure adapter boundary, preferably adjacent to the existing services, for `OrganizationContext`, `MembershipDecision`, `ProgramParticipationBinding`, `FreeOperationalSummary`, `RawRecordPortabilityArchive`, and `ViewPublicationCandidate`.
2. Reuse `placeDomain.ts`, `placeAtlasContract.ts`, `cloudflareObservationReadModel.ts`, `observationDataRights.ts`, foundation governance types, and `programHandoverPlanner.ts`; do not create replacement Place/Record/Event tables or a generic EAV layer.
3. Implement deterministic policy functions only: member/role scope, Record membership, consent withdrawal, Review hold, publication eligibility, free-summary redaction, record-granular archive serialization, and selected-reference handover planning.
4. Add the fixture and negative assertions in Section 6. The first green acceptance condition is that the free summary and raw archive cannot emit a taxon inventory, species count, taxonomic composition, or report-oriented export.

The first slice should stop at pure source tests. Additive persistence, route/UI wiring, staging/runtime checks, and paid-output implementation require a separate Work Card and boundary review.

## 8. Verification and handoff state

Expected verification for this candidate:

- `git diff --check`: required and must be green.
- One-document exact diff: the only changed path must be `docs/spec/programs/ZUKAN_FREE_ORGANIZATIONAL_CORE_CURRENT_SURFACE_MAP.md`.
- Product registry test: `npm --prefix platform_v2 run test:product-registry` may be run as a read-only regression check; no source implementation is changed by this document.
- Commit candidate: allowed on a task branch from exact base; no push or merge is performed here.

Unverified by design: deployed runtime identity, D1/R2/PostgreSQL state, authentication/authorization behavior, live public/private journeys, provider state, and parent-lane merge compatibility. The named commander-level Work Card and runtime protocol files were not available in the current management checkout; the user-provided Work Card plus this repository’s accepted contract, execution plan, Product Registry, and current source were used as the bounded authority for this audit.

Handoff must return: changed path, exact base, candidate head, tree state, exact diff result, test result, and the explicit no-merge boundary to the parent lane.
