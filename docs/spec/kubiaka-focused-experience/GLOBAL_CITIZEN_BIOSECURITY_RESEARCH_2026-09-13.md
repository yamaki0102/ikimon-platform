# Global citizen biosecurity reporting — evidence note

- Status: `EVIDENCE NOTE / NON-CANONICAL`
- Date: 2026-09-13 JST
- Purpose: support the Kubiaka design without turning one species-specific implementation into a new generic platform prematurely
- Related proposal: `NATIONAL_STRATEGY_ALIGNMENT_2026-09-13.md`
- Parent architecture: `../zukan-product-architecture/SPEC.md`

## 1. Finding

The strongest international pattern is not one database or one app per invasive species.

A more durable pattern is:

```text
shared observation / evidence core
+ target-specific identification and capture guidance
+ validation / expert review
+ risk- and jurisdiction-specific routing
+ revisit / management history
+ standards-based export
```

The public experience can look highly specialist while the underlying Record, Evidence, Claim, Review, Place, Case and Action responsibilities remain shared.

For ZUKAN this supports a `Biosecurity Domain Pack` with bounded target profiles. It does **not** justify a generic Focused Experience database, arbitrary custom-field engine, new auth system or species-specific backend.

## 2. International patterns reviewed

### EDDMapS — United States / Canada

Observed pattern:

- one large reporting and mapping network covers many invasive species and pests;
- volunteer and partner data are aggregated;
- observations are reviewed by verifiers before appearing in public queries/maps;
- professionals can revisit a site and record states such as present, negative, treated or eradicated;
- the same location can accumulate management history instead of being overwritten.

Design implication:

- occurrence and response history must be separate but linked;
- revisit is first-class;
- a verified distribution view should be a projection, not raw submission truth.

Sources reviewed: EDDMapS About, Collect Data, Apps/EDDMapS Pro, current query tools.

### EASIN — European Union

Observed pattern:

- citizens submit location and photos through web/mobile;
- expert validation occurs before citizen-science reports enrich the official EASIN geodatabase;
- only validated report data are publicly exposed;
- EASIN integrates heterogeneous source systems through validation, cleaning, standardization and mapping rather than requiring one source database.

Design implication:

- submission, validation, publication and official use are distinct states;
- ZUKAN should normalize at the exchange/projection boundary rather than force all partners into one physical schema.

Source reviewed: European Alien Species Information Network, Report Species and privacy/quality-control documentation.

### Asian Hornet Watch — United Kingdom

Observed pattern:

- species-specific public UX provides lookalike guidance and simple photo reporting;
- all reports are reviewed;
- credible reports are forwarded to the National Bee Unit or local monitoring teams;
- weak evidence can trigger a request for more detail rather than a false positive/negative conclusion;
- the specialist-facing experience sits on an established national alert/response path.

Design implication:

- specialist presentation is useful;
- lookalike guidance is part of data quality;
- `needs_more_evidence` is a valid terminal user-facing state for the current evidence;
- target-specific UX does not require target-specific data infrastructure.

Sources reviewed: GOV.UK/APHA Asian Hornet Watch material.

### MyPestGuide — Australia

Observed pattern:

- one Reporter accepts plants, diseases, weeds, animals and aquatic organisms;
- separate field guides and decision aids provide domain-specific identification help;
- experts identify reports and return feedback;
- sharing can be separated from submission;
- the system can also support structured absence evidence where the reporting context warrants it.

Design implication:

- generic capture + specialist guides is preferable to a new reporter per target;
- privacy/publication is orthogonal to evidence capture;
- absence must remain protocol-aware rather than inferred from casual photos.

Sources reviewed: Western Australia DPIRD MyPestGuide portal, Reporter guide and specialist guides.

### FeralScan — Australia

Observed pattern:

- one platform presents species-specific shells such as RabbitScan, ToadScan and FeralCatScan;
- users can record sightings, evidence, impacts and control activity;
- landholders can work in private groups and coordinate management across properties;
- reports can connect to local authorities and biosecurity groups.

Design implication:

- the same subject/place can accumulate `sighting → impact → control → follow-up` records;
- public, private-group and authority views should be projections over the same governed evidence;
- management activity is not a property of the original sighting.

Sources reviewed: FeralScan, FeralCatScan, RabbitScan, NSW Government FeralScan guidance.

### Mosquito Alert — Europe / international collaboration

Observed pattern:

- geolocated citizen photos feed surveillance;
- expert-validated images are used to train AI;
- AI performs real-time triage and quick feedback while critical/ambiguous reports are escalated to experts;
- expert validation remains distinct from automated classification;
- the project combines citizen observations with surveillance and research data.

Design implication:

- AI should rank/triage and help the contributor, not silently become final authority;
- expert capacity should be reserved for high-value ambiguity;
- model outputs and human verification need separate provenance.

Sources reviewed: Mosquito Alert data portal and AIMA peer-reviewed study.

### iRecord — United Kingdom

Observed pattern:

- automated checks flag difficult identifications, unusual geography and unusual seasonality;
- flags do not automatically reject a record;
- human verifiers decide whether records can be accepted;
- automated validation and expert verification are explicitly different concepts.

Design implication:

- `automated_validation_flags[]` must not be collapsed into `verification_status`;
- a report can be unusual and still be correct;
- rules require source/version/freshness because species ranges and seasons change.

Sources reviewed: iRecord automated checks and verification guidance.

### Find-A-Pest / Biosecurity New Zealand

Observed pattern:

- Find-A-Pest demonstrated broad reporting, community/expert identification and escalation of potential threats;
- the dedicated Find-A-Pest app is currently on hold and no longer supported because substantial technical upgrades would be required;
- New Zealand's official path continues through a stable web form and hotline feeding the same specialist response capability;
- New Zealand general surveillance combines public reporting with targeted surveillance programmes.

