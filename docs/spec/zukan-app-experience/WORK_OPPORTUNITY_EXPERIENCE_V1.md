# ZUKAN Work Opportunity Experience v1

Status: ADOPTED DESIGN UPON MERGE / IMPLEMENTATION AND RUNTIME UNVERIFIED
Date: 2026-09-07 JST
Product/UX/copy/rendered acceptance owner: Noah.

## Source and boundary

Normative cross-product design: `yamaki0102/ikimon-business-strategy@01ead49fcbcc01694c19ae94c6da681658180e69:decisions/2026-09-07-workforce-experience-delivery-v2.md` (DEC-2026-09-07-WORKFORCE-EXPERIENCE-DELIVERY-V2). Local parents remain `ZUKAN_APP_EXPERIENCE_V1.md`, `PARTICIPATION_EXPERIENCE_V1.md`, current product architecture and rights/publication contracts.

ZUKAN is public discovery of work, workplaces and learning in regional context. NOCOSIL owns authorized recruiting/learning/receiving operations. Applicant/employee records, private membership changes, evaluation, meeting links, Personal records and private feedback never become public ZUKAN material. Use approved versioned public editions, not cross-database private queries. Existing public Organization/Place/Program identities remain authoritative.

## Navigation and resolved screens

Keep desktop navigation and mobile ホーム / 記録 / 撮る / 場所 / 参加. Never add a sixth 求人 tab, move 撮る or convert every program into a job. Add a contextual `仕事を探す` under 参加 and `この場所で働く` on eligible Place/Organization pages. Event attendance is not application consent; `仕事について知る` starts a separate explicit path. Preserve natural/cultural use and existing deep links.

Proposed additions, not current routes: `/jobs`, `/jobs/{publicOpeningId}`, `/jobs/organizations/{publicOrganizationId}`. Learning details reuse the existing Program URL resolver. Locale/canonical routing follows the host. No second employer identity store or internship portal engine.

Z1 discovery: place/keyword and usable filters, actual result state, job/employer/place/relationship/pay/schedule. Mobile compact readable rows; more filters on demand. List fallback without GPS/map; preserve filter/scroll on Back. Distinguish unknown salary from unpaid.

Z2 employer/workplace: real identity/place and purpose, typical/busy work, demands plus actual support, authorized real media/stories, offered visits/events, current openings. No invented count, fake AI staff or reputation score. No vacancy means truthful no-vacancy state, not a fake apply button.

Z3 opening: title/employer/location, explicit terms, duties/day, demands/support, realistic expectations, actual selection/visit flow, currentness and one primary `応募する`. Secondary interest/visit only when genuinely offered. Desktop readable content plus compact action panel; smaller widths single-column. Mobile action row sits above existing nav/safe area, not over text/keyboard. Closure disables new applications and structured eligibility with a distinct active-job path; delayed editions cannot reopen it.

Z4 learning: activity and learning objective, actual employment/pay, supervisor/plan/feedback, dates/safety/insurance and recruiting-use boundary. Paid student employment, Type3 and school linkage are independent properties. Unknown classification stays private; tours/education are not JobPosting just because they attract applicants.

Candidate transition names the employer and NOCOSIL's support role, preserves the approved public edition reference and uses an allowlisted destination. No forced ZUKAN/NOCOSIL paired accounts or repeated entry, no shared session/token. Candidate guide/application are private guest pages, not public Program detail.

## Tone, tokens and recovery

Use existing official logo/artwork and §16 of App Experience: green#143f2e, text#17211b, muted#55615a, white/surface#f7f7f3, existing Japanese sans and spacing. Body16px/1.7–1.8, metadata13–14, contentmax1200 with40/28/20 gutters. Header boundary1161; below it preserve five-item bottom navigation. Reuse existing Alpine/Tailwind/MapLibre; no new theme/font/icon dependency or decorative recruitment gradient. Safe media derivatives; no arbitrary crop or restricted-original fallback.

Headings identify facts/actions rather than assumed feelings. Useful headings include `どんな仕事をするか`, `忙しい時間と、覚えるまでの支え`, `応募してからの流れ`. Public copy comes from confirmed employer data, not the example text. Offline/error/empty/partial/closed/long-content states retain useful context and recovery. Test keyboard, IME,200% text, safe areas, 320/375/768/1024/1160/1161/1280 and Japanese wrapping. No screenshot-only success claim.

## Search and data integrity

Single-job structured data matches human-visible facts and eligibility. Pure tours/learning/employer pages use applicable schemas, not fake vacancies. Choose primary URL for equivalent branded copies; distinct regional/organization context is permitted, mass keyword doorway pages are not. Expiry/withdrawal propagate with edition/readback semantics. Search indexing/LLM visibility is not guaranteed by an API submission. Reuse existing public rights/media/syndication controls.

