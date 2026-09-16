# Quiet discovery and personal continuity

Status: ADOPTED DESIGN ON MERGE; source, browser, staging and production are separate evidence.
Owner: IKIMON. Decision: explicit owner request, 2026-09-17 JST, to reconsider this conversation from first principles and implement.
Parents: DESIGN.md; ZUKAN_APP_EXPERIENCE_V1.md; product SPEC/PROFILE_HORIZON; Global Platform Bundle revision 2 (2026-09-13).
NOCOSIL boundary: its Constitution, Experience Contracts, Security Domains and native import/capture contract. This document does not redefine NOCOSIL.

## 1. Product decision and scoped supersession

ZUKAN lets a person discover, understand, compare, save, record and take part in the world through peer public experiences. Food, jobs, events, offers, travel, learning, services, culture and environmental records are peers. Citizens remain contributors, not merely a source of data for businesses.
NOCOSIL lets a person or organization reuse authorized context across sources to understand, plan, create, act and continue. It also supports capture, discovery and public publishing. Neither camera/chat nor public/private nor work/leisure is an exclusive product boundary.

For the cross-surface logged-in Home, supersede the interpretation that a recent personal photo or a compulsory next task must dominate every visit. Keep private record return, draft recovery, rights/consent actions and current specialist navigation. Do not remove guest/specialist entry or a working path before its replacement is verified.
Prior chat suggestions of a mixed general feed, automatic reordering of navigation, mandatory camera-first onboarding, world/public versus owned/private exclusivity, and a permanently mandatory central Home are superseded. Existing photo and observation experiences remain first-class peers.

## 2. Stable small surface, explicit temporary context

The common frame has a clear current exploration scope, stable discovery entrances, a private return to saved material, and optional bounded content. No endless cross-domain feed, compulsory assistant, task dashboard, automatic carousel, promotional wall or empty metric cards.

Home is optional: an event, restaurant, job, QR or saved deep link stays at that destination across login and Back. Core navigation positions do not rearrange based on inferred intent. Additional specialist surfaces appear only after their actual routes, content and conditions are verified. Availability is not inferred from a catalogue entry or test fixture.

Context is selected location/service area + time interval + immediate purpose, not a permanent user stereotype. All are optional. Explicit URL/selection outranks a previous selection; precise GPS is requested only on a user action. An explored travel destination never overwrites home area. A return from travel does not silently reset another active search. Online/remote experiences require no fictitious Place. Language, date-only days, source timezone and jurisdiction are separate.

Preserve typed result meaning: jobs expose employment conditions/application destination; events occurrence/availability; food branch/menu/serving conditions; offers eligibility/expiry. Saving is not applying, booking, subscribing, liking, attending or visiting. Unknown availability/price/accessibility/allergy/rights must remain unknown. A provider handoff is not a confirmed transaction.

Home may show up to three nonempty content groups with up to four entries each, selected under one explicit purpose. This is an initial density budget, not proof of usability. Do not fill unused space. A search result list can be longer and paginated within its own explicit purpose. Never mix job candidates into an evening-meal list merely to fill a slot. Specialist menus are not limited to three results.

## 3. Scenario acceptance

| Scenario | Expected behavior | Must not happen |
|---|---|---|
| New user, no location | Immediate public discovery; save sign-in only at action | Forced posting or location grant |
| Local lunch | Food conditions for the selected place/time | Jobs or nature cards in the same ranked list |
| Unplanned weekend | Events/experiences with explicit dates | Fake availability or mandatory planner |
| Travel inspiration, no destination | Regions/guides can be explored without a trip object | Fake exact GPS or dates |
| Travel planning | Destination/dates remain visible; save candidates together | Change permanent home or assert a reservation |
| Travel in progress | User-selected nearby scope; provider hours/freshness | Passive tracking or implicit hotel disclosure |
| Return from travel | Saved trip remains; current scope is user-controlled | Erase trip or automatically replace active search |
| Group/family travel | Explicitly shared selection when requested | Household membership inferred from co-location |
| Business travel | Public search still works without expense tools | Require NOCOSIL for discovery |
| Remote work/online course | Service/eligibility areas and timezone | Invent physical Place or require GPS |
| Career exploration | Private saved jobs, no employer notification | Infer unemployment, disclose interests to Organization |
| Festival/stamp rally | Open exact event/occurrence; resume its actual state | Route every action through general Home |
| Nature/citizen capture | Existing private capture/recovery and Record rights | Commercial discovery displaces records or forces public posting |
| Overseas/RTL/low bandwidth | Selected language and readable layout; no map prerequisite | Locale interpreted as nationality; translation treated as permission |
| Withdrawn/deleted source | Neutral unavailable reference, no actionable stale claims | Replay a removed public photo/price/job from a saved snapshot |
| Link outage or unlink | ZUKAN saves still work; precise pending/disconnected state | Successful save falsely described as NOCOSIL sync |
| Shared phone/account switch | Server session scopes all saved data; no public caches | Another person's favorites appear |

