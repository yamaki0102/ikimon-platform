import { gzipSync } from "node:zlib";
import { test, expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { buildLearnCatalog } from "../src/learn/catalog.js";
import { createLearnSearch, type LearnSearchState } from "../src/learn/search.js";
import { LEARN_CATALOG_STYLES, renderLearnCatalog } from "../src/learn/view.js";

// This suite is deliberately guest/read-only on local, staging and production.
// It does not use the existing account-creating Browser Run helper.
const sourceEntries = buildLearnCatalog();
const search = createLearnSearch();
const rootSelector = "[data-learn-catalog]";
const querySelector = "#learn-query";
const readySelector = '[data-learn-catalog][data-learn-ready="true"]';

test.use({
  serviceWorkers: "block",
  ignoreHTTPSErrors: false,
  // Screenshots and retained failure traces are the evidence for this scope.
  // Do not add an ffmpeg dependency just to record this read-only catalogue.
  video: "off",
  ...(process.env.LEARN_CATALOG_CHROMIUM_EXECUTABLE
    ? { launchOptions: { executablePath: process.env.LEARN_CATALOG_CHROMIUM_EXECUTABLE } }
    : {}),
});

async function makeReadOnly(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const telemetry = /(?:google-analytics\.com|analytics\.google\.com|googletagmanager\.com|clarity\.ms|cloudflareinsights\.com)$/u.test(url.hostname)
      || /\/(?:telemetry|analytics)(?:\/|$)/u.test(url.pathname);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) || telemetry) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

const uncaughtErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  await makeReadOnly(context);
  const errors: string[] = [];
  uncaughtErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }, testInfo) => {
  const errors = uncaughtErrors.get(page) ?? [];
  await testInfo.attach("uncaught-page-errors", { body: JSON.stringify(errors), contentType: "application/json" });
  expect(errors, "uncaught JavaScript errors (blocked telemetry requests are separate network events)").toEqual([]);
});

async function openCatalogue(page: Page, query = ""): Promise<void> {
  const response = await page.goto(`/ja/learn${query}`, { waitUntil: "domcontentloaded" });
  expect(response?.status(), "the Japanese catalogue must be a real public route").toBe(200);
  await expect(page.locator(readySelector)).toBeVisible();
}

async function pathsInView(page: Page): Promise<string[]> {
  return page.locator("[data-learn-entry]:visible").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-learn-entry") ?? ""));
}

async function expectState(page: Page, state: LearnSearchState): Promise<void> {
  await expect(page.locator(querySelector)).toHaveValue(state.q);
  await expect(page.getByRole("radio", { name: { all: "すべて", reading: "読みもの", term: "用語" }[state.kind], exact: true })).toBeChecked();
  const matchingPaths = search.search(sourceEntries, state).map((entry) => entry.path);
  await expect.poll(() => pathsInView(page)).toEqual(matchingPaths);
  await expect(page.locator("[data-learn-status]")).toHaveText(`検索結果 ${matchingPaths.length}件 / 全${sourceEntries.length}件`);
  await expect(page.locator(".is-learn-hub .doc-sidebar")).toBeHidden();
}

async function submitQuery(page: Page, q: string): Promise<void> {
  await page.locator(querySelector).fill(q);
  await page.locator("[data-learn-form]").getByRole("button", { name: "検索", exact: true }).click();
}

