# ZUKAN Participation Experience v1

Status: `CANONICAL PRODUCT EXPERIENCE EXTENSION`
Date: 2026-09-05 JST
Owner: Noah
Applies to: ZUKAN public/member participation discovery, Program/Event detail, join/resume/day-of/recap surfaces
Upstream semantics: `docs/spec/zukan-product-architecture/SPEC.md` §17
Base experience: `docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`
Acceptance cases: `yamaki0102/all-projects-management/operations/decisions/2026-09-05-participation-acceptance-v1.md`

## 1. Authority and purpose

This file closes the user-facing participation UX that is intentionally more specific than the base App Experience.

For participation surfaces, use this order:

1. safety / rights / privacy / accessibility and current product truth;
2. product architecture semantics in `SPEC.md`;
3. this participation experience contract;
4. the base App Experience for shared navigation, typography, color, capture and general state behavior;
5. current implementation conventions.

Where this file gives a more specific participation label, layout, ordering or state rule, it refines base App Experience §§8, 16.7 and 17. It does not replace Program/Event/participant/Record semantics, rights, free-core entitlements or the ZUKAN/NOCOSIL boundary.

Goal:

> A person should be able to find something relevant, understand whether and how they can participate, complete or continue the necessary action, handle changes, use the experience on the day, leave a private record, and later return to that record without learning the organizer's operational system.

The product is not an event marketplace, ticket wallet, facility-management suite or social network. ZUKAN remains `見つける・記録する・参加する`; new organizer work belongs in NOCOSIL and specialist transactions stay with their authorized provider.

## 2. MECE coverage model

Participation UX is complete only when the changed scope is coherent across these eight lifecycle stages. Genre is metadata, not a lifecycle stage.

| Stage | User question | Primary ZUKAN responsibility |
|---|---|---|
| 1. 発見 | 何か参加できるものはある？ | Public Home / `参加` / Place / deep linkから見つける |
| 2. 比較 | いつ・どこで・誰が・いくら・自分が参加できる？ | 一覧で判断材料を揃える |
| 3. 理解 | 何をする企画で、条件や変更は？ | 詳細で事実・出典・現在状態を読む |
| 4. 手続き | どう参加する？ | walk-in / native RSVP / invite / external provider等の正しい入口へ |
| 5. 参加後 | 申し込みはどうなった？次に何をする？ | `自分の参加`でselected scopeとcurrent stateを返す |
| 6. 当日 | 今どこへ行き、何を見ればいい？ | 時刻・集合/接続・変更・安全・必要な参加URL/受付を返す |
| 7. 記録 | 参加中・参加後に何を残せる？ | Event/Program文脈を保ったままprivate Recordへ |
| 8. 振り返り | 自分は何を残した？地域には何が残った？次は？ | 自分のRecord、許可済みrecap、Place、次のProgramへ戻す |

Each stage must distinguish these decision dimensions when they apply. Do not flatten them into one status or one event type:

- **what**: title, short purpose/content, profile/genre only when supported;
- **when**: date-only, exact time, duration, recurrence, opening period, exceptions, timezone;
- **where/how**: Place, meeting point, online, hybrid, selected part/occurrence;
- **who**: organizer/issuer, audience/eligibility, guardian or companion condition when required;
- **cost**: free, known price, provider-confirmed price, unknown/not obtained;
- **entry**: no application, native request/RSVP, invite, waitlist/selection when supported, external booking/provider;
- **state**: upcoming/live/ended, requested/accepted/waiting/changed/cancelled/unknown as actually evidenced;
- **trust**: source/update time, rights/consent, safety notice, provider freshness and explicit unknown.

`not applicable`, `unknown` and `not obtained` are valid states. Do not invent a value to make a card look complete.

## 3. Information architecture and entry points

The global navigation remains the base contract: `ホーム / 記録 / 場所 / 参加 / 自分`, with `撮る` as the shared primary action.

`参加` owns public discovery and the participant's own participation state. It does not own new organizer operations.

Supported entry classes:

- Public Home → a compact `参加できる企画` entry in the first meaningful scroll region;
- global `参加` navigation → Participation Hub;
- Place detail → Programs actually related to that Place;
- public Record/detail → related Program only when an authoritative relation exists;
- search/result/share → stable public Program/Event detail URL;
- invite/deep link → exact target Program/Event/part, preserving target through authentication;
- member Home → active, changed or upcoming participation when the Home priority resolver selects it;
- recap → related Place, own records and truthful next participation opportunities.

