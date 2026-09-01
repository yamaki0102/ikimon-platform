# ZUKAN App Experience v1

Status: `CANONICAL PRODUCT EXPERIENCE`
Date: 2026-09-01
Product: ZUKAN
Upstream product architecture: `docs/spec/zukan-product-architecture/SPEC.md`
Broad profile horizon: `docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`

## 1. Purpose

This contract fixes the user-facing information architecture, screen responsibilities, state priority, participation discovery and PWA brand migration for ZUKAN after M6 production verification.

LUNA is an implementation and verification executor for this contract. It must not redefine product value, navigation meaning, privacy semantics, profile roadmap, milestone scope or brand identity.

The experience must remain coherent as ZUKAN grows from the currently proven observation-event profile into photo contests, sketch/editorial activities, missions/town walks, tourism programs and other adopted Program profiles.

## 2. Non-negotiable product rules

- Reuse existing M1–M6 capabilities and routes. Do not create replacement Record, Place, Program/Event, Profile, auth, rights or publication foundations.
- Keep current privacy, consent, rights, Review, location-minimization, publication and free/paid semantics unchanged.
- UI terminology must be user-facing Japanese, not internal schema or infrastructure terms.
- Biodiversity is one Domain Pack, not the product boundary.
- `観察会` is one currently implemented Program profile, not the permanent name for every future participation experience.
- `撮る` is a global primary action, not a content area competing equally with navigation destinations.
- Home is not an archive and not an all-metrics dashboard.
- `/profile` is not a duplicate Home/Records/Places/Programs page.
- Do not create new brand artwork. Reuse the official ZUKAN symbol/wordmark assets.
- Product UI must not show old IKIMON identity except where IKIMON is intentionally shown as the operating company.
- Do not expose planned M9+ profiles as usable before they are implemented and verified.

## 3. Global information architecture

### 3.1 Desktop

Persistent primary destinations:

1. `ホーム`
2. `記録`
3. `場所`
4. `参加`
5. `自分`

Global primary action: `撮る`

`参加` is the stable user-facing responsibility for finding and returning to Programs. Today it may contain only the implemented observation-event profile. M9 may add other Program profiles behind the same responsibility without changing the primary IA.

### 3.2 Mobile

Bottom navigation is fixed to:

1. `ホーム`
2. `記録`
3. `撮る`
4. `場所`
5. `参加`

`自分` is reached from the persistent profile/avatar action in the header.

Do not add a sixth bottom-navigation item.

### 3.3 Existing route mapping

Preserve existing canonical route behavior unless an adopted route migration changes it:

- Home → existing localized home/root
- 記録 → `/records?view=mine`
- 場所 → `/map?tab=places`
- 参加 → current Program/Event discovery route, initially `/community/events`
- 自分 → `/profile`
- 撮る → existing global capture launcher / Record creation flow

Existing deep links and redirects must continue to work.

Internal `/community/events` routing does not make `community` or `観察会` the permanent product-level information architecture.

## 4. Public Home

### 4.1 Job

Within approximately five seconds, a first-time visitor should understand:

- ZUKAN records and connects regional moments/information to places and time.
- a photo is the easiest starting action.
- records can become rights-safe regional knowledge.
- people can participate in regional Programs.

### 4.2 Hero

Canonical Japanese H1:

`撮ると、まちの今が図鑑になる。`

Primary CTA: `撮る`

Secondary CTA: `場所を見る`

Do not use `招待された方へ。見つけたことを、写真1枚から。` as the main H1.

Do not allow oversized typography or forced phrase splitting to turn Japanese copy into a vertical wall of characters.

### 4.3 Participation discovery

A `参加できる企画` / `参加` affordance must be visible in the first meaningful scroll region.

Until M9 broad profiles are implemented, show only current truthful capability, for example current/recruiting `観察会` plus a safe organizer entry. Do not render fake Photo Contest, Stamp Rally or tourism Program cards merely because they exist in the roadmap.

When later profiles become verified, they enter the same participation responsibility rather than creating new top-level navigation for each profile.

## 5. Logged-in Home

### 5.1 Job