async function screenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test("registered catalogue contains every article once and every result URL resolves", async ({ page, request }, testInfo) => {
  await openCatalogue(page);
  const rows = page.locator("[data-learn-entry]");
  await expect(rows).toHaveCount(sourceEntries.length);
  expect(sourceEntries.length, "the full catalogue must extend beyond the old twenty-term introduction").toBeGreaterThan(20);
  const actualPaths = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-learn-entry")));
  expect(actualPaths).toEqual(sourceEntries.map((entry) => entry.path));
  expect(new Set(actualPaths).size).toBe(actualPaths.length);
  const hrefs = await rows.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs).toEqual(sourceEntries.map((entry) => `/ja${entry.path}`));

  const linkEvidence: { path: string; status: number; canonical: string | null }[] = [];
  // Four independent GETs at a time, bounded to the actual registered article set.
  for (let offset = 0; offset < hrefs.length; offset += 4) {
    const batch = await Promise.all(hrefs.slice(offset, offset + 4).map(async (href) => {
      const response = await request.get(href);
      const html = await response.text();
      expect(response.status(), href).toBe(200);
      expect(response.headers()["content-type"], href).toContain("text/html");
      expect(html, `${href} must render an article heading`).toMatch(/<h1\b/u);
      const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/u)?.[1] ?? null;
      expect(canonical, href).toBe(`https://zukan.earth${href}`);
      return { path: href, status: response.status(), canonical };
    }));
    linkEvidence.push(...batch);
  }
  await testInfo.attach("registered-article-links", { body: JSON.stringify(linkEvidence, null, 2), contentType: "application/json" });
  console.log(JSON.stringify({ evidence: "learn-catalog-links", articles: sourceEntries.length, reading: sourceEntries.filter((entry) => entry.kind === "reading").length, terms: sourceEntries.filter((entry) => entry.kind === "term").length, resolved: linkEvidence.length }));
});

test("Japanese canonical and staging/non-Japanese noindex policy remain unchanged", async ({ request, baseURL }) => {
  const origin = new URL(baseURL!);
  const staging = origin.hostname === "staging.zukan.earth" || origin.hostname === "ikimon-life-cloudflare-staging.yamaki0102.workers.dev";
  const local = ["127.0.0.1", "localhost"].includes(origin.hostname);
  for (const lang of ["ja", "en"]) {
    const response = await request.get(`/${lang}/learn`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/u)?.[1];
    expect(canonical).toBe("https://zukan.earth/ja/learn");
    const robots = (response.headers()["x-robots-tag"] ?? "") + " " + (html.match(/<meta\s+name="robots"\s+content="([^"]+)"/u)?.[1] ?? "");
    expect(/noindex/iu.test(robots), `${lang} policy at ${origin.hostname}`).toBe(staging || local || lang !== "ja");
    if (lang !== "ja") expect(html).not.toContain("data-learn-catalog");
  }
});