Do not require login before reading an otherwise public participation detail. Request authentication only at the action that actually requires identity or entitlement.

Do not request device location on page load. Location use begins only after an explicit `現在地の近くを見る` or equivalent action.

Back navigation from detail must preserve the discovery query, filters, selected area and scroll position when technically available. Returning from a login or provider handoff must preserve the exact intended Program/Event/part instead of returning to the generic hub.

## 4. Participation Hub

### 4.1 Page job

The page answers:

`今、参加できるものを探す / 自分が参加するものを確認する。`

The hub is product UI, not a marketing landing page. Do not use a large dark hero, decorative gradient, generic SaaS dashboard, count cards or organizer-first CTA.

Canonical Japanese H1: `参加`

Optional one-sentence lead:

`まちで開かれている企画や、自分が参加する企画を探せます。`

Primary page-level modes:

1. `参加できる`
2. `自分の参加` — only when meaningful; guests can choose it and receive a small login explanation rather than having all public discovery gated.

Do not use `募集中` as the only public mode because walk-in events, exhibitions, tours with provider inventory and already-running Programs may be discoverable without a ZUKAN recruitment state.

Organizer entry is visually secondary and separate from participant content:

`企画を運営する方へ`

It may hand off to the accepted NOCOSIL organizer surface when available. Until replacement acceptance, preserve the existing compatibility host route for entitled organizers. Never place `もう一度開催` or `企画を作る` on ordinary participant cards.

### 4.2 Default grouping and ordering

Without a search query or explicit sort:

1. currently actionable / happening now;
2. upcoming by the next meaningful start or availability date;
3. long-running/open-period Programs where the next actionable availability is known;
4. ended items only behind an explicit past/history entry.

Do not invent AI relevance ranking. If two items have the same effective time, use a deterministic stable tie-breaker.

An ended Program is not shown as currently joinable merely because its public page still exists.

## 5. Discovery, search and filtering

Keep the default surface small. The minimum useful controls are:

- keyword search across supported public title / organizer / Place text;
- time: `今日`, `今週末`, `これから` when the underlying dates can support them;
- place/mode: selected area / explicit current-location action / `オンライン` when supported;
- `条件を絞る` for additional supported facets.

Additional facets may include genre/profile, free/paid, application requirement, language, age/audience or accessibility only when current data has a trustworthy meaning. Do not add an empty filter just because the final domain model could represent it.

A filter changes only discovery projection; it does not change Program state or participation eligibility.

Normal zero results and load failure are separate:

- zero results: `条件に合う企画は見つかりませんでした。` + clear filters / broaden area;
- no current public Programs: `いま参加できる企画はありません。` + invite/deep-link route if applicable + public Records/Places path;
- failed load: keep already-loaded results when safe, state `企画を読み込めませんでした。` and offer explicit retry.

Do not use fake future profile cards, skeletons that never resolve, or `準備中` cards to create visual density.

## 6. Result item / card contract

A result must support fast comparison without exposing internal schema or organizer operations.

Decision order:

1. current public status only when useful (`開催中`, `受付中`, `申込不要`, `終了`, etc.);
2. next relevant date/time or active period;
3. title;
4. Place / online / hybrid mode at the allowed precision;
5. organizer/issuer;
6. application method and price/known condition when material;
7. one participant-facing action: normally `詳しく見る`.

Optional media is secondary to the decision facts. Use a real authorized image when available; otherwise omit the image region rather than using stock/generated filler.

Do not show:

- internal observation mode names such as `effort`, `absence` or architecture terms;
- a mode badge merely because a database enum exists;
- participant counts unless current rights and source semantics make them meaningful;
- `残りわずか`, `人気`, `おすすめ`, `締切間近` or similar persuasion without authoritative data;
- organizer actions on the same card;
- a direct `参加する` CTA when the user has not yet had a reasonable chance to see conditions that materially affect participation.

### Visual composition

Prefer a chronological editorial list over a repeated generic card grid.

Desktop/tablet result row:

`date/time block → optional thumbnail → title + facts → status/action`

Mobile:

`date/time → title → place/mode → organizer/price/application → action`, with an optional compact 4:3 thumbnail that never pushes the title below the first useful viewport.

Use the base ZUKAN palette and spacing. Status is text plus shape/border where needed, not color alone. Avoid emoji as primary UI icons.

