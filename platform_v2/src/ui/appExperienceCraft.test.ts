import assert from "node:assert/strict";
import test from "node:test";
import { APP_EXPERIENCE_LAYOUT_STYLES, ZUKAN_DESIGN_FOUNDATION_STYLES, isAppExperiencePath, renderAppExperienceHeader, renderAppExperienceNavigation } from "./appExperience.js";

const styles = APP_EXPERIENCE_LAYOUT_STYLES;

test("guest composition is state-scoped and collapses to one column", () => {
  assert.match(styles, /\.home-state-view\.is-guest\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.home-state-view\.is-guest\{grid-template-columns:1fr/);
  assert.match(styles, /\.home-guest-hero:has\(\[data-home-empty-proof\]\)/);
  assert.match(styles, /\.home-guest-proof\.is-empty\{[^}]*aspect-ratio:auto/);
  assert.match(styles, /\[hidden\]\{display:none!important\}/);
});

test("guest controls reuse canonical shape and touch targets", () => {
  assert.match(styles, /\.home-state-view\.is-guest :is\(\.home-primary-button,\.home-secondary-button\)\{[^}]*min-height:48px[^}]*border-radius:var\(--zukan-radius-control\)/);
  assert.match(styles, /\.home-state-view\.is-guest \.home-secondary-link\{[^}]*min-height:44px/);
  assert.match(ZUKAN_DESIGN_FOUNDATION_STYLES, /--zukan-radius-control:4px/);
  assert.match(ZUKAN_DESIGN_FOUNDATION_STYLES, /:focus-visible/);
  assert.match(ZUKAN_DESIGN_FOUNDATION_STYLES, /prefers-reduced-motion:reduce/);
});

test("member thumbnails and navigation breakpoint are not redesigned", () => {
  assert.match(styles, /\.home-recent-card \.home-card-media\{aspect-ratio:4\/3\}/);
  assert.match(styles, /\.home-recent-card \.home-card-media\{aspect-ratio:1\}/);
  assert.match(styles, /@media\(min-width:1161px\)/);
  assert.match(styles, /@media\(max-width:1160px\)/);
  assert.doesNotMatch(styles, /MutationObserver|requestAnimationFrame|@import|animation-name/);
});

for (const language of ["ja", "en", "es", "pt-br"]) {
  test(`${language} navigation keeps the same five destinations and member scope`, () => {
    for (const placement of ["header", "bottom"] as const) {
      const guest = renderAppExperienceNavigation(language, 0, placement, false);
      const member = renderAppExperienceNavigation(language, 0, placement, true);
      assert.equal((guest.match(/<a /g) ?? []).length, 5);
      assert.equal((guest.match(/aria-current="page"/g) ?? []).length, 1);
      assert.ok(guest.includes(`/${language}/records?view=public`));
      assert.ok(member.includes(`/${language}/records?view=mine`));
      assert.ok(guest.includes(`/${language}/map?tab=places`));
      assert.ok(guest.includes(`/${language}/community/events`));
      assert.ok(guest.includes(`/${language}/record`));
      const order = [...guest.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(order[placement === "header" ? 4 : 2], `/${language}/record`);
    }
    assert.ok(renderAppExperienceHeader(language, 0, false, "main-content").includes('href="#main-content"'));
  });
}

test("route admission and fallback language stay bounded", () => {
  for (const path of ["/", "/ja/records?view=public", "/map?tab=places", "/community/events", "/profile"]) assert.equal(isAppExperiencePath(path), true);
  for (const path of ["/records-external", "/admin", "/other"]) assert.equal(isAppExperiencePath(path), false);
  assert.ok(renderAppExperienceNavigation("unknown", 0, "bottom").includes('href="/ja/"'));
});
