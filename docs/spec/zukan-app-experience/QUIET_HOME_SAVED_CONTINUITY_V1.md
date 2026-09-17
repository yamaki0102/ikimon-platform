# ZUKAN Quiet Discovery and Saved Continuity v1

Status: ADOPTED DESIGN / IMPLEMENTATION AND RUNTIME EVIDENCE SEPARATE
Date: 2026-09-17 JST
Owner: IKIMON
Work: ZUKAN-HOME-SAVED-CONTINUITY-20260917

## Decision

ZUKAN connects people to places, public knowledge, opportunities and participatory experiences. Food, employment, travel, events, offers, learning, culture and nature are peers. NOCOSIL connects authorized information and personally meaningful activity to continuing thought, life and work. Both may capture, save, search, compare, use AI and publish. Their difference is the user journey and accountable responsibility, not an exclusive feature or a public/private slogan.

A ZUKAN-only user must be able to discover, save, create records and participate. NOCOSIL remains optional. ZUKAN is not reduced to a data collection sensor or NOCOSIL publishing outlet. NOCOSIL is not reduced to business/marketing and may itself have public surfaces.

## Home and discovery

Keep a stable shell: explicit search/context, bounded relevant content, and a stable return to saved items and own records. Do not move primary navigation based on inferred persona. Specialist pages remain direct destinations; login preserves the requested page and does not force Home. Capture remains available, but is neither a universal dominant CTA nor the reason for a universal Home.

Scope a discovery request by the area/online reach, dates/timezone, and immediate purpose the user actually chose. Current location, home area, future destination and subscribed areas are different. An explicit destination outranks location inference. No location permission on launch; denied location must not block text search. Do not infer permanent job-seeker, parent, traveller or lifestyle categories from a save.

No unrelated universal recommendation stream, infinite Home feed, automatic carousel, ad-first layout or compulsory AI chat. A compact result shelf has one coherent purpose, not merely a shared promotion budget. Initial budget: at most three shelves and three preview items per shelf; this is a testable density ceiling, not a universal optimum. Keep enough information to distinguish a job, offer and event. Existing urgent safety/recovery/active-participation notices remain compact and distinct from recommendations. Normal discovery is not a task inbox.

Public discovery, the user's private saved relationships and private own-record history remain visually distinguishable. Public-page accessibility is not homepage/media-promotion consent. Hide unavailable capabilities rather than render fake jobs, prices, events or reservation actions. Missing data, no matches and failed loading are separate.

Only verified current capabilities enter the production Home. The first source slice provides existing record search, Places and Participation plus private Saved. It does not claim that food/jobs/travel portals or their transactional flows are live. The new Home uses an explicit rollout flag until rendered and registered-runtime acceptance. Ordinary Saved is independently testable.

## Representative scenes / acceptance

| Scene | Explicit context and useful response | Must not happen |
|---|---|---|
| Local day / lunch | Selected area, time, food conditions; current supplier details | Unrelated job/insect cards, invented opening hours |
| Weekend / family outing | User-selected date, accessibility/companions only when supplied | Infer children or family composition from account history |
| Travel planning | Future destination, local dates, stays/food/experiences/events | Reset destination to GPS or imply a saved hotel is reserved |
| During travel | Explicit nearby request, available time, saved nearby candidates | Continuous precise-location tracking, fabricate availability |
| Event trip / business trip | Anchor event or user purpose, relevant before/after options | Import private calendar or employer data without permission |
| Return home | Offer a clear return to chosen home area; retain travel saves | Silently erase the trip or broadcast past movement |
| Job search / relocation | Work mode, eligible areas and explicit conditions | Infer job-seeking to employer Workspace or equate a click with application |
| Remote job / online course | Online/remote reach and actual eligibility | Require fictional physical Place or infer nationality from locale |
| Community / field activity | Existing Program, selected occurrence and participation state | Collapse interest, registration, attendance and contribution |
| Record revisit / learning | Own authorized record or eligible publication, time and provenance | Treat AI candidates as confirmed knowledge |
| Browse only / no location / no account | Public search/detail remains useful | Force NOCOSIL or personal profiling to discover |
| Low connectivity / error | Preserve existing saved result; actionable retry and unknown state | Success before persistence or failure as empty results |

## Saved relationships