## 7. Program/Event detail contract

### 7.1 First viewport

A normal person should be able to answer the following before reading long body copy:

- 何をする？
- いつ？
- どこ / オンライン？
- 誰が主催？
- いくら？
- 自分はどう参加する？
- 変更・中止・未確認はある？

Order:

1. meaningful current-state notice when changed/cancelled/unknown;
2. H1 title;
3. date/time or period;
4. Place / online / hybrid and meeting information at allowed precision;
5. organizer;
6. price / entry condition / application owner;
7. exactly one current primary participant action when one exists.

The primary action label must describe the actual next step:

- `参加方法を確認` — no ZUKAN transaction is required;
- `この回に申し込む` — native request/RSVP exists;
- `参加希望を送る` — interest/request is not acceptance;
- `予約サイトで確認する` — external provider owns booking/inventory;
- `キャンセル待ちを申し込む` — only when waitlist is implemented and authoritative;
- no action button — ended/cancelled/unavailable/unknown states where a safe action is not available.

### 7.2 Detail sections

After the decision summary, render only applicable sections in this order:

1. `内容` — concise human-readable purpose/content;
2. `日時・場所` — recurrence, exceptions, timezone, meeting point or online mode;
3. `参加方法` — selected part, eligibility, party unit, application/booking owner, price;
4. `当日の案内` — only when actual guidance exists;
5. `安全・持ち物` — source-backed conditions only;
6. `主催者・出典` — organizer, source/update time, correction/contact path where public;
7. `この場所・企画の記録` — only rights-safe related Records;
8. `関連する企画` — only truthful relations or deterministic local continuation.

Do not render empty section shells.

### 7.3 Multi-part and recurring Programs

A multi-program day uses a readable chronological agenda. Each independently selectable real part exposes its own time, condition and current participation state.

`この時間だけ参加したい` is a requested scope until accepted. Never mark the parent Program and every sibling part as accepted because one part was selected.

Recurring Programs show a finite useful window and exceptions. Do not generate an endless list of Event objects or a wall of every future occurrence.

Long exhibitions, opening periods and always-on experiences show the period/opening information first; they do not become one fake Event per day.

## 8. Participation action and handoff

The participation action is a state transition, not a marketing conversion.

### 8.1 No-registration / walk-in

Do not create a roster merely to record intent. Show the authoritative participation instructions, access limits and change source. The user can still record privately before/during/after the experience.

### 8.2 Native request / RSVP

Ask only what the current participation contract needs: selected scope, quantity/unit, authorized proxy/guardian information when actually required, and required consent/conditions.

Do not combine application consent with photo publication, advertising reuse, AI provider transmission or unrelated communication permission.

Submission states are explicit: editing → submitting → requested/accepted or truthful pending/error. Retry must converge on the same logical request where the backend supports idempotency.

### 8.3 Invite / deep link

The link identifies the intended Program/Event/part without exposing reusable secrets in public HTML. Authentication returns to that exact target. Invite possession does not grant unrelated roster, organizer or Place permissions.

### 8.4 External booking / payment / ticket

The action names the provider and leaves ZUKAN clearly:

`○○で予約状況を確認`

A click or browser return is not confirmation. Display `予約済み`, `支払済み`, `チケット発行済み` or equivalent only from the provider/evidence that owns that state.

If provider availability is stale or unavailable, say so and link to the authoritative confirmation path. Do not encourage duplicate purchase merely because ZUKAN could not read back the state.

### 8.5 Interest / threshold-based formation

Use language such as:

`参加希望を送る`

and immediately state:

`開催確定ではありません。日程が決まった場合は、あらためて参加確認が必要です。`

Reaching a threshold is not itself organizer/staff/safety confirmation.

## 9. `自分の参加`

This is the participant's operational return surface, not a social activity feed.

Group by what the person needs to act on:

1. `確認が必要` — material change, offer, pending selection, payment/booking uncertainty when the product can evidence it;
2. `これから` — accepted/requested future scope;
3. `参加中` — current active scope;
4. `過去` — ended/completed/cancelled history.

Each item shows:

- title;
- exact selected/accepted part or scope;
- date/time / location or online;
- current evidence-backed participation state;
- one next action.

Do not collapse `希望`, `申込中`, `承認済み`, `予約済み`, `支払済み`, `当日参加`, `完遂` into `参加済み`.

