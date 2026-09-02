# ZUKAN Product Architecture — Active Contract

- Status: active product contract
- Adopted: 2026-07-29
- Current runtime: `platform_v2/`
- Architecture decision: `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md`
- Current execution-roadmap decision: `yamaki0102/ikimon-business-strategy/decisions/2026-09-02-zukan-development-execution-roadmap-v3.md`
- Broad product-scope provenance: `yamaki0102/ikimon-business-strategy/decisions/2026-09-01-zukan-broad-product-roadmap-v2.md`
- Foundation contract: `docs/spec/zukan_foundation_v2_implementation_contract_2026-07-28.md`
- Current profile horizon: `PROFILE_HORIZON.md`

## 1. Product identity

ZUKAN is not a biodiversity application that is being generalized into other fields.

ZUKAN connects regional photographs, documents, observations, activities, events, voices, facilities, history, culture, nature and other records to Place, Entity, Time, Source, Evidence, Rights, Review and change history, then returns them through regional views and publications.

Public message:

> 地域の記録を、みんなで育てる。

Product definition:

> ZUKAN turns regional sources, observations and activities into knowledge with provenance, time, rights and review state, so that it can be reused and republished for different purposes.

The terms `OS`, `regional observation OS` and `generic reporting OS` are not product contracts.

## 2. Three layers

### 2.1 Experience / Publication

- personal Home, Record, Place and regional View
- maps, timelines and `この場所のうつろい`
- Program, Event and activity-result pages
- paper, PDF, CSV, Excel and reports
- LP, campaign and custom event pages
- coupons
- API, MCP and datasets

### 2.2 Participation / Workflow

- people, organizations, teams and participants
- Program, Event and Quest
- contribution, consent and visibility
- Review, Correction and Dispute
- Assessment and Routing
- Case, Action, Resolution and Follow-up

A Record does not become an Issue or Case by default. Action workflow is created only when a concrete response is needed.

### 2.3 Knowledge Core

- Place / Entity / Subject Identity
- SourceWork / SourceEdition / SourceObject / SourceFragment
- Record
- Evidence
- Claim / ClaimRevision
- Rights / Authority / Review / Governance
- Resolution / ProjectionSnapshot
- Publication / PublicationEdition

The minimum product scope preserves Source, Record, Claim, Place, Review, Rights, Publication, Program, Event, Quest and Workspace as distinct responsibilities. Media metadata minimization, minor/guardian consent, publication scope, export, withdrawal, deletion, retention, correction and takedown are lifecycle constraints, not optional implementation details.

The Knowledge Core is a semantic and verification contract. It does not require all tenants, organizations or domains to share one physical database or one generic EAV table.

## 3. Domain Pack and profile boundary

A specialist domain is a contract that crosses all three layers, not a fourth architectural layer.

A Domain Pack defines:

- vocabulary and predicates
- collection or photography protocol
- required evidence
- AI candidate boundaries
- human-review requirements
- publication, privacy and rights rules
- output templates
- response workflow
- accountable party and liability boundary

A Domain Pack is implemented only when a concrete user, activity, output and accountable owner exist.

`Taxon`, `Occurrence` and `Identification` remain specialist Biodiversity Pack concepts. They must not be renamed into generic subjects and reused for unrelated domains.

A Program Profile is likewise not a new Core. `観察会` is the currently proven Program profile; photo contests, sketch/editorial programs, missions/town walks, stamp rallies and tourism/regional-engagement programs may reuse the Program Core only under the contracts in `PROFILE_HORIZON.md` and the Product Registry frontier.

A Publication Profile is a purpose-specific View/Publication over governed source truth; it must not duplicate source truth into a publication-specific database.

## 4. Object responsibilities

| Role | Object | Contract |
|---|---|---|
| Entry | Record | Immutable account of what was submitted, acquired or performed |
| Assertion | Claim / ClaimRevision | Reviewable and correctable statement about a subject |
| Axis | Place / Entity Identity | Stable, non-semantic identity with time-scoped assertions and aliases |
| Provenance | Source / Evidence | Independent first-class objects referenced by Records and Claims |
| Output | PublicationEdition | Frozen selection for a time, audience and purpose |
| Response exception | Case | Created only when action is required |

