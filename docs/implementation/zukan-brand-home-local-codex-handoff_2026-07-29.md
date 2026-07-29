# ZUKAN名称変更・Home刷新 — ローカルCodex実装パケット

- Date: 2026-07-29
- Repository: `yamaki0102/ikimon-platform`
- PR: `#1488`
- Branch: `codex/zukan-staging-brand-home-20260728`
- Base main at preparation: `351f80398241dc1ba88894779466ce40339a1c90`
- Review resolution: `docs/reviews/2026-07-29-zukan-brand-home-opus-review-resolution.md`
- State: `IMPLEMENTATION_READY / LOCAL_CODEX_APPLY_PENDING`

## 1. Fixed decisions

- Public service name: `ZUKAN`
- Operator/company brand: `IKIMON` / `IKIMON株式会社`
- Current public URL and technical identity: `ikimon.life`
- Future domain migration is out of scope.
- Do not reconsider the name, trademark, symbol direction, or service hierarchy in this task.
- Preserve internal identifiers such as repository names, package names, environment variables, analytics keys, CSS/data markers, API paths, storage keys, Worker/D1/R2 names, and `ikimon.life` URLs where they are technical contracts.

## 2. Required implementation

### A. Deterministic brand derivatives

Use the adopted ZUKAN SVG assets already present in `upload_package/public_html/assets/brand/` as source. Do not redraw them.

Add a deterministic generator, preferably `platform_v2/scripts/generate-zukan-brand-assets.mjs`, using the existing `sharp` dependency. Generate and commit:

- `zukan-app-icon-192.png` — 192×192, purpose `any`
- `zukan-app-icon-512.png` — 512×512, purpose `any`
- `zukan-app-icon-192-maskable.png` — 192×192, purpose `maskable`
- `zukan-app-icon-512-maskable.png` — 512×512, purpose `maskable`
- `zukan-apple-touch-icon.png` — 180×180
- `zukan-favicon-32.png` — 32×32
- `zukan-ogp-default.png` — exactly 1200×630, opaque background, ZUKAN lockup centered with adequate padding
- root `upload_package/public_html/favicon.ico`, containing the ZUKAN 32px PNG; a minimal ICO wrapper around PNG data is acceptable

The maskable artwork must stay inside the 40% safe-zone radius. Shrink and recenter the current maskable SVG before rasterization if necessary; do not alter the approved symbol geometry.

The generator must be idempotent. Running it twice without source changes must not change hashes.

### B. `platform_v2/src/brandAssets.ts`

Point browser/PWA/social fields to the matching raster files:

- `mark192`, `mark512`
- `mark192Maskable`, `mark512Maskable`
- `appleTouchIcon`
- `favicon32`
- `ogpDefault`

Keep `wordmarkBlack`, `lockupBlack`, and the header-visible logo source as SVG.

### C. `platform_v2/src/appInstall.ts`

- Keep the visible name `ZUKAN` in all supported languages.
- Restore manifest icon metadata to actual PNG dimensions and MIME:
  - `192x192`, `512x512`, `image/png`
  - correct `any` / `maskable` purposes
- Shortcut icons must also use valid raster sizes/MIME.
- Keep offline/install copy aligned with the current four primary actions.
- Increment service-worker cache version only once for the final asset set.

### D. `platform_v2/src/ui/siteShell.ts`

Make the public-visible service identity consistent without renaming technical contracts.

Required visible changes:

- header wordmark accessible label → `ZUKAN`
- side-nav legal service text → `ZUKAN`
- footer mark alt/name/bottom service display → `ZUKAN`
- document title display suffix → `ZUKAN`
- `application-name` → `ZUKAN`
- `apple-mobile-web-app-title` → `ZUKAN`
- `og:site_name` and `og:image:alt` → `ZUKAN`
- favicon/apple/PWA tags must match actual PNG paths, MIME, and sizes
- remove or replace the old `/favicon.ico` declaration so the old IKIMON favicon is never preferred
- default OGP must use the 1200×630 PNG and declare `og:image:type`, `og:image:width`, and `og:image:height`
- canonical/OG URL origin remains `https://ikimon.life`

Add a compact operator/current-URL statement to an appropriate visible trust/footer surface, localized where feasible:

