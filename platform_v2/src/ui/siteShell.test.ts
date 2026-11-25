import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { runWithCspNonce } from "../services/cspNonce.js";
import { getSiteShellLayoutForPath } from "../siteMap.js";
import { renderAppExperienceLanguageSwitch } from "./appExperience.js";
import { globalRecordEntryAsset, renderSiteDocument } from "./siteShell.js";
import { renderPublicContextActions } from "./collaborationContext.js";
import { compactMaterializedCapture } from "../../cloudflare_shadow/scripts/compact-materialized-capture.mjs";

function withExternalRecordScript(html: string): string {
  const asset = globalRecordEntryAsset().content.toString("utf8");
  return html.replace(/<script src="[^"]*global-record-entry\.[a-f0-9]{12}\.js" defer><\/script>/, () => `<script>
${asset}
</script>`);
}

function renderRecordPage(options: Parameters<typeof renderSiteDocument>[0]): string {
  return withExternalRecordScript(renderSiteDocument(options));
}

function recordConfigJson(html: string): string {
  return html.match(/<script type="application\/json" id="global-record-config">([\s\S]*?)<\/script>/)?.[1] ?? "";
}

test("site shell renders the optional public-context handoff slot with its scoped behavior", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Public source",
    body: "<p>body</p>",
    lang: "ja",
    publicContextHtml: renderPublicContextActions({
      publicUrl: "https://zukan.earth/ja/places/iwata#details",
      title: "磐田の公開情報",
      sourceState: "public",
      rightsState: "public",
    }),
  });
  assert.match(html, /公開情報のリンクをコピー/);
  assert.match(html, /https:\/\/zukan\.earth\/ja\/places\/iwata/);
  assert.match(html, /data-public-context-copy/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /@media \(max-width: 520px\)/);
  assert.doesNotMatch(html, /nocosil\.com/);
});

test("site shell keeps the keyboard skip link at the 44px target contract", () => {
  const html = renderRecordPage({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja" });
  assert.match(html, /\.skip-link \{[\s\S]*?min-height: 44px;[\s\S]*?display: inline-flex;[\s\S]*?align-items: center;/);
});

test("site shell applies the shared design foundation once to both product and adjacent routes", () => {
  for (const currentPath of ["/ja/", "/ja/learn/field-loop"]) {
    const html = renderRecordPage({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja", currentPath });
    assert.match(html, /<body data-zukan-design="v1"/);
    assert.equal((html.match(/--zukan-action-primary:#143f2e/g) ?? []).length, 1);
    assert.match(html, /--ikimon-page-max: var\(--zukan-content-max\);/);
    assert.match(html, /box-shadow: 0 0 0 4px var\(--zukan-focus-yellow-300\);/);
  }
});

test("desktop shell controls keep a real 44px target contract", () => {
  const html = renderRecordPage({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja" });
  assert.match(html, /\.desktop-side-nav-toggle \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;[\s\S]*?flex: 0 0 44px;/);
  assert.match(html, /\.site-search \{[\s\S]*?min-height: 44px;[\s\S]*?padding: 0 14px;/);
  assert.match(html, /\.site-search-input \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-link \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-text-link \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.side-nav-collapsible-summary \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-mini-summary \{[\s\S]*?min-height: 44px;/);
  assert.match(html, /\.desktop-side-nav-legal \{[^}]*color: #64748b;/);
  assert.doesNotMatch(html, /\.desktop-side-nav-legal \{[^}]*color: #94a3b8;/);
  assert.match(html, /@media \(min-width: 1161px\) \{[\s\S]*?\.brand-logo-lockup \{[\s\S]*?min-height: 44px;/);
});

test("site shell hydrates the login link from the v2 session endpoint", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/learn",
  });

  assert.doesNotMatch(html, /class="btn btn-ghost site-login-link"/);
  assert.doesNotMatch(html, /class="desktop-side-nav-link site-login-link/);
  assert.match(html, /class="site-mobile-menu-account site-login-link"/);
  assert.match(html, /class="site-mobile-account-row"/);
  assert.match(html, /class="site-mobile-account-actions"/);
  assert.match(html, /class="site-mobile-return-links"/);
  assert.match(html, /<a class="site-mobile-return-link" href="\/ja\/profile">[\s\S]*<span>マイページ<\/span><\/a>/);
  assert.match(html, /<a class="site-mobile-return-link" href="\/ja\/records\?view=mine">[\s\S]*<span>自分の記録<\/span><\/a>/);
  assert.match(html, /class="site-account-icons"/);
  assert.match(html, /data-account-profile/);
  assert.match(html, /data-account-alerts/);
  assert.match(html, /data-account-settings/);
  assert.match(html, /\/login\?redirect=%2Fprofile/);
  assert.match(html, /\/api\/v1\/auth\/session\?optional=1/);
  assert.match(html, /ikimon:auth-session-ready/);
  assert.match(html, /publishAuthSessionReady\(false\)/);
  assert.match(html, /publishAuthSessionReady\(true, alertsRequest\)/);
  assert.match(html, /\/api\/v1\/me\/personalized-menu\?limit=8/);
  assert.match(html, /\/api\/v1\/me\/alerts/);
  assert.match(html, /\/api\/v1\/me\/alerts\/read/);
  assert.match(html, /data-notification-panel/);
  assert.match(html, /<div class="site-notification-head">[\s\S]*href="\/ja\/profile"[^>]*>マイページ<\/a>/);
  assert.match(html, /data-notification-toggle/);
  assert.match(html, /data-notification-read-all/);
  assert.match(html, /\.site-notification-badge\[hidden\] \{ display: none; \}/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest\?lang=ja"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/assets\/brand\/zukan-apple-touch-icon\.png"/);
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/assets\/brand\/zukan-favicon-32\.png"/);
  assert.match(html, /rel="icon" type="image\/x-icon" sizes="32x32" href="\/favicon\.ico"/);
  assert.match(html, /rel="icon" type="image\/png" sizes="192x192" href="\/assets\/brand\/zukan-app-icon-192\.png"/);
  assert.match(html, /navigator\.languages/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/app-sw\.js'/);
  assert.match(html, /updateViaCache: 'none'/);
  assert.match(html, /registration\.update\(\)/);
  assert.match(html, /data-app-install-prompt/);
  assert.match(html, /<meta name="theme-color" content="#245c3a" \/>/);
  assert.match(html, /data-app-launch-screen/);
  assert.match(html, /ikimon:app-launch-screen-shown-v1/);
  assert.match(html, /is-app-launch-screen-eligible/);
  assert.match(html, /appLaunchMarkBreath/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  const launchHtml = html.slice(html.indexOf("data-app-launch-screen"), html.indexOf("data-language-suggestion"));
  assert.match(launchHtml, /alt=""/);
  assert.doesNotMatch(launchHtml, />\s*[^<\s][^<]*</);
  assert.doesNotMatch(launchHtml, /読み込み中|はじめよう/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
  assert.match(html, /desktop-side-nav-section--guest/);
  assert.match(html, /desktop-side-nav-section--signed-in/);
  assert.match(html, /desktop-side-nav-section--personalized/);
  assert.match(html, /data-side-nav-personalized-list/);
  assert.match(html, /parts\.push\('確認中' \+ needsIdCount \+ '件'\)/);
  assert.doesNotMatch(html, /parts\.push\('名前待ち' \+ needsIdCount\)/);
  assert.doesNotMatch(html, /ログインすると、フォロー中の分類群や観察エリアをここに固定します。/);
  assert.match(html, /desktop-side-nav-mini-card/);
  assert.doesNotMatch(html, /data-zukan-app-experience="v1"/);
  assert.match(html, /class="site-nav site-nav-desktop site-core-nav"/);
  assert.match(html, /data-global-record-trigger="photo"/);
  assert.match(html, />ホーム<\/a>/);
  assert.match(html, />場所<\/a>/);
  assert.match(html, />記録<\/a>/);
  assert.match(html, />参加<\/a>/);
  assert.match(html, /data-account-profile/);
  assert.match(html, /data-auth-member-href="\/ja\/records\?view=mine"/);
  assert.match(html, /href="\/ja\/profile" title="マイページ"/);
  assert.match(html, /href="\/ja\/records\?view=mine" title="記録を見る"/);
  assert.match(html, /href="\/ja\/records" title="記録を見る"/);
  assert.match(html, /href="\/ja\/records\?view=needs_id">名前を待つ記録/);
  assert.doesNotMatch(html, /名前を待つ観察レコード/);
  assert.doesNotMatch(html, /href="\/ja\/observations\?filter=needs_id" title="同定"/);
  assert.match(html, /href="\/ja\/learn\/updates"/);
  assert.doesNotMatch(html, /desktop-side-nav-section-title">今日使う/);
  assert.match(html, /desktop-side-nav-section-title">今日の続き/);
  assert.match(html, /desktop-side-nav-section-title">フォロー中/);
  assert.match(html, /desktop-side-nav-section-title">探す・見る/);
  assert.match(html, /desktop-side-nav-section-title">地域・みんな/);
  assert.match(html, /side-nav-collapsible-summary">更新・連絡/);
  assert.match(html, /href="\/ja\/learn\/field-loop">観察の流れ/);
  assert.match(html, /href="\/ja\/learn\/glossary">用語集/);
  assert.doesNotMatch(html, /政策・企業活動と自然/);
  assert.doesNotMatch(html, /href="\/ja\/for-business/);
  assert.doesNotMatch(html, /href="\/ja\/specialist/);
  assert.match(html, /html\[data-auth="signed-in"\] \.desktop-side-nav-section--guest/);
  assert.match(html, /\.site-mobile-menu-section\.desktop-side-nav-section--signed-in \{[^}]*display: none;/);
  assert.match(html, /window\.ikimonAppOutbox/);
  assert.match(html, /class="site-core-nav-link is-capture" data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /class="desktop-side-nav-link[^"]*" href="\/ja\/record(?:\?|")/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /location: latestCaptureLocation,/);
  assert.match(html, /const resolvedLocation = await requestCaptureLocation\(true\) \|\| metadata\.location;/);
  assert.match(html, /let latestCaptureLocationAt = 0;/);
  assert.match(html, /maximumAge: forceFresh \? 0 : 15000/);
  assert.match(html, /latestCaptureLocation = null;\s+latestCaptureLocationAt = 0;\s+\}/);
  assert.doesNotMatch(html, /void requestCaptureLocation\(true\);/);
  assert.match(html, /button\.addEventListener\('click', \(event\) => \{\s+event\.preventDefault\(\);/);
  assert.match(html, /ikimon-app-outbox-v1/);
  assert.match(html, /window\.ikimonRequestAppOutboxSync/);
  assert.match(html, /registration\.sync\.register\('ikimon-app-outbox-sync'\)/);
  assert.match(html, /ikimon-app-outbox-change/);
  assert.match(html, /ikimon:app-outbox-sync/);
  assert.match(html, /G-NCL0M1VJZ2/);
  assert.match(html, /googletagmanager\.com\/gtag\/js/);
  assert.match(html, /window\.gtag\('config', googleTagId\)/);
  assert.match(html, /window\.ikimonExternalAnalytics = \{ track: trackExternalAnalytics \}/);
  assert.match(html, /window\.gtag\('event', name, params\)/);
  assert.match(html, /window\.clarity\('event', name\)/);
  assert.match(html, /window\.clarity\('set', 'ikimon_action', params\.action_key\)/);
  assert.match(html, /www\.clarity\.ms\/tag/);
  assert.match(html, /wl2ezvfqbh/);
  assert.match(html, /const loadAnalyticsScripts = \(\) => \{[\s\S]*googletagmanager\.com\/gtag\/js[\s\S]*www\.clarity\.ms\/tag/);
  assert.match(html, /window\.setTimeout\(\(\) => \{\s*if \(typeof window\.requestIdleCallback === 'function'\)/);
  assert.match(html, /\}, 3000\)/);
  assert.match(html, /window\.addEventListener\('load', scheduleAnalyticsLoad, \{ once: true \}\)/);
  assert.match(html, /host !== 'ikimon\.life' && host !== 'www\.ikimon\.life'/);
  assert.match(html, /<span class="brand-logo-lockup"><img class="brand-lockup-img" src="\/assets\/brand\/zukan-lockup\.svg" alt="ZUKAN" width="150" height="32" \/><\/span>/);
  assert.equal((html.match(/class="brand-lockup-img"/g) ?? []).length, 1);
  assert.match(html, /\.brand-logo-lockup \{[\s\S]*align-items: center;[\s\S]*gap: 7px;/);
  assert.match(html, /\.brand-lockup-img \{ display: block; width: 150px; height: 32px; object-fit: contain; \}/);
  assert.match(html, /--ikimon-header-brand-w: max\(var\(--ikimon-desktop-sidebar-w\), 154px\);/);
  assert.match(html, /body\.is-desktop-side-nav-collapsed \{[\s\S]*--ikimon-header-brand-w: 154px;/);
  assert.match(html, /grid-template-columns: var\(--ikimon-header-brand-w\) minmax\(280px, 640px\) minmax\(0, 1fr\);/);
  assert.match(html, /\.site-search-desktop \{[\s\S]*grid-column: 2;/);
  assert.match(html, /\.site-header-actions-desktop \{[\s\S]*grid-column: 3;[\s\S]*justify-self: end;/);
  assert.match(html, /@media \(min-width: 1161px\) \{[\s\S]*\.site-header-actions-mobile \{[\s\S]*display: none !important;/);
  assert.match(html, /@media \(max-width: 1160px\) \{[\s\S]*\.desktop-side-nav-toggle \{[\s\S]*display: none !important;/);
  assert.match(html, /@media \(max-width: 430px\) \{[\s\S]*\.brand-logo-lockup \{[\s\S]*gap: 6px;[\s\S]*\.brand-lockup-img \{ width: 131px; height: 28px; \}/);
  assert.doesNotMatch(html, /<span class="brand-name">ikimon<\/span>/);
  assert.doesNotMatch(html, /class="brand-domain">\.life/);
  assert.match(html, /<meta name="application-name" content="ZUKAN" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="ZUKAN" \/>/);
  assert.match(html, /<meta property="og:site_name" content="ZUKAN" \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/zukan\.earth\/assets\/brand\/zukan-ogp-default\.png" \/>/);
  assert.match(html, /<meta property="og:image:type" content="image\/png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta property="og:image:alt" content="ZUKAN" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/zukan\.earth\/ja\/learn" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/zukan\.earth\/assets\/brand\/zukan-ogp-default\.png" \/>/);
  assert.match(html, /<span>ZUKAN<\/span>\s*<span>地域の記録を、みんなで育てる。<\/span>/);
  assert.doesNotMatch(html, /aria-label="ikimon"|application-name" content="ikimon|apple-mobile-web-app-title" content="ikimon|og:site_name" content="ikimon|og:image:alt" content="ikimon"/i);
});

test("site shell replaces existing and empty script nonce attributes with the active CSP nonce", () => {
  const html = runWithCspNonce("shell-test-nonce", () => renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<script nonce=\"stale-shell-nonce\">window.staleNonceScript = true;</script><script nonce=\"\">window.emptyNonceScript = true;</script><script>window.missingNonceScript = true;</script>",
    lang: "ja",
  }));

  assert.match(html, /<script nonce="shell-test-nonce">window\.staleNonceScript = true;<\/script>/);
  assert.match(html, /<script nonce="shell-test-nonce">window\.emptyNonceScript = true;<\/script>/);
  assert.match(html, /<script nonce="shell-test-nonce">window\.missingNonceScript = true;<\/script>/);
  assert.doesNotMatch(html, /stale-shell-nonce/);
  assert.doesNotMatch(html, /<script\b[^>]*\bnonce=""/);
});

class FakeNode {
  attrs = new Map<string, string>();
  classes = new Set<string>();
  parentElement: FakeNode | null = null;
  nextElementSibling: FakeNode | null = null;
  hidden = false;
  removed = false;
  replacedWith: FakeNode | null = null;
  style: Record<string, string> = {};
  textContent = "";
  className = "";
  constructor(public tagName: string) {}
  get classList() {
    return { add: (c: string) => { this.classes.add(c); }, remove: (c: string) => { this.classes.delete(c); } };
  }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attrs.has(name); }
  closest(selector: string): FakeNode | null {
    for (let el: FakeNode | null = this; el; el = el.parentElement) {
      if (selector.startsWith(".") ? el.classes.has(selector.slice(1)) : el.attrs.has(selector.slice(1, -1))) return el;
    }
    return null;
  }
  remove(): void { this.removed = true; }
  replaceWith(node: FakeNode): void { this.replacedWith = node; this.removed = true; }
}

function fakeImg(attrs: Record<string, string>, parent: FakeNode | null = null): FakeNode {
  const img = new FakeNode("IMG");
  for (const [name, value] of Object.entries(attrs)) img.attrs.set(name, value);
  img.parentElement = parent;
  return img;
}

function shellListeners(html: string) {
  const body = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).find((s) => s.includes("addEventListener('error'"));
  assert.ok(body);
  const listeners: Record<string, (event: { target: unknown }) => void> = {};
  const printed = { count: 0 };
  runInNewContext(body, {
    HTMLImageElement: FakeNode,
    Element: FakeNode,
    window: { print: () => { printed.count += 1; } },
    document: {
      addEventListener: (type: string, fn: (event: { target: unknown }) => void, capture?: boolean) => {
        listeners[type] = fn;
        if (type === "error") assert.equal(capture, true);
      },
      createElement: (tag: string) => new FakeNode(tag.toUpperCase()),
    },
  });
  return { error: listeners.error!, click: listeners.click!, printed };
}

test("site shell ships one nonce-bound capture listener and no inline event handlers", () => {
  const html = runWithCspNonce("shell-fb-nonce", () => renderRecordPage({ basePath: "", title: "Test", body: '<img src="x" data-fb="next" />', lang: "ja" }));
  assert.match(html, /<script nonce="shell-fb-nonce">\(function\(\)\{[\s\S]*?addEventListener\('error'[\s\S]*?\},\s*true\);/);
  assert.match(html, /addEventListener\('click'[\s\S]*?closest\('\[data-print\]'\)/);
  assert.doesNotMatch(html, /\son(error|click|load)=/);
});

test("image fallback verbs next, remove, replace and text-parent act only on data-fb images", () => {
  const { error } = shellListeners(renderRecordPage({ basePath: "", title: "Test", body: "<p>x</p>", lang: "ja" }));

  const next = fakeImg({ "data-fb": "next", "data-fb-display": "grid", "data-fb-next-class": "is-visible" });
  next.nextElementSibling = new FakeNode("DIV");
  next.nextElementSibling.hidden = true;
  error({ target: next });
  assert.equal(next.hidden, true);
  assert.equal(next.style.display, "none");
  assert.equal(next.nextElementSibling.hidden, false);
  assert.equal(next.nextElementSibling.style.display, "grid");
  assert.ok(next.nextElementSibling.classes.has("is-visible"));

  const host = new FakeNode("DIV");
  host.classes.add("me-own-stack-item");
  const removeAdd = fakeImg({ "data-fb": "remove", "data-fb-host": ".me-own-stack-item", "data-fb-host-add": "is-photo-missing" }, host);
  error({ target: removeAdd });
  assert.ok(host.classes.has("is-photo-missing"));
  assert.equal(removeAdd.removed, true);
  assert.equal(host.removed, false);

  const drop = new FakeNode("DIV");
  drop.classes.add("me-discovery-preview");
  drop.classes.add("has-photo");
  const removeDrop = fakeImg({ "data-fb": "remove", "data-fb-host": ".me-discovery-preview", "data-fb-host-drop": "has-photo" }, drop);
  error({ target: removeDrop });
  assert.equal(drop.classes.has("has-photo"), false);
  assert.equal(removeDrop.removed, true);

  const cover = new FakeNode("DIV");
  cover.classes.add("me-area-cover");
  const removeHost = fakeImg({ "data-fb": "remove", "data-fb-host": ".me-area-cover", "data-fb-host-remove": "1" }, cover);
  error({ target: removeHost });
  assert.equal(cover.removed, true);
  assert.equal(removeHost.removed, false);

  const wrap = new FakeNode("DIV");
  const parentHost = fakeImg({ "data-fb": "remove", "data-fb-host": ":parent", "data-fb-host-add": "is-empty" }, wrap);
  error({ target: parentHost });
  assert.ok(wrap.classes.has("is-empty"));
  assert.equal(parentHost.removed, true);

  const replaced = fakeImg({ "data-fb": "replace", "data-fb-tag": "div", "data-fb-class": "obs-nearby-nophoto", "data-fb-text": "📷" });
  error({ target: replaced });
  assert.equal(replaced.replacedWith?.tagName, "DIV");
  assert.equal(replaced.replacedWith?.className, "obs-nearby-nophoto");
  assert.equal(replaced.replacedWith?.textContent, "📷");

  const defaultTag = fakeImg({ "data-fb": "replace", "data-fb-class": "obs-hero-avatar", "data-fb-text": "A" });
  error({ target: defaultTag });
  assert.equal(defaultTag.replacedWith?.tagName, "SPAN");

  const parent = new FakeNode("SPAN");
  const textParent = fakeImg({ "data-fb": "text-parent", "data-fb-text": "A" }, parent);
  error({ target: textParent });
  assert.equal(textParent.removed, true);
  assert.equal(parent.textContent, "A");

  const plain = fakeImg({ src: "x" });
  error({ target: plain });
  assert.equal(plain.removed, false);
  assert.equal(plain.hidden, false);
});

test("image fallback listener ignores non-image error targets and print clicks open the print dialog", () => {
  const { error, click, printed } = shellListeners(renderRecordPage({ basePath: "", title: "Test", body: "<p>x</p>", lang: "ja" }));
  assert.doesNotThrow(() => error({ target: new FakeNode("DIV") }));
  const button = new FakeNode("BUTTON");
  button.attrs.set("data-print", "");
  click({ target: button });
  assert.equal(printed.count, 1);
  click({ target: new FakeNode("DIV") });
  assert.equal(printed.count, 1);
});

test("app records search belongs to the content, with public guest navigation", () => {
  const html = renderRecordPage({basePath: "", title: "Records", body: "<p>records</p>", lang: "ja", currentPath: "/ja/records?view=public&q=bird"});
  assert.doesNotMatch(html, /<form class="site-search/);
  assert.doesNotMatch(html, /<aside class="desktop-side-nav/);
  assert.match(html, /data-auth-guest-href="\/ja\/"/);
  assert.match(html, /data-auth-member-href="\/ja\/library"/);
  assert.match(html, /data-home-header/);
});

test("mobile menu panel can render outside the sticky header", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/learn",
  });

  assert.match(html, /\.site-header \{[^}]*z-index: 90;[^}]*overflow: visible;/);
  assert.match(html, /class="site-mobile-menu-toggle" aria-label="メニュー" title="メニュー"/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*position: absolute;[^}]*z-index: 2;[^}]*top: calc\(100% \+ 9px\);/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*background: #ffffff;/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*max-height: calc\(100dvh - 76px\);[^}]*overflow-y: auto;/);
  assert.match(html, /\.site-mobile-menu-panel \{[^}]*overscroll-behavior: contain;/);
  assert.match(html, /\.site-mobile-return-link \{[^}]*min-height: 54px;[^}]*border-radius: 12px;/);
  assert.match(html, /\.site-mobile-return-link \.desktop-side-nav-icon \{[^}]*width: 18px;[^}]*height: 18px;/);
});

test("language switch is user-facing while SEO stays Japanese canonical", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "en",
    currentPath: "/?lang=en",
  });
  const head = html.slice(0, html.indexOf("</head>"));

  const switcher = renderAppExperienceLanguageSwitch("en", "/?lang=en");
  assert.match(switcher, /class="lang-switch-label"/);
  assert.match(switcher, /class="lang-switch-current">EN<\/span>/);
  assert.match(switcher, /<span class="lang-switch-name">English<\/span>/);
  assert.match(switcher, /<details class="lang-switch lang-switch-desktop[^"]*" data-language-disclosure>/);
  assert.match(switcher, /<summary class="lang-switch-label" aria-label="Language: English">/);
  assert.match(switcher, /aria-current="true"/);
  assert.match(html, /\.lang-switch\[open\] \.lang-switch-options/);
  assert.doesNotMatch(html, /\.lang-switch:hover|\.lang-switch:focus-within/);
  assert.match(head, /<link rel="canonical" href="https:\/\/zukan\.earth\/ja\/" \/>/);
  assert.match(head, /<meta name="robots" content="noindex,follow" \/>/);
  assert.match(head, /hreflang="ja"/);
  assert.match(head, /hreflang="x-default"/);
  assert.doesNotMatch(head, /hreflang="en"/);
});

test("language disclosure preserves localized deep links and page has no mobile switch", () => {
  const currentPath = "/es/learn/field-loop?tab=places&q=renri#nearby";
  const html = renderRecordPage({ basePath: "", title: "Test", body: "<p>body</p>", lang: "es", currentPath });
  const desktop = renderAppExperienceLanguageSwitch("es", currentPath);
  assert.ok(desktop);
  for (const locale of ["ja", "en", "es", "pt-br"]) {
    assert.match(desktop, new RegExp(`href="/${locale}/learn/field-loop\\?tab=places&amp;q=renri#nearby"`));
  }
  assert.match(desktop, /<summary[^>]*aria-label="Idioma: Español"/);
  assert.match(desktop, /lang="es"[^>]*aria-current="true"/);
  assert.doesNotMatch(desktop, /aria-expanded=/, "native details owns its expanded state");
  assert.doesNotMatch(html, /class="lang-switch lang-switch-mobile"/);
  assert.match(html, /\.lang-switch-label \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(html, /\.lang-switch-link \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(html, /\.lang-switch-label:focus-visible/);
});

test("language disclosure closes with Escape and restores the trigger focus", () => {
  const html = renderRecordPage({ basePath: "", title: "Test", body: "<p>body</p>", lang: "ja" });
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .find((match) => match[1]!.includes("const disclosures = document.querySelectorAll('[data-language-disclosure]')"))?.[1];
  assert.ok(script);
  let keydown: (event: { key: string; preventDefault(): void }) => void = () => assert.fail("missing listener");
  let click: (event: { target: unknown }) => void = () => assert.fail("missing listener");
  let focused = false;
  let prevented = false;
  const inside = {};
  const disclosure = {
    open: true,
    addEventListener: (_type: string, handler: typeof keydown) => { keydown = handler; },
    querySelector: () => ({ focus: () => { focused = true; } }),
    contains: (target: unknown) => target === inside,
  };
  runInNewContext(script, { document: {
    querySelectorAll: () => [disclosure],
    addEventListener: (_type: string, handler: typeof click) => { click = handler; },
  } });
  keydown({ key: "Tab", preventDefault: () => { prevented = true; } });
  assert.equal(disclosure.open, true);
  keydown({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(disclosure.open, false);
  assert.equal(focused, true);
  assert.equal(prevented, true);
  disclosure.open = true;
  click({ target: inside });
  assert.equal(disclosure.open, true);
  click({ target: {} });
  assert.equal(disclosure.open, false);
});

test("site shell normalizes service name in visible page titles", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "地域カード管理 — ikimon.life",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.match(html, /<title>地域カード管理 — ZUKAN<\/title>/);
  assert.match(html, /<meta property="og:title" content="地域カード管理 — ZUKAN" \/>/);
  assert.match(html, /<meta name="twitter:title" content="地域カード管理 — ZUKAN" \/>/);
  assert.doesNotMatch(html, /<title>[^<]*ikimon\.life/);
});

test("browser language handling asks before switching away from Japanese SEO entry", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /data-language-suggestion/);
  assert.match(html, /data-language-suggestion-dismiss aria-label="閉じる"/);
  assert.match(html, /Use ZUKAN in English\?/);
  assert.match(html, /Cambiar a español/);
  assert.match(html, /Mudar para português/);
  assert.match(html, /ikimon:locale-suggestion-dismissed-v1/);
  assert.match(html, /source', 'device_locale'/);
  assert.match(html, /showLanguageSuggestion\(deviceLang\)/);
  assert.doesNotMatch(html, /location\.replace\('/);
  assert.doesNotMatch(html, /ikimon:locale-redirect-v1/);
});

test("app install prompt stores beforeinstallprompt without immediate display", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });
  const listenerStart = html.indexOf("window.addEventListener('beforeinstallprompt'");
  const listenerEnd = html.indexOf("if (dismissEl)", listenerStart);
  const listener = html.slice(listenerStart, listenerEnd);

  assert.match(listener, /event\.preventDefault\(\);/);
  assert.match(listener, /deferredPrompt = event;/);
  assert.match(listener, /window\.setTimeout\(showInstallPrompt, 0\);/);
  assert.doesNotMatch(listener, /promptEl\.hidden = false;/);
});

test("app install prompt excludes root while preserving localized return-value surfaces and mobile defense", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Records",
    body: "<p>records</p>",
    lang: "ja",
    currentPath: "/records?lang=ja",
  });
  const routeStart = html.indexOf("function isReturnValueInstallSurface()");
  const routeEnd = html.indexOf("function showInstallPrompt()", routeStart);
  const routeLogic = html.slice(routeStart, routeEnd);

  assert.ok(routeLogic.includes("replace(/"));
  assert.ok(routeLogic.includes("+$/, '')"));
  assert.doesNotMatch(routeLogic, /pathname === '\/'(?:\s|\|)/);
  assert.match(routeLogic, /pathname === '\/home'/);
  assert.match(routeLogic, /pathname === '\/records'/);
  assert.match(routeLogic, /pathname === '\/map'/);
  assert.match(routeLogic, /pathname === '\/profile'/);
  assert.doesNotMatch(routeLogic, /pathname === '\/record'/);
  assert.match(html, /\['ja', 'en', 'es', 'pt-br'\]\.includes\(segments\[0\]\.toLowerCase\(\)\)/);
  assert.match(html, /segments\.shift\(\);/);
  assert.match(html, /function isMobileInstallSurface\(\) \{\s+return window\.matchMedia\('\(max-width: 900px\) and \(pointer: coarse\)'\)\.matches;\s+\}/);
  assert.match(html, /if \(!promptEl \|\| !deferredPrompt \|\| isStandalone\(\) \|\| !isMobileInstallSurface\(\) \|\| !isReturnValueInstallSurface\(\)\) return;/);
});

test("global record entry is the external hashed asset by default and inlines only when disabled", () => {
  const asset = globalRecordEntryAsset();
  const external = renderSiteDocument({ basePath: "", title: "Record", body: "<p>x</p>", lang: "ja", currentPath: "/?lang=ja" });
  assert.ok(external.includes(`<script src="${asset.path}" defer></script>`));
  assert.doesNotMatch(external, /const CAMERA_START_TIMEOUT_MS/);
  assert.ok(asset.content.toString("utf8").includes("const CAMERA_START_TIMEOUT_MS"));
  assert.equal(JSON.parse(recordConfigJson(external)).recordTargets.photo, "/ja/record?start=photo");
  const en = JSON.parse(recordConfigJson(renderSiteDocument({ basePath: "", title: "Record", body: "<p>x</p>", lang: "en", currentPath: "/en/" })));
  assert.equal(typeof en.cameraCopy.sourceChoice, "object");
  const inline = renderSiteDocument({ basePath: "", title: "Record", body: "<p>x</p>", lang: "ja", currentPath: "/?lang=ja", externalizeGlobalRecordScript: false });
  assert.doesNotMatch(inline, /global-record-config|global-record-entry\./);
  assert.ok(inline.includes("const CAMERA_START_TIMEOUT_MS"));
});

test("global record capture script posts only server-accepted KPI event names", () => {
  const asset = globalRecordEntryAsset().content.toString("utf8");
  const accepted = new Set(["first_action", "task_completion", "section_view", "read_depth", "primary_cta_click", "map_area_detail_open", "place_profile_open", "place_theme_open", "place_image_error", "place_search_complete", "selected_place_cta_click", "funnel_step", "funnel_error"]);
  const posted = [...asset.matchAll(/eventName: '([a-z_]+)'/g)].map((match) => match[1]!);
  assert.ok(posted.includes("funnel_step"));
  for (const name of posted) assert.ok(accepted.has(name), name);
  assert.doesNotMatch(asset, /eventName: (?!')/);
});

test("site shell renders a global record footer nav outside the record flow", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /<nav class="[^"]*global-record-launcher"/);
  assert.equal(html.match(/<(?:button|a)[^>]+class="global-record-choice/g)?.length, 5);
  assert.equal(html.match(/data-global-record-input="gallery"/g)?.length, 1);
  assert.match(html, /data-global-record-input="gallery" type="file" accept="image\/\*" multiple/);
  assert.equal(html.match(/capture="environment"/g)?.length, 1);
  assert.match(html, /data-global-record-input="photo" type="file" accept="image\/\*" capture="environment" hidden/);
  assert.doesNotMatch(html, /data-global-record-input="gallery"[^>]*capture=/);
  assert.match(html, /files: draftFiles/);
  assert.match(html, /Array\.from\(input\.files\)/);
  assert.doesNotMatch(html, /class="global-record-entry"/);
  assert.doesNotMatch(html, /class="global-record-entry"[^>]*aria-expanded="false"/);
  assert.match(html, /data-kpi-action="capture_nav"/);
  assert.doesNotMatch(html, /data-global-record-trigger="gallery"/);
  assert.doesNotMatch(html, /data-record-target="\/ja\/record\?start=photo"/);
  assert.match(html, /data-global-record-gallery-select/);
  assert.match(html, /indexedDB\.open\(DB_NAME, 1\)/);
  assert.match(html, /source: 'record'/);
  assert.match(html, /const draftOwnerContext = async \(\) =>/);
  assert.match(html, /'latest:user:' \+ userId/);
  assert.match(html, /'latest:guest:' \+ token/);
  assert.match(html, /continuationToken/);
  assert.match(html, /id: 'record:' \+ draftKey/);
  assert.doesNotMatch(html, /const DRAFT_KEY = 'latest';/);
  assert.match(html, /data-global-record-camera-sheet/);
  assert.match(html, /data-global-record-mode="photo"[^>]+aria-pressed="true"[^>]*>写真<\/button>/);
  assert.match(html, /data-global-record-mode="video"[^>]+aria-pressed="false"[^>]*>動画<\/button>/);
  assert.match(html, /data-global-record-camera-video/);
  assert.match(html, /data-global-record-camera-image/);
  assert.match(html, /data-global-record-camera-zoom/);
  assert.match(html, /data-global-record-camera-zoom-range/);
  assert.match(html, /data-global-record-camera-zoom-max/);
  assert.match(html, /data-global-record-camera-focus/);
  assert.match(html, /data-global-record-camera-focus-range/);
  assert.match(html, /data-global-record-camera-focus-auto/);
  assert.match(html, /data-global-record-photo-tray/);
  assert.match(html, /data-global-record-photo-grid/);
  assert.match(html, /const savedRecordActionsHtml = \(message\) =>/);
  assert.match(html, /data-global-record-saved-action="records"/);
  assert.match(html, /data-global-record-saved-action="profile"/);
  assert.match(html, /data-global-record-saved-action="map"/);
  assert.match(html, /\/records\?view=mine&source=record_saved/);
  assert.match(html, /\/profile\?source=record_saved/);
  assert.match(html, /\/map\?tab=places&source=record_saved/);
  assert.match(html, /setStatusHtml\(savedRecordActionsHtml\(message\)\)/);
  assert.doesNotMatch(html, /escapeHtml\(message/);
  assert.match(html, /\.global-record-saved-actions \{/);
  assert.match(html, /\.global-record-saved-actions a \{/);
  assert.match(html, /data-photo-draft="true"/);
  assert.match(html, /data-active-kind/);
  assert.doesNotMatch(html, /ここで少し整える/);
  assert.doesNotMatch(html, /data-global-record-inline-edit/);
  assert.doesNotMatch(html, /data-global-record-data-estimate/);
  assert.match(html, /data-global-record-video-trim/);
  assert.match(html, /activeKind && activeKind !== kind[\s\S]+stopActiveStream\(\)/);
  assert.match(html, /object-fit: contain/);
  assert.match(html, /global-record-camera-preview video\[hidden\]/);
  assert.match(html, /\.global-record-camera-backdrop \{[\s\S]+z-index: 130;/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+z-index: 131;/);
  assert.match(html, /\.global-record-camera-close \{[\s\S]+position: fixed;[\s\S]+z-index: 133;/);
  assert.match(html, /\.global-record-camera-actions \{[\s\S]+z-index: 132;/);
  assert.match(html, /--global-record-visual-top/);
  assert.match(html, /--global-record-visual-height/);
  assert.match(html, /\.global-record-camera-actions \{/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\] \.global-record-photo-tray/);
  assert.match(html, /global-record-camera-sheet\[data-camera-active="true"\] \.global-record-photo-tray/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+top: calc\(max\(12px, env\(safe-area-inset-top\)\) \+ var\(--global-record-visual-top, 0px\)\);/);
  assert.match(html, /\.global-record-camera-sheet \{[\s\S]+padding: 10px 10px calc\(10px \+ var\(--global-record-camera-actions-space\)\);/);
  assert.match(html, /global-record-camera-sheet\[data-photo-draft="true"\] \.global-record-camera-preview/);
  assert.match(html, /global-record-camera-sheet\[data-photo-draft="true"\] \{\s+grid-template-rows: auto auto auto auto auto;/);
  assert.match(html, /\.global-record-camera-preview \{[\s\S]+touch-action: none;/);
  assert.match(html, /\.global-record-camera-zoom \{/);
  assert.match(html, /\.global-record-camera-zoom button \{/);
  assert.match(html, /--global-record-visual-bottom/);
  assert.match(html, /\.global-record-photo-cell img \{\s+position: absolute;\s+inset: 0;/);
  assert.doesNotMatch(html, /photoDraftSubmitConfirmUntil = nowMs\(\) \+ 4500/);
  assert.doesNotMatch(html, /もう一度押すと記録/);
  assert.match(html, /if \(files\.length > 0\) \{\s+setFooterActionMode\('submit'\);/);
  assert.match(html, /右で投稿、左でもう1枚撮れます。/);
  assert.match(html, /必要なら使う区間だけ選べます/);
  assert.match(html, /top: calc\(max\(12px, env\(safe-area-inset-top\)\) \+ var\(--global-record-visual-top, 0px\)\)/);
  assert.match(html, /height: clamp\(260px, min\(72dvh, calc\(var\(--global-record-visual-height, 100dvh\) - 212px\)\), 760px\)/);
  assert.match(html, /height: clamp\(240px, min\(70dvh, calc\(var\(--global-record-visual-height, 100dvh\) - 214px\)\), 640px\)/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\]:not\(\[data-camera-active="true"\]\):not\(\[data-photo-draft="true"\]\):not\(\[data-camera-error="true"\]\)/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\][\s\S]+\.global-record-camera-preview \{\s+display: none;/);
  assert.match(html, /global-record-camera-sheet\[data-active-kind="photo"\][\s\S]+\.global-record-camera-actions \{\s+position: static;/);
  assert.match(html, /grid-template-columns: 1fr;\s+gap: 8px;\s+padding: 0;/);
  assert.match(html, /\.global-record-camera-action \{\s+min-height: 56px;\s+white-space: normal;/);
  assert.match(html, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(html, /track\.getCapabilities/);
  assert.match(html, /capabilities && capabilities\.zoom/);
  assert.match(html, /applyConstraints\(\{ advanced: \[\{ zoom: next \}\] \}\)/);
  assert.match(html, /capabilities && capabilities\.focusDistance/);
  assert.match(html, /manualConstraint\.focusMode = 'manual'/);
  assert.match(html, /applyCameraFocusDistance/);
  assert.match(html, /data-global-record-camera-focus-minus/);
  assert.match(html, /data-global-record-camera-focus-plus/);
  assert.match(html, /photoCaptureSource = 'native'/);
  assert.match(html, /photoCaptureSource === 'native'/);
  assert.match(html, /cameraFocusCurrent \+ \(Number\(direction\) < 0 \? -cameraFocusStep : cameraFocusStep\)/);
  assert.match(html, /restoreCameraAutoFocus/);
  assert.match(html, /const applyCameraFocusAt = async \(clientX, clientY\)/);
  assert.match(html, /pointsOfInterest: \[point\]/);
  assert.match(html, /focusMode: 'single-shot'/);
  assert.match(html, /zoomMaxButton\.addEventListener\('click'/);
  assert.match(html, /applyCameraZoom\(cameraZoomMax\)/);
  assert.match(html, /cameraPinchDistance/);
  assert.match(html, /cameraPreviewGestureCanceled/);
  assert.match(html, /!cameraPreviewGestureCanceled/);
  assert.match(html, /window\.visualViewport\.addEventListener\('resize', syncVisualViewportVars\)/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(html, /const metadata = buildCaptureMetadata\(\);\s+showCapturedReview\(file, 'photo', metadata\);/);
  assert.doesNotMatch(html, /fillCaptureLocationLater/);
  assert.doesNotMatch(html, /const metadata = await buildCaptureMetadata\(\);\s+showCapturedReview\(file, 'photo', metadata\);/);
  assert.match(html, /撮影地点を確認しています/);
  assert.match(html, /場所なしで投稿します\.\.\./);
  assert.match(html, /global_record_capture_latency/);
  assert.match(html, /capture_to_review_ms/);
  assert.doesNotMatch(html, /gps_wait_ms/);
  assert.match(html, /camera_start_ms/);
  assert.match(html, /photo_prepare_ms/);
  assert.match(html, /observation_upsert_ms/);
  assert.match(html, /photo_upload_ms/);
  assert.match(html, /void startCamera\(\)/);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /MAX_PHOTO_DRAFT_FILES = 6/);
  assert.match(html, /PHOTO_UPLOAD_MAX_EDGE = 2560/);
  assert.match(html, /PHOTO_UPLOAD_QUALITY = 0\.88/);
  assert.doesNotMatch(html, /PHOTO_UPLOAD_JPEG_FALLBACK_QUALITY/);
  assert.match(html, /PHOTO_UPLOAD_CONCURRENCY = 2/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_WIDTH = 2560/);
  assert.match(html, /CAMERA_PHOTO_IDEAL_HEIGHT = 1920/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_WIDTH = 1280/);
  assert.match(html, /CAMERA_VIDEO_IDEAL_HEIGHT = 720/);
  assert.match(html, /video: cameraVideoConstraints\(\)/);
  assert.doesNotMatch(html, /redactCanvasFaces\(canvas\)/);
  assert.match(html, /server_async_face_privacy/);
  assert.match(html, /facePrivacy: upload\.facePrivacy \|\| null/);
  assert.match(html, /preparePhotoUpload/);
  assert.match(html, /canvasToImage\(canvas, 'image\/webp'\)/);
  assert.match(html, /image\/webp/);
  assert.match(html, /mapWithConcurrency\(files, PHOTO_UPLOAD_CONCURRENCY/);
  assert.match(html, /selectedPhotoDraftFiles/);
  assert.match(html, /data-global-record-photo-remove/);
  assert.match(html, /data-global-record-photo-move/);
  assert.doesNotMatch(html, /AIは全体を見て主役と周囲を判断します/);
  assert.doesNotMatch(html, /一緒に残せます/);
  assert.match(html, /photoDraftSubmitLabel/);
  assert.match(html, /global_photo_tray/);
  assert.match(html, /directPostInFlight/);
  assert.match(html, /photoDraftRetryDetailId/);
  assert.match(html, /photoDraftRetryVisitId/);
  assert.match(html, /photoDraftRetryHasUploadedPhoto/);
  assert.match(html, /const normalizeSavedObservationVisitId = \(json, fallbackId\) =>/);
  assert.match(html, /const normalizeSavedObservationTargetId = \(json, fallbackId\) =>/);
  assert.match(html, /photoUploadTargetId = normalizeSavedObservationVisitId\(observationJson, observationId\)/);
  assert.match(html, /detailId = normalizeSavedObservationTargetId\(observationJson, photoUploadTargetId \|\| observationId\)/);
  assert.match(html, /photoDraftRetryDetailId = detailId/);
  assert.match(html, /photoDraftRetryVisitId = photoUploadTargetId \|\| visitIdFromObservationTargetId\(detailId\)/);
  assert.match(html, /formatPhotoUploadFailureReason/);
  assert.doesNotMatch(html, /observation not found: ' \+ detailId/);
  assert.match(html, /clientSubmissionId/);
  assert.match(html, /client_photo_sha256s/);
  assert.match(html, /\/api\/v1\/observations\/upsert/);
  assert.match(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(photoUploadTargetId\) \+ '\/photos\/upload/);
  assert.match(html, /photoJson\.error/);
  assert.match(html, /uploadResults\.filter/);
  assert.match(html, /photo_upload_network_failed/);
  assert.match(html, /記録本体は保存済みです。写真は/);
  assert.match(html, /写真の通信確認だけ失敗しました。ホームに戻ると記録が見える場合があります/);
  assert.match(html, /同じ記録に再送/);
  assert.match(html, /失敗した' \+ String\(failed\) \+ '枚を再送/);
  assert.doesNotMatch(html, /\/api\/v1\/observations\/' \+ encodeURIComponent\(detailId\) \+ '\/reassess/);
  assert.match(html, /subject_inference: 'ai'/);
  assert.match(html, /data-global-record-camera-error/);
  assert.match(html, /data-global-record-camera-retry/);
  assert.match(html, /data-global-record-camera-cancel/);
  assert.match(html, /端末の写真から選ぶ/);
  assert.match(html, /global-record-camera-sheet\[data-camera-error="true"\] \.global-record-camera-preview/);
  assert.match(html, /@media \(min-width: 721px\) and \(max-width: 1160px\)/);
  assert.match(html, /@media \(min-width: 1161px\) \{\s+\.site-core-nav \{\s+display: flex;/);
  assert.match(html, /もう1枚撮る/);
  assert.match(html, /VIDEO_MAX_SECONDS = 60/);
  assert.match(html, /動画記録は最大60秒/);
  assert.match(html, /createSheetTrimmedVideoFile/);
  assert.doesNotMatch(html, /YouTube標準画質/);
  assert.doesNotMatch(html, /名前、メモを整えられます/);
  assert.match(html, /この内容で記録画面へ/);
  assert.match(html, /撮り直す/);
});

test("site shell moves the shared primary nav to the bottom across the tablet breakpoint", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Learn",
    body: "<h1>Learn</h1>",
    lang: "ja",
    currentPath: "/ja/learn",
  });

  assert.doesNotMatch(html, /data-zukan-app-experience="v1"/);
  assert.match(html, /class="site-nav site-nav-desktop site-core-nav"/);
  assert.match(html, /global-record-launcher/);
  assert.match(html, /@media \(min-width: 721px\) and \(max-width: 1160px\) \{[\s\S]*?\.global-record-launcher \{\s*display: grid;\s*\}[\s\S]*?\.site-core-nav \{\s*display: none;\s*\}[\s\S]*?\.site-shell\.has-global-record-launcher \{\s*padding-bottom: calc\(112px \+ max\(0px, env\(safe-area-inset-bottom\)\)\);/);
  assert.match(html, /@media \(min-width: 1161px\) \{\s*\.site-core-nav \{\s*display: flex;/);
  assert.equal(html.match(/<(?:button|a)[^>]+class="global-record-choice/g)?.length, 5);
});

test("primary mobile navigation is capture-first and keeps camera separate from the gallery", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Home",
    body: "<p>home</p>",
    lang: "ja",
    currentPath: "/ja/",
    homeChrome: "guest",
  });
  const launcher = html.match(/<nav class="[^"]*global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";

  assert.match(launcher, />ライブラリ<\/span>/);
  assert.match(launcher, />イベント<\/span>/);
  assert.match(launcher, />撮る<\/span>/);
  assert.match(launcher, />場所<\/span>/);
  assert.match(launcher, />自分<\/span>/);
  assert.ok(launcher.indexOf(">ライブラリ</span>") < launcher.indexOf(">イベント</span>"));
  assert.ok(launcher.indexOf(">イベント</span>") < launcher.indexOf(">撮る</span>"));
  assert.ok(launcher.indexOf(">撮る</span>") < launcher.indexOf(">場所</span>"));
  assert.ok(launcher.indexOf(">場所</span>") < launcher.indexOf(">自分</span>"));
  assert.match(launcher, /data-global-record-trigger="photo"/);
  assert.doesNotMatch(launcher, /data-global-record-trigger="gallery"/);
  assert.match(launcher, /global-record-choice is-active[^>]+href="\/ja\/"[^>]*aria-current="page"/);
  assert.match(html, /\.zukan-app-nav a\.is-capture\{background:var\(--zukan-action-capture\);color:#fff\}/);
  assert.match(html, /\.zukan-app-nav\.is-bottom a\.is-capture \.global-record-choice-icon/);
  assert.match(html, /data-global-record-gallery-select[^>]*>端末の写真から選ぶ<\/button>/);
  assert.match(html, /カメラを開けませんでした/);
  assert.match(html, /data-global-record-camera-retry[^>]*>カメラの利用を許可する<\/button>/);
  assert.match(html, /data-global-record-camera-cancel[^>]*>キャンセル<\/button>/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /capture_nav_tap/);
  assert.match(html, /camera_open_success/);
  assert.match(html, /camera_permission_denied/);
  assert.match(html, /camera_unavailable/);
  assert.match(html, /gallery_select_tap/);
  assert.match(html, /capture_completed/);
  assert.match(html, /capture_saved/);

  const profileHtml = renderRecordPage({
    basePath: "",
    title: "Profile",
    body: "<p>profile</p>",
    lang: "ja",
    currentPath: "/ja/profile",
  });
  const profileLauncher = profileHtml.match(/<nav class="[^"]*global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.match(profileLauncher, /aria-current="page"[^>]*>[\s\S]*?<span>自分<\/span>/);
});

test("browse navigation gives active state to the matching destination", () => {
  const surfaces = [
    { path: "/ja/", label: "ライブラリ", mobile: true },
    { path: "/ja/map?tab=places", label: "場所" },
    { path: "/ja/records?view=mine", label: "ライブラリ" },
    { path: "/ja/community/events", label: "イベント" },
    { path: "/ja/profile", label: "自分" },
  ];

  for (const surface of surfaces) {
    const html = renderRecordPage({
      basePath: "",
      title: surface.label,
      body: "<p>surface</p>",
      lang: "ja",
      currentPath: surface.path,
      homeChrome: "member",
    });
    const desktopNav = html.match(/<nav class="zukan-app-nav is-header"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const mobileNav = html.match(/<nav class="zukan-app-nav is-bottom global-record-launcher"[\s\S]*?<\/nav>/)?.[0] ?? "";

    assert.equal((desktopNav.match(/aria-current="page"/g) || []).length, surface.mobile === false ? 0 : 1);
    assert.equal((mobileNav.match(/aria-current="page"/g) || []).length, surface.mobile === false ? 0 : 1);
    if (surface.mobile !== false) assert.match(desktopNav, new RegExp(`aria-current="page">[\\s\\S]*?<span>${surface.label}</span>`));
    if (surface.mobile !== false) assert.match(mobileNav, new RegExp(`aria-current="page">[\\s\\S]*?<span>${surface.label}</span>`));
    const desktopCapture = desktopNav.match(/<a[^>]+data-global-record-trigger="photo"[^>]*>/)?.[0] ?? "";
    const mobileCapture = mobileNav.match(/<a[^>]+data-global-record-trigger="photo"[^>]*>/)?.[0] ?? "";
    assert.doesNotMatch(desktopCapture, /aria-current|is-active/);
    assert.doesNotMatch(mobileCapture, /aria-current|is-active/);
  }
});

test("logo is the auth-aware home entry and exposes its privacy-safe KPI", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Records",
    body: "<p>records</p>",
    lang: "ja",
    currentPath: "/ja/records",
  });
  assert.match(html, /<a class="brand[^"]*" href="\/ja\/"[^>]*data-kpi-event="logo_home_tap"/);
  assert.doesNotMatch(html, /<footer[^>]*>[\s\S]*>ホーム</);
});

test("site shell minimal chrome keeps guest top visually quiet", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Home",
    body: "<h1>記録を見る</h1>",
    lang: "ja",
    currentPath: "/?lang=ja",
    minimalChrome: true,
  });

  assert.match(html, /site-shell[^"]*is-minimal-chrome/);
  assert.match(html, /class="site-header site-header-minimal"/);
  assert.match(html, /class="btn btn-solid site-login-link" href="\/ja\/login\?redirect=%2Fprofile">ログイン<\/a>/);
  assert.match(html, /class="site-nav site-nav-desktop site-core-nav"/);
  assert.match(html, /class="site-core-nav-link is-capture" data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /href="[^"]*\/record\?start=photo"[^>]*data-global-record-trigger="photo"/);
  assert.doesNotMatch(html, /<nav class="desktop-side-nav-inner"/);
  assert.doesNotMatch(html, /<form class="site-search site-search-desktop"/);
  assert.doesNotMatch(html, /<div class="site-mobile-menu-panel"/);
  assert.match(html, /\.site-shell\.is-minimal-chrome \.shell\.shell-layout-home/);
  assert.match(html, /width: min\(680px, calc\(100% - 48px\)\)/);
});

test("site shell home chrome emits state-aware guest and member controls without the global launcher", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Home",
    body: '<h1>Home</h1>',
    lang: "ja",
    currentPath: "/ja/",
    homeChrome: "member",
    hideGlobalRecordLauncher: true,
  });
  assert.match(html, /class="site-header site-header-home/);
  assert.match(html, /data-home-auth-state="member"/);
  assert.match(html, /home-header-actions is-guest/);
  assert.match(html, /home-header-actions is-member/);
  assert.doesNotMatch(html, /<nav class="[^"]*global-record-launcher"/);
  assert.doesNotMatch(html, /class="desktop-side-nav"/);
});

test("site shell localizes the mobile global record launcher", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "en",
    currentPath: "/?lang=en",
  });

  assert.match(html, /aria-label="Main pages"/);
  assert.match(html, />Library<\/span>/);
  assert.match(html, />Events<\/span>/);
  assert.match(html, />Capture<\/span>/);
  assert.match(html, />Places<\/span>/);
  assert.match(html, />Me<\/span>/);
  assert.match(html, /class="home-header-login site-login-link" href="\/en\/login\?redirect=%2Fprofile">Sign in</);
  assert.match(html, /Capture a record/);
  assert.match(html, /Choose from device/);
  assert.doesNotMatch(html, /aria-label="主要ナビゲーション"/);
  assert.doesNotMatch(html, />撮る<\/span>/);
});

test("site shell excludes the global record launcher from record surfaces", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });
  const localizedHtml = renderRecordPage({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/ja/record?start=photo",
  });
  const subpathHtml = renderRecordPage({
    basePath: "",
    title: "Record draft",
    body: "<p>record draft</p>",
    lang: "ja",
    currentPath: "/record/drafts?lang=ja",
  });

  for (const rendered of [html, localizedHtml, subpathHtml]) {
    assert.doesNotMatch(rendered, /<nav class="[^"]*global-record-launcher"/);
    assert.doesNotMatch(rendered, /site-shell has-global-record-launcher/);
    assert.doesNotMatch(rendered, /class="global-record-entry"/);
    assert.doesNotMatch(rendered, /data-global-record-trigger="photo"/);
  }
});

test("site shell treats guide outcomes as a reading surface with quick record actions", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Guide outcomes",
    body: "<p>outcomes</p>",
    lang: "ja",
    currentPath: "/guide/outcomes?lang=ja",
  });

  assert.match(html, /global-record-launcher/);
  assert.match(html, /site-shell has-global-record-launcher/);
});

test("desktop directory omits the duplicate primary rail while keeping its unique routes", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Learn",
    body: "<p>learn</p>",
    lang: "ja",
    currentPath: "/ja/learn/field-loop",
  });
  const desktopAside = html.match(/<aside class="desktop-side-nav"[\s\S]*?<\/aside>/)?.[0] ?? "";
  const desktopFind = desktopAside.match(/<section class="desktop-side-nav-section desktop-side-nav-section--secondary">\s*<h2 class="desktop-side-nav-section-title">探す・見る<\/h2>[\s\S]*?<\/section>/)?.[0] ?? "";
  const mobileDirectory = html.match(/<nav class="site-nav site-nav-mobile">[\s\S]*?<\/nav>/)?.[0] ?? "";

  assert.match(desktopAside, /aria-label="PC navigation directory"/);
  assert.doesNotMatch(desktopAside, /desktop-side-nav-section--primary|class="desktop-side-nav-link/);
  assert.match(desktopAside, /href="\/ja\/records\?view=public">記録を見る<\/a>/);
  assert.match(desktopAside, /href="\/ja\/lens">その場で見る<\/a>/);
  assert.match(desktopAside, /href="\/ja\/jobs">仕事を探す<\/a>/);
  assert.match(desktopAside, /href="\/ja\/guide">ライブガイド<\/a>/);
  assert.doesNotMatch(desktopFind, /href="\/ja\/community\/events"/);
  assert.match(html, /body\.is-desktop-side-nav-collapsed \.desktop-side-nav \{\s*display: none;/);

  assert.match(mobileDirectory, /href="\/ja\/"/);
  assert.match(mobileDirectory, /href="\/ja\/records"/);
  assert.match(mobileDirectory, /href="\/ja\/map"/);
  assert.match(mobileDirectory, /href="\/ja\/guide"/);
  assert.match(mobileDirectory, /href="\/ja\/community\/events"/);

  for (const localizedGuide of [
    { lang: "en" as const, href: "/en/guide", label: "Live guide" },
    { lang: "es" as const, href: "/es/guide", label: "Guia en vivo" },
    { lang: "pt-BR" as const, href: "/pt-br/guide", label: "Guia ao vivo" },
  ]) {
    const localizedHtml = renderRecordPage({
      basePath: "",
      title: "Learn",
      body: "<p>learn</p>",
      lang: localizedGuide.lang,
      currentPath: `/${localizedGuide.lang.toLowerCase()}/learn/field-loop`,
    });
    const localizedAside = localizedHtml.match(/<aside class="desktop-side-nav"[\s\S]*?<\/aside>/)?.[0] ?? "";
    assert.match(localizedAside, new RegExp(`href="${localizedGuide.href}">${localizedGuide.label}<\\/a>`));
    assert.doesNotMatch(localizedAside, /desktop-side-nav-section--primary|class="desktop-side-nav-link/);
  }
});

test("desktop side nav is opaque and footerless on immersive surfaces", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Map",
    body: "<p>map</p>",
    lang: "ja",
    currentPath: "/map?lang=ja",
    shellClassName: "shell-bleed shell-map",
  });

  assert.match(html, /\.desktop-side-nav \{[^}]*background: #ffffff;[^}]*backdrop-filter: none;/);
  assert.match(html, /\.site-shell\.is-immersive-surface \.desktop-side-nav \{[^}]*background: #ffffff;[^}]*backdrop-filter: none;/);
  assert.match(html, /\.site-shell\.is-immersive-surface \.desktop-side-nav \{[^}]*transition: transform \.22s ease, box-shadow \.18s ease;/);
  assert.match(html, /body\.is-desktop-side-nav-collapsed \.desktop-side-nav-section--secondary/);
  assert.match(html, /class="site-shell[^"]*is-immersive-surface/);
  assert.match(html, /class="shell shell-layout-immersive shell-bleed shell-map"/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
});

test("subpages use centered width contracts instead of homepage width", () => {
  const readingHtml = renderRecordPage({
    basePath: "",
    title: "Learn",
    body: "<p>learn</p>",
    lang: "ja",
    currentPath: "/learn/field-loop?lang=ja",
  });
  const wideHtml = renderRecordPage({
    basePath: "",
    title: "Observations",
    body: "<p>observations</p>",
    lang: "ja",
    currentPath: "/observations?lang=ja",
  });

  assert.match(readingHtml, /class="shell shell-layout-reading"/);
  assert.match(wideHtml, /class="shell shell-layout-wide"/);
  assert.match(readingHtml, /\.shell\.shell-layout-reading \{[^}]*--ikimon-shell-target-max: var\(--ikimon-reading-max\);/);
  assert.match(wideHtml, /--ikimon-shell-available-w: calc\(100% - var\(--ikimon-desktop-sidebar-w\)\);/);
  assert.doesNotMatch(wideHtml, /--ikimon-shell-available-w: calc\(100vw - var\(--ikimon-desktop-sidebar-w\)\);/);
  assert.match(wideHtml, /--ikimon-shell-effective-w: min\(var\(--ikimon-shell-target-max\), calc\(var\(--ikimon-shell-available-w\) - 96px\), calc\(var\(--ikimon-shell-available-w\) - var\(--ikimon-page-inline\)\)\);/);
  assert.match(wideHtml, /--ikimon-shell-side-space: max\(48px, calc\(\(var\(--ikimon-shell-available-w\) - var\(--ikimon-shell-effective-w\)\) \/ 2\)\);/);
  assert.match(wideHtml, /margin-left: calc\(var\(--ikimon-desktop-sidebar-w\) \+ var\(--ikimon-shell-side-space\)\);/);
});

test("desktop shell keeps the side nav expandable at tight desktop widths", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "Home",
    body: "<p>home</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*body\.is-desktop-side-nav-collapsed \{[\s\S]*--ikimon-desktop-sidebar-w: 72px;/);
  assert.doesNotMatch(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*\.brand-wordmark,\s*\.desktop-side-nav-label,[\s\S]*display: none;/);
  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*--ikimon-shell-margin-left: calc\(var\(--ikimon-desktop-sidebar-w\) \+ 48px\);/);
  assert.match(html, /@media \(min-width: 1161px\) and \(max-width: 1380px\) \{[\s\S]*width: min\(var\(--ikimon-page-max\), calc\(100% - var\(--ikimon-shell-margin-left\) - var\(--ikimon-shell-margin-right\)\)\);/);
});

test("major routes keep route-metadata layout contracts", () => {
  const cases = [
    { path: "/", layout: "home", className: "shell-layout-home" },
    { path: "/record", layout: "narrow", className: "shell-layout-narrow" },
    { path: "/guide", layout: "immersive", className: "shell-layout-immersive" },
    { path: "/map", layout: "immersive", className: "shell-layout-immersive" },
    { path: "/records", layout: "wide", className: "shell-layout-wide" },
    { path: "/observations/demo-id", layout: "wide", className: "shell-layout-wide" },
    { path: "/profile/demo-user", layout: "reading", className: "shell-layout-reading" },
    { path: "/learn/field-loop", layout: "reading", className: "shell-layout-reading" },
    { path: "/community", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/events", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/fields", layout: "wide", className: "shell-layout-wide" },
    { path: "/community/fields/demo-field", layout: "wide", className: "shell-layout-wide" },
    { path: "/for-business", layout: "wide", className: "shell-layout-wide" },
    { path: "/for-business/demo", layout: "wide", className: "shell-layout-wide" },
  ] as const;
  const snapshot = Object.fromEntries(cases.map((entry) => [entry.path, getSiteShellLayoutForPath(entry.path)]));

  assert.deepEqual(snapshot, Object.fromEntries(cases.map((entry) => [entry.path, entry.layout])));
  for (const entry of cases) {
    const html = renderRecordPage({
      basePath: "",
      title: entry.path,
      body: "<p>body</p>",
      lang: "ja",
      currentPath: `/ja${entry.path === "/" ? "/" : entry.path}`,
    });
    assert.match(html, new RegExp(`class="shell ${entry.className}`), entry.path);
  }
});


