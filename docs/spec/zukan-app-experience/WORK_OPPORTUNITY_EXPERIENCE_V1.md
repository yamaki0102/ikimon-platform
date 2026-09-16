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

## Execution and Done

Management Board `NOCOSIL-PORTAL-005` supplies the pure cross-product contract. `WFC-Z1-20260907` implements Z1–Z4 on current shared renderer/service and active Worker paths. `WFC-Z7-20260907` verifies actual recipient/public/guest transitions after Z1 and NOCOSIL application/public-exchange sources. One writer for shared UI/Worker routes; no independent key masking overlapping files.

Focused fixtures: F03–05,08,17,21 for source; F04–08,17,20–22 for integrated acceptance in the cross-product design. Reuse the existing Product Registry/Requirement tracking when needed; do not create a separate selection queue. Planned profiles stay unexposed until their actual runtime capability is verified.

Full Done includes Noah's actual responsive render, anonymous safe discovery, no private leakage, current expiry/withdrawal and real cross-product next step. Source merge or HTTP200 does not prove this. No synthetic production records, external messages, new legal/permission authority or unapproved release is created by this design.
