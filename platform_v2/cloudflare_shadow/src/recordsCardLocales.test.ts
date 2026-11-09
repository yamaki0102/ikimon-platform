import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import test from "node:test";
import { chromium } from "@playwright/test";
import { renderSiteDocument } from "../../src/ui/siteShell";
import { renderRecordsProductSection } from "./index";
import { observationFirstRecordDetailCopy } from "./observationFirstRecordDetailI18n";
import { quietHomeCopy } from "./quietHome";

const locales = ["ja", "en", "es", "pt-br"] as const;
const modes = ["public", "mine"] as const;
const mediaKinds = ["photo", "video", "audio", "record"] as const;
const expected = {
  ja: { protected: "位置を保護", owner: "自分の記録", awaiting: "名前は未確認", media: ["写真", "動画", "音", "メモ"], error: "記録を読み込めませんでした。", hint: "通信を確認して、もう一度お試しください。" },
  en: { protected: "Location protected", owner: "Your record", awaiting: "Identification unconfirmed", media: ["Photo", "Video", "Sound", "Memo"], error: "Records could not be loaded.", hint: "Check the connection and try again." },
  es: { protected: "Ubicación protegida", owner: "Tu registro", awaiting: "Nombre sin confirmar", media: ["Foto", "Video", "Audio", "Nota"], error: "No se pudieron cargar los registros.", hint: "Comprueba la conexión e inténtalo de nuevo." },
  "pt-br": { protected: "Localização protegida", owner: "Seu registro", awaiting: "Nome não confirmado", media: ["Foto", "Vídeo", "Áudio", "Nota"], error: "Não foi possível carregar os registros.", hint: "Verifique a conexão e tente novamente." },
};
// English user content must remain untouched, independently of service-authored UI copy.
const userTitle = "Private Photo & Public Archive";
const userArea = "English Place & Local History";
const photoUrl = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#cee0d2"/><text x="16" y="92" font-size="22">Local fixture</text></svg>');
function record(mediaKind: typeof mediaKinds[number] = "photo", overrides = {}) {
  return { visitId: "fixture-record", displayName: userTitle, observedAt: "2026-10-01", mediaKind,
    isAwaitingId: false, photoUrl, publicAreaLabel: null, aiAssessmentStatus: null, aiCandidateLabel: null,
    ownerVisibility: "public", ...overrides };
}
function render(lang: typeof locales[number], mode: typeof modes[number], items: ReturnType<typeof record>[], unavailable = false) {
  return renderRecordsProductSection(items as never, new URL(`https://zukan.earth/${lang}/records?view=${mode}&q=Archive+%26+place`),
    mode, mode === "mine" ? { userId: "fixture", banned: false } as never : null, unavailable);
}
const decode = (value: string) => value.replaceAll("&amp;", "&");
const cardBody = (html: string) => html.match(/<a class="cf-records-native-card"[\s\S]*?<\/a>/)![0];