test("global record draft handoff includes a recovery source", () => {
  const html = renderRecordPage({
    basePath: "",
    title: "test",
    body: "<p>test</p>",
    lang: "ja",
    currentPath: "/",
  });
  assert.match(html, /const withDraftParams = \(href, kind, source, continuationToken\) =>/);
  assert.match(html, /url\.searchParams\.set\('source', recoverySource\)/);
  assert.match(html, /url\.searchParams\.set\('draft_token', String\(continuationToken\)\)/);
  assert.match(html, /navigateWithDraft\(files, 'photo', metadata, 'global_capture'\)/);
  assert.match(html, /navigateWithDraft\(selectedPhotoDraftFiles\(\), 'photo', capturedReviewMeta \|\| \{\}, 'login_required'\)/);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function cameraTestStream(capabilities: Record<string, unknown> = { focusMode: ["continuous"] }) {
  const track = {
    stops: 0,
    stop() { this.stops += 1; },
    getCapabilities: () => capabilities,
    getSettings: () => ({}),
  };
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}

class CameraTestNode {
  hidden = false;
  disabled = false;
  textContent = "";
  value = "";
  files: File[] = [];
  srcObject: unknown = null;
  clicks = 0;
  lang = "ja";
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<(event: { preventDefault(): void; target: CameraTestNode }) => unknown>>();
  classes = new Set<string>();
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  style = { setProperty() {}, removeProperty() {} };
  play = async () => {};
  pause() {}
  load() {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  addEventListener(name: string, handler: (event: { preventDefault(): void; target: CameraTestNode }) => unknown) {
    const handlers = this.listeners.get(name) ?? [];
    handlers.push(handler);
    this.listeners.set(name, handlers);
  }
  dispatch(name: string) {
    for (const handler of this.listeners.get(name) ?? []) handler({ preventDefault() {}, target: this });
  }
  click() {
    if (this.disabled) return;
    this.clicks += 1;
    this.dispatch("click");
  }
}

// Execute the emitted production script through its DOM listeners. No camera,
// network, browser permission, upload, or wall-clock timer is used by this fixture.
function cameraRuntime(lang: "ja" | "en" | "es" | "pt-BR" = "en", sourceChoice = true) {
  const rendered = renderRecordPage({ basePath: "", title: "Camera", body: "<p>Camera</p>", lang, currentPath: `/${lang}/learn/field-loop` });
  const html = compactMaterializedCapture(rendered);
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]!).find((value) => value.includes("const CAMERA_START_TIMEOUT_MS"));
  assert.ok(script);
  const elements = new Map<string, CameraTestNode>();
  const makeNode = (selector: string, attribute?: string, value = "") => {
    const node = new CameraTestNode();
    if (attribute) node.setAttribute(attribute, value);
    elements.set(selector, node);
    return node;
  };
  const cameraNode = (suffix: string) => makeNode(`[data-global-record-camera-${suffix}]`);
  const sheet = cameraNode("sheet");
  const video = cameraNode("video");
  const start = cameraNode("start");
  const capture = cameraNode("capture");
  const error = cameraNode("error");
  const errorBody = cameraNode("error-body");
  const retry = cameraNode("retry");
  const close = cameraNode("cancel");
  for (const suffix of ["title", "help", "status", "empty"]) cameraNode(suffix);
  sheet.hidden = error.hidden = capture.hidden = true;
  const triggers = Object.fromEntries(["photo", "video"].map((kind) => [kind, makeNode(`[data-global-record-trigger="${kind}"]`, "data-global-record-trigger", kind)]));
  const gallery = makeNode("[data-global-record-gallery-select]");
  const galleryInput = makeNode('[data-global-record-input="gallery"]', "data-global-record-input", "gallery");
  const photoInput = sourceChoice ? makeNode('[data-global-record-input="photo"]', "data-global-record-input", "photo") : null;
  const native = sourceChoice ? makeNode("[data-global-record-os-camera]") : null;
  const nativeFallback = sourceChoice ? makeNode("[data-global-record-os-camera-fallback]") : null;
  const focusFallback = cameraNode("focus-fallback");
  const errorActions = cameraNode("error-actions");
  const focusDevice = makeNode("[data-global-record-os-camera-focus]");
  const standard = makeNode("[data-global-record-camera-standard]");
  focusFallback.hidden = true;
  const nodeLists: Record<string, CameraTestNode[]> = {
    "[data-global-record-trigger]": Object.values(triggers),
    "[data-global-record-camera-close]": [],
    "[data-global-record-gallery-select]": [gallery],
    "[data-global-record-input]": photoInput ? [galleryInput, photoInput] : [galleryInput],
    "[data-global-record-os-camera]": native && nativeFallback ? [native, nativeFallback, focusDevice] : [],
    "[data-global-record-camera-standard]": [standard],
  };
  const configJson = recordConfigJson(html);
  const documentElement = new CameraTestNode();
  documentElement.lang = lang;
  const documentEvents = new CameraTestNode();
  const windowEvents = new CameraTestNode();
  const document = {
    documentElement,
    visibilityState: "visible",
    querySelector: (selector: string) => elements.get(selector) ?? null,
    querySelectorAll: (selector: string) => nodeLists[selector] ?? [],
    getElementById: (id: string) => (id === "global-record-config" ? { textContent: configJson } : null),
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
  };
  const requests: Array<ReturnType<typeof deferred<ReturnType<typeof cameraTestStream>>> & { constraints: { audio: boolean } }> = [];
  const timers = new Map<number, { run: () => void; delay: number }>();
  let timerId = 0;
  const events: Array<{ eventName: string; actionKey: string; metadata: Record<string, unknown> }> = [];
  const location = { pathname: `/${lang}/learn/field-loop`, search: "", origin: "https://camera-fixture.invalid" };
  runInNewContext(script, {
    document,
    window: {
      isSecureContext: true,
      location,
      innerWidth: 390,
      innerHeight: 844,
      confirm: () => true,
      addEventListener: windowEvents.addEventListener.bind(windowEvents),
    },
    location,
    navigator: { mediaDevices: { getUserMedia(constraints: { audio: boolean }) {
      const request = { ...deferred<ReturnType<typeof cameraTestStream>>(), constraints };
      requests.push(request);
      return request.promise;
    } } },
    File,
    URL,
    setTimeout(run: () => void, delay: number) { timers.set(++timerId, { run, delay }); return timerId; },
    clearTimeout(id: number) { timers.delete(id); },
    fetch: async (url: string, options: { body: string }) => {
      assert.equal(url, "/api/v1/ui-kpi/events", "camera-only fixture must not perform another request");
      events.push(JSON.parse(options.body));
      return { ok: true };
    },
  });
  return {
    focusFallback, errorActions, focusDevice, standard, constraintsOf: () => requests.map((request) => JSON.stringify(request.constraints)),
    sheet, video, start, capture, error, errorBody, retry, close, gallery, galleryInput, photoInput, native, nativeFallback,
    triggers, requests, timers, events,
    startPhoto() { triggers.photo!.dispatch("contextmenu"); if (sourceChoice) start.click(); },
    timeout() {
      const pending = [...timers].filter(([, timer]) => timer.delay === 10000);
      assert.equal(pending.length, 1);
      const [id, timer] = pending[0]!;
      timers.delete(id);
      timer.run();
    },
    hide() { document.visibilityState = "hidden"; documentEvents.dispatch("visibilitychange"); },
    show() { document.visibilityState = "visible"; documentEvents.dispatch("visibilitychange"); },
    pagehide() { windowEvents.dispatch("pagehide"); },
  };
}

const flushCameraTasks = () => new Promise<void>((resolve) => setImmediate(resolve));

test("camera timeout leaves recovery available and stops its late stream after retry succeeds", async () => {
  const runtime = cameraRuntime();
  runtime.startPhoto();
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.start.disabled, true);
  runtime.timeout();
  await flushCameraTasks();
  assert.equal(runtime.error.hidden, false);
  assert.match(runtime.errorBody.textContent, /camera did not start in time/i);
  assert.equal(runtime.start.disabled, false);
  assert.equal(runtime.nativeFallback?.hidden, false);
  runtime.retry.click();
  const current = cameraTestStream();
  runtime.requests[1]!.resolve(current);
  await flushCameraTasks();
  const late = cameraTestStream();
  runtime.requests[0]!.resolve(late);
  await flushCameraTasks();
  assert.equal(late.track.stops, 1);
  assert.equal(current.track.stops, 0);
  assert.equal(runtime.video.srcObject, current);
  assert.equal(runtime.error.hidden, true);
  assert.equal(runtime.capture.hidden, false);
  assert.equal(runtime.timers.size, 0);
});