`Observation` is a Record kind. It is not the parent object for documents, testimony, historical material or organizational activity.

A Source is not embedded as a Record payload. A Source has an independent edition, rights, fixity and derivation lifecycle and may support many Records, Claims and Publications.

## 5. Record / Claim separation

The following must remain separate:

- a photograph or document was submitted: Record
- the subject is an invasive plant: Claim
- a specialist confirmed the identification: Review / Verification
- information was sent to an authority: Case / Action
- the subject was later removed or repaired: new Record and Claim

New knowledge must not overwrite the original Record. A correction appends a ClaimRevision. A later response produces a new Record.

## 6. Knowledge and action boundary

Knowledge and action lifecycles are separate.

Connection 1:

- Assessment reads stable Record, Claim and Evidence references.
- A Case does not own or silently copy the evidence payload.

Connection 2:

- Case results return to the Knowledge Core as a new Record.
- They do not overwrite the earlier Record or Claim.

This preserves correction and publication history while allowing Cases to have restricted access, deadlines and terminal states.

## 7. Eligibility

A regional item is eligible when all of the following can be represented:

1. connection to a Place or Entity
2. source, time, or an explicit unknown state
3. purpose-specific rights for preservation, analysis, display and republication
4. value for review, correction, comparison, reuse or succession
5. a concrete user, activity, View, output or external writeback path

A one-time historical photograph, map or testimony is eligible. Individual Records do not need to change; Claims, relations, Views and Publications may evolve around them.

Unknown provenance or date does not automatically require deletion or concealment. It must remain explicit and may be shown only when rights, privacy and safety allow it.

## 8. Safety boundary

ZUKAN is not an emergency reporting channel.

The standard product does not promise:

- response times for imminent danger
- final medical, health, structural-safety or legally qualified judgments
- person identification or tracking
- final adjudication of a rights dispute
- delivery or receipt guarantees without an explicit SLA and receipt evidence

ZUKAN may retain asset identity, observations, evidence, inspection history, jurisdiction candidates, Case state and transmission-operation evidence for trees, roads, manholes and similar subjects.

AI outputs remain candidates. Emergency situations must direct users to the existing official emergency channel.

A rights-safe person/profile Publication is allowed only when an accountable subject or Publisher has a publication basis. This does not authorize face identification, biometric recognition or person tracking.

## 9. Specialist diagnosis

For tree safety and similar domains, the default boundary is:

ZUKAN owns:

- Record, Evidence, position and time
- asset identity and ledger
- inspection and response history
- jurisdiction candidate
- Case and transmission-operation evidence

An accountable specialist or integrated service owns:

- specialist diagnosis
- safety conclusion
- treatment decision
- qualifications, insurance and legal responsibility

A prompt or routing-rule change alone does not constitute a validated specialist product.

## 10. Free and paid boundary

The standard organizational core remains free. Organization status, seat count, participant count, Record count and ordinary publication are not billing triggers.

Free core includes:

- basic personal and organizational contribution, viewing and participation
- Program, participant, team and Quest
- visibility and consent
- standard Review and year-to-year handover
- ordinary regional Views
- management and export of a contributor's source Record
- basic Source, Publisher, Edition and Rights registry

Paid work is limited to outcomes that add specialist responsibility, production or operational work:

1. specialist reports, submission-ready outputs, expert review and quality assurance
2. LP, campaign, booklet and custom event Publication production
3. coupon issuance, operation, fraud controls and measurement
4. project-specific data work, rights clearance, integration, field operation, SLA and FDE

Free users are users, editors, participants and publication actors. They are not defined as a data-supply tier for a paid product.

## 11. Foundation responsibility

The Knowledge Core does not decide specialist truth by itself. It is responsible for recording and replaying:

- who asserted what and when
- which Source and Evidence were used
- which Review, Authority and Policy applied
- which Claims conflict
- what a policy accepted at a target time
- what may be shown in a View or Publication

Specialist judgment belongs to a Domain Pack and accountable reviewers. Adoption, projection and publication are reproducible policy decisions.

## 12. Compatibility