- ja: `ZUKANはIKIMON株式会社が運営しています。現在はikimon.lifeで提供しています。`
- Other languages may use accurate natural translations.

Do not globally replace `ikimon`. Explicitly allow technical uses such as:

- `ikimon.life` URL/host
- `IKIMON_*` environment variables
- analytics/event/storage/database identifiers
- `ikimon-home-*` HTML markers and existing internal CSS/custom-property names
- package/repository/runtime identifiers
- legal/operator text `IKIMON株式会社`

### E. `upload_package/public_html/assets/brand/brand-manifest.json`

Update the manifest to `brand: "ZUKAN"` and point every public asset role to the final ZUKAN derivative. Keep legacy files physically available for rollback; do not list them as current assets.

Update the brand README with the derivative list and generation command.

### F. Canonical Home vs Worker injection

Files:

- `platform_v2/src/ui/landingHomeState.ts`
- `platform_v2/cloudflare_shadow/src/index.ts`
- `platform_v2/cloudflare_shadow/src/stateSplitHomeContract.test.ts`

`landingHomeState.ts` is the canonical section structure. Worker injection may hydrate data but must not delete or replace these canonical member sections:

- `member-discovery` — same place / same season
- `member-place` — place changes
- `member-next` — next action

Remove the Worker behavior that writes:

- `member-discovery` → empty
- `member-place` → Worker-only `stateHomePlaceSection`
- any equivalent replacement that changes the canonical section meaning

The Worker may continue hydrating the primary memory and recent owner cards if required. It must preserve canonical fallback content when it has no richer data.

Delete the runtime use of:

- `/assets/img/landing/home-daily-place.webp`
- `.home-generated-badge`
- copy used only for the `イメージ` badge after no runtime consumer remains

No synthetic lifestyle image or `イメージ` badge may remain in guest or member output.

### G. Guest proof mosaic and empty state

- Add explicit layout handling for 0/1/2/3/5 photos.
- 1 photo: no empty grid columns; the photo fills the intended visual area.
- 2 photos: no empty second-row block.
- 5 photos at desktop: all 12 columns are filled; no one-column gap.
- Mobile layouts must remain usable at 320px.
- Add dedicated localized empty-state copy; do not reuse `placesTitle`.
- Empty-state accessibility must expose useful text through an actual semantic element; do not rely on `aria-label` on a generic unlabeled container.
- Continue excluding `blocked_public` and `blurred` records from guest photo proof. Records with `publicFeedEligible === false` must not leak place metadata.

### H. Reviewable diff

Restore formatting-only changes in `landingHomeState.ts` and tests. Preserve multiline templates where they existed before PR #1488. Remove unrelated changes such as generic-name normalization if they are not necessary for this task.

## 3. Required tests

Update existing assertions in `platform_v2/src/ui/siteShell.test.ts` that currently require the old IKIMON visible brand and old asset paths.

Add or extend tests covering:

1. Site shell
   - visible/accessibility/meta service name is `ZUKAN`
   - canonical URL remains `ikimon.life`
   - OGP path/type/dimensions are correct
   - favicon/apple/PWA paths and declarations match files
   - no visible `aria-label="ikimon"`, `og:site_name=ikimon`, or application-name `ikimon`

2. Node canonical Home
   - guest proof counts 0/1/2/3/5 produce the expected count classes and no missing layout contract
   - empty copy is dedicated
   - `blocked_public` / `blurred` records do not appear
   - `publicFeedEligible=false` does not expose place text
   - member canonical output contains discovery/place/next markers

3. Worker-injected Home
   - member output preserves same-place/season, place-change, and next-action sections
   - guest and member output contain none of:
     - `home-generated-badge`
     - `home-daily-place.webp`
     - `home-community-hero.webp`
     - `home-school-learning.webp`
   - owner records are not duplicated
   - public records do not enter member-only owner history
   - coordinates/cell identifiers remain absent

4. Asset generator
   - generated file dimensions and PNG MIME/signature
   - OGP is exactly 1200×630
   - maskable source/output safe-zone check or deterministic geometry assertion
   - second generation is byte-identical

## 4. Commands

Run from repository root:

```bash
npm ci --prefix platform_v2
npm ci --prefix platform_v2/cloudflare_shadow
node platform_v2/scripts/generate-zukan-brand-assets.mjs
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run build
npm --prefix platform_v2/cloudflare_shadow run check
npm --prefix platform_v2/cloudflare_shadow run test:quick
npm --prefix platform_v2/cloudflare_shadow run wrangler:check:staging
powershell -ExecutionPolicy Bypass -File .\scripts\check_legacy_entrypoint_reason.ps1
```

Also run focused tests directly during iteration, including:

```bash
npm --prefix platform_v2 exec -- tsx --test src/ui/siteShell.test.ts
npm --prefix platform_v2/cloudflare_shadow exec -- tsx --test src/stateSplitHomeContract.test.ts
```

If the repository lockfiles make `npm ci` unnecessary or unsafe in the existing worktree, preserve them and use the already-installed dependencies. Do not rewrite lockfiles without dependency changes.

## 5. Static completion searches

Run and review, not blind-replace:

```bash
rg -n 'aria-label="ikimon"|application-name" content="ikimon|apple-mobile-web-app-title" content="ikimon|og:site_name" content="ikimon|og:image:alt" content="ikimon|>ikimon<' platform_v2/src upload_package/public_html/assets/brand
rg -n 'home-generated-badge|home-daily-place\.webp|home-community-hero\.webp|home-school-learning\.webp' platform_v2/src platform_v2/cloudflare_shadow/src
rg -n 'zukan-.*\.svg|image/svg\+xml|sizes: "any"' platform_v2/src/appInstall.ts platform_v2/src/brandAssets.ts
```

Expected:

- first search: zero public-visible old-service matches; technical/internal uses are separately justified
- second search: zero runtime/test expectation matches except an explicit negative-test pattern
- third search: SVG remains only for visible vector logo/header roles, not PWA/apple/favicon/OGP roles

## 6. Visual QA before declaring source complete

Render guest and member Home locally at:

- 320, 375, 390, 412, 768, 1024, 1440px
- guest proof: 0, 1, 2, 3, 5 photos
- long Japanese labels
- private history only
- blurred/blocked public fixtures

Check:

- no grid holes
- no synthetic imagery or `イメージ` badge
- logo not clipped in maskable/circular/squircle previews
- header, browser icon, PWA install metadata, offline page, and sharing metadata all say ZUKAN
- photo-first hierarchy remains; operator text is secondary

Store screenshots or a compact evidence manifest under an existing QA/evidence path only if repository conventions support it. Do not add large temporary artifacts.

## 7. Git and PR completion

- Work only on `codex/zukan-staging-brand-home-20260728`.
- Preserve unrelated local changes; never reset or discard them.
- Commit all final changes, push the branch, and keep PR #1488 Draft.
- Suggested commit subject: `fix(zukan): complete brand and Home runtime consistency`
- Update PR body to include 0/1/2/3/5 photo QA and both guest/member runtime paths.
- Add a PR comment containing:
  - exact final head SHA
  - files changed by category
  - test commands and results
  - static search results
  - remaining requirement: exact-SHA staging deploy/verify/visual QA

## 8. Stop and report instead of guessing

Stop without protected mutation if:

- the checked-out branch is not PR #1488's branch
- remote head moved and cannot be fast-forwarded safely
- approved logo source assets are missing or corrupted
- a required fix would need DB/migration/secret/DNS/auth changes
- tests reveal an unrelated P0 requiring broad redesign

## 9. Forbidden

- production deployment
- DB/D1/PostgreSQL migration or data mutation
- secret/DNS/auth/permission changes
- `zukan.earth` activation
- service-name reconsideration or trademark work
- logo redesign
- PR merge or main direct push
- deletion of legacy IKIMON assets used for rollback

## 10. Definition of done for local implementation

Local implementation is complete when:

- all source changes and deterministic assets are committed and pushed to PR #1488
- required Node/Cloudflare/build/dry-run checks pass
- static searches have no unexplained violation
- local visual fixtures pass
- PR contains exact-SHA evidence
- the only remaining work is exact-SHA staging reflection, runtime identity verification, and staging visual QA