test("search, filter, article, browser history, reload, direct URL, zero and clear preserve the journey", async ({ page, context }, testInfo) => {
  await openCatalogue(page);
  await expect(page.locator("[data-learn-themes]")).toBeVisible();
  await expect(page.locator(".is-learn-hub .doc-sidebar")).toBeVisible();
  await expect(page.locator("[data-learn-results]")).not.toHaveAttribute("open", "");
  await submitQuery(page, "生物多様性");
  await expectState(page, { q: "生物多様性", kind: "all" });
  await page.getByRole("radio", { name: "用語", exact: true }).check();
  await expectState(page, { q: "生物多様性", kind: "term" });
  await expect(page.locator("[data-learn-themes]")).toBeHidden();
  const searchUrl = page.url();
  expect(new URL(searchUrl).searchParams.get("q")).toBe("生物多様性");
  expect(new URL(searchUrl).searchParams.get("kind")).toBe("term");
  const firstArticle = page.locator("[data-learn-entry]:visible a").first();
  const articleHref = await firstArticle.getAttribute("href");
  expect(articleHref).toMatch(/^\/ja\/learn\/terms\//u);
  await firstArticle.click();
  await expect(page).toHaveURL(new URL(articleHref!, searchUrl).href);
  await expect(page.locator("h1")).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(searchUrl);
  await expectState(page, { q: "生物多様性", kind: "term" });
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new URL(articleHref!, searchUrl).href);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectState(page, { q: "生物多様性", kind: "term" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectState(page, { q: "生物多様性", kind: "term" });
  const direct = await context.newPage();
  await direct.goto(searchUrl, { waitUntil: "domcontentloaded" });
  await expectState(direct, { q: "生物多様性", kind: "term" });
  await direct.close();

  await submitQuery(page, "該当なし確認用_zukan_20261011");
  await expectState(page, { q: "該当なし確認用_zukan_20261011", kind: "term" });
  await expect(page.locator("[data-learn-empty]")).toContainText("条件に合う記事が見つかりませんでした");
  await expect(page.locator("[data-learn-empty]")).toContainText("短い言葉や別の表記");
  await screenshot(page, testInfo, "learn-catalog-zero");
  await page.getByRole("link", { name: "条件を解除", exact: true }).click();
  await expect(page.locator(querySelector)).toHaveValue("");
  await expect(page.locator(querySelector)).toBeFocused();
  await expect(page.getByRole("radio", { name: "すべて", exact: true })).toBeChecked();
  await expect(page.locator("[data-learn-themes]")).toBeVisible();
  await expect(page.locator(".is-learn-hub .doc-sidebar")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectState(page, { q: "該当なし確認用_zukan_20261011", kind: "term" });
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expect(page.locator(querySelector)).toHaveValue("");
  await expect(page.locator("[data-learn-themes]")).toBeVisible();
});

test("Japanese, width, case, spaces, summaries and body headings search as literal text", async ({ page }) => {
  await openCatalogue(page);
  for (const q of ["生物多様性", "TNFD", "ＴＮＦＤ", "tnfd", "ﾈｲﾁｬｰﾎﾟｼﾞﾃｨﾌﾞ", "自然　TNFD", "自然関連の依存", "専門家だけでは足りない理由"]) {
    await submitQuery(page, q);
    await expectState(page, { q, kind: "all" });
    expect((await pathsInView(page)).length, `${q} must exercise a real match`).toBeGreaterThan(0);
  }
  await expect(page.locator('[data-learn-entry="/learn/citizen-science"]')).toBeVisible();
  await submitQuery(page, "  \u3000  ");
  await expect(page.locator(querySelector)).toHaveValue("");
  await expect(page.locator("[data-learn-themes]")).toBeVisible();
});

test("bounded long and HTML/script input cannot execute markup or replace catalogue content", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.addInitScript(() => { (window as Window & { __learnXss?: number }).__learnXss = 0; });
  const payload = '\"><img src=x onerror="window.__learnXss=1"><script>window.__learnXss=2</script>';
  await openCatalogue(page, `?${new URLSearchParams({ q: payload, kind: "term" })}`);
  await expectState(page, { q: payload, kind: "term" });
  await expect(page.locator(`${rootSelector} img, ${rootSelector} [onerror]`)).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __learnXss?: number }).__learnXss)).toBe(0);
  expect(dialogs).toEqual([]);
  await page.locator(querySelector).fill(payload);
  await page.locator(querySelector).press("Enter");
  await expectState(page, { q: payload, kind: "term" });
  expect(await page.evaluate(() => (window as Window & { __learnXss?: number }).__learnXss)).toBe(0);

  const longQuery = "長文".repeat(180);
  await openCatalogue(page, `?${new URLSearchParams({ q: longQuery, kind: "unknown" })}`);
  await expectState(page, { q: longQuery.slice(0, search.maxQueryLength), kind: "all" });
  await expect(page.locator(querySelector)).toHaveAttribute("maxlength", String(search.maxQueryLength));
  await page.locator(querySelector).press("Enter");
  expect(new URL(page.url()).searchParams.get("q")?.length).toBe(search.maxQueryLength);
  await expect(page.locator("[data-learn-entry]")).toHaveCount(sourceEntries.length);
});