- Keep the current `ikimon.life`, repository, runtime, API and database identifiers until an approved migration changes them.
- Keep current biodiversity tables, routes and prompts inside the Biodiversity Pack.
- Keep Foundation v2 migrations additive and dormant where no writer or reader is approved.
- Do not switch current runtime routes or public response schemas merely because a future profile is described in the roadmap.
- Do not create a municipality-specific database, authentication system or canonical Place model.
- Keep NOCOSIL and ZUKAN as separate canonical/private domains; exchange only explicit public-safe projections/packages under the profile horizon.

## 13. Delivery authority and current frontier

The former `first non-biological source-only slice` proved an important semantic boundary but is no longer the current implementation frontier. It must not be read as an active task selector.

Current delivery state and executor eligibility are owned by:

- `platform_v2/product-registry/delivery.json` for static roadmap/frontier projection;
- `platform_v2/product-registry/requirements.json` and Eval contracts for product acceptance;
- the shared Verified Outcome Status Resolver for resolved status and evidence eligibility.

The current frontier (`ACTIVE` / `READY_NEXT` / `SHAPED_NEXT` / dependency-shaped / deferred) is projected only in `delivery.json#rolling_frontier`; this contract does not repeat it.

The broad product horizon is fixed in `PROFILE_HORIZON.md`. Describing a future Program or Publication profile does not make it runtime-active or executor-eligible.

## 14. Development execution principles

The current execution roadmap adds these product-level rules without changing runtime status:

1. M1-M6/App Experience are the Core Loop (`撮る -> 保存 -> AI候補 -> Review -> Areaに蓄積 -> 再訪 -> Program参加 -> Publication -> 次の参加`); its defects and product-value corrections take the executor slot before frontier work, and redesign for its own sake does not;
2. self-serve foundations (M8-A) and calendar-gated cross-profile foundations (M7) are scheduled by the lane rule in roadmap v3 §2.1, not by milestone number; M8-A does not wait for M7;
3. prove M9 with the smallest demand-backed non-biological profile after one demand probe on the existing Program Core, rather than building a universal profile engine;
4. compose M10 Publications from existing governed truth, starting from the existing publication feed already consumed by external regional sites, rather than create new CMS/source silos or per-region consumer code;
5. exchange bounded Source packages in M11 rather than build a shared NOCOSIL/ZUKAN database;
6. standardize repeated paid outcomes in M12 before billing-first infrastructure; manual paid delivery is allowed before software;
7. promotion is required only at risk-class boundaries (milestone design exit, first runtime mutation, production);
8. M5 remains demand-gated and deferred regardless of rank.

Default M9 priority after promotion is Photo Contest, then Mission/Town Walk, then the shared Citizen Editorial/Sketch lane, then Tourism/Regional Engagement as a composite. Stamp Rally initially remains a Mission variation.

A real-demand product decision may reorder future profiles; the executor may not infer or alter that priority.

## 15. KPI and demand-learning boundary

KPI baseline names are owned by roadmap v3 §10 and projected in `delivery.json#planning_metrics`; the product baselines rather than invents target percentages.

KPI measurement is subordinate to privacy/rights minimization. It must not introduce unnecessary user tracking.

Future profile/output selection uses the ordering principle:

`real demand x reuse value x existing Core fit x adoption/revenue effect / implementation and operational burden`.

This is a product-authority decision aid, not an executor-autonomous ranking algorithm.

## 16. Evidence interoperability

Stable Product Registry requirements are the product-owned bridge into the shared execution resolver.

- `requirements.json` owns the acceptance meaning, required `machine` / `design` / `human` evidence lanes, verification levels and the product dependency keys that invalidate prior evidence.
- The central resolver owns Claim IDs, Collector authority, exact-SHA identity, freshness, evidence reuse and every resolved state transition.
- Product Registry data must not contain caller-selected resolved status or central Claim IDs.
- Human and design evidence are independent lanes. They do not become valid because a machine test passed and must remain bound to the same exact source identity in the central resolver.
- Human View and AI Context Pack consume the central resolver projection; this repository does not create a competing state calculation.

This architecture contract by itself does not enable a runtime route, database writer, production mutation or customer communication. Runtime capability remains whatever current source and verified runtime evidence actually prove.
