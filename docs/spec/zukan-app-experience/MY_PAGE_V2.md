# ZUKAN My Page v2

Status: `CANONICAL SURFACE SPEC` after merge
Date: 2026-09-05 JST
Surface: signed-in `/profile` (`自分`)
Parent authority: `ZUKAN_APP_EXPERIENCE_V1.md` §9, §16.1, §16.2, §16.7–16.9
Cross-project quality floor: `yamaki0102/all-projects-management:operations/ai_os/design_quality_standard.md`

## 1. Purpose

`自分` is the quiet private hub that answers:

> 自分がZUKANに何を残していて、公開上どう見え、必要な管理へどこから入るか。

It is not a second Home, Records, Places, Participation page, activity feed, achievement dashboard or settings directory.

The page should feel like **自分のZUKAN** rather than a SaaS control panel. It gives a small factual sense of accumulation, then routes the user to the dedicated surface for detail.

This file refines the `/profile` surface only. It does not change the global IA, Record/Place/Program truth, rights, publication semantics, public profile rights boundary or authentication model.

## 2. Product decisions

### Keep

- private signed-in `/profile` and public `/profile/:userId` remain separate surfaces;
- Records, Places and Participation remain canonical detail destinations;
- logout remains a POST action;
- current `ProfileSnapshot` is the primary read model for this page;
- global `撮る` remains the capture action; My Page does not add another large capture CTA.

### Remove from My Page

- 2×2 management-card dashboard composition;
- repeated Record cards, thumbnails, Record titles or Place names;
- Life List, taxon totals, streaks, rank, biodiversity-only progress or competitive gamification;
- regional-story cards and AI-generated recommendations;
- vague `参加とフォロー` wording;
- privacy links that route to Records and participation links that route to the map merely because those destinations already exist;
- heavy shadows, gradients, pill-heavy controls and a large hero;
- placeholder settings and fake counts for capabilities the current read model does not know.

No database, schema, new profile engine or new dashboard read model is justified for v2.

## 3. Information architecture

Render in this exact order.

### A. Identity

Purpose: identify the signed-in person and separate private self-management from the public profile.

Content:

- eyebrow: `自分`
- H1: current display name
- avatar: current avatar; otherwise a restrained initial fallback
- bio: current profile bio only when it exists; if absent, render no filler sentence
- action: `プロフィールを編集` → current `/profile/settings`
- secondary text action: `公開プロフィールを見る` → current `/profile/:userId`

Do not display rank, expertise boilerplate or a generated profile description merely to fill space. If `expertise` is an explicitly user-authored/current profile field and is already part of the public profile contract, it may appear only where the current profile semantics already authorize it; it is not required by My Page v2.

Neither action is a global product primary task. Do not style the page as if editing the profile were more important than Home/capture.

### B. 自分のZUKAN

H2: `自分のZUKAN`

Show only small factual summaries already available from owner-safe truth:

1. `記録` — `{totalObservations}件` → `/records?view=mine`
2. `場所` — `{placeCount}か所` → `/map?tab=places`
3. when `firstObservedAt` exists, a quiet sentence such as `2026年5月から記録しています` beneath the two summaries

The summary is one pale editorial band with internal dividers, not separate cards.

Rules:

- `0件` / `0か所` is a legitimate quiet state, not a large empty card;
- read failure is not `0`; show a real unavailable/retry state when the owner snapshot itself cannot be obtained;
- do not show unique taxa, streak, tier counts or ranking as core ZUKAN progress;
- do not show a photo or recent Record here. Home and Records already own those responsibilities;
- do not infer a Place, publication state or participation count from unrelated data.

### C. Continue elsewhere

Use plain bordered rows, not cards.

1. `記録を見る` → `/records?view=mine`
   - support text: `写真、音、動画、メモなど、自分が残した記録へ`
2. `場所を見る` → `/map?tab=places`
   - support text: `記録した場所や、もう一度見たい場所へ`
3. `参加を見る` → current canonical Participation hub, initially `/community/events`
   - support text: `参加できる企画と、自分の参加へ`

If the summary labels themselves already provide an equally clear Records/Places destination in the final composition, do not duplicate `記録を見る` and `場所を見る` rows. The preferred minimal implementation is:

- summary labels are the Records/Places links;
- the continuation list contains only `参加を見る`.

This is the default unless rendered acceptance proves the summary links are not discoverable enough.

### D. 公開と設定

H2: `公開と設定`

Rows:

1. `公開プロフィール`
   - current state is never invented;
   - action: `公開プロフィールを見る` only when the route is valid for the current user;