for (const oldFailureOrder of ["before current success", "after current success"] as const) {
  test(`a stale camera rejection ${oldFailureOrder} cannot change the new attempt`, async () => {
    const runtime = cameraRuntime();
    runtime.startPhoto();
    runtime.close.click();
    runtime.startPhoto();
    const current = cameraTestStream();
    const rejectOld = async () => {
      runtime.requests[0]!.reject({ name: "NotAllowedError" });
      await flushCameraTasks();
      assert.equal(runtime.error.hidden, true);
      assert.equal(runtime.events.filter((event) => event.eventName === "camera_permission_denied").length, 0);
    };
    if (oldFailureOrder === "before current success") {
      await rejectOld();
      assert.equal(runtime.start.disabled, true, "old finally must not unlock the pending attempt");
      runtime.start.click();
      assert.equal(runtime.requests.length, 2, "a pending attempt remains single-flight");
    }
    runtime.requests[1]!.resolve(current);
    await flushCameraTasks();
    if (oldFailureOrder === "after current success") await rejectOld();
    assert.equal(runtime.video.srcObject, current);
    assert.equal(current.track.stops, 0);
    assert.equal(runtime.sheet.getAttribute("data-camera-active"), "true");
    assert.equal(runtime.capture.hidden, false);
  });
}