Saved is a private relationship to an existing typed object, not a duplicate Job/Event/Place/Record database. One relationship per ZUKAN user + object kind + stable object ID; localized locators do not duplicate it. Store only safe canonical path, user-visible title with attributed provenance, save/update time, desired state and monotonic revision. Do not copy media, raw source documents, private notes or precise coordinates just to bookmark.

One deliberate save is enough. Collection labels such as a trip are optional and explicitly chosen; search text is not silently attached. Saved does not imply endorsement, durable preference, travel intention, reservation, application or attendance. No ordinary browsing/cursor/scroll history enters NOCOSIL. Confirm only the persistence that succeeded.

Use desired-state writes with an expected revision and idempotent command identity, never a blind toggle. Remove produces a tombstone/current removed state so delayed retries cannot recreate it. A title or listing snapshot is not an assertion that its public information remains current. A withdrawn public object becomes unavailable on revisiting; independent user-authored personal notes are not silently deleted.

## NOCOSIL continuity

Do not introduce a shared giant product database or a third identity/activity service as a prerequisite. Reuse domain-local sessions, existing connector/account-link/authority and Continuity Source/Record/Claim/Receipt mechanisms; add a narrow bilateral link only where the existing machinery has a proven gap. Same email, browser, organization membership or operator does not prove cross-product authorization.

Link only after the user proves both intended accounts and grants an explicit scope. Default destination is the user's Personal Security Domain, not whatever Organization/Project happens to be open. Keep source owner, actor and provenance. Household/Organization/Project promotion needs its own selection and authority; no passive copy into an employer Workspace.

Consent dimensions: saved relationships; own-record references; verified participation/contribution receipts. Private originals, historical backfill and any extra metadata are separate opt-ins. Initially none are automatically linked. An unlink stops new delivery and must distinguish retaining permitted private history from erasing derived data. Relinking another account cannot reuse the former mapping, cursor or grant. Minors and restricted data fail closed under existing rights.

ZUKAN is canonical for save/remove, Record, Program and ZUKAN participation/publication. NOCOSIL holds a purpose-bound personal projection, linked by origin object and revision, plus its own independent notes/plans. It must recheck current authorization before reading or delivering. Replay, out-of-order revision, correction, withdrawal and revoked grants never resurrect newer state. Reject extra fields, other people's identities, precise locations, arbitrary URLs and unverifiable claims.

A bridge-ready projection is not a connected account, a server queue, successful synchronization or an authenticated browser flow. Do not offer a fake connect button or show synchronized until both actual endpoints and persisted grant/receipt read-back are verified. A bounded transfer failure must not block ZUKAN saving. Delivery may reuse the existing outbox/queue and retries when activated; do not run an LLM per save.

## Supersession and implementation

Within the cross-surface Home scope, earlier assistant suggestions that Home must always be a personal-photo hero, must be a general Attention inbox, must mix all portals in one feed, or must automatically rearrange primary tabs by scene are superseded. Earlier prescriptions based only on feature possession or public/private labels are not product authority. Current specialist routes, safety/recovery and working capture/participation remain valid.

The broad Shared Identity & Activity draft is not adopted wholesale by this document. Its useful account-proof and receipt semantics are preserved, but a new central plane/principal migration remains unnecessary until demonstrated. No production migration, forced identity merge, real-user consent, publication, new spending, DNS/IAM or external-send authority is inferred from design adoption.

Use existing source, migration and release mechanisms. Verify server authorization, real SQL persistence and CAS, no cross-account disclosure, multi-language rendering, keyboard/focus, retry, responsive layout and explicit runtime boundaries. Record exact source and results in NOCOSIL Work, not percentages or a new parallel Board.

## Reproducible first-slice verification

From `platform_v2`, run the Saved/Home focused Node tests and `node --import tsx e2e/saved-continuity.local.mts`. The browser script uses an ephemeral SQLite database, seeded synthetic sessions and the actual Worker/router/renderers; external requests are suppressed. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an already installed compatible Chromium and `ZUKAN_SAVED_QA_DIR` can retain evidence outside the repository. This proves local behavior, never actual bilateral account linking, staging or production.

The first source slice includes a private Saved schema/API, existing record-list save controls, a private Saved view and optional quiet Home. Place/Event/Job/Offer/Stay/Experience types preserve distinct reference semantics; their full discovery and transactional portals are not implemented by this slice. Other object save controls, source withdrawal/account deletion reconciliation, authenticated bilateral linking and real synchronization require subsequent source/runtime evidence.