2. `プロフィールと設定`
   - link to current `/profile/settings`;
   - description must mention only fields that the current settings surface really supports;
3. additional notification, language, consent, export, withdrawal, deletion, guardian/minor, help or legal rows appear only when a real implemented destination exists and the row accurately describes it.

Do not create empty settings pages to make this section look complete. If several concerns are currently handled by one real settings route, one truthful row is better than multiple fake categories.

A single Record's unpublish/withdraw action, Record deletion and account deletion remain distinct operations. Do not collapse them under one ambiguous `削除` action on My Page.

### E. Account utility

At the page bottom:

- POST `ログアウト`

Keep it visually quiet and separated from ordinary navigation. Destructive account operations belong behind their actual settings/danger flow, not next to the main page navigation.

## 4. Japanese copy contract

Default Japanese labels:

| Role | Copy |
|---|---|
| Page eyebrow | `自分` |
| H1 | `{displayName}` |
| Section | `自分のZUKAN` |
| Summary | `記録` / `{n}件` |
| Summary | `場所` / `{n}か所` |
| Participation | `参加を見る` |
| Participation support | `参加できる企画と、自分の参加へ` |
| Settings section | `公開と設定` |
| Edit | `プロフィールを編集` |
| Public | `公開プロフィールを見る` |
| Settings | `プロフィールと設定` |
| Logout | `ログアウト` |

Avoid:

- `プロフィールと公開ページ` as the page's main identity;
- `参加とフォロー` until an actual follow model is a current user capability;
- `あなたの成長`, `実績`, `レベル`, `連続記録` as generic motivation copy;
- `管理`, `ダッシュボード`, `データベース`, `read model`, `Record` or other internal terms in Japanese UI.

JA/EN/ES/PT-BR remain supported together. Translate meaning, not word order. Long display names and translated labels must wrap naturally.

## 5. Visual specification

Surface route: `product_ui`.

Use current ZUKAN design authority:

- green `#143f2e`;
- main text `#17211b`;
- secondary text `#55615a`;
- white;
- pale surface `#f7f7f3`;
- existing project font and spacing tokens.

Do not introduce a font, icon library, animation library or page-specific theme.

### Composition

- content column: approximately 760–840px inside the global max-width/margins;
- white page as the base;
- sections separated primarily by whitespace and thin rules;
- identity is a plain composition, not a floating card;
- `自分のZUKAN` is one pale band, not two statistic cards;
- settings/participation are list rows with clear labels and support text;
- no decorative gradient or box shadow is required;
- no pill is used merely as decoration.

### Identity sizing

Desktop/tablet:

- avatar 64–72px;
- H1 32–40px, adjusted for long names;
- bio body 15–16px / line-height about 1.7;
- actions may sit to the right only when they fit without compressing the name.

Mobile:

- avatar about 56px;
- H1 about 28–32px;
- identity copy and actions stack naturally;
- `プロフィールを編集` may be a full-width outlined control;
- `公開プロフィールを見る` remains a secondary text/outline action;
- do not force both actions into a cramped two-column row.

### 自分のZUKAN summary

Desktop/tablet:

- Records and Places are two equal factual columns inside one pale band;
- value is visually stronger than label but not oversized;
- optional start-date sentence spans beneath them.

Mobile:

- keep Records and Places as two readable columns if 320px still fits;
- otherwise stack them; never shrink text to preserve columns;
- start date is a normal sentence below the values.

### Rows

- minimum interactive target height: 44px; target area normally 56px or more for a full row;
- label and support text are independently readable;
- selected/focus/hover state never relies on color alone;
- a simple existing chevron/arrow treatment is allowed, but icons are not required to explain meaning.

## 6. Responsive contract

Inspect at least:

- 320
- 375
- 768
- 1024
- 1160
- 1161
- 1280

Required:

- no horizontal overflow;
- global navigation transition at 1160/1161 remains intact;
- no bottom navigation covers the final logout/settings content;
- long Japanese display name and 2–3 line bio do not collide with actions;
- 200% text zoom/reflow keeps all actions reachable;
- touch targets remain at least 44px;
- Japanese punctuation and semantic phrases wrap naturally.

## 7. State contract

### Logged out

Keep the existing short login/register experience. Do not show sample statistics, fake profile previews or a large explanatory dashboard.

### New user

- identity renders normally;
- `記録 0件`, `場所 0か所` remain small factual values;
- no empty Record/Place cards;
- global Home/capture remains the place for the next-action prompt.