test("switching camera mode stops only the old late stream and keeps the video stream", async () => {
  const runtime = cameraRuntime();
  runtime.startPhoto();
  runtime.triggers.video!.click();
  assert.equal(runtime.requests[0]!.constraints.audio, false);
  assert.equal(runtime.requests[1]!.constraints.audio, true);
  const current = cameraTestStream({});
  runtime.requests[1]!.resolve(current);
  await flushCameraTasks();
  const old = cameraTestStream();
  runtime.requests[0]!.resolve(old);
  await flushCameraTasks();
  assert.equal(old.track.stops, 1);
  assert.equal(current.track.stops, 0);
  assert.equal(runtime.video.srcObject, current);
  assert.equal(runtime.sheet.getAttribute("data-active-kind"), "video");
  assert.equal(runtime.nativeFallback?.hidden, true);
  assert.equal(runtime.capture.hidden, false);
});

for (const exit of ["close", "hide", "pagehide", "gallery", "native"] as const) {
  test(`leaving a pending camera through ${exit} releases late media without reopening it`, async () => {
    const runtime = cameraRuntime();
    runtime.startPhoto();
    if (exit === "close") runtime.close.click();
    else if (exit === "hide") runtime.hide();
    else if (exit === "pagehide") runtime.pagehide();
    else if (exit === "gallery") runtime.gallery.click();
    else runtime.native?.click();
    const late = cameraTestStream();
    runtime.requests[0]!.resolve(late);
    await flushCameraTasks();
    assert.equal(late.track.stops, 1);
    assert.equal(runtime.video.srcObject, null);
    assert.equal(runtime.sheet.getAttribute("data-camera-active"), null);
    assert.equal(runtime.capture.hidden, true);
    assert.equal(runtime.error.hidden, true);
    assert.equal(runtime.events.filter((event) => event.eventName === "camera_open_success").length, 0);
    if (exit === "close") assert.equal(runtime.sheet.hidden, true);
    if (exit === "gallery") assert.equal(runtime.galleryInput.clicks, 1);
    if (exit === "native") assert.equal(runtime.photoInput?.clicks, 1);
    if (exit === "native" || exit === "gallery") assert.equal(runtime.start.textContent, "Macro camera");
  });
}

