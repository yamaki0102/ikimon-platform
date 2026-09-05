# ZUKAN My Page v2

Status: `CANONICAL SURFACE SPEC` after merge
Version: `2.1`
Date: 2026-09-05 JST
Surface: signed-in `/profile` (`自分`)
Parent authority: `ZUKAN_APP_EXPERIENCE_V1.md` §9, §16.1, §16.2, §16.7–16.9
Participation authority: `PARTICIPATION_EXPERIENCE_V1.md`
Cross-project quality floor: `yamaki0102/all-projects-management:operations/ai_os/design_quality_standard.md`

## 1. Purpose

`自分` is the private personal hub that answers three questions only:

1. `ZUKAN上の自分は誰として表示されているか。`
2. `自分はどれだけ記録を残し、どれだけの場所と関わってきたか。`
3. `公開される自分を確認したり、必要なアカウント操作へどこから入るか。`

It does **not** answer `今、何をすればいいか` — Home owns that.
It does **not** reproduce Record, Place or Participation archives — those hubs own them.
It is not a social profile feed, achievement dashboard, settings directory or organization console.

The page should feel like **自分のZUKAN**: calm, factual, personal and easy to leave for the correct dedicated surface.

The global navigation label remains `自分`. `マイページ` is a conversational description of the surface, not a new navigation label.

## 2. Responsibility boundaries

### My Page owns

- signed-in identity: display name, avatar and user-authored bio when present;
- a compact factual summary of owner-safe accumulation;
- access to the canonical Records, Places and Participation destinations;
- profile editing;
- access to the current public contributor profile only when that public view is actually available;
- account utility such as logout;
- future account/privacy/data settings only through truthful implemented destinations.

### My Page does not own

- Home action prioritization, drafts, recovery prompts or active-program prompts;
- Record cards, recent-record media, Record search/filtering or Review work;
- Place lists/maps/revisit recommendations;
- Participation discovery, participant lifecycle or organizer operations;
- notifications already owned by the global shell;
- general Help/Terms/Privacy links already available globally unless an account-specific action needs them;
- Workspace/organization switching unless a future canonical IA explicitly assigns that responsibility here;
- public person-encyclopedia Publication. `/profile/:userId` is the current contributor profile and must not be silently expanded into a broader people directory;
- badges, likes, follower counts, ranks, streaks, levels or biodiversity-only progress.

A new capability does not automatically earn a My Page row. Preserve the fewest first-level destinations that let a user complete the account job.

## 3. Data contract

### 3.1 Owner snapshot

Reuse the current owner `ProfileSnapshot` as the primary source.

Allowed current fields for this surface:

- `displayName`
- `avatarUrl`
- `profileBio`
- `stats.totalObservations`
- `stats.placeCount`
- `stats.firstObservedAt`

Current owner stats are owner-mode truth. They may include information not visible to the public. Therefore:

- label them simply `記録` and `場所`, not `公開記録` / `公開場所`;
- never send owner-only values into public HTML/API merely to support My Page;
- do not derive public visibility from these counts.

Do not use these existing fields as core My Page progress:

- `uniqueTaxaAllTime`
- `currentStreakDays`
- tier counts
- rank labels
- Life List / species counts
- recent Record/Place content

Those values may exist for older or domain-specific surfaces; they do not define ZUKAN-wide personal progress.

### 3.2 Public-profile availability

`公開プロフィールを見る` must not be shown merely because the owner has Records or because `/profile/:userId` is a syntactically valid route.

Use current public-profile truth:

- preferred: reuse the existing public `ProfileSnapshot` / current public-viewability check;
- allowed alternative: an already-existing explicit public-profile-available flag with the same semantics;
- forbidden: infer availability from owner Record count, Place count, AI state, visibility guesses or a route string.

States:

- public view confirmed available → show `公開プロフィールを見る`;
- public view confirmed unavailable → omit the action; do not invent `非公開` unless the product has that explicit state;
- public-viewability lookup fails → keep the owner My Page usable and omit the action; do not convert failure into `非公開` or `公開中`.

Do not create a new database table or profile engine for this check.

### 3.3 Participation

Until a canonical owner participation summary/count exists, My Page shows **no participation count or status**.

It only links to the canonical Participation Hub. `PARTICIPATION_EXPERIENCE_V1.md` owns the lifecycle and state once the user arrives there.

### 3.4 Settings growth