Home answers one question:

`今、何をすればいいか。`

It is state-driven and action-oriented. It must not become a complete Record/Place/Program list.

### 5.2 Priority resolver

Use this product priority order. The first applicable state becomes the single primary action. At most two additional secondary actions may follow.

1. safety / consent / Review / rights action requiring the user
2. active Program the user is participating in
3. organizer action required for an active Program
4. unsaved, draft, queued or recoverable Record work
5. completely new user → first Record
6. upcoming Program relevant to the user
7. Place worth revisiting because another Record would create useful change-over-time context
8. recent own Record

For the current M6 runtime, Program states may be observation events. The resolver semantics must remain Program-generic so later profiles do not require a new Home architecture.

If multiple items exist in the same class, use deterministic current product truth. Do not invent AI ranking.

### 5.3 Primary/secondary limits

- exactly zero or one primary action
- zero to two secondary actions
- lower-priority material belongs in its dedicated hub

Do not render rows of empty-state cards such as `記録0件 / 場所0件 / 企画0件`.

### 5.4 New user

For a user with no meaningful state:

Primary: `最初の記録を残す`

Secondary candidates:

- `参加できる企画を見る`
- `場所を見る`

Do not display a large empty dashboard.

### 5.5 Mature user

As data grows, Home becomes more selective, not denser.

The full archive belongs in `記録`, the full Place set in `場所`, and the full participation/organizer history in `参加`.

## 6. Records Hub

### Job

`自分が残したもの`を探す・振り返る・続きを行う。

Use the existing Record truth. Support existing media kinds and states, including photo, video, audio, memo, draft/recoverable work, Review state and visibility state.

A Record item should prioritize media/thumbnail when safe, user-facing title/name, observed time, Place when safe, concise visibility state and concise Review/confirmation state when relevant.

Do not expose internal schema names. Avoid an admin-table presentation.

## 7. Places Hub

### Job

`自分と場所の関係`を返す。

Prioritize:

- recently recorded Places
- Places the user returns to
- Places where another visit would reveal change over time
- Records associated with a Place
- Programs associated with a Place

Map and list presentations use the same Place truth and must not create parallel Place identities.

## 8. Participation / Program Hub

### 8.1 Product position

M6 proved a self-serve observation-event Program profile. The stable user responsibility is broader: find, join, resume or host regional Programs.

Japanese primary-nav label: `参加`

Current observation-event UI may continue to label a concrete item or section `観察会`.

### 8.2 Current truthful structure

Before M9 profile implementation, the hub may expose:

#### 参加する
- 開催中の観察会
- 募集中の観察会
- relevant nearby observation events where current product truth permits
- invite-code/deep-link join flow

#### 自分の参加
- 参加予定
- 参加中
- 過去

#### 主催
- 主催中
- current safe draft concept if it exists
- 過去
- `もう一度開催`
- `新しい観察会を作る`

Participant and organizer actions must not be mixed into one ambiguous action cluster.

### 8.3 Future profile insertion

M9 may add `photo_contest`, `sketch_drawing_event`, `mission_town_walk`, `stamp_rally`, `children_citizen_editorial`, and `tourism_regional_engagement`.

Those profiles must enter the same `参加` responsibility and reuse the Program Core. They do not get a new global navigation item unless a future owner-adopted experience contract explicitly changes the IA.

### 8.4 Cross-surface discovery

At minimum:

- Public Home → participation discovery
- Member Home → active/upcoming/organizer Program when priority selects it
- Place detail → relevant Programs for that Place when available
- current Event recap → rehost using M6 contract
- invite/deep link → shortest safe join route

Do not create a new Program backend or participant model for M9 profiles.

## 9. Profile / `自分`

### Job

`本人・アカウント・安全・データ管理`

This surface is not a second Home.

Keep user/account management concerns such as:

- profile/display identity
- account/login state
- publication/visibility controls exposed by current product truth
- consent
- location/privacy
- guardian/minor controls where applicable
- notifications where currently supported
- language
- data and rights
- withdrawal/deletion/export entry points already supported
- help/legal
- logout