test("a delayed video play completion cannot restore a closed camera or hide a newer attempt", async () => {
  const runtime = cameraRuntime();
  const playing = deferred<void>();
  runtime.video.play = () => playing.promise;
  runtime.startPhoto();
  const old = cameraTestStream();
  runtime.requests[0]!.resolve(old);
  await flushCameraTasks();
  runtime.close.click();
  runtime.startPhoto();
  playing.resolve();
  await flushCameraTasks();
  assert.equal(old.track.stops, 1);
  assert.equal(runtime.start.disabled, true);
  assert.equal(runtime.capture.hidden, true);
  assert.equal(runtime.video.srcObject, null);
  assert.equal(runtime.events.filter((event) => event.eventName === "camera_open_success").length, 0);
  runtime.video.play = async () => {};
  const current = cameraTestStream();
  runtime.requests[1]!.resolve(current);
  await flushCameraTasks();
  assert.equal(runtime.video.srcObject, current);
  assert.equal(runtime.capture.hidden, false);
});

test("unsupported macro focus releases the stream and the error button reuses one native input listener", async () => {
  for (const capabilities of [{}, { focusMode: ["none"] }]) {
    const runtime = cameraRuntime();
    runtime.startPhoto();
    const stream = cameraTestStream(capabilities);
    runtime.requests[0]!.resolve(stream);
    await flushCameraTasks();
    assert.equal(stream.track.stops, 1);
    assert.equal(runtime.error.hidden, false);
    assert.match(runtime.errorBody.textContent, /focus/i);
    assert.equal(runtime.video.srcObject, null);
    assert.equal(runtime.nativeFallback?.listeners.get("click")?.length, 1);
    runtime.nativeFallback?.click();
    assert.equal(runtime.photoInput?.clicks, 1);
    assert.equal(runtime.requests.length, 1, "device camera reuses the file input instead of getUserMedia");
    assert.equal(runtime.events.filter((event) => event.eventName === "funnel_step" && event.metadata.event === "native_camera_tap").length, 1);
  }
  const regularCamera = cameraRuntime("en", false);
  regularCamera.triggers.photo!.dispatch("contextmenu");
  regularCamera.start.click();
  const stream = cameraTestStream({});
  regularCamera.requests[0]!.resolve(stream);
  await flushCameraTasks();
  assert.equal(stream.track.stops, 1, "shipped shell requires macro focus for the regular camera too");
  assert.equal(regularCamera.video.srcObject, null);
  assert.equal(regularCamera.error.hidden, false);
});