When exact schedule is known, a lightweight `カレンダーに追加` may use a standards/native handoff such as an `.ics` download. Do not build a second calendar system inside ZUKAN.

## 10. Change, cancellation and recovery

Material changes are more important than decorative content.

When a user opens an affected Program or own-participation item, show:

- what is currently true;
- what changed when prior truth is available and useful;
- when it changed / source update time;
- whether the user's accepted scope is still valid;
- the one next required action.

Do not mark a notification as received/read merely because ZUKAN generated it. Delivery, read receipt and the current Program state are separate.

Cancellation, postponement without date, reschedule, sold out, waitlist, provider-unknown and ended are different states.

A partial cancellation changes only the affected part. A past private Record remains the user's Record even when the related future Program is cancelled.

## 11. Day-of experience

When an accepted/current Program becomes the highest-priority member state, Home may surface it as the primary action.

The day-of view prioritizes:

1. today/current date and selected time;
2. meeting point or authorized online access;
3. changed/cancelled notice;
4. current organizer instruction / safety contact where public/authorized;
5. check-in or provider ticket only when that mechanism is actually supported;
6. `この企画の記録を残す` when capture is permitted.

Do not make a user re-enter the Program from the generic discovery hub on the day.

Offline or degraded mode must not claim check-in, ticket validation or duplicate-free admission unless the actual offline mechanism proves it. Preserve already-known safe instructions when possible; label stale/unknown values rather than silently refreshing them into success.

## 12. Record during and after participation

Participation and publication are independent.

`この企画の記録を残す` may pre-bind the current Program/Event/part context, but the new Record follows the normal base capture contract:

- private by default;
- media/source saved independently of AI success;
- optional location unless the specific Program legitimately requires a different existing rule;
- explicit publication and field-scoped rights;
- no automatic Program/public projection merely because the user participated.

A participant may keep a private reflection with no public contribution. If they choose to publish a Record, reuse that same Record in the person's archive, Program recap and Place context rather than copying content into separate stores.

## 13. Recap and return

After an Event/Program ends, the participant-facing detail changes from action to return:

1. `自分の記録` from this participation;
2. approved/published Program recap when it exists;
3. related Place/history;
4. a truthful next related Program when available.

Do not use `科学的影響`, `地域への効果`, achievement numbers or celebratory claims unless the actual evidence and review meaning support them.

A recap is not permission to publish private participant media. Review/publish rules remain unchanged.

`もう一度開催` belongs only to an authorized organizer compatibility/NOCOSIL path, never to the default participant recap action cluster.

## 14. Public copy and editorial rules

Use plain Japanese that describes the present fact and next action. Prefer:

- `9月12日 13:00–15:00`
- `浜松市中央区 / 集合場所は申込後に案内`
- `申込不要`
- `予約状況は主催者サイトで確認`
- `日程が変更されました`

Avoid generic or coercive copy such as:

- `今すぐ参加して地域を変えよう`
- `心が動く体験`
- `おすすめイベント`
- `残りわずか` without inventory evidence.

Headings must be useful when scanned alone. Do not repeat `参加` in every adjacent heading, tab and button.

## 15. Visual and responsive contract

Participation uses the shared ZUKAN system from the base App Experience and cross-project design standard:

- brand green `#143f2e`, text `#17211b`, secondary `#55615a`, white and warm neutral `#f7f7f3`;
- existing Japanese sans-serif family;
- photography only when it helps recognition and has actual rights;
- restrained borders/surfaces; no decorative gradients, oversized hero typography or card-on-card nesting;
- 44px minimum touch target and visible focus;
- status meaning never depends on color alone.

### Hub

- H1: desktop roughly 40–48px, mobile 30–34px; do not consume a full viewport;
- one-column chronological list is the default comparison pattern;
- filters remain near results and collapse into `条件を絞る` on narrow screens;
- selected mode/filter uses text + border/aria-current, not color alone.

### Detail

- desktop may use a main reading column plus a compact action/facts column when the current source has enough facts;
- tablet/mobile stack decision facts and primary action before long body content;
- do not use a fixed mobile CTA that collides with the global bottom navigation or hides errors/conditions;
- long titles, organizer names, Place names, translated text and changed-state messages wrap naturally.

Required design review widths for affected participation work: 320, 375, 768, 1160/1161 transition, 1280. Add 1440 only when a shared wide layout is materially affected.

## 16. Accessibility, language and time

