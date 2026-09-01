# ZUKAN App Experience v1

Status: DESIGN CANDIDATE — owner-adopted direction, implementation source for LUNA after exact-head reference
Date: 2026-09-01
Product: ZUKAN

## 1. Purpose

This document fixes the user-facing information architecture, screen responsibilities, state priority, observation-event discovery, and PWA brand migration for ZUKAN after M6 production LIVE_VERIFIED.

LUNA is an implementation and verification executor for this contract. It must not redefine product value, navigation meaning, privacy semantics, milestone scope, or brand identity.

The goal is one coherent ZUKAN experience from public landing through installed PWA, logged-in home, personal records, places, observation events, and account/data management.

## 2. Non-negotiable product rules

- Reuse existing M1–M6 capabilities and routes. Do not create replacement Record, Place, Event, Profile, auth, rights, or publication foundations.
- Keep current privacy, consent, rights, Review, location-minimization, publication, and free/paid semantics unchanged.
- UI terminology must be user-facing Japanese, not internal schema or infrastructure terms.
- Observation Event is presented consistently as `観察会` in the Japanese UI even where the internal route remains `/community/events`.
- `撮る` is a global primary action, not a content area that competes equally with navigation destinations.
- Home is not an archive and not an all-metrics dashboard.
- `/profile` is not a duplicate home/records/places/events page.
- Do not create new brand artwork. Reuse the official ZUKAN symbol/wordmark assets.
- Product UI must not show old IKIMON identity except where IKIMON is intentionally shown as the operating company.

## 3. Global information architecture

### 3.1 Desktop

Persistent primary destinations:

1. `ホーム`
2. `記録`
3. `場所`
4. `観察会`
5. `自分`

Global primary action: `撮る`

The capture action is visually stronger than ordinary navigation but must not obscure the current location in the product.

### 3.2 Mobile

Bottom navigation is fixed to:

1. `ホーム`
2. `記録`
3. `撮る`
4. `場所`
5. `観察会`

`自分` is reached from the persistent profile/avatar action in the header.

Do not add a sixth bottom-navigation item. Do not hide `観察会` inside a generic community menu.

### 3.3 Existing route mapping

Preserve existing canonical route behavior unless an already-adopted canonical route says otherwise:

- Home → existing localized home/root
- 記録 → `/records?view=mine`
- 場所 → `/map?tab=places`
- 観察会 → `/community/events`
- 自分 → `/profile`
- 撮る → existing global capture launcher / Record creation flow

Existing deep links and redirects must continue to work.

## 4. Public Home

### 4.1 Job

Within approximately five seconds, a first-time visitor should understand:

- ZUKAN records what people notice in a place.
- a photo is the easiest starting action.
- records connect to places and time.
- people can also discover or join observation events.

### 4.2 Hero

Canonical Japanese H1:

`撮ると、まちの今が図鑑になる。`

Primary CTA: `撮る`

Secondary CTA: `場所を見る`

A direct `観察会` discovery affordance must be visible in the first meaningful scroll region. If relevant active/recruiting events exist, show real event content. If zero events exist, retain a lightweight `観察会を見る` / `観察会を開く` entry rather than hiding the capability.

Do not use `招待された方へ。見つけたことを、写真1枚から。` as the main H1.

Do not allow oversized typography or forced phrase splitting to turn Japanese copy into a vertical wall of characters.

## 5. Logged-in Home

### 5.1 Job

Home answers one question:

`今、何をすればいいか。`

It is state-driven and action-oriented. It must not become a complete Record/Place/Event list.

### 5.2 Priority resolver

Use the following product priority order. The first applicable state becomes the single primary action. At most two additional secondary actions may follow.

1. safety / consent / Review / rights action requiring the user
2. active observation event the user is participating in
3. organizer action required for an active observation event
4. unsaved, draft, queued, or recoverable Record work
5. completely new user → first Record
6. upcoming observation event relevant to the user
7. Place worth revisiting because another observation would create useful change-over-time context
8. recent own Record

If multiple items exist in the same class, use current product truth and deterministic recency/relevance rules. Do not invent AI ranking.

### 5.3 Primary/secondary limits

- exactly zero or one primary action
- zero to two secondary actions
- lower-priority material belongs in its dedicated hub

Do not render rows of empty-state cards such as `記録0件 / 場所0件 / 観察会0件`.

### 5.4 New user

For a user with no meaningful state:

Primary: `最初の記録を残す`

Secondary candidates:

- `観察会に参加する`
- `場所を見る`

Do not display a large empty dashboard.

### 5.5 Mature user

As data grows, Home must become more selective, not denser.

The full archive belongs in `記録`, the full Place set in `場所`, and the full Event history in `観察会`.

## 6. Records Hub

### 6.1 Job

`自分が残したもの`を探す・振り返る・続きを行う。

Use the existing Record truth. Support the existing media kinds and states, including:

- photo
- video
- audio
- memo
- draft/recoverable work where already supported
- Review state
- private/shared/public visibility state

### 6.2 Presentation

A Record item should prioritize:

- media/thumbnail when safe
- user-facing title/name
- observed time
- Place when safe and available
- concise visibility state
- concise Review/confirmation state when relevant

Do not expose internal schema names.