Current `/profile/settings` supports the current profile-edit contract; describe only fields actually implemented there.

Future notification, privacy, language, consent, export, withdrawal, deletion, guardian/minor or other account settings must not each become a permanent first-level My Page row by default.

Rule:

> If more than three additional account-setting destinations become real, consolidate them behind one coherent settings surface rather than turning My Page into a settings directory.

An urgent safety/consent action remains a Home priority under the parent experience unless the underlying product contract explicitly requires it to appear on My Page too.

## 4. Exact information architecture

Render in this exact order.

### A. Identity

Purpose: show the signed-in person's current ZUKAN identity without turning it into a hero.

Content:

- eyebrow: `自分`
- H1: `{displayName}`
- avatar: current avatar; otherwise a restrained initial fallback
- bio: current `profileBio` only when non-empty
- actions:
  - `プロフィールを編集` → current `/profile/settings`
  - conditional `公開プロフィールを見る` → current `/profile/:userId`, only under §3.2

Rules:

- absent bio leaves no filler sentence;
- do not synthesize biography from AI, expertise, Record history, location or organization;
- do not show rank, streak, tier, badges or generated motivational copy;
- both actions are secondary product controls. Neither becomes a filled page-primary CTA because global capture/Home still own primary action.

### B. 自分のZUKAN

H2: `自分のZUKAN`

One pale editorial band contains exactly these responsibilities:

#### Record summary

- label: `記録`
- value: `{totalObservations}件`
- entire summary cell links to `/records?view=mine`
- accessible name should communicate `記録 {n}件を見る`

#### Place summary

- label: `場所`
- value: `{placeCount}か所`
- entire summary cell links to `/map?tab=places`
- accessible name should communicate `場所 {n}か所を見る`

#### Participation entry

Under the two summaries, separated by a thin rule:

- label: `参加`
- support: `参加できる企画と、自分の参加を見る`
- link: canonical Participation Hub, currently `/community/events`

Do not display a fake participation number, application state or upcoming-event preview here.

#### Start-date line

When `firstObservedAt` exists:

`YYYY年M月から記録しています`

Use year/month only. Do not imply continuous activity or achievement.

Rules:

- `0件` and `0か所` are legitimate small values;
- no empty Record/Place cards;
- no Record image, title, taxon name or Place name;
- no map preview;
- no `今月`, streak, score, contribution rank or competitive comparison;
- no second Records/Places navigation list below this band. These summary cells are the canonical links.

### C. Optional account settings

Render this section **only when at least one truthful implemented account destination exists beyond the identity edit action**.

H2: `設定`

Prefer one consolidated row such as `アカウント設定` when current routes already group multiple concerns.

Additional rows are allowed only when:

- the destination exists now;
- the label describes exactly what the user can do there;
- it is account-level, not a duplicate of Records/Places/Participation;
- it does not expose internal architecture terminology.

A single Record's publication withdrawal, Record deletion and whole-account deletion remain separate operations at their real destinations. My Page never presents one ambiguous `削除` action.

General Help/Terms/Privacy remain in the global shell/footer unless the user needs a specific account action from them.

### D. Account utility

At the bottom, visually separated from normal navigation:

- POST `ログアウト`

No confirmation is needed for ordinary logout. Account deletion is a different destructive flow and must not be placed beside logout unless its own current contract requires it.

## 5. Japanese copy contract

Default Japanese copy:

| Role | Copy |
|---|---|
| Page eyebrow | `自分` |
| H1 | `{displayName}` |
| Edit | `プロフィールを編集` |
| Public view | `公開プロフィールを見る` |
| Section | `自分のZUKAN` |
| Summary | `記録` / `{n}件` |
| Summary | `場所` / `{n}か所` |
| Participation | `参加` |
| Participation support | `参加できる企画と、自分の参加を見る` |
| Start date | `YYYY年M月から記録しています` |
| Optional settings section | `設定` |
| Logout | `ログアウト` |
| Owner read failure | `自分の情報を読み込めませんでした。` |

Avoid:

- `プロフィールと公開ページ` as the page subject;
- `参加とフォロー` until a real follow model exists;
- `あなたの成長`, `実績`, `レベル`, `連続記録`, `スコア` as generic motivation;
- `管理`, `ダッシュボード`, `データベース`, `read model`, `Record`, `Workspace` or other internal vocabulary in normal Japanese UI;
- explanations such as `記録そのものは「記録」にまとめています` that describe information architecture instead of helping the user act.