- primary public information remains usable without a map;
- keyboard order follows reading/action order and returns focus after dialogs/sheets;
- screen-reader names include action target when repeated labels would be ambiguous;
- errors are attached to the affected input and summarized when submission fails;
- zoom/reflow does not hide the participation state or primary action;
- date/time uses the Event/Program's authoritative IANA timezone when known and converts for the viewer only with an explicit local-time label where useful;
- date-only and unknown-time data remain date-only/unknown; do not create midnight times;
- language of the page and language of the actual experience are separate facts;
- translated public copy never implies a translated guide, subtitles or interpretation unless that is separately true.

## 17. Current M6 implementation correction

The current observation-event list is a compatibility implementation, not the desired permanent participation experience. Any implementation slice touching it must correct these current-source mismatches before adding broad profile UI:

1. participant discovery comes before organizer creation;
2. participant and organizer actions are visually separated;
3. ordinary result cards do not contain `もう一度開催`;
4. list copy uses the stable `参加` responsibility rather than making `観察会` the product-level boundary;
5. internal observation-mode labels are not primary public comparison fields;
6. ended events are history/recap, not mixed with actionable discovery;
7. current truthful M6 capabilities remain usable; no fake M9 profile cards are introduced.

Do not redesign the Program backend merely to satisfy these presentation changes.

## 18. Implementation slices

Keep delivery small and vertically useful.

### Slice A — current participation hub

Use existing M6 observation-event data/routes. Refactor the current list into participant-first `参加`, separate organizer entry, truthful current/upcoming/history sections and the result-item contract above. No new schema.

### Slice B — detail / join state

Reorder the existing join/detail surface to expose decision facts and truthful action state before observation-mode mechanics. Preserve invite/check-in/deep-link behavior and privacy.

### Slice C — own participation / day-of / return

Use existing participant/Event identity to return exact selected scope and next action. Surface active/upcoming Program from Home when the current resolver can prove it. Bind capture to the existing Event scope without changing private-default publication semantics.

### Slice D — broad Program profiles

Only after a profile is implemented and verified, add it to the same hub/card/detail contracts. Add fields/filters only for demonstrated unmet semantics. Do not create profile-specific navigation or organizer modules.

Implementation/runtime acceptance is separate for every slice. A docs merge does not assert that any slice is runtime-active.

## 19. Focused acceptance

For each changed participation slice, a normal user must be able to complete the applicable path without explanation:

1. Home/Place/deep link → exact participation detail;
2. hub → find an actionable current/upcoming item;
3. compare when/where/organizer/price-or-unknown/entry method from list/detail;
4. return from detail without losing discovery state;
5. understand one current primary next action;
6. distinguish no-registration, request, accepted, external booking and unknown when they apply;
7. after authentication, return to the exact intended Program/Event/part;
8. after an external handoff, never see false booking/payment success;
9. after participation state exists, find exact scope under `自分の参加`;
10. when a material change exists, see current truth and required action before promotional/body content;
11. on the day, reach current instructions without rediscovering the Program;
12. create a private Record from the Program context without automatic public projection;
13. after end, return to own Record and any approved recap;
14. keyboard/screen-reader/list fallback works without map-only dependency;
15. 320/375/768/1160-1161/1280 layouts keep title, state, conditions and primary action readable;
16. Japanese wrapping has no clipped labels, detached punctuation or one-character final lines caused by layout;
17. zero results, no public Programs, load failure, provider unknown and ended are not presented as the same empty state;
18. participant screens contain no default organizer CTA cluster, internal architecture vocabulary or fabricated urgency.

Use the relevant AJ cases from the management acceptance set rather than executing all cases for every localized UI change. Current core cases for this contract include AJ03/04/21/29/31/34/41–55/60 when their semantics are in the changed surface.

## 20. Explicit non-goals

Do not add, solely to satisfy this experience:

- a universal Event engine;
- a ZUKAN organizer dashboard replacement;
- facility-specific admin modules;
- a seat map, ticket wallet, payment/refund engine or streaming stack;
- an internal calendar/CRM/notification platform;
- mandatory social following, likes or public attendance feed;
- an exhaustive world facility catalog;
- AI ranking/personalization before deterministic discovery is insufficient;
- new profile cards for roadmap-only capabilities.

The smallest successful system is a clear regional participation window over existing truth, with clean handoffs to the owner of each transaction and a direct return to the participant's own record.