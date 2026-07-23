# 🔍 PR 1419 Production Gate Review Report

---

## 1. Verdict
**BLOCK**
*(This review identifies a critical regex-replacement bug that introduces invalid CSS syntax into the production codebase, breaks responsive layout rendering in browsers, and causes the automated test suite to fail.)*

---

## 2. Top Findings (Ordered by Severity)

### 🚨 [CRITICAL/BLOCKING] Invalid CSS Media Query At-Rules in `mapPlaceAtlasProfile.ts`
* **File:** `platform_v2/src/ui/mapPlaceAtlasProfile.ts`
* **Exact Quoted Patch Lines:**
  ```css
  +  @platform_v2\src\ui\observationMedia.ts (min-width: 1280px) {
  ...
  +  @platform_v2\src\ui\observationMedia.ts (max-width: 900px) {
  ...
  +  @platform_v2\src\ui\observationMedia.ts (max-width: 420px) {
  ...
  +  @platform_v2\src\ui\observationMedia.ts (prefers-reduced-motion: reduce) {
  ```
* **Failure Mechanism:**
  A global search-and-replace operation mistakenly replaced `@media` with `@platform_v2\src\ui\observationMedia.ts` (likely due to confusing the CSS `@media` rule with the import path of `observationMedia.ts`). This is **invalid CSS syntax** that is ignored by web browsers, completely breaking all responsive layouts (mobile bottom sheet, wide desktop panels) and accessibility features (reduced motion) in the production UI.

---

### 🚨 [CRITICAL/BLOCKING] Failing & Malformed Regular Expressions in `mapPlaceAtlasProfile.test.ts`
* **File:** `platform_v2/src/ui/mapPlaceAtlasProfile.test.ts`
* **Exact Quoted Patch Lines:**
  ```typescript
  +  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, / @platform_v2\src\ui\observationMedia.ts \(min-width: 1280px\)/);
  +  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, / @platform_v2\src\ui\observationMedia.ts \(max-width: 900px\)/);
  +  assert.doesNotMatch(MAP_PLACE_ATLAS_PROFILE_STYLES, / @platform_v2|observationMedia\.ts/);
  ```
* **Failure Mechanism:**
  1. **Syntax / Escape Error:** In JavaScript regular expression literals, `\s` is interpreted as a whitespace metacharacter, but `\u` followed by non-hex characters (as in `\ui` within `\ui\observationMedia.ts`) throws a compilation/parse syntax error in modern JavaScript runtimes (`SyntaxError: Invalid Unicode escape in regular expression`).
  2. **Assertion Contradiction:** Since `MAP_PLACE_ATLAS_PROFILE_STYLES` contains `@platform_v2\src\ui\observationMedia.ts`, it matches the string `observationMedia.ts` which matches the second alternative (`observationMedia\.ts`) in `/ @platform_v2|observationMedia\.ts/`. Therefore, `assert.doesNotMatch` (expecting NO match) will fail, causing the test suite to crash.

---

### ℹ️ [NON-BLOCKING] Character Encoding/Mojibake in Spec and Plan Files
* **Files:** `docs/spec/map-place-atlas/PLAN.md` & `docs/spec/map-place-atlas/SPEC.md`
* **Exact Quoted Patch Lines (Example):**
  ```markdown
  +## 螳御ｺ・擅莉ｶ
  +
  +1. field / OSM area / public cell繧貞酔荳€`PlaceAtlasProfile v1`縺ｧ蜿門ｾ励〒縺阪ｋ縲・
  ```
* **Observation:**
  The newly added specification and plan markdown files contain Japanese text encoded with UTF-8 but interpreted/saved as Shift_JIS (or vice versa), resulting in garbled text (Mojibake). This does not affect the production runtime but should be re-encoded before merge to preserve developer documentation quality.

---

## 3. Verified Core Semantics & Security Safeguards (Passed)
Despite the layout-replacement bug, the underlying architectural design, backend integrations, and privacy protocols are exceptionally robust and fully conform to expectations:

1. **Record vs. Occurrence Semantics:** The read model operates accurately on `visit_id` as the "Record ID" and properly deduplicates occurrence-level rows while preserving taxonomic provisionality for AI candidates.
2. **Privacy Suppressions:**
   * Directly suppresses contribution CTAs for schools and private/restricted OSM areas (verified by `generic OSM schools suppress direct contribution` test).
   * Masks direct locations of sensitive/unapproved fields.
   * Completely hides coordinate structures, geometry metadata, and individual contributor IDs on public-cell derivations.
3. **D1 Parameter Bind Limits:** Correctly limits maximum bindings to 80 (`MAX_QUERY_BINDINGS = 80`) with chunked loops. Maximum actual bound parameters reach a safe maximum of 82 (well under D1's 100-parameter limit).
4. **Multipolygon Outer/Inner Ring Geometry:** Properly processes inner rings/holes using a lightweight, native ray-casting implementation (`pointInPolygon`/`pointInRing`), correctly omitting records located within multipolygon holes.
5. **SSRF & Media Allowlisting:** Filters absolute media URLs via strict domain validation (`ikimon.life` or subdomains) and secure `https` schemes, successfully preventing external phishing or SSRF.
6. **Place Memory Visibility:** Safely validates deleted states, public visit statuses, moderation flags, and user blocklists (excluding viewer-hidden entries) prior to rendering memories.
7. **Race Condition & Stale Response Protection:** Employs sequence checks (`placeAtlasSeq`) and browser-level abort signals (`AbortController`) to prevent overlapping UI paint states.

---

## 4. Concrete Recommended Changes

### Fix 1: Restore Standard CSS Media Queries
In `platform_v2/src/ui/mapPlaceAtlasProfile.ts`, replace the faulty At-Rules with correct standard `@media` queries:
```css
/* Replace line 806 */
@media (min-width: 1280px) { ... }

/* Replace line 815 */
@media (max-width: 900px) { ... }

/* Replace line 834 */
@media (max-width: 420px) { ... }

/* Replace line 840 */
@media (prefers-reduced-motion: reduce) { ... }
```

### Fix 2: Repair the Test Assertions and Regexes
In `platform_v2/src/ui/mapPlaceAtlasProfile.test.ts`, update assertions to verify that no broken `@platform_v2` strings remain and validate normal media queries:
```typescript
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(min-width: 1280px\)/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(max-width: 900px\)/);
  assert.doesNotMatch(MAP_PLACE_ATLAS_PROFILE_STYLES, /@platform_v2/);
  assert.doesNotMatch(MAP_PLACE_ATLAS_PROFILE_STYLES, /observationMedia\.ts/);
```

### Fix 3: Re-encode Garbled Markdown Documentation
Re-save `PLAN.md` and `SPEC.md` using clean UTF-8 encoding to resolve the Mojibake.

---

## 5. Risks that should be Deferred or Rejected
* **Rejected:** Direct database migrations or live write-path edits must remain excluded from this MVP PR scope to avoid cutover instability.
* **Deferred:** Live request-time LLM narration and customizable community theme styling should be deferred to post-MVP iterations to minimize API response latency.