## Employer-wide external discovery and channel depth (owner 2026-10-15)

Cross-product authority: [`Workforce Experience Delivery v2 §10.1`](https://github.com/yamaki0102/ikimon-business-strategy/blob/main/decisions/2026-09-07-workforce-experience-delivery-v2.md#101-employer-wide-channel-choice-and-discovered-existing-employers--owner-correction-2026-10-15). This is an additive adoption of the prior channel policy; it does not declare external adapter access or production activation.

- **One choice per employer and destination, never one toggle per job.** In NOCOSIL's existing Organization recruiting context, show a compact `求人の発信先` control for providers with the only supported states `利用しない`, `掲載先を確認・リンク`, `連携して発信`. Disabled/permission-required options explain the exact missing verified capability. A configured provider applies to all that employer's currently eligible public jobs, including later editions, subject to provider all-jobs obligations. No sixth ZUKAN nav, employer admin app, separate ATS, new registration requirement or per-job channel checklist.
- Google: one organization-wide search-eligibility choice sets up each *real eligible opening detail* to have accurate `JobPosting`/canonical/expiry and authorized URL submission; neither `/jobs` list nor company/story pages get fabricated job markup. Indeed: connect only an approved employer-scoped partner/ATS or supported feed; its comprehensive all-open-jobs requirement overrides any imaginary per-post opt-in. A switch is **not** a placement confirmation.
- **Already-publishing local firms must be discoverable before joining ZUKAN.** Reuse existing public Organization/Place identity and the `/jobs` / employer-context experience. Discover and reference legitimate first-party recruiting sites, public employer-provided URLs, permissible feeds/JobPosting or authorized partner accounts. An **unclaimed external candidate** shows original site/source, observation time, uncertainty and a link to the original job page. It is not an employer-verified ZUKAN authored recruitment ad, authorized employee profile, or an opportunity for ZUKAN to redirect/accept applications. Do not copy entire restricted ads or scrape Indeed/other protected search results into a shadow job corpus.
- Employer owns publishing/claim verification, job conditions, active/closed status, destination permission and eventual application route. A verified organization may explicitly connect pre-existing external postings to one approved public opening/source edition (provider job ID + employer/site identity); avoid duplicates, fake freshness, cross-company identity merges and conflicting bidirectional writes. For unclaimed/stale posts label `外部の掲載情報（最新の募集状況は掲載元で確認）` and prefer an original link. For verified editions use exact current data only.
- Readers move naturally `地域/職場 → 仕事/企業紹介 → 社員インタビュー（記事/動画） → 現在の求人・見学 → 正式な応募先`. Video or employer context does not itself create `JobPosting`. Company-wide channel state is shown only to authorized employer editors; a public page displays separately evidenced public listings and updates, not the internal intended switch.
- Minimal QA: two employers A/B remain isolated; A's single channel setting applies to every eligible job and future update without per-job UI; private/closed/tour/interview do not syndicate; ineligible jobs are automatically excluded; Indeed unapproved access is disabled; existing unclaimed companies remain source-linked and clearly distinct from verified employer-authored postings; no misleading `掲載済み` before provider response/readback; company stop/correction propagates without stale re-opening. Verify mobile/keyboard/source/retry and actual permitted production journey separately.

Owners: existing `WFC-Z1-20260907` (ZUKAN discovery and public cards), `WFC-N6-20260907` (NOCOSIL organization policy and external channel reconciliation), `WFC-Z7-20260907` (Journey). Editorial context is [employee stories Issue #1899](https://github.com/yamaki0102/ikimon-platform/issues/1899). No parallel Work or custom provider connector is implied.

## Execution and Done

Management Board `NOCOSIL-PORTAL-005` supplies the pure cross-product contract. `WFC-Z1-20260907` implements Z1–Z4 on current shared renderer/service and active Worker paths. `WFC-Z7-20260907` verifies actual recipient/public/guest transitions after Z1 and NOCOSIL application/public-exchange sources. One writer for shared UI/Worker routes; no independent key masking overlapping files.

Focused fixtures: F03–05,08,17,21 for source; F04–08,17,20–22 for integrated acceptance in the cross-product design. Reuse the existing Product Registry/Requirement tracking when needed; do not create a separate selection queue. Planned profiles stay unexposed until their actual runtime capability is verified.

Full Done includes Noah's actual responsive render, anonymous safe discovery, no private leakage, current expiry/withdrawal and real cross-product next step. Source merge or HTTP200 does not prove this. No synthetic production records, external messages, new legal/permission authority or unapproved release is created by this design.