Filtering must remain minimal and task-oriented. Avoid turning this into an admin table.

## 7. Places Hub

### 7.1 Job

`自分と場所の関係`を返す。

Prioritize:

- recently recorded Places
- Places the user returns to
- Places where another visit would reveal change over time
- Records associated with a Place
- observation events associated with a Place

Map and list presentations must use the same Place truth and must not create parallel Place identities.

## 8. Observation Events Hub

### 8.1 Product position

M6 made self-serve observation events production-capable. This capability is now first-class product navigation rather than a hidden community subfeature.

Japanese UI label: `観察会`

Internal routes and M6 assets may remain unchanged.

### 8.2 Hub structure

#### 探す・参加する

- 開催中
- 募集中
- relevant nearby events where current product truth permits
- invite-code entry/join flow

#### 自分の観察会

- 参加予定
- 参加中
- 過去

#### 主催

- 主催中
- 下書き where an existing safe draft concept exists
- 過去
- `もう一度開催`
- `新しい観察会を作る`

Participant and organizer actions must not be mixed into one ambiguous action cluster.

### 8.3 Cross-surface discovery

At minimum:

- Public Home → observation-event discovery
- Member Home → active/upcoming/organizer event when priority resolver selects it
- Place detail → events for that Place when available
- Event recap → rehost using current M6 contract
- Invite/deep link → shortest safe join route

Do not create a new Event backend or new participant model.

## 9. Profile / `自分`

### 9.1 Job

`本人・アカウント・安全・データ管理`

This surface is not a second Home.

### 9.2 Sections

Keep only user/account management concerns such as:

- profile/display identity
- account/login state
- publication/visibility controls exposed by current product truth
- consent
- location/privacy
- guardian/minor-related controls where applicable
- notifications where currently supported
- language
- data and rights
- withdrawal/deletion/export entry points already supported
- help/legal
- logout

### 9.3 Explicit exclusions

Do not reproduce full:

- Record archive
- Place archive
- observation-event archive

Link to their dedicated hubs instead.

## 10. PWA and installed-app brand migration

### 10.1 Target state

Everything visible during install, launch, refresh, offline fallback, home-screen presence, and shortcuts must present ZUKAN as the product.

IKIMON may remain only as intentional operator/company attribution, never as the installed-app identity.

### 10.2 Required visible brand state

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

### 10.3 Existing-install migration

Do not change the manifest app `id` merely to force a refresh. Existing installed apps must remain the same app identity.

Use versioned ZUKAN icon asset URLs or another deterministic browser-safe cache-busting mechanism so previously installed devices do not remain stuck on old icon bytes.

New Service Worker cache namespace: `zukan-app-*`.

During migration, clean stale caches matching both:

- old `ikimon-app-*`
- obsolete `zukan-app-*`

Do not delete IndexedDB, Record drafts, outbox data, auth state, user-generated media, or other user data as part of cache migration.

The refresh/reset path must respect the same boundary.

### 10.4 Shortcuts

Installed-app shortcuts should prioritize:

1. `撮る`
2. `観察会`
3. `場所`
4. `記録`

Use existing routes and official ZUKAN assets.

### 10.5 Asset verification

Do not trust filenames alone. Verify the actual bytes/visuals of the icon assets so a file named `zukan-*` cannot silently contain the old IKIMON mark.

No new logo design is authorized.

## 11. Visual system

All of the following must feel like one product:

- public Home
- logged-in Home
- Records
- Places
- Observation Events
- Profile
- PWA install/launch/offline/refresh

Direction:

- photography and real records first
- clean editorial composition
- ZUKAN green
- white
- warm neutral backgrounds where useful
- restrained borders/cards
- strong hierarchy
- mobile-first interaction

Avoid:

- generic SaaS dashboard appearance
- dense card grids
- excessive rounded rectangles
- decorative gradients
- old IKIMON product branding
- internal architecture vocabulary
- multiple equal primary actions on one state

## 12. State fixtures

The implementation must be verified against at least these user states:

1. guest
2. completely new logged-in user
3. one Record
4. many Records
5. draft/recoverable Record
6. private-only user
7. mixed public/private Records
8. active Event participant
9. upcoming Event participant
10. active Event organizer
11. Review/consent/safety action required
12. zero observation events
13. offline installed PWA
14. degraded/error state

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

The experience is acceptable only when a normal user can answer without explanation:

- `今やることはどこ？` → Home
- `自分の写真や記録は？` → 記録
- `場所ごとに見たい` → 場所
- `観察会を探す・参加する・開く` → 観察会
- `公開範囲やアカウントを変えたい` → 自分
- `今すぐ残したい` → 撮る

Additional acceptance:

- M1–M6 semantics remain intact
- observation-event discovery is no longer hidden
- Profile no longer duplicates major content hubs
- PWA shows only ZUKAN product identity at user-visible brand surfaces
- P0/P1 UX defects = 0
- staging exact-source verification complete before any production promotion

## 15. Implementation boundary

This document authorizes design-conforming source implementation only after it is referenced by exact commit/PR head in an executor instruction.

Production mutation is not authorized by this document.

If implementation uncovers a true product-choice conflict, privacy/rights ambiguity, irreversible migration, external-send, permission, secret, billing, or production boundary, park only that boundary and continue deterministic reversible work.