test("labels, polite counts, keyboard focus and IME composition preserve controlled input", async ({ page }) => {
  await openCatalogue(page);
  const input = page.getByRole("searchbox", { name: "知りたい言葉から探す", exact: true });
  await expect(page.locator('label[for="learn-query"]')).toBeVisible();
  await expect(input).toHaveAttribute("aria-describedby", "learn-search-hint");
  await expect(page.locator("#learn-search-hint")).toContainText("本文の見出し");
  await expect(page.getByRole("group", { name: "記事の種類", exact: true })).toBeVisible();
  await expect(page.locator("[data-learn-status]")).toHaveAttribute("role", "status");
  await expect(page.locator("[data-learn-status]")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("[data-learn-status]")).toHaveAttribute("aria-atomic", "true");
  const initialStatus = await page.locator("[data-learn-status]").innerText();
  await input.focus();
  await input.fill("ＴＮＦＤ");
  await expect(input).toBeFocused();
  await expect(page.locator("[data-learn-status]")).toHaveText(initialStatus);
  await input.dispatchEvent("compositionstart", { data: "ＴＮＦＤ" });
  await input.press("Enter");
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator("[data-learn-status]")).toHaveText(initialStatus);
  await input.dispatchEvent("compositionend", { data: "ＴＮＦＤ" });
  await input.press("Enter");
  await expectState(page, { q: "ＴＮＦＤ", kind: "all" });
  await expect(input).toBeFocused();
  const focus = await input.evaluate((node) => {
    const css = getComputedStyle(node);
    return { visible: node.matches(":focus-visible"), outline: css.outlineStyle, width: Number.parseFloat(css.outlineWidth), shadow: css.boxShadow };
  });
  expect(focus.visible).toBeTruthy();
  expect((focus.outline !== "none" && focus.width >= 2) || focus.shadow !== "none").toBeTruthy();
  await page.getByRole("radio", { name: "すべて", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expectState(page, { q: "ＴＮＦＤ", kind: "reading" });
  await expect(page.getByRole("radio", { name: "読みもの", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expectState(page, { q: "ＴＮＦＤ", kind: "term" });
  await expect(page.getByRole("radio", { name: "用語", exact: true })).toBeFocused();
});

for (const width of [320, 390, 768, 1280]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: width < 768 ? 844 : 900 }, isMobile: width < 768, hasTouch: width < 768 });
    test(`catalogue remains readable and tappable at ${width}px`, async ({ page }, testInfo) => {
      await openCatalogue(page);
      await expect(page.locator("[data-learn-themes]")).toBeVisible();
      await expect(page.locator(".is-learn-hub .doc-sidebar")).toBeVisible();
      await screenshot(page, testInfo, `learn-catalog-${width}-initial`);
      const initialOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(initialOverflow).toBeLessThanOrEqual(1);
      for (const selector of [querySelector, ".learn-catalog-submit", ".learn-catalog-filter", ".learn-catalog-results > summary"]) {
        for (const box of await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => { const { width, height } = node.getBoundingClientRect(); return { width, height }; }))) {
          expect(box.width, `${selector} width`).toBeGreaterThanOrEqual(44);
          expect(box.height, `${selector} height`).toBeGreaterThanOrEqual(44);
        }
      }
      await submitQuery(page, "生物多様性");
      const terms = page.getByRole("radio", { name: "用語", exact: true });
      if (width < 768) await page.locator(".learn-catalog-filter").filter({ has: terms }).tap();
      else await terms.check();
      await expectState(page, { q: "生物多様性", kind: "term" });
      await screenshot(page, testInfo, `learn-catalog-${width}-results`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const clearBox = await page.locator("[data-learn-clear]").boundingBox();
      expect(clearBox?.height).toBeGreaterThanOrEqual(44);
      for (const height of await page.locator("[data-learn-entry]:visible a").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
      await expect(page.locator("[data-learn-entry]:visible .learn-catalog-summary").first()).toHaveCSS("font-weight", "400");
      await expect(page.locator("[data-learn-entry]:visible strong").first()).toHaveCSS("font-weight", "700");
      if (width < 768) {
        const firstArticle = page.locator("[data-learn-entry]:visible a").first();
        const href = await firstArticle.getAttribute("href");
        await firstArticle.tap();
        await expect.poll(() => new URL(page.url()).pathname).toBe(href);
        await page.goBack({ waitUntil: "domcontentloaded" });
        await expectState(page, { q: "生物多様性", kind: "term" });
        await page.getByRole("link", { name: "条件を解除", exact: true }).tap();
        await expect(page.locator(querySelector)).toHaveValue("");
        await expect(page.locator("[data-learn-themes]")).toBeVisible();
        await expect(page.locator(".is-learn-hub .doc-sidebar")).toBeVisible();
      }
    });
  });
}