test("Records errors are localized independently from empty states and retry preserves the exact view and query", () => {
  for (const lang of locales) for (const mode of modes) {
    const html = render(lang, mode, [], true);
    const status = html.match(/<div class="cf-records-native-empty" role="status">([\s\S]*?)<\/div>/)![1]!;
    assert.ok(status.includes(`<strong>${expected[lang].error}</strong>`));
    assert.ok(status.includes(`<p>${expected[lang].hint}</p>`));
    assert.ok(status.includes(`>${quietHomeCopy[lang].retry}</a>`));
    assert.equal(decode(status.match(/href="([^"]+)"/)![1]!), `/${lang}/records?view=${mode}&q=Archive+%26+place`);
    assert.doesNotMatch(status, /cf-records-native-empty-secondary|cf-records-native-empty-action/);
  }
});

test("Records localize four media fallbacks and awaiting identification without translating user content", () => {
  for (const lang of locales) for (const mode of modes) for (const [index, mediaKind] of mediaKinds.entries()) {
    const normal = cardBody(render(lang, mode, [record(mediaKind, { photoUrl: null, publicAreaLabel: userArea })]));
    assert.ok(normal.includes("<strong>Private Photo &amp; Public Archive</strong>"));
    assert.ok(normal.includes(`aria-hidden="true">${expected[lang].media[index]}</span>`));
    assert.ok(normal.includes(mode === "public" ? "English Place &amp; Local History" : expected[lang].owner));
    assert.doesNotMatch(normal, new RegExp(expected[lang].awaiting));
    const unnamed = cardBody(render(lang, mode, [record(mediaKind, { displayName: null, photoUrl: null })]));
    assert.ok(unnamed.includes(`<strong>${expected[lang].media[index]}</strong>`));
    const awaiting = cardBody(render(lang, mode, [record(mediaKind, { isAwaitingId: true, photoUrl: null })]));
    assert.ok(awaiting.includes(`<strong>${expected[lang].media[index]} · `));
    assert.ok(awaiting.includes(`<span>${expected[lang].awaiting}</span>`));
    assert.doesNotMatch(awaiting, /Private Photo|<img/);
    if (mode === "public") assert.ok(awaiting.includes(expected[lang].protected));
    const href = new URL(decode(normal.match(/href="([^"]+)"/)![1]!), "https://zukan.earth");
    assert.equal(href.pathname, `/${lang}/observations/fixture-record`);
    assert.deepEqual([...href.searchParams], [["records_view", mode], ["records_q", "Archive & place"]]);
  }
});

test("Records retain public/nonpublic owner visibility and suppress every nonpublic thumbnail", () => {
  for (const lang of locales) for (const visibility of ["public", "private", "limited", "unknown"]) {
    const html = cardBody(render(lang, "mine", [record("photo", { ownerVisibility: visibility })]));
    const isPublic = visibility === "public";
    const label = observationFirstRecordDetailCopy(lang).visibility[isPublic ? "public" : "private"];
    assert.ok(html.includes(`<small>${label}</small>`));
    assert.equal(html.includes("<img"), isPublic);
    assert.equal(html.includes(photoUrl), isPublic);
    assert.ok(html.includes(expected[lang].owner));
    const publicHtml = cardBody(render(lang, "public", [record("photo", { publicAreaLabel: null })]));
    assert.ok(publicHtml.includes("<img") && publicHtml.includes(expected[lang].protected));
    assert.doesNotMatch(publicHtml, /<small>/);
  }
});

const browserPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();
test("offline Records error and mixed-media cards fit narrow locale layouts and keep retry keyboard reachable", {
  skip: !existsSync(browserPath) && "Playwright Chromium is unavailable",
}, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const screenshots = process.env.RECORDS_LOCALE_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  try {
    for (const lang of locales) for (const width of [320, 375]) for (const mode of modes) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route("**/*", route => route.abort());
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const path = `/${lang}/records`;
      const documentHtml = (body: string) => renderSiteDocument({ basePath: "", currentPath: path, canonicalPath: path,
        lang: lang === "pt-br" ? "pt-BR" : lang, title: "Records fixture", description: "Offline local fixture",
        activeNav: "records", body });
      const checkControl = async (selector: string, foreground: string, background: string | null) => {
        const control = page.locator(selector);
        const style = await control.evaluate(element => {
          const css = getComputedStyle(element), box = element.getBoundingClientRect();
          return { foreground: css.color, background: css.backgroundColor, width: box.width, height: box.height,
            unclassified: element.matches('body[data-zukan-design] a:not([class]),body[data-zukan-app-experience] a:not([class])') };
        });
        assert.equal(style.foreground, foreground, `${lang}/${width}/${mode}/${selector}: foreground`);
        if (background !== null) assert.equal(style.background, background);
        assert.ok(style.height >= 44 && style.width >= 44);
        assert.equal(style.unclassified, false, "control must not inherit document-link or visited-link colors");
        let reached = false;
        for (let tabs = 0; tabs < 40 && !reached; tabs++) {
          await page.keyboard.press("Tab");
          reached = await control.evaluate(element => element === document.activeElement);
        }
        assert.ok(reached, `${lang}/${width}/${mode}/${selector}: not reached by keyboard Tab`);
        const focus = await control.evaluate(element => {
          const css = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return { outline: css.outlineColor, width: css.outlineWidth, shadow: css.boxShadow,
            focusVisible: element === document.activeElement && element.matches(":focus-visible"),
            hitTarget: Boolean(hit && element.contains(hit)) };
        });
        assert.ok(focus.focusVisible && focus.hitTarget, `${lang}/${width}/${mode}/${selector}: focus hidden or covered`);
        assert.equal(focus.outline, "rgb(0, 0, 0)");
        assert.equal(focus.width, "2px");
        assert.ok(focus.shadow.includes("rgb(255, 212, 61)"));
      };
      const items = [record(), ...mediaKinds.map(mediaKind => record(mediaKind, { visitId: `fixture-${mediaKind}`, isAwaitingId: true, photoUrl: null })),
        record("photo", { visitId: "fixture-private", ownerVisibility: "private" })];
      await page.setContent(documentHtml(render(lang, mode, items)), { waitUntil: "domcontentloaded" });
      assert.ok(await page.evaluate(() => document.activeElement === document.body));
      assert.equal(await page.locator(".cf-records-native-card").count(), 6);
      assert.equal(await page.locator(".cf-records-native-card img").count(), mode === "mine" ? 1 : 2);
      for (const image of await page.locator(".cf-records-native-card img").all()) {
        await image.evaluate((element: HTMLImageElement) => element.decode());
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${width}/${mode}: card overflow`);
      const clipped = await page.locator(".cf-records-native-copy, .cf-records-native-no-media").evaluateAll(elements => elements.some(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const card = element.closest(".cf-records-native-card")!.getBoundingClientRect();
        return [...range.getClientRects()].some(box => box.left < card.left || box.right > card.right + 1);
      }));
      assert.equal(clipped, false, `${lang}/${width}/${mode}: card text clipped`);
      if (mode === "mine") {
        await checkControl('.cf-records-native-tabs [aria-current="page"]', "rgb(255, 255, 255)", "rgb(20, 63, 46)");
        await checkControl('.cf-records-native-tabs a:not([aria-current])', "rgb(20, 63, 46)", "rgb(255, 255, 255)");
      }
      if (screenshots && ((lang === "es" && width === 375) || (lang === "pt-br" && width === 320))) {
        await page.screenshot({ path: `${screenshots}/${lang}-${width}-${mode}-cards.png`, fullPage: true });
      }
      await page.setContent(documentHtml(render(lang, mode, [], true)), { waitUntil: "domcontentloaded" });
      assert.ok(await page.evaluate(() => document.activeElement === document.body));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${width}/${mode}: error overflow`);
      const retry = page.locator('[role="status"] a');
      await checkControl('[role="status"] a', "rgb(255, 255, 255)", "rgb(20, 63, 46)");
      const bounds = await retry.boundingBox();
      assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44);
      if (screenshots && mode === "public" && ((lang === "es" && width === 375) || (lang === "pt-br" && width === 320))) {
        await page.screenshot({ path: `${screenshots}/${lang}-${width}-error.png`, fullPage: true });
      }
      await page.setContent(documentHtml(render(lang, mode, [])), { waitUntil: "domcontentloaded" });
      assert.ok(await page.evaluate(() => document.activeElement === document.body));
      await checkControl('.cf-records-native-empty-action', "rgb(255, 255, 255)", "rgb(20, 63, 46)");
      await checkControl('.cf-records-native-empty-secondary', "rgb(20, 63, 46)", null);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