Do not reproduce the full Record archive, Place archive or Program archive. Link to dedicated hubs instead.

A future public person/profile Publication is not the same thing as the private `自分` account surface and must follow the rights boundary in `PROFILE_HORIZON.md`.

## 10. PWA and installed-app brand migration

Everything visible during install, launch, refresh, offline fallback, home-screen presence and shortcuts must present ZUKAN as the product.

IKIMON may remain only as intentional operator/company attribution, never as the installed-app identity.

Required visible brand state:

- manifest `name` = `ZUKAN`
- manifest `short_name` = `ZUKAN`
- app icon = official ZUKAN symbol
- maskable icon = official ZUKAN symbol
- Apple touch icon = official ZUKAN symbol
- favicon = ZUKAN
- Android/standalone launch appearance = ZUKAN
- offline view = ZUKAN
- install UI = ZUKAN
- app-refresh view = ZUKAN symbol, never generic/legacy `i`

Do not change manifest app `id` merely to force refresh. Existing installed apps remain the same app identity.

Use versioned ZUKAN icon asset URLs or another deterministic browser-safe cache-busting mechanism so existing devices do not remain stuck on old icon bytes.

New Service Worker cache namespace: `zukan-app-*`.

During migration, clean stale caches matching both old `ikimon-app-*` and obsolete `zukan-app-*`.

Do not delete IndexedDB, Record drafts, outbox data, auth state, user-generated media or other user data.

Installed-app shortcuts prioritize:

1. `撮る`
2. `参加`
3. `場所`
4. `記録`

Use existing routes and official ZUKAN assets.

Do not trust filenames alone. Verify actual icon bytes/visuals so a `zukan-*` file cannot silently contain the old IKIMON mark.

No new logo design is authorized.

## 11. Visual system

Public Home, logged-in Home, Records, Places, Participation, Profile and PWA must feel like one product.

Direction:

- photography and real records first
- clean editorial composition
- ZUKAN green
- white
- warm neutral backgrounds where useful
- restrained borders/cards
- strong hierarchy
- mobile-first interaction

Avoid generic SaaS dashboard appearance, dense card grids, excessive rounded rectangles, decorative gradients, old IKIMON product branding, internal architecture vocabulary and multiple equal primary actions on one state.

## 12. State fixtures

Verify at least:

1. guest
2. completely new logged-in user
3. one Record
4. many Records
5. draft/recoverable Record
6. private-only user
7. mixed public/private Records
8. active observation-event participant
9. upcoming observation-event participant
10. active observation-event organizer
11. Review/consent/safety action required
12. zero current Programs
13. offline installed PWA
14. degraded/error state

M9+ fixtures are added only when those profiles become implementation candidates; current UI must not fake them.

## 13. Responsive contract

Required widths:

- 375
- 768
- 1280
- 1440

For each relevant fixture:

- no horizontal overflow
- no broken header/bottom navigation
- primary action visible and understandable
- touch targets safe on mobile
- photo/media aspect ratios stable
- public/private information does not cross boundaries
- navigation meaning remains consistent

## 14. Acceptance

A normal user can answer without explanation:

- `今やることはどこ？` → Home
- `自分の写真や記録は？` → 記録
- `場所ごとに見たい` → 場所
- `参加できる企画を探す / 自分の参加を見る / 開催する` → 参加
- `公開範囲やアカウントを変えたい` → 自分
- `今すぐ残したい` → 撮る

Additional acceptance:

- M1–M6 semantics remain intact
- current observation-event discovery is no longer hidden
- the IA does not lock the future product to observation events
- Profile no longer duplicates major content hubs
- PWA shows only ZUKAN product identity at user-visible brand surfaces
- planned M9+ profiles are not presented as runtime-active
- P0/P1 UX defects = 0
- staging exact-source verification completes before production promotion

## 15. Implementation boundary

This document authorizes design-conforming source implementation only when referenced from an executor instruction against current source.

Production mutation is not authorized by this document.

If implementation uncovers a true product-choice conflict, privacy/rights ambiguity, irreversible migration, external-send, permission, secret, billing or production boundary, park only that boundary and continue deterministic reversible work.