JA / EN / ES / PT-BR remain aligned. Translate meaning, not Japanese word order. Do not shorten one locale by deleting important state.

## 6. Visual specification

Surface route: `product_ui`.

Use current ZUKAN visual authority:

- green `#143f2e`
- main text `#17211b`
- secondary text `#55615a`
- white
- pale surface `#f7f7f3`
- current project font and spacing tokens

Do not add a font, icon package, animation library, framework or page-specific theme.

### 6.1 Page composition

- content measure: target about `800px`, acceptable `760–840px`, inside the global layout;
- page base: white;
- desktop outer vertical rhythm: primarily `32 / 40 / 56px` using existing tokens;
- mobile side padding follows the parent contract, normally `20px`;
- sections are separated by whitespace and thin rules, not repeated floating cards;
- no decorative hero, dashboard grid or sidebar is introduced.

### 6.2 Identity

Desktop/tablet:

- avatar: `64px` target, up to `72px` only if the existing shell scale requires it;
- H1: `36–40px`, line-height about `1.3`;
- bio: `15–16px`, line-height about `1.7`, readable measure around `58ch`;
- actions may sit beside the identity only when the name/bio remain comfortable.

Mobile:

- avatar: about `52–56px`;
- H1: `30–32px`;
- actions wrap/stack below the identity rather than compressing the name;
- no forced one-line display name;
- no two-button grid merely for symmetry.

Action styling:

- outline/text treatment using existing control conventions;
- minimum target `44px`;
- do not make either action a filled green hero button.

### 6.3 自分のZUKAN band

- background: `#f7f7f3`;
- border: restrained green/neutral 1px using existing tokens or equivalent;
- no shadow;
- radius: modest, target `8–12px`, not a large floating card;
- Record and Place summaries use equal visual weight;
- values are stronger than labels, approximately `28–32px`, not oversized KPI typography;
- a thin internal divider separates the two summaries;
- Participation is a full-width row below them with a top divider;
- start-date line sits beneath the factual/navigation content in secondary text.

Responsive behavior:

- at comfortable mobile widths such as 375px, Record and Place may remain two columns;
- at widths where translated labels or 200% text no longer fit, stack them; do not shrink text to preserve columns;
- Participation always remains easy to tap and read.

### 6.4 Optional settings and logout

- settings are plain full-width rows with thin separators;
- no individual rounded cards;
- label first, short support text only when it changes the user's decision;
- logout is visually quiet, separated by space/rule, and must not be mistaken for account deletion.

### 6.5 Prohibited visual drift

- gradients;
- heavy drop shadows;
- glassmorphism;
- decorative pills/badges;
- generic four-card account dashboard;
- icon-only rows without labels;
- huge whitespace introduced only to make the page look premium;
- photos or generated art used merely to fill an account page.

## 7. Navigation and interaction contract

- PC keeps the parent desktop header structure; the account/`自分` control is visibly current and exposes `aria-current="page"` or the equivalent existing active-state semantics.
- Mobile keeps the five-item bottom navigation `ホーム / 記録 / 撮る / 場所 / 参加`. Do not add a sixth `自分` item.
- Mobile header/avatar remains the `自分` entry and is visibly current on this page.
- all GET links preserve current base path and locale using the existing helpers; do not hard-code `/ja` or drop preview/base-path routing;
- POST logout uses the existing authenticated route and method;
- returning from profile edit should return to the owner My Page through the existing safe return flow. Do not create a new history mechanism solely for this page;
- no location permission, camera permission or other device permission is requested from My Page.

## 8. State contract

### Logged out

Keep the existing short login/register experience.

Do not show sample stats, fake screenshots, fake profile identity or a marketing dashboard.

### Brand-new user

- identity renders normally;
- `記録 0件`;
- `場所 0か所`;
- Participation link remains available;
- `firstObservedAt` line is absent;
- public-profile action is absent unless current public truth says a public view exists;
- Home/capture owns the `最初の記録` prompt.

### Private-only user

This is a required fixture.

- owner Record/Place counts remain visible to the owner;
- counts are not labelled public;
- public-profile action is absent when public truth confirms no public view;
- no private Record media, title, Place name or exact location appears.

### Mixed public/private user

- owner counts still represent owner truth;
- public-profile action appears only from public truth;
- the two values must not be conflated.