Design implication:

- avoid a proliferation of standalone species apps;
- web/shared-product surfaces should remain viable even if a campaign/profile disappears;
- urgent/high-risk routing may legitimately switch channel instead of forcing every case through one UI.

Sources reviewed: Find-A-Pest current status; New Zealand MPI reporting and surveillance guidance.

### IveGot1 / Florida

Observed pattern:

- app/web are preferred for lower-priority nonnative species;
- higher-priority species are explicitly routed to a live hotline;
- app reports can flow into EDDMapS and local/state verification.

Design implication:

- routing should depend on risk/priority and jurisdiction;
- `report channel` is profile/policy configuration, not a universal button.

Sources reviewed: Florida Fish and Wildlife Conservation Commission and EDDMapS Florida.

## 3. Behavioural evidence

A 2026 New Zealand national survey of 957 adults modeled citizen biosecurity reporting as a multi-step behaviour shaped by capability, opportunity and motivation.

The product implication is not to maximize gamification. It is to reduce the main reporting barriers:

- allow `I don't know what this is` submissions;
- make the reporting path easy to discover and complete;
- explain why the report matters;
- reduce fear of negative consequences or doing it wrong;
- return truthful feedback so contributors know what happened;
- distinguish audience needs instead of assuming one funnel fits everyone.

This also means that institutional processing capacity is part of the product outcome: collecting more reports without triage, review and feedback can make the system worse.

Source reviewed: 2026 Journal of the Royal Society of New Zealand study, `A Theoretically Grounded, Behaviour-Science-Informed Model for Understanding Citizen Biosecurity Reporting`.

## 4. Data reuse decision for ZUKAN

### Keep shared

Use existing ZUKAN responsibilities wherever possible:

```text
Record
Media / Evidence
Place / Entity / Subject identity
Claim / ClaimRevision
Review / Authority
Rights / Consent / visibility
Case
Action / Resolution / Follow-up
Publication / export
```

Do not add `KubiakaReport` as a new universal root.

### Target-profile configuration

A specialist page may bind a controlled target profile containing only the differences needed to collect and route useful evidence.

Proposed logical contract:

```text
target_profile_id
profile_version
subject_scope
lookalikes[]
signal_types[]
evidence_roles[]
photo_guidance[]
seasonality optional
risk_priority
review_policy
routing_policy
jurisdiction_policy
privacy_policy
public_precision_policy
official_source_editions[]
survey_protocol optional
```

This is a configuration contract over the existing Domain Pack, not authority to build a generic profile editor or arbitrary EAV/custom-field database.

### Record / Claim / Review / Action mapping

```text
photo + time + place + contributor         -> Record / Evidence
"クビアカかもしれない"                    -> Claim
AI candidate / range-season flag            -> Assessment / automated validation
expert identification                       -> Review / Verification
official authority handoff                  -> Case / Action
acknowledgement                              -> Action evidence
control / removal / treatment                -> new Record + Action result
later revisit                                -> new Record linked to same Place/Subject
```

Do not overwrite the original sighting when a later action changes the site state.

## 5. Casual detection vs survey/monitoring

International data standards reinforce the current Kubiaka boundary.

For casual public reporting, the reusable interoperability target is Darwin Core `Occurrence`: evidence that a taxon/subject was observed at a place and time.

For formal monitoring or absence/non-detection claims, use a versioned survey/Event with explicit target scope, protocol, effort, time and location. GBIF's Darwin Core Event / Humboldt guidance treats protocol and effort as necessary context for interpreting non-detection.

Therefore:

```text
casual photo with no target detected
!= formal absence
!= area safe
!= eradicated
```

ZUKAN should map outward to biodiversity standards at the publication/exchange boundary. It should not replace its internal Record/Claim/Case model with Darwin Core, because management, routing, rights and response history exceed an occurrence exchange schema.

Sources reviewed: GBIF Darwin Core, sampling-event data-quality requirements, Survey and Monitoring Quick-Start Guide / Humboldt Extension.

## 6. UX decision

The specialist page can be strongly target-specific while the data stays reusable.

For Kubiaka, show Kubiaka photographs, frass, host trees, lookalikes, Japanese official guidance and the correct local authority route.

For another target, swap the profile:

```text
Kubiaka          -> adult / frass / exit hole / host tree
Asian hornet     -> adult / nest / lookalikes / urgent route
invasive plant   -> whole plant / leaf / flower / habitat
mosquito         -> adult photo / breeding site / biting report
pest animal      -> sighting / tracks / damage / control / revisit
```

The capture shell, Record, Place, Rights, Review and Case/Action lifecycle stay shared.

## 7. What not to build now

Do not create:

- one app/backend/database per invasive species;
- a universal invasive-species state machine that mixes evidence, verification and management;
- arbitrary user-defined observation fields in the canonical Core;
- public raw-coordinate maps by default;
- automatic `reported to authority` state from link clicks;
- casual-photo absence claims;
- a generic Target Profile admin platform before a second concrete target proves the repeated need.

## 8. Recommended Kubiaka delta

Keep `/kubiaka` visibly expert and species-specific.

Change the data/design assumption from:

> Kubiaka has a dedicated reporting data model.

to:

> Kubiaka is the first high-consequence citizen-biosecurity Target Profile over the existing ZUKAN Biodiversity / Knowledge / Workflow responsibilities.

Implement only the Kubiaka profile fields required for the first vertical slice. Preserve the profile boundary so the same Record/Evidence/Review/Case structure can later support another invasive species without migration of the original Kubiaka records.