test("returning from the native camera keeps its photo ready to submit across a visibility change", async () => {
  const runtime = cameraRuntime();
  runtime.triggers.photo!.click();
  runtime.native?.click();
  assert.ok(runtime.photoInput);
  runtime.photoInput.files = [new File(["fixture"], "native-photo.jpg", { type: "image/jpeg" })];
  runtime.photoInput.dispatch("change");
  await flushCameraTasks();
  assert.equal(runtime.capture.hidden, false);
  assert.equal(runtime.sheet.getAttribute("data-photo-draft"), "true");
  const action = runtime.capture.textContent;
  runtime.native?.click();
  runtime.hide();
  runtime.show();
  assert.equal(runtime.capture.hidden, false, "canceling another native photo and hiding the page must retain the completed review");
  assert.equal(runtime.capture.textContent, action);
  assert.equal(runtime.requests.length, 0);
  runtime.close.click();
});

test("camera startup failures expose localized recovery text and a stable reason in all supported languages", async () => {
  const firstWords = { ja: /カメラ|このブラウザ/, en: /camera|browser/i, es: /cámara|navegador/i, "pt-BR": /câmera|navegador/i };
  for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
    for (const [name, reason] of [
      ["NotFoundError", "no_device"],
      ["NotReadableError", "device_busy"],
      ["OverconstrainedError", "constraints_unsupported"],
      ["NotAllowedError", "permission_denied"],
      ["timeout", "timeout"],
      ["focus_unsupported", "focus_unsupported"],
    ]) {
      const runtime = cameraRuntime(lang);
      runtime.startPhoto();
      if (name === "timeout") runtime.timeout();
      else if (name === "focus_unsupported") runtime.requests[0]!.resolve(cameraTestStream({}));
      else runtime.requests[0]!.reject({ name });
      await flushCameraTasks();
      assert.equal(runtime.error.hidden, false, `${lang}: ${name}`);
      assert.match(runtime.errorBody.textContent, firstWords[lang]);
      if (lang !== "ja") assert.doesNotMatch(runtime.errorBody.textContent, /[\u3040-\u30ff\u3400-\u9fff]/);
      assert.equal(runtime.events.find((event) => event.actionKey === "camera_start_failed")?.metadata.error, reason);
      assert.equal(runtime.start.disabled, false);
      assert.equal(runtime.timers.size, 0);
    }
  }
});