### No avatar / no bio

- avatar uses initial fallback;
- absent bio produces no placeholder marketing copy;
- layout closes the gap cleanly.

### Existing user

- show current owner-safe counts and optional first-record month/year;
- do not expose private Record media, Place names or exact location on My Page.

### Partial/unavailable

- never convert a failed read into zero;
- show what is known and label only the unavailable part when the architecture permits partial truth;
- otherwise render a short `自分の情報を読み込めませんでした` state with an explicit retry path;
- no infinite spinner.

### Public profile unavailable

Do not label a profile `公開中` merely because `/profile/:userId` exists. Hide or truthfully disable the public-profile action if the current public-profile contract says there is nothing viewable.

## 8. Privacy and product boundaries

- `/profile` owner mode and `/profile/:userId` public mode remain different read boundaries;
- My Page must not render private media or precise/private Place labels to create visual richness;
- no new public fields are added for this redesign;
- no participation/follow state is inferred from Places;
- no Record, Place or Program semantics change;
- no schema/data migration is needed;
- no public-profile rights change is authorized by this file.

## 9. Implementation map

Start from current main and verify the active Worker consumption before editing.

Primary current source:

- `platform_v2/src/routes/read.ts`
  - `renderSelfProfileHub()`
  - `PROFILE_HUB_STYLES`
  - current `/profile` and `/profile/settings` routes

Focused contracts to update/reuse:

- `platform_v2/src/routes/profileHub.test.ts`
- `platform_v2/src/routes/profilePublicSafety.test.ts`
- `platform_v2/e2e/profile-mobile.staging.spec.ts`
- `platform_v2/e2e/landing-top-visual.spec.ts`

Also verify how the active Cloudflare Worker obtains/materializes the signed-in profile HTML. Do not create a second profile renderer merely to avoid the current path.

### Explicit implementation deltas

1. replace the current identity card + 2×2 control-card grid with the composition in §3–§5;
2. use canonical ZUKAN colors rather than the older page-local green/gradient/shadow treatment;
3. route Participation to the canonical Participation hub, not the map;
4. route profile/settings concerns only to truthful current settings destinations; do not use Records as a privacy-settings proxy;
5. keep Records/Places as summary links rather than duplicated archive cards;
6. remove `参加とフォロー` unless a real current follow capability is proven;
7. keep all four current locales aligned;
8. preserve POST logout and owner/public profile isolation.

## 10. Acceptance

Functional:

- signed-in `/profile` has exactly one H1 and its visible subject is the current user;
- `自分のZUKAN` shows owner-safe Record/Place counts only;
- no Record title, Record image, exact/private Place name or detailed archive is duplicated on My Page;
- Records → `/records?view=mine`;
- Places → `/map?tab=places`;
- Participation → `/community/events` (or the current canonical equivalent if the parent contract has explicitly migrated it);
- profile edit/settings → the real current settings route;
- public profile → `/profile/:userId` without weakening public visibility filtering;
- logout is POST;
- no new DB/schema/read-model dependency.

Editorial/visual:

- no 2×2 rounded management-card dashboard;
- no gradient, heavy shadow or decorative pills on this surface;
- canonical ZUKAN green/neutral palette;
- page reads as identity → personal accumulation → public/settings → logout;
- 320/375/768/1024/1160/1161/1280 layouts have no overflow or clipped controls;
- long Japanese name/bio, zero-count user and no-bio user are visually accepted;
- keyboard focus and 44px minimum targets remain visible/usable.

Regression:

- public `/profile/:userId` stays public-only;
- Home, Records, Places and Participation responsibilities remain unchanged;
- no `Life List`, taxon/streak/rank dashboard returns to My Page;
- no old IKIMON product branding returns.

## 11. Luna implementation boundary

Luna implements this resolved specification; it does not choose an alternative IA, palette, card system, copy hierarchy, gamification model or new settings architecture.

Use Source → Delta → Done:

**Source**
- current `main`;
- this file;
- `ZUKAN_APP_EXPERIENCE_V1.md`;
- root `AGENTS.md` and the shared design-quality standard.

**Delta**
- only the minimum source/tests required to make `/profile` conform to §§3–10;
- reuse current snapshot, routes, i18n and shell;
- no DB/schema/new framework/new profile service.

**Done**
- focused source tests pass;
- affected My Page renders are checked at the widths/states in §10;
- public-profile privacy regression passes;
- active staging path renders the exact candidate source before any production claim;
- unresolved UI choice returns to Noah rather than being invented by the executor.
