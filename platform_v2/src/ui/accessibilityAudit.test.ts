import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderAppExperienceNavigation } from "./appExperience.js";
import { renderSiteDocument } from "./siteShell.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function rules(source: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1] ?? "");
}

function declarationValues(source: string, selector: string, property: string): number[] {
  return rules(source, selector).flatMap((body) => {
    const value = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([0-9.]+)px`, "i"))?.[1];
    return value === undefined ? [] : [Number(value)];
  });
}

test("main-flow interactive controls keep a 44px minimum target", () => {
  const shell = read("./siteShell.ts");
  const map = read("./mapExplorer.ts");
  const auth = read("../routes/auth.ts");
  const app = read("./appExperience.ts");
  const checks: Array<[string, string, string, string]> = [
    ["auth", auth, ".auth-tab", "min-height"],
    ["shell", shell, ".site-mobile-menu-toggle", "min-height"],
    ["shell", shell, ".site-mobile-menu-toggle", "width"],
    ["shell", shell, ".global-record-camera-modes button", "min-height"],
    ["shell", shell, ".global-record-camera-close", "width"],
    ["shell", shell, ".global-record-camera-close", "height"],
    ["shell", shell, ".site-account-icon", "width"],
    ["shell", shell, ".site-account-icon", "height"],
    ["shell", shell, ".site-mobile-account-actions .site-account-icon", "width"],
    ["shell", shell, ".site-mobile-account-actions .site-account-icon", "height"],
    ["shell", shell, ".global-record-choice", "min-height"],
    ["app", app, ".zukan-app-nav.is-bottom a", "min-height"],
    ["map", map, ".me-tab", "min-height"],
    ["map", map, ".me-rain-mode .me-tab", "min-height"],
    ["map", map, ".me-rain-toggle", "min-height"],
    ["map", map, ".me-rain-mode .me-rain-toggle", "min-height"],
    ["map", map, ".me-rain-time", "min-height"],
    ["map", map, ".me-rain-actions button", "min-height"],
    ["map", map, ".me-rain-mode .me-rain-actions button", "min-height"],
    ["map", map, ".me-area-guide-langs button", "min-height"],
    ["map", map, ".me-area-guide-actions button", "min-height"],
    ["map", map, ".me-area-next-step-cta", "min-height"],
    ["map", map, ".me-area-positive-actions a", "min-height"],
    ["map", map, ".me-search-row", "min-height"],
  ];

  const missing = checks.flatMap(([name, source, selector, property]) => {
    const values = declarationValues(source, selector, property);
    return values.length === 0 || values.some((value) => value < 44)
      ? [`${name} ${selector} ${property}: ${values.length ? values.join(", ") : "missing"}`]
      : [];
  });

  assert.deepEqual(missing, [], `controls below 44px or without an explicit target size:\n${missing.join("\n")}`);
});

test("shared app navigation keeps names, current state, language and skip target", () => {
  const app = read("./appExperience.ts");
  const nav = renderAppExperienceNavigation("en", 1, "bottom");
  assert.match(nav, /<nav class="zukan-app-nav is-bottom" aria-label="Main pages">/);
  assert.match(nav, /aria-current="page"/);
  assert.equal((nav.match(/<a\b/g) ?? []).length, 5);
  assert.match(nav, /<span>Records<\/span>/);
  assert.match(nav, /href="\/en\/records\?view=public"/);
  assert.match(app, /<span>\$\{copy\[index\]\}<\/span>/);
  assert.match(app, /<a class="zukan-app-skip" href="#\$\{mainId\}">/);
  assert.match(app, /focus-visible/);
});

test("primary navigation and map controls use readable 14px labels", () => {
  const shell = read("./siteShell.ts");
  const map = read("./mapExplorer.ts");
  const auth = read("../routes/auth.ts");
  const app = read("./appExperience.ts");
  const checks: Array<[string, string, string]> = [
    ["auth tabs", auth, ".auth-tab"],
    ["auth form labels", auth, ".auth-field span"],
    ["desktop navigation", shell, ".site-core-nav-link"],
    ["mobile menu label", shell, ".site-mobile-menu-toggle"],
    ["mobile record navigation", shell, ".global-record-choice"],
    ["camera mode controls", shell, ".global-record-camera-modes button"],
    ["bottom navigation", app, ".zukan-app-nav.is-bottom a"],
    ["map tabs", map, ".me-tab"],
    ["map rain control", map, ".me-rain-toggle"],
    ["rain timeline", map, ".me-rain-time"],
    ["rain actions", map, ".me-rain-actions button"],
    ["search results", map, ".me-search-row strong"],
    ["search result details", map, ".me-search-row span"],
    ["area guide languages", map, ".me-area-guide-langs button"],
    ["area guide controls", map, ".me-area-guide-actions button"],
    ["area next step", map, ".me-area-next-step-cta"],
    ["area positive actions", map, ".me-area-positive-actions a"],
  ];
  const small = checks.flatMap(([label, source, selector]) => {
    const values = declarationValues(source, selector, "font-size");
    return values.length === 0 || values.some((value) => value < 14)
      ? [`${label}: ${values.length ? values.join(", ") : "missing"}`]
      : [];
  });
  assert.deepEqual(small, [], `interactive labels below 14px:\n${small.join("\n")}`);
});

test("shared text and action colors meet WCAG AA contrast on their intended surfaces", () => {
  const source = read("./appExperience.ts");
  const token = (name: string) => {
    const value = source.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    assert.ok(value, `missing color token ${name}`);
    return value;
  };
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const ratio = (foreground: string, background: string) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  };
  const base = token("--zukan-surface-base");
  const subtle = token("--zukan-surface-subtle");
  const pairs: Array<[string, string]> = [
    [token("--zukan-text-primary"), base],
    [token("--zukan-text-secondary"), base],
    [token("--zukan-link"), base],
    [token("--zukan-link-visited"), base],
    [token("--zukan-action-primary"), base],
    [token("--zukan-status-success"), subtle],
    [token("--zukan-status-warning"), subtle],
    [token("--zukan-status-error"), subtle],
    [token("--zukan-status-info"), subtle],
  ];
  const failing = pairs.map(([foreground, background]) => ({ foreground, background, ratio: ratio(foreground!, background!) }))
    .filter((pair) => pair.ratio < 4.5);
  assert.deepEqual(failing, [], `contrast below 4.5:1: ${JSON.stringify(failing)}`);
});

test("document shell preserves language, one page heading, form labels and image alternatives", () => {
  const document = renderSiteDocument({
    basePath: "",
    title: "場所を探す",
    lang: "ja",
    hideGlobalRecordLauncher: true,
    body: '<h1>場所を探す</h1><label>場所<input type="search" aria-label="場所を検索"></label><img src="/park.jpg" alt="公園の記録">',
  });
  assert.match(document, /<html lang="ja"/);
  assert.equal((document.match(/<h1\b/g) ?? []).length, 1);
  assert.match(document, /<label>場所<input type="search"/);
  assert.match(document, /<img src="\/park\.jpg" alt="公園の記録">/);
});