test("supported close-up camera keeps the exact photo constraints and goes live", async () => {
  const runtime = cameraRuntime("ja");
  runtime.startPhoto();
  assert.equal(
    runtime.constraintsOf()[0],
    '{"video":{"facingMode":{"ideal":"environment"},"width":{"ideal":2560},"height":{"ideal":1920}},"audio":false}'
  );
  runtime.requests[0]!.resolve(cameraTestStream({ focusMode: ["continuous"] }));
  await flushCameraTasks();
  assert.equal(runtime.error.hidden, true);
  assert.equal(runtime.focusFallback.hidden, true);
  assert.equal(runtime.capture.hidden, false);
});

test("unsupported close-up focus offers device camera and back-to-standard instead of a dead end", async () => {
  const runtime = cameraRuntime("ja");
  runtime.startPhoto();
  runtime.requests[0]!.resolve(cameraTestStream({}));
  await flushCameraTasks();
  assert.equal(runtime.error.hidden, false);
  assert.equal(runtime.errorBody.textContent, "このブラウザでは接写のピントを調整できません");
  assert.equal(runtime.focusFallback.hidden, false);
  assert.equal(runtime.errorActions.hidden, true);
  assert.equal(runtime.events.find((event) => event.actionKey === "camera_start_failed")?.metadata.error, "focus_unsupported");
  const html = compactMaterializedCapture(renderRecordPage({ basePath: "", title: "t", body: "<p>c</p>", lang: "ja", currentPath: "/ja/learn/field-loop" }));
  assert.match(html, /data-global-record-camera-focus-fallback[\s\S]*?端末のカメラで撮る[\s\S]*?標準に戻る/);
  runtime.focusDevice.click();
  assert.equal(runtime.photoInput?.clicks, 1);
  runtime.standard.click();
  assert.equal(runtime.error.hidden, true);
  assert.equal(runtime.focusFallback.hidden, true);
  assert.equal(runtime.errorActions.hidden, false);
  assert.equal(runtime.start.hidden, false);
});