test.describe("ordinary links without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("all registered articles and the existing themes remain navigable", async ({ page }) => {
    const response = await page.goto("/ja/learn?q=TNFD&kind=term", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-learn-form]")).toBeHidden();
    await expect(page.locator(`${rootSelector} noscript p`)).toContainText("テーマ別のリンク");
    await expect(page.locator("[data-learn-themes]")).toBeVisible();
    await expect(page.locator("[data-learn-entry] a")).toHaveCount(sourceEntries.length);
    await page.locator("[data-learn-results] > summary").click();
    const first = page.locator("[data-learn-entry] a").first();
    const href = await first.getAttribute("href");
    await first.click();
    expect(new URL(page.url()).pathname).toBe(href);
    await expect(page.locator("h1")).toBeVisible();
  });
});

test("[local-fixture] 1000 synthetic entries measure DOM update and compressed feature HTML", async ({ page, baseURL }, testInfo) => {
  test.skip(!baseURL || !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname), "Synthetic load evidence is isolated to a local server, never public content.");
  await openCatalogue(page);
  const synthetic = Array.from({ length: 1000 }, (_, index) => ({
    ...sourceEntries[index % sourceEntries.length]!,
    path: `/learn/local-fixture-${index}`,
    title: `ローカル試験 ${index} ${sourceEntries[index % sourceEntries.length]!.title}`,
  }));
  const featureHtml = renderLearnCatalog("", synthetic, "<h2>ローカル試験のテーマ</h2>");
  const fixtureHtml = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#1f2937;--surface:#fff;--accent:#047857;--muted:#64748b;--border:#ddd}body{max-width:880px;margin:24px auto;font-family:sans-serif}${LEARN_CATALOG_STYLES}</style><body>${featureHtml}</body></html>`;
  // A separate intercepted local fixture document avoids inheriting the real
  // response's nonce-bound CSP. The product response/policy is never changed.
  await page.route("**/__learn-catalog-local-fixture__", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixtureHtml }));
  await page.goto("/__learn-catalog-local-fixture__", { waitUntil: "domcontentloaded" });
  await expect(page.locator(readySelector)).toBeVisible();
  await expect(page.locator("[data-learn-entry]")).toHaveCount(1000);
  const measurements = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("#learn-query")!;
    const form = document.querySelector<HTMLFormElement>("[data-learn-form]")!;
    const root = document.querySelector<HTMLElement>("[data-learn-catalog]")!;
    const samples: number[] = [];
    for (let index = 0; index < 40; index += 1) {
      input.value = ["生物多様性", "ＴＮＦＤ", "該当なし_local_fixture", ""][index % 4]!;
      const start = performance.now();
      form.requestSubmit();
      // Include synchronous style/layout work, not only the search function.
      void root.offsetHeight;
      samples.push(performance.now() - start);
    }
    const sorted = samples.slice(1).sort((left, right) => left - right);
    return { coldDomMs: samples[0], warmDomP50Ms: sorted[Math.floor(sorted.length * .5)], warmDomP95Ms: sorted[Math.floor(sorted.length * .95)], maxDomMs: Math.max(...samples), sampleCount: samples.length };
  });
  const evidence = { scope: "local synthetic load fixture; not published articles", syntheticEntries: synthetic.length, realArticles: sourceEntries.length, featureHtmlUtf8Bytes: Buffer.byteLength(featureHtml), featureHtmlGzipBytes: gzipSync(featureHtml).byteLength, ...measurements };
  expect(evidence.warmDomP95Ms).toBeLessThan(500);
  await testInfo.attach("synthetic-1000-load", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  console.log(JSON.stringify({ evidence: "learn-catalog-synthetic-load", ...evidence }));
});