## 4. One private relationship, not a second copy of public truth

ZUKAN owns its user-to-source saved relationship and its source Records/Program states. The issuer owns its published conditions; a listing is not the employer/provider itself. NOCOSIL owns its separately authorized notes, plans and contextual projections. Store stable typed source reference plus a private save state/revision, not a duplicate article, media library, user profile or booking record.

Save and remove use compare-and-set revisions. Repeating the same mutation is safe; an older save cannot resurrect a later removal. Unsave removes the active relationship. A bounded tombstone preserves stale-write protection; a separate account deletion lifecycle governs erasure. No indefinite browsing-event log, scoring or global behavior graph is added.

Favorites are private even when the source is public. Passive views, search queries, precision coordinates, private media, contacts, rosters, guardian material and raw NOCOSIL conversation are excluded from the bridge. Searching a job does not mean job-seeking; saving a restaurant does not prove liking or visiting it.

Saved metadata is resolved through the source's current public visibility, without the user's cookie. A removed/denied source becomes unavailable; a source outage is different from withdrawal. Do not retain former public titles/media by accident as a fallback. User-authored private notes are separate from source-owned content.

## 5. NOCOSIL continuity and identity

Target: after optional explicit linkage and category/destination consent, selected saves and verified activities become reusable personal context without repeated confirmation. Link by proof of both authenticated accounts, never equal email, guessed identity or a shared cookie. Link identity, content access, purpose and publication permission remain separate. Do not build a third global Identity/Activity service merely because a historical draft named one.

The default destination for personal exploration is the person's authorized Personal domain, not the currently open employer workspace. Explicit Organization/Project save requires a visible acting-as/destination and minimum safe payload. No transfer until both destination and rights are established. Historical backfill is separate from future linkage consent. A source change does not automatically modify a user's travel decision or edited note.

Every continuous receiver must authorize current link/grant and owner; apply monotone source relationship revision and idempotency; re-check rights; preserve current active versus removed; separate publisher expiry from user deletion; propagate link revocation and derived-index removal; avoid deleting independent personal notes. Offline/error delivery is not a receipt. Never promise exactly-once effects or total third-party erasure.

Source Record media stays under its original lifecycle. A reference alone is not a personal archival backup. Explicit archival copy, where permitted, must state ownership, cost, scope and withdrawal behavior separately.

NOCOSIL uses its ordinary conversation/contextual view and existing capture/import/review. No favorite-specific dashboard, second search engine or mandatory new wizard. ZUKAN remains useful without NOCOSIL.

## 6. Implementable first slice and truthful boundary

First slice: a private typed saved-reference API in the active Worker, current public-source validation, server-session ownership, optimistic revision checks, a saved view in the existing Records surface, bounded quiet Home entrances, and explicit selected reference export compatible with the existing NOCOSIL import bundle.

An exported bundle is a user-directed point-in-time interest snapshot, not a current linked favorite, proof of account linkage, booking/attendance attestation or successful import. It contains no credentials, user IDs or private originals. The receiving product must still apply authenticated destination/rights checks. The UI must say export, never synchronized.

Automatic linkage, ongoing save/remove synchronization, media references to private own Records, cross-product activity receipts and verified native NOCOSIL conversation handoff are subsequent integration acceptance boundaries. The source-only converter/export must not be reported as those capabilities. Do not install credentials, apply remote migrations or publish by adopting this document.

First-slice implementation does not launch jobs/food/stays commercial profiles or fake their content. Preserve their design space and admission interfaces, while exposing only existing verified source families. Route-specific content and native transaction integrations stay separate Works.

## 7. Verification and outcome

Prove an authenticated user can save an eligible source, reload, retrieve it, remove it and not have an old retry revive it. Prove another account cannot retrieve it. Test missing schema, unavailable source, rejected URL, expired session, cross-origin write, partial list and precise error state. Verify native Worker dispatch, not only a pure module.

Inspect Home and saved UI at 320/375/768/1280/1440 with real Japanese labels, keyboard, busy/error states and no horizontal overflow. Reuse original draft/rights/privacy tests. Validate exported bundle against NOCOSIL's actual import parser and local persistent store. No real user records are created for testing.

Measure task completion/retrieval/saved durability and time to useful destination, not session length, compulsive opening, likes or number of AI calls. Rendering limits are hypotheses to verify with users, not universal scientific claims. Store Evidence/Resume in the existing IKIMON Work.