test("privacy and terms render the operator statement; other pages do not", () => {
  for (const path of ["/ja/privacy", "/ja/terms", "/en/privacy"]) {
    const html = renderRecordPage({ basePath: "", title: "t", body: "<p>b</p>", lang: path.startsWith("/en") ? "en" : "ja", currentPath: path });
    assert.match(html, /<p class="footer-operator">(ZUKANはIKIMON株式会社が運営しています|ZUKAN is operated by IKIMON Inc\.)/);
  }
  const other = renderRecordPage({ basePath: "", title: "t", body: "<p>b</p>", lang: "ja", currentPath: "/ja/faq" });
  assert.doesNotMatch(other, /footer-operator">/);
});

test("privacy longform links to /ja/contact", async () => {
  const { readFile } = await import("node:fs/promises");
  const md = await readFile(new URL("../content/longform/ja/privacy.md", import.meta.url), "utf8");
  assert.doesNotMatch(md, /\]\(\/contact\)/);
  assert.equal((md.match(/\]\(\/ja\/contact\)/g) ?? []).length, 2);
});

test("site shell shares one in-flight /api/v1/auth/session?optional=1 promise across boot consumers", async () => {
  const vm = await import("node:vm");
  const html = renderRecordPage({
    basePath: "",
    title: "Map",
    body: "<div id='map-explorer'></div>",
    lang: "ja",
    currentPath: "/ja/map",
  });
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const authScript = scripts.find((s) => s.includes("ikimon:auth-session-ready"));
  const recordScript = scripts.find((s) => s.includes("const CAMERA_START_TIMEOUT_MS"));
  assert.ok(authScript && recordScript);
  assert.match(authScript, /__ikimonOptionalSessionPromise/);
  assert.match(recordScript, /__ikimonOptionalSessionPromise/);

  let sessionFetchCount = 0;
  const fakeWindow: Record<string, unknown> = {
    location: { pathname: "/ja/map", search: "" },
    addEventListener() {},
    dispatchEvent() {},
    CustomEvent: class { constructor(public type: string, public init?: unknown) {} },
    matchMedia: () => ({ matches: false }),
    indexedDB: {
      open: () => {
        const req: Record<string, unknown> = {};
        setImmediate(() => {
          if (typeof req.onerror === "function") (req.onerror as () => void)();
        });
        return req;
      },
    },
  };
  const fakeDoc = {
    getElementById: (id: string) => (id === "global-record-config" ? { textContent: recordConfigJson(html) } : null),
    documentElement: { lang: "ja", dataset: {} as Record<string, string>, classList: { add() {}, remove() {}, toggle() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const ctx = vm.createContext({
    window: fakeWindow,
    document: fakeDoc,
    navigator: {},
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    URL,
    CustomEvent: fakeWindow.CustomEvent,
    setTimeout,
    clearTimeout,
    fetch: async (url: string) => {
      if (url.includes("/api/v1/auth/session")) {
        sessionFetchCount += 1;
        return { ok: true, json: async () => ({ ok: false, error: "session_not_found", session: null }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  new vm.Script(recordScript).runInContext(ctx);
  new vm.Script(authScript).runInContext(ctx);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(sessionFetchCount, 1, "expected only one /api/v1/auth/session?optional=1 request");
});

test("site document renders no language switch links on pages with limited languages", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "用語集",
    lang: "ja",
    currentPath: "/ja/learn/glossary",
    alternateLangs: ["ja"],
    body: "<p>test</p>",
  });
  assert.doesNotMatch(html, /class="lang-switch-link/);
});

test("site shell includes global record trigger on /guide and 1-tap opens native capture=environment immediately", () => {
  const guideHtml = renderRecordPage({
    basePath: "",
    title: "ライブガイド",
    body: "<p>guide</p>",
    lang: "ja",
    currentPath: "/ja/guide",
  });
  assert.match(guideHtml, /data-global-record-trigger="photo"/);
  assert.match(guideHtml, /data-global-record-input="photo"[^>]*capture="environment"/);

  const runtime = cameraRuntime();
  assert.ok(runtime.photoInput);
  runtime.triggers.photo!.click();
  assert.equal(runtime.photoInput.clicks, 1, "1-tap must immediately open native capture=environment");
  assert.equal(runtime.sheet.hidden, true, "1-tap must not stop at chooser sheet");

  runtime.triggers.photo!.dispatch("contextmenu");
  assert.equal(runtime.sheet.hidden, false, "secondary action (contextmenu/long-press) opens chooser sheet");
});

test("site shell omits header language switcher, defines shared floating-bottom clearance, and sets :link/:visited color", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>Hello</p>",
    lang: "ja",
    currentPath: "/ja/guide"
  });
  assert.doesNotMatch(html, /<details class="lang-switch/);
  assert.match(html, /--ikimon-floating-bottom-space:/);
  assert.match(html, /a:where\(:link,:visited\)\{color:inherit;text-decoration:none\}/);
});