### No avatar / no bio

- avatar uses an initial fallback;
- fallback is decorative when the adjacent H1 already names the user;
- absent bio creates no placeholder text and no empty visual gap.

### Long content

Verify:

- long Japanese display name;
- Latin long name;
- 2–4 line user bio;
- counts at least into four digits;
- long ES/PT-BR labels;
- 200% text size/reflow.

No essential text is truncated.

### Owner snapshot unavailable

Do not render zeros or stale owner data as current truth.

Render a short state:

`自分の情報を読み込めませんでした。`

Provide an explicit retry/reload path using the existing route behavior. No infinite spinner.

### Public-profile lookup unavailable

The rest of My Page remains usable. Omit the public-profile action and do not state `非公開` or `公開中`.

### Participation unavailable

My Page still links to the canonical Participation destination. The Participation surface owns its own unavailable/error state.

### Offline / installed PWA

Do not cache or replay personalized My Page HTML as a generic offline page.

Without an explicit owner-partitioned private offline-profile contract, show the normal ZUKAN offline fallback instead of the last signed-in person's name/stats.

After logout, Service Worker/app cache must not restore prior owner My Page content.

## 9. Privacy, caching and public boundary

- `/profile` owner mode and `/profile/:userId` public mode remain distinct read boundaries;
- no private media, exact location, private Place label or owner-only settings leak into public output;
- no new public fields are authorized;
- owner HTML/snapshot data must use the current authenticated private cache policy and must never become shared/public cache content;
- where the active path is cacheable by infrastructure, preserve the current cookie-vary/private/no-store or equivalent safe semantics;
- Service Worker must not persist signed-in personalized My Page HTML as a cross-session offline artifact;
- after logout + back/reload, current authentication truth wins over stale app cache;
- no participation/follow state is inferred from Places;
- no Record/Place/Program semantics, rights or schema change is authorized by this redesign.

Do not add tracking merely to prove the page redesign. Reuse existing product metrics only when already appropriate.

## 10. Accessibility contract

- exactly one H1;
- semantic heading order: H1 identity, H2 `自分のZUKAN`, optional H2 `設定`;
- Record/Place summary cells are real links with descriptive accessible names;
- avatar image uses empty alt when the adjacent visible name already identifies the user; initial fallback is not redundantly announced;
- visible keyboard focus on every action;
- target size at least `44px`;
- color never carries state alone;
- visual and DOM reading order match;
- no essential interaction requires hover;
- Japanese punctuation and mixed Latin/Japanese wrap naturally;
- use natural wrapping; do not fix one screenshot with `nowrap`, `break-all`, hidden overflow or global hard-coded `<br>`;
- at 200% text zoom, all content and logout remain reachable without horizontal scrolling.

## 11. Responsive acceptance

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
- the parent 1160/1161 navigation transition remains intact;
- bottom navigation never covers Participation/settings/logout;
- long display name/bio never collides with avatar/actions;
- summary cells stack rather than shrink when necessary;
- touch targets remain >=44px;
- safe-area bottom padding is preserved on mobile;
- tablet portrait and desktop do not become stretched mobile cards.

## 12. Required fixtures

Minimum changed-surface fixtures:

1. logged out;
2. new user: 0 Records / 0 Places / no bio / no avatar / no public profile;
3. private-only owner with Records/Places;
4. mixed public/private owner with public contributor profile;
5. mature owner with four-digit count and first-record date;
6. long Japanese name + multi-line bio;
7. long ES/PT-BR localization;
8. owner snapshot failure;
9. public-profile availability lookup failure;
10. installed PWA/offline fallback;
11. logout then back/reload does not restore cached owner content.

Do not create dummy production posts for these fixtures. Use local/staging fixtures and read-only production checks under current test-data policy.

## 13. Implementation map

Start from current main and verify the active Worker consumption before editing.

Primary source:

- `platform_v2/src/routes/read.ts`
  - `renderSelfProfileHub()`
  - `PROFILE_HUB_STYLES`
  - `/profile`
  - `/profile/settings`

Existing data/service source:

- `platform_v2/src/services/readModels.ts`
  - owner `ProfileSnapshot`
  - current public `ProfileSnapshot` semantics
- current profile writer/settings path for `displayName`, `profileBio`, `expertise`, avatar

Focused contracts to update/reuse:

- `platform_v2/src/routes/profileHub.test.ts`
- `platform_v2/src/routes/profilePublicSafety.test.ts`
- `platform_v2/e2e/profile-mobile.staging.spec.ts`
- `platform_v2/e2e/landing-top-visual.spec.ts`
- only the smallest additional cache/offline regression needed if active Worker/PWA behavior is affected

Verify how the active Cloudflare Worker obtains/materializes signed-in profile HTML. A correct Fastify/Node renderer alone is not proof of runtime behavior. Do not create a second profile renderer merely to avoid the current path.

### Explicit implementation deltas

1. replace the current identity-card + 2×2 control-card dashboard with §§4–6;
2. keep identity plain and use only secondary profile actions;
3. make Record/Place summary cells the only My Page links to those hubs;
4. add Participation as the one non-count personal destination inside `自分のZUKAN`;
5. route Participation to the canonical Participation Hub, not the map;
6. remove `参加とフォロー` unless a real follow capability is adopted;
7. determine public-profile action from current public truth, never owner counts;
8. do not use Records as a proxy for privacy/settings;
9. keep optional account settings bounded under §3.4;
10. align JA/EN/ES/PT-BR;
11. preserve base path, locale, POST logout and owner/public isolation;
12. preserve authenticated private/offline-cache boundaries.

## 14. Acceptance

### Product

A normal signed-in user can answer without explanation:

- `自分のプロフィールは？` → top identity;
- `自分の記録はいくつ？` → `自分のZUKAN`;
- `自分の記録を見る` → Record summary link;
- `関わった場所を見る` → Place summary link;
- `参加できる企画 / 自分の参加` → Participation row;
- `他の人にどう見える？` → conditional public-profile action;
- `名前や写真を変える` → profile edit;
- `ログアウトする` → page bottom.

My Page does not answer Home/Records/Places/Participation jobs by duplicating their content.

### Truth / privacy

- owner counts are owner truth and never labelled public;
- private-only user can have non-zero My Page counts while public-profile action is absent;
- public-profile availability is not inferred from owner counts;
- no Record media/title/private Place/exact location is rendered on My Page;
- public `/profile/:userId` remains public-only;
- no new public field, DB/schema or rights semantic is required;
- no personalized owner HTML is exposed through shared/offline cache after logout.

### Editorial / visual

- no 2×2 management-card dashboard;
- no duplicate Records/Places links outside their summaries;
- no gradient, heavy shadow, glass effect or decorative pill system;
- canonical ZUKAN green/neutral palette;
- identity → `自分のZUKAN` → optional settings → logout reads naturally;
- no IA-explaining prose or AI-like filler;
- long names/bios/locales remain readable.

### Responsive / accessibility

- 320/375/768/1024/1160/1161/1280 pass the changed-surface contract;
- 200% text zoom remains usable;
- active `自分` state is understandable in desktop and mobile shell;
- keyboard focus, semantic headings and >=44px targets are preserved;
- bottom/safe-area navigation does not cover final controls.

### Regression

- Home remains action-oriented;
- Records remains the complete personal archive;
- Places remains the complete personal Place surface;
- Participation lifecycle remains owned by `PARTICIPATION_EXPERIENCE_V1.md`;
- no Life List/taxon/streak/rank dashboard returns;
- no Workspace/social/follower feature is invented;
- no old IKIMON product branding returns.

## 15. Luna implementation boundary

Luna implements this resolved specification. It does not choose another IA, palette, card system, copy hierarchy, public-profile rule, settings expansion or gamification model.

Use Source → Delta → Done.

### Source

- current `main`;
- this file;
- `ZUKAN_APP_EXPERIENCE_V1.md`;
- `PARTICIPATION_EXPERIENCE_V1.md` for the Participation destination only;
- root `AGENTS.md`;
- shared design-quality standard.

### Delta

- minimum source/tests needed for §§4–14;
- reuse current owner/public snapshots, routes, i18n, shell and authenticated cache policy;
- no new DB/schema/framework/profile engine/settings engine;
- no production fixture data.

### Done

- focused source regressions pass;
- required My Page fixtures are rendered at relevant widths;
- public-profile privacy and private-only-user regressions pass;
- active cache/offline path is checked if affected;
- exact candidate source renders through the current staging path before any production claim;
- Noah reviews the actual rendered composition/copy/wrapping at representative mobile/tablet/desktop widths;
- any unresolved UI choice returns to Noah rather than being invented by Luna.
